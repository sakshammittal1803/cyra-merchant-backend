#!/bin/bash

# Merchant Cyra Backend - Vercel Deployment Script
# This script helps you deploy the backend to Vercel

echo "🚀 Merchant Cyra Backend - Vercel Deployment"
echo "=============================================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null
then
    echo "❌ Vercel CLI is not installed"
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix errors before deploying."
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Make sure to configure environment variables in Vercel Dashboard"
fi

echo "📋 Pre-deployment Checklist:"
echo "  [ ] JWT_SECRET is set to a secure production value"
echo "  [ ] Firebase credentials are configured"
echo "  [ ] CORS origins include production URLs"
echo "  [ ] NODE_ENV will be set to 'production'"
echo "  [ ] All environment variables are configured in Vercel"
echo ""

read -p "Have you completed the checklist? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Deployment cancelled. Please complete the checklist first."
    exit 1
fi

echo ""
echo "🚀 Deploying to Vercel..."
echo ""

# Ask for deployment type
echo "Select deployment type:"
echo "1) Preview deployment (test)"
echo "2) Production deployment"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "2" ]; then
    echo "🌐 Deploying to PRODUCTION..."
    vercel --prod
else
    echo "🔍 Deploying to PREVIEW..."
    vercel
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📝 Next steps:"
    echo "  1. Test the health endpoint: curl YOUR_URL/health"
    echo "  2. Update frontend with new backend URL"
    echo "  3. Test all API endpoints"
    echo "  4. Monitor logs in Vercel Dashboard"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Check the error messages above and try again."
    exit 1
fi
