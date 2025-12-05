# Deployment Checklist - Serverless Migration

Use this checklist to track your deployment progress. Check off each item as you complete it.

---

## 📋 Pre-Deployment Setup

### Prerequisites
- [ ] Supabase CLI installed (`supabase --version`)
- [ ] Logged into Supabase (`supabase login`)
- [ ] Have your Supabase project ref
- [ ] Have your service role key (Supabase Dashboard → Settings → API)
- [ ] Have your frontend URL
- [ ] Have your Stripe keys (if using Stripe)

---

## 🚀 Deployment Steps

### Phase 1: Edge Functions
- [ ] Project linked (`supabase link --project-ref YOUR_PROJECT_REF`)
- [ ] `admin-login-as` function deployed
- [ ] Other functions verified/deployed (if needed)
- [ ] Functions listed (`supabase functions list`)

### Phase 2: Secrets Configuration
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `FRONTEND_URL` set
- [ ] `STRIPE_SECRET_KEY` set (if using Stripe)
- [ ] `STRIPE_WEBHOOK_SECRET` set (if using Stripe)
- [ ] Secrets verified (`supabase secrets list`)

### Phase 3: Environment Variables
- [ ] `.env` file updated (VITE_API_URL removed)
- [ ] Production environment variables updated (Vercel/Netlify/etc.)
- [ ] `VITE_SUPABASE_URL` set in production
- [ ] `VITE_SUPABASE_ANON_KEY` set in production
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` set in production (if using Stripe)

### Phase 4: Stripe Webhook
- [ ] Webhook URL updated in Stripe Dashboard
- [ ] Webhook URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
- [ ] Webhook events selected (`payment_intent.succeeded`, `payment_intent.payment_failed`)
- [ ] Webhook secret copied and set as Edge Function secret

### Phase 5: Frontend Build
- [ ] Frontend builds successfully (`npm run build`)
- [ ] No build errors
- [ ] `dist/` folder created

### Phase 6: Frontend Deployment
- [ ] Frontend deployed to hosting provider
- [ ] Environment variables set in hosting provider
- [ ] Frontend URL accessible

---

## ✅ Post-Deployment Testing

### Authentication
- [ ] User registration works
- [ ] User login works
- [ ] Password reset works
- [ ] Session management works

### Dashboard
- [ ] Dashboard stats load correctly
- [ ] Admin dashboard works
- [ ] Client dashboard works
- [ ] No console errors

### Admin Features
- [ ] Admin can login-as users (tests Edge Function)
- [ ] Admin can view all clients
- [ ] Admin can manage applications
- [ ] Admin features work without errors

### File Operations
- [ ] File uploads work
- [ ] File downloads work
- [ ] Files stored in Supabase Storage
- [ ] No file-related errors

### Payments
- [ ] Stripe payments process correctly
- [ ] Payment webhooks received (check logs)
- [ ] Payment status updates correctly
- [ ] Receipts generated

### Notifications
- [ ] Notifications load
- [ ] Real-time notifications work
- [ ] Email notifications work (if configured)

### CRUD Operations
- [ ] Create applications works
- [ ] Update applications works
- [ ] View applications works
- [ ] Create quotations works
- [ ] Update quotations works

---

## 🔍 Verification

### Edge Function Logs
- [ ] `admin-login-as` logs checked (`supabase functions logs admin-login-as`)
- [ ] `stripe-webhook` logs checked (`supabase functions logs stripe-webhook`)
- [ ] No errors in logs

### Browser Console
- [ ] No console errors
- [ ] No network errors
- [ ] All API calls successful

### Supabase Dashboard
- [ ] Edge Functions show invocations
- [ ] No errors in Edge Functions
- [ ] API usage normal
- [ ] Database queries working

---

## 🎉 Final Steps

- [ ] All features tested and working
- [ ] Monitoring set up
- [ ] Team notified of deployment
- [ ] Documentation updated
- [ ] Express server files removed (optional - after verification)

---

## 📝 Notes

Use this section to track any issues or notes during deployment:

```
Date: ___________
Issues: 
- 

Resolutions:
- 

Next Steps:
- 
```

---

## ✅ Deployment Complete!

Once all items are checked, your application is **100% serverless** and running in production! 🎉
