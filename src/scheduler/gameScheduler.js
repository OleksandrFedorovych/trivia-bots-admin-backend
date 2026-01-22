/**
 * Game Scheduler
 * 
 * Automatically schedules and runs trivia game sessions at specified times.
 * Supports recurring weekly schedules for different leagues (NFL, Hockey).
 */

import { GameSession } from '../orchestrator/gameSession.js';
import { excelLoader } from '../players/excelLoader.js';
import { createProfile } from '../players/playerSchema.js';
import logger from '../utils/logger.js';
import config from '../config/default.js';

/**
 * Game Schedule Configuration
 */
export const SCHEDULES = {
  // NFL League - Thursday, Sunday, Monday at 9:35pm EST
  nfl: {
    name: 'NFL Trivia League',
    gameUrl: 'https://www.crowd.live/NOEPT',
    schedule: [
      { day: 4, hour: 21, minute: 35 }, // Thursday 9:35pm
      { day: 0, hour: 21, minute: 35 }, // Sunday 9:35pm
      { day: 1, hour: 21, minute: 35 }, // Monday 9:35pm
    ],
    timezone: 'America/New_York', // EST
    playerCount: 25,
    maxConcurrent: 10,
  },
  
  // Hockey League - Saturday at 7:40pm EST
  hockey: {
    name: 'Hockey Trivia League',
    gameUrl: 'https://www.crowd.live/FNJCN',
    schedule: [
      { day: 6, hour: 19, minute: 40 }, // Saturday 7:40pm
    ],
    timezone: 'America/New_York', // EST
    playerCount: 25,
    maxConcurrent: 10,
  },
};

/**
 * Game Scheduler Class
 */
export class GameScheduler {
  constructor(options = {}) {
    this.schedules = new Map();
    this.timers = new Map();
    this.activeSessions = new Map();
    this.isRunning = false;
    this.headless = options.headless ?? config.browser.headless;
  }

  /**
   * Add a league schedule
   * @param {string} leagueId - League identifier
   * @param {object} scheduleConfig - Schedule configuration
   */
  addSchedule(leagueId, scheduleConfig) {
    this.schedules.set(leagueId, {
      ...scheduleConfig,
      id: leagueId,
    });
    logger.info(`Added schedule: ${scheduleConfig.name} (${leagueId})`);
  }

  /**
   * Load default schedules (NFL and Hockey)
   */
  loadDefaultSchedules() {
    Object.entries(SCHEDULES).forEach(([id, schedule]) => {
      this.addSchedule(id, schedule);
    });
    logger.info(`Loaded ${this.schedules.size} default schedules`);
  }

  /**
   * Calculate next run time for a schedule
   * @param {object} scheduleConfig - Schedule configuration
   * @returns {Date} Next run time
   */
  getNextRunTime(scheduleConfig) {
    const now = new Date();
    const times = [];

    scheduleConfig.schedule.forEach(({ day, hour, minute }) => {
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      
      // Calculate days until target day
      const currentDay = now.getDay();
      let daysUntil = day - currentDay;
      
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
      }
      
      next.setDate(next.getDate() + daysUntil);
      times.push(next);
    });

