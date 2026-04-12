"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookLimiter = exports.menuLimiter = exports.orderLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
// Key generator for rate limiting (can be customized for user-based limiting)
const keyGenerator = (req) => {
    const authReq = req;
    // Use user ID if authenticated, otherwise use IP
    return authReq.user?.id ? `user:${authReq.user.id}` : `ip:${req.ip || 'unknown'}`;
};
// General API rate limiter
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res) => {
        (0, logger_1.logRateLimitExceeded)(req.ip || 'unknown', req.originalUrl, {
            method: req.method,
            userAgent: req.get('user-agent'),
        });
        res.status(429).json({
            error: 'Too many requests',
            message: 'You have exceeded the rate limit. Please try again later.',
            retryAfter: Math.ceil(15 * 60), // seconds
        });
    },
});
// Stricter rate limiter for authentication endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    keyGenerator: (req) => `auth:${req.ip || 'unknown'}`, // Always use IP for auth
    handler: (req, res) => {
        (0, logger_1.logRateLimitExceeded)(req.ip || 'unknown', 'AUTH', {
            method: req.method,
            endpoint: req.originalUrl,
            email: req.body?.email,
        });
        res.status(429).json({
            error: 'Too many authentication attempts',
            message: 'Please wait 15 minutes before trying again.',
            retryAfter: Math.ceil(15 * 60),
        });
    },
});
// Rate limiter for order creation
exports.orderLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 orders per minute
    message: 'Too many orders created, please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res) => {
        const authReq = req;
        (0, logger_1.logRateLimitExceeded)(req.ip || 'unknown', 'ORDER_CREATE', {
            method: req.method,
            userId: authReq.user?.id,
        });
        res.status(429).json({
            error: 'Too many orders',
            message: 'Please wait before creating more orders.',
            retryAfter: 60,
        });
    },
});
// Rate limiter for menu operations
exports.menuLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit to 30 menu operations per minute
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res) => {
        const authReq = req;
        (0, logger_1.logRateLimitExceeded)(req.ip || 'unknown', 'MENU_OPERATIONS', {
            method: req.method,
            userId: authReq.user?.id,
        });
        res.status(429).json({
            error: 'Too many menu operations',
            message: 'Please slow down menu modifications.',
            retryAfter: 60,
        });
    },
});
// Webhook rate limiter (more permissive for external services)
exports.webhookLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // Allow 50 webhook calls per minute
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `webhook:${req.ip || 'unknown'}`,
    handler: (req, res) => {
        (0, logger_1.logRateLimitExceeded)(req.ip || 'unknown', 'WEBHOOK', {
            method: req.method,
            endpoint: req.originalUrl,
        });
        res.status(429).json({
            error: 'Webhook rate limit exceeded',
            message: 'Too many webhook requests.',
            retryAfter: 60,
        });
    },
});
