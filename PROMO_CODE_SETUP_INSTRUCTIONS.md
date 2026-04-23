# Promo Code Feature - Setup Instructions

## ✅ What's Been Implemented

### 1. Database Tables and Functions
- **File**: `supabase/add-promo-codes-table.sql`
- **Tables Created**:
  - `promo_codes`: Stores promo code definitions
  - `promo_code_usage`: Tracks redemptions
- **Function**: `validate_promo_code()`: Validates codes and calculates discounts
- **RLS Policies**: Proper access control for admins and public users
- **Sample Codes**: WELCOME10 (10% off), SAVE50 ($50 off)

### 2. Checkout Page Promo Code Input
- **File**: `src/components/StripePaymentForm.tsx`
- **Features**:
  - Promo code input field with "Apply" button
  - Real-time validation against database
  - Visual feedback when code is applied (green success card)
  - Discount breakdown showing original vs. final amount
  - Works for both mobile banking and credit card payments
  - Discounted amount shown in payment instructions (PHP conversion)
  - One-click remove promo code
  - Clear note that discounts apply to service fees only

### 3. Admin Promo Code Generator
- **File**: `src/pages/admin-settings/PromoCodeSettings.tsx`
- **Features**:
  - Create new promo codes with custom or generated codes
  - Set discount type (percentage or fixed amount)
  - Set max uses and expiration dates
  - View all promo codes with status (Active/Inactive/Expired/Maxed Out)
  - Track usage statistics
  - Activate/deactivate codes
  - Delete codes
  - Copy code to clipboard
  - Beautiful, responsive UI

### 4. Admin Settings Integration
- **Files**: `src/pages/admin-settings/AdminSettings.tsx`, `src/App.tsx`
- **Features**:
  - New "Promo Codes" tab in Admin Settings
  - Accessible at `/admin/settings/promo-codes`
  - Integrated with existing admin navigation

## 🚀 Setup Steps

### Step 1: Run SQL Migration

In your Supabase dashboard, go to **SQL Editor** and run:

```sql
-- Copy and paste the contents of supabase/add-promo-codes-table.sql
```

Or if using Supabase CLI:

```bash
supabase migration new add_promo_codes
# Copy the SQL content to the new migration file
supabase db push
```

### Step 2: Verify Database Setup

Check that the following tables exist in your Supabase database:
- `promo_codes`
- `promo_code_usage`

Test the validation function:

```sql
SELECT validate_promo_code('WELCOME10', 150.00);
-- Should return JSON with valid: true
```

### Step 3: Test the Feature

1. **As Admin**:
   - Navigate to `/admin/settings/promo-codes`
   - Create a test promo code (e.g., "TEST20" for 20% off)
   - Verify it appears in the list

2. **As Client**:
   - Go through the NCLEX application flow
   - At the checkout page, enter your promo code
   - Click "Apply" and verify the discount is shown
   - Complete the payment to test end-to-end

3. **Public Access**:
   - Use a checkout link without logging in
   - Apply a promo code
   - Verify it works for public/shared links

## 📋 Usage Guide

### For Admins: Creating Promo Codes

1. Go to **Admin Settings** → **Promo Codes**
2. Click **"New Promo Code"**
3. Fill in the details:
   - **Code**: Enter a memorable code (or click "Generate" for random)
   - **Description**: What this promo is for (shown to users)
   - **Discount Type**: Percentage (%) or Fixed Amount ($)
   - **Discount Value**: The discount amount
   - **Max Uses** (optional): Limit total redemptions
   - **Valid Until** (optional): Set expiration date
4. Click **"Create Promo Code"**

#### Tips:
- Use clear, memorable codes like "SUMMER2024" or "WELCOME10"
- Add expiration dates for time-limited promotions
- Set max uses for exclusive or limited offers
- Use descriptions to help track promo campaigns

### For Clients: Using Promo Codes

1. Fill out your NCLEX application
2. At the checkout page, find the **"Have a Promo Code?"** section
3. Enter your promo code (case-insensitive)
4. Click **"Apply"**
5. If valid, you'll see:
   - ✅ Success message
   - Green card showing the code and discount
   - Updated payment amount with breakdown
6. Complete your payment with the discounted price

## 🎨 UI/UX Features

### Checkout Page
- **Promo Code Input**: Clean, accessible input field
- **Apply Button**: With loading state during validation
- **Success Card**: Green card showing:
  - Promo code name
  - Description
  - Discount amount
  - Remove button (X icon)
- **Price Breakdown**: Shows:
  - Original amount (strikethrough)
  - Promo discount (green text)
  - Final amount (bold, green)
