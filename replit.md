# GritSync - NCLEX Processing Agency

### Overview
GritSync is a comprehensive SaaS application designed to streamline the NCLEX application process for Filipino nurses seeking to work in the US. It offers an end-to-end solution from initial application to NCLEX preparation, including features such as quotation generation, real-time application tracking, secure payment processing, and an integrated NCLEX review platform. The project aims to be the leading platform in its niche, enhancing efficiency and user experience for nurses pursuing international careers.

### User Preferences
*   I prefer detailed explanations.
*   I want iterative development.
*   Ask before making major changes.
*   Do not make changes to folder `node_modules`.
*   Do not make changes to file `package-lock.json`.

### System Architecture
#### Technical Stack
The application is built with a React 18 frontend (TypeScript, Vite) and an Express.js backend, communicating via a `/api` proxy.
*   **Frontend**: React 18, TypeScript, Vite
*   **Backend**: Express.js
*   **Database**: Replit PostgreSQL (accessed via `DATABASE_URL`)
*   **Authentication**: Custom JWT (`bcryptjs`, `jsonwebtoken`)
*   **Payments**: Stripe (Client SDK)
*   **File Storage**: PostgreSQL `file_storage` table
*   **Email Service**: Resend API (`RESEND_API_KEY`)
*   **UI Framework**: Tailwind CSS
*   **Icons**: Lucide Icons

#### Core Architecture
The system is divided into a React-based frontend and an Express.js backend. A key architectural decision is the frontend's Supabase compatibility layer (`src/lib/supabase.ts`), which translates Supabase SDK calls into direct API requests to the Express backend, allowing the frontend to leverage existing Supabase-oriented code and knowledge while using a custom backend. The system is entirely focused on NCLEX processing, with all EAD (Employment Authorization Document) functionalities removed.

#### Backend Structure
*   `server/index.ts`: Entry point for the Express application.
*   `server/db.ts`: Handles PostgreSQL database connections.
*   `server/middleware/auth.ts`: JWT authentication middleware.
*   `server/routes/auth.ts`: Manages user authentication (login, registration, password reset).
*   `server/routes/query.ts`: Provides generic CRUD operations for database tables.
*   `server/routes/emails.ts`: Manages email-related routes.
*   `server/routes/questions.ts`: Manages question-related API for the NCLEX review platform.

#### NCLEX Review Platform
The NCLEX review platform features distinct layouts for general review and exam modes (using `src/layouts/NCLEXLayout.tsx` for a consistent dark navy sidebar UI), offering various test modes (Tutorial, Timed, CAT, Readiness) and question types (traditional MCQ, NGN SATA, NGN Cloze, NGN Matrix).
*   **Subscription Tiers**: Free (limited questions), Premium (unlimited questions, video library, cheat sheets), VIP (all premium features plus live lectures).
*   **Exam Modes**: Tutorial (instant explanations), Timed (explanation after completion), CAT (adaptive difficulty), Readiness (full simulation).
*   **Question Types**: Traditional MCQ, NGN SATA, NGN Cloze, NGN Matrix.
*   **NGN Case Study Clusters**: Questions linked to shared clinical scenarios.
*   **Admin Features**: Allows administrators to manage user subscriptions, assign plans, and view analytics.
*   **Payment Submission Flow**: Users can submit GCash/Maya payment proof (reference number, notes, screenshot) from the Order History page. Submissions appear in the admin "Pending Approvals" tab with approve/reject actions. Approving instantly activates the user's subscription plan.

#### UI/UX Decisions
Public-facing pages feature redesigned cinematic hero sections with AI-generated images to enhance user experience. The NCLEX review platform utilizes a dark navy and teal color scheme for a focused study environment. Hero images are stored in `public/assets/pages/`. All EAD functionalities have been removed to maintain a strict focus on NCLEX processing.

#### Email System
Transactional emails (verification, welcome, password reset) are sent via the Resend API to the user's `personal_email`. An `email_logs` table tracks system-generated emails. The system includes custom OTP-based password reset flows.

#### Database Schema Notes
Key tables include `applications`, `application_payments`, `user_details`, and `users`. Specific constraints and relationships are enforced, such as `applicant_name`, `email`, `service_type` being `NOT NULL` in the `applications` table. The `users` table holds primary user information, while `user_details` stores supplementary data. The `nclex_subscriptions` table manages user subscription plans and statuses.

### External Dependencies
*   **PostgreSQL**: Primary database.
*   **Stripe**: Payment processing.
*   **Resend API**: Transactional email service.
*   **Vite**: Frontend build tool.
*   **Express.js**: Backend web framework.
*   **React**: Frontend library.
*   **TypeScript**: Programming language.
*   **Tailwind CSS**: UI styling.
*   **Lucide Icons**: Icon library.
*   **bcryptjs**: For password hashing.
*   **jsonwebtoken**: For JWT authentication.
*   **pg**: PostgreSQL client for Node.js.
*   **tsx**: For running TypeScript files directly.
*   **concurrently**: For running multiple npm scripts concurrently.
