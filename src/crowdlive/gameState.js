/**
 * Crowd.live Game State Detection
 * 
 * Monitors and detects the current state of the trivia game.
 */

import selectors from '../config/selectors.js';
import { sleep } from '../utils/timing.js';
import { createPlayerLogger } from '../utils/logger.js';

/**
 * Possible game states
 */
export const GameStates = {
  REGISTRATION: 'registration',
  WAITING: 'waiting',
  COUNTDOWN: 'countdown',
  QUESTION: 'question',
  ANSWER_REVEAL: 'answer_reveal',
  RANKING: 'ranking',  // Leaderboard/standings screen between questions
  BETWEEN_QUESTIONS: 'between_questions',
  GAME_ENDED: 'game_ended',
  ERROR: 'error',
  UNKNOWN: 'unknown',
};

/**
 * Game State Manager
 */
export class GameStateManager {
  constructor(page, profile) {
    this.page = page;
    this.profile = profile;
    this.logger = createPlayerLogger(profile.id);
    this.currentState = GameStates.UNKNOWN;
    this.previousState = null;
    this.questionNumber = 0;
    this.stateChangeCallbacks = [];
  }

  /**
   * Try multiple selectors and return the first match
   * @param {string|array} selectorOrArray - Selector string or array of selectors
   * @returns {Promise<ElementHandle|null>} First matching element or null
   */
  async findBySelectors(selectorOrArray) {
    const selectorList = Array.isArray(selectorOrArray) ? selectorOrArray : [selectorOrArray];
    
    for (const selector of selectorList) {
      try {
        const element = await this.page.$(selector);
        if (element) return element;
      } catch (e) {
        // Ignore invalid selectors
      }
    }
    return null;
  }

  /**
   * Detect the current game state
   * Simple flow: QUESTION -> RESULT/RANKING -> QUESTION -> ... -> GAME_ENDED
   * @returns {Promise<string>} Current game state
   */
  async detectState() {
    try {
      // Get page text
      let pageText = '';
      try {
        pageText = await this.page.evaluate(() => document.body.innerText.toLowerCase());
      } catch (evalError) {
        this.logger.debug('Page not ready, keeping current state');
        return this.currentState;
      }

      // STEP 1: Check for answer buttons FIRST (most important for detecting QUESTION state)
      let answerButtonCount = 0;
      try {
        const letterButtons = await this.page.$$('button:has-text("A."), button:has-text("B."), button:has-text("C."), button:has-text("D.")');
        const gripButtons = await this.page.$$('button[name*="Grip Icon"]');
        answerButtonCount = letterButtons.length + gripButtons.length;
      } catch (e) {
        // Ignore selector errors
      }

      // STEP 2: Check for "Your ranking:" text (indicates result/ranking screen)
      const hasYourRanking = pageText.includes('your ranking');
      
      // STEP 3: Get timer if present
      const timerMatch = pageText.match(/(\d+):(\d{2})/);
      let timerSeconds = -1;
      if (timerMatch) {
        timerSeconds = parseInt(timerMatch[1]) * 60 + parseInt(timerMatch[2]);
      }

      this.logger.debug(`State: buttons=${answerButtonCount}, yourRanking=${hasYourRanking}, timer=${timerSeconds}s`);

      // === STATE DETECTION ===

      // Check for returning player screen
      if (pageText.includes('welcome back') || pageText.includes('continue playing')) {
        return this.setState(GameStates.REGISTRATION);
      }

      // Check for registration form
      const hasRegistrationForm = await this.page.$('input[placeholder*="Nickname"], input[name*="nickname"]');
      if (hasRegistrationForm) {
        return this.setState(GameStates.REGISTRATION);
      }

      // Check for GAME ENDED
      if (pageText.includes('you finished') || 
          pageText.includes('game over') || 
          pageText.includes('thank you for playing') ||
          pageText.includes('final results')) {
        return this.setState(GameStates.GAME_ENDED);
      }

      // QUESTION state: Has answer buttons to click AND timer > 0
      if (answerButtonCount > 0 && timerSeconds > 0) {
        return this.setState(GameStates.QUESTION);
      }

      // RANKING state: Shows "Your ranking:" text
      if (hasYourRanking) {
        return this.setState(GameStates.RANKING);
      }

      // ANSWER_REVEAL: Timer is 0 or shows wrong/correct feedback
      if (timerSeconds === 0 || pageText.includes('time has run out')) {
        return this.setState(GameStates.ANSWER_REVEAL);
      }

      // WAITING: Waiting for game to start
      if (pageText.includes('will be activated shortly') || 
          pageText.includes('waiting') ||
          pageText.includes('game will start') ||
          pageText.includes('hang tight')) {
        return this.setState(GameStates.WAITING);
      }

      // Default: between questions or unknown
      if (timerMatch) {
        return this.setState(GameStates.BETWEEN_QUESTIONS);
      }

      // Check for actual error messages on page
      if (pageText.includes('something went wrong') || 
          pageText.includes('unable to join') ||
          pageText.includes('error occurred')) {
        return this.setState(GameStates.ERROR);
      }

      // If we have a user menu (signed in) but no game elements, we're waiting
      if (pageText.includes('sign out') || pageText.includes('my profile')) {
        return this.setState(GameStates.WAITING);
      }

      // Default to current state to avoid flickering
      return this.currentState || GameStates.WAITING;
    } catch (error) {
      // Don't switch to ERROR state for navigation/context errors
      this.logger.debug('Temporary error in state detection, keeping current state', { error: error.message });
      return this.currentState;
    }
  }

