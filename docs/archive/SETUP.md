# GritSync Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### 3. Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Run Database Schema**
   - Open the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase/schema.sql`
   - Execute the SQL script

3. **Create Storage Bucket**
   - Go to Storage in your Supabase dashboard
   - Create a new bucket named `documents`
   - Set it to **Private** (not public)
   - The storage policies are already set up in the schema

4. **Create First Admin User**
   - Sign up through the app (will be created as 'client' by default)
   - Go to Supabase Dashboard > Authentication > Users
   - Find your user and note the user ID
   - Go to SQL Editor and run:
   ```sql
   UPDATE users SET role = 'admin' WHERE id = 'your-user-id-here';
   ```

### 4. Stripe Setup

1. **Create a Stripe Account**
   - Go to [stripe.com](https://stripe.com)
   - Create an account or sign in
   - Get your publishable key and secret key from the dashboard

2. **Set Up Edge Functions for Payments**
   - Install Supabase CLI: `npm install -g supabase`
   - Login: `supabase login`
   - Link project: `supabase link --project-ref your-project-ref`
   - Deploy functions:
     ```bash
     supabase functions deploy create-payment-intent
     supabase functions deploy stripe-webhook
     ```
   - Set secrets:
     ```bash
     supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
     supabase secrets set STRIPE_WEBHOOK_SECRET=your_webhook_secret
     supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     ```
   - Configure webhook in Stripe dashboard pointing to your Edge Function URL

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Features

### Client Features
- ✅ User registration and authentication
- ✅ NCLEX application form with all required fields
- ✅ Document upload (2x2 picture, nursing diploma, passport)
- ✅ Application tracking dashboard
- ✅ Quotation generator
- ✅ Payment processing (Stripe integration)

### Admin Features
- ✅ View all applications
- ✅ Update application status (pending/approved/rejected)
- ✅ View all clients
- ✅ View all quotations
- ✅ Access to all documents

## Database Schema

The application uses PostgreSQL via Supabase with the following main tables:

- **users**: User profiles with role-based access (extends Supabase auth.users)
- **applications**: NCLEX application data with all required fields
- **quotations**: Service quotations with payment tracking
- **application_payments**: Payment records for applications
- **receipts**: Payment receipts
- **notifications**: User notifications with real-time support
- **user_details**: Saved user application details
- **user_documents**: Document metadata
- **services**: Service pricing configurations
- **settings**: Admin settings
- **application_timeline_steps**: Application processing steps
- **processing_accounts**: Account credentials for processing

All tables have Row Level Security (RLS) enabled for secure access control.

## Storage

Documents are stored in Supabase Storage:
- Bucket: `documents`
- Structure: `{user_id}/{document_type}_{timestamp}.{ext}`
- Access: Users can only access their own documents, admins can access all

## Theme

The app features:
- Red primary theme color
- Light and dark mode support
- Fully responsive design
- Mobile-first approach

## Logo

The logo is located at `/public/gritsync_logo.png` and is displayed with:
- Square container with soft rounded edges
- Responsive sizing
- Dark mode support

## Troubleshooting

### Authentication Issues
- Ensure Supabase URL and keys are correct
- Check that RLS policies are enabled
- Verify user role in the database

### File Upload Issues
- Check storage bucket exists and is named `documents`
- Verify storage policies are set correctly
- Ensure file size is under 5MB

### Payment Issues
- Verify Stripe publishable key is correct
- For production, set up Supabase Edge Function for payment intents
- Use Stripe test mode for development

## Features

### Real-time Updates
- Notifications update in real-time using Supabase Realtime
- Application status changes are reflected immediately
- No polling needed - everything is event-driven

### Edge Functions
- **create-payment-intent**: Creates Stripe payment intents securely
- **stripe-webhook**: Handles Stripe webhook events for payment confirmation

### Security
- Row Level Security (RLS) policies protect all data
- Users can only access their own data
- Admins have elevated permissions via RLS policies
- Storage policies restrict file access

## Next Steps

1. Customize branding and colors if needed
2. Set up email templates in Supabase (Auth > Email Templates)
3. Configure Stripe webhooks for payment confirmation
4. Set up production environment variables
5. Deploy to Vercel or your preferred hosting platform
6. Enable Realtime in Supabase dashboard (Database > Replication)
7. Set up monitoring and alerts in Supabase dashboard

## Migration from Express/SQLite

If you're migrating from the old Express.js + SQLite setup, see `SUPABASE_MIGRATION.md` for detailed instructions.

