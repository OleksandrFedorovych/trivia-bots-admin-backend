/**
 * Trivia Bot
 * 
 * Complete bot implementation that joins games and plays trivia.
 */

import { chromium } from 'playwright';
import config from '../config/default.js';
import PageActions from './pageActions.js';
import GameStateManager, { GameStates } from './gameState.js';
import behaviorEngine from '../players/behaviorEngine.js';
import { sleep, randomSleep, calculateJoinTiming } from '../utils/timing.js';
import { createPlayerLogger } from '../utils/logger.js';

/**
 * Trivia Bot class
 */
export class TriviaBot {
  constructor(profile, options = {}) {
    this.profile = profile;
    this.options = {
      gameUrl: options.gameUrl || config.game.url,
      headless: options.headless ?? config.browser.headless,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 2000,
      ...options,
    };

    this.logger = createPlayerLogger(profile.id);
    this.browser = null;
    this.context = null;
    this.page = null;
    this.pageActions = null;
    this.stateManager = null;
    this.isRunning = false;
    this.questionNumber = 0;
    this.retryCount = 0;
    this.lastError = null;
    this.gameResults = {
      questionsAnswered: 0,
      correctAnswers: 0,
      finalScore: null,
      finalRank: null,
    };
  }

  /**
   * Initialize the browser and page
   */
  async initialize() {
    this.logger.info('Initializing bot');

    this.browser = await chromium.launch({
      headless: this.options.headless,
    });

    this.context = await this.browser.newContext({
      viewport: config.browser.viewport,
      userAgent: config.browser.userAgent,
    });

    this.page = await this.context.newPage();

    // Set up error handlers for auto-recovery
    this.setupErrorHandlers();

    this.pageActions = new PageActions(this.page, this.profile);
    this.stateManager = new GameStateManager(this.page, this.profile);

    // Reset behavior engine state for this player
    behaviorEngine.resetPlayer(this.profile);

    this.logger.info('Bot initialized');
  }

  /**
   * Set up error handlers for auto-recovery
   */
  setupErrorHandlers() {
    // Handle page crashes
    this.page.on('crash', async () => {
      this.logger.error('Page crashed! Attempting recovery...');
      this.lastError = 'page_crash';
      await this.attemptRecovery();
    });

    // Handle page close
    this.page.on('close', () => {
      if (this.isRunning) {
        this.logger.warn('Page closed unexpectedly');
        this.lastError = 'page_closed';
      }
    });

    // Handle console errors
    this.page.on('pageerror', (error) => {
      this.logger.debug(`Page error: ${error.message}`);
    });

    // Handle disconnection
    this.browser.on('disconnected', () => {
      if (this.isRunning) {
        this.logger.error('Browser disconnected!');
        this.lastError = 'browser_disconnected';
      }
    });
  }

