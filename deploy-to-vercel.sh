#!/bin/bash

# Merchant Cyra Backend - Vercel Deployment Script
# This script helps deploy the backend to Vercel

echo "🚀 Merchant Cyra Backend - Vercel Deployment"
echo "=============================================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed"
    echo "📦 Install it with: npm install -g vercel"
    exit 1
fi

echo "✅ Vercel CLI found"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    echo "📁 Please run this script from the backend directory"
    exit 1
fi

echo "✅ In correct directory"
echo ""

# Check if api/index.js exists
if [ ! -f "api/index.js" ]; then
    echo "❌ api/index.js not found"
    echo "📄 This file is required for Vercel deployment"
    exit 1
fi

echo "✅ Serverless function found (api/index.js)"
echo ""

# Check if vercel.json exists
if [ ! -f "vercel.json" ]; then
    echo "❌ vercel.json not found"
    echo "📄 This file is required for Vercel deployment"
    exit 1
fi

echo "✅ Vercel configuration found"
echo ""

# Check if .env exists and has JWT_SECRET
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found"
    echo "📝 You'll need to set environment variables in Vercel Dashboard"
else
    if grep -q "JWT_SECRET=" .env; then
        echo "✅ JWT_SECRET found in .env"
        echo "⚠️  Remember to add this to Vercel Dashboard → Settings → Environment Variables"
    else
        echo "⚠️  JWT_SECRET not found in .env"
        echo "📝 You'll need to set this in Vercel Dashboard"
    fi
fi

echo ""
echo "📋 Pre-deployment checklist:"
echo "   ✅ Vercel CLI installed"
echo "   ✅ api/index.js exists"
echo "   ✅ vercel.json configured"
echo "   ✅ Dependencies in package.json"
echo ""

# Ask user if they want to proceed
read -p "🤔 Ready to deploy to Vercel? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "🚀 Starting deployment..."
echo ""

# Deploy to Vercel
vercel --prod

echo ""
echo "✅ Deployment command executed!"
echo ""
echo "📝 Next steps:"
echo "   1. Copy the deployment URL from above"
echo "   2. Test the health endpoint:"
echo "      curl https://your-url.vercel.app/health"
echo "   3. Add environment variables in Vercel Dashboard:"
echo "      - NODE_ENV=production"
echo "      - JWT_SECRET=your_secret"
echo "      - FIREBASE_DATABASE_URL=..."
echo "      - FIREBASE_API_KEY=..."
echo "      - FIREBASE_PROJECT_ID=..."
echo "      - FRONTEND_URL=https://cyra-merchant.vercel.app"
echo "      - ALLOWED_ORIGINS=https://cyra-merchant.vercel.app,https://cyra-frontend.vercel.app"
echo "   4. Redeploy after adding environment variables"
echo "   5. Update frontend .env.production with backend URL"
echo ""
echo "🎉 Done!"
