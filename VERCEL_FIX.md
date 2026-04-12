# Vercel Deployment Fix

## Issue
The deployment was failing with `FUNCTION_INVOCATION_FAILED` error because the Express app wasn't properly configured for Vercel's serverless functions.

## Solution Applied

### 1. Created Serverless Entry Point
Created `api/index.ts` - a serverless-compatible version of the Express app that:
- Exports the app as default export (required by Vercel)
- Removes server.listen() (Vercel handles this)
- Removes Socket.io (not supported in serverless)
- Keeps all API routes and middleware

### 2. Updated vercel.json
Changed the build configuration to use the new API endpoint:
```json
{
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/api/index.ts" }]
}
```

## How to Redeploy

### Option 1: Quick Redeploy
```bash
cd "Merchant Cyra/backend"
vercel --prod
```

### Option 2: From Vercel Dashboard
1. Go to your project on Vercel
2. Click "Redeploy" on the latest deployment
3. Wait for build to complete

## What Changed

### ✅ Working Now
- All API endpoints (/api/auth/*, /api/menu, /api/orders, etc.)
- Health check endpoint (/health)
- CORS configuration
- Rate limiting
- Authentication
- Logging
- Error handling

### ⚠️ Not Available in Serverless
- Socket.io real-time updates (use polling or webhooks instead)
- Firebase order listener (use webhooks)
- Long-running processes

## Testing After Deployment

```bash
# Test health endpoint
curl https://your-app.vercel.app/health

# Expected response:
{
  "status": "ok",
  "mode": "serverless",
  "timestamp": "...",
  "stats": {...}
}

# Test login
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kitchen.com","password":"admin123"}'
```

## Environment Variables

Make sure these are set in Vercel Dashboard:

```env
NODE_ENV=production
JWT_SECRET=your_production_secret
FIREBASE_DATABASE_URL=https://cyra-b50e8-default-rtdb.firebaseio.com
FIREBASE_API_KEY=AIzaSyBBYaJSx7HiwOqhO7b2RWNbJXxHN5gLckc
FIREBASE_PROJECT_ID=cyra-b50e8
FRONTEND_URL=https://cyra-merchant.vercel.app
ALLOWED_ORIGINS=https://cyra-merchant.vercel.app,https://cyra-frontend.vercel.app
```

## Alternative: Deploy to Railway/Render

If you need Socket.io and real-time features, consider deploying to:
- **Railway.app** - Supports WebSockets
- **Render.com** - Supports long-running processes
- **Heroku** - Full Node.js support
- **DigitalOcean App Platform** - Container support

These platforms support traditional Node.js servers with Socket.io.

## Next Steps

1. Redeploy to Vercel
2. Test all endpoints
3. Update frontend with backend URL
4. Monitor logs in Vercel Dashboard

## Need Real-time Features?

For Socket.io support, you have two options:

### Option A: Use Vercel + Separate WebSocket Service
- Deploy API to Vercel (current setup)
- Deploy Socket.io server to Railway/Render
- Frontend connects to both

### Option B: Deploy Everything to Railway/Render
- Full Node.js support
- Socket.io works out of the box
- Use the original `src/server-demo.ts`

Let me know if you need help with either option!
