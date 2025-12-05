# 🚀 Quick Start: Production Deployment

A quick reference guide for deploying GritSync to production.

## ⚡ Quick Commands

```bash
# 1. Validate and build
npm run deploy:check

# 2. Test locally
npm run build:prod
npm run start

# 3. Deploy with Docker
npm run docker:build
npm run docker:run

# 4. Or deploy directly
npm run start
```

## 📋 Pre-Deployment Checklist

### Environment Variables
- [ ] `JWT_SECRET` - Secure random string (min 32 chars)
- [ ] `VITE_SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `STRIPE_SECRET_KEY` - Stripe **live** key (starts with `sk_live_`)
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe **live** key (starts with `pk_live_`)
- [ ] `FRONTEND_URL` - Production frontend URL
- [ ] `VITE_API_URL` - Production API URL (optional)
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (recommended)

### Generate JWT Secret
```bash
# Generate secure JWT secret
openssl rand -base64 32
```

### Verify Stripe Keys
- ✅ Using **live** keys (not test keys)
- ✅ Keys start with `sk_live_` and `pk_live_`

## 🔧 Deployment Steps

### Option 1: Docker (Recommended)

```bash
# 1. Create .env.production file with all variables
cp .env.example .env.production
# Edit .env.production with production values

# 2. Build Docker image
npm run docker:build

# 3. Start container
npm run docker:run

# 4. Check status
docker-compose ps
docker-compose logs -f
```

### Option 2: Direct Node.js

```bash
# 1. Set environment variables
export NODE_ENV=production
# ... set other variables

# 2. Build application
npm run build:prod

# 3. Start server
npm run start
```

### Option 3: PM2 (Process Manager)

```bash
# 1. Install PM2
npm install -g pm2

# 2. Build application
npm run build:prod

# 3. Start with PM2
pm2 start server/index.js --name gritsync --env production

# 4. Save PM2 configuration
pm2 save
pm2 startup
```

## ✅ Post-Deployment Verification

```bash
# 1. Check health
curl https://your-api-domain.com/health

# 2. Check readiness
curl https://your-api-domain.com/ready

# 3. Test compression
curl -H "Accept-Encoding: gzip" -v https://your-api-domain.com/health

# 4. Check security headers
curl -I https://your-api-domain.com/
```

## 📊 Monitoring

### Health Endpoints
- `GET /health` - Health check with metrics
- `GET /ready` - Readiness check

### Key Metrics to Monitor
- Response times (should be < 500ms)
- Error rates (should be < 1%)
- Memory usage (should be < 80%)
- Slow requests (>1s)

## 🆘 Quick Troubleshooting

### Server won't start
```bash
# Check environment variables
npm run deploy:check

# Check logs
docker-compose logs -f
```

### Health check fails
```bash
# Check if services are running
curl http://localhost:3001/health

# Check database connection
# Check Stripe configuration
```

### High memory usage
```bash
# Check memory metrics
curl http://localhost:3001/health | jq .memory

# Restart container if needed
docker-compose restart
```

## 📚 Full Documentation

- **Testing Guide**: [TESTING_PRODUCTION.md](./TESTING_PRODUCTION.md)
- **Optimizations**: [PRODUCTION_OPTIMIZATIONS.md](./PRODUCTION_OPTIMIZATIONS.md)
- **Deployment Guide**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Production Checklist**: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)

## 🎯 Next Steps

1. ✅ **Test Locally**: Run `npm run start` and test all endpoints
2. ✅ **Deploy to Staging**: Test in staging environment
3. ✅ **Monitor**: Watch logs and metrics
4. ✅ **Deploy to Production**: Deploy when ready
5. ✅ **Set Up Alerts**: Configure monitoring alerts

---

**Need help?** Check the [Troubleshooting](./TESTING_PRODUCTION.md#-troubleshooting) section!