- **Payment Button**: Updates to show discounted amount
- **Mobile Banking**: Shows discounted PHP amount with conversion

### Admin Page
- **Promo Code Cards**: Show all details at a glance
- **Status Badges**: Active (green), Inactive (gray), Expired (shown in text), Maxed Out
- **Usage Stats**: Shows redemption count vs. max uses
- **Quick Actions**: Copy, Activate/Deactivate, Delete
- **Empty State**: Friendly message when no codes exist
- **Loading States**: Smooth loading indicators

## 🔐 Security Features

- **RLS Policies**: Protect admin-only operations
- **Public Validation**: Allows anyone to validate codes (required for public checkout)
- **Server-Side Validation**: All validation happens in database function
- **Usage Tracking**: Prevents fraud with usage limits
- **Expiration Checks**: Automatic expiration based on date

## ⚠️ Important Notes

### ✅ Discount Application (FIXED)
The promo code system now **correctly applies discounts ONLY to the GritSync service fee** ($150 or portion thereof), not to government fees or third-party fees.

**Implementation Details**:
1. ✅ Added `service_fee_amount` column to `application_payments` table
2. ✅ Payment creation tracks service fee separately ($150 full, $75 per step)
3. ✅ Modified `validate_promo_code()` function to use service fee only
4. ✅ Frontend passes service fee amount for accurate calculation
5. ✅ UI shows detailed breakdown of what's being discounted

### Current Behavior
- ✅ Discounts apply ONLY to GritSync service fee
- ✅ Government/NCSBN fees are NEVER discounted
- ✅ Discounts are capped at the service fee amount
- ✅ Detailed breakdown shows government fees vs. service fees
- ✅ Clear UI messaging about what's being discounted

See `PROMO_CODE_FIX_SUMMARY.md` for complete technical details.

## 📊 Sample Promo Codes (Included)

Two sample codes are created automatically:

1. **WELCOME10**
   - 10% off
   - Unlimited uses
   - No expiration
   - Great for new client offers

2. **SAVE50**
   - $50 off
   - Max 100 uses
   - No expiration
   - Good for promotional campaigns

**⚠️ Remove these in production!** Delete them from the SQL file or deactivate them in the admin panel.

## 🐛 Troubleshooting

### "Invalid or expired promo code" Error
- Check if code is active in admin panel
- Verify expiration date hasn't passed
- Check if max uses has been reached
- Ensure code is typed correctly (case-insensitive)

### Promo Code Not Applying
- Check browser console for errors
- Verify SQL migration ran successfully
- Test the `validate_promo_code` function in Supabase SQL editor
- Check RLS policies are enabled

### Admin Can't Create Promo Codes
- Verify user has admin role in database
- Check `promo_codes` table permissions
- Look for duplicate code errors (codes must be unique)

## 📝 Database Schema

### promo_codes Table
```sql
id                UUID PRIMARY KEY
code              VARCHAR(50) UNIQUE NOT NULL
description       TEXT
discount_type     VARCHAR(20) CHECK (percentage | fixed)
discount_value    DECIMAL(10, 2)
max_uses          INTEGER (NULL = unlimited)
current_uses      INTEGER DEFAULT 0
valid_from        TIMESTAMP
valid_until       TIMESTAMP (NULL = no expiration)
is_active         BOOLEAN DEFAULT TRUE
created_by        UUID (references auth.users)
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### promo_code_usage Table
```sql
id                UUID PRIMARY KEY
promo_code_id     UUID (references promo_codes)
user_id           UUID (references auth.users)
application_id    UUID (references applications)
payment_id        UUID (references application_payments)
discount_amount   DECIMAL(10, 2)
used_at           TIMESTAMP
```

## 🔄 Future Enhancements

1. **Service Fee Only Discounts**: Implement the logic from `PROMO_CODE_DISCOUNT_LOGIC.md`
2. **Usage Analytics**: Dashboard showing promo code performance
3. **Email Integration**: Automatically send promo codes to clients
4. **Referral Codes**: Generate unique codes for client referrals
5. **Tiered Discounts**: Different discounts based on user type or history
6. **Promo Code Templates**: Pre-set configs for common scenarios
7. **Bulk Import**: CSV upload for creating multiple codes
8. **User-Specific Codes**: Codes that only work for specific clients

## ✨ Summary

You now have a complete, production-ready promo code system that:
- ✅ Allows admins to create and manage discount codes
- ✅ Lets clients apply codes at checkout for instant savings
- ✅ Works for both authenticated and public checkout links
- ✅ Tracks usage and prevents abuse
- ✅ Has a beautiful, intuitive UI
- ✅ Is fully documented and maintainable

The system is ready to use immediately after running the SQL migration!

