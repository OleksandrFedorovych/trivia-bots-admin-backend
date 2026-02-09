/**
 * Single Bot Runner
 * 
 * Run a single bot for testing and debugging purposes.
 */

import 'dotenv/config';
import TriviaBot from './crowdlive/triviaBot.js';
import { createProfile } from './players/playerSchema.js';
import logger from './utils/logger.js';
import config from './config/default.js';

async function main() {
  const gameUrl = process.argv[2] || config.game.url;

  logger.info('=== Single Bot Runner ===');
  logger.info(`Game URL: ${gameUrl}`);

  // Create a test profile
  const profile = createProfile({
    id: 'test-bot-001',
    nickname: 'TestBot001',
    name: 'Test Bot',
    email: 'testbot@example.com',
    phone: '+491701234567',  // German format: 10 digits
    accuracy: 0.75,
    personality: 'normal',
    reactionTime: {
      min: 2000,
      max: 8000,
      average: 4000,
    },
    lateJoinChance: 0,
    noShowChance: 0,
  });

  logger.info(`Player: ${profile.nickname} (${profile.id})`);
  logger.info(`Accuracy: ${(profile.accuracy * 100).toFixed(0)}%`);
  logger.info(`Personality: ${profile.personality}`);

  // Create and run bot
  const bot = new TriviaBot(profile, {
    gameUrl,
    headless: config.browser.headless,
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, stopping bot...');
    bot.stop();
    await bot.cleanup();
    process.exit(0);
  });

  try {
    const results = await bot.run(gameUrl);

    if (results) {
      console.log('\n=== Results ===');
      console.log(`Questions Answered: ${results.questionsAnswered}`);
      console.log(`Correct Answers: ${results.correctAnswers}`);
      if (results.questionsAnswered > 0) {
        const accuracy = (results.correctAnswers / results.questionsAnswered * 100).toFixed(1);
        console.log(`Accuracy: ${accuracy}%`);
      }
      if (results.finalScore !== null) {
        console.log(`Final Score: ${results.finalScore}`);
      }
    }
  } catch (error) {
    logger.error('Bot failed', { error: error.message });
    process.exit(1);
  }
}

main();
