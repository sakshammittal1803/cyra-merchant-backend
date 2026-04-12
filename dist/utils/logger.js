"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logRateLimitExceeded = exports.logAuthAttempt = exports.logRequest = exports.logPerformance = exports.logSecurity = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Ensure logs directory exists
const logsDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
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
winston_1.default.addColors(colors);
// Define log format with metadata
const format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }), winston_1.default.format.json());
// Console format for development
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf((info) => {
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
}));
// Define transports
const transports = [
    // Console transport
    new winston_1.default.transports.Console({
        format: consoleFormat,
    }),
];
// Add file transports (both development and production)
// Error logs
transports.push(new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d',
    maxSize: '20m',
    format,
    zippedArchive: true,
}));
// Combined logs
transports.push(new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
    format,
    zippedArchive: true,
}));
// Security logs (separate file for audit trail)
transports.push(new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'security',
    maxFiles: '90d', // Keep security logs longer
    maxSize: '20m',
    format,
    zippedArchive: true,
}));
// Performance logs
if (process.env.LOG_PERFORMANCE === 'true') {
    transports.push(new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logsDir, 'performance-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'performance',
        maxFiles: '7d',
        maxSize: '20m',
        format,
        zippedArchive: true,
    }));
}
// Create logger
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    levels,
    format,
    transports,
    exitOnError: false,
});
// Add custom logging methods
const logSecurity = (message, metadata) => {
    logger.log('security', message, metadata);
};
exports.logSecurity = logSecurity;
const logPerformance = (message, metadata) => {
    logger.log('performance', message, metadata);
};
exports.logPerformance = logPerformance;
const logRequest = (req, metadata) => {
    logger.http(`${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id,
        ...metadata,
    });
};
exports.logRequest = logRequest;
const logAuthAttempt = (email, success, ip, metadata) => {
    (0, exports.logSecurity)(`Auth attempt: ${email} - ${success ? 'SUCCESS' : 'FAILED'}`, {
        email,
        success,
        ip,
        ...metadata,
    });
};
exports.logAuthAttempt = logAuthAttempt;
const logRateLimitExceeded = (ip, endpoint, metadata) => {
    (0, exports.logSecurity)(`Rate limit exceeded: ${endpoint}`, {
        ip,
        endpoint,
        ...metadata,
    });
};
exports.logRateLimitExceeded = logRateLimitExceeded;
exports.default = logger;
