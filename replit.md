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

The application uses a **100% serverless architecture** powered by Supabase:

### Core Services (Supabase)
- **Authentication**: Supabase Auth with role-based access control
- **Database**: PostgreSQL with Row Level Security (RLS)
- **File Storage**: Supabase Storage buckets with RLS policies
- **Real-time**: Supabase Realtime for live updates
- **Edge Functions**: Serverless functions for email sending, PDF generation
- **Email Service**: Resend integration via Supabase Edge Functions

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Hosting**: Static deployment (Replit or any CDN)
- **State**: React Context + Supabase real-time subscriptions

### External Integrations
- **Payments**: Stripe (client-side SDK)
- **Email**: Resend (via Supabase Edge Functions)

### Data Flow
1. All data operations go through Supabase client SDK
2. RLS policies enforce security at the database level
3. Edge Functions handle server-side operations (emails, PDFs)
4. No traditional backend server required

This architecture provides:
- Automatic scaling with no server management
- Built-in security with RLS policies
- Cost-effective (pay only for what you use)
- Global edge distribution for low latency

## Support

For issues specific to:
- **Replit setup**: Check this documentation or ask in Replit
- **Application features**: See README.md and docs folder
- **Supabase**: Check [Supabase documentation](https://supabase.com/docs)
- **Stripe**: Check [Stripe documentation](https://stripe.com/docs)

## Technical Debt Notes
- database.types.ts needs regeneration from Supabase when access is available
- Some API methods use temporary `as any` type assertions pending type regeneration
- Run `npx supabase gen types typescript --project-id <project-id>` to regenerate types

## Homepage Enhancement (December 18, 2025)
- Added HeroSlider component with 4 AI-generated Filipino nurse images
- Slider features auto-play (5 second intervals), navigation arrows, and dot indicators
- Theme: "Achieve Your American Dream" - helping Filipino nurses pursue US nursing careers
- Added NCLEX Processing (primary) and EAD Applications (secondary) focus sections
- GritSync Perks section: Personalized Business Mail, Full Client Database, Dedicated Document Cloud Storage
- New @assets alias for image imports from attached_assets folder
- SPA routing fixed with public/_redirects file for static deployment

## USCIS Tracker & Visa Bulletin (December 18, 2025)
- New USCISTracker page accessible via Explore menu (/uscis-tracker)
- USCIS Case Status Tracker: Enter receipt numbers (EAC, WAC, LIN, SRC, MSC, IOE prefixes) to check status
- Philippines EB3 Visa Bulletin tracker with Final Action Date and Dates for Filing
- Save/track multiple cases with localStorage
- Receipt number format validation (13 characters: 3 letters + 10 digits)
- Processing center identification by prefix

## Banner Images on Public Pages (December 18, 2025)
- Generated AI images for page banners:
  - immigration_office_professional_scene.png
  - filipino_nurse_studying_nclex.png
  - professional_office_building_exterior.png
  - healthcare_team_professionals.png
- Added banner backgrounds to: About Us, Donate, Career Listing, Sponsorship Landing
- Gradient overlays for text readability

## SEO Optimization (December 18, 2025)
- AI-targeted keywords for Filipino nurse audience
- Enhanced meta titles/descriptions on all public pages
- Keywords include: NCLEX processing Philippines, USRN application, EB3 visa bulletin, CGFNS, VisaScreen
- Structured data for organization, services, FAQ, breadcrumbs
- Open Graph and Twitter Card meta tags

## Dashboard Onboarding Tutorial (December 18, 2025)
- Created DashboardOnboarding component with 9-step animated tutorial
- Steps: Welcome, Stats Overview, Quick Actions, Sidebar Navigation, Applications, Documents, Activity Feed, Notifications, Completion
- Custom CSS animations: fadeIn, slideUp, slideLeft, slideRight, zoomIn, bounceIn, float, spotlight
- Spotlight/highlight effect that visually points to dashboard elements being explained
- Progress bar showing tutorial completion status
- LocalStorage tracking (gritsync_dashboard_onboarding_completed) to show only to first-time users
- Skip option available at any step
- Moved onboarding from Home page to Dashboard for contextual learning

## Newsletter & Visa Bulletin Email Integration (December 18, 2025)
- **Supabase-backed Newsletter Subscriptions**: Replaced localStorage with Supabase database
  - Tables: `newsletter_subscriptions`, `visa_bulletin_cache`, `visa_bulletin_email_log`
  - RLS policies: Anonymous users can subscribe, admins can manage all
  - Migration: `supabase/migrations/add-newsletter-subscriptions-table.sql`
- **Email Integration with Resend**: 
  - Created `createVisaBulletinUpdateEmail` template in `email-templates.ts`
  - Added `sendVisaBulletinUpdateEmail` and `sendVisaBulletinToAllSubscribers` functions
  - Template includes NCLEX/EAD marketing content
- **Subscription Form**: Email subscription form on USCIS Tracker page
- **Email Configuration**: Uses existing Resend setup in `/admin/settings/notifications`

### Future Enhancements (Not Yet Implemented)
- Backend automation for detecting visa bulletin changes
- Scheduled job to scrape DOS visa bulletin and trigger emails
- Edge Function for secure bulk email sending

## Success Stories Page (December 18, 2025)
- **New Success Stories page** accessible via Explore menu (/success-stories)
- **20 Filipino testimonials** with authentic Tagalog-English mixed language (Taglish)
  - Real Filipino names and locations (e.g., "Manila to California")
  - Service types: NCLEX Processing, EAD Processing, NCLEX + EAD Processing
- **AI-generated Filipino profile pictures** (20 images in attached_assets/generated_images/)
  - Various healthcare professional attire (scrubs, medical coats)
  - Professional headshot style on white backgrounds
- **Testimonial submission form** with:
  - Profile photo upload to Supabase Storage (public-assets bucket)
  - Form fields: name, email, location journey, service type, testimony
  - Proper error handling - surfaces failures to users with appropriate messages
- **Database integration**:
  - Migration: `supabase/migrations/add-testimonials-table.sql`
  - RLS policies: Anonymous/authenticated users can submit (pending status), admins manage all
  - Table includes: status (pending/approved/rejected), featured flag, approval tracking
- **Home page footer** now uses shared Footer component instead of inline footer
- Added to Header.tsx Explore menu navigation

## Visa Bulletin Update & Banner Images Fix (December 18, 2025)
- **Real Visa Bulletin Data**: Updated to December 2025 U.S. State Department data
  - Philippines EB3 Final Action Date: **April 15, 2023**
  - Philippines EB3 Dates for Filing: **October 01, 2024**
- **Banner Images Fixed**: Moved images from attached_assets to public folder
  - Fixed image paths across 7 pages: AboutUs, USCISTracker, CareerListing, Donate, SponsorshipLanding, Quote, Tracking
  - Images now properly served as static assets

## Last Updated
December 18, 2025 - Updated visa bulletin with real State Department data, fixed banner images on public pages
