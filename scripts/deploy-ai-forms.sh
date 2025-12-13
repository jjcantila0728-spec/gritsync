#!/bin/bash

# Deploy AI-Powered PDF Form Filling
# This script deploys the new AI-powered edge function for G-1145 and I-765 forms

set -e

echo "🚀 Deploying AI-Powered PDF Form Filling..."
echo ""

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY environment variable not set!"
    echo ""
    echo "Please set your OpenAI API key:"
    echo "  export OPENAI_API_KEY='sk-your-api-key-here'"
    echo ""
    echo "Or set it as a Supabase secret:"
    echo "  supabase secrets set OPENAI_API_KEY=sk-your-api-key-here"
    echo ""
    read -p "Do you want to continue without setting it now? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ OPENAI_API_KEY found"
    echo "   Setting as Supabase secret..."
    supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"
    echo "   ✓ Secret set successfully"
    echo ""
fi

# Deploy the edge function
echo "📦 Deploying fill-pdf-form-ai edge function..."
supabase functions deploy fill-pdf-form-ai

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Test the function using the examples in DEPLOY_AI_PDF_FILLING.md"
    echo "   2. Navigate to your application at http://localhost:5000"
    echo "   3. Go to an EAD application timeline"
    echo "   4. Click 'Generate G-1145' or 'Generate I-765'"
    echo "   5. Check that forms are filled with AI intelligence"
    echo ""
    echo "📊 Monitor function logs:"
    echo "   supabase functions logs fill-pdf-form-ai --tail"
    echo ""
    echo "💰 Monitor costs at: https://platform.openai.com/usage"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo "   Check the error messages above"
    echo "   Ensure you're logged in: supabase login"
    echo "   Ensure you're linked to project: supabase link"
    exit 1
fi

