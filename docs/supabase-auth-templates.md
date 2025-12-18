# Supabase Auth Email Templates

Copy and paste these templates into your Supabase Dashboard:
**Authentication -> Email Templates**

---

## 1. Confirm Signup (Email Verification)

**Subject:**
```
Verify Your Email - GritSync
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 20px; text-align: center;">
      <a href="https://gritsync.com" style="font-size: 32px; font-weight: bold; color: #ffffff; text-decoration: none; letter-spacing: 2px;">GRIT<span style="color: rgba(255,255,255,0.85);">SYNC</span></a>
      <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 14px;">Your NCLEX Journey Partner</p>
    </div>
    <div style="padding: 40px 30px;">
      <h1 style="font-size: 28px; color: #1f2937; margin-bottom: 20px;">Verify Your Email</h1>
      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Welcome to GritSync! Please verify your email address to complete your registration.</p>
      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Click the button below to verify your email:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
      </div>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400e;"><strong>Important:</strong> This link will expire in 24 hours.</p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">If you did not create an account, please ignore this email.</p>
      <p style="color: #9ca3af; font-size: 14px; margin-top: 20px;">If the button does not work, copy and paste this link into your browser:<br><span style="color: #dc2626; word-break: break-all;">{{ .ConfirmationURL }}</span></p>
    </div>
    <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Email: <a href="mailto:support@gritsync.com" style="color: #dc2626;">support@gritsync.com</a></p>
      <p style="color: #6b7280; font-size: 12px;">&copy; 2025 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Reset Password

**Subject:**
```
Reset Your Password - GritSync
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 20px; text-align: center;">
      <a href="https://gritsync.com" style="font-size: 32px; font-weight: bold; color: #ffffff; text-decoration: none; letter-spacing: 2px;">GRIT<span style="color: rgba(255,255,255,0.85);">SYNC</span></a>
      <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 14px;">Your NCLEX Journey Partner</p>
    </div>
    <div style="padding: 40px 30px;">
      <h1 style="font-size: 28px; color: #1f2937; margin-bottom: 20px;">Password Reset Request</h1>
      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">We received a request to reset your password. Click the button below to create a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset My Password</a>
      </div>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400e;"><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
      </div>
      <p style="color: #6b7280; font-size: 16px; line-height: 1.6;"><strong>If you did not request this password reset,</strong> please ignore this email. Your password will remain unchanged.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="font-size: 18px; color: #1f2937; margin: 0 0 10px 0;">Security Tips:</h3>
        <ul style="margin: 15px 0; padding-left: 20px; color: #6b7280;">
          <li style="margin-bottom: 10px;">Never share your password with anyone</li>
          <li style="margin-bottom: 10px;">Use a strong, unique password</li>
          <li style="margin-bottom: 10px;">Enable two-factor authentication if available</li>
        </ul>
      </div>
      <p style="color: #9ca3af; font-size: 14px;">If the button does not work, copy and paste this link into your browser:<br><span style="color: #dc2626; word-break: break-all;">{{ .ConfirmationURL }}</span></p>
    </div>
    <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Email: <a href="mailto:support@gritsync.com" style="color: #dc2626;">support@gritsync.com</a></p>
      <p style="color: #6b7280; font-size: 12px;">&copy; 2025 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Magic Link

