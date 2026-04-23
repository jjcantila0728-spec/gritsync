# GritSync - NCLEX Processing Agency

## Project Overview
GritSync is a comprehensive SaaS application for processing NCLEX applications for Filipino nurses pursuing US nursing careers. Features include quotation generation, application tracking, and payment processing.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Express.js API server (port 3001, proxied via Vite `/api`)
- **Database**: Replit PostgreSQL (accessed via `DATABASE_URL` env var)
- **Authentication**: Custom JWT (bcryptjs + jsonwebtoken)
- **Payments**: Stripe (Client SDK)
- **File Storage**: Server-side storage routes (`/api/storage/*`)
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

## Key Features
- User Authentication with role-based access control (admin / client)
- NCLEX application form with complete field validation
- Real-time application tracking
- Quotation generation and management
- Stripe payment integration (GCash, mobile banking, card)
- Document management
- Admin dashboard with client management
- Search and filter functionality
- Light/dark theme support
- Fully responsive design

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
