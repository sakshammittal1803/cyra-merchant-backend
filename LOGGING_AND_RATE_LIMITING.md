# Logging and Rate Limiting Documentation

## Overview

The Merchant Cyra backend now includes comprehensive logging and rate limiting features to ensure production readiness, security, and performance monitoring.

## Features Implemented

### 1. Enhanced Logging System

#### Log Levels
- **error**: Critical errors that need immediate attention
- **warn**: Warning messages for potential issues
- **info**: General informational messages
- **http**: HTTP request/response logging
- **debug**: Detailed debugging information
- **security**: Security-related events (auth attempts, suspicious activity)
- **performance**: Performance metrics and slow request tracking

#### Log Files
All logs are stored in the `logs/` directory with daily rotation:

- `error-YYYY-MM-DD.log` - Error logs only (kept for 30 days)
- `combined-YYYY-MM-DD.log` - All logs (kept for 30 days)
- `security-YYYY-MM-DD.log` - Security audit trail (kept for 90 days)
- `performance-YYYY-MM-DD.log` - Performance metrics (kept for 7 days, enabled via LOG_PERFORMANCE=true)

#### Features
- **Request ID Tracking**: Every request gets a unique ID for tracing
- **Automatic Log Rotation**: Daily rotation with compression
- **Metadata Support**: Rich contextual information in logs
- **Performance Monitoring**: Automatic detection of slow requests (>1s)
- **Security Auditing**: Tracks authentication attempts, suspicious patterns, and sensitive operations

#### Usage Examples

```typescript
import logger, { logSecurity, logPerformance, logAuthAttempt } from './utils/logger';

// Standard logging
logger.info('Server started', { port: 5000 });
logger.error('Database connection failed', { error: err.message });

// Security logging
logSecurity('Suspicious request detected', { ip: req.ip, pattern: 'SQL injection' });
logAuthAttempt(email, true, ip, { role: 'admin' });

// Performance logging
logPerformance('Slow query detected', { duration: '2500ms', query: 'SELECT * FROM orders' });
```

### 2. Rate Limiting

#### Rate Limiters

**API Limiter** (`apiLimiter`)
- Window: 15 minutes
- Max requests: 100 per IP/user
- Applied to: General API endpoints

**Auth Limiter** (`authLimiter`)
- Window: 15 minutes
- Max requests: 5 per IP
- Applied to: Login, signup, OAuth endpoints
- Skips successful requests (only counts failures)

**Order Limiter** (`orderLimiter`)
- Window: 1 minute
- Max requests: 10 per IP/user
- Applied to: Order status updates

**Menu Limiter** (`menuLimiter`)
- Window: 1 minute
- Max requests: 30 per IP/user
- Applied to: Menu CRUD operations

**Webhook Limiter** (`webhookLimiter`)
- Window: 1 minute
- Max requests: 50 per IP
- Applied to: External webhook endpoints

#### Features
- **Smart Key Generation**: Uses user ID for authenticated requests, IP for anonymous
- **Retry-After Headers**: Includes retry timing in responses
- **Automatic Logging**: All rate limit violations are logged to security logs
- **IP Blocking**: Automatic temporary blocking after excessive failed auth attempts (10 attempts = 15 min block)

### 3. Security Audit Middleware

#### Suspicious Pattern Detection
Automatically detects and logs:
- Path traversal attempts (`../`, `/etc/`, `/proc/`)
- SQL injection patterns (`UNION SELECT`, `DROP TABLE`)
- XSS attempts (`<script>`, `javascript:`, `onerror=`)
- Code injection (`eval()`, `exec()`, `system()`)

#### Failed Authentication Tracking
- Tracks failed login attempts per IP
- Automatic blocking after 10 failed attempts
- 15-minute block duration
- Automatic cleanup of old records

#### Sensitive Operation Logging
Automatically logs:
- All DELETE operations
- Authentication endpoints
- Admin operations

### 4. Request Tracking

Every request includes:
- **Request ID**: Unique identifier (UUID v4)
- **Timestamp**: Precise timing information
- **Duration**: Request processing time
- **User Context**: User ID, IP, user agent
- **Response Status**: HTTP status code

## Configuration

### Environment Variables

