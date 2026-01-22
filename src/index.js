/**
 * Trivia Bots - Main Entry Point
 * 
 * Scalable browser automation system for trivia games on Crowd.live
 */

import 'dotenv/config';
import { GameSession } from './orchestrator/gameSession.js';
import { excelLoader } from './players/excelLoader.js';
import logger from './utils/logger.js';
import config from './config/default.js';

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'run':
      await runGame(args.slice(1));
      break;
    case 'load-players':
      await loadAndShowPlayers();
      break;
    case 'help':
    default:
      showHelp();
  }
}

/**
 * Run a game with players from Excel file
 * @param {array} args - Command arguments
 */
async function runGame(args) {
  const gameUrl = args[0] || config.game.url;
  const playerLimit = parseInt(args[1]) || 10;

  logger.info('=== Trivia Bots - Game Session ===');
  logger.info(`Game URL: ${gameUrl}`);
  logger.info(`Max players: ${playerLimit}`);

  try {
    // Load players from Excel file
    logger.info('Loading players from Excel file...');
    const players = excelLoader.loadPlayers({ limit: playerLimit });

    if (players.length === 0) {
      logger.error('No players loaded. Check src/data/players.xlsx');
      process.exit(1);
    }

    logger.info(`Loaded ${players.length} players`);

    // Create and run session
    const session = new GameSession({
      gameUrl,
      players,
      maxConcurrent: config.browser.maxConcurrent,
      headless: config.browser.headless,
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, stopping...');
      await session.stop();
      await session.cleanup();
      process.exit(0);
    });

    const results = await session.start();

    // Print results
    printResults(results);

    await session.cleanup();
  } catch (error) {
    logger.error('Game session failed', { error: error.message });
    process.exit(1);
  }
}

/**
 * Load and display players from Excel file
 */
async function loadAndShowPlayers() {
  logger.info('Loading players from Excel file...');

  try {
    const players = excelLoader.loadPlayers();

    console.log('\n=== Players ===\n');
    players.forEach((player, index) => {
      console.log(`${index + 1}. ${player.nickname}`);
      console.log(`   ID: ${player.id}`);
      console.log(`   Name: ${player.name}`);
      console.log(`   Email: ${player.email}`);
      console.log(`   Phone: ${player.phone}`);
      console.log(`   Accuracy: ${(player.accuracy * 100).toFixed(0)}%`);
      console.log(`   Personality: ${player.personality}`);
      console.log('');
    });

    console.log(`Total: ${players.length} players`);
  } catch (error) {
    logger.error('Failed to load players', { error: error.message });
  }
}

/**
 * Print game results
 * @param {object} results - Game results
 */
function printResults(results) {
  console.log('\n=== Game Results ===\n');
  console.log(`Session ID: ${results.sessionId}`);
  console.log(`Duration: ${results.duration?.toFixed(1)} seconds`);
  console.log(`Total Players: ${results.totalPlayers}`);
  console.log(`Completed: ${results.completed}`);
  console.log(`Failed: ${results.failed}`);

  if (results.players && Object.keys(results.players).length > 0) {
    console.log('\nPlayer Results:');
    Object.entries(results.players).forEach(([playerId, result]) => {
      if (result && !result.error) {
        const accuracy = result.questionsAnswered > 0
          ? ((result.correctAnswers / result.questionsAnswered) * 100).toFixed(1)
          : 'N/A';
        console.log(`  ${playerId}: ${result.correctAnswers}/${result.questionsAnswered} (${accuracy}%)`);
      } else {
        console.log(`  ${playerId}: ERROR - ${result?.error || 'Unknown error'}`);
      }
    });
  }

  console.log('');
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Trivia Bots - Scalable Browser Automation for Crowd.live

Usage:
  node src/index.js <command> [options]

Commands:
  run [url] [limit]     Run a game with players from Excel file
                        - url: Game URL (default: ${config.game.url})
                        - limit: Max players to use (default: 10)

  load-players          Load and display players from Excel file

  help                  Show this help message

Environment Variables:
  GAME_URL              Default game URL
  MAX_CONCURRENT_BOTS   Maximum concurrent browser instances
  HEADLESS              Run browsers in headless mode (true/false)

Data File:
  src/data/players.xlsx - Player profiles (TYSN Universe format)

Examples:
  node src/index.js run https://www.crowd.live/FNJCN 5
  node src/index.js run https://www.crowd.live/NOEPT 20
  node src/index.js load-players
`);
}

// Run main
main().catch(error => {
  logger.error('Fatal error', { error: error.message });
  process.exit(1);
});
