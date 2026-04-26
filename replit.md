# GritSync - NCLEX Processing Agency

### Overview
GritSync is a comprehensive SaaS application designed to streamline the NCLEX application process for Filipino nurses aspiring to work in the US. It aims to be the leading platform for NCLEX processing, offering features such as quotation generation, real-time application tracking, secure payment processing, and an integrated NCLEX review platform. The project's ambition is to empower nurses by simplifying their journey to international careers.

### User Preferences
*   I prefer detailed explanations.
*   I want iterative development.
*   Ask before making major changes.
*   Do not make changes to folder `node_modules`.
*   Do not make changes to file `package-lock.json`.

### System Architecture
The application is built with a React 18 frontend (TypeScript, Vite) and an Express.js backend, communicating via a `/api` proxy. Data persistence is handled by PostgreSQL. Authentication is managed via custom JWT, and payments are integrated using Stripe. File storage is handled within the PostgreSQL database in a `file_storage` table. The UI adopts Tailwind CSS and Lucide Icons for a responsive and modern design.

A key architectural decision is the frontend's Supabase compatibility layer (`src/lib/supabase.ts`), which translates Supabase SDK calls into direct API requests to the Express backend, allowing the frontend to leverage existing Supabase-oriented code.

The NCLEX review platform features distinct layouts for general review and exam modes, offering various test modes (Tutorial, Timed, CAT, Readiness) and question types (traditional MCQ, NGN SATA, NGN Cloze, NGN Matrix). Subscription tiers (Free, Premium, VIP) unlock different levels of access to questions, video libraries, cheat sheets, and live lectures.

Public-facing pages like Home, About Us, Career Listing, Sponsorship Landing, Donate, Tracking, and Quote have been redesigned with cinematic hero sections using AI-generated images for an enhanced user experience. All EAD (Employment Authorization Document) functionalities have been removed to focus solely on NCLEX processing.

### External Dependencies
*   **Database**: Replit PostgreSQL (accessed via `DATABASE_URL`)
*   **Authentication**: `bcryptjs`, `jsonwebtoken`
*   **Payments**: Stripe (Client SDK)
*   **Email Service**: Resend API (`RESEND_API_KEY`)
*   **UI Framework**: Tailwind CSS
*   **Icons**: Lucide Icons