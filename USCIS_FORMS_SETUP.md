# USCIS Forms Auto-Generation Setup Guide

This guide explains how to set up and use the USCIS Forms Auto-Generation system in GritSync.

## Overview

The system automatically fills official USCIS forms (G-1145 and I-765) with applicant data using AI-powered field mapping. The filled PDFs remain editable in Adobe Acrobat Reader.

## Features

- ✅ Auto-fill G-1145 (E-Notification of Application/Petition Acceptance)
- ✅ Auto-fill I-765 (Application for Employment Authorization)
- ✅ AI-powered field mapping using OpenAI GPT-4
- ✅ Server-side PDF processing via Supabase Edge Functions
- ✅ Forms remain fillable in Adobe Acrobat Reader
- ✅ Download or upload to user documents
- ✅ Load data from existing applications

## Architecture

```
Frontend (React)
    ↓
API Service (src/lib/api/uscis-forms.ts)
    ↓
Supabase Edge Function (fill-pdf-form-ai)
    ↓
OpenAI GPT-4 (Field Mapping)
    ↓
pdf-lib (PDF Manipulation)
    ↓
Filled PDF (returned to user)
```

## Setup Instructions

### 1. Supabase Storage Setup

You need to upload the official USCIS PDF forms to Supabase Storage:

1. **Go to your Supabase Dashboard** → Storage

2. **Create a bucket named `USCIS Forms`** (or use existing bucket)
   - Set bucket to **Public** or **Private** (the edge function supports both)
   - If private, ensure your service role key has access

3. **Upload the PDF templates:**
   - Download the official forms from USCIS:
     - G-1145: https://www.uscis.gov/sites/default/files/document/forms/g-1145.pdf
     - I-765: https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf
   
   - Upload them to the `USCIS Forms` bucket with these exact names:
     - `g-1145.pdf`
     - `i-765.pdf`

**IMPORTANT:** The file names must be exactly `g-1145.pdf` and `i-765.pdf` (lowercase).

### 2. Configure OpenAI API Key

The edge function requires an OpenAI API key for AI-powered field mapping:

```bash
# Set the OpenAI API key in Supabase
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

Or set it in your Supabase Dashboard:
1. Go to **Project Settings** → **Edge Functions**
2. Add secret: `OPENAI_API_KEY` = `your_api_key`

### 3. Deploy Edge Functions

Deploy the `fill-pdf-form-ai` edge function:

```bash
# Make sure you're logged in
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy fill-pdf-form-ai
```

### 4. Verify Setup

You can verify the setup by:

1. Log into GritSync as a client
2. Navigate to **USCIS Forms** in the sidebar
3. Fill in your information
4. Click **Generate G-1145** or **Generate I-765**
5. The form should download with your information pre-filled

## Using the Forms

### From the USCIS Forms Page

1. **Navigate to USCIS Forms:**
   - Click "USCIS Forms" in the sidebar menu

2. **Enter Your Information:**
   - Fill in your personal details
   - Expand "Additional Information" for I-765 fields

3. **Generate Form:**
   - Click "Generate G-1145" or "Generate I-765"
   - Wait for the AI to process and fill the form

4. **Download or Upload:**
   - Download the PDF to your computer
   - Or upload it to your documents for safe keeping

### From an Application

You can also generate forms with data from an existing application:

```typescript
// Navigate with application ID
navigate(`/uscis-forms?applicationId=${applicationId}`)
```

The form will automatically load the applicant's data from the application.

## File Structure

```
src/
├── lib/
│   └── api/
│       └── uscis-forms.ts          # API service for form generation
├── pages/
│   └── USCISForms.tsx              # Main forms page
└── components/
    └── Sidebar.tsx                  # Updated with USCIS Forms link

supabase/
└── functions/
    ├── fill-pdf-form/              # Basic PDF filling (legacy)
    │   ├── index.ts
    │   └── README.md
    └── fill-pdf-form-ai/           # AI-powered PDF filling (recommended)
        ├── index.ts
        └── README.md
