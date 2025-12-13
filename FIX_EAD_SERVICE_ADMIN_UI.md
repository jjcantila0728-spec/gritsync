# Fix Your EAD Service via Admin UI

## The Problem

The application code is looking for a service with specific values:
- **Service Name**: Must be exactly `"EAD Processing"`
- **State**: Must match the state in your application (probably `"New York"`)
- **Payment Type**: Must be `"Full Payment"`

Your manually created service (ID: `svc_1765578840968`) might have different values.

---

## ✅ Solution Option 1: Update via Admin UI (Easiest)

### Step 1: Go to Admin Settings
1. Navigate to: http://localhost:5000/admin/settings
2. Click on **"Services"** tab

### Step 2: Find Your EAD Service
1. Look for the service with ID: `svc_1765578840968`
2. Click the **"Edit"** button

### Step 3: Update These Fields

Make sure these **EXACT** values are set:

| Field | Required Value |
|-------|---------------|
| **Service Name** | `EAD Processing` |
| **State** | `New York` |
| **Payment Type** | `Full Payment` |

**IMPORTANT**: The values must match EXACTLY (case-sensitive, no extra spaces)

### Step 4: Save
1. Click **"Save Service"**
2. You should see a success message

### Step 5: Test
1. Go back to: http://localhost:5000/applications/AP9B83G6Y8HQNH/payments
2. Refresh the page (F5)
3. The error should be gone! ✅

---

## ✅ Solution Option 2: Update via SQL (Faster)

Run this in Supabase SQL Editor:

```sql
UPDATE services
SET 
  service_name = 'EAD Processing',
  state = 'New York',
  payment_type = 'full'
WHERE id = 'svc_1765578840968';
```

Then verify:

```sql
SELECT * FROM services WHERE id = 'svc_1765578840968';
```

You should see:
- service_name: `EAD Processing`
- state: `New York`
- payment_type: `full`

---

## 🔍 How to Check What State Your Application Has

If you're not sure what state to use, run this SQL query:

```sql
SELECT 
  grit_app_id,
  application_type,
  state,
  first_name,
  last_name
FROM applications
WHERE grit_app_id = 'AP9B83G6Y8HQNH';
```

Use whatever `state` value you see in the result.

---

## 🎯 Why This Matters

The application code does this lookup:

```typescript
const serviceName = 'EAD Processing'  // Hardcoded
const serviceState = application?.state || 'New York'  // From application
const paymentType = 'full'  // Hardcoded for EAD

const service = await servicesAPI.getByServiceStateAndPaymentType(
  serviceName,    // Must be: 'EAD Processing'
  serviceState,   // Must match application's state
  paymentType     // Must be: 'full'
)
```

So your service MUST have:
- ✅ `service_name = 'EAD Processing'`
- ✅ `state = <whatever is in the application>`
- ✅ `payment_type = 'full'`

If any of these don't match, the query returns nothing and you see the error.

---

## 📝 Quick Checklist

- [ ] Service Name is exactly: `EAD Processing` (case-sensitive)
- [ ] State matches what's in the application (check with SQL query above)
- [ ] Payment Type is: `Full Payment` (which stores as `'full'` in database)
- [ ] Saved the changes
- [ ] Refreshed the payments page

---

## ✨ After Fixing

Once the values match, the payments page will:
- ✅ Load the service successfully
- ✅ Display payment details with your line items
- ✅ Calculate totals correctly
- ✅ Show the "Pay Now" button
- ✅ Allow payment processing

---

**Still having issues?** Check:
1. Browser console for errors (F12 → Console tab)
2. Service was saved successfully (check in Admin Settings)
3. Application's state value (use SQL query above)
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

