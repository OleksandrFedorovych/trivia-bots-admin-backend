/**
 * Player Pool
 * 
 * Manages a pool of browser instances and bot players for concurrent gameplay.
 */

import { chromium } from 'playwright';
import config from '../config/default.js';
import TriviaBot from '../crowdlive/triviaBot.js';
import logger from '../utils/logger.js';
import { sleep, randomDelay } from '../utils/timing.js';

/**
 * Player Pool class
 */
export class PlayerPool {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || config.browser.maxConcurrent;
    this.headless = options.headless ?? config.browser.headless;
    this.bots = new Map();        // playerId -> TriviaBot
    this.activeBots = new Set();  // Set of active player IDs
    this.results = new Map();     // playerId -> game results
    this.isRunning = false;
  }

  /**
   * Add a player to the pool
   * @param {object} profile - Player profile
   */
  addPlayer(profile) {
    if (this.bots.has(profile.id)) {
      logger.warn(`Player ${profile.id} already in pool`);
      return;
    }

    const bot = new TriviaBot(profile, {
      headless: this.headless,
    });

    this.bots.set(profile.id, bot);
    logger.debug(`Added player to pool: ${profile.id}`);
  }

  /**
   * Add multiple players to the pool
   * @param {array} profiles - Array of player profiles
   */
  addPlayers(profiles) {
    profiles.forEach(profile => this.addPlayer(profile));
    logger.info(`Added ${profiles.length} players to pool. Total: ${this.bots.size}`);
  }

  /**
   * Remove a player from the pool
   * @param {string} playerId - Player ID to remove
   */
  async removePlayer(playerId) {
    const bot = this.bots.get(playerId);
    if (bot) {
      bot.stop();
      await bot.cleanup();
      this.bots.delete(playerId);
      this.activeBots.delete(playerId);
      logger.debug(`Removed player from pool: ${playerId}`);
    }
  }

  /**
   * Start a single bot
   * @param {string} playerId - Player ID
   * @param {string} gameUrl - Game URL
   * @returns {Promise<object>} Game results
   */
  async startBot(playerId, gameUrl) {
    const bot = this.bots.get(playerId);
    if (!bot) {
      throw new Error(`Player not found: ${playerId}`);
    }

    if (this.activeBots.has(playerId)) {
      logger.warn(`Player ${playerId} is already running`);
      return null;
    }

    this.activeBots.add(playerId);
    logger.info(`Starting bot: ${playerId}`);

    try {
      const results = await bot.run(gameUrl);
      this.results.set(playerId, results);
      return results;
    } catch (error) {
      logger.error(`Bot ${playerId} failed`, { error: error.message });
      this.results.set(playerId, { error: error.message });
      return { error: error.message };
    } finally {
      this.activeBots.delete(playerId);
    }
  }

  /**
   * Start all bots with staggered timing
   * @param {string} gameUrl - Game URL
   * @param {object} options - Start options
   */
  async startAll(gameUrl, options = {}) {
    const { 
      staggerDelay = { min: 1000, max: 5000 },
      maxConcurrent = this.maxConcurrent,
    } = options;

    this.isRunning = true;
    const playerIds = Array.from(this.bots.keys());
    const promises = [];

    logger.info(`Starting ${playerIds.length} bots (max concurrent: ${maxConcurrent})`);

    for (let i = 0; i < playerIds.length && this.isRunning; i++) {
      // Wait if we're at max concurrent
      while (this.activeBots.size >= maxConcurrent && this.isRunning) {
        await sleep(500);
      }

      if (!this.isRunning) break;

      const playerId = playerIds[i];
      
      // Staggered start
      if (i > 0) {
        const delay = randomDelay(staggerDelay.min, staggerDelay.max);
        await sleep(delay);
      }

      // Start bot (non-blocking)
      const promise = this.startBot(playerId, gameUrl).catch(error => {
        logger.error(`Bot ${playerId} error`, { error: error.message });
      });

      promises.push(promise);
    }

    // Wait for all bots to complete
    await Promise.all(promises);
    
    this.isRunning = false;
    logger.info('All bots completed');

    return this.getResults();
  }

  /**
   * Stop all bots
   */
  async stopAll() {
    logger.info('Stopping all bots');
    this.isRunning = false;

    const stopPromises = Array.from(this.bots.values()).map(bot => {
      bot.stop();
      return bot.cleanup();
    });

    await Promise.all(stopPromises);
    this.activeBots.clear();
    logger.info('All bots stopped');
  }

  /**
   * Get results for all players
   * @returns {object} Results object
   */
  getResults() {
    const results = {
      totalPlayers: this.bots.size,
      completed: 0,
      failed: 0,
      players: {},
    };

    this.results.forEach((result, playerId) => {
      if (result && !result.error) {
        results.completed++;
        results.players[playerId] = result;
      } else {
        results.failed++;
        results.players[playerId] = result;
      }
    });

    return results;
  }

  /**
   * Get pool statistics
   * @returns {object} Pool stats
   */
  getStats() {
    return {
      totalPlayers: this.bots.size,
      activePlayers: this.activeBots.size,
      maxConcurrent: this.maxConcurrent,
      isRunning: this.isRunning,
    };
  }

  /**
   * Clear the pool
   */
  async clear() {
    await this.stopAll();
    this.bots.clear();
    this.results.clear();
    logger.info('Player pool cleared');
  }
}

export default PlayerPool;





