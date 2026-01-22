/**
 * Logger Utility
 * Standalone logger for Admin Backend using Winston
 */

import winston from 'winston';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure logs directory exists
const logsDir = join(__dirname, '..', 'logs');
try {
  mkdirSync(logsDir, { recursive: true });
} catch (error) {
  // Directory already exists, ignore
}

const { combine, timestamp, printf, colorize } = winston.format;

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}: ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), customFormat),
    }),
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: join(logsDir, 'combined.log')
    }),
  ],
});

export default logger;

