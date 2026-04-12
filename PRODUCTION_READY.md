# Production-Ready Features

This document outlines all the production-ready features implemented in the Merchant Cyra backend.

## Security Features

### 1. Helmet - Security Headers
- Protects against common web vulnerabilities
- Sets secure HTTP headers automatically
- Configurable for different environments

### 2. Rate Limiting
Three levels of rate limiting implemented:

- **API Rate Limiter**: 100 requests per 15 minutes per IP
- **Auth Rate Limiter**: 5 login attempts per 15 minutes per IP (prevents brute force)
- **Order Rate Limiter**: 10 orders per minute per IP (prevents spam)

### 3. Input Sanitization
- XSS protection through input sanitization
- MongoDB injection protection
- Recursive sanitization of all request data (body, query, params)

### 4. Request Validation
- Schema-based validation for all endpoints
- Type checking and format validation
- Custom validators for login, signup, menu items, and order status

### 5. CORS Configuration
- Configurable origin whitelist
- Credentials support
- Production-ready CORS settings

## Logging System

### Winston Logger
- Structured JSON logging
- Multiple log levels: error, warn, info, http, debug
- Color-coded console output for development
- File-based logging with rotation for production

### Log Files (Production)
- `logs/error-YYYY-MM-DD.log` - Error logs only
- `logs/combined-YYYY-MM-DD.log` - All logs
- Automatic rotation daily
- 30-day retention
- 20MB max file size

### HTTP Request Logging
- Morgan middleware integration
- All HTTP requests logged with timing
- Skips health check endpoint to reduce noise

## Error Handling

### Centralized Error Handler
- Custom AppError class for operational errors
- Automatic error logging with context
- Different responses for development vs production
- Stack traces in development only

### Async Error Wrapper
- Eliminates try-catch boilerplate
- Automatic error propagation to error handler
- Clean async/await code

### 404 Handler
- Catches all undefined routes
- Returns consistent error format

## Performance Features

### 1. Compression
- Gzip compression for all responses
- Reduces bandwidth usage
- Faster response times

### 2. Trust Proxy
- Proper IP detection behind reverse proxies
- Essential for rate limiting accuracy
- Works with Nginx, Apache, load balancers

## Production Best Practices

### 1. Environment Configuration
- Separate .env files for dev/prod
- Example production config provided
- Sensitive data in environment variables

### 2. Graceful Shutdown
- SIGTERM and SIGINT handlers
- Closes server gracefully
- Prevents data loss

### 3. Process Error Handling
- Uncaught exception handler
- Unhandled rejection handler
- Prevents silent failures

### 4. Debug Endpoints
- Debug endpoints only in development
- Disabled automatically in production

## API Endpoints with Protection

### Authentication Endpoints
```
POST /api/auth/login          - Rate limited (5/15min)
POST /api/auth/signup         - Rate limited (5/15min)
POST /api/auth/google         - Rate limited (5/15min)
POST /api/auth/google-signup  - Rate limited (5/15min)
```

### Protected Endpoints (Require Auth + API Rate Limit)
```
GET    /api/dashboard/stats
GET    /api/orders
PUT    /api/orders/:id/status
POST   /api/orders/:id/cancel
GET    /api/menu
POST   /api/menu
PUT    /api/menu/:id
DELETE /api/menu/:id
```

### Webhook Endpoints
```
POST /api/webhook/cyra/order  - Rate limited (10/min)
```

### Public Endpoints
```
GET /health                   - No rate limit
GET /debug/orders            - Development only
```

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Development Mode
```bash
npm run dev
```

### 4. Production Build
```bash
npm run build
npm start
```

## Environment Variables

### Required
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - Secret key for JWT tokens (MUST change in production)
- `FIREBASE_DATABASE_URL` - Firebase Realtime Database URL
- `FIREBASE_API_KEY` - Firebase API key
- `FIREBASE_PROJECT_ID` - Firebase project ID

### Optional
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
- `FRONTEND_URL` - Frontend URL for CORS
- `UPLOAD_DIR` - Upload directory path
- `MAX_FILE_SIZE` - Max upload file size in bytes

## Monitoring

### Health Check
```bash
curl http://localhost:5000/health
```

Returns:
```json
{
  "status": "ok",
  "mode": "demo",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "stats": {
    "totalOrders": 0,
    "menuItems": 2,
    "users": 2
  },
  "firebase": {
    "connected": true,
    "databaseUrl": "https://..."
  }
}
```

### Log Monitoring
```bash
# View logs in development
npm run dev

# View production logs
tail -f logs/combined-*.log
tail -f logs/error-*.log
```

## Security Checklist for Production

- [ ] Change JWT_SECRET to a strong random value
- [ ] Set NODE_ENV=production
- [ ] Configure FRONTEND_URL to your actual domain
- [ ] Set LOG_LEVEL to 'info' or 'warn'
- [ ] Enable HTTPS (use reverse proxy like Nginx)
- [ ] Set up firewall rules
- [ ] Configure database with strong credentials
- [ ] Enable database SSL/TLS
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Review and adjust rate limits for your use case
- [ ] Set up log rotation and archival
- [ ] Configure CORS origins properly

## Performance Tuning

### Rate Limits
Adjust in `src/middleware/rateLimiter.ts`:
- Increase limits for high-traffic applications
- Decrease for stricter security

### Log Levels
- Development: `debug` - See everything
- Staging: `info` - See important events
- Production: `warn` - See warnings and errors only

### Compression
Already enabled. For very large responses, consider:
- Pagination
- Field filtering
- Response caching

## Deployment

### Docker (Recommended)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

### PM2 (Process Manager)
```bash
npm install -g pm2
pm2 start dist/server.js --name merchant-backend
pm2 save
pm2 startup
```

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review error messages in console
3. Verify environment configuration
4. Check firewall and network settings
