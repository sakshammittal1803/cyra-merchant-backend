# Merchant Cyra Backend - Production Deployment Guide

This guide walks you through deploying the Merchant Cyra backend to production with all security and logging features enabled.

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Security Configuration](#security-configuration)
4. [Logging Configuration](#logging-configuration)
5. [Rate Limiting Configuration](#rate-limiting-configuration)
6. [Deployment Options](#deployment-options)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

## Pre-Deployment Checklist

Before deploying to production, ensure you have:

- [ ] Node.js 18+ installed on production server
- [ ] PostgreSQL database set up (or your preferred database)
- [ ] Firebase project configured
- [ ] Domain name and SSL certificate
- [ ] Reverse proxy (Nginx/Apache) configured
- [ ] Firewall rules configured
- [ ] Backup strategy in place

## Environment Setup

### 1. Clone and Install

```bash
# Clone repository
git clone <your-repo-url>
cd Merchant\ Cyra/backend

# Install dependencies
npm ci --only=production
```

### 2. Configure Environment Variables

```bash
# Copy production example
cp .env.production.example .env

# Edit with your values
nano .env
```

### 3. Generate Secure JWT Secret

```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Copy the output and set it as JWT_SECRET in .env
```

### 4. Required Environment Variables

```env
# Server
PORT=5000
NODE_ENV=production

# Logging
LOG_LEVEL=info

# Firebase
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_PROJECT_ID=your-firebase-project

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=merchant_production
DB_USER=merchant_user
DB_PASSWORD=your-secure-password

# JWT (CRITICAL - Must be changed!)
JWT_SECRET=your-generated-secret-here
JWT_EXPIRES_IN=24h

# Frontend
FRONTEND_URL=https://yourdomain.com
```

## Security Configuration

### 1. Rate Limiting

The application includes three levels of rate limiting:

**API Rate Limiter** (General endpoints)
- Window: 15 minutes
- Max requests: 100 per IP
- Location: `src/middleware/rateLimiter.ts`

**Auth Rate Limiter** (Login/Signup)
- Window: 15 minutes
- Max requests: 5 per IP
- Prevents brute force attacks

**Order Rate Limiter** (Order creation)
- Window: 1 minute
- Max requests: 10 per IP
- Prevents spam orders

To adjust limits, edit `src/middleware/rateLimiter.ts`:

```typescript
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Adjust this value
  // ...
});
```

### 2. Security Headers (Helmet)

Helmet is configured to set secure HTTP headers:
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security (HSTS)

Configuration in `server-demo.ts`:

```typescript
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));
```

### 3. Input Sanitization

All inputs are automatically sanitized to prevent:
- XSS attacks
- MongoDB injection
- Script injection

Middleware: `src/middleware/sanitizer.ts`

### 4. CORS Configuration

Configure allowed origins in production:

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
```

For multiple origins:

```typescript
app.use(cors({
  origin: [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    'https://admin.yourdomain.com'
  ],
  credentials: true,
}));
```

## Logging Configuration

### 1. Log Levels

Set appropriate log level in `.env`:

```env
# Development
LOG_LEVEL=debug

# Staging
LOG_LEVEL=info

# Production
LOG_LEVEL=warn
```

### 2. Log Files

In production, logs are automatically written to:

```
logs/
├── error-2024-01-01.log      # Error logs only
├── error-2024-01-02.log
├── combined-2024-01-01.log   # All logs
└── combined-2024-01-02.log
```

Configuration:
- Daily rotation
- 30-day retention
- 20MB max file size
- JSON format for easy parsing

### 3. Log Monitoring

View logs in real-time:

```bash
# All logs
tail -f logs/combined-*.log

# Errors only
tail -f logs/error-*.log

# Filter by level
grep '"level":"error"' logs/combined-*.log

# Filter by IP
grep '"ip":"192.168.1.1"' logs/combined-*.log
```

### 4. Log Analysis

Parse JSON logs with `jq`:

```bash
# Count errors by type
cat logs/error-*.log | jq -r '.message' | sort | uniq -c

# Find slow requests (>1000ms)
cat logs/combined-*.log | jq 'select(.responseTime > 1000)'

# Get all 500 errors
cat logs/combined-*.log | jq 'select(.statusCode >= 500)'
```

## Rate Limiting Configuration

### Customizing Rate Limits

Edit `src/middleware/rateLimiter.ts`:

```typescript
// For high-traffic applications
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Increased from 100
  // ...
});

// For stricter security
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3, // Decreased from 5
  // ...
});
```

### Rate Limit Headers

Clients receive these headers:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Time when limit resets

### Bypassing Rate Limits

For trusted IPs (e.g., monitoring services):

```typescript
export const apiLimiter = rateLimit({
  // ...
  skip: (req) => {
    const trustedIPs = ['10.0.0.1', '10.0.0.2'];
    return trustedIPs.includes(req.ip);
  },
});
```

## Deployment Options

### Option 1: PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Build application
npm run build

# Start with PM2
pm2 start dist/server-demo.js --name merchant-backend

# Save PM2 configuration
pm2 save

# Setup auto-restart on reboot
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs merchant-backend
```