  /**
   * Set the current state and trigger callbacks
   * @param {string} newState - New game state
   * @returns {string} The new state
   */
  setState(newState) {
    if (newState !== this.currentState) {
      this.previousState = this.currentState;
      this.currentState = newState;
      this.logger.debug(`State changed: ${this.previousState} -> ${newState}`);
      
      // Track question number
      if (newState === GameStates.QUESTION && this.previousState !== GameStates.QUESTION) {
        this.questionNumber++;
        this.logger.info(`Question ${this.questionNumber} started`);
      }

      // Trigger callbacks
      this.stateChangeCallbacks.forEach(cb => {
        try {
          cb(newState, this.previousState);
        } catch (e) {
          this.logger.error('State change callback error', { error: e.message });
        }
      });
    }
    return this.currentState;
  }

  /**
   * Register a callback for state changes
   * @param {function} callback - Callback function(newState, previousState)
   */
  onStateChange(callback) {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Wait for a specific state
   * @param {string|array} targetStates - State(s) to wait for
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<string>} The reached state
   */
  async waitForState(targetStates, timeout = 30000) {
    const states = Array.isArray(targetStates) ? targetStates : [targetStates];
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentState = await this.detectState();
      
      if (states.includes(currentState)) {
        return currentState;
      }

      // Only GAME_ENDED is a terminal state, ERROR should keep waiting
      // because it might just be a temporary navigation issue
      if (currentState === GameStates.GAME_ENDED) {
        return currentState;
      }

      await sleep(500);
    }

    throw new Error(`Timeout waiting for state: ${states.join(', ')}`);
  }

  /**
   * Wait for state to change from current
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<string>} The new state
   */
  async waitForStateChange(timeout = 30000) {
    const startState = this.currentState;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentState = await this.detectState();
      
      if (currentState !== startState) {
        return currentState;
      }

      await sleep(500);
    }

    throw new Error(`Timeout waiting for state change from: ${startState}`);
  }

  /**
   * Poll for state changes continuously
   * @param {number} interval - Poll interval in ms
   * @returns {function} Stop function
   */
  startPolling(interval = 1000) {
    let running = true;

    const poll = async () => {
      while (running) {
        try {
          await this.detectState();
        } catch (error) {
          this.logger.error('Polling error', { error: error.message });
        }
        await sleep(interval);
      }
    };

    poll();

    return () => {
      running = false;
    };
  }

  /**
   * Get current state info
   * @returns {object} State information
   */
  getStateInfo() {
    return {
      current: this.currentState,
      previous: this.previousState,
      questionNumber: this.questionNumber,
    };
  }

  /**
   * Reset state for a new game
   */
  reset() {
    this.currentState = GameStates.UNKNOWN;
    this.previousState = null;
    this.questionNumber = 0;
  }
}

export default GameStateManager;





