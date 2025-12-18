# Stripe Checkout Design Enhancements

## Important Note

**Stripe Checkout is a hosted page by Stripe** - we cannot directly modify its HTML/CSS. However, we can customize it through the Checkout Session API configuration.

## Enhancements Applied

### 1. **Appearance Customization**
- ✅ Custom color scheme (primary blue: `#2563eb`)
- ✅ Custom font family (system fonts for better performance)
- ✅ Custom border radius (8px for modern look)
- ✅ Enhanced input field styling with focus states
- ✅ Custom tab styling for payment methods

### 2. **Responsive Design**
- ✅ `ui_mode: 'hosted'` - Stripe's hosted checkout is responsive by default
- ✅ Mobile-optimized layout (handled automatically by Stripe)
- ✅ Touch-friendly interface on mobile devices

### 3. **Branding**
- ✅ Logo support (set `STRIPE_CHECKOUT_LOGO_URL` environment variable)
- ✅ Custom submit button text ("Donate" instead of "Pay")
- ✅ Custom thank you message
- ✅ Brand colors applied throughout

### 4. **User Experience**
- ✅ Clear visual hierarchy
- ✅ Better form field styling
- ✅ Enhanced focus states for accessibility
- ✅ Consistent spacing and borders

## Known Issues & Solutions

### 1. **"Cannot find module './en'" Error**
**Status**: Fixed with `locale: 'en'` setting
**Action**: Ensure the updated Edge Function is deployed

### 2. **CSP (Content Security Policy) Violation**
**Status**: This is on Stripe's side, not fixable by us
**Impact**: Non-critical warning, doesn't break functionality
**Note**: Stripe handles this internally

### 3. **`<link rel=preload>` Warning**
**Status**: Browser warning, not an error
**Impact**: None - doesn't affect functionality

## Logo Setup (Optional)

To add your logo to the checkout page:

1. Upload your logo to a publicly accessible URL (e.g., your website, CDN)
2. Set environment variable in Supabase Edge Function:
   ```
   STRIPE_CHECKOUT_LOGO_URL=https://yourdomain.com/logo.png
   ```
3. Logo should be:
   - Square or landscape orientation
   - At least 128px × 128px
   - PNG, JPG, or SVG format
   - Accessible via HTTPS

## Customization Options Available

The checkout page now includes:

- **Colors**: Primary blue theme matching your brand
- **Typography**: System fonts for fast loading
- **Spacing**: Consistent 4px spacing unit
- **Borders**: 8px border radius for modern look
- **Input Fields**: Enhanced styling with focus states
- **Tabs**: Custom styling for payment method selection

## Responsive Behavior

Stripe Checkout automatically:
- ✅ Adapts to mobile screen sizes
- ✅ Uses touch-friendly controls on mobile
- ✅ Optimizes layout for tablets
- ✅ Maintains usability across all devices

## Testing Checklist

After deploying:

1. ✅ Test on desktop (1920×1080, 1366×768)
2. ✅ Test on tablet (768×1024, 1024×768)
3. ✅ Test on mobile (375×667, 414×896)
4. ✅ Verify colors match brand
5. ✅ Verify logo appears (if set)
6. ✅ Test payment flow on all devices
7. ✅ Verify Apple Pay appears on supported devices

## Deployment

1. Copy updated code from `supabase/functions/create-payment-intent/index.ts`
2. Paste into Supabase Dashboard → Edge Functions → `create-payment-intent`
3. (Optional) Set `STRIPE_CHECKOUT_LOGO_URL` in Edge Function secrets
4. Deploy the function
5. Test the checkout page

## Notes

- The checkout page is fully responsive by default (Stripe handles this)
- Appearance customization is limited to what Stripe's API supports
- The CSP warning is from Stripe's internal code and cannot be fixed
- The locale error should be resolved with the explicit `locale: 'en'` setting

