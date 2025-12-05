# Serverless Deployment Script for Windows PowerShell
# This script deploys all Edge Functions and sets required secrets

Write-Host "🚀 Starting Serverless Deployment..." -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
try {
    $null = Get-Command supabase -ErrorAction Stop
    Write-Host "✅ Supabase CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI is not installed." -ForegroundColor Red
    Write-Host "Install it with: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check if logged in
Write-Host "Checking Supabase login status..." -ForegroundColor Cyan
try {
    $null = supabase projects list 2>&1
    Write-Host "✅ Logged in to Supabase" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Not logged in. Please login first:" -ForegroundColor Yellow
    Write-Host "   supabase login" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Get project ref
$PROJECT_REF = Read-Host "Enter your Supabase project ref (or press Enter to skip linking)"

if ($PROJECT_REF) {
    Write-Host "Linking to project: $PROJECT_REF" -ForegroundColor Cyan
    supabase link --project-ref $PROJECT_REF
    Write-Host "✅ Project linked" -ForegroundColor Green
    Write-Host ""
}

# Deploy Edge Functions
Write-Host "📦 Deploying Edge Functions..." -ForegroundColor Cyan
Write-Host ""

$FUNCTIONS = @(
    "admin-login-as",
    "create-payment-intent",
    "stripe-webhook",
    "send-email"
)

foreach ($func in $FUNCTIONS) {
    Write-Host "Deploying $func..." -ForegroundColor Cyan
    try {
        supabase functions deploy $func
        Write-Host "✅ $func deployed successfully" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Failed to deploy $func (may already be deployed)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Set secrets instructions
Write-Host "🔐 Setting Edge Function secrets..." -ForegroundColor Cyan
Write-Host ""
Write-Host "You'll need to set these secrets manually:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Required secrets:" -ForegroundColor White
Write-Host "  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key" -ForegroundColor Gray
Write-Host "  supabase secrets set FRONTEND_URL=https://yourdomain.com" -ForegroundColor Gray
Write-Host ""
Write-Host "Stripe secrets (if using Stripe):" -ForegroundColor White
Write-Host "  supabase secrets set STRIPE_SECRET_KEY=your-stripe-secret-key" -ForegroundColor Gray
Write-Host "  supabase secrets set STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret" -ForegroundColor Gray
Write-Host ""

# Verify deployment
Write-Host "🔍 Verifying deployment..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Checking deployed functions..." -ForegroundColor Cyan
supabase functions list

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set the required secrets (see above)" -ForegroundColor White
Write-Host "2. Update your .env file (remove VITE_API_URL)" -ForegroundColor White
Write-Host "3. Test the application" -ForegroundColor White
Write-Host "4. Update Stripe webhook URL to: https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook" -ForegroundColor White
Write-Host ""
