# CORS Configuration Guide

## Overview

The Merchant Cyra backend uses a secure CORS configuration that allows only specific origins to access the API. This prevents unauthorized cross-origin requests and enhances security.

## Allowed Origins

### Default Origins
The following origins are allowed by default:
- `https://echiesta.vercel.app` - Production frontend
- `https://echiesta-frontend.vercel.app` - Alternative production frontend
- `http://localhost:5173` - Vite development server
- `http://localhost:3000` - React development server

### Environment-Based Origins
Additional origins can be configured via environment variables:
- `FRONTEND_URL` - Primary frontend URL
- `ALLOWED_ORIGINS` - Comma-separated list of additional origins

## Configuration

### Environment Variables

```env
# Primary frontend URL
FRONTEND_URL=https://your-frontend-domain.com

# Additional allowed origins (comma-separated)
ALLOWED_ORIGINS=https://app1.example.com,https://app2.example.com
```

### Example Configurations

**Development:**
```env
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
```

**Production:**
```env
FRONTEND_URL=https://merchant.cyra.com
ALLOWED_ORIGINS=https://echiesta.vercel.app,https://admin.cyra.com
```

## Features

### 1. Origin Validation
- Checks if the request origin starts with any allowed origin
- Allows for subdomain matching
- Blocks unauthorized origins

### 2. Credentials Support
- Enables `credentials: true` for cookie-based authentication
- Supports JWT tokens in cookies
- Allows Authorization headers

### 3. Security Logging
- Logs all blocked origins to security logs
- Tracks CORS violations for security monitoring
- Helps identify unauthorized access attempts

### 4. No-Origin Requests
- Allows requests with no origin (mobile apps, curl, Postman)
- Useful for API testing and mobile applications

## How It Works

```typescript
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    
    if (isAllowed) {
      callback(null, true);  // Allow
    } else {
      logger.warn("Blocked Origin", { origin });
      callback(new Error("CORS not allowed"));  // Block
    }
  },
  credentials: true,
}));
```

## Testing CORS

### Test Allowed Origin
```bash
curl -H "Origin: https://echiesta.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:5000/api/menu
```

Expected: `200 OK` with CORS headers

### Test Blocked Origin
```bash
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:5000/api/menu
```

Expected: CORS error

### Test No Origin (Mobile/API)
```bash
curl http://localhost:5000/api/menu
```

Expected: `200 OK` (no origin is allowed)

## Monitoring

### Check Blocked Origins
```bash
# View security logs for CORS violations
cat logs/security-*.log | grep "CORS blocked"

# Real-time monitoring
tail -f logs/security-*.log | grep "CORS"
```

### Example Log Entry
```json
{
  "level": "security",
  "message": "CORS blocked origin",
  "metadata": {
    "origin": "https://unauthorized-site.com",
    "ip": "192.168.1.100"
  },
  "timestamp": "2026-04-12 16:30:45"
}
```

## Troubleshooting

### Issue: Frontend Can't Connect

**Symptoms:**
- CORS errors in browser console
- Network requests fail with CORS error

**Solutions:**

1. **Check if origin is allowed:**
   ```bash
   # Check server logs
   cat logs/combined-*.log | grep "CORS allowed origins"
   ```

2. **Add origin to environment:**
   ```env
   ALLOWED_ORIGINS=https://your-frontend.com
   ```

3. **Restart server:**
   ```bash
   npm run pm2:restart
   ```

### Issue: Credentials Not Working

**Symptoms:**
- Cookies not sent with requests
- Authorization headers missing

**Solutions:**

1. **Ensure credentials are enabled in frontend:**
   ```javascript
   fetch('http://localhost:5000/api/menu', {
     credentials: 'include'  // Important!
   })
   ```

2. **Check CORS configuration:**
   - `credentials: true` must be set
   - Origin must be specific (not `*`)

### Issue: Subdomain Not Working

**Symptoms:**
- Main domain works but subdomain doesn't

**Solutions:**

1. **Add subdomain explicitly:**
   ```env
   ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
   ```

2. **Or use wildcard matching** (modify code):
   ```typescript
   const isAllowed = allowedOrigins.some(o => 
     origin === o || origin.endsWith('.' + o.replace('https://', ''))
   );
   ```

## Security Best Practices

### 1. Never Use Wildcard in Production
```typescript
// ❌ BAD - Allows all origins
app.use(cors({ origin: '*' }))

// ✅ GOOD - Specific origins only
app.use(cors({ origin: allowedOrigins }))
```

### 2. Always Validate Origins
```typescript
// ✅ GOOD - Validates each origin
const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
```

### 3. Log Blocked Attempts
```typescript
// ✅ GOOD - Security monitoring
logSecurity('CORS blocked origin', { origin, ip });
```

### 4. Use HTTPS in Production
```env
# ✅ GOOD
FRONTEND_URL=https://secure-site.com

# ❌ BAD (in production)
FRONTEND_URL=http://insecure-site.com
```

### 5. Limit Allowed Origins
- Only add origins you control
- Remove unused origins
- Review regularly

## Adding New Origins

### Step 1: Update Environment
```env
ALLOWED_ORIGINS=https://echiesta.vercel.app,https://new-frontend.com
```

### Step 2: Restart Server
```bash
npm run pm2:restart
```

### Step 3: Verify
```bash
# Check logs for new origin
cat logs/combined-*.log | grep "CORS allowed origins"

# Test the new origin
curl -H "Origin: https://new-frontend.com" \
     http://localhost:5000/health
```

### Step 4: Monitor
```bash
# Watch for any CORS issues
tail -f logs/security-*.log | grep "CORS"
```

## Production Checklist

- [ ] Remove development origins (localhost)
- [ ] Add all production frontend URLs
- [ ] Use HTTPS for all origins
- [ ] Test CORS from production frontend
- [ ] Monitor security logs for blocked origins
- [ ] Document all allowed origins
- [ ] Set up alerts for CORS violations

## Support

For CORS-related issues:
1. Check security logs: `logs/security-*.log`
2. Verify environment variables
3. Test with curl commands above
4. Review this documentation
5. Contact development team

## References

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Package](https://www.npmjs.com/package/cors)
- Backend Security Logs: `logs/security-*.log`
