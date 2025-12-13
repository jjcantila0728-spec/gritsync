# EAD Application Payment Setup Guide

## Overview
This guide explains how to set up payment processing for EAD (Employment Authorization Document) applications. The EAD application form is accessible at `/application/new/ead`.

## Payment Flow

1. **Application Submission**: When a user submits an EAD application (Form I-765), the system:
   - Creates the application record
   - Fetches the EAD service pricing configuration
   - Creates a payment record
   - Redirects the user to the checkout page

2. **Checkout**: The user is directed to `/applications/{id}/checkout?payment_id={payment_id}` where they can:
   - Pay via credit card (Stripe)
   - Pay via mobile banking (GCash, etc.)
   - View payment details and line items

3. **Payment Management**: After checkout, users can manage their payments at:
   - `/applications/{id}/payments` - View and manage all payments for the application

## Admin Configuration Required

### Step 1: Create EAD Service in Admin Settings

1. Navigate to **Admin Settings > Services** (`/admin/settings/services`)
2. Click **"Add New Service"**
3. Configure the EAD service as follows:

#### Service Configuration Example

**Basic Settings:**
- **Service Name**: `EAD Processing`
- **State**: `New York` (or applicable state from the application)
- **Payment Type**: `Full Payment` (EAD applications typically require full payment upfront)

#### Line Items Example

Based on current I-765 (EAD) filing fees and typical service costs:

1. **USCIS Filing Fee** - `$410.00` (not taxable)
   - This is the official USCIS fee for Form I-765
   - Step: N/A (full payment)
   - Taxable: ☐ No

2. **Biometric Services Fee** - `$85.00` (not taxable)
   - USCIS biometric services fee (if applicable)
   - Step: N/A (full payment)
   - Taxable: ☐ No

3. **GritSync Service Fee** - `$150.00` (taxable)
   - GritSync processing and assistance fee
   - Step: N/A (full payment)
   - Taxable: ☑ Yes (12% tax = $18.00)

**Total Calculation:**
- Subtotal: $645.00
- Tax (12% on $150): $18.00
- **Grand Total: $663.00**

### Step 2: Verify Service Configuration

After creating the service, verify it appears correctly:

1. Go to **Admin Settings > Services**
2. Find **"EAD Processing - New York"**
3. Verify the line items and totals are correct
4. Ensure the payment type is set to **"Full Payment"**

### Important Notes

#### Government Fees (Not Taxable)
- USCIS Filing Fee: $410
- Biometric Services Fee: $85 (may vary based on applicant's situation)

**These fees are pass-through charges to USCIS and should NOT be marked as taxable.**

#### GritSync Service Fee (Taxable)
- Base Fee: $150
- Tax Rate: 12%
- Tax Amount: $18

**The GritSync service fee is subject to 12% tax.**

#### Fee Updates
USCIS fees may change periodically. Always verify current fees at:
https://www.uscis.gov/i-765

When fees change:
1. Update the line items in Admin Settings > Services
2. Existing applications retain their original pricing
3. New applications use the updated pricing

### Step 3: Multiple State Support (Optional)

If you process EAD applications for multiple states, create separate service configurations:

1. **EAD Processing - New York** - `$663.00`
2. **EAD Processing - California** - `$663.00`
3. **EAD Processing - Texas** - `$663.00`

The system will automatically select the appropriate service based on the state specified in the application.

## Payment Types Supported

### 1. Credit Card (Stripe)
- Instant payment processing
- Automatic receipt generation
- Payment confirmation emails

### 2. Mobile Banking
- User uploads proof of payment
- Admin reviews and approves manually
- Status updates via notifications

## Testing the Flow

### Test as a User

1. **Create an EAD Application**:
   - Go to `/application/new/ead`
   - Fill out all required fields (11 steps)
   - Submit the application

2. **Verify Redirect to Checkout**:
   - Should redirect to `/applications/{id}/checkout?payment_id={payment_id}`
   - Verify payment amount matches service configuration
   - Verify line items are displayed correctly

3. **Complete Payment**:
   - Test with Stripe test cards
   - Test mobile banking upload

4. **Verify Payment Confirmation**:
   - Check application payments page: `/applications/{id}/payments`
   - Verify payment status is updated
   - Verify receipt is generated (for card payments)

### Test Cards (Stripe Test Mode)

- **Success**: `4242 4242 4242 4242`
- **Requires Authentication**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 9995`

Use any future expiration date and any 3-digit CVC.

## Admin Payment Management

Admins can manage payments at:
- **Individual Application**: `/admin/applications/{id}/payments`
- **All Payments**: Search by application ID in the admin dashboard

### Admin Actions Available:
1. View payment status
2. Approve/reject mobile banking payments
3. View proof of payment uploads
4. Generate receipts
5. Add admin notes

## Promo Codes (Optional)

Promo codes apply **ONLY** to the GritSync Service Fee ($150), not to government fees.

Example:
- Total: $663.00
- GritSync Fee: $150.00 + $18.00 tax
- Government Fees: $495.00

With "WELCOME10" (10% off):
- Discount: $15.00 (10% of $150)
- New Total: $648.00

See `PROMO_CODE_SETUP_INSTRUCTIONS.md` for promo code configuration.

## Troubleshooting

### Issue: "EAD payment service not configured"
**Solution**: Create the EAD service in Admin Settings > Services

### Issue: Wrong amount charged
**Solution**: Verify the service line items match current USCIS fees

### Issue: Payment not created after submission
**Solution**: 
1. Check browser console for errors
2. Verify the service configuration exists
3. Check that the application's state matches a configured service

### Issue: Checkout page shows error
**Solution**:
1. Verify payment record exists in database
2. Check Stripe configuration (publishable key)
3. Verify payment intent creation in Supabase Edge Function

## Database Schema

### Applications Table
- `application_type`: `'EAD'` for EAD applications
- `state`: Used to determine which service configuration to use

### Application Payments Table
- `application_id`: Links to the application
- `payment_type`: `'full'` for EAD (no staggered payments)
- `amount`: Total amount from service configuration
- `service_fee_amount`: $150 (for promo code calculation)
- `status`: `'pending'`, `'paid'`, `'failed'`, `'cancelled'`

### Services Table
- `service_name`: `'EAD Processing'`
- `state`: `'New York'`, etc.
- `payment_type`: `'full'`
- `line_items`: JSON array of fee items
- `total_full`: Total amount including tax

## Support

For issues or questions:
1. Check the browser console for errors
2. Check Supabase logs for backend errors
3. Verify Stripe dashboard for payment issues
4. Contact technical support with:
   - Application ID
   - Payment ID
   - Error messages
   - Steps to reproduce

## Summary

The EAD payment flow is now integrated with the application submission process:

1. ✅ User submits EAD application → System creates payment → Redirects to checkout
2. ✅ User completes payment → Payment recorded → Application updated
3. ✅ Admin can manage payments → View, approve, generate receipts
4. ✅ Supports multiple payment methods → Credit card, mobile banking
5. ✅ Respects service configuration → Dynamic pricing based on admin settings

**Next Step**: Create the EAD service configuration in Admin Settings > Services

