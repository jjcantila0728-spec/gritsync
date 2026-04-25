# GritSync - NCLEX Processing Agency

## Project Overview
GritSync is a comprehensive SaaS application for processing NCLEX applications for Filipino nurses pursuing US nursing careers. Features include quotation generation, application tracking, and payment processing.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Express.js API server (port 3001, proxied via Vite `/api`)
- **Database**: Replit PostgreSQL (accessed via `DATABASE_URL` env var)
- **Authentication**: Custom JWT (bcryptjs + jsonwebtoken)
- **Payments**: Stripe (Client SDK)
- **File Storage**: PostgreSQL `file_storage` table (persistent, survives deployments) via `/api/storage/*` routes
- **UI**: Tailwind CSS + Lucide Icons

## Architecture

### Backend (`server/`)
- `server/index.ts` — Express app entry, mounts all routes
- `server/db.ts` — PostgreSQL connection pool via `pg`
- `server/middleware/auth.ts` — JWT verification middleware
- `server/routes/auth.ts` — `/api/auth/*` (login, register, logout, refresh, update, me)
- `server/routes/query.ts` — `/api/db/:table` (GET/POST/PATCH/DELETE generic CRUD)

### Frontend Supabase Compatibility Layer (`src/lib/supabase.ts`)
The entire frontend was originally built against `@supabase/supabase-js`. It has been migrated to use a local compatibility shim at `src/lib/supabase.ts` that:
- Translates `.from(table).select(...)` chains into `GET /api/db/:table` requests
- Translates `.insert()`, `.update()`, `.delete()` into POST/PATCH/DELETE requests
- Implements all `supabase.auth.*` methods using JWT stored in `localStorage`
- Stubs `supabase.storage`, `supabase.channel()`, and `supabase.rpc()`

The `@supabase/supabase-js` package is aliased in `vite.config.ts` to `src/lib/supabase-compat.ts` which provides only TypeScript type definitions (no actual Supabase SDK is used).

### Running the App
`npm run dev` uses `concurrently` to start both:
1. Vite dev server (port 5000) with `/api` proxy to port 3001
2. Express backend via `tsx watch server/index.ts` (port 3001)

## Admin Credentials (Development)
- Email: `admin@gritsync.com`
- Password: `admin123`

