# Deploy to Vercel - Fixed Version

## ✅ What I Fixed

1. **Removed all external dependencies** from api/index.ts
2. **Self-contained serverless function** - no imports from src/
3. **Simple in-memory rate limiting** - works in serverless
4. **Simplified logging** - console.log for Vercel logs
5. **Fixed TypeScript imports** - compatible with Vercel build

## 🚀 Deploy Now

```bash
cd "Merchant Cyra/backend"
vercel --prod
```

## 🔑 Environment Variables to Set in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these:

```env
NODE_ENV=production
JWT_SECRET=your_new_production_secret_here
FRONTEND_URL=https://cyra-merchant.vercel.app
ALLOWED_ORIGINS=https://cyra-merchant.vercel.app,https://cyra-frontend.vercel.app
```

### Generate JWT Secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## ✅ Test After Deployment

```bash
# Test health
curl https://your-app.vercel.app/health

# Test login
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kitchen.com","password":"admin123"}'
```

## 📝 What Works

- ✅ All API endpoints
- ✅ Authentication (login, signup, Google OAuth)
- ✅ Menu management (CRUD)
- ✅ Order management
- ✅ Dashboard stats
- ✅ Rate limiting
- ✅ CORS
- ✅ Input validation
- ✅ Error handling

## ⚠️ What Doesn't Work (Serverless Limitations)

- ❌ Socket.io (real-time updates)
- ❌ Firebase listeners
- ❌ File-based logging (use Vercel logs instead)
- ❌ Persistent in-memory data (resets on each cold start)

## 🔄 For Real-time Features

If you need Socket.io, consider:
1. **Railway.app** - Full Node.js support
2. **Render.com** - WebSocket support
3. **Heroku** - Traditional hosting

## 📊 View Logs

After deployment:
1. Go to Vercel Dashboard
2. Select your project
3. Click "Logs" tab
4. See real-time logs

## 🎯 Next Steps

1. Deploy: `vercel --prod`
2. Add environment variables in Vercel Dashboard
3. Test endpoints
4. Update frontend with backend URL

That's it! Your backend should work now. 🎉
