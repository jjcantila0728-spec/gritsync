# End-to-End Authentication Tests

Complete tests that use **real Supabase** to test actual registration and login flows with fake users.

## Test Files

### 1. `src/test/e2e-auth.test.ts` (Vitest)
Comprehensive test suite using Vitest framework. Tests:
- ✅ User registration
- ✅ User profile creation
- ✅ Duplicate email prevention
- ✅ GRIT-ID generation
- ✅ User login
- ✅ Login with wrong credentials
- ✅ User profile loading
- ✅ Profile updates
- ✅ Session management

### 2. `test-auth-e2e.js` (Standalone)
Standalone Node.js script for quick testing. Same functionality as Vitest version but runs independently.

## Prerequisites

1. **Environment Variables**
   Create a `.env` file in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

2. **Supabase Configuration**
   - Email confirmation should be **disabled** for testing
   - Go to: Supabase Dashboard > Authentication > Settings
   - Turn off "Enable email confirmations"

3. **Database Setup**
   - Run `FIX_REGISTRATION_ERROR.sql` in Supabase SQL Editor
   - Ensure RLS policies are configured correctly
   - Ensure trigger function exists

## Running the Tests

### Option 1: Vitest (Recommended)
```bash
# Run all e2e tests
npm run test:e2e:vitest

# Or run with watch mode
npm test e2e-auth
```

### Option 2: Standalone Script
```bash
# Run standalone e2e test
npm run test:e2e

# Or directly
node test-auth-e2e.js
```

## What the Tests Do

### Registration Tests
1. **Register New User** - Creates a test user with fake email
2. **Create Profile** - Verifies profile is created in `public.users` table
3. **Prevent Duplicates** - Ensures duplicate emails are rejected
4. **Generate GRIT-ID** - Verifies unique GRIT-ID is generated

### Login Tests
1. **Login Success** - Tests login with correct credentials
2. **Login Failure** - Tests login with wrong password
3. **Non-existent User** - Tests login with non-existent email
4. **Load Profile** - Verifies user profile loads after login

### Profile Management Tests
1. **Read Profile** - Tests RLS policy allows users to read own profile
2. **Update Profile** - Tests users can update their own profile

### Session Management Tests
1. **Maintain Session** - Verifies session persists after login
2. **Clear Session** - Verifies session is cleared after sign out

## Test User Cleanup

The tests automatically:
- Create fake test users with unique emails (format: `test-{timestamp}-{random}@test.gritsync.com`)
- Store user IDs for cleanup
- Attempt to clean up test users after tests complete

**Note:** Some test users may remain in the database if cleanup fails. You can manually delete them from Supabase Dashboard if needed.

## Expected Results

When all tests pass, you should see:
```
✅ Registration
✅ Create Profile
✅ Prevent Duplicates
✅ Generate GRIT-ID
✅ Login Success
✅ Login Failure
✅ Load Profile
✅ Read Profile
✅ Update Profile
✅ Maintain Session
✅ Clear Session

🎉 All tests passed!
```

## Troubleshooting

### Test Fails: "Missing environment variables"
**Solution:** Create `.env` file with Supabase credentials

### Test Fails: "Email already registered"
**Solution:** The test user already exists. Wait a moment and try again, or manually delete the test user from Supabase Dashboard

### Test Fails: "403 Forbidden"
**Solution:** Run `FIX_REGISTRATION_ERROR.sql` and `SIMPLE_FIX_403.sql` in Supabase SQL Editor

### Test Fails: "Profile not found"
**Solution:** 
1. Check that trigger function exists
2. Run `FIX_REGISTRATION_ERROR.sql` again
3. Increase wait time in test (currently 2 seconds)

### Test Hangs
**Solution:**
1. Check Supabase Dashboard for project status
2. Verify network connection
3. Check browser console for errors
4. Increase timeout in test configuration

## Test Data

Test users are created with:
- **Email:** `test-{timestamp}-{random}@example.com` (using example.com as it's valid for testing)
- **Password:** `TestPassword123!`
- **First Name:** Varies by test
- **Last Name:** Varies by test
- **Role:** `client` (default)

**Note:** Supabase validates email addresses and rejects certain domains. We use `@example.com` which is a standard test domain that Supabase accepts.

## Integration with CI/CD

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: npm run test:e2e:vitest
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

## Notes

- Tests use real Supabase, so they require network access
- Tests create actual users in your database
- Test users are automatically cleaned up when possible
- Some test users may remain if cleanup fails (safe to delete manually)
- Tests are slower than unit tests (2-3 seconds per test due to network calls)

## Next Steps

After running these tests:
1. ✅ Verify all tests pass
2. ✅ Check Supabase Dashboard for created test users
3. ✅ Manually clean up any remaining test users if needed
4. ✅ Run tests regularly to ensure authentication works

