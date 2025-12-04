# Integration Notes - Login Attempt Tracking

## Current Architecture

### Frontend Authentication
- Uses **Supabase Auth** directly (`supabase.auth.signInWithPassword`)
- Fast and reliable
- Handles session management automatically
- Bypasses backend API

### Backend Authentication
- Has `/api/auth/login` route with JWT tokens
- Includes full login attempt tracking
- Currently not used by frontend

## Integration Options

### Option 1: Update Frontend to Use Backend API (Recommended)

**Pros**:
- Full login attempt tracking
- Account lockout enforcement
- Consistent with other API calls
- Centralized authentication logic

**Cons**:
- Need to manage JWT tokens manually
- Slightly more complex session handling
- Need to handle token refresh

**Implementation**:
1. Update `src/contexts/AuthContext.tsx` to call `/api/auth/login`
2. Store JWT token in localStorage
3. Include token in API requests
4. Handle token refresh

### Option 2: Create Supabase Edge Function

**Pros**:
- Keep using Supabase Auth
- Minimal frontend changes
- Leverages Supabase infrastructure

**Cons**:
- Requires Edge Function setup
- Additional complexity
- May have latency

**Implementation**:
1. Create Edge Function that intercepts auth events
2. Call `record_auth_login_attempt()` function
3. Check account lock status before allowing login

### Option 3: Database Triggers (Limited)

**Pros**:
- Automatic tracking
- No code changes needed

**Cons**:
- Limited to successful logins only
- Cannot prevent locked accounts from logging in
- Less control over tracking details

**Implementation**:
- Use Supabase database triggers on `auth.users` table
- Track successful logins only

## Recommended Approach

**For Full Feature Support**: Use **Option 1** (Backend API)

This provides:
- Complete login attempt tracking
- Account lockout enforcement
- Remaining attempts display
- Admin unlock functionality
- Consistent error handling

**For Quick Integration**: Use **Option 2** (Edge Function)

This provides:
- Basic tracking
- Minimal code changes
- Still uses Supabase Auth

## Current Status

✅ **Backend Implementation**: Complete
- Login attempt tracking utilities
- Account lockout logic
- Admin unlock routes
- Database migration ready

⏳ **Frontend Integration**: Pending
- UI updates complete (shows lockout status)
- Backend API integration optional
- Works with Supabase Auth (limited tracking)

## Next Steps

1. **Immediate**: Apply database migration
2. **Short-term**: Choose integration option
3. **Long-term**: Implement chosen option

---

## Quick Integration Guide (Option 1)

If choosing to update frontend to use backend API:

### Step 1: Update AuthContext

```typescript
async function signIn(email: string, password: string) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
  
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Login failed')
  }
  
  const { user, token } = await response.json()
  
  // Store token
  localStorage.setItem('auth_token', token)
  
  // Set user
  setUser(user)
}
```

### Step 2: Update API Calls

Include token in all API requests:

```typescript
const token = localStorage.getItem('auth_token')
fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

### Step 3: Handle Token Refresh

Implement token refresh logic or use Supabase for session management alongside JWT.

---

**Note**: The current implementation works with Supabase Auth. The backend tracking is ready when you decide to integrate it.


