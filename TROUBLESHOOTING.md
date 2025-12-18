# Troubleshooting - Can't Open http://localhost:5000/

## ✅ Server Status: RUNNING

The server is running and responding correctly. If you can't access it, try these solutions:

## 🔧 Quick Fixes

### 1. Try Different URLs
- http://localhost:5000/
- http://127.0.0.1:5000/
- http://0.0.0.0:5000/

### 2. Clear Browser Cache
- Press `Ctrl + Shift + Delete`
- Clear cache and cookies
- Try again

### 3. Try Incognito/Private Mode
- Open browser in incognito/private mode
- Navigate to http://localhost:5000/

### 4. Check Browser Console
- Press `F12` to open developer tools
- Check the Console tab for errors
- Check the Network tab to see if requests are failing

### 5. Restart the Dev Server
If the server seems stuck:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 6. Check Firewall/Antivirus
- Windows Firewall might be blocking the connection
- Antivirus software might be interfering
- Try temporarily disabling to test

### 7. Check if Port is Actually Free
```bash
netstat -ano | findstr :5000
```

If you see multiple processes, kill the old one:
```bash
taskkill /PID <process_id> /F
```

## 🚀 Restart Everything Fresh

1. **Stop all running servers** (Ctrl+C in all terminals)

2. **Kill any stuck processes**:
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill it (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

3. **Start local fallback server** (Terminal 1):
```bash
npm run server
```

4. **Start frontend** (Terminal 2):
```bash
npm run dev
```

5. **Wait for the message**:
```
➜  Local:   http://localhost:5000/
```

6. **Open in browser**: http://localhost:5000/

## 🔍 Common Issues

### Issue: "This site can't be reached"
- **Solution**: Server might not be running. Check terminal for errors.

### Issue: Blank page
- **Solution**: Check browser console (F12) for JavaScript errors.

### Issue: Connection refused
- **Solution**: Port might be blocked. Try a different port in `vite.config.ts`.

### Issue: CORS errors
- **Solution**: The server has CORS enabled. Check if Supabase URL is correct.

## 📞 Still Not Working?

1. Check terminal output for errors
2. Check browser console (F12) for errors
3. Verify environment variables in `.env`
4. Make sure both servers are running:
   - Frontend: `npm run dev` (port 5000)
   - Backend: `npm run server` (port 3001)