## Required Environment Variables
- `DATABASE_URL` — Replit PostgreSQL connection string (auto-provided)
- `JWT_SECRET` — JWT signing secret (defaults to `gritsync-jwt-secret-key-2024`)
- `VITE_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (optional, for payments)
- `SERVER_PORT` — API server port (defaults to 3001)

## Project Structure
```
gritsync/
├── server/              # Express backend
│   ├── index.ts         # App entry point
│   ├── db.ts            # PostgreSQL pool
│   ├── middleware/
│   │   └── auth.ts      # JWT middleware
│   └── routes/
│       ├── auth.ts      # Auth endpoints
│       └── query.ts     # Generic DB CRUD
├── src/
│   ├── lib/
│   │   ├── supabase.ts          # Supabase compat shim → calls /api/*
│   │   ├── supabase-compat.ts   # Type-only shim for @supabase/supabase-js alias
│   │   ├── supabase-api.ts      # Higher-level API wrappers
│   │   └── ...
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth state management
│   ├── components/      # Shared UI components
│   ├── pages/           # Route-level page components
│   └── ...
├── vite.config.ts       # Vite config with /api proxy + @supabase alias
└── package.json         # scripts: dev, build, server
```

## Database Schema Notes (Important for Queries)
The PostgreSQL database has specific column names that differ from common naming conventions:
- `service_required_documents`: use `document_name` (not `name`) for ordering/selection
- `user_documents`: columns are `filename`, `storage_path`, `created_at` (original) PLUS added `file_name`, `file_path`, `uploaded_at` (aliases for compatibility)
- `email_addresses`: has `user_id` FK, `is_system_address`, `department`, `forward_to_email`, `auto_reply_enabled`, `auto_reply_message`, `notes`, `metadata`, `verified_at`
- `email_signatures`: full table exists with user_id, signature_html, signature_type, logo fields etc.
- `business_logos`: full table for company logo management
- Allowed query tables (server/routes/query.ts): includes `email_signatures` and `business_logos`

### Critical Column Constraints
- `applications` table: `applicant_name NOT NULL`, `email NOT NULL`, `service_type NOT NULL` — always inject these on INSERT (`applicationsAPI.create()` handles this)
- `application_payments` table: **has NO `user_id` column** — to get user_id, JOIN with `applications` via `application_id`. Also has NO `service_fee_amount` column.
- `user_details` table: **has NO `first_name`, `last_name`, or `email` columns** — those live in the `users` table
- `users` table: `first_name`, `last_name`, `middle_name`, `mobile` (UNIQUE), `grit_id`, `avatar_path`, `default_avatar_design`, `gritsync_email`, `personal_email`
- Auth token stored as `gritsync_token` in `localStorage` (NOT `'token'`)

### API Client (`src/lib/api-client.ts`)
Exported as `db` (not `supabase`). Supports `.from(table)`, `.select()`, `.insert()`, `.update()`, `.upsert()`, `.delete()`, `.eq()`, `.neq()`, `.in(col, vals[])`, `.maybeSingle()`, `.single()`. No JOIN support — multi-table queries must go through `server/routes/` raw SQL.

## Key Features
- User Authentication with role-based access control (admin / client)
- NCLEX application form with complete field validation
- Real-time application tracking
- Quotation generation and management
- Stripe payment integration (GCash, mobile banking, card)
- Document management with server-side storage (`server/routes/storage.ts`, `uploads/` dir, multer)
- Admin dashboard with client management
- Search and filter functionality
- Light/dark theme support
- Fully responsive design

## NCLEX Review Platform (`/nclex-review`)
A standalone review platform (separate from the main app layout) with subscription tiers:
- **Free**: 25 questions/day with daily usage tracking (`nclex_daily_usage` table)
- **Premium**: 250 PHP/2 months, 250 questions/day
- **VIP**: 500 PHP/6 months, unlimited questions

### Review Modes
- **Practice Test**: filterable by content area, difficulty, question type; configurable count; immediate or end feedback
- **Readiness Assessment**: 75-question simulated NCLEX exam
- **CAT Mode**: Computer Adaptive Testing that adjusts difficulty

### Question Types Supported
- Traditional MCQ, NGN SATA (select all that apply), NGN Cloze (dropdown fill-in), NGN Matrix/Grid

### Layout
`src/layouts/NCLEXLayout.tsx` — standalone header with GritSync home button, plan badge, theme toggle, user info. No main app sidebar.

### API Routes (in `server/routes/questions.ts`)
- `POST /api/questions/session/start` — create session, returns all questions
- `POST /api/questions/session/:id/answer` — submit answer, get correctness + rationale
- `GET /api/questions/session/:id/results` — full results with content area breakdown
- `GET /api/questions/my-sessions` — recent sessions list
- `GET /api/questions/subscription/me` — current user's plan + daily usage
- `POST /api/questions/subscription/track-usage` — increment daily usage counter
- Admin routes: `/subscription/admin/users`, `/subscription/admin/assign`, `/subscription/admin/cancel`, `/subscription/admin/analytics`

### Subscription DB Tables
- `nclex_subscriptions` — user_id, plan (free/premium/vip), status, expires_at, payment fields
- `nclex_daily_usage` — user_id, usage_date, questions_answered (daily tracking)

## Admin NCLEX Subscriptions (`/admin/nclex-subscriptions`)
Admin page at `src/pages/AdminNCLEXSubscriptions.tsx`:
- Summary stats (free/premium/vip user counts, questions today)
- Daily usage bar chart (last 30 days)
- User table with plan, expiry, usage info and search/filter
- Assign/upgrade modal with plan, payment method, amount, and reference fields

## Email System
- `server/routes/emails.ts` with `POST /api/emails/send` calling Resend API (`RESEND_API_KEY` secret)
- `src/lib/email-service.ts` calls `/api/emails/send` directly (not Supabase functions)
- `src/pages/ClientEmails.tsx` filters inbox by both GritSync address AND user's real email

## Page Redesigns (Completed)
All public-facing pages have been redesigned with dark cinematic hero sections using AI-generated images:
- `src/pages/Home.tsx` — Quick Stats bar, features grid, dashboard preview (browser mockup), 8-step NCLEX timeline, testimonials, CTA
- `src/pages/AboutUs.tsx` — Hero with `about-hero.png`, count-up stats strip, mission + Grit+Sync naming sections, values grid, team cards, trust strip, CTA
- `src/pages/CareerListing.tsx` — Hero with `career-hero.png`, perks strip, animated job listings, open-application CTA
- `src/pages/SponsorshipLanding.tsx` — Hero with `sponsorship-hero.png`, benefits grid, eligibility/process sections, CTA
- `src/pages/Donate.tsx` — Hero with `donate-hero.png` (image overlay on dark background), existing form/payment flow preserved intact
- `src/pages/Tracking.tsx` — Public hero with `tracking-hero.png`, tracking form below; authenticated view unchanged
- `src/pages/Quote.tsx` — Hero with `quote-hero.png`, wizard unchanged; improved non-logged-in empty state

Hero images are all stored in `public/assets/pages/` and served at `/assets/pages/*.png`.

## EAD Removal (Completed)
All EAD (Employment Authorization Document) routes, UI, and references have been removed. The platform is now NCLEX-only:
- Removed EAD routes from `App.tsx`
- Removed EAD timeline block from `ApplicationDetail.tsx`
- Updated type definitions to NCLEX-only
- Cleaned up `PromoCodeSettings`, `ServiceSettings`, `ApplicationCheckout`, `AdminApplicationPayments`
- Updated `DetailsTab` to NCLEX-only tabs

## Development Scripts
- `npm run dev` — Start Vite frontend + Express backend concurrently
- `npm run server` — Start only the Express backend
- `npm run build` — Build frontend for production
- `npm run lint` — Run ESLint
- `npm run test` — Run tests with Vitest

## Create First Admin User
To promote a user to admin:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```