```

## How It Works

### 1. User Input
User enters their information on the USCIS Forms page or data is loaded from an existing application.

### 2. API Call
The frontend calls the `fill-pdf-form-ai` edge function with:
- Form type (G-1145 or I-765)
- Applicant data (name, address, DOB, etc.)

### 3. PDF Template Fetch
The edge function fetches the official PDF template from Supabase Storage.

### 4. AI Field Mapping
OpenAI GPT-4 analyzes:
- All available PDF form fields
- The applicant data provided
- Intelligently maps data to the correct fields

### 5. PDF Filling
Using `pdf-lib`, the function:
- Fills the mapped fields
- Keeps the form editable (not flattened)
- Returns the filled PDF

### 6. User Downloads
The user receives the filled PDF and can:
- Download it immediately
- Upload it to their documents
- Open it in Adobe Acrobat Reader for final review
- Make any manual adjustments if needed

## API Reference

### `generateUSCISForm(formType, data)`

Generate and fill a USCIS form.

**Parameters:**
- `formType`: `'G-1145'` | `'I-765'`
- `data`: `USCISFormData` object with applicant information

**Returns:** `Promise<Blob>` - The filled PDF as a Blob

**Example:**
```typescript
import { generateG1145, generateI765 } from '@/lib/api/uscis-forms'

// Generate G-1145
const blob = await generateG1145({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  mobileNumber: '+1 555-1234'
})

// Generate I-765
const blob = await generateI765({
  firstName: 'John',
  middleName: 'M',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  // ... more fields
})
```

### `downloadForm(blob, fileName)`

Download a generated form to the user's computer.

**Parameters:**
- `blob`: `Blob` - The PDF blob
- `fileName`: `string` - The file name

**Example:**
```typescript
downloadForm(blob, 'G-1145_John_Doe_2024-01-15.pdf')
```

### `uploadGeneratedForm(blob, fileName, userId)`

Upload a generated form to Supabase Storage.

**Parameters:**
- `blob`: `Blob` - The PDF blob
- `fileName`: `string` - The file name
- `userId`: `string` - The user's ID

**Returns:** `Promise<string>` - The file path in storage

### `getFormDataFromApplication(applicationId)`

Get form data from an existing application.

**Parameters:**
- `applicationId`: `string` - The application ID

**Returns:** `Promise<USCISFormData>` - The form data

## USCISFormData Interface

```typescript
interface USCISFormData {
  // Personal Information
  firstName?: string
  middleName?: string
  lastName?: string
  email?: string
  mobileNumber?: string
  
  // Address
  address?: string
  city?: string
  state?: string
  zipcode?: string
  country?: string
  
  // Birth Information
  dateOfBirth?: string
  countryOfBirth?: string
  
  // Personal Details
  gender?: string
  maritalStatus?: string
  
  // Additional I-765 fields
  alienNumber?: string
  passportNumber?: string
  socialSecurityNumber?: string
  // ... and more
}
```

## Troubleshooting

### "Failed to fetch template from Supabase Storage"

**Solution:**
1. Verify the `USCIS Forms` bucket exists
2. Check that `g-1145.pdf` and `i-765.pdf` are uploaded
3. Ensure file names are exactly correct (lowercase)
4. If bucket is private, verify service role key has access

### "OPENAI_API_KEY not configured"

**Solution:**
1. Set the OpenAI API key in Supabase secrets
2. Redeploy the edge function after setting the secret

### "AI could not map any fields successfully"

**Solution:**
1. The PDF may not have fillable form fields
2. Check the console logs in the edge function
3. The function will return the original PDF for manual filling

### "PDF has no fillable fields"

**Solution:**
The official USCIS PDFs should have fillable fields. If this error occurs:
1. Re-download the official forms from USCIS
2. Ensure you're not using scanned/image PDFs
3. The system will return the original PDF for manual completion

## Security Considerations

1. **Service Role Key:** The edge function uses the service role key to access storage. Keep this secret secure.

2. **OpenAI API:** API calls to OpenAI include form field names and applicant data. Ensure your OpenAI API key is secure.

3. **User Data:** Form data is temporarily processed server-side but not stored by the edge function.

4. **Storage Access:** Filled forms can be uploaded to the user's document storage with proper RLS policies.

## Future Enhancements

- [ ] Support for more USCIS forms (I-130, I-485, etc.)
- [ ] Batch form generation for multiple applicants
- [ ] Form validation and error checking
- [ ] Preview before download
- [ ] Email forms directly to applicants
- [ ] Track form generation history

## Support

For issues or questions:
1. Check the edge function logs in Supabase Dashboard
2. Verify all setup steps are completed
3. Check the browser console for frontend errors
4. Review the OpenAI API usage in your OpenAI dashboard

## Related Files

- [supabase/functions/fill-pdf-form-ai/README.md](supabase/functions/fill-pdf-form-ai/README.md) - Edge function documentation
- [src/lib/api/uscis-forms.ts](src/lib/api/uscis-forms.ts) - API service implementation
- [src/pages/USCISForms.tsx](src/pages/USCISForms.tsx) - UI implementation

---

**Last Updated:** December 12, 2024

