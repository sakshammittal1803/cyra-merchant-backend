import morgan from 'morgan';
import { Request, Response, NextFunction } from 'express';
import logger, { logPerformance } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

// Create a stream object for Morgan to write to Winston
const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Skip logging for health check endpoint
const skip = (req: any) => {
  return req.url === '/health';
};

// Morgan format with request ID
const format = process.env.NODE_ENV === 'production' 
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms - :req[x-request-id]'
  : ':method :url :status :response-time ms - :res[content-length] - :req[x-request-id]';

// Add request ID middleware
export const addRequestId = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = req.get('x-request-id') || uuidv4();
  req.startTime = Date.now();
  res.setHeader('x-request-id', req.requestId);
  next();
};

// Enhanced request logger with performance tracking
export const enhancedRequestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request
  logger.http(`Incoming: ${req.method} ${req.originalUrl}`, {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.http(`Completed: ${req.method} ${req.originalUrl} ${res.statusCode}`, {
      requestId: req.requestId,
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      contentLength: res.get('content-length'),
    });

    // Log slow requests
    if (duration > 1000) {
      logPerformance(`Slow request detected: ${req.method} ${req.originalUrl}`, {
        requestId: req.requestId,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        ip: req.ip,
        userId: (req as any).user?.id,
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

// Create Morgan middleware
export const requestLogger = morgan(format, { stream, skip });
