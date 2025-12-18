# GritSync - NCLEX Processing Agency

## Overview
GritSync is a comprehensive SaaS application designed to streamline the NCLEX application process. It offers features for quotation generation, application tracking, and payment processing for aspiring nurses, particularly focusing on assisting Filipino nurses with their US nursing career aspirations. The platform aims to provide a robust, scalable, and secure solution for managing the entire application lifecycle, from initial inquiry to successful placement.

## User Preferences
I prefer clear and concise explanations.
I value an iterative development approach.
Please ask for confirmation before implementing significant changes.
I expect detailed explanations for complex solutions or architectural decisions.
Do not make changes to files within the `docs/` folder.

## System Architecture
GritSync uses a full-stack architecture with React frontend and Express.js backend, powered by Replit's built-in PostgreSQL database.

**UI/UX Decisions:**
- **Design System:** Tailwind CSS for utility-first styling and Lucide Icons for iconography
- **Theming:** Light/dark theme support
- **Responsiveness:** Fully responsive design across all pages
- **Branding:** "Achieve Your American Dream" theme for Filipino nurses

**Technical Implementations:**
- **Authentication:** JWT-based auth with bcrypt password hashing (server/routes/auth.ts)
- **Database:** Replit PostgreSQL with Drizzle ORM (shared/schema.ts)
- **API Layer:** Express.js REST API (server/index.ts, server/routes/)
- **Frontend:** React 18 + TypeScript + Vite (src/)
- **API Client:** Typed fetch wrapper (src/lib/api-client.ts)
- **Payment Processing:** Stripe client SDK with promo code validation

**System Design:**
- **Backend:** Express.js server running on port 3001
- **Frontend:** Vite dev server on port 5000 with proxy to backend
- **Database:** Replit PostgreSQL (DATABASE_URL environment variable)
- **State Management:** React Context with API client
- **Sessions:** express-session with connect-pg-simple store

## Project Structure
- `/server` - Express.js backend (routes, middleware, db connection)
- `/shared` - Shared types and Drizzle schema
- `/src` - React frontend application
- `/src/lib` - API clients, utilities, settings

## External Dependencies
- **Replit PostgreSQL:** Built-in database with Drizzle ORM
- **Stripe:** Client SDK for payment processing
- **Resend:** Email service (pending implementation)

## Migration Status (Dec 2024)
**Migration from Supabase to Replit PostgreSQL completed.** All Supabase dependencies have been removed.

Core functionality working:
- Authentication (signup, login, JWT sessions)
- Applications, Payments, Notifications, Quotations, Donations, Careers, Testimonials
- Settings management
- Promo code validation
- Services catalog API with admin configuration
- Timeline steps API (application tracking with proper authorization)
- Partner agencies API
- NCLEX sponsorships API

Integrations:
- Email service via Resend integration (server/services/email.ts, server/routes/emails.ts)
- File storage via Google Drive integration (server/services/file-storage.ts, server/routes/documents.ts)