# Setting Up Stripe Checkout Logo

## Option 1: Using Your Replit/Production URL (Recommended)

If your app is deployed and accessible via HTTPS, you can use your logo directly from your public folder.

### Steps:

1. **Get your production/deployed URL**
   - If deployed on Replit: `https://your-repl-name.your-username.repl.co`
   - If deployed on Vercel: `https://your-app.vercel.app`
   - If you have a custom domain: `https://yourdomain.com`

2. **Construct the logo URL**
   - Your logo is at: `public/gritsync_logo.png`
   - Full URL: `https://your-domain.com/gritsync_logo.png`

3. **Set in Supabase Edge Function Secrets**
   - Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild
   - Navigate to: **Edge Functions** → **Settings** → **Secrets**
   - Click **"Add new secret"**
   - Name: `STRIPE_CHECKOUT_LOGO_URL`
   - Value: `https://your-domain.com/gritsync_logo.png`
   - Click **"Save"**

## Option 2: Using a CDN (Alternative)

If you don't have a deployed URL yet, you can:

1. Upload your logo to a free image hosting service:
   - **Imgur**: https://imgur.com
   - **Cloudinary**: https://cloudinary.com (free tier)
   - **GitHub**: Upload to your repo and use raw.githubusercontent.com

2. Get the direct HTTPS URL to your image

3. Set it in Supabase Edge Function Secrets as above

## Option 3: For Local Development

For local development, you can use a temporary public URL or skip the logo (it's optional).

## Quick Setup (If You Have a Deployed URL)

Replace `YOUR_DEPLOYED_URL` with your actual URL:

```
STRIPE_CHECKOUT_LOGO_URL=https://YOUR_DEPLOYED_URL/gritsync_logo.png
```

### Example URLs:
- Replit: `https://gritsync.yourusername.repl.co/gritsync_logo.png`
- Vercel: `https://gritsync.vercel.app/gritsync_logo.png`
- Custom domain: `https://gritsync.com/gritsync_logo.png`

## Verification

After setting the secret:

1. The logo will appear at the top of the Stripe Checkout page
2. Logo should be:
   - Square or landscape (recommended: 128×128px or larger)
   - PNG, JPG, or SVG format
   - Accessible via HTTPS
   - Publicly accessible (no authentication required)

## Notes

- The logo is optional - checkout will work without it
- Stripe will automatically resize the logo to fit
- Make sure the URL is accessible (test it in a browser)
- The URL must use HTTPS (required by Stripe)

