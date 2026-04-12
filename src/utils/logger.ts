import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  security: 1, // Same priority as warn
  performance: 2, // Same priority as info
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  security: 'red bold',
  performance: 'cyan',
};

winston.addColors(colors);

// Define log format with metadata
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, metadata } = info;
    let log = `${timestamp} ${level}: ${message}`;
    
    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata)}`;
    }
    
    // Add stack trace for errors
    if (info.stack) {
      log += `\n${info.stack}`;
    }
    
    return log;
  })
);

// Define transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transports (both development and production)
// Error logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d',
    maxSize: '20m',
    format,
    zippedArchive: true,
  })
);

// Combined logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
    format,
    zippedArchive: true,
  })
);

// Security logs (separate file for audit trail)
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'security',
    maxFiles: '90d', // Keep security logs longer
    maxSize: '20m',
    format,
    zippedArchive: true,
  })
);

// Performance logs
if (process.env.LOG_PERFORMANCE === 'true') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'performance-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'performance',
      maxFiles: '7d',
      maxSize: '20m',
      format,
      zippedArchive: true,
    })
  );
}

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Add custom logging methods
export const logSecurity = (message: string, metadata?: any) => {
  logger.log('security', message, metadata);
};

export const logPerformance = (message: string, metadata?: any) => {
  logger.log('performance', message, metadata);
};

export const logRequest = (req: any, metadata?: any) => {
  logger.http(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    ...metadata,
  });
};

export const logAuthAttempt = (email: string, success: boolean, ip: string, metadata?: any) => {
  logSecurity(`Auth attempt: ${email} - ${success ? 'SUCCESS' : 'FAILED'}`, {
    email,
    success,
    ip,
    ...metadata,
  });
};

export const logRateLimitExceeded = (ip: string, endpoint: string, metadata?: any) => {
  logSecurity(`Rate limit exceeded: ${endpoint}`, {
    ip,
    endpoint,
    ...metadata,
  });
};

export default logger;
