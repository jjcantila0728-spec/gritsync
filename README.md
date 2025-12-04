# GritSync - NCLEX Processing Agency

A comprehensive SAAS application for processing NCLEX applications with quotation generation, application tracking, and payment processing.

## Features

- **User Authentication**: Role-based access control (Client & Admin)
- **Password Reset**: Secure token-based password reset functionality
- **NCLEX Application Processing**: Complete application form with all required fields
- **Application Tracking**: Real-time status tracking for applications
- **Quotation Generator**: Generate and manage service quotations
- **Payment Processing**: Stripe integration for secure payments
- **Document Management**: Secure file uploads and storage
- **Admin Dashboard**: Complete admin panel with settings and client management
- **Notifications System**: Real-time notifications for application updates
- **Search & Filter**: Advanced search and filtering for applications
- **Theme Support**: Light and dark mode
- **Responsive Design**: Mobile-first, fully responsive UI
- **Error Handling**: Comprehensive error boundaries and validation

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Database**: SQLite (temporary, can be migrated to Supabase)
- **Authentication**: JWT-based authentication
- **Payments**: Stripe
- **File Storage**: Local file system (server/uploads)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3001/api
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
JWT_SECRET=your-secret-key-change-in-production
PORT=3001
```

### 3. Run Development Servers

Run both frontend and backend:

```bash
npm run dev:all
```

Or run separately:

```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev
```

### 4. Create First Admin User

After registering through the app, you can make a user admin by:

1. Opening the SQLite database: `gritsync.db`
2. Running: `UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com'`

Or use a SQLite browser tool.

## Project Structure

```
gritsync/
├── src/              # Frontend React app
├── server/            # Backend Express API
│   └── index.js     # Main server file
├── server/uploads/  # File uploads directory
└── gritsync.db      # SQLite database (auto-created)
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password (authenticated)
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Applications
- `GET /api/applications` - Get all applications (filtered by role)
- `GET /api/applications/:id` - Get application by ID
- `POST /api/applications` - Create new application
- `PATCH /api/applications/:id` - Update application status (admin only)

### Quotations
- `GET /api/quotations` - Get all quotations (filtered by role)
- `POST /api/quotations` - Create new quotation

### Files
- `GET /api/files/:userId/:filename` - Get uploaded file

## Recent Improvements

### MVP Enhancements (Latest)
- ✅ **Admin Settings Page**: Complete settings management interface
- ✅ **Password Reset**: Full password reset flow with secure tokens
- ✅ **Enhanced Validation**: Email, password, and form validation utilities
- ✅ **Error Boundaries**: React error boundaries for graceful error handling
- ✅ **Improved UX**: Better loading states, empty states, and error messages

See [MVP_IMPROVEMENTS.md](./MVP_IMPROVEMENTS.md) and [FINAL_MVP_SUMMARY.md](./FINAL_MVP_SUMMARY.md) for complete details.

## Deployment

For production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick start:
1. Copy `.env.example` to `.env` and configure
2. Set production environment variables
3. Deploy frontend (Vercel recommended)
4. Deploy backend (Railway/Render recommended)
5. Configure CORS and security settings

## Migration to Supabase

The database schema is designed to be easily migrated to Supabase. When ready:

1. Export SQLite data
2. Import to Supabase PostgreSQL
3. Update frontend to use Supabase client
4. Update environment variables

## Documentation

- [SETUP.md](./SETUP.md) - Detailed setup instructions
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) - Stripe integration guide
- [START_SERVER.md](./START_SERVER.md) - Server startup guide
- [MVP_IMPROVEMENTS.md](./MVP_IMPROVEMENTS.md) - MVP improvements summary
- [FINAL_MVP_SUMMARY.md](./FINAL_MVP_SUMMARY.md) - Complete MVP status

## License

MIT
