# Supabase Migration Guide

This document outlines the migration from Express.js + SQLite to Supabase for GritSync.

## Overview

The application has been fully migrated to use Supabase for:
- **Authentication**: Supabase Auth (replaces JWT)
- **Database**: PostgreSQL via Supabase (replaces SQLite)
- **Storage**: Supabase Storage (replaces local file system)
- **Realtime**: Supabase Realtime subscriptions
- **Edge Functions**: Serverless functions for Stripe integration

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key from Settings > API

### 2. Environment Variables

Update your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

For Edge Functions (server-side), you'll also need:
```env
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Setup

1. Open the SQL Editor in your Supabase dashboard
2. Copy and paste the contents of `supabase/schema.sql`
3. Execute the SQL script
4. This will create all tables, RLS policies, triggers, and indexes

### 4. Storage Setup

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `documents`
3. Set it to **Private** (not public)
4. The storage policies are already set up in the schema

### 5. Edge Functions Setup

Deploy the Edge Functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
```

Set environment variables for Edge Functions:
```bash
supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
supabase secrets set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 6. Create First Admin User

1. Sign up through the app (will be created as 'client' by default)
2. Go to Supabase Dashboard > Authentication > Users
3. Find your user and note the user ID
4. Go to SQL Editor and run:
```sql
UPDATE users SET role = 'admin' WHERE id = 'your-user-id-here';
```

## Key Changes

### Authentication

**Before:**
```typescript
import { authAPI } from '@/lib/api'
await authAPI.login(email, password)
```

**After:**
```typescript
import { useAuth } from '@/contexts/AuthContext'
const { signIn } = useAuth()
await signIn(email, password)
```

### Database Queries

**Before:**
```typescript
import { applicationsAPI } from '@/lib/api'
const apps = await applicationsAPI.getAll()
```

**After:**
```typescript
import { applicationsAPI } from '@/lib/api' // Still works!
// Or directly:
import { supabase } from '@/lib/supabase'
const { data } = await supabase.from('applications').select('*')
```

### File Uploads

**Before:**
```typescript
import { userDocumentsAPI } from '@/lib/api'
await userDocumentsAPI.upload('picture', file)
```

**After:**
```typescript
import { userDocumentsAPI } from '@/lib/api' // Still works!
// Files are now stored in Supabase Storage
```

### Realtime Subscriptions

**New Feature:**
```typescript
import { subscribeToNotifications } from '@/lib/realtime'

const channel = subscribeToNotifications(userId, (payload) => {
  console.log('New notification:', payload.new)
})
```

## API Compatibility

The existing API layer (`src/lib/api.ts`) has been updated to use Supabase under the hood, so most existing code will continue to work without changes. However, authentication methods should be migrated to use `AuthContext` instead of `authAPI`.

## Benefits of Supabase

1. **No Backend Server Needed**: Everything runs client-side with Supabase
2. **Automatic Scaling**: Supabase handles scaling automatically
3. **Real-time Updates**: Built-in real-time subscriptions
4. **Row Level Security**: Database-level security policies
5. **Built-in Auth**: Email, OAuth, magic links, etc.
6. **Storage**: Built-in file storage with CDN
7. **Edge Functions**: Serverless functions for server-side operations

## Migration Checklist

- [x] Install Supabase client library
- [x] Create Supabase client configuration
- [x] Update database schema
- [x] Migrate AuthContext to Supabase Auth
- [x] Replace API layer with Supabase client
- [x] Migrate file uploads to Supabase Storage
- [x] Add Realtime subscriptions
- [x] Create Edge Functions for Stripe
- [ ] Update all components to use new AuthContext
- [ ] Test all functionality
- [ ] Deploy to production

## Troubleshooting

### Authentication Issues
- Ensure Supabase URL and keys are correct
- Check that RLS policies are enabled
- Verify user role in the database

### File Upload Issues
- Check storage bucket exists and is named `documents`
- Verify storage policies are set correctly
- Ensure file size is under 5MB (or adjust bucket limits)

### Realtime Not Working
- Ensure Realtime is enabled in Supabase dashboard
- Check that you're subscribed to the correct channels
- Verify RLS policies allow the user to see the data

### Edge Functions Not Working
- Check function logs in Supabase dashboard
- Verify environment variables are set correctly
- Ensure function is deployed and active

## Next Steps

1. Test all functionality thoroughly
2. Update any remaining components that use old auth methods
3. Set up production Supabase project
4. Configure custom domain (optional)
5. Set up monitoring and alerts
6. Migrate existing data from SQLite (if needed)

## Data Migration

If you have existing data in SQLite, you'll need to:

1. Export data from SQLite
2. Transform data to match Supabase schema
3. Import into Supabase using the SQL Editor or Supabase CLI

Example migration script:
```sql
-- Copy users (excluding passwords - handled by Supabase Auth)
INSERT INTO users (id, email, role, full_name, created_at)
SELECT id, email, role, full_name, created_at
FROM old_users;

-- Copy applications
INSERT INTO applications (...)
SELECT ... FROM old_applications;
```

## Support

For issues or questions:
- Supabase Documentation: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Project Issues: Create an issue in the repository