PM2 Configuration (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'merchant-backend',
    script: './dist/server-demo.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
```

### Option 2: Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 5000

# Start application
CMD ["node", "dist/server-demo.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    restart: unless-stopped
```

Deploy:

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Option 3: Systemd Service

Create `/etc/systemd/system/merchant-backend.service`:

```ini
[Unit]
Description=Merchant Cyra Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/merchant-backend
ExecStart=/usr/bin/node dist/server-demo.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable merchant-backend
sudo systemctl start merchant-backend
sudo systemctl status merchant-backend
```

### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/merchant-backend`:

```nginx
upstream backend {
    server localhost:5000;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/merchant-backend-access.log;
    error_log /var/log/nginx/merchant-backend-error.log;

    # Proxy settings
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/merchant-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Monitoring & Maintenance

### 1. Health Checks

Set up automated health checks:

```bash
# Simple health check
curl https://api.yourdomain.com/health

# With monitoring service (e.g., UptimeRobot, Pingdom)
# Configure to check /health endpoint every 5 minutes
```

### 2. Log Rotation

Logs are automatically rotated, but verify:

```bash
# Check log files
ls -lh logs/

# Check disk usage
du -sh logs/

# Manual cleanup (if needed)
find logs/ -name "*.log" -mtime +30 -delete
```

### 3. Performance Monitoring

Monitor key metrics:

```bash
# CPU and Memory (with PM2)
pm2 monit

# Request rate
tail -f logs/combined-*.log | grep '"level":"http"' | wc -l

# Error rate
tail -f logs/error-*.log | wc -l
```

### 4. Database Backups

Set up automated backups:

```bash
# PostgreSQL backup script
#!/bin/bash
BACKUP_DIR="/backups/merchant-db"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U merchant_user merchant_production > "$BACKUP_DIR/backup_$DATE.sql"
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete
```

### 5. Security Updates

Regular maintenance:

```bash
# Update dependencies
npm audit
npm audit fix

# Update Node.js
nvm install 18
nvm use 18

# Rebuild application
npm run build
pm2 restart merchant-backend
```

## Troubleshooting

### High CPU Usage

```bash
# Check PM2 status
pm2 status

# View detailed metrics
pm2 monit

# Check for memory leaks
pm2 logs --lines 100 | grep "memory"
```

### Rate Limit Issues

```bash
# Check rate limit logs
grep "Rate limit exceeded" logs/combined-*.log

# Identify problematic IPs
grep "Rate limit exceeded" logs/combined-*.log | jq -r '.ip' | sort | uniq -c | sort -rn
```

### Database Connection Issues

```bash
# Check database connectivity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1"

# Check connection pool
grep "database" logs/error-*.log
```

### Log File Issues

```bash
# Check disk space
df -h

# Check log directory permissions
ls -la logs/

# Fix permissions
chmod 755 logs/
chown -R www-data:www-data logs/
```

### SSL/TLS Issues

```bash
# Test SSL certificate
openssl s_client -connect api.yourdomain.com:443

# Check certificate expiry
echo | openssl s_client -connect api.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

## Testing Production Features

Run the test script:

```bash
# Make executable
chmod +x test-production-features.sh

# Run tests
./test-production-features.sh
```

Expected output:
```
Testing: Health Check... ✓ PASSED
Testing: Rate Limiting... ✓ PASSED
Testing: Input Validation... ✓ PASSED
Testing: 404 Handler... ✓ PASSED
Testing: Security Headers... ✓ PASSED
Testing: CORS... ✓ PASSED
Testing: Compression... ✓ PASSED

All tests passed! ✓
```

## Support & Resources

- **Documentation**: See `PRODUCTION_READY.md` for feature details
- **API Documentation**: See `API_DOCUMENTATION.md`
- **Quick Start**: See `QUICK_START.md`

## Security Contacts

For security issues, please contact:
- Email: security@yourdomain.com
- Report vulnerabilities privately

---

**Last Updated**: 2024
**Version**: 1.0.0
