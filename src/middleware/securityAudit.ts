import { Request, Response, NextFunction } from 'express';
import { logSecurity } from '../utils/logger';

// Track suspicious activities
const suspiciousPatterns = [
  /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Path traversal
  /(union.*select|insert.*into|drop.*table)/i, // SQL injection
  /(<script|javascript:|onerror=|onload=)/i, // XSS attempts
  /(eval\(|exec\(|system\()/i, // Code injection
];

// Security audit middleware
export const securityAudit = (req: Request, res: Response, next: NextFunction) => {
  const requestData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
    requestId: (req as any).requestId,
  };

  // Check for suspicious patterns in URL
  const isSuspiciousUrl = suspiciousPatterns.some(pattern => pattern.test(req.originalUrl));
  
  // Check for suspicious patterns in body
  const bodyString = JSON.stringify(req.body || {});
  const isSuspiciousBody = suspiciousPatterns.some(pattern => pattern.test(bodyString));

  if (isSuspiciousUrl || isSuspiciousBody) {
    logSecurity('Suspicious request detected', {
      ...requestData,
      suspiciousUrl: isSuspiciousUrl,
      suspiciousBody: isSuspiciousBody,
      body: req.body,
    });
  }

  // Log sensitive operations
  if (req.method === 'DELETE' || 
      req.originalUrl.includes('/auth/') ||
      req.originalUrl.includes('/admin/')) {
    logSecurity('Sensitive operation', requestData);
  }

  next();
};

// Track failed authentication attempts
const failedAuthAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_FAILED_ATTEMPTS = 10;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

export const trackAuthFailure = (ip: string) => {
  const now = Date.now();
  const record = failedAuthAttempts.get(ip) || { count: 0, lastAttempt: now };

  // Reset if block duration has passed
  if (now - record.lastAttempt > BLOCK_DURATION) {
    record.count = 0;
  }

  record.count++;
  record.lastAttempt = now;
  failedAuthAttempts.set(ip, record);

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    logSecurity('IP blocked due to excessive failed auth attempts', {
      ip,
      attempts: record.count,
      blockDuration: `${BLOCK_DURATION / 1000}s`,
    });
  }
};

export const isIpBlocked = (ip: string): boolean => {
  const record = failedAuthAttempts.get(ip);
  if (!record) return false;

  const now = Date.now();
  if (now - record.lastAttempt > BLOCK_DURATION) {
    failedAuthAttempts.delete(ip);
    return false;
  }

  return record.count >= MAX_FAILED_ATTEMPTS;
};

export const clearAuthFailures = (ip: string) => {
  failedAuthAttempts.delete(ip);
};

// Cleanup old records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of failedAuthAttempts.entries()) {
    if (now - record.lastAttempt > BLOCK_DURATION) {
      failedAuthAttempts.delete(ip);
    }
  }
}, 60 * 1000); // Run every minute
