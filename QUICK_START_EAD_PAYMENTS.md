# Quick Start: EAD Payment Setup

## ⚡ 3-Minute Setup

### Step 1: Run SQL Script (1 minute)
1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste from `setup_ead_service.sql`
4. Click **Run**
5. Verify: Should see "EAD Processing - New York" service

### Step 2: Test the Flow (2 minutes)
1. Go to `http://localhost:5000/application/new/ead`
2. Fill out the form (you can use test data)
3. Submit the application
4. You should be redirected to checkout
5. Use test card: `4242 4242 4242 4242`
6. Complete payment
7. Verify you see the receipt

## ✅ That's It!

The system is now fully configured and ready to process EAD applications with payments.

---

## 📋 Quick Reference

### URLs
- **EAD Form**: `/application/new/ead`
- **Checkout**: `/applications/{id}/checkout?payment_id={payment_id}`
- **Payments**: `/applications/{id}/payments`
- **Admin Services**: `/admin/settings/services`

### Pricing
- **USCIS Filing Fee**: $410
- **Biometric Fee**: $85
- **GritSync Service Fee**: $150 (+ $18 tax)
- **Total**: $663

### Test Cards
- **Success**: 4242 4242 4242 4242
- **Requires 3D Secure**: 4000 0025 0000 3155
- **Declined**: 4000 0000 0000 9995

---

## 🆘 Troubleshooting

### Problem: "Service not configured"
**Solution**: Run `setup_ead_service.sql`

### Problem: Wrong amount
**Solution**: Check Admin Settings → Services → EAD Processing

### Problem: Payment not created
**Solution**: Check browser console, verify service exists

---

## 📖 Full Documentation

For detailed information, see:
- `EAD_PAYMENT_SETUP.md` - Complete setup guide
- `EAD_PAYMENT_IMPLEMENTATION_SUMMARY.md` - Technical details
- `EAD_FLOW_DIAGRAM.md` - Visual flow diagrams

---

## 💡 Key Points

1. **EAD applications always use full payment** (no staggered payments)
2. **Only GritSync fee is taxable** (12% = $18)
3. **Government fees are pass-through** (no tax, no discounts)
4. **Promo codes only apply to service fee** ($150, not the full $663)
5. **The system auto-detects EAD apps** and uses correct pricing

---

## 🎯 Success Criteria

You'll know it's working when:
- ✅ EAD form submission redirects to checkout
- ✅ Checkout shows $663 total with correct line items
- ✅ Payment completes and shows "paid" status
- ✅ Receipt is generated and downloadable
- ✅ Admin can see payment in dashboard

---

**Need help?** Check the full documentation or contact support.