```env
# Logging
LOG_LEVEL=debug                    # Minimum log level to record
LOG_PERFORMANCE=true               # Enable performance logging

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000       # 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100       # Max requests per window
AUTH_RATE_LIMIT_MAX=5             # Max auth attempts per window
ORDER_RATE_LIMIT_MAX=10           # Max order operations per minute
```

## Monitoring and Analysis

### View Logs

```bash
# View combined logs (all levels)
npm run logs:combined

# View error logs only
npm run logs:error

# Analyze recent errors
npm run logs:analyze

# View security logs
tail -f logs/security-*.log

# View performance logs
tail -f logs/performance-*.log
```

### Log Analysis Examples

**Find all failed authentication attempts:**
```bash
cat logs/security-*.log | grep "Auth attempt" | grep "FAILED"
```

**Find rate limit violations:**
```bash
cat logs/security-*.log | grep "Rate limit exceeded"
```

**Find slow requests:**
```bash
cat logs/performance-*.log | grep "Slow request"
```

**Track a specific request:**
```bash
cat logs/combined-*.log | grep "request-id-here"
```

## Production Deployment

### Checklist

1. **Environment Variables**
   - [ ] Set `NODE_ENV=production`
   - [ ] Set `LOG_LEVEL=info` (or `warn` for less verbose)
   - [ ] Disable `LOG_PERFORMANCE` if not needed
   - [ ] Update `JWT_SECRET` to a strong random value

2. **Log Management**
   - [ ] Ensure `logs/` directory has write permissions
   - [ ] Set up log rotation monitoring
   - [ ] Configure log aggregation (e.g., ELK stack, CloudWatch)
   - [ ] Set up alerts for error spikes

3. **Rate Limiting**
   - [ ] Review and adjust rate limits based on expected traffic
   - [ ] Consider Redis for distributed rate limiting (multi-server)
   - [ ] Monitor rate limit violations

4. **Security**
   - [ ] Review security logs regularly
   - [ ] Set up alerts for suspicious activity
   - [ ] Monitor blocked IPs
   - [ ] Implement additional security measures as needed

### Redis Integration (Optional)

For multi-server deployments, integrate Redis for distributed rate limiting:

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:',
  }),
  // ... other options
});
```

## Best Practices

1. **Log Levels**
   - Use `error` for critical issues requiring immediate action
   - Use `warn` for potential problems
   - Use `info` for important business events
   - Use `debug` only in development

2. **Security Logging**
   - Always log authentication attempts (success and failure)
   - Log all sensitive operations (delete, admin actions)
   - Include context (IP, user ID, timestamp)
   - Never log sensitive data (passwords, tokens)

3. **Performance Monitoring**
   - Track slow requests (>1s)
   - Monitor database query times
   - Log external API call durations
   - Set up alerts for performance degradation

4. **Rate Limiting**
   - Start conservative, adjust based on usage patterns
   - Different limits for different user roles
   - Whitelist trusted IPs if needed
   - Monitor false positives

## Troubleshooting

### High Log Volume
- Increase `LOG_LEVEL` to `warn` or `error`
- Disable performance logging
- Adjust log retention periods

### Rate Limit False Positives
- Review rate limit thresholds
- Check for legitimate high-traffic users
- Consider user-based limits instead of IP-based
- Implement whitelisting for trusted sources

### Missing Logs
- Check file permissions on `logs/` directory
- Verify disk space
- Check log level configuration
- Review log rotation settings

## API Response Examples

### Rate Limit Response
```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 900
}
```

### Error Response (with Request ID)
```json
{
  "error": "Invalid credentials"
}
```
Response headers include: `x-request-id: 550e8400-e29b-41d4-a716-446655440000`

## Metrics to Monitor

1. **Request Metrics**
   - Total requests per minute
   - Average response time
   - Error rate (4xx, 5xx)
   - Slow requests (>1s)

2. **Security Metrics**
   - Failed authentication attempts
   - Rate limit violations
   - Suspicious pattern detections
   - Blocked IPs

3. **Performance Metrics**
   - P50, P95, P99 response times
   - Database query times
   - External API call times
   - Memory and CPU usage

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review this documentation
3. Check environment configuration
4. Contact development team
