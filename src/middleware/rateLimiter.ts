import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { logRateLimitExceeded } from '../utils/logger';

// Extend Express Request to include user
interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

// Key generator for rate limiting (can be customized for user-based limiting)
const keyGenerator = (req: Request) => {
  const authReq = req as AuthRequest;
  // Use user ID if authenticated, otherwise use IP
  return authReq.user?.id ? `user:${authReq.user.id}` : `ip:${req.ip || 'unknown'}`;
};

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    logRateLimitExceeded(req.ip || 'unknown', req.originalUrl, {
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
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req) => `auth:${req.ip || 'unknown'}`, // Always use IP for auth
  handler: (req, res) => {
    logRateLimitExceeded(req.ip || 'unknown', 'AUTH', {
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
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 orders per minute
  message: 'Too many orders created, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    logRateLimitExceeded(req.ip || 'unknown', 'ORDER_CREATE', {
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
export const menuLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit to 30 menu operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    logRateLimitExceeded(req.ip || 'unknown', 'MENU_OPERATIONS', {
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
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Allow 50 webhook calls per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `webhook:${req.ip || 'unknown'}`,
  handler: (req, res) => {
    logRateLimitExceeded(req.ip || 'unknown', 'WEBHOOK', {
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
