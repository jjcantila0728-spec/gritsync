# How to Start the Backend Server

## Quick Start

The backend server MUST be running for the application to work. Here's how to start it:

### Method 1: Start Both Servers Together (Easiest)

Open a terminal in the project root and run:

```bash
npm run dev:all
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend server on `http://localhost:3000`

### Method 2: Start Servers Separately

**Step 1: Start Backend Server**

Open a terminal and run:
```bash
npm run dev:server
```

You should see:
```
Server running on http://localhost:3001
Database initialized
```

**Step 2: Start Frontend Server** (in a new terminal)

```bash
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:3000/
```

## Verify Server is Running

1. **Check the terminal output** - You should see "Server running on http://localhost:3001"
2. **Test the API** - Open your browser and go to: `http://localhost:3001/api/auth/me`
   - You should get an error about authentication (not connection refused)
   - If you see "connection refused", the server is NOT running

## Troubleshooting

### Port 3001 Already in Use

If you get an error that port 3001 is already in use:

1. Find what's using the port:
   ```bash
   netstat -ano | findstr :3001
   ```

2. Kill the process (replace PID with the number from above):
   ```bash
   taskkill /PID <PID> /F
   ```

3. Or change the port in `server/index.js` (line 15):
   ```javascript
   const PORT = process.env.PORT || 3002  // Change to 3002 or another port
   ```

### Dependencies Not Installed

If you get module errors, install dependencies:
```bash
npm install
```

### Database Issues

The server automatically creates `gritsync.db` in the project root. Make sure:
- You have write permissions in the project directory
- No other process is locking the database file

## Important Notes

- **The backend server MUST be running** for registration, login, and all API calls to work
- The frontend will show connection errors if the backend is not running
- Keep the terminal open while the server is running
- Press `Ctrl+C` to stop the server

## Common Error Messages

- `ERR_CONNECTION_REFUSED` = Backend server is not running
- `Port 3001 already in use` = Another process is using the port
- `Cannot find module` = Run `npm install` first

