# Two-Factor Authentication (TOTP) Library Setup

## For Production Use

The current implementation includes a basic TOTP verification. For production, you should install and use a proper TOTP library.

### Recommended Library: `speakeasy`

```bash
npm install speakeasy
npm install --save-dev @types/speakeasy
```

### Update `src/lib/supabase-api.ts`

Replace the `verify2FACode` function with:

```typescript
import speakeasy from 'speakeasy'

verify2FACode: async (secret: string, code: string): Promise<boolean> => {
  try {
    if (!/^\d{6}$/.test(code)) return false
    
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 2 // Allow codes from ±1 time step (60 seconds)
    })
    
    return verified !== null && verified !== false
  } catch (error) {
    return false
  }
},
```

### Alternative: `otplib`

```bash
npm install otplib
```

```typescript
import { authenticator } from 'otplib'

verify2FACode: async (secret: string, code: string): Promise<boolean> => {
  try {
    if (!/^\d{6}$/.test(code)) return false
    
    return authenticator.verify({ token: code, secret })
  } catch (error) {
    return false
  }
},
```

## Current Implementation

The current implementation accepts any 6-digit code for demo purposes. **This is NOT secure for production** and should be replaced with proper TOTP verification before deploying to production.





