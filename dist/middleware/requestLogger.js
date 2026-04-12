"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = exports.enhancedRequestLogger = exports.addRequestId = void 0;
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = __importStar(require("../utils/logger"));
const uuid_1 = require("uuid");
// Create a stream object for Morgan to write to Winston
const stream = {
    write: (message) => {
        logger_1.default.http(message.trim());
    },
};
// Skip logging for health check endpoint
const skip = (req) => {
    return req.url === '/health';
};
// Morgan format with request ID
const format = process.env.NODE_ENV === 'production'
    ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms - :req[x-request-id]'
    : ':method :url :status :response-time ms - :res[content-length] - :req[x-request-id]';
// Add request ID middleware
const addRequestId = (req, res, next) => {
    req.requestId = req.get('x-request-id') || (0, uuid_1.v4)();
    req.startTime = Date.now();
    res.setHeader('x-request-id', req.requestId);
    next();
};
exports.addRequestId = addRequestId;
// Enhanced request logger with performance tracking
const enhancedRequestLogger = (req, res, next) => {
    const startTime = Date.now();
    // Log request
    logger_1.default.http(`Incoming: ${req.method} ${req.originalUrl}`, {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id,
    });
    // Capture response
    const originalSend = res.send;
    res.send = function (data) {
        const duration = Date.now() - startTime;
        // Log response
        logger_1.default.http(`Completed: ${req.method} ${req.originalUrl} ${res.statusCode}`, {
            requestId: req.requestId,
            duration: `${duration}ms`,
            statusCode: res.statusCode,
            contentLength: res.get('content-length'),
        });
        // Log slow requests
        if (duration > 1000) {
            (0, logger_1.logPerformance)(`Slow request detected: ${req.method} ${req.originalUrl}`, {
                requestId: req.requestId,
                duration: `${duration}ms`,
                statusCode: res.statusCode,
                ip: req.ip,
                userId: req.user?.id,
            });
        }
        return originalSend.call(this, data);
    };
    next();
};
exports.enhancedRequestLogger = enhancedRequestLogger;
// Create Morgan middleware
exports.requestLogger = (0, morgan_1.default)(format, { stream, skip });
