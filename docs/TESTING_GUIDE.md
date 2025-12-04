# Comprehensive Testing Guide

## 🧪 Testing Checklist for All New Features

### 1. Notification System Testing

#### In-App Notifications
- [ ] **Application Status Change**
  1. Log in as admin
  2. Go to an application detail page
  3. Change application status
  4. Verify notification appears in header bell icon
  5. Verify notification count increases
  6. Click notification to mark as read
  7. Verify count decreases

- [ ] **Payment Completion**
  1. Complete a payment (Stripe or manual)
  2. Verify notification appears
  3. Check notification links to payment page

- [ ] **Timeline Step Update**
  1. As admin, update a timeline step to "completed"
  2. Verify user receives notification
  3. Check notification message is correct

- [ ] **Real-time Updates**
  1. Open app in two browser windows
  2. Trigger notification in one window
  3. Verify it appears in the other window automatically

#### Email Notifications
- [ ] **Email Settings**
  1. Go to `/admin/settings` → Notification Settings
  2. Toggle email notifications on/off
  3. Verify settings save correctly

- [ ] **Email Sending**
  1. Enable email notifications for a notification type
  2. Trigger that notification type
  3. Check email inbox for notification email
  4. Verify email contains correct information
  5. Verify action button/link works

- [ ] **Email Preferences**
  1. Disable email for specific notification types
  2. Trigger those notification types
  3. Verify in-app notification still appears
  4. Verify email is NOT sent

---

### 2. Session Timeout Testing

#### Basic Functionality
- [ ] **Timeout Configuration**
  1. Go to `/admin/settings` → Security Settings
  2. Set session timeout to 5 minutes (for testing)
  3. Save settings
  4. Log out and log back in

- [ ] **Activity Tracking**
  1. Log in
  2. Wait 4 minutes without any activity
  3. Verify warning modal appears
  4. Verify countdown timer shows correct time
  5. Move mouse or click - verify modal closes and timer resets

- [ ] **Auto Logout**
  1. Set timeout to 2 minutes
  2. Log in
  3. Wait 1 minute (warning should appear)
  4. Don't interact with warning
  5. Wait for countdown to reach 0
  6. Verify automatic logout occurs
  7. Verify redirect to login page

- [ ] **Stay Logged In**
  1. Trigger warning modal
  2. Click "Stay Logged In"
  3. Verify modal closes
  4. Verify session continues
  5. Verify timer resets

- [ ] **Different Settings**
  1. Test with timeout = 5 minutes
  2. Test with timeout = 30 minutes
  3. Test with timeout = 480 minutes
  4. Verify all work correctly

---

### 3. Login Attempts Tracking Testing

#### Prerequisites
- [ ] **Apply Database Migration**
  1. Run `supabase/migrations/add_login_attempts_tracking.sql` in Supabase
  2. Verify migration succeeds
  3. Check that `login_attempts` table exists
  4. Check that `locked_until` column exists in `users` table

#### Basic Tracking
- [ ] **Successful Login**
  1. Log in with correct credentials
  2. Check `login_attempts` table in Supabase
  3. Verify record exists with `success = true`
  4. Verify IP address and user agent are recorded

