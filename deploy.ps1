# =============================================================================
# GritSync — Full Deployment Script
# Run from D:\gritsync:  powershell -ExecutionPolicy Bypass -File deploy.ps1
# =============================================================================

Write-Host "=== GritSync Deployment Script ===" -ForegroundColor Cyan

# ── 1. Git identity ───────────────────────────────────────────────────────────
Write-Host "`n[1/4] Configuring git identity..." -ForegroundColor Yellow
git config --global user.email "jjcantila0728@gmail.com"
git config --global user.name "JJ Cantila"

# ── 2. Commit & push ──────────────────────────────────────────────────────────
Write-Host "`n[2/4] Committing and pushing to GitHub..." -ForegroundColor Yellow
git add api/index.ts server/index.ts vercel.json
git commit -m "feat: add Vercel full-stack deployment (Express serverless + Vite frontend)"
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push failed. Check your GitHub credentials and try again." -ForegroundColor Red
    exit 1
}
Write-Host "Push successful!" -ForegroundColor Green

# ── 3. Install Vercel CLI if needed ───────────────────────────────────────────
Write-Host "`n[3/4] Checking Vercel CLI..." -ForegroundColor Yellow
$vercelVersion = vercel --version 2>$null
if (-not $vercelVersion) {
    Write-Host "Installing Vercel CLI globally..." -ForegroundColor Yellow
    npm install -g vercel
}
Write-Host "Vercel CLI ready." -ForegroundColor Green

# ── 4. Set environment variables on Vercel ────────────────────────────────────
Write-Host "`n[4/4] Setting Vercel environment variables..." -ForegroundColor Yellow

$projectId = "prj_VMW3CbOiMsCI9vkLuu9HkkOM9uG3"
$teamId    = "team_okfhhPGJ8OakpyN2IcrhAtnq"

# Load values from local .env
$envFile = Get-Content ".env" | Where-Object { $_ -match "^[A-Z]" -and $_ -notmatch "^#" }
$envVars = @{}
foreach ($line in $envFile) {
    $parts = $line -split "=", 2
    if ($parts.Count -eq 2) {
        $envVars[$parts[0].Trim()] = $parts[1].Trim()
    }
}

# Variables to push to Vercel (all environments: production, preview, development)
$varsToSet = @(
    "DATABASE_URL",
    "JWT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "ADMIN_EMAILS",
    "NODE_ENV",
    "PORT",
    "VITE_STRIPE_PUBLISHABLE_KEY",
    "SKIP_EMAIL_VERIFICATION"
)

foreach ($key in $varsToSet) {
    if ($envVars.ContainsKey($key)) {
        $value = $envVars[$key]
        Write-Host "  Setting $key..." -NoNewline

        # Set for all three environments
        foreach ($env in @("production", "preview", "development")) {
            echo $value | vercel env add $key $env --yes --scope $teamId 2>$null
        }
        Write-Host " done" -ForegroundColor Green
    } else {
        Write-Host "  Skipping $key (not found in .env)" -ForegroundColor DarkGray
    }
}

# ── 5. Trigger a fresh deployment ─────────────────────────────────────────────
Write-Host "`nTriggering production deployment..." -ForegroundColor Yellow
vercel --prod --yes --scope $teamId

Write-Host "`n=== Done! Vercel deployment triggered. ===" -ForegroundColor Cyan
Write-Host "Track it at: https://vercel.com/jjcantila0728-8615s-projects/gritsync" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Set your production DATABASE_URL in Vercel dashboard if using Supabase." -ForegroundColor Yellow
Write-Host "Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/settings/database" -ForegroundColor Yellow
Write-Host "Copy the Connection String (URI) and update DATABASE_URL in Vercel env vars." -ForegroundColor Yellow
