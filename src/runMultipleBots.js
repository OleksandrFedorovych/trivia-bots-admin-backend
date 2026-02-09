/**
 * Multi-Bot Runner
 * 
 * Runs multiple trivia bots on a Crowd.live game
 * 
 * Usage: 
 *   node src/runMultipleBots.js [botCount] [gameUrl]
 *   node src/runMultipleBots.js --team "Team Name" [gameUrl]
 *   node src/runMultipleBots.js --teams              # List all teams
 */

import 'dotenv/config';
import { GameSession } from './orchestrator/gameSession.js';
import { excelLoader } from './players/excelLoader.js';
import logger from './utils/logger.js';
import config from './config/default.js';

// Configuration
const DEFAULT_BOT_COUNT = 5;
const DEFAULT_GAME_URL = config.game.url || 'https://www.crowd.live/FNJCN';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  // Check for special commands
  if (args[0] === '--teams' || args[0] === '-t') {
    showTeams();
    return;
  }

  if (args[0] === '--team') {
    const teamName = args[1];
    const gameUrl = args[2] || DEFAULT_GAME_URL;
    if (!teamName) {
      console.error('Usage: node src/runMultipleBots.js --team "Team Name" [gameUrl]');
      process.exit(1);
    }
    await runTeam(teamName, gameUrl);
    return;
  }

  const botCount = parseInt(args[0]) || DEFAULT_BOT_COUNT;
  const gameUrl = args[1] || DEFAULT_GAME_URL;

  console.log('========================================');
  console.log('        MULTI-BOT RUNNER');
  console.log('========================================');
  console.log(`Game URL: ${gameUrl}`);
  console.log(`Bot Count: ${botCount}`);
  console.log(`Max Concurrent: ${config.browser.maxConcurrent}`);
  console.log('========================================');
  console.log('');

  // Load players from Excel file
  console.log('Loading players from Excel file...');
  const players = excelLoader.loadPlayers({ limit: botCount });

  if (players.length === 0) {
    console.error('No players found in src/data/players.xlsx');
    process.exit(1);
  }

  console.log(`Loaded ${players.length} players`);
  console.log('');
  console.log('Players to join:');
  players.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.nickname} (Accuracy: ${(p.accuracy * 100).toFixed(0)}%, ${p.personality})`);
  });
  console.log('');

  // Create game session
  const session = new GameSession({
    gameUrl,
    players,
    maxConcurrent: config.browser.maxConcurrent,
    headless: config.browser.headless,
    staggerDelay: { min: 2000, max: 5000 },
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, stopping...');
    await session.stop();
    await session.cleanup();
    process.exit(0);
  });

  try {
    // Start the session
    console.log('Starting game session...');
    console.log('');

    const results = await session.start();

    // Print results
    console.log('');
    console.log('========================================');
    console.log('        SESSION RESULTS');
    console.log('========================================');
    console.log(`Session ID: ${results.sessionId}`);
    console.log(`Duration: ${results.duration?.toFixed(1) || 'N/A'} seconds`);
    console.log(`Total Players: ${results.totalPlayers}`);
    console.log(`Completed: ${results.completed}`);
    console.log(`Failed: ${results.failed}`);
    console.log('');

    // Print individual results
    console.log('Player Results:');
    for (const [playerId, playerResult] of Object.entries(results.players || {})) {
      if (playerResult.error) {
        console.log(`  ❌ ${playerId}: ERROR - ${playerResult.error}`);
      } else {
        console.log(`  ✓ ${playerId}: ${playerResult.correctAnswers}/${playerResult.questionsAnswered} correct (${playerResult.accuracy})`);
      }
    }
    console.log('========================================');

  } catch (error) {
    console.error('Session failed:', error.message);
  } finally {
    await session.cleanup();
  }
}

/**
 * Show all teams/clubs from Excel
 */
function showTeams() {
  console.log('========================================');
  console.log('        AVAILABLE TEAMS');
  console.log('========================================');
  console.log('');

  const playersByTeam = excelLoader.loadPlayersByTeam({ limit: 500 });

  Object.entries(playersByTeam)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([team, players]) => {
      console.log(`  📋 ${team}: ${players.length} players`);
    });

  console.log('');
  console.log('========================================');
  console.log('Usage: node src/runMultipleBots.js --team "Team Name" [gameUrl]');
}

/**
 * Run bots for a specific team
 */
async function runTeam(teamName, gameUrl) {
  console.log('========================================');
  console.log('        TEAM BOT RUNNER');
  console.log('========================================');
  console.log(`Team: ${teamName}`);
  console.log(`Game URL: ${gameUrl}`);
  console.log('========================================');
  console.log('');

  // Load players for the team
  console.log(`Loading players for team: ${teamName}...`);
  const players = excelLoader.loadTeamPlayers(teamName, { limit: 50 });

  if (players.length === 0) {
    console.error(`No players found for team: ${teamName}`);
    console.log('Available teams:');
    showTeams();
    process.exit(1);
  }

  console.log(`Loaded ${players.length} players`);
  console.log('');
  console.log('Players to join:');
  players.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.nickname} (Accuracy: ${(p.accuracy * 100).toFixed(0)}%, ${p.personality})`);
  });
  console.log('');

  // Create and run session
  const session = new GameSession({
    gameUrl,
    players,
    maxConcurrent: config.browser.maxConcurrent,
    headless: config.browser.headless,
    staggerDelay: { min: 2000, max: 5000 },
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, stopping...');
    await session.stop();
    await session.cleanup();
    process.exit(0);
  });

  try {
    console.log('Starting game session...');
    const results = await session.start();

    console.log('');
    console.log('========================================');
    console.log(`        ${teamName.toUpperCase()} RESULTS`);
    console.log('========================================');
    console.log(`Duration: ${results.duration?.toFixed(1) || 'N/A'} seconds`);
    console.log(`Total Players: ${results.totalPlayers}`);
    console.log(`Completed: ${results.completed}`);
    console.log(`Failed: ${results.failed}`);
    console.log('');

    for (const [playerId, playerResult] of Object.entries(results.players || {})) {
      if (playerResult.error) {
        console.log(`  ❌ ${playerId}: ERROR - ${playerResult.error}`);
      } else {
        console.log(`  ✓ ${playerId}: ${playerResult.correctAnswers}/${playerResult.questionsAnswered} correct (${playerResult.accuracy})`);
      }
    }
    console.log('========================================');

  } catch (error) {
    console.error('Session failed:', error.message);
  } finally {
    await session.cleanup();
  }
}

// Run
main().catch(console.error);
