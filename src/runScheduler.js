/**
 * Scheduler Runner
 * 
 * Starts the game scheduler for automatic weekly game sessions.
 * 
 * Usage:
 *   node src/runScheduler.js              # Start scheduler with default leagues
 *   node src/runScheduler.js status       # Show scheduler status
 *   node src/runScheduler.js run nfl      # Run NFL game immediately
 *   node src/runScheduler.js run hockey   # Run Hockey game immediately
 */

import 'dotenv/config';
import { gameScheduler, SCHEDULES } from './scheduler/gameScheduler.js';
import logger from './utils/logger.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  console.log('========================================');
  console.log('     TYSN TRIVIA BOT SCHEDULER');
  console.log('========================================');
  console.log('');

  switch (command) {
    case 'start':
      await startScheduler();
      break;

    case 'status':
      showStatus();
      break;

    case 'run':
      const leagueId = args[1];
      if (!leagueId) {
        console.log('Usage: node src/runScheduler.js run <league>');
        console.log('Available leagues: nfl, hockey');
        process.exit(1);
      }
      await runNow(leagueId);
      break;

    case 'help':
    default:
      showHelp();
  }
}

/**
 * Start the scheduler in daemon mode
 */
async function startScheduler() {
  // Load default schedules
  gameScheduler.loadDefaultSchedules();

  // Show initial status
  gameScheduler.printStatus();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await gameScheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await gameScheduler.stop();
    process.exit(0);
  });

  // Start the scheduler
  gameScheduler.start();

  console.log('Scheduler is running. Press Ctrl+C to stop.\n');
  console.log('Scheduled Games:');
  console.log('  • NFL: Thursday, Sunday, Monday at 9:35pm EST');
  console.log('  • Hockey: Saturday at 7:40pm EST');
  console.log('');

  // Keep the process running
  await new Promise(() => { }); // Never resolves
}

/**
 * Show scheduler status without starting
 */
function showStatus() {
  gameScheduler.loadDefaultSchedules();
  gameScheduler.printStatus();
}

/**
 * Run a game immediately
 */
async function runNow(leagueId) {
  if (!SCHEDULES[leagueId]) {
    console.log(`Unknown league: ${leagueId}`);
    console.log('Available leagues: nfl, hockey');
    process.exit(1);
  }

  gameScheduler.loadDefaultSchedules();

  console.log(`Running ${leagueId.toUpperCase()} game now...`);
  console.log('');

  try {
    const results = await gameScheduler.runNow(leagueId);

    if (results) {
      console.log('\n========================================');
      console.log('           GAME RESULTS');
      console.log('========================================');
      console.log(`Duration: ${results.duration?.toFixed(1)} seconds`);
      console.log(`Players: ${results.completed}/${results.totalPlayers}`);
      console.log(`Failed: ${results.failed}`);
      console.log('========================================\n');
    }
  } catch (error) {
    console.error('Game failed:', error.message);
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
TYSN Trivia Bot Scheduler

Usage:
  node src/runScheduler.js <command> [options]

Commands:
  start           Start the scheduler (runs continuously)
  status          Show scheduled games and next run times
  run <league>    Run a game immediately
  help            Show this help message

Leagues:
  nfl             NFL Trivia (Thu/Sun/Mon 9:35pm EST)
  hockey          Hockey Trivia (Sat 7:40pm EST)

Examples:
  node src/runScheduler.js start      # Start scheduler daemon
  node src/runScheduler.js status     # Check next game times
  node src/runScheduler.js run nfl    # Run NFL game now
  node src/runScheduler.js run hockey # Run Hockey game now

Environment Variables:
  HEADLESS=true   Run browsers in headless mode
  LOG_LEVEL=info  Set logging level
`);
}

// Run
main().catch(error => {
  logger.error('Scheduler failed', { error: error.message });
  process.exit(1);
});




