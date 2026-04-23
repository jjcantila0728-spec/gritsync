# Production Deployment Guide

This guide will help you prepare and deploy GritSync to production.

## 🚀 Pre-Deployment Checklist

### 1. Environment Variables

1. Copy `.env.production.example` to `.env.production`
2. Fill in all required values:
   ```bash
   cp .env.production.example .env.production
   ```

3. **Critical Variables:**
   - `JWT_SECRET`: Generate a secure random string
     ```bash
     openssl rand -base64 32
     ```
   - `STRIPE_SECRET_KEY`: Use your **live** Stripe key (starts with `sk_live_`)
   - `VITE_STRIPE_PUBLISHABLE_KEY`: Use your **live** Stripe key (starts with `pk_live_`)
   - `FRONTEND_URL`: Your production frontend URL
   - `VITE_API_URL`: Your production API URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

### 2. Build the Application

```bash
# Build frontend for production
npm run build:prod

# The build output will be in the `dist` directory
```

### 3. Test the Production Build Locally

```bash
# Start production server
npm run start

# Or test with preview
npm run preview
```

### 4. Security Checklist

- ✅ **JWT_SECRET**: Changed from default
- ✅ **Stripe Keys**: Using live keys (not test keys)
- ✅ **CORS**: Configured for production domain only
- ✅ **Security Headers**: Enabled
- ✅ **Rate Limiting**: Enabled
- ✅ **Test Routes**: Disabled in production
- ✅ **Error Messages**: Sanitized for production

## 📦 Deployment Options

### Option 1: Separate Frontend & Backend

#### Frontend (Vercel/Netlify)
1. Connect your repository
2. Set build command: `npm run build:prod`
3. Set output directory: `dist`
4. Add environment variables (prefixed with `VITE_`)

#### Backend (Railway/Render/Heroku)
1. Set start command: `npm run start`
2. Add all environment variables
3. Ensure `NODE_ENV=production` is set

### Option 2: Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build:prod

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend and server
COPY --from=builder /app/dist ./dist
COPY server ./server

# Set production environment
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server/index.js"]
```

### Option 3: PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server/index.js --name gritsync --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## 🔍 Health Checks

The application includes health check endpoints:

- **Health Check**: `GET /health`
  - Returns basic health status
  - Use for basic monitoring

- **Readiness Check**: `GET /ready`
  - Checks critical services (database, Stripe)
  - Returns 503 if services are unavailable
  - Use for Kubernetes/Docker readiness probes

## 📊 Monitoring

### Logs

Production logs are automatically configured:
- Request logging for all API calls
- Slow request warnings (>1s)
- Error logging with stack traces (development only)

### Metrics to Monitor

1. **Response Times**: Monitor `/health` endpoint
2. **Error Rates**: Check application logs
3. **Rate Limit Hits**: Monitor 429 responses
4. **Database Connections**: Monitor Supabase dashboard
5. **Stripe Webhooks**: Monitor webhook delivery

## 🔐 Security Features

### Enabled in Production

1. **Security Headers**:
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block
   - Content-Security-Policy
   - Strict-Transport-Security (HTTPS only)

2. **Rate Limiting**:
   - API routes: 100 requests per 15 minutes
   - Auth routes: 5 requests per 15 minutes
   - IP-based limiting

3. **CORS**: Restricted to production domain only

4. **Error Handling**: Sensitive information hidden in production

## 🧪 Post-Deployment Testing

1. **Health Checks**:
   ```bash
   curl https://api.yourdomain.com/health
   curl https://api.yourdomain.com/ready
   ```

2. **Authentication**:
   - Test user registration
   - Test user login
   - Test password reset

3. **API Endpoints**:
   - Test all critical endpoints
   - Verify CORS is working
   - Check rate limiting

4. **Payments**:
   - Test with Stripe test cards first
   - Verify webhook delivery
   - Check payment processing

## 🐛 Troubleshooting

### Common Issues

**Issue**: CORS errors
- **Solution**: Verify `FRONTEND_URL` matches your frontend domain exactly

**Issue**: Rate limit errors
- **Solution**: Check if you're hitting rate limits, adjust limits if needed

**Issue**: Stripe errors
- **Solution**: Verify you're using live keys, not test keys

**Issue**: Database connection errors
- **Solution**: Check Supabase credentials and network access

**Issue**: Build fails
- **Solution**: Run `npm run type-check` to find TypeScript errors

## 📝 Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Server port (default: 3001) |
| `FRONTEND_URL` | Yes | Production frontend URL |
| `VITE_API_URL` | Yes | Production API URL |
| `JWT_SECRET` | Yes | Secure JWT secret |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `STRIPE_SECRET_KEY` | Yes | Stripe live secret key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe live publishable key |
| `STRIPE_WEBHOOK_SECRET` | Recommended | Stripe webhook secret |

## 🎯 Success Criteria

Your deployment is successful when:

- ✅ Health checks return 200
- ✅ All environment variables are set
- ✅ No errors in logs
- ✅ Authentication works
- ✅ Payments process correctly
- ✅ File uploads work
- ✅ Admin features accessible

## 📞 Support

If you encounter issues:

1. Check application logs
2. Verify environment variables
3. Test health endpoints
4. Check Supabase dashboard
5. Review Stripe dashboard for webhook issues

---

**Good luck with your deployment!** 🚀