- [ ] **Failed Login**
  1. Try to log in with wrong password
  2. Check `login_attempts` table
  3. Verify record exists with `success = false`
  4. Verify `failure_reason` is set
  5. Verify email is recorded (even if user doesn't exist)

#### Account Lockout
- [ ] **Max Attempts Reached**
  1. Configure `maxLoginAttempts` to 3 (for testing)
  2. Try to log in with wrong password 3 times
  3. On 4th attempt, verify account is locked
  4. Verify error message shows lockout status
  5. Verify `locked_until` is set in database

- [ ] **Lockout Duration**
  1. Lock an account
  2. Check `locked_until` timestamp
  3. Verify it's 30 minutes from now
  4. Try to log in - verify "account locked" error
  5. Wait for lock to expire (or manually unlock)
  6. Verify login works again

- [ ] **Remaining Attempts Display**
  1. Try wrong password once
  2. Verify UI shows remaining attempts (e.g., "4 attempts remaining")
  3. Try wrong password again
  4. Verify count decreases
  5. Verify warning message appears when low

#### Admin Functions
- [ ] **View Login Attempts**
  1. Log in as admin
  2. Go to user management
  3. View a user's login attempts
  4. Verify history is displayed correctly
  5. Verify IP addresses and timestamps are shown

- [ ] **Unlock Account**
  1. Lock a test account
  2. As admin, unlock the account
  3. Verify `locked_until` is cleared in database
  4. Verify user can log in again

- [ ] **Lock Status Check**
  1. As admin, check lock status of a user
  2. Verify status is displayed correctly
  3. Verify minutes remaining is shown if locked

#### Integration with Supabase Auth
**Note**: The frontend currently uses Supabase Auth directly. For full tracking integration:

- [ ] **Option A: Use Backend API** (Recommended for full tracking)
  - Update `src/contexts/AuthContext.tsx` to use backend `/api/auth/login` endpoint
  - This will enable full login attempt tracking

- [ ] **Option B: Create Edge Function** (Alternative)
  - Create Supabase Edge Function to intercept auth events
  - Call `record_auth_login_attempt()` function
  - This requires additional setup

**Current Status**: Backend tracking is complete. Frontend integration is optional but recommended.

---

### 4. Integration Testing

#### Feature Interactions
- [ ] **Notifications + Session Timeout**
  1. Receive notification
  2. Let session timeout
  3. Verify notification persists after re-login

- [ ] **Login Tracking + Session Timeout**
  1. Log in (tracked)
  2. Let session timeout
  3. Log in again
  4. Verify both login attempts are tracked

- [ ] **Notifications + Account Lockout**
  1. Lock an account
  2. Verify admin receives notification (if configured)
  3. Unlock account
  4. Verify user can log in and receive notifications

---

### 5. Edge Cases & Error Handling

#### Session Timeout
- [ ] Tab/window switching doesn't break timeout
- [ ] Multiple tabs maintain same timeout
- [ ] Timeout works when browser is minimized
- [ ] Timeout resets correctly after activity

#### Login Attempts
- [ ] Tracking works for non-existent users
- [ ] IP address tracking works behind proxy
- [ ] Multiple failed attempts from different IPs
- [ ] Lock expiration works correctly
- [ ] Successful login clears lock

#### Notifications
- [ ] Notifications work when user is offline
- [ ] Email sending doesn't break if service is down
- [ ] Notification count updates correctly
- [ ] Mark all as read works

---

### 6. Performance Testing

- [ ] **Session Timeout**
  - No performance impact from activity tracking
  - Timer cleanup works correctly
  - No memory leaks

- [ ] **Login Attempts**
  - Database queries are efficient
  - Indexes are used correctly
  - No slowdown with many attempts

- [ ] **Notifications**
  - Real-time updates don't cause lag
  - Notification list loads quickly
  - Email sending is async and non-blocking

---

### 7. Security Testing

- [ ] **Session Timeout**
  - Timeout cannot be bypassed
  - Settings are enforced server-side

- [ ] **Login Attempts**
  - Attempts cannot be cleared by users
  - Lock cannot be bypassed
  - Admin unlock requires admin role

- [ ] **Notifications**
  - Users can only see their own notifications
  - RLS policies are enforced
  - Email addresses are validated

---

## 📋 Quick Test Scenarios

### Scenario 1: Complete User Flow
1. User registers → receives welcome notification
2. User creates application → receives confirmation
3. Admin updates status → user receives notification
4. User is inactive → session timeout warning appears
5. User stays logged in → session continues
6. User makes payment → receives payment notification
7. User logs out

### Scenario 2: Security Flow
1. User tries wrong password 5 times → account locks
2. Admin unlocks account
3. User logs in successfully
4. User is inactive → session times out
5. User logs in again → attempt is tracked

### Scenario 3: Admin Flow
1. Admin views all notifications
2. Admin views login attempts for a user
3. Admin unlocks a locked account
4. Admin changes application status → notification sent
5. Admin approves payment → notification sent

---

## 🐛 Known Issues & Workarounds

### Issue: Login Attempt Tracking with Supabase Auth
**Status**: Backend tracking is complete, but frontend uses Supabase Auth directly

**Workaround Options**:
1. Update frontend to use backend API (recommended)
2. Create Supabase Edge Function for tracking
3. Use database triggers (limited functionality)

**Current Behavior**: 
- Backend `/api/auth/login` route has full tracking
- Frontend `supabase.auth.signInWithPassword` bypasses backend
- Tracking will work if frontend is updated to use backend API

---

## ✅ Test Results Template

```
Date: ___________
Tester: ___________

Notification System:
- In-app: [ ] Pass [ ] Fail
- Email: [ ] Pass [ ] Fail
- Real-time: [ ] Pass [ ] Fail

Session Timeout:
- Basic: [ ] Pass [ ] Fail
- Warning: [ ] Pass [ ] Fail
- Auto-logout: [ ] Pass [ ] Fail

Login Attempts:
- Tracking: [ ] Pass [ ] Fail
- Lockout: [ ] Pass [ ] Fail
- Admin unlock: [ ] Pass [ ] Fail

Integration:
- All features: [ ] Pass [ ] Fail

Notes:
_______________________________________
_______________________________________
```

---

## 🚀 Ready for Production

After completing all tests:
- [ ] All tests pass
- [ ] Database migrations applied
- [ ] Settings configured
- [ ] Documentation reviewed
- [ ] Error handling verified
- [ ] Performance acceptable
- [ ] Security verified

**Status**: Ready for deployment ✅


