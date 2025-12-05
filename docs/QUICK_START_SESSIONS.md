# Quick Start: Session and Security Setup

## Step 1: Run Database Migration

### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/add_sessions_table.sql`
5. Click **Run** or press `Ctrl+Enter`

### Option B: Using Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push

# Or run the migration file directly
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/add_sessions_table.sql
```

### Option C: Using the Migration Script
```bash
node scripts/run-session-migration.js
```
Note: This script will guide you as Supabase client cannot execute DDL directly.

## Step 2: Verify Setup

Run the verification script:
```bash
node scripts/verify-session-setup.js
```

This will check:
- ✅ Database connection
- ✅ Sessions table existence
- ✅ CSRF protection
- ✅ Input sanitization
- ✅ Environment variables
- ✅ Required files

## Step 3: Update Environment Variables (Optional)

Add to your `.env` file:
```env
# Session duration in minutes (default: 480 = 8 hours)
SESSION_DURATION_MINUTES=480

# Refresh token duration in days (default: 30)
REFRESH_TOKEN_DURATION_DAYS=30

# JWT Secret (required in production)
JWT_SECRET=your-secret-key-change-in-production
```

## Step 4: Restart Server

```bash
# Development
npm run dev

# Production
npm start
```

## Step 5: Test the Implementation

### Test Login (Session Creation)
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Expected response includes:
```json
{
  "user": { ... },
  "token": "jwt_token",
  "refreshToken": "refresh_token",
  "sessionId": "session_id"
}
```

### Test Session List
```bash
curl -X GET http://localhost:3001/api/sessions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Session Refresh
```bash
curl -X POST http://localhost:3001/api/sessions/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

## Troubleshooting

### Sessions Table Not Found
- Verify migration was run successfully
- Check Supabase dashboard → Database → Tables
- Look for `sessions` table

### CSRF Token Errors
- CSRF protection is optional and can be enabled per-route
- Currently not enforced globally (can be added if needed)

### Session Not Created on Login
- Check server logs for errors
- Verify database connection
- Check that `createSession` is being called in auth routes

### Environment Variables
- `JWT_SECRET` is required in production
- Session duration variables are optional (have defaults)

## Next Steps

1. **Frontend Integration**: Update frontend to:
   - Store `refreshToken` and `sessionId` from login response
   - Use refresh token for token renewal
   - Display active sessions to users
   - Allow session revocation from UI

2. **Enable CSRF Protection** (if needed):
   ```javascript
   import { csrfProtection } from './middleware/csrf.js'
   
   // Apply to specific routes
   app.post('/api/sensitive-action', csrfProtection, handler)
   ```

3. **Monitor Sessions**:
   - Check session cleanup logs
   - Monitor suspicious activity
   - Review session revocation events

## Support

For issues:
1. Check server logs
2. Run verification script: `node scripts/verify-session-setup.js`
3. Review `docs/SESSION_AND_SECURITY_IMPLEMENTATION.md`
4. Check database migration was successful