  /**
   * Attempt to recover from errors
   */
  async attemptRecovery() {
    if (this.retryCount >= this.options.maxRetries) {
      this.logger.error(`Max retries (${this.options.maxRetries}) exceeded, giving up`);
      this.isRunning = false;
      return false;
    }

    this.retryCount++;
    this.logger.info(`Recovery attempt ${this.retryCount}/${this.options.maxRetries}`);

    try {
      // Clean up existing resources
      await this.cleanupSilent();

      // Wait before retry
      await sleep(this.options.retryDelay);

      // Re-initialize
      await this.initialize();

      // Re-navigate to game
      if (this.options.gameUrl) {
        await this.pageActions.navigateToGame(this.options.gameUrl);
      }

      this.logger.info('Recovery successful');
      return true;
    } catch (error) {
      this.logger.error(`Recovery failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Silent cleanup (no logging, for recovery)
   */
  async cleanupSilent() {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => { });
      }
      if (this.context) {
        await this.context.close().catch(() => { });
      }
      if (this.browser) {
        await this.browser.close().catch(() => { });
      }
    } catch (e) { /* ignore */ }

    this.page = null;
    this.context = null;
    this.browser = null;
    this.pageActions = null;
    this.stateManager = null;
  }

  /**
   * Retry wrapper for operations that might fail
   */
  async withRetry(operation, operationName, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.logger.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}): ${error.message}`);

        if (attempt < maxRetries) {
          // Check if we need full recovery or just retry
          if (this.needsRecovery(error)) {
            const recovered = await this.attemptRecovery();
            if (!recovered) break;
          } else {
            await sleep(1000 * attempt); // Exponential backoff
          }
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if error requires full recovery
   */
  needsRecovery(error) {
    const recoveryErrors = [
      'Target closed',
      'Target page, context or browser has been closed',
      'Execution context was destroyed',
      'Protocol error',
      'Connection closed',
      'Browser closed',
      'Page crashed',
    ];

    return recoveryErrors.some(msg => error.message?.includes(msg));
  }

  /**
   * Join the game
   * @param {string} gameUrl - Optional game URL override
   */
  async joinGame(gameUrl) {
    const url = gameUrl || this.options.gameUrl;

    // Calculate join timing based on profile
    const joinTiming = calculateJoinTiming(this.profile);

    if (!joinTiming.shouldJoin) {
      this.logger.info(`Player will not join (${joinTiming.reason})`);
      return false;
    }

    if (joinTiming.delay > 0) {
      this.logger.info(`Joining ${joinTiming.reason}, delay: ${joinTiming.delay}ms`);
      await sleep(joinTiming.delay);
    }

    // Navigate to game with retry
    await this.withRetry(
      () => this.pageActions.navigateToGame(url),
      'Navigate to game'
    );

    // Detect initial state
    const state = await this.stateManager.detectState();

    if (state === GameStates.REGISTRATION) {
      // Fill registration form with retry
      await this.withRetry(
        () => this.pageActions.fillRegistrationForm(),
        'Fill registration'
      );
      await randomSleep(500, 1500);

      // Click join with retry
      const joined = await this.withRetry(
        () => this.pageActions.clickJoin(),
        'Click join button'
      );

      if (!joined) {
        this.logger.error('Failed to join game');
        return false;
      }

      await randomSleep(1000, 2000);
    }

    this.logger.info('Successfully joined game');
    this.retryCount = 0; // Reset retry count on success
    return true;
  }

  /**
   * Wait for the game to start
   * @param {number} timeout - Timeout in ms
   */
  async waitForGameStart(timeout = 300000) {
    this.logger.info('Waiting for game to start');

    try {
      // Wait for any game state (question, countdown, answer reveal, or game ended)
      const state = await this.stateManager.waitForState(
        [GameStates.COUNTDOWN, GameStates.QUESTION, GameStates.ANSWER_REVEAL, GameStates.BETWEEN_QUESTIONS, GameStates.GAME_ENDED],
        timeout
      );

      // Check if we got game ended state
      if (state === GameStates.GAME_ENDED) {
        this.logger.info('Game has ended');
        return false;
      }

      if (state === GameStates.COUNTDOWN) {
        this.logger.info('Countdown started');
        try {
          await this.stateManager.waitForState([GameStates.QUESTION, GameStates.GAME_ENDED], 180000);
        } catch (e) {
          this.logger.warn('Countdown finished but no question detected');
        }
      }

      // Re-check state after countdown
      const currentState = await this.stateManager.detectState();
      if (currentState === GameStates.GAME_ENDED) {
        this.logger.info('Game has ended');
        return false;
      }

      this.logger.info('Game started!');
      return true;
    } catch (error) {
      this.logger.error('Timeout waiting for game start');
      return false;
    }
  }

  /**
   * Handle a single question
   */
  async handleQuestion() {
    this.questionNumber++;

    // 15. Question X started: full question shows here
    const questionText = await this.pageActions.getQuestionText();
    this.logger.info(`========================================`);
    this.logger.info(`QUESTION ${this.questionNumber} STARTED`);
    this.logger.info(`Question: ${questionText}`);

    // 16. Possible answers shown here
    const { type: questionType, options } = await this.pageActions.getAnswerOptions();

    this.logger.info(`Answer Type: ${questionType}`);
    if (questionType === 'multiple_choice') {
      this.logger.info(`Possible Answers:`);
      options.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i); // A, B, C, D
        // Clean up the text - remove extra newlines and whitespace
        const cleanText = (opt.text || 'N/A').replace(/\s+/g, ' ').trim().substring(0, 50);
        this.logger.info(`  ${letter}. ${cleanText}`);
      });
    } else if (questionType === 'number_input') {
      this.logger.info(`Possible Answers: NUMBER INPUT REQUIRED`);
    } else if (questionType === 'text_input') {
      this.logger.info(`Possible Answers: TEXT INPUT REQUIRED`);
    } else if (questionType === 'true_false') {
      this.logger.info(`Possible Answers: TRUE / FALSE`);
    } else {
      this.logger.info(`Possible Answers: ${options.length} options (${questionType})`);
    }

    if (options.length === 0) {
      this.logger.warn('No answer options found - skipping');
      await sleep(2000);
      await this.waitAndLogRanking();
      return;
    }

    // Select answer
    const decision = behaviorEngine.selectAnswer(
      this.profile,
      options,
      null,
      { difficulty: 0.5 }
    );
    const selectedIndex = Math.min(decision.index, options.length - 1);

    // Brief delay before answering
    await sleep(Math.min(decision.delay, 1000));

    // 17. Answered blablabla
    let answerText = '';
    if (questionType === 'multiple_choice') {
      const cleanText = (options[selectedIndex]?.text || '').replace(/\s+/g, ' ').trim().substring(0, 50);
      answerText = `${String.fromCharCode(65 + selectedIndex)}. ${cleanText}`;
    } else if (questionType === 'number_input') {
      answerText = 'Random number (1-100)';
    } else if (questionType === 'true_false') {
      answerText = selectedIndex === 0 ? 'True' : 'False';
    } else {
      answerText = `Option ${selectedIndex + 1}`;
    }

    const clicked = await this.pageActions.clickAnswer(selectedIndex, questionType);

    if (clicked) {
      this.gameResults.questionsAnswered++;
      this.logger.info(`ANSWERED: ${answerText}`);

      // 18. Result: right or wrong
      await sleep(1500);
      const wasCorrect = await this.pageActions.checkAnswerResult();

      if (wasCorrect === true) {
        this.gameResults.correctAnswers++;
        behaviorEngine.recordAnswer(this.profile, true);
        this.logger.info(`RESULT: ✓ CORRECT`);
      } else if (wasCorrect === false) {
        behaviorEngine.recordAnswer(this.profile, false);
        this.logger.info(`RESULT: ✗ WRONG`);
      } else {
        this.logger.info(`RESULT: ? (could not determine)`);
      }

      // 19. Show the ranking
      await this.waitAndLogRanking();

    } else {
      this.logger.error(`ANSWERED: FAILED TO SUBMIT`);
      this.logger.info(`RESULT: ✗ NO ANSWER SUBMITTED`);
      await sleep(2000);
      await this.waitAndLogRanking();
    }

    this.logger.info(`========================================`);
  }

