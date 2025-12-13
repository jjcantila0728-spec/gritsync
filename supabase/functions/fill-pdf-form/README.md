# Fill PDF Form Edge Function

This Supabase Edge Function fills official USCIS forms (G-1145, I-765) server-side using pdf-lib.

## Deployment

```bash
supabase functions deploy fill-pdf-form
```

## Usage

### From Frontend

```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/fill-pdf-form`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    formType: 'G-1145', // or 'I-765'
    data: {
      firstName: 'John',
      middleName: 'M',
      lastName: 'Doe',
      email: 'john@example.com',
      mobileNumber: '555-1234',
    },
  }),
})

const pdfBlob = await response.blob()
```

## How It Works

1. Fetches the official PDF template from USCIS.gov
2. Attempts to load the PDF with error handling
3. Tries to fill form fields if they exist
4. Falls back to text overlays if fields don't work
5. Returns the filled PDF as a blob

## Supported Forms

- **G-1145**: E-Notification of Application/Petition Acceptance
- **I-765**: Application for Employment Authorization

## Error Handling

- If PDF cannot be parsed: returns original template
- If fields cannot be filled: attempts text overlays
- If all fails: returns original template with error logged

