import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  // Game settings
  game: {
    url: process.env.GAME_URL || 'https://www.crowd.live/FNJCN',
    waitTimeout: 30000,
    questionTimeout: 15000,
  },

  // Browser settings
  browser: {
    headless: process.env.HEADLESS === 'true',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_BOTS) || 100, // Default 25, increase for more
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },

  // Excel data file settings
  data: {
    playersFile: process.env.PLAYERS_FILE || path.join(__dirname, '..', 'data', 'players.xlsx'),
  },

  // Timing settings (for human-like behavior)
  timing: {
    minJoinDelay: parseInt(process.env.MIN_JOIN_DELAY) || 1000,
    maxJoinDelay: parseInt(process.env.MAX_JOIN_DELAY) || 5000,
    minAnswerDelay: 1500,
    maxAnswerDelay: 10000,
    typingDelay: { min: 50, max: 150 }, // ms per character
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
