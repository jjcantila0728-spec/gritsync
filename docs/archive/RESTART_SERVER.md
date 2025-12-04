# Restart Server to Test Stripe Connection

The server needs to be restarted to load the new Stripe connection test code and environment variables.

## Steps to Restart:

1. **Stop the current server:**
   - Find the terminal where the server is running
   - Press `Ctrl+C` to stop it
   - Or if running in background, find and kill the process:
     ```powershell
     Get-Process node | Stop-Process -Force
     ```

2. **Start the server again:**
   ```bash
   npm run dev:server
   ```

3. **Test the Stripe connection:**
   ```bash
   node test-stripe-connection.js
   ```

## What Was Added:

- ✅ Stripe connection test endpoint: `/api/test/stripe-connection`
- ✅ Automatic loading of Stripe keys from `.env` file (via dotenv)
- ✅ Fallback to load Stripe keys from database settings
- ✅ Test script: `test-stripe-connection.js`

## Expected Results:

If Stripe is configured correctly, you should see:
- ✅ Connection successful
- Account information
- Balance details
- Test/Live mode indicator

If not configured, you'll see helpful error messages with instructions.

