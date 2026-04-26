# GritSync - NCLEX Processing Agency

## Project Overview
GritSync is a comprehensive SAAS application for processing NCLEX applications with quotation generation, application tracking, and payment processing. This project was imported from GitHub and configured to run in the Replit environment.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Serverless (Supabase)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Stripe (Client SDK)
- **File Storage**: Supabase Storage
- **UI**: Tailwind CSS + Lucide Icons

## Current State
The application is running successfully on Replit with the following configuration:
- Development server running on port 5000 (required for Replit webview)
- Vite configured for Replit's proxy environment
- All dependencies installed
- Deployment configuration set for static site deployment

## Required Environment Variables

This application requires the following environment variables to be set in the Secrets tab:

### Supabase Configuration (Required)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Get these values from your Supabase project dashboard:
1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Navigate to Settings > API
4. Copy the Project URL and anon/public key

### Stripe Configuration (Optional - for payments)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

Get this from your Stripe dashboard at [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)

## Setup Instructions

### 1. Set Environment Variables
1. Click on the "Secrets" tab in the left sidebar
2. Add the required environment variables listed above
3. The app will automatically use these values

### 2. Database Setup
You need to set up your Supabase database with the required schema:
1. Go to your Supabase project's SQL Editor
2. Run the SQL files from `supabase/schema.sql` to create the database structure
3. Run migrations from `supabase/migrations/` in order
4. Set up Row Level Security (RLS) policies as defined in the migrations

### 3. Create First Admin User
After registering through the app:
1. Go to Supabase Dashboard → Authentication → Users
2. Find your user and edit their metadata
3. Add `role: "admin"` to the user metadata

Or use the SQL Editor:
```sql
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{role}', 
  '"admin"'
)
WHERE email = 'your-email@example.com';
```

## Project Structure
```
gritsync/
├── src/
│   ├── components/      # React components
│   │   └── ui/         # Reusable UI components
│   ├── pages/          # Page components
│   ├── lib/            # Utilities and API clients
│   ├── contexts/       # React contexts (Auth, Theme)
│   └── test/           # Test files
├── supabase/
│   ├── migrations/     # Database migrations
│   ├── functions/      # Edge functions
│   └── schema.sql      # Database schema
├── public/             # Static assets
└── docs/               # Documentation

```

## Key Features
- User Authentication with role-based access control
- Password reset functionality
- NCLEX application form with complete field validation
- Real-time application tracking
- Quotation generation and management
- Stripe payment integration
- Document management with secure file uploads
- Admin dashboard with settings and client management
- Real-time notifications
- Search and filter functionality
- Light/dark theme support
- Fully responsive design

## Development

### Running the App
The app runs automatically via the "Start application" workflow. If you need to restart:
1. Use the "Restart" button in the workflow panel, or
2. Run `npm run dev` manually

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests with Vitest
- `npm run type-check` - Check TypeScript types

## Deployment

The app is configured for static site deployment on Replit. When you're ready to deploy:

1. Ensure all environment variables are set in production environment
2. Click the "Deploy" button in Replit
3. The build will automatically run `npm run build`
4. The `dist` folder will be served as static files

### Vercel Deployment (Alternative)
The project also includes Vercel configuration (`vercel.json`):
1. Push to GitHub
2. Import to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## Recent Changes (Replit Setup)

### Configuration Updates
- Updated `vite.config.ts` to use port 5000 (required for Replit webview)
- Configured Vite server to bind to `0.0.0.0` for external access
- Added `allowedHosts: true` to allow Replit's proxy domains
- Set up deployment configuration for static site builds

### Dependencies
- All npm packages installed successfully
- LSP diagnostics resolved after npm install

## Troubleshooting

### Blank Page on Load
If you see a blank page, check:
1. Environment variables are set correctly in Secrets
2. Supabase URL is valid and accessible
3. Browser console for specific errors

### Database Connection Issues
Ensure:
1. Supabase project is active
2. RLS policies are configured correctly
3. Database migrations have been run

### Payment Processing Issues
Verify:
1. Stripe publishable key is set
2. Using test keys for development (pk_test_...)
3. Stripe account is properly configured

## Architecture Notes

The application uses a fully serverless architecture:
- **Frontend**: React SPA served as static files
- **Backend**: Supabase handles auth, database, storage, and realtime
- **API**: Direct Supabase client calls (no Express server)
- **Payments**: Stripe client SDK
- **File Storage**: Supabase Storage buckets with RLS

This architecture makes the app highly scalable and cost-effective, with no server maintenance required.

## Support

For issues specific to:
- **Replit setup**: Check this documentation or ask in Replit
- **Application features**: See README.md and docs folder
- **Supabase**: Check [Supabase documentation](https://supabase.com/docs)
- **Stripe**: Check [Stripe documentation](https://stripe.com/docs)

## Last Updated
December 5, 2025 - Initial Replit setup completed
