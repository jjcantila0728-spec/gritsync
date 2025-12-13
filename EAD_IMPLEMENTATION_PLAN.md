# EAD Application Implementation Plan

## ✅ Completed

1. **Service Selection Page** (`/application/new`)
   - Created `ApplicationServiceSelection.tsx`
   - Users can select between NCLEX and EAD services

2. **EAD Application Form** (`/application/new/ead`)
   - Created comprehensive 12-step form covering all I-765 fields
   - Includes validation, date formatting, conditional fields
   - Auto-populates from saved user details

3. **Database Migration**
   - Created `supabase/migrations/add-ead-application-support.sql`
   - Adds `application_type` column
   - Makes NCLEX-specific fields nullable
   - Adds all EAD-specific fields

4. **API Updates**
   - Updated `applicationsAPI.create()` to handle both NCLEX and EAD applications
   - EAD applications don't require document uploads
   - Creates initial timeline step on application creation

## 🔄 In Progress / Next Steps

### 1. ApplicationDetail Page Updates
**File**: `src/pages/ApplicationDetail.tsx`

**Changes Needed**:
- Detect `application_type` from application data
- Show EAD-specific information in Details tab:
  - Part 1: Reason for filing, attorney information
  - Part 2: Legal name, address, personal info, SSN, parents, immigration info, eligibility
  - Part 3: Contact information
  - Part 4: Interpreter information (if applicable)
  - Part 5: Preparer information (if applicable)
  - Declaration and signature
- Create EAD-specific timeline steps:
  - Application Submission
  - Form Review
  - USCIS Submission
  - Biometrics Appointment (if required)
  - RFE Response (if applicable)
  - Approval/Denial
- Hide NCLEX-specific sections (documents, processing accounts, etc.) for EAD applications
- Update PDF generation to support EAD applications

### 2. Tracking Page Updates
**File**: `src/pages/Tracking.tsx`

**Changes Needed**:
- Add filter by application type (NCLEX/EAD/All)
- Display application type badge in application cards
- Update search to work with both types
- Ensure EAD applications show correct status and progress

### 3. Dashboard Updates
**File**: `src/pages/Dashboard.tsx`

**Changes Needed**:
- Show separate counts for NCLEX and EAD applications
- Add filter/tabs to view by application type
- Update statistics to include EAD applications

### 4. EAD Timeline Steps
**File**: `src/lib/supabase-api.ts` (timelineStepsAPI)

**Changes Needed**:
- Add EAD-specific step keys and names:
  - `ead_app_submission`: "Application Submission"
  - `ead_form_review`: "Form Review"
  - `ead_uscis_submission`: "USCIS Submission"
  - `ead_biometrics`: "Biometrics Appointment"
  - `ead_rfe`: "Request for Evidence (RFE)"
  - `ead_approval`: "EAD Approval"
  - `ead_denial`: "EAD Denial"
- Update `getAll()` to handle EAD timeline steps correctly

### 5. Application Payments
**Consideration**: EAD applications may have different payment structure
- May not need staggered payments
- May have different pricing
- Update payment flow if needed

## 📋 Database Migration Instructions

To apply the database migration:

1. **Via Supabase Dashboard**:
   - Go to SQL Editor
   - Copy contents of `supabase/migrations/add-ead-application-support.sql`
   - Execute the migration

2. **Via CLI** (if using Supabase CLI):
   ```bash
   supabase db push
   ```

## 🧪 Testing Checklist

- [ ] Create EAD application via form
- [ ] Verify application appears in tracking page
- [ ] Verify application detail page shows EAD information correctly
- [ ] Verify timeline steps work for EAD
- [ ] Test filtering by application type
- [ ] Verify dashboard shows EAD applications
- [ ] Test admin view of EAD applications
- [ ] Verify data persistence after page refresh

## 📝 Notes

- EAD applications don't require document uploads (picture, diploma, passport)
- EAD applications have different timeline/workflow than NCLEX
- Some fields are optional for EAD (interpreter, preparer, physical address)
- EAD applications may need different payment processing

