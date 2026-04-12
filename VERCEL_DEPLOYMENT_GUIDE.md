# Vercel Deployment Guide - Merchant Cyra Backend

## 🚀 Quick Deploy to Vercel

### Prerequisites
- Vercel account (sign up at https://vercel.com)
- Vercel CLI installed: `npm install -g vercel`
- Git repository (optional but recommended)

## Step-by-Step Deployment

### 1. Prepare Your Project

```bash
# Navigate to backend directory
cd "Merchant Cyra/backend"

# Build the project
npm run build

# Test locally first
npm start
```

### 2. Install Vercel CLI (if not installed)

```bash
npm install -g vercel
```

### 3. Login to Vercel

```bash
vercel login
```

### 4. Deploy to Vercel

#### Option A: Deploy via CLI (Recommended)

```bash
# First deployment (will ask configuration questions)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No
# - What's your project's name? merchant-cyra-backend
# - In which directory is your code located? ./
# - Want to override settings? No

# For production deployment
vercel --prod
```

#### Option B: Deploy via Git (Recommended for CI/CD)

1. **Push to GitHub/GitLab/Bitbucket:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_REPO_URL
   git push -u origin main
   ```

2. **Import to Vercel:**
   - Go to https://vercel.com/new
   - Import your Git repository
   - Configure as shown below

### 5. Configure Environment Variables in Vercel

Go to your project settings on Vercel Dashboard:

**Project Settings → Environment Variables**

Add these variables:

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

# Firebase Configuration
FIREBASE_DATABASE_URL=https://cyra-b50e8-default-rtdb.firebaseio.com
FIREBASE_API_KEY=AIzaSyBBYaJSx7HiwOqhO7b2RWNbJXxHN5gLckc
FIREBASE_PROJECT_ID=cyra-b50e8

# JWT (IMPORTANT: Generate a new secret!)
JWT_SECRET=YOUR_PRODUCTION_JWT_SECRET_HERE
JWT_EXPIRES_IN=24h

# CYRA Integration
CYRA_API_URL=https://api.cyra.com
CYRA_API_KEY=your_cyra_api_key
CYRA_WEBHOOK_SECRET=your_webhook_secret

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Frontend URLs
FRONTEND_URL=https://cyra-merchant.vercel.app
ALLOWED_ORIGINS=https://cyra-merchant.vercel.app,https://cyra-frontend.vercel.app,http://localhost:3000
```

### 6. Generate Production JWT Secret

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or use OpenSSL
openssl rand -base64 64
```

Copy the output and use it as your `JWT_SECRET` in Vercel.

### 7. Configure Build Settings in Vercel

If using Vercel Dashboard:

**Project Settings → General**

- **Framework Preset:** Other
- **Build Command:** `npm run vercel-build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Development Command:** `npm run dev`

### 8. Deploy and Test

```bash
# Deploy to production
vercel --prod

# You'll get a URL like: https://merchant-cyra-backend.vercel.app
```

### 9. Test Your Deployment

```bash
# Test health endpoint
curl https://your-deployment-url.vercel.app/health

# Expected response:
# {"status":"ok","mode":"demo","timestamp":"..."}
```

## 🔧 Vercel Configuration Files

### vercel.json
Already created in your project with:
- Node.js runtime configuration
- Route handling
- Production environment settings

### .vercelignore
Already created to exclude:
- node_modules
- Source files (src)
- Logs
- Environment files

## 🌐 Update Frontend URLs

After deployment, update your frontend apps to use the new backend URL:

### In Cyra Frontend (.env)
```env
VITE_API_URL=https://your-backend-url.vercel.app
```

### In Merchant Frontend (.env)
```env
VITE_API_URL=https://your-backend-url.vercel.app
```

## 🔒 Security Checklist

Before going live:

- [ ] Generate new JWT_SECRET (don't use development secret!)
- [ ] Update CORS allowed origins with production URLs
- [ ] Set NODE_ENV=production
- [ ] Set LOG_LEVEL=info or warn
- [ ] Verify Firebase credentials are correct
- [ ] Test all API endpoints
- [ ] Enable Vercel's security features
- [ ] Set up custom domain (optional)
- [ ] Enable HTTPS (automatic on Vercel)

## 📊 Monitoring on Vercel

### View Logs
1. Go to Vercel Dashboard
2. Select your project
3. Click on "Logs" tab
4. View real-time logs

### View Analytics
1. Go to "Analytics" tab
2. Monitor:
   - Request count
   - Response times
   - Error rates
   - Geographic distribution

### Set Up Alerts
1. Go to "Settings" → "Notifications"
2. Configure alerts for:
   - Deployment failures
   - High error rates
   - Performance issues

## 🔄 Continuous Deployment

### Automatic Deployments
Once connected to Git:
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployments

### Manual Deployments
```bash
# Deploy current directory
vercel

# Deploy to production
vercel --prod

# Deploy with specific name
vercel --name my-backend-v2
```

## 🐛 Troubleshooting

### Issue: Build Fails

**Check:**
```bash
# Test build locally
npm run build

# Check for TypeScript errors
npm run build 2>&1 | grep error
```

**Solution:** Fix TypeScript errors before deploying

### Issue: Environment Variables Not Working

**Check:**
1. Verify variables are set in Vercel Dashboard
2. Redeploy after adding variables
3. Check variable names match exactly

**Solution:**
```bash
# Redeploy to pick up new environment variables
vercel --prod
```

### Issue: CORS Errors

**Check:**
1. Verify ALLOWED_ORIGINS includes your frontend URL
2. Check CORS configuration in code

**Solution:**
```env
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://cyra-merchant.vercel.app
```

### Issue: 404 Errors

**Check:** `vercel.json` routes configuration

**Solution:** Ensure routes are configured correctly:
```json
{
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server-demo.js"
    }
  ]
}
```

### Issue: Function Timeout

Vercel has execution time limits:
- Hobby: 10 seconds
- Pro: 60 seconds

**Solution:** Optimize slow operations or upgrade plan

### Issue: Cold Starts

**Symptoms:** First request is slow

**Solution:** 
- Use Vercel Pro for faster cold starts
- Implement health check pings
- Consider serverless-friendly architecture

## 📱 Custom Domain Setup

### 1. Add Domain in Vercel
1. Go to Project Settings → Domains
2. Add your domain (e.g., api.cyra.com)
3. Follow DNS configuration instructions

### 2. Update DNS Records
Add these records to your domain:
```
Type: A
Name: api (or @)
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 3. Update Environment Variables
```env
FRONTEND_URL=https://app.cyra.com
ALLOWED_ORIGINS=https://app.cyra.com,https://merchant.cyra.com
```

## 🔐 Production Best Practices

### 1. Use Environment Variables
Never hardcode secrets in code

### 2. Enable Rate Limiting
Already configured in your backend

### 3. Monitor Logs
Set up log monitoring and alerts

### 4. Regular Updates
```bash
# Update dependencies
npm update

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

### 5. Backup Strategy
- Firebase data is automatically backed up
- Keep environment variables documented
- Version control your code

## 📈 Scaling Considerations

### Vercel Limits (Hobby Plan)
- 100 GB bandwidth/month
- 100 hours serverless function execution
- 10 second function timeout

### Upgrade to Pro for:
- Unlimited bandwidth
- 1000 hours execution
- 60 second timeout
- Better performance
- Priority support

## 🎯 Post-Deployment Checklist

- [ ] Backend deployed successfully
- [ ] Health endpoint responding
- [ ] Environment variables configured
- [ ] CORS working with frontend
- [ ] Authentication working
- [ ] Firebase integration working
- [ ] Logs visible in Vercel dashboard
- [ ] Frontend updated with backend URL
- [ ] Test all API endpoints
- [ ] Monitor for errors
- [ ] Set up alerts
- [ ] Document deployment URL

## 📞 Support Resources

- **Vercel Documentation:** https://vercel.com/docs
- **Vercel Support:** https://vercel.com/support
- **Community:** https://github.com/vercel/vercel/discussions
- **Status Page:** https://www.vercel-status.com/

## 🚀 Quick Commands Reference

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls

# Remove deployment
vercel rm deployment-url

# Pull environment variables
vercel env pull

# Add environment variable
vercel env add

# Link to existing project
vercel link
```

## 🎉 Success!

Your Merchant Cyra backend is now live on Vercel! 

**Next Steps:**
1. Test all endpoints
2. Update frontend with new backend URL
3. Monitor logs and performance
4. Set up custom domain (optional)
5. Configure alerts and monitoring

Your deployment URL will be something like:
`https://merchant-cyra-backend.vercel.app`

Share this URL with your frontend team to update their API configuration!
