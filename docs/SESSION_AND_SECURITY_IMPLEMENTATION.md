# Session and Security Implementation

## Overview

This document describes the comprehensive session management and security enhancements implemented for GritSync.

## Features Implemented

### 1. Server-Side Session Management

#### Database Schema
- **Sessions Table**: Stores active user sessions with:
  - Token and refresh token
  - Device fingerprinting
  - IP address and user agent
  - Activity tracking
  - Expiration management
  - Revocation support

#### Key Features
- **Session Creation**: Automatically creates sessions on login
- **Session Validation**: Validates sessions on each request
- **Activity Tracking**: Updates last activity timestamp
- **Session Refresh**: Token refresh mechanism using refresh tokens
- **Session Revocation**: Ability to revoke individual or all sessions
- **Automatic Cleanup**: Periodic cleanup of expired sessions

**Files:**
- `supabase/migrations/add_sessions_table.sql` - Database migration
- `server/utils/sessions.js` - Session management utilities
- `server/middleware/session.js` - Session validation middleware

### 2. Enhanced Authentication

#### Updated Authentication Middleware
- Validates server-side sessions first
- Falls back to JWT/Supabase token verification for backward compatibility
- Updates session activity on each request
- Attaches session information to request object

**Files:**
- `server/middleware/index.js` - Updated authentication middleware

### 3. CSRF Protection

#### Features
- Token generation and validation
- Session-based token association
- Automatic token inclusion in responses
- Protection for state-changing requests (POST, PUT, DELETE, PATCH)

**Files:**
- `server/middleware/csrf.js` - CSRF protection middleware

**Usage:**
```javascript
import { csrfProtection, addCSRFToken } from './middleware/csrf.js'

// Add CSRF token to response
app.use(addCSRFToken)

// Protect routes
app.post('/api/sensitive-action', csrfProtection, handler)
```

### 4. Input Sanitization

#### Features
- Recursive object sanitization
- String sanitization (removes control characters, null bytes)
- SQL injection pattern detection
- Email and URL validation helpers

**Files:**
- `server/middleware/sanitize.js` - Input sanitization middleware

**Usage:**
```javascript
import { sanitizeInput, validateNoSQLInjection } from './middleware/sanitize.js'

// Applied globally in server/index.js
app.use(sanitizeInput)
app.use(validateNoSQLInjection)
```

### 5. Device Fingerprinting

#### Features
- Device fingerprint generation from request headers
- Device name detection (iPhone, Android, Windows, Mac, etc.)
- IP address tracking
- User agent tracking
- Security validation (fingerprint mismatch detection)

**Implementation:**
- Automatically generated on session creation
- Validated on each request
- Logged for suspicious activity

### 6. Session Routes

#### Endpoints

**GET /api/sessions**
- Get all active sessions for current user
- Returns device info, IP, last activity

**POST /api/sessions/refresh**
- Refresh session token using refresh token
- Returns new token and expiration

**DELETE /api/sessions/:sessionId**
- Revoke a specific session
- Requires authentication

**DELETE /api/sessions**
- Revoke all sessions except current
- Requires authentication

**POST /api/sessions/logout**
- Logout from current session
- Revokes current session

**GET /api/sessions/current**
- Get current session information

**Files:**
- `server/routes/sessions.js` - Session management routes

### 7. Security Enhancements

#### Password Change Security
- Automatically revokes all other sessions when password is changed
- Keeps current session active
- Logs security action

#### Password Reset Security
- Revokes all sessions when password is reset
- Ensures old sessions cannot be used after reset

## Database Functions

### cleanup_expired_sessions()
- Automatically marks expired sessions as inactive
- Deletes old revoked sessions (older than 30 days)
- Returns count of cleaned sessions

### get_user_active_session_count(user_id)
- Returns count of active sessions for a user
- Useful for concurrent session limits

### revoke_all_user_sessions(user_id, reason)
- Revokes all active sessions for a user
- Used for security actions (password change, breach, etc.)

