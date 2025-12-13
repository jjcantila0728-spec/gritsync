# Deploy AI-Powered PDF Form Filling
# This script deploys the new AI-powered edge function for G-1145 and I-765 forms

Write-Host "🚀 Deploying AI-Powered PDF Form Filling..." -ForegroundColor Cyan
Write-Host ""

# Check if OPENAI_API_KEY is set
$openaiKey = $env:OPENAI_API_KEY
if (-not $openaiKey) {
    Write-Host "⚠️  OPENAI_API_KEY environment variable not set!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please set your OpenAI API key:" -ForegroundColor Yellow
    Write-Host '  $env:OPENAI_API_KEY="sk-your-api-key-here"' -ForegroundColor White
    Write-Host ""
    Write-Host "Or set it as a Supabase secret:" -ForegroundColor Yellow
    Write-Host "  supabase secrets set OPENAI_API_KEY=sk-your-api-key-here" -ForegroundColor White
    Write-Host ""
    
    $continue = Read-Host "Do you want to continue without setting it now? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
} else {
    Write-Host "✅ OPENAI_API_KEY found" -ForegroundColor Green
    Write-Host "   Setting as Supabase secret..." -ForegroundColor Gray
    
    try {
        supabase secrets set "OPENAI_API_KEY=$openaiKey"
        Write-Host "   ✓ Secret set successfully" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "   ✗ Failed to set secret: $_" -ForegroundColor Red
        exit 1
    }
}

# Deploy the edge function
Write-Host "📦 Deploying fill-pdf-form-ai edge function..." -ForegroundColor Cyan

try {
    supabase functions deploy fill-pdf-form-ai
    
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Test the function using the examples in DEPLOY_AI_PDF_FILLING.md"
    Write-Host "   2. Navigate to your application at http://localhost:5000"
    Write-Host "   3. Go to an EAD application timeline"
    Write-Host "   4. Click 'Generate G-1145' or 'Generate I-765'"
    Write-Host "   5. Check that forms are filled with AI intelligence"
    Write-Host ""
    Write-Host "📊 Monitor function logs:" -ForegroundColor Cyan
    Write-Host "   supabase functions logs fill-pdf-form-ai --tail" -ForegroundColor White
    Write-Host ""
    Write-Host "💰 Monitor costs at: https://platform.openai.com/usage" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "   Check the error messages above"
    Write-Host "   Ensure you're logged in: supabase login"
    Write-Host "   Ensure you're linked to project: supabase link"
    exit 1
}

