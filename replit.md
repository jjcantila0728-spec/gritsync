# GritSync - NCLEX Processing Agency

### Overview
GritSync is a comprehensive SaaS application designed to streamline the NCLEX application process for Filipino nurses aspiring to work in the US. It aims to be the leading platform for NCLEX processing, offering features such as quotation generation, real-time application tracking, secure payment processing, and an integrated NCLEX review platform. The project aims to provide an end-to-end solution for nurses, from initial application to NCLEX preparation, enhancing efficiency and user experience.

### User Preferences
*   I prefer detailed explanations.
*   I want iterative development.
*   Ask before making major changes.
*   Do not make changes to folder \`node_modules\`.
*   Do not make changes to file \`package-lock.json\`.

### System Architecture

#### Technical Stack
The application is built with a React 18 frontend (TypeScript, Vite) and an Express.js backend, communicating via a \`/api\` proxy.
*   **Frontend**: React 18, TypeScript, Vite
*   **Backend**: Express.js
*   **Database**: Replit PostgreSQL (accessed via \`DATABASE_URL\`)
*   **Authentication**: Custom JWT (\`bcryptjs\`, \`jsonwebtoken\`)
*   **Payments**: Stripe (Client SDK)
*   **File Storage**: PostgreSQL \`file_storage\` table
*   **Email Service**: Resend API (\`RESEND_API_KEY\`)
*   **UI Framework**: Tailwind CSS
*   **Icons**: Lucide Icons

#### Core Architecture
The system is divided into a React-based frontend and an Express.js backend. A key architectural decision is the frontend's Supabase compatibility layer (\`src/lib/supabase.ts\`), which translates Supabase SDK calls into direct API requests to the Express backend, allowing the frontend to leverage existing Supabase-oriented code and knowledge while using a custom backend.

#### Backend Structure
*   \`server/index.ts\`: Entry point for the Express application.
*   \`server/db.ts\`: Handles PostgreSQL database connections.
*   \`server/middleware/auth.ts\`: JWT authentication middleware.
*   \`server/routes/auth.ts\`: Manages user authentication (login, registration, password reset).
*   \`server/routes/query.ts\`: Provides generic CRUD operations for database tables.

#### NCLEX Review Platform
The NCLEX review platform features distinct layouts for general review and exam modes (using \`src/layouts/NCLEXLayout.tsx\` for a consistent dark navy sidebar UI), offering various test modes (Tutorial, Timed, CAT, Readiness) and question types (traditional MCQ, NGN SATA, NGN Cloze, NGN Matrix).
*   **Subscription Tiers**: Free (limited questions), Premium (unlimited questions, video library, cheat sheets), VIP (all premium features plus live lectures).
*   **Exam Modes**: Tutorial (instant explanations), Timed (explanation after completion), CAT (adaptive difficulty), Readiness (full simulation).
*   **Question Types**: Traditional MCQ, NGN SATA, NGN Cloze, NGN Matrix.
*   **Admin Features**: Allows administrators to manage user subscriptions, assign plans, and view analytics.
*   **Payment Submission Flow**: Users can submit GCash/Maya payment proof (reference number, notes) from the Order History page. Submissions appear in the admin "Pending Approvals" tab with approve/reject actions. Approving instantly activates the user's subscription plan.

#### Email System
Transactional emails are sent via the Resend API. The system handles various email types including verification, welcome, and password reset emails. An \`email_logs\` table tracks system-generated emails.

#### Database Schema Notes
*   \`applications\` table: Requires \`applicant_name\`, \`email\`, \`service_type\` on insert.
*   \`application_payments\` table: Lacks \`user_id\` (requires JOIN with \`applications\`) and \`service_fee_amount\`.
*   \`user_details\` table: Excludes \`first_name\`, \`last_name\`, \`email\` (these are in the \`users\` table).
*   \`users\` table: Contains \`first_name\`, \`last_name\`, \`middle_name\`, \`mobile\` (unique), \`grit_id\`, \`gritsync_email\`, \`personal_email\`.

#### UI/UX Decisions
Public-facing pages like Home, About Us, Career Listing, Sponsorship Landing, Donate, Tracking, and Quote have been redesigned with cinematic hero sections using AI-generated images for an enhanced user experience. The NCLEX review platform has a distinct dark navy and teal color scheme for a focused study environment. All EAD (Employment Authorization Document) functionalities have been removed to focus solely on NCLEX processing.

### External Dependencies
*   **PostgreSQL**: Primary database for all application data, including file storage.
*   **Stripe**: Used for processing payments.
*   **Resend API**: Employed for sending transactional emails.
*   **Vite**: Frontend build tool.
*   **Express.js**: Backend web framework.
*   **React**: Frontend library.
*   **TypeScript**: Programming language for both frontend and backend.
*   **Tailwind CSS**: Utility-first CSS framework for styling.
*   **Lucide Icons**: Icon library.
*   **bcryptjs**: For password hashing.
*   **jsonwebtoken**: For JWT authentication.
*   **pg**: PostgreSQL client for Node.js.
*   **tsx**: For running TypeScript files directly.
*   **concurrently**: For running multiple npm scripts concurrently.

### Running the App
\`npm run dev\` uses \`concurrently\` to start both:
1. Vite dev server (port 5000) with \`/api\` proxy to port 3001
2. Express backend via \`tsx watch server/index.ts\` (port 3001)

## Admin Credentials (Development)
- Email: \`admin@gritsync.com\`
- Password: \`admin123\`

## Required Environment Variables
- \`DATABASE_URL\` — Replit PostgreSQL connection string (auto-provided)
- \`JWT_SECRET\` — JWT signing secret (defaults to \`gritsync-jwt-secret-key-2024\`)
- \`VITE_STRIPE_PUBLISHABLE_KEY\` — Stripe publishable key (optional, for payments)
- \`SERVER_PORT\` — API server port (defaults to 3001)
- \`RESEND_API_KEY\` — Resend email service API key (for transactional emails)
- \`APP_URL\` — Production app URL (defaults to \`https://gritsync.com\`)

## Email System (Additional Details)
- Emails sent via Resend API (\`RESEND_API_KEY\` env secret or \`settings\` table \`resendApiKey\`)
- From address: \`no-reply@gritsync.com\` / \`JJ Cantila at GritSync <no-reply@gritsync.com>\`
- **ALL transactional emails go to \`personal_email\`** (user's real email), never to \`gritsync_email\`
- \`server/routes/auth.ts\` — Contains \`sendVerificationEmail()\`, \`sendWelcomeEmail()\`, \`sendPasswordResetEmail()\` inline HTML functions
- \`src/lib/email-templates.ts\` — Frontend email template system with many template functions
- Welcome email is sent automatically after email verification, attributed to JJ Cantila (Founder)
- Admin backfill endpoint: \`POST /api/auth/backfill-welcome-emails\` — sends welcome emails to existing verified clients who haven't received one
- \`users.welcome_email_sent_at\` — timestamp column tracking when welcome email was sent
- Client inbox (\`/client/emails/inbox\`) shows BOTH: Resend received emails + GritSync system emails from \`email_logs\` (\`GET /api/emails/my-received\`)

## Password Reset Flow (Custom OTP — Fixed)
1. \`POST /api/auth/reset-password-request\` — finds user by \`personal_email\` OR \`gritsync_email\`, generates crypto token + 6-digit OTP, stores in \`password_reset_tokens\` table, sends HTML email to \`personal_email\`
2. \`POST /api/auth/verify-reset-otp\` — verifies the 6-digit OTP (15 min expiry), returns the reset token
3. \`POST /api/auth/reset-password\` — accepts token + new password, hashes and saves, marks token as used
- \`password_reset_tokens\` table has columns: \`id, user_id, token, expires_at, used, otp, otp_expires_at, created_at\`
- Frontend: \`ForgotPassword.tsx\` (step 1: email input → step 2: OTP entry with 6-digit boxes), \`ResetPassword.tsx\` (token-based, no Supabase dependency)
- \`AuthContext.requestPasswordReset()\` — calls the request endpoint
- \`AuthContext.resetPassword(token, password)\` — calls the reset endpoint

## Project Structure
\`\`\`
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
\`\`\`

### Critical Column Constraints
- \`applications\` table: \`applicant_name NOT NULL\`, \`email NOT NULL\`, \`service_type NOT NULL\` — always inject these on INSERT (\`applicationsAPI.create()\` handles this)
- \`application_payments\` table: **has NO \`user_id\` column** — to get user_id, JOIN with \`applications\` via \`application_id\`. Also has NO \`service_fee_amount\` column.
- \`user_details\` table: **has NO \`first_name\`, \`last_name\`, or \`email\` columns** — those live in the \`users\` table
- \`users\` table: \`first_name\`, \`last_name\`, \`middle_name\`, \`mobile\` (UNIQUE), \`grit_id\`, \`avatar_path\`, \`default_avatar_design\`, \`gritsync_email\`, \`personal_email\`
- Auth token stored as \`gritsync_token\` in \`localStorage\` (NOT \`'token'\`)

### API Client (\`src/lib/api-client.ts\`)
Exported as \`db\` (not \`supabase\`). Supports \`.from(table)\`, \`.select()\`, \`.insert()\`, \`.update()\`, \`.upsert()\`, \`.delete()\`, \`.eq()\`, \`.neq()\`, \`.in(col, vals[])\`, \`.maybeSingle()\`, \`.single()\`. No JOIN support — multi-table queries must go through \`server/routes/\` raw SQL.

## Key Features
- User Authentication with role-based access control (admin / client)
- NCLEX application form with complete field validation
- Real-time application tracking
- Quotation generation and management
- Stripe payment integration (GCash, mobile banking, card)
- Document management with server-side storage (\`server/routes/storage.ts\`, \`uploads/\` dir, multer)
- Admin dashboard with client management
- Search and filter functionality
- Light/dark theme support
- Fully responsive design

## NCLEX Review Platform (\`/nclex-review\`) — ArcherReview-style
Full standalone review platform with dark navy sidebar, matching ArcherReview's UX.

### Create Test Modal (Multi-step)
**Step 1**: Mode (Tutorial/CAT/Timed/Readiness) + Test Type (Classic/NGN/Mixed)
**Step 2**: Content Area, Question Pool (Unused/Incorrect/All/**Case Studies**), Test Length

### NGN Case Study Clusters
Questions can be linked to a shared clinical scenario via \`case_study_id\`. When a session includes case study questions, the exam interface shows a collapsible "Clinical Scenario" panel above the question displaying the full patient scenario text (vitals, labs, history). Each case study cluster has 6 questions using varied NGN question types.

**Seeded case study sets** (via \`POST /api/questions/seed-case-studies\`):
1. Post-CABG Patient with Excessive Chest Tube Drainage (cardiac surgery hemorrhage management)
2. Older Adult with Septic Shock from Urinary Source (sepsis bundle, MODS, ARDS)
3. Pediatric Patient with Status Asthmaticus (bronchospasm, magnesium sulfate, respiratory failure)

### API Routes (in \`server/routes/questions.ts\`)
- \`GET /api/questions/payment-info\` — Public GCash/Maya payment details
- \`GET /api/questions/user-stats\` — Usage/accuracy statistics for the donut charts
- \`POST /api/questions/session/start\` — Create session with mode/test_type/pool params; pool accepts \`unused|incorrect|all|case_studies\`
- \`GET /api/questions/session/:id/questions\` — Full session question list with responses (includes \`case_study_id\`, \`case_study_title\`, \`case_study_scenario\`)
- \`POST /api/questions/session/:id/answer\` — Submit answer, get correctness + rationale
- \`POST /api/questions/session/:id/mark-review\` — Flag question for later review
- \`POST /api/questions/session/:id/end\` — Early session termination
- \`GET /api/questions/session/:id/results\` — Full results with breakdown
- \`GET /api/questions/my-sessions\` — All sessions list (supports ?status=all)
- \`POST /api/questions/seed\` — Admin-only: seed 25+ NCLEX sample questions
- \`POST /api/questions/seed-case-studies\` — Admin-only: seed 3 NGN case study sets (18 questions total)
- Admin routes: \`/subscription/admin/users\`, \`/subscription/admin/assign\`, \`/subscription/admin/cancel\`, \`/subscription/admin/analytics\`

### Subscription DB Tables
- \`nclex_subscriptions\` — user_id, plan (free/premium/vip), status, expires_at, payment fields
- \`nclex_daily_usage\` — user_id, usage_date, questions_answered (daily tracking)
- \`session_responses\` — has \`marked_for_review\` column (added at runtime via ALTER TABLE IF NOT EXISTS)
- \`case_studies\` — id, title, scenario (full clinical scenario text), content_area, difficulty (added at runtime)
- \`question_bank\` — has \`case_study_id\` FK column referencing \`case_studies\` (nullable, added at runtime)

### Question Seeding
Admin users see "Seed Questions" and "Seed Case Studies" buttons. \`POST /api/questions/seed\` inserts 25+ NCLEX-style standalone questions. \`POST /api/questions/seed-case-studies\` inserts 3 full case study sets (6 questions each = 18 questions total) linked to clinical scenarios via \`case_study_id\`.

## Admin NCLEX Subscriptions (\`/admin/nclex-subscriptions\`)
Admin page at \`src/pages/AdminNCLEXSubscriptions.tsx\`:
- Summary stats (free/premium/vip user counts, questions today)
- Daily usage bar chart (last 30 days)
- User table with plan, expiry, usage info and search/filter
- Assign/upgrade modal with plan, payment method, amount, and reference fields

## Email System (Backend)
- \`server/routes/emails.ts\` with \`POST /api/emails/send\` calling Resend API (\`RESEND_API_KEY\` secret)
- \`src/lib/email-service.ts\` calls \`/api/emails/send\` directly (not Supabase functions)
- \`src/pages/ClientEmails.tsx\` filters inbox by both GritSync address AND user's real email

## Page Redesigns (Completed)
All public-facing pages have been redesigned with dark cinematic hero sections using AI-generated images:
- \`src/pages/Home.tsx\` — Quick Stats bar, features grid, dashboard preview (browser mockup), 8-step NCLEX timeline, testimonials, CTA
- \`src/pages/AboutUs.tsx\` — Hero with \`about-hero.png\`, count-up stats strip, mission + Grit+Sync naming sections, values grid, team cards, trust strip, CTA
- \`src/pages/CareerListing.tsx\` — Hero with \`career-hero.png\`, perks strip, animated job listings, open-application CTA
- \`src/pages/SponsorshipLanding.tsx\` — Hero with \`sponsorship-hero.png\`, benefits grid, eligibility/process sections, CTA
- \`src/pages/Donate.tsx\` — Hero with \`donate-hero.png\` (image overlay on dark background), existing form/payment flow preserved intact
- \`src/pages/Tracking.tsx\` — Public hero with \`tracking-hero.png\`, tracking form below; authenticated view unchanged
- \`src/pages/Quote.tsx\` — Hero with \`quote-hero.png\`, wizard unchanged; improved non-logged-in empty state

Hero images are all stored in \`public/assets/pages/\` and served at \`/assets/pages/*.png\`.

## EAD Removal (Completed)
All EAD (Employment Authorization Document) routes, UI, and references have been removed. The platform is now NCLEX-only:
- Removed EAD routes from \`App.tsx\`
- Removed EAD timeline block from \`ApplicationDetail.tsx\`
- Updated type definitions to NCLEX-only
- Cleaned up \`PromoCodeSettings\`, \`ServiceSettings\`, \`ApplicationCheckout\`, \`AdminApplicationPayments\`
- Updated \`DetailsTab\` to NCLEX-only tabs

## Development Scripts
- \`npm run dev\` — Start Vite frontend + Express backend concurrently
- \`npm run server\` — Start only the Express backend
- \`npm run build\` — Build frontend for production
- \`npm run lint\` — Run ESLint
- \`npm run test\` — Run tests with Vitest

## Create First Admin User
To promote a user to admin:
\`\`\`sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
\`\`\`
