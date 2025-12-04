# Production Deployment Checklist

Use this checklist before deploying GritSync to production.

## 🔐 Security

- [ ] **JWT_SECRET**: Changed from default to secure random string
  ```bash
  openssl rand -base64 32
  ```

- [ ] **Environment Variables**: All sensitive variables set in production environment
  - [ ] `JWT_SECRET` - Secure random string (NOT the default)
  - [ ] `STRIPE_SECRET_KEY` - Production Stripe key (starts with `sk_live_`)
  - [ ] `VITE_STRIPE_PUBLISHABLE_KEY` - Production Stripe key (starts with `pk_live_`)
  - [ ] `FRONTEND_URL` - Production frontend URL
  - [ ] `VITE_API_URL` - Production API URL
  - [ ] `VITE_SUPABASE_URL` - Supabase project URL
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
  - [ ] `VITE_SUPABASE_ANON_KEY` - Supabase anon key

- [ ] **CORS Configuration**: Verified to allow only production domain
  - Check `server/index.js` - CORS is configured automatically based on `FRONTEND_URL`

- [ ] **HTTPS**: SSL certificate installed and configured

- [ ] **Rate Limiting**: Enabled (automatic in production)

- [ ] **Security Headers**: Enabled (automatic in production)

- [ ] **Test Routes**: Disabled in production (automatic)

## 🗄️ Database

- [ ] **Database Backup**: Automated backup system configured in Supabase

- [ ] **Database Performance**: Indexes verified for frequently queried fields

- [ ] **Connection Pooling**: Supabase handles this automatically

## 🚀 Deployment

- [ ] **Frontend Built**: Production build completed
  ```bash
  npm run build:prod
  ```

- [ ] **Backend Ready**: Server code is production-ready

- [ ] **Environment Variables**: All environment variables set in production platform

- [ ] **Domain Configuration**: DNS records configured correctly

- [ ] **SSL Certificate**: Valid SSL certificate installed

## ✅ Functionality Testing

### Authentication
- [ ] User registration works
- [ ] User login works
- [ ] Password reset flow works
- [ ] Password change works
- [ ] Logout works

### Application Flow
- [ ] Create new application
- [ ] Upload documents
- [ ] View application details
- [ ] Track application status
- [ ] Admin can update status

### Payments
- [ ] Create payment
- [ ] Complete payment with Stripe (test with test cards first!)
- [ ] View payment receipts
- [ ] Payment history displays correctly
- [ ] Webhooks are configured and working

### Admin Features
- [ ] Admin can view all applications
- [ ] Admin can view all clients
- [ ] Admin can create quotations
- [ ] Admin settings save correctly

### Notifications
- [ ] Notifications display correctly
- [ ] Mark as read works
- [ ] Notification count updates

## 📊 Performance

- [ ] **Build Size**: Check bundle sizes are reasonable
  ```bash
  npm run build:prod
  # Check dist folder sizes
  ```

- [ ] **Health Checks**: Verify endpoints work
  ```bash
  curl https://api.yourdomain.com/health
  curl https://api.yourdomain.com/ready
  ```

- [ ] **API Response Times**: Monitor API response times
  - [ ] Average response time < 500ms
  - [ ] 95th percentile < 1s

## 🔍 Monitoring & Logging

- [ ] **Error Tracking**: Error tracking service configured (optional: Sentry, etc.)

- [ ] **Logging**: Application logs configured and monitored

- [ ] **Uptime Monitoring**: Uptime monitoring service set up (optional)

- [ ] **Performance Monitoring**: APM tool configured (optional)

## 📱 Browser Testing

- [ ] **Chrome**: Tested and working
- [ ] **Firefox**: Tested and working
- [ ] **Safari**: Tested and working
- [ ] **Edge**: Tested and working
- [ ] **Mobile Safari**: Tested and working
- [ ] **Mobile Chrome**: Tested and working

## 🧪 Pre-Production Testing

- [ ] **Manual Testing**: All critical paths tested manually

- [ ] **Stripe Test Mode**: Tested payment flow with test cards

- [ ] **Error Scenarios**: Tested error handling

## 📚 Documentation

- [ ] **API Documentation**: API endpoints documented (if needed)

- [ ] **Deployment Guide**: `PRODUCTION_README.md` reviewed

## 🔄 Post-Deployment

- [ ] **Monitor Logs**: Check logs for errors after deployment

- [ ] **Test Critical Paths**: Test main user flows after deployment

- [ ] **Verify Database**: Check database is working correctly

- [ ] **Check File Uploads**: Verify file uploads work

- [ ] **Test Payments**: Test payment flow with test cards first, then real cards

- [ ] **Monitor Performance**: Monitor application performance

- [ ] **Verify Health Checks**: Confirm `/health` and `/ready` endpoints work

## 🎯 Success Criteria

Your deployment is successful when:

- ✅ All security checks pass
- ✅ All functionality tests pass
- ✅ Health checks return 200
- ✅ No critical errors in logs
- ✅ Users can complete main workflows
- ✅ Payments process correctly
- ✅ Admin features work correctly
- ✅ Rate limiting is working
- ✅ CORS is properly configured

## 🆘 Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**: Revert to previous version
2. **Investigate**: Check logs and error tracking
3. **Fix Issues**: Address critical issues
4. **Test Fixes**: Test fixes in staging environment
5. **Redeploy**: Deploy fixes when ready

## 📞 Support

If you encounter issues:

1. Check application logs
2. Check error tracking service (if configured)
3. Review `PRODUCTION_README.md`
4. Check environment variables
5. Verify database connectivity (Supabase dashboard)
6. Test API endpoints directly
7. Check Stripe dashboard for webhook issues

---

**Good luck with your deployment!** 🚀
