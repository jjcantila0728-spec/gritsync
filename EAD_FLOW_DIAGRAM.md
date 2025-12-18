# EAD Application Payment Flow Diagram

## Complete Flow Visualization

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER ACCESSES EAD FORM                          │
│                  http://localhost:5000/application/new/ead          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   USER FILLS OUT 11-STEP FORM                       │
│  Step 1:  Reason for Filing                                         │
│  Step 2:  Legal Name Information                                    │
│  Step 3:  Address Information                                       │
│  Step 4:  Personal Information                                      │
│  Step 5:  Social Security Information                               │
│  Step 6:  Parents' Information                                      │
│  Step 7:  Immigration & Arrival                                     │
│  Step 8:  Eligibility Category                                      │
│  Step 9:  Contact Information                                       │
│  Step 10: Interpreter Information                                   │
│  Step 11: Review & Digital Signature ✍️                             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              USER CLICKS "SUBMIT APPLICATION"                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SYSTEM CREATES APPLICATION RECORD                       │
│  • application_type = 'EAD'                                         │
│  • status = 'pending'                                               │
│  • All form data saved                                              │
│  • Generates GRIT APP ID (e.g., AP9B83G6Y8HQNH)                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│           SYSTEM FETCHES EAD SERVICE PRICING                        │
│  Query: servicesAPI.getAllByServiceAndState(                        │
│           'EAD Processing',                                         │
│           state || 'New York'                                       │
│         )                                                           │
│                                                                     │
│  Returns: {                                                         │
│    service_name: 'EAD Processing',                                  │
│    state: 'New York',                                               │
│    payment_type: 'full',                                            │
│    line_items: [                                                    │
│      { description: 'USCIS I-765 Fee', amount: 410, taxable: false },│
│      { description: 'Biometric Fee', amount: 85, taxable: false },  │
│      { description: 'GritSync Fee', amount: 150, taxable: true }    │
│    ],                                                               │
│    total_full: 663.00,  // Includes $18 tax                         │
│    tax_amount: 18.00                                                │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SYSTEM CREATES PAYMENT RECORD                          │
│  applicationPaymentsAPI.create(                                     │
│    application.id,                                                  │
│    'full',                                                          │
│    663.00                                                           │
│  )                                                                  │
│                                                                     │
│  Creates record in application_payments:                            │
│  • payment_type = 'full'                                            │
│  • amount = 663.00                                                  │
│  • service_fee_amount = 150.00                                      │
│  • status = 'pending'                                               │
│  • payment_id generated                                             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  REDIRECT TO CHECKOUT PAGE                          │
│  http://localhost:5000/applications/AP9B83G6Y8HQNH/checkout        │
│    ?payment_id={payment_id}                                         │
│                                                                     │
│  Success message: "EAD application submitted successfully!          │
│                    Proceeding to checkout..."                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CHECKOUT PAGE LOADS                             │
│  • Fetches application details                                      │
│  • Fetches payment record                                           │
│  • Creates Stripe payment intent                                    │
│  • Displays payment summary                                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  USER SEES PAYMENT SUMMARY                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Payment Summary                                               │ │
│  │                                                               │ │
│  │ USCIS Form I-765 Filing Fee ...................... $410.00   │ │
│  │ Biometric Services Fee ........................... $85.00    │ │
│  │ GritSync Service Fee ............................. $150.00   │ │
│  │ Tax (12% on service fee) ......................... $18.00    │ │
│  │                                                               │ │
│  │ Total Amount: $663.00                                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                        ┌─────────┴─────────┐
                        ▼                   ▼
        ┌──────────────────────┐  ┌──────────────────────┐
        │  CREDIT CARD PAYMENT │  │ MOBILE BANKING       │
        │  (Stripe)            │  │ (Upload Proof)       │
        └──────────────────────┘  └──────────────────────┘
                        │                   │
                        ▼                   ▼
        ┌──────────────────────┐  ┌──────────────────────┐
        │  Instant Processing  │  │ Admin Review Required│
        │  Payment Succeeds    │  │ Status: pending_approval│
        └──────────────────────┘  └──────────────────────┘
                        │                   │
                        └─────────┬─────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PAYMENT STATUS UPDATED                                 │
│  • Card payment: status = 'paid' (instant)                          │
│  • Mobile banking: status = 'pending_approval' (awaits admin)       │
│  • Receipt generated (for card payments)                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              REDIRECT TO PAYMENTS PAGE                              │
│  http://localhost:5000/applications/AP9B83G6Y8HQNH/payments        │
│                                                                     │
│  User can:                                                          │
│  • View payment status                                              │
│  • Download receipt (if paid)                                       │
│  • Upload additional proof (if needed)                              │
│  • View payment history                                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Admin Settings Configuration

```
┌─────────────────────────────────────────────────────────────────────┐
│              ADMIN SETTINGS → SERVICES                              │
│  http://localhost:5000/admin/settings/services                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CREATE EAD SERVICE CONFIGURATION                       │
│                                                                     │
│  Service Name: EAD Processing                                       │
│  State: New York                                                    │
│  Payment Type: Full Payment                                         │
│                                                                     │
│  Line Items:                                                        │
│  1. USCIS Form I-765 Filing Fee                                     │
│     Amount: $410.00                                                 │
│     Taxable: ☐ No                                                   │
│                                                                     │
│  2. Biometric Services Fee                                          │
│     Amount: $85.00                                                  │
│     Taxable: ☐ No                                                   │
│                                                                     │
│  3. GritSync Service Fee                                            │
│     Amount: $150.00                                                 │
│     Taxable: ☑ Yes (12% tax = $18.00)                               │
│                                                                     │
│  Total: $663.00 (includes $18 tax)                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SERVICE SAVED TO DATABASE                              │
│  services table:                                                    │
│  • id: 'svc_ead_ny_full'                                            │
│  • service_name: 'EAD Processing'                                   │
│  • state: 'New York'                                                │
│  • payment_type: 'full'                                             │
│  • line_items: [JSON array]                                         │
│  • total_full: 663.00                                               │
│  • tax_amount: 18.00                                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Payment Management Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│              USER/ADMIN VIEWS PAYMENTS PAGE                         │
│  http://localhost:5000/applications/AP9B83G6Y8HQNH/payments        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SYSTEM LOADS APPLICATION & PAYMENTS                    │
│                                                                     │
│  1. Fetch application by ID                                         │
│  2. Detect application_type = 'EAD'                                 │
│  3. Load EAD service config                                         │
│  4. Fetch payment records                                           │
│  5. Display payment details with line items                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              DISPLAY PAYMENT INFORMATION                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Payment #1 - Full Payment                                     │ │
│  │ Status: ● Paid                                                │ │
│  │ Amount: $663.00                                               │ │
│  │ Date: Dec 12, 2025                                            │ │
│  │                                                               │ │
│  │ Line Items:                                                   │ │
│  │ • USCIS Form I-765 Filing Fee: $410.00                       │ │
│  │ • Biometric Services Fee: $85.00                              │ │
│  │ • GritSync Service Fee: $150.00                               │ │
│  │ • Tax (12%): $18.00                                           │ │
│  │                                                               │ │
│  │ [Download Receipt] [View Details]                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│         WHAT IF SERVICE CONFIGURATION DOESN'T EXIST?                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              APPLICATION SUBMITS SUCCESSFULLY                       │
│  ✅ Application record created                                      │
│  ❌ Payment creation fails (no service found)                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              GRACEFUL FALLBACK                                      │
│  Message: "Application submitted! You can complete payment          │
│            from your application dashboard."                        │
│                                                                     │
│  Redirect to: /applications/AP9B83G6Y8HQNH/timeline                │
│                                                                     │
│  User can:                                                          │
│  • View their application                                           │
│  • Contact support                                                  │
│  • Pay later once service is configured                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Key URLs Reference

| Purpose | URL | Description |
|---------|-----|-------------|
| **EAD Application Form** | `/application/new/ead` | 11-step form for EAD application |
| **Checkout Page** | `/applications/{id}/checkout?payment_id={payment_id}` | Payment page with Stripe/mobile banking |
| **Payments Management** | `/applications/{id}/payments` | View and manage all payments |
| **Application Timeline** | `/applications/{id}/timeline` | View application progress |
| **Admin Services Settings** | `/admin/settings/services` | Configure service pricing |
| **Admin Payment Review** | `/admin/applications/{id}/payments` | Admin payment management |

## Database Tables Reference

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `applications` | Store application data | `id`, `application_type='EAD'`, `state`, `status` |
| `application_payments` | Store payment records | `id`, `application_id`, `amount=663.00`, `status` |
| `services` | Store service pricing | `service_name='EAD Processing'`, `line_items`, `total_full` |
| `receipts` | Store payment receipts | `payment_id`, `pdf_url` |

## Quick Setup Checklist

- [ ] Run `setup_ead_service.sql` in Supabase SQL Editor
- [ ] Verify service exists: Check Admin Settings → Services
- [ ] Test EAD form submission: Fill out and submit test application
- [ ] Test checkout flow: Complete payment with test card (4242 4242 4242 4242)
- [ ] Verify receipt generation: Check payments page
- [ ] Test admin approval: Upload mobile banking proof and approve as admin

## Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| ● **Pending** | 🟡 Yellow | Payment created, awaiting payment |
| ● **Pending Approval** | 🟠 Orange | Mobile banking proof uploaded, awaiting admin approval |
| ● **Paid** | 🟢 Green | Payment completed successfully |
| ● **Failed** | 🔴 Red | Payment failed or declined |
| ● **Cancelled** | ⚪ Gray | Payment cancelled by user or admin |










