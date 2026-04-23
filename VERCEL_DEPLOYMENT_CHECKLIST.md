# Vercel Deployment Checklist

## Pre-Deployment ✅

- [x] **vercel.json** created and configured
- [x] **Build tested** - `npm run build` completes successfully
- [x] **.gitignore** updated with `.vercel` directory
- [x] **Environment variables** documented in `env.production.example`
- [x] **README.md** updated with deployment instructions
- [x] **DEPLOYMENT.md** created with detailed guide
- [x] **Unnecessary files cleaned up** (old markdown docs, temp files)

## GitHub Setup

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Verify repository is clean**:
   ```bash
   git status
   ```

## Vercel Setup

### Step 1: Connect Repository
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Sign in with GitHub
- [ ] Click "Add New Project"
- [ ] Import your repository
- [ ] Vercel will auto-detect Vite configuration

### Step 2: Configure Build Settings
Vercel should auto-detect:
- Framework: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

If not, manually set:
- Root Directory: `.` (project root)
- Framework Preset: **Vite**

### Step 3: Environment Variables
Add these in Vercel Dashboard → Settings → Environment Variables:

**Required:**
- [ ] `VITE_API_URL` - Your backend API URL (e.g., `https://api.yourdomain.com/api`)
- [ ] `VITE_SUPABASE_URL` - Your Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key (production)
- [ ] `NODE_ENV=production`

**Optional:**
- [ ] `VITE_FRONTEND_URL` - Your Vercel app URL (for CORS)

### Step 4: Deploy
- [ ] Click "Deploy"
- [ ] Wait for build to complete
- [ ] Check build logs for any errors
- [ ] Verify deployment URL works

### Step 5: Post-Deployment
- [ ] Test frontend loads correctly
- [ ] Test authentication flow
- [ ] Test API connections
- [ ] Verify environment variables are working
- [ ] Check browser console for errors

## Backend Deployment

The Express backend needs to be deployed separately:

**Recommended: Railway**
- [ ] Create Railway account
- [ ] Connect GitHub repository
- [ ] Set root directory to project root
- [ ] Configure start command: `npm run start:server`
- [ ] Add all environment variables from `env.production.example`
- [ ] Update `VITE_API_URL` in Vercel to point to Railway backend

**Alternative: Render**
- [ ] Create Render account
- [ ] Create new Web Service
- [ ] Connect GitHub repository
- [ ] Set build command: `npm install`
- [ ] Set start command: `npm run start:server`
- [ ] Add environment variables
- [ ] Update `VITE_API_URL` in Vercel

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Verify all dependencies in `package.json`
- Ensure Node.js version is 18+

### API Calls Fail
- Verify `VITE_API_URL` is correct
- Check backend CORS settings allow Vercel domain
- Verify backend is running

### Environment Variables Not Working
- Ensure frontend variables start with `VITE_`
- Redeploy after adding variables
- Check variable names match exactly

## Next Steps

1. **Custom Domain** (Optional):
   - Add domain in Vercel project settings
   - Update DNS records
   - Update `VITE_FRONTEND_URL` environment variable

2. **Monitoring** (Optional):
   - Set up Vercel Analytics
   - Configure error tracking
   - Set up uptime monitoring

3. **CI/CD**:
   - Automatic deployments on push to `main`
   - Preview deployments for other branches
   - Configure branch protection in GitHub

## Support

- Vercel Docs: https://vercel.com/docs
- Vite Deployment: https://vitejs.dev/guide/static-deploy.html#vercel
- Railway Docs: https://docs.railway.app
