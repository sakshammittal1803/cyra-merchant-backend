# Pre-Deployment Checklist

## ✅ Before Deploying to Vercel

### 1. Code Preparation
- [ ] All code is committed to Git
- [ ] No console.log statements in production code
- [ ] All TypeScript errors are fixed
- [ ] Build succeeds locally: `npm run build`
- [ ] Server starts locally: `npm start`

### 2. Environment Variables

#### Required Variables
- [ ] `NODE_ENV=production`
- [ ] `PORT=5000`
- [ ] `JWT_SECRET` (NEW secure secret, not development one!)
- [ ] `FIREBASE_DATABASE_URL`
- [ ] `FIREBASE_API_KEY`
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FRONTEND_URL` (production URL)
- [ ] `ALLOWED_ORIGINS` (all production URLs)

#### Generate New JWT Secret
```bash
# Run this command and copy the output
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Security Configuration

- [ ] JWT_SECRET is different from development
- [ ] CORS origins include only production URLs
- [ ] No sensitive data in code
- [ ] Rate limiting is enabled
- [ ] Input validation is working
- [ ] Error messages don't expose sensitive info

### 4. CORS Configuration

Update these in Vercel environment variables:
```env
FRONTEND_URL=https://cyra-merchant.vercel.app
ALLOWED_ORIGINS=https://cyra-merchant.vercel.app,https://cyra-frontend.vercel.app
```

- [ ] Remove localhost URLs from production CORS
- [ ] Add all production frontend URLs
- [ ] Test CORS with production URLs

### 5. Firebase Configuration

- [ ] Firebase credentials are correct
- [ ] Firebase database URL is accessible
- [ ] Firebase security rules are configured
- [ ] Test Firebase connection locally

### 6. Logging Configuration

- [ ] `LOG_LEVEL=info` or `warn` (not debug)
- [ ] `LOG_PERFORMANCE=false` (unless needed)
- [ ] Logs don't contain sensitive data

### 7. Rate Limiting

Current settings (adjust if needed):
- [ ] API: 100 requests per 15 minutes
- [ ] Auth: 5 attempts per 15 minutes
- [ ] Orders: 10 operations per minute
- [ ] Menu: 30 operations per minute

### 8. Testing

- [ ] Health endpoint works: `curl http://localhost:5000/health`
- [ ] Login works with test credentials
- [ ] Menu endpoints work
- [ ] Order endpoints work
- [ ] Firebase integration works
- [ ] Socket.io connections work

### 9. Vercel Configuration

- [ ] `vercel.json` is configured
- [ ] `.vercelignore` excludes unnecessary files
- [ ] `package.json` has `vercel-build` script
- [ ] Build command is correct

### 10. Documentation

- [ ] Deployment URL is documented
- [ ] Environment variables are documented
- [ ] API endpoints are documented
- [ ] Frontend team knows the new backend URL

## 🚀 Deployment Steps

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Build Locally
```bash
npm run build
```

### Step 4: Deploy to Preview
```bash
vercel
```

### Step 5: Test Preview Deployment
```bash
curl https://your-preview-url.vercel.app/health
```

### Step 6: Deploy to Production
```bash
vercel --prod
```

### Step 7: Configure Environment Variables
1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add all required variables
5. Redeploy if needed

### Step 8: Test Production
```bash
curl https://your-production-url.vercel.app/health
```

## 📋 Post-Deployment Checklist

- [ ] Health endpoint responds correctly
- [ ] Login works with production credentials
- [ ] CORS works with frontend
- [ ] Firebase integration works
- [ ] Logs are visible in Vercel Dashboard
- [ ] No errors in production logs
- [ ] Frontend can connect to backend
- [ ] All API endpoints work
- [ ] Rate limiting is working
- [ ] Socket.io connections work

## 🔧 Environment Variables Template

Copy this to Vercel Dashboard:

```env
# Server
NODE_ENV=production
PORT=5000

# Logging
LOG_LEVEL=info
LOG_PERFORMANCE=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
ORDER_RATE_LIMIT_MAX=10

# Firebase
FIREBASE_DATABASE_URL=https://cyra-b50e8-default-rtdb.firebaseio.com
FIREBASE_API_KEY=AIzaSyBBYaJSx7HiwOqhO7b2RWNbJXxHN5gLckc
FIREBASE_PROJECT_ID=cyra-b50e8

# JWT (GENERATE NEW SECRET!)
JWT_SECRET=PASTE_YOUR_NEW_SECRET_HERE
JWT_EXPIRES_IN=24h

# CYRA Integration
CYRA_API_URL=https://api.cyra.com
CYRA_API_KEY=your_cyra_api_key
CYRA_WEBHOOK_SECRET=your_webhook_secret

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Frontend
FRONTEND_URL=https://cyra-merchant.vercel.app
ALLOWED_ORIGINS=https://cyra-merchant.vercel.app,https://cyra-frontend.vercel.app
```

## ⚠️ Common Issues

### Build Fails
- Check TypeScript errors: `npm run build`
- Check dependencies: `npm install`
- Check Node version compatibility

### CORS Errors
- Verify ALLOWED_ORIGINS includes frontend URL
- Check CORS configuration in code
- Redeploy after changing environment variables

### Environment Variables Not Working
- Redeploy after adding variables
- Check variable names match exactly
- Verify no typos in variable names

### Firebase Connection Fails
- Verify Firebase credentials
- Check Firebase database URL
- Test Firebase connection locally first

## 📞 Need Help?

1. Check Vercel logs in Dashboard
2. Review `VERCEL_DEPLOYMENT_GUIDE.md`
3. Test locally first: `npm run build && npm start`
4. Check environment variables are set correctly
5. Contact development team

## 🎯 Quick Deploy Command

```bash
# One-line deploy (after checklist is complete)
npm run build && vercel --prod
```

## ✅ Ready to Deploy?

If all checkboxes are checked, you're ready to deploy! 🚀

Run:
```bash
bash deploy.sh
```

Or manually:
```bash
vercel --prod
```

Good luck with your deployment! 🎉
