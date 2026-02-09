import winston from 'winston';
import config from '../config/default.js';

const { combine, timestamp, printf, colorize } = winston.format;

const customFormat = printf(({ level, message, timestamp, playerId, ...meta }) => {
  const playerPrefix = playerId ? `[${playerId}] ` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}: ${playerPrefix}${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), customFormat),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    }),
  ],
});

// Create a child logger for a specific player
export function createPlayerLogger(playerId) {
  return logger.child({ playerId });
}

export default logger;





