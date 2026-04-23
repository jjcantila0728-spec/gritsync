# Deployment Guide

## Vercel Deployment (Frontend)

### Prerequisites
- GitHub account
- Vercel account (free tier available)
- Backend API deployed (Railway, Render, or Vercel serverless)

### Step-by-Step Deployment

#### 1. Prepare Your Code
```bash
# Ensure all changes are committed
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

#### 2. Connect to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

#### 3. Configure Environment Variables
In Vercel dashboard → Settings → Environment Variables, add:

**Required Variables:**
```
VITE_API_URL=https://your-backend-api.com/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
NODE_ENV=production
```

**Optional Variables:**
```
VITE_FRONTEND_URL=https://your-vercel-app.vercel.app
```

#### 4. Deploy
- Click "Deploy"
- Wait for build to complete (usually 1-2 minutes)
- Your app will be live at `https://your-app.vercel.app`

#### 5. Custom Domain (Optional)
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `VITE_FRONTEND_URL` environment variable

### Automatic Deployments
- **Production**: Every push to `main` branch
- **Preview**: Every push to other branches (creates preview URLs)

## Backend Deployment

### Option 1: Railway (Recommended)
1. Go to [railway.app](https://railway.app)
2. Create new project from GitHub
3. Select your repository
4. Railway will auto-detect Node.js
5. Set root directory to project root
6. Add environment variables from `env.production.example`
7. Set start command: `npm run start:server`
8. Deploy

### Option 2: Render
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub repository
4. Configure:
   - Build Command: `npm install`
   - Start Command: `npm run start:server`
5. Add environment variables
6. Deploy

### Option 3: Vercel Serverless Functions
Convert Express routes to Vercel serverless functions (requires refactoring).

## Environment Variables Checklist

Copy from `env.production.example` and ensure all are set:

- [ ] `NODE_ENV=production`
- [ ] `PORT=3001` (or your backend port)
- [ ] `FRONTEND_URL` (your Vercel frontend URL)
- [ ] `VITE_API_URL` (your backend API URL)
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `JWT_SECRET` (generate secure secret)
- [ ] `STRIPE_SECRET_KEY` (production key)
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` (production key)
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `RESEND_API_KEY` (if using email)
- [ ] `ADMIN_EMAIL`

## Post-Deployment Checklist

- [ ] Frontend loads correctly
- [ ] API calls work (check browser console)
- [ ] Authentication works
- [ ] File uploads work
- [ ] Stripe payments work
- [ ] CORS configured correctly
- [ ] Environment variables set
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active (automatic on Vercel)
- [ ] Monitoring set up (optional)

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version (should be 18+)

### API Calls Fail
- Check CORS settings on backend
- Verify `VITE_API_URL` is correct
- Check backend is running and accessible

### Environment Variables Not Working
- Ensure variables start with `VITE_` for frontend
- Redeploy after adding new variables
- Check variable names match exactly

## Support

For issues, check:
- Vercel documentation: https://vercel.com/docs
- Railway documentation: https://docs.railway.app
- Render documentation: https://render.com/docs