  /**
   * Wait for ranking screen and log the current ranking
   */
  async waitAndLogRanking() {
    // Wait for the ranking screen to appear
    await sleep(3000);

    try {
      const pageText = await this.page.evaluate(() => document.body.innerText);

      // Look for various ranking patterns
      let rank = null;
      let points = null;

      // Pattern 1: "Your ranking: #X" or "Your ranking #X"
      let rankingMatch = pageText.match(/your ranking[:\s]*#?(\d+)/i);
      if (rankingMatch) rank = rankingMatch[1];

      // Pattern 2: "#X place" or "Xst/nd/rd/th place"
      if (!rank) {
        rankingMatch = pageText.match(/#(\d+)\s*(?:place|rank)/i) ||
          pageText.match(/(\d+)(?:st|nd|rd|th)\s*place/i);
        if (rankingMatch) rank = rankingMatch[1];
      }

      // Pattern 3: "Rank: X" or "Place: X"  
      if (!rank) {
        rankingMatch = pageText.match(/(?:rank|place)[:\s]*#?(\d+)/i);
        if (rankingMatch) rank = rankingMatch[1];
      }

      // Get points
      const pointsMatch = pageText.match(/(\d+)\s*point/i);
      if (pointsMatch) points = pointsMatch[1];

      // 19. Show the ranking
      if (rank) {
        this.logger.info(`RANKING: #${rank}${points ? ` | POINTS: ${points}` : ''}`);
      } else if (points) {
        this.logger.info(`RANKING: ? | POINTS: ${points}`);
      } else {
        this.logger.info(`RANKING: (waiting for next question...)`);
      }

    } catch (e) {
      this.logger.info(`RANKING: (page loading...)`);
    }

    // Wait before next question
    await sleep(1000);
  }

  /**
   * Main game loop - Simple flow: QUESTION -> RANKING -> QUESTION -> GAME_ENDED
   */
  async playGame() {
    this.isRunning = true;
    this.logger.info('GAME STARTED');

    // Start state polling
    const stopPolling = this.stateManager.startPolling(300);
    let errorCount = 0;
    const maxErrors = 10;

    try {
      while (this.isRunning) {
        const state = await this.stateManager.detectState();

        switch (state) {
          case GameStates.QUESTION:
            // QUESTION: Answer buttons visible -> Answer it!
            errorCount = 0;
            await this.handleQuestion();
            await sleep(500);
            break;

          case GameStates.RANKING:
            // Ranking screen - just wait for next question
            errorCount = 0;
            await sleep(500);
            break;

          case GameStates.ANSWER_REVEAL:
            // ANSWER_REVEAL: Brief transition, just wait
            errorCount = 0;
            await sleep(500);
            break;

          case GameStates.BETWEEN_QUESTIONS:
            // Between questions - wait for next
            errorCount = 0;
            await sleep(500);
            break;

          case GameStates.GAME_ENDED:
            this.logger.info('🏁 Game ended!');
            this.gameResults.finalScore = await this.pageActions.getCurrentScore();
            this.logger.info(`Final Score: ${this.gameResults.correctAnswers}/${this.gameResults.questionsAnswered} correct`);
            this.isRunning = false;
            break;

          case GameStates.REGISTRATION:
            // Handle "Welcome back" or registration
            errorCount = 0;
            this.logger.info('Registration/Welcome screen detected');
            await this.pageActions.clickContinuePlaying();
            await sleep(1000);
            break;

          case GameStates.ERROR:
            errorCount++;
            this.logger.warn(`Error state (${errorCount}/${maxErrors})`);
            if (errorCount >= maxErrors) {
              this.logger.error('Too many errors, stopping');
              this.isRunning = false;
            } else {
              await sleep(1000);
            }
            break;

          case GameStates.WAITING:
          case GameStates.COUNTDOWN:
            errorCount = 0;
            await sleep(500);
            break;

          case GameStates.UNKNOWN:
          default:
            await sleep(500);
        }
      }
    } catch (error) {
      this.logger.error('Error in game loop', { error: error.message });
    } finally {
      stopPolling();
    }

    return this.gameResults;
  }

  /**
   * Run the complete bot flow
   * @param {string} gameUrl - Optional game URL
   */
  async run(gameUrl) {
    try {
      await this.initialize();

      const joined = await this.joinGame(gameUrl);
      if (!joined) {
        return null;
      }

      const gameStarted = await this.waitForGameStart();
      if (!gameStarted) {
        return null;
      }

      const results = await this.playGame();

      this.logger.info('Bot run complete', {
        questionsAnswered: results.questionsAnswered,
        correctAnswers: results.correctAnswers,
        accuracy: results.questionsAnswered > 0
          ? (results.correctAnswers / results.questionsAnswered * 100).toFixed(1) + '%'
          : 'N/A',
      });

      return results;
    } catch (error) {
      this.logger.error('Bot run failed', { error: error.message });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Stop the bot
   */
  stop() {
    this.isRunning = false;
    this.logger.info('Bot stopped');
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.logger.info('Cleaning up');

    if (this.page) {
      await this.page.close().catch(() => { });
    }
    if (this.context) {
      await this.context.close().catch(() => { });
    }
    if (this.browser) {
      await this.browser.close().catch(() => { });
    }

    this.page = null;
    this.context = null;
    this.browser = null;
  }
}

export default TriviaBot;