    // Return the soonest time
    return times.sort((a, b) => a - b)[0];
  }

  /**
   * Format time until next run
   * @param {Date} nextRun - Next run time
   * @returns {string} Formatted time string
   */
  formatTimeUntil(nextRun) {
    const diff = nextRun - new Date();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  }

  /**
   * Schedule a league's next game
   * @param {string} leagueId - League identifier
   */
  scheduleNext(leagueId) {
    const scheduleConfig = this.schedules.get(leagueId);
    if (!scheduleConfig) {
      logger.error(`Schedule not found: ${leagueId}`);
      return;
    }

    // Clear existing timer
    if (this.timers.has(leagueId)) {
      clearTimeout(this.timers.get(leagueId));
    }

    const nextRun = this.getNextRunTime(scheduleConfig);
    const delay = nextRun - new Date();

    logger.info(`Scheduled ${scheduleConfig.name}: ${nextRun.toLocaleString()} (in ${this.formatTimeUntil(nextRun)})`);

    const timer = setTimeout(async () => {
      await this.runGame(leagueId);
      // Schedule next game after this one completes
      if (this.isRunning) {
        this.scheduleNext(leagueId);
      }
    }, delay);

    this.timers.set(leagueId, timer);
  }

  /**
   * Run a game session for a league
   * @param {string} leagueId - League identifier
   */
  async runGame(leagueId) {
    const scheduleConfig = this.schedules.get(leagueId);
    if (!scheduleConfig) {
      logger.error(`Schedule not found: ${leagueId}`);
      return;
    }

    logger.info(`========================================`);
    logger.info(`Starting scheduled game: ${scheduleConfig.name}`);
    logger.info(`Game URL: ${scheduleConfig.gameUrl}`);
    logger.info(`========================================`);

    try {
      // Load players from Excel file
      const players = excelLoader.loadPlayers({ limit: scheduleConfig.playerCount });

      if (players.length === 0) {
        logger.error('No players available - check src/data/players.xlsx');
        return;
      }

      logger.info(`Loaded ${players.length} players from Excel`);

      // Create game session
      const session = new GameSession({
        gameUrl: scheduleConfig.gameUrl,
        players,
        maxConcurrent: scheduleConfig.maxConcurrent,
        headless: this.headless,
      });

      this.activeSessions.set(leagueId, session);

      // Run the game
      const results = await session.start();

      // Log results
      logger.info(`Game completed: ${scheduleConfig.name}`);
      logger.info(`Duration: ${results.duration?.toFixed(1)} seconds`);
      logger.info(`Players: ${results.completed}/${results.totalPlayers} completed`);

      await session.cleanup();
      this.activeSessions.delete(leagueId);

      return results;
    } catch (error) {
      logger.error(`Game failed: ${scheduleConfig.name}`, { error: error.message });
      this.activeSessions.delete(leagueId);
    }
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting game scheduler');

    // Schedule all leagues
    this.schedules.forEach((_, leagueId) => {
      this.scheduleNext(leagueId);
    });

    logger.info(`Scheduler started with ${this.schedules.size} leagues`);
  }

  /**
   * Stop the scheduler
   */
  async stop() {
    logger.info('Stopping game scheduler');
    this.isRunning = false;

    // Clear all timers
    this.timers.forEach((timer, leagueId) => {
      clearTimeout(timer);
      logger.info(`Cancelled scheduled game: ${leagueId}`);
    });
    this.timers.clear();

    // Stop active sessions
    for (const [leagueId, session] of this.activeSessions) {
      logger.info(`Stopping active session: ${leagueId}`);
      await session.stop();
      await session.cleanup();
    }
    this.activeSessions.clear();

    logger.info('Scheduler stopped');
  }

  /**
   * Run a game immediately (manual trigger)
   * @param {string} leagueId - League identifier
   */
  async runNow(leagueId) {
    logger.info(`Manual trigger: ${leagueId}`);
    return await this.runGame(leagueId);
  }

  /**
   * Get scheduler status
   * @returns {object} Scheduler status
   */
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      leagues: [],
    };

    this.schedules.forEach((config, leagueId) => {
      const nextRun = this.getNextRunTime(config);
      status.leagues.push({
        id: leagueId,
        name: config.name,
        gameUrl: config.gameUrl,
        playerCount: config.playerCount,
        nextRun: nextRun.toLocaleString(),
        timeUntil: this.formatTimeUntil(nextRun),
        isActive: this.activeSessions.has(leagueId),
      });
    });

    return status;
  }

  /**
   * Print scheduler status to console
   */
  printStatus() {
    const status = this.getStatus();
    
    console.log('\n========================================');
    console.log('        GAME SCHEDULER STATUS');
    console.log('========================================');
    console.log(`Running: ${status.isRunning ? 'Yes' : 'No'}`);
    console.log('');
    
    status.leagues.forEach(league => {
      console.log(`📅 ${league.name}`);
      console.log(`   URL: ${league.gameUrl}`);
      console.log(`   Players: ${league.playerCount}`);
      console.log(`   Next: ${league.nextRun} (in ${league.timeUntil})`);
      console.log(`   Active: ${league.isActive ? '🟢 Running' : '⚪ Waiting'}`);
      console.log('');
    });
    
    console.log('========================================\n');
  }
}

// Export singleton instance
export const gameScheduler = new GameScheduler();

export default gameScheduler;

