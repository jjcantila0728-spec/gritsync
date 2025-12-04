# Final Supabase Setup Checklist

## ✅ Completed Setup

All code has been refactored to use Supabase. Here's what's been done:

### Code Refactoring
- ✅ Authentication migrated to Supabase Auth
- ✅ File storage migrated to Supabase Storage
- ✅ Database operations use Supabase PostgreSQL
- ✅ All API calls use Supabase client
- ✅ File URLs use Supabase Storage signed URLs
- ✅ Edge Functions created for Stripe integration

### Files Updated
- ✅ All authentication pages
- ✅ All file upload/download pages
- ✅ Application management pages
- ✅ API layer completely rewritten

## 🚀 Next Steps to Go Live

### 1. Supabase Project Setup

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create new project
   - Wait for project to be ready (~2 minutes)

2. **Deploy Database Schema**
   - Go to SQL Editor
   - Copy contents of `supabase/schema.sql`
   - Execute the SQL script
   - Verify all tables are created

3. **Create Storage Bucket**
   - Go to Storage
   - Create bucket named `documents`
   - Set to **Private**
   - Policies are auto-created by schema

4. **Get Your Credentials**
   - Go to Settings > API
   - Copy:
     - Project URL
     - `anon` `public` key
     - `service_role` key (for Edge Functions)

### 2. Environment Variables

Create/update your `.env` file:

```env
# Supabase (Required)
VITE_SUPABASE_URL=https://warfdcbvnapietbkpild.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Stripe (Required for payments)
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key

# Optional: Legacy (can be removed)
# VITE_API_URL=http://localhost:3001/api
```

### 3. Deploy Edge Functions (For Stripe)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref warfdcbvnapietbkpild

# Deploy functions
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook

# Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://warfdcbvnapietbkpild.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook secret to Edge Function secrets

### 5. Create First Admin User

1. Sign up through the app (creates as 'client')
2. Go to Supabase Dashboard > Authentication > Users
3. Find your user and copy the user ID
4. Go to SQL Editor and run:
   ```sql
   UPDATE users SET role = 'admin' WHERE id = 'your-user-id-here';
   ```

### 6. Test Everything

1. **Test Connections**
   - Visit `/test-supabase` page
   - Verify all tests pass

2. **Test Authentication**
   - Register new user
   - Login
   - Password reset
   - Password change

3. **Test File Operations**
   - Upload documents
   - View files
   - Download files

4. **Test Application Flow**
   - Create application
   - Upload files
   - View application details
   - Test admin functions

5. **Test Payments** (if configured)
   - Create quotation
   - Process payment
   - Verify webhook

### 7. Migrate Existing Data (If Applicable)

If you have existing SQLite data:
- See `DATA_MIGRATION_GUIDE.md` for detailed instructions
- Export data from SQLite
- Transform and import to Supabase
- Upload files to Supabase Storage

### 8. Production Deployment

1. **Update Environment Variables**
   - Use production Supabase project
   - Use production Stripe keys
   - Remove development URLs

2. **Deploy Frontend**
   - Deploy to Vercel/Netlify
   - Set environment variables in deployment platform
   - Test production deployment

3. **Enable Realtime** (Optional)
   - Go to Supabase Dashboard > Database > Replication
   - Enable replication for tables you want real-time updates

4. **Set Up Monitoring**
   - Enable Supabase logs
   - Set up error tracking (Sentry, etc.)
   - Monitor Edge Function logs

## 🔒 Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Storage bucket is private
- [ ] Service role key is secure (never expose)
- [ ] Anon key is safe for client-side use
- [ ] Stripe keys are production keys
- [ ] Webhook secret is configured
- [ ] CORS is properly configured

## 📊 Performance Optimization

- [ ] Database indexes created (already in schema)
- [ ] Storage CDN enabled (automatic with Supabase)
- [ ] Image optimization (consider adding)
- [ ] Query optimization (monitor slow queries)

## 🐛 Troubleshooting

### Common Issues

**Issue**: "Missing Supabase environment variables"
- **Fix**: Check `.env` file has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

**Issue**: "RLS policy violation"
- **Fix**: Check user role in database, verify RLS policies

**Issue**: "File not found"
- **Fix**: Verify file exists in Supabase Storage, check file path format

**Issue**: "Edge Function error"
- **Fix**: Check Edge Function logs, verify secrets are set

**Issue**: "Payment intent creation fails"
- **Fix**: Verify Stripe keys, check Edge Function is deployed

## 📚 Documentation

- `SUPABASE_MIGRATION.md` - Migration guide
- `SUPABASE_REFACTORING_SUMMARY.md` - What was changed
- `DATA_MIGRATION_GUIDE.md` - SQLite to Supabase migration
- `SETUP.md` - Updated setup instructions

## ✨ You're Ready!

Your application is now fully integrated with Supabase. The Express server is no longer needed - everything runs through Supabase's client-side APIs with automatic scaling, real-time updates, and built-in security.

Happy coding! 🚀

