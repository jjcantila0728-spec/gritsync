# Quick Start - Local Fallback Server

## 🚀 Starting the Server

### Step 1: Start the Local Server

Open a terminal and run:

```bash
npm run server
```

**OR** for development with auto-reload:

```bash
npm run dev:server
```

You should see:
```
🚀 Local fallback server running on http://localhost:3001
📊 Database: E:\GRITSYNC\gritsync.db
📁 Storage: E:\GRITSYNC\storage
```

### Step 2: (Optional) Initialize Database

If you want to initialize the database from your Supabase schema:

```bash
npm run init-db
```

This converts your PostgreSQL schema to SQLite format.

### Step 3: Start Your Frontend

In a **separate terminal**, start your frontend:

```bash
npm run dev
```

## ✅ How It Works

1. **Frontend starts** → Tries to connect to Supabase
2. **If Supabase is down** → Automatically switches to local server
3. **Local server handles** → All database and file operations

## 🧪 Testing the Fallback

To test that fallback works:

1. Start the local server: `npm run server`
2. Start the frontend: `npm run dev`
3. Temporarily break Supabase connection (wrong URL in `.env` or disconnect internet)
4. The app should automatically use the local server

## 📍 Server Endpoints

- **Health Check**: http://localhost:3001/health
- **REST API**: http://localhost:3001/rest/v1/:table
- **Storage**: http://localhost:3001/storage/v1/object/:bucket/:path

## 🛑 Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

## 📝 Notes

- Server runs on port **3001** by default
- Database file: `gritsync.db` (created automatically)
- Storage directory: `storage/` (created automatically)
- No code changes needed - fallback is automatic!







