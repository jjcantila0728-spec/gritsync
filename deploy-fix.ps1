# Quick Deploy Fix for Storage Access Issue
Write-Host "🚀 Deploying fixed AI form filling function..." -ForegroundColor Cyan
Write-Host ""

try {
    # Check if Supabase CLI is available
    $supabaseCheck = Get-Command supabase -ErrorAction SilentlyContinue
    
    if (-not $supabaseCheck) {
        Write-Host "❌ Supabase CLI not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install it first:" -ForegroundColor Yellow
        Write-Host "  npm install -g supabase" -ForegroundColor White
        Write-Host ""
        Write-Host "Or deploy via Supabase Dashboard:" -ForegroundColor Yellow
        Write-Host "  https://supabase.com/dashboard/project/warfdcbvnapietbkpild/functions" -ForegroundColor White
        exit 1
    }
    
    Write-Host "📦 Deploying fill-pdf-form-ai function..." -ForegroundColor Gray
    supabase functions deploy fill-pdf-form-ai
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Function deployed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🧪 Test it now:" -ForegroundColor Cyan
        Write-Host "  1. Go to: http://localhost:5000/applications/AP9B83G6Y8HQNH/timeline" -ForegroundColor White
        Write-Host "  2. Click 'Generate G-1145' button" -ForegroundColor White
        Write-Host "  3. Wait 3-8 seconds for AI processing" -ForegroundColor White
        Write-Host "  4. PDF should download successfully!" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Deployment failed!" -ForegroundColor Red
        Write-Host "Check the error messages above." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