**Subject:**
```
Your Login Link - GritSync
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 20px; text-align: center;">
      <a href="https://gritsync.com" style="font-size: 32px; font-weight: bold; color: #ffffff; text-decoration: none; letter-spacing: 2px;">GRIT<span style="color: rgba(255,255,255,0.85);">SYNC</span></a>
      <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 14px;">Your NCLEX Journey Partner</p>
    </div>
    <div style="padding: 40px 30px;">
      <h1 style="font-size: 28px; color: #1f2937; margin-bottom: 20px;">Your Login Link</h1>
      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Click the button below to log in to your GritSync account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Log In to GritSync</a>
      </div>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400e;"><strong>Important:</strong> This link will expire in 1 hour and can only be used once.</p>
      </div>
      <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">If you did not request this login link, please ignore this email.</p>
      <p style="color: #9ca3af; font-size: 14px; margin-top: 20px;">If the button does not work, copy and paste this link into your browser:<br><span style="color: #dc2626; word-break: break-all;">{{ .ConfirmationURL }}</span></p>
    </div>
    <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Email: <a href="mailto:support@gritsync.com" style="color: #dc2626;">support@gritsync.com</a></p>
      <p style="color: #6b7280; font-size: 12px;">&copy; 2025 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 4. Change Email Address

**Subject:**
```
Confirm Your New Email Address - GritSync
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 20px; text-align: center;">
      <a href="https://gritsync.com" style="font-size: 32px; font-weight: bold; color: #ffffff; text-decoration: none; letter-spacing: 2px;">GRIT<span style="color: rgba(255,255,255,0.85);">SYNC</span></a>
      <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 14px;">Your NCLEX Journey Partner</p>
    </div>
    <div style="padding: 40px 30px;">
      <h1 style="font-size: 28px; color: #1f2937; margin-bottom: 20px;">Confirm Email Change</h1>
      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">You have requested to change your email address. Please click the button below to confirm this change:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Confirm New Email</a>
      </div>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400e;"><strong>Important:</strong> If you did not request this email change, please contact support immediately.</p>
      </div>
      <p style="color: #9ca3af; font-size: 14px;">If the button does not work, copy and paste this link into your browser:<br><span style="color: #dc2626; word-break: break-all;">{{ .ConfirmationURL }}</span></p>
    </div>
    <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Email: <a href="mailto:support@gritsync.com" style="color: #dc2626;">support@gritsync.com</a></p>
      <p style="color: #6b7280; font-size: 12px;">&copy; 2025 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## 5. Invite User

**Subject:**
```
You've Been Invited to GritSync
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 20px; text-align: center;">
      <a href="https://gritsync.com" style="font-size: 32px; font-weight: bold; color: #ffffff; text-decoration: none; letter-spacing: 2px;">GRIT<span style="color: rgba(255,255,255,0.85);">SYNC</span></a>
      <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 14px;">Your NCLEX Journey Partner</p>
    </div>
    <div style="padding: 40px 30px;">
      <h1 style="font-size: 28px; color: #1f2937; margin-bottom: 20px;">You're Invited!</h1>
      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">You have been invited to join GritSync, your partner in achieving your American Dream as a nurse.</p>
      <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Click the button below to accept the invitation and set up your account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
      </div>
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px;">
        <h3 style="margin: 0 0 10px 0; color: #065f46;">What You'll Get:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
          <li style="margin-bottom: 8px;">NCLEX application tracking</li>
          <li style="margin-bottom: 8px;">Document management</li>
          <li style="margin-bottom: 8px;">Visa bulletin updates</li>
          <li style="margin-bottom: 8px;">Expert support</li>
        </ul>
      </div>
      <p style="color: #9ca3af; font-size: 14px;">If the button does not work, copy and paste this link into your browser:<br><span style="color: #dc2626; word-break: break-all;">{{ .ConfirmationURL }}</span></p>
    </div>
    <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Email: <a href="mailto:support@gritsync.com" style="color: #dc2626;">support@gritsync.com</a></p>
      <p style="color: #6b7280; font-size: 12px;">&copy; 2025 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

---

## Notes

1. **Supabase Variables:** The templates use `{{ .ConfirmationURL }}` which Supabase automatically replaces with the actual confirmation link.

2. **Colors Used:**
   - Primary (Red): `#dc2626`
   - Primary Dark: `#b91c1c`
   - These match your GritSync branding

3. **To Apply:**
   - Go to Supabase Dashboard
   - Navigate to Authentication -> Email Templates
   - Select each template type
   - Copy the Subject and Body from above
   - Save changes

4. **Testing:**
   - After saving, test by signing up with a new email
   - Or use "Forgot Password" to trigger a password reset email
