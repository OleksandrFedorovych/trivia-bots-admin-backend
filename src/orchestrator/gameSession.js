/**
 * Game Session
 * 
 * Coordinates a complete trivia game session with multiple players.
 */

import PlayerPool from './playerPool.js';
import { resultsWriter } from '../players/resultsWriter.js';
import logger from '../utils/logger.js';
import config from '../config/default.js';

// Optional database integration (lazy loaded)
let sessionServicePromise = null;
async function getSessionService() {
  if (sessionServicePromise) {
    return sessionServicePromise;
  }

  sessionServicePromise = (async () => {
    // Only import if database is configured
    if (!process.env.DB_NAME && !process.env.DB_HOST) {
      return null;
    }

    try {
      const { saveSessionToDatabase, updateSessionStatus } = await import('../../admin/backend/services/sessionService.js');
      logger.info('Database integration enabled');
      return { saveSessionToDatabase, updateSessionStatus };
    } catch (error) {
      logger.debug('Database integration not available (this is OK if database is not configured)');
      return null;
    }
  })();

  return sessionServicePromise;
}

/**
 * Game Session class
 */
export class GameSession {
  constructor(options = {}) {
    this.gameUrl = options.gameUrl || config.game.url;
    this.players = options.players || [];
    this.pool = null;
    this.sessionId = `session-${Date.now()}`;
    this.startTime = null;
    this.saveResults = options.saveResults ?? true;
    this.league = options.league || 'Unknown';
    this.endTime = null;
    this.status = 'idle'; // idle, initializing, running, completed, failed

    this.options = {
      maxConcurrent: options.maxConcurrent || config.browser.maxConcurrent,
      headless: options.headless ?? config.browser.headless,
      staggerDelay: options.staggerDelay || { min: 1000, max: 5000 },
    };
  }

  /**
   * Set the game URL
   * @param {string} url - Game URL
   */
  setGameUrl(url) {
    this.gameUrl = url;
    logger.info(`Game URL set: ${url}`);
  }

  /**
   * Set players for the session
   * @param {array} players - Array of player profiles
   */
  setPlayers(players) {
    this.players = players;
    logger.info(`${players.length} players set for session`);
  }

  /**
   * Add a player to the session
   * @param {object} player - Player profile
   */
  addPlayer(player) {
    this.players.push(player);
  }

  /**
   * Initialize the session
   */
  async initialize() {
    if (this.status !== 'idle') {
      throw new Error(`Cannot initialize session in ${this.status} state`);
    }

    this.status = 'initializing';
    logger.info(`Initializing session ${this.sessionId}`);

    // Create player pool
    this.pool = new PlayerPool({
      maxConcurrent: this.options.maxConcurrent,
      headless: this.options.headless,
    });

    // Add players to pool
    this.pool.addPlayers(this.players);

    logger.info(`Session initialized with ${this.players.length} players`);
  }

  /**
   * Start the game session
   * @returns {Promise<object>} Session results
   */
  async start() {
    if (!this.pool) {
      await this.initialize();
    }

    if (this.players.length === 0) {
      throw new Error('No players in session');
    }

    if (!this.gameUrl) {
      throw new Error('No game URL set');
    }

    this.status = 'running';
    this.startTime = new Date();
    logger.info(`Starting session ${this.sessionId} at ${this.startTime.toISOString()}`);
    logger.info(`Game URL: ${this.gameUrl}`);
    logger.info(`Players: ${this.players.length}`);

    // Update database status (if available)
    const sessionService = await getSessionService();
    if (sessionService?.updateSessionStatus) {
      try {
        await sessionService.updateSessionStatus(this.sessionId, 'running', {
          start_time: this.startTime,
          game_url: this.gameUrl,
          total_players: this.players.length,
        });
      } catch (error) {
        logger.debug(`Failed to update session status in database: ${error.message}`);
      }
    }

    try {
      const results = await this.pool.startAll(this.gameUrl, {
        staggerDelay: this.options.staggerDelay,
        maxConcurrent: this.options.maxConcurrent,
      });

      this.endTime = new Date();
      this.status = 'completed';

      const duration = (this.endTime - this.startTime) / 1000;
      logger.info(`Session completed in ${duration.toFixed(1)} seconds`);

      const sessionResults = {
        sessionId: this.sessionId,
        gameUrl: this.gameUrl,
        startTime: this.startTime,
        endTime: this.endTime,
        duration,
        ...results,
      };

      // Save results to Excel if enabled
      if (this.saveResults) {
        try {
          resultsWriter.saveSessionResults(sessionResults, {
            gameUrl: this.gameUrl,
            league: this.league,
          });
          resultsWriter.saveSessionSummary(sessionResults, {
            gameUrl: this.gameUrl,
            league: this.league,
          });
          logger.info(`Results saved to Excel: ${resultsWriter.getFilePath()}`);
        } catch (saveError) {
          logger.warn(`Could not save results to Excel: ${saveError.message}`);
        }
      }

      // Save results to database if enabled
      const sessionService = await getSessionService();
      if (sessionService?.saveSessionToDatabase) {
        try {
          await sessionService.saveSessionToDatabase(sessionResults, {
            league: this.league,
          });
          logger.info(`Results saved to database`);
        } catch (dbError) {
          logger.warn(`Could not save results to database: ${dbError.message}`);
        }
      }

      return sessionResults;
    } catch (error) {
      this.status = 'failed';
      this.endTime = new Date();
      logger.error(`Session failed: ${error.message}`);

      // Update database status on failure
      const sessionService = await getSessionService();
      if (sessionService?.updateSessionStatus) {
        try {
          await sessionService.updateSessionStatus(this.sessionId, 'failed', {
            end_time: this.endTime,
          });
        } catch (dbError) {
          logger.debug(`Failed to update session status in database: ${dbError.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Stop the session
   */
  async stop() {
    logger.info(`Stopping session ${this.sessionId}`);

    if (this.pool) {
      await this.pool.stopAll();
    }

    this.status = this.status === 'running' ? 'stopped' : this.status;
    this.endTime = new Date();
  }

  /**
   * Get session status
   * @returns {object} Session status
   */
  getStatus() {
    return {
      sessionId: this.sessionId,
      status: this.status,
      gameUrl: this.gameUrl,
      playerCount: this.players.length,
      startTime: this.startTime,
      endTime: this.endTime,
      poolStats: this.pool?.getStats() || null,
    };
  }

  /**
   * Cleanup session resources
   */
  async cleanup() {
    if (this.pool) {
      await this.pool.clear();
      this.pool = null;
    }
    logger.info(`Session ${this.sessionId} cleaned up`);
  }
}

export default GameSession;
