#!/bin/bash

# Serverless Deployment Script
# This script deploys all Edge Functions and sets required secrets

set -e

echo "🚀 Starting Serverless Deployment..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if logged in
echo "Checking Supabase login status..."
if ! supabase projects list &> /dev/null; then
    echo "⚠️  Not logged in. Please login first:"
    echo "   supabase login"
    exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

# Get project ref
read -p "Enter your Supabase project ref (or press Enter to skip linking): " PROJECT_REF

if [ -n "$PROJECT_REF" ]; then
    echo "Linking to project: $PROJECT_REF"
    supabase link --project-ref "$PROJECT_REF"
    echo "✅ Project linked"
    echo ""
fi

# Deploy Edge Functions
echo "📦 Deploying Edge Functions..."
echo ""

FUNCTIONS=(
    "admin-login-as"
    "create-payment-intent"
    "stripe-webhook"
    "send-email"
    "resend-inbox"
)

for func in "${FUNCTIONS[@]}"; do
    echo "Deploying $func..."
    if supabase functions deploy "$func"; then
        echo "✅ $func deployed successfully"
    else
        echo "⚠️  Failed to deploy $func (may already be deployed)"
    fi
    echo ""
done

# Set secrets
echo "🔐 Setting Edge Function secrets..."
echo ""
echo "You'll need to set these secrets manually:"
echo ""
echo "Required secrets:"
echo "  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
echo "  supabase secrets set FRONTEND_URL=https://yourdomain.com"
echo ""
echo "Stripe secrets (if using Stripe):"
echo "  supabase secrets set STRIPE_SECRET_KEY=your-stripe-secret-key"
echo "  supabase secrets set STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret"
echo ""

# Verify deployment
echo "🔍 Verifying deployment..."
echo ""
echo "Checking deployed functions..."
supabase functions list

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set the required secrets (see above)"
echo "2. Update your .env file (remove VITE_API_URL)"
echo "3. Test the application"
echo "4. Update Stripe webhook URL to: https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook"
echo ""
