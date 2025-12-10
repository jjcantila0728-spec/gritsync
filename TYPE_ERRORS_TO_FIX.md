# TypeScript Errors to Fix

## Summary

The database migrations and fixes are complete, but there are TypeScript type errors because the new tables (careers, career_applications, partner_agencies, nclex_sponsorships, donations) are not defined in `src/lib/database.types.ts`.

## Solution

You need to regenerate the database types from Supabase. Here's how:

### Option 1: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Generate types from your Supabase project
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

### Option 2: Using Supabase Dashboard

1. Go to Supabase Dashboard → Settings → API
2. Scroll to "TypeScript types"
3. Copy the generated types
4. Replace the contents of `src/lib/database.types.ts`

### Option 3: Manual Addition (Temporary)

Add these type definitions to `src/lib/database.types.ts` in the `Database['public']['Tables']` interface:

```typescript
careers: {
  Row: {
    id: string
    title: string
    description: string
    requirements: string | null
    responsibilities: string | null
    location: string | null
    employment_type: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship' | null
    salary_range: string | null
    department: string | null
    is_active: boolean
    is_featured: boolean
    application_deadline: string | null
    application_instructions: string | null
    partner_agency_id: string | null
    views_count: number
    applications_count: number
    created_at: string
    updated_at: string
    created_by: string | null
  }
  Insert: {
    id?: string
    title: string
    description: string
    requirements?: string | null
    responsibilities?: string | null
    location?: string | null
    employment_type?: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship' | null
    salary_range?: string | null
    department?: string | null
    is_active?: boolean
    is_featured?: boolean
    application_deadline?: string | null
    application_instructions?: string | null
    partner_agency_id?: string | null
    views_count?: number
    applications_count?: number
    created_at?: string
    updated_at?: string
    created_by?: string | null
  }
  Update: {
    id?: string
    title?: string
    description?: string
    requirements?: string | null
    responsibilities?: string | null
    location?: string | null
    employment_type?: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship' | null
    salary_range?: string | null
    department?: string | null
    is_active?: boolean
    is_featured?: boolean
    application_deadline?: string | null
    application_instructions?: string | null
    partner_agency_id?: string | null
    views_count?: number
    applications_count?: number
    created_at?: string
    updated_at?: string
    created_by?: string | null
  }
}
// ... (similar for other tables)
```

## Minor Issues to Fix

### Unused Variables (Warnings)
These are non-critical but should be cleaned up:

- `src/components/Header.tsx:304` - `cachedAvatarKey`
- `src/pages/ApplicationDetail.tsx:151` - `phoneNumber` (but used later, check line 4912)
- `src/pages/Career.tsx:12` - `Textarea` import
- `src/pages/CareerListing.tsx:2` - `Link` import
- `src/pages/Donate.tsx:22` - `navigate`
- `src/pages/NCLEXSponsorship.tsx:13` - `userDocumentsAPI` import
- And a few more...

### Type Assertions
Some type assertions need to be fixed after types are added:
- `src/pages/AdminCareers.tsx:178` - CareerApplication type
- `src/pages/AdminDonations.tsx:86` - Donation type
- `src/pages/AdminPartnerAgencies.tsx:82` - PartnerAgency type
- `src/pages/AdminSponsorships.tsx:101` - Sponsorship type

## Priority

1. **HIGH**: Regenerate database types (fixes 90% of errors)
2. **MEDIUM**: Fix unused variables
3. **LOW**: Fix type assertions (may auto-fix after step 1)

## Note

These are **compile-time errors only**. The application will still run, but TypeScript won't provide type safety for the new tables until types are added.



