# Quick Reference Guide

## 🚀 Quick Start

```bash
# Development
npm install
npm run dev

# Production
npm run build
npm start

# With PM2
npm run pm2:start
npm run pm2:logs
```

## 📊 Monitoring Commands

```bash
# View logs
npm run logs:combined      # All logs
npm run logs:error         # Errors only
npm run logs:analyze       # Recent errors

# Health check
curl http://localhost:5000/health

# PM2 monitoring
npm run pm2:monit
npm run pm2:logs
```

## 🔒 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 15 min |
| Auth | 5 attempts | 15 min |
| Orders | 10 operations | 1 min |
| Menu | 30 operations | 1 min |
| Webhooks | 50 requests | 1 min |

## 📝 Logging Levels

```typescript
logger.error('Critical error')    // Errors
logger.warn('Warning message')    // Warnings
logger.info('Info message')       // General info
logger.http('HTTP request')       // HTTP logs
logger.debug('Debug info')        // Debug only

// Special loggers
logSecurity('Security event', { ip, userId })
logPerformance('Slow query', { duration })
logAuthAttempt(email, success, ip)
```

## 🔐 Environment Variables

```env
# Required
PORT=5000
NODE_ENV=production
JWT_SECRET=your_secret_here
FIREBASE_DATABASE_URL=your_url
FIREBASE_API_KEY=your_key
FIREBASE_PROJECT_ID=your_project

# Optional
LOG_LEVEL=info
LOG_PERFORMANCE=false
RATE_LIMIT_MAX_REQUESTS=100
```

## 🧪 Testing

```bash
# Test rate limiting
for i in {1..110}; do curl http://localhost:5000/api/menu; done

# Test auth rate limit
for i in {1..6}; do 
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done

# Test health
curl http://localhost:5000/health
```

## 📂 Log Files

```
logs/
├── combined-YYYY-MM-DD.log    # All logs (30 days)
├── error-YYYY-MM-DD.log       # Errors only (30 days)
├── security-YYYY-MM-DD.log    # Security events (90 days)
└── performance-YYYY-MM-DD.log # Performance (7 days)
```

## 🔍 Log Analysis

```bash
# Find failed auth
cat logs/security-*.log | grep "FAILED"

# Find rate limits
cat logs/security-*.log | grep "Rate limit exceeded"

# Find slow requests
cat logs/performance-*.log | grep "Slow request"

# Track request by ID
cat logs/combined-*.log | grep "request-id-here"
```

## 🛡️ Security Features

- ✅ Rate limiting on all endpoints
- ✅ IP blocking after 10 failed auth attempts
- ✅ Suspicious pattern detection
- ✅ Input sanitization
- ✅ XSS protection
- ✅ SQL injection prevention
- ✅ Security audit logging

## 📈 Response Headers

```
x-request-id: UUID for tracing
x-ratelimit-limit: Rate limit max
x-ratelimit-remaining: Remaining requests
x-ratelimit-reset: Reset timestamp
```

## 🚨 Common Issues

### Rate Limit Hit
```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit.",
  "retryAfter": 900
}
```
**Solution**: Wait for the retry period or adjust rate limits

### IP Blocked
```json
{
  "error": "Too many failed attempts",
  "message": "Please try again later."
}
```
**Solution**: Wait 15 minutes or contact admin

### Slow Request
Check `logs/performance-*.log` for requests >1s

## 🔧 Troubleshooting

```bash
# Check if server is running
curl http://localhost:5000/health

# Check logs for errors
tail -f logs/error-*.log

# Check security events
tail -f logs/security-*.log

# Check PM2 status
pm2 status

# Restart server
npm run pm2:restart
```

## 📞 Support

1. Check logs: `logs/` directory
2. Health check: `/health` endpoint
3. Review docs: `LOGGING_AND_RATE_LIMITING.md`
4. Production checklist: `PRODUCTION_READY_CHECKLIST.md`

## 🎯 Key Files

```
src/
├── middleware/
│   ├── rateLimiter.ts        # Rate limiting
│   ├── requestLogger.ts      # Request logging
│   ├── securityAudit.ts      # Security monitoring
│   ├── errorHandler.ts       # Error handling
│   ├── validator.ts          # Input validation
│   └── sanitizer.ts          # Input sanitization
├── utils/
│   └── logger.ts             # Winston logger
└── server-demo.ts            # Main server
```

## 💡 Best Practices

1. **Always log security events**
   ```typescript
   logSecurity('Sensitive operation', { userId, action })
   ```

2. **Track performance**
   ```typescript
   const start = Date.now();
   // ... operation
   logPerformance('Operation', { duration: Date.now() - start })
   ```

3. **Use request IDs**
   ```typescript
   logger.info('Processing', { requestId: req.requestId })
   ```

4. **Handle errors properly**
   ```typescript
   throw new AppError('User not found', 404)
   ```

5. **Validate input**
   ```typescript
   app.post('/api/endpoint', validate(schema), handler)
   ```
