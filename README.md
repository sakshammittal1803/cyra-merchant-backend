# Merchant Cyra Backend

Production-ready backend for the Merchant Cyra application with comprehensive logging, rate limiting, and security features.

## 🚀 Features

### Core Features
- ✅ RESTful API with Express.js
- ✅ Real-time updates with Socket.io
- ✅ Firebase Realtime Database integration
- ✅ JWT authentication
- ✅ Google OAuth support
- ✅ Order management system
- ✅ Menu management with phase-based filtering
- ✅ Dashboard with real-time statistics

### Security & Production Features
- ✅ **Advanced Rate Limiting** - Multi-tier rate limiting for different endpoints
- ✅ **Comprehensive Logging** - Winston logger with daily rotation and multiple log levels
- ✅ **Security Audit** - Suspicious pattern detection and IP blocking
- ✅ **Request Tracing** - UUID-based request ID tracking
- ✅ **Performance Monitoring** - Automatic slow request detection
- ✅ **Input Validation** - Type-safe validation and sanitization
- ✅ **Error Handling** - Centralized error handling with context
- ✅ **Security Headers** - Helmet.js for security headers

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase account with Realtime Database
- (Optional) PM2 for production deployment

## 🔧 Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
# Build
npm run build

# Start
npm start

# Or with PM2
npm run pm2:start
```

## 📊 Monitoring

### View Logs
```bash
npm run logs:combined      # All logs
npm run logs:error         # Errors only
npm run logs:analyze       # Recent errors
```

### Health Check
```bash
curl http://localhost:5000/health
```

### PM2 Monitoring
```bash
npm run pm2:monit          # Monitor dashboard
npm run pm2:logs           # View logs
npm run pm2:restart        # Restart server
```

## 🔒 Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Authentication | 5 attempts | 15 minutes |
| Order Operations | 10 operations | 1 minute |
| Menu Operations | 30 operations | 1 minute |
| Webhooks | 50 requests | 1 minute |

## 📝 Logging

### Log Files
- `logs/combined-YYYY-MM-DD.log` - All logs (30 days retention)
- `logs/error-YYYY-MM-DD.log` - Error logs (30 days retention)
- `logs/security-YYYY-MM-DD.log` - Security events (90 days retention)
- `logs/performance-YYYY-MM-DD.log` - Performance metrics (7 days retention)

### Log Levels
- `error` - Critical errors
- `warn` - Warnings
- `info` - General information
- `http` - HTTP requests
- `debug` - Debug information
- `security` - Security events
- `performance` - Performance metrics

## 🔐 Environment Variables

### Required
```env
PORT=5000
NODE_ENV=production
JWT_SECRET=your_secret_here
FIREBASE_DATABASE_URL=your_firebase_url
FIREBASE_API_KEY=your_firebase_key
FIREBASE_PROJECT_ID=your_project_id
```

### Optional
```env
LOG_LEVEL=info                    # Logging level
LOG_PERFORMANCE=false             # Enable performance logging
RATE_LIMIT_MAX_REQUESTS=100      # API rate limit
AUTH_RATE_LIMIT_MAX=5            # Auth rate limit
FRONTEND_URL=http://localhost:3000
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/google-signup` - Complete Google signup

### Orders
- `GET /api/orders` - Get all orders
- `PUT /api/orders/:id/status` - Update order status
- `POST /api/orders/:id/cancel` - Cancel order

### Menu
- `GET /api/menu` - Get menu items
- `POST /api/menu` - Create menu item
- `PUT /api/menu/:id` - Update menu item
- `DELETE /api/menu/:id` - Delete menu item

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Webhooks
- `POST /api/webhook/cyra/order` - Receive orders from CYRA app

### Health
- `GET /health` - Health check endpoint

## 🛡️ Security Features

### Rate Limiting
- IP-based rate limiting
- User-based rate limiting for authenticated requests
- Automatic IP blocking after excessive failed auth attempts
- Configurable limits per endpoint type

### Security Audit
- Suspicious pattern detection (SQL injection, XSS, path traversal)
- Failed authentication tracking
- Sensitive operation logging
- Automatic cleanup of old records

### Input Protection
- Request validation with type checking
- Input sanitization for XSS prevention
- MongoDB query sanitization
- Length and format validation

### Headers & CORS
- Helmet.js security headers
- CORS configuration
- Content Security Policy
- HSTS enabled

## 🚀 Deployment

### Deploy to Vercel

**Quick Deploy (5 minutes):**
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Build
npm run build

# Deploy
vercel --prod
```

See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for step-by-step instructions.

**Full Deployment Guide:**
- [Quick Deploy Guide](./QUICK_DEPLOY.md) - 5-minute deployment
- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT_GUIDE.md) - Complete guide
- [Pre-Deployment Checklist](./PRE_DEPLOYMENT_CHECKLIST.md) - Before you deploy

### Deploy with PM2 (VPS/Server)

```bash
# Build
npm run build

# Start with PM2
npm run pm2:start

# Monitor
npm run pm2:logs
```

## 📖 Documentation

- [Logging and Rate Limiting Guide](./LOGGING_AND_RATE_LIMITING.md)
- [CORS Configuration Guide](./CORS_CONFIGURATION.md)
- [Production Ready Checklist](./PRODUCTION_READY_CHECKLIST.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Quick Reference](./QUICK_REFERENCE.md)

## 🧪 Testing

### Test Rate Limiting
```bash
# Test API rate limit
for i in {1..110}; do curl http://localhost:5000/api/menu; done

# Test auth rate limit
for i in {1..6}; do 
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
```

### Test Logging
```bash
# Make a request
curl http://localhost:5000/health

# Check logs
tail -f logs/combined-*.log
```

## 🚀 Deployment

### Quick Deploy
```bash
# 1. Configure environment
cp .env.production.example .env.production
nano .env.production

# 2. Build
npm run build

# 3. Start with PM2
npm run pm2:start

# 4. Monitor
npm run pm2:logs
```

### Production Checklist
- [ ] Update JWT_SECRET to strong random value
- [ ] Configure Firebase credentials
- [ ] Set NODE_ENV=production
- [ ] Set LOG_LEVEL=info or warn
- [ ] Review and adjust rate limits
- [ ] Set up log monitoring
- [ ] Configure SSL/TLS
- [ ] Set up firewall rules
- [ ] Enable automated backups

## 🔧 Troubleshooting

### Server Won't Start
```bash
# Check logs
cat logs/error-*.log

# Check environment
cat .env

# Check port availability
netstat -an | grep 5000
```

### Rate Limit Issues
```bash
# Check security logs
cat logs/security-*.log | grep "Rate limit"

# Adjust limits in .env
RATE_LIMIT_MAX_REQUESTS=200
```

### Performance Issues
```bash
# Check slow requests
cat logs/performance-*.log | grep "Slow request"

# Monitor with PM2
npm run pm2:monit
```

## 📞 Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review documentation files
3. Run health check: `curl http://localhost:5000/health`
4. Check environment configuration
5. Contact development team

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary and confidential.

## 🎯 Default Credentials

**Development Mode:**
- Email: `admin@kitchen.com`
- Password: `admin123`

**⚠️ Change these in production!**

## 🔄 Version History

### v1.1.0 (Current)
- ✅ Added comprehensive logging system
- ✅ Implemented advanced rate limiting
- ✅ Added security audit middleware
- ✅ Enhanced error handling
- ✅ Added request ID tracking
- ✅ Performance monitoring
- ✅ Complete documentation

### v1.0.0
- Initial release with core features