### update_session_activity(session_id)
- Updates last activity timestamp
- Called automatically on session validation

## Configuration

### Environment Variables

```env
# Session duration in minutes (default: 480 = 8 hours)
SESSION_DURATION_MINUTES=480

# Refresh token duration in days (default: 30)
REFRESH_TOKEN_DURATION_DAYS=30

# JWT Secret (required in production)
JWT_SECRET=your-secret-key
```

## Security Best Practices

### 1. Session Management
- ✅ Server-side session storage
- ✅ Automatic expiration
- ✅ Activity tracking
- ✅ Revocation support
- ✅ Device fingerprinting
- ✅ IP tracking

### 2. CSRF Protection
- ✅ Token-based protection
- ✅ Session association
- ✅ Automatic token generation
- ✅ Validation on state-changing requests

### 3. Input Validation
- ✅ Input sanitization
- ✅ SQL injection detection
- ✅ Control character removal
- ✅ Type validation

### 4. Authentication
- ✅ Multi-factor token validation (session + JWT/Supabase)
- ✅ Backward compatibility
- ✅ Automatic session creation
- ✅ Security event logging

## Migration Steps

1. **Run Database Migration**
   ```sql
   -- Run the migration file
   supabase/migrations/add_sessions_table.sql
   ```

2. **Update Environment Variables**
   ```env
   SESSION_DURATION_MINUTES=480
   REFRESH_TOKEN_DURATION_DAYS=30
   ```

3. **Restart Server**
   - The server will automatically start using session management
   - Existing JWT tokens will continue to work (backward compatible)

## API Changes

### Login Response
```json
{
  "user": { ... },
  "token": "jwt_token",
  "refreshToken": "refresh_token",  // NEW
  "sessionId": "session_id"          // NEW
}
```

### New Endpoints
- `GET /api/sessions` - List sessions
- `POST /api/sessions/refresh` - Refresh token
- `DELETE /api/sessions/:id` - Revoke session
- `DELETE /api/sessions` - Revoke all sessions
- `POST /api/sessions/logout` - Logout
- `GET /api/sessions/current` - Current session

## Monitoring and Maintenance

### Automatic Cleanup
- Expired sessions are cleaned up hourly
- Old revoked sessions (>30 days) are deleted
- Logs cleanup activity

### Security Monitoring
- Suspicious activity is logged (device fingerprint mismatch)
- Failed authentication attempts are tracked
- Session revocation events are logged

## Future Enhancements

1. **Concurrent Session Limits**
   - Configurable max concurrent sessions per user
   - Automatic revocation of oldest sessions

2. **Geolocation Tracking**
   - Track login locations
   - Alert on suspicious location changes

3. **Session Notifications**
   - Email notifications for new device logins
   - Alerts for suspicious activity

4. **Redis Integration**
   - Move CSRF tokens to Redis for distributed systems
   - Session storage in Redis for better performance

5. **Two-Factor Authentication**
   - TOTP support
   - SMS verification
   - Email verification

## Testing

### Manual Testing
1. Login and verify session creation
2. Check session list endpoint
3. Test session refresh
4. Test session revocation
5. Verify password change revokes other sessions
6. Test CSRF protection
7. Verify input sanitization

### Automated Testing
- Unit tests for session utilities
- Integration tests for session routes
- Security tests for CSRF protection
- Input validation tests

## Troubleshooting

### Sessions Not Created
- Check database migration was run
- Verify session table exists
- Check logs for errors

### CSRF Token Errors
- Ensure token is included in request header: `X-CSRF-Token`
- Verify token hasn't expired
- Check session is valid

### Session Validation Fails
- Check session exists in database
- Verify session hasn't expired
- Check device fingerprint (may be too strict)

## Support

For issues or questions:
1. Check server logs
2. Verify database schema
3. Check environment variables
4. Review this documentation
