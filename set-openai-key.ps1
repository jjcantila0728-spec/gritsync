# Set OpenAI API Key as Supabase Secret
# This script helps you set the OpenAI API key for the edge function

Write-Host "🔑 Setting OpenAI API Key for Supabase Edge Function" -ForegroundColor Cyan
Write-Host ""

# Prompt for API key
$apiKey = Read-Host "Enter your OpenAI API Key (starts with sk-)"

if (-not $apiKey) {
    Write-Host "❌ No API key provided!" -ForegroundColor Red
    exit 1
}

if (-not $apiKey.StartsWith("sk-")) {
    Write-Host "⚠️  Warning: OpenAI API keys usually start with 'sk-'" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

Write-Host ""
Write-Host "Setting secret in Supabase..." -ForegroundColor Gray

try {
    # Set the secret
    $output = supabase secrets set "OPENAI_API_KEY=$apiKey" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ OpenAI API key set successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Deploy the function: supabase functions deploy fill-pdf-form-ai" -ForegroundColor White
        Write-Host "2. Test it by generating a form in your application" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "❌ Failed to set secret!" -ForegroundColor Red
        Write-Host "Error: $output" -ForegroundColor Red
        Write-Host ""
        Write-Host "Make sure you're logged in to Supabase:" -ForegroundColor Yellow
        Write-Host "  supabase login" -ForegroundColor White
        Write-Host ""
        Write-Host "And linked to your project:" -ForegroundColor Yellow
        Write-Host "  supabase link" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

