# Sign Documents Client Edge Function

This edge function handles adding client signatures to compiled documents.

## Features

- **Cover Letter Signing**: Adds signature to the first page (cover letter)
- **I-765 Applicant Signing**: Adds signature to I-765 form page 4 (applicant section)
- **Image Support**: Supports both PNG and JPG signature images
- **Error Handling**: Graceful error handling with detailed error messages

## How It Works

1. Receives compiled PDF (base64) and signature image (data URL)
2. Loads the PDF using pdf-lib
3. Embeds the signature image
4. Adds signature to cover letter (first page)
5. Adds signature to I-765 page 4 (applicant signature section)
6. Returns the signed PDF as base64

## Signature Placement

- **Cover Letter**: Bottom left area (10% from left, 10% from bottom)
- **I-765 Page 4**: Bottom left area (10% from left, 15% from bottom)

## Deployment

```bash
supabase functions deploy sign-documents-client
```

## Request Format

```json
{
  "compiledPdf": "base64-encoded-pdf",
  "signatureDataUrl": "data:image/png;base64,..."
}
```

## Response Format

```json
{
  "success": true,
  "pdf": "base64-encoded-signed-pdf",
  "message": "Documents signed successfully"
}
```

