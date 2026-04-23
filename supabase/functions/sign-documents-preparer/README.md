# Sign Documents Preparer Edge Function

This edge function handles adding preparer signatures to client-signed documents.

## Features

- **I-765 Preparer Signing**: Adds signature to I-765 form page 6 (preparer section)
- **Image Support**: Supports both PNG and JPG signature images
- **Error Handling**: Graceful error handling with detailed error messages

## How It Works

1. Receives client-signed PDF (base64) and signature image (data URL)
2. Loads the PDF using pdf-lib
3. Embeds the signature image
4. Adds signature to I-765 page 6 (preparer signature section)
5. Returns the signed PDF as base64

## Signature Placement

- **I-765 Page 6**: Bottom left area (10% from left, 15% from bottom)

## Deployment

```bash
supabase functions deploy sign-documents-preparer
```

## Request Format

```json
{
  "clientSignedPdf": "base64-encoded-client-signed-pdf",
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

