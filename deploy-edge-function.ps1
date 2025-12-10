# PowerShell script to deploy Edge Function using npx
# This avoids needing to install Supabase CLI globally

Write-Host "Deploying create-payment-intent Edge Function..." -ForegroundColor Cyan

# Deploy the function
npx supabase functions deploy create-payment-intent --project-ref warfdcbvnapietbkpild

Write-Host ""
Write-Host "Next, set the service role key secret:" -ForegroundColor Yellow
Write-Host "npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key --project-ref warfdcbvnapietbkpild" -ForegroundColor Gray
Write-Host ""
Write-Host "You can find your service role key in:" -ForegroundColor Yellow
Write-Host "Supabase Dashboard > Settings > API > service_role key" -ForegroundColor Gray

