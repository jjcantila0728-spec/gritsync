# GritSync - NCLEX Processing Agency

## Overview
GritSync is a comprehensive SaaS application designed to streamline the NCLEX application process. It offers features for quotation generation, application tracking, and payment processing for aspiring nurses, particularly focusing on assisting Filipino nurses with their US nursing career aspirations. The platform aims to provide a robust, scalable, and secure solution for managing the entire application lifecycle, from initial inquiry to successful placement.

## User Preferences
I prefer clear and concise explanations.
I value an iterative development approach.
Please ask for confirmation before implementing significant changes.
I expect detailed explanations for complex solutions or architectural decisions.
Do not make changes to files within the `docs/` folder.
Do not make changes to files within the `supabase/functions/` folder.

## System Architecture
GritSync employs a 100% serverless architecture leveraging Supabase as its core backend. The frontend is built with React 18, TypeScript, and Vite, using Tailwind CSS and Lucide Icons for UI.

**UI/UX Decisions:**
- **Design System:** Utilizes Tailwind CSS for utility-first styling and Lucide Icons for iconography.
- **Theming:** Supports light/dark themes.
- **Responsiveness:** Fully responsive design across all pages.
- **Branding:** Consistent visual branding with AI-generated imagery for authentication pages, banners, and homepage sliders, focusing on the "Achieve Your American Dream" theme for Filipino nurses.
- **User Onboarding:** Features an animated, 9-step dashboard onboarding tutorial with spotlight effects for first-time users.
- **Accessibility:** Enhanced meta titles/descriptions and Open Graph/Twitter Card tags for SEO.

**Technical Implementations & Feature Specifications:**
- **Authentication:** Supabase Auth with role-based access control (e.g., admin role).
- **NCLEX Application:** Comprehensive form with validation, real-time tracking, quotation generation, and management.
- **Payment Processing:** Integrated Stripe client SDK for secure payments.
- **Document Management:** Secure file uploads and storage using Supabase Storage with RLS.
- **Admin Dashboard:** Centralized management for clients, settings, and content (e.g., testimonials).
- **Notifications:** Real-time notification system.
- **Search & Filter:** Functionality for various data points.
- **USCIS Tracking:** USCIS Case Status Tracker with receipt number validation and a Philippines EB3 Visa Bulletin tracker (Final Action Date and Dates for Filing).
- **Newsletter & Visa Bulletin Subscriptions:** Supabase-backed subscription management with email integration via Resend.
- **Success Stories:** Dedicated page showcasing testimonials with AI-generated profile pictures and a submission form (moderated by admins).
- **Terms of Service & Privacy Policy:** Dedicated pages with professional hero banners and navigation.

**System Design Choices:**
- **Serverless Backend:** Supabase handles authentication, PostgreSQL database with Row Level Security (RLS), file storage, and real-time functionalities.
- **Edge Functions:** Supabase Edge Functions are used for server-side operations like email sending and PDF generation, integrating with services like Resend.
- **Frontend Hosting:** Static site deployment (Replit or Vercel).
- **State Management:** React Context combined with Supabase real-time subscriptions.
- **Data Flow:** All data operations are managed through the Supabase client SDK, with RLS enforcing security at the database level.

## External Dependencies
- **Supabase:**
    - Supabase Auth (Authentication)
    - PostgreSQL (Database)
    - Supabase Storage (File Storage)
    - Supabase Realtime (Real-time updates)
    - Supabase Edge Functions (Serverless functions)
- **Stripe:** Client SDK for payment processing.
- **Resend:** Email service integrated via Supabase Edge Functions for sending transactional and marketing emails.