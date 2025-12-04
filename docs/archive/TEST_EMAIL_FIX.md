# Fix: Test Email Validation Error

## The Problem
Tests were failing with:
```
Email address "test-{timestamp}-{random}@test.gritsync.com" is invalid
```

## Root Cause
Supabase has email validation that rejects certain domains. The `@test.gritsync.com` domain was being rejected as invalid.

## The Fix
Changed test email domain from `@test.gritsync.com` to `@example.com`:
- `example.com` is a reserved domain for testing (RFC 2606)
- Supabase accepts `@example.com` emails
- This is a standard practice for test emails

## Changes Made
1. ✅ Updated `generateTestEmail()` function in `src/test/e2e-auth.test.ts`
2. ✅ Updated `generateTestEmail()` function in `test-auth-e2e.js`
3. ✅ Added delays between tests to avoid rate limiting
4. ✅ Updated documentation

## Rate Limiting
Tests also hit rate limits when running too fast. Added:
- 500ms delay in `beforeEach`
- 1000ms delay before first registration test
- Additional delays between test suites

## Running Tests Now
```bash
npm run test:e2e:vitest
```

Tests should now pass! The email validation error is fixed.







