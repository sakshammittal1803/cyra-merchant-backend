# Quick Deploy to Vercel - 5 Minutes ⚡

## Prerequisites
- Vercel account (free): https://vercel.com/signup
- Your code ready to deploy

## 🚀 Deploy in 5 Steps

### Step 1: Install Vercel CLI (1 min)
```bash
npm install -g vercel
```

### Step 2: Login to Vercel (30 sec)
```bash
vercel login
```
Follow the browser prompt to login.

### Step 3: Build Your Project (1 min)
```bash
cd "Merchant Cyra/backend"
npm install
npm run build
```

### Step 4: Deploy (2 min)
```bash
vercel
```

Answer the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account
- **Link to existing project?** → No
- **Project name?** → merchant-cyra-backend
- **Directory?** → ./
- **Override settings?** → No

### Step 5: Configure Environment Variables (1 min)

Go to: https://vercel.com/dashboard

1. Select your project
2. Go to **Settings** → **Environment Variables**
3. Add these (minimum required):

```env
NODE_ENV=production
JWT_SECRET=YOUR_NEW_SECRET_HERE
FIREBASE_DATABASE_URL=https://cyra-b50e8-default-rtdb.firebaseio.com
FIREBASE_API_KEY=AIzaSyBBYaJSx7HiwOqhO7b2RWNbJXxHN5gLckc
FIREBASE_PROJECT_ID=cyra-b50e8
FRONTEND_URL=https://cyra-merchant.vercel.app
ALLOWED_ORIGINS=https://cyra-merchant.vercel.app,https://cyra-frontend.vercel.app
```

4. Click **Save**
5. Redeploy: `vercel --prod`

## ✅ Test Your Deployment

```bash
# Replace with your actual URL
curl https://your-project.vercel.app/health
```

Expected response:
```json
{"status":"ok","mode":"demo","timestamp":"..."}
```

## 🎯 Your Backend is Live!

Your deployment URL: `https://merchant-cyra-backend.vercel.app`

### Update Your Frontend

In your frontend `.env`:
```env
VITE_API_URL=https://your-backend-url.vercel.app
```

## 📝 Important Notes

### Generate New JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Use this output as your `JWT_SECRET` in Vercel.

### Default Credentials
- Email: `admin@kitchen.com`
- Password: `admin123`

⚠️ **Change these in production!**

## 🔄 Redeploy After Changes

```bash
# Deploy to production
vercel --prod
```

## 📊 Monitor Your App

1. Go to Vercel Dashboard
2. Select your project
3. View:
   - **Deployments** - Deployment history
   - **Logs** - Real-time logs
   - **Analytics** - Performance metrics

## 🐛 Troubleshooting

### Build Fails?
```bash
# Test locally first
npm run build
```

### CORS Errors?
Check `ALLOWED_ORIGINS` includes your frontend URL.

### Environment Variables Not Working?
Redeploy after adding variables:
```bash
vercel --prod
```

## 📚 Full Documentation

For detailed instructions, see:
- `VERCEL_DEPLOYMENT_GUIDE.md` - Complete guide
- `PRE_DEPLOYMENT_CHECKLIST.md` - Checklist
- `PRODUCTION_READY_CHECKLIST.md` - Production setup

## 🎉 Done!

Your backend is now live on Vercel! 

Next: Update your frontend to use the new backend URL.

---

**Need help?** Check the full deployment guide or Vercel documentation.
