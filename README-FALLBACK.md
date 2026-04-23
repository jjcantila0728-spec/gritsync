# Local Server Fallback for Supabase

This project includes a local server fallback mechanism that automatically switches to a local Express server with SQLite when Supabase is unavailable.

## Features

- **Automatic Fallback**: Seamlessly switches to local server when Supabase is down
- **Health Checking**: Monitors Supabase availability and caches results
- **SQLite Database**: Uses local SQLite database for offline operation
- **API Compatibility**: Local server mimics Supabase REST API structure

## Setup

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `express` - Web server framework
- `sqlite3` - SQLite database driver
- `cors` - CORS middleware
- `tsx` - TypeScript execution

### 2. Start Local Server

In a separate terminal, start the local fallback server:

```bash
npm run server
```

Or for development with auto-reload:

```bash
npm run dev:server
```

The server will run on `http://localhost:3001` by default.

### 3. Environment Variables

Add to your `.env` file (optional):

```env
VITE_LOCAL_SERVER_URL=http://localhost:3001
```

If not set, it defaults to `http://localhost:3001`.

## How It Works

1. **Health Checking**: The Supabase client checks availability every 30 seconds
2. **Automatic Fallback**: On connection failure, requests automatically route to local server
3. **Transparent Switching**: The application code doesn't need changes - it works automatically

## Local Server Endpoints

The local server implements these Supabase-compatible endpoints:

- `GET /health` - Health check
- `GET /rest/v1/:table` - List records
- `GET /rest/v1/:table/:id` - Get single record
- `POST /rest/v1/:table` - Create record
- `PATCH /rest/v1/:table/:id` - Update record
- `DELETE /rest/v1/:table/:id` - Delete record
- `POST /auth/v1/token` - Authentication
- `GET /auth/v1/user` - Get current user

## Database

The local server uses SQLite database at `gritsync.db` in the project root. Make sure your database schema matches the Supabase schema.

## Development

### Running Both Servers

1. Terminal 1: Start local fallback server
   ```bash
   npm run dev:server
   ```

2. Terminal 2: Start frontend
   ```bash
   npm run dev
   ```

### Testing Fallback

To test the fallback mechanism:

1. Start the local server
2. Temporarily disable Supabase (wrong URL in `.env` or network issue)
3. The app will automatically use the local server

## Enhanced Features

### File Storage
- Files are stored locally in `storage/` directory
- Supports multiple buckets (documents, email-logos, etc.)
- Automatic directory creation
- File upload/download with proper streaming

### Database Initialization
- Automatic schema conversion from PostgreSQL to SQLite
- Run `npm run init-db` to initialize database from Supabase schema
- Server auto-initializes basic schema if needed

## Notes

- The fallback is transparent - no code changes needed in your application
- Health checks are cached for 30 seconds to avoid excessive requests
- The local server is a simplified implementation - some advanced Supabase features may not be available
- Files are stored in `storage/` directory (make sure to add to `.gitignore` if needed)
- Database is stored in `gritsync.db` in project root

