# Generate Cover Letter Edge Function

This edge function generates a cover letter PDF for EAD applications server-side.

## Features

- **Server-side PDF Generation**: Creates PDF directly using pdf-lib
- **Template Support**: Formats cover letter according to USCIS requirements
- **Address Formatting**: Handles both EAD and non-EAD address formats
- **Service Center Integration**: Supports custom service center addresses
- **Error Handling**: Graceful error handling with detailed error messages

## How It Works

1. Receives application data and optional forms verified data
2. Formats applicant address based on application type (EAD vs non-EAD)
3. Gets service center information and fee amount
4. Creates PDF with proper formatting:
   - Sender address
   - Date
   - Recipient address
   - Subject line
   - Body paragraphs with document list
   - Closing and signature
5. Returns the PDF as base64

## Deployment

```bash
supabase functions deploy generate-cover-letter
```

## Request Format

```json
{
  "applicationData": {
    "first_name": "John",
    "middle_name": "M",
    "last_name": "Doe",
    "application_type": "EAD",
    "street_address": "123 Main St",
    "apartment_suite": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "zip_code": "10001",
    "country": "United States",
    "mobile_number": "555-1234",
    "email": "john@example.com",
    "spouse_first_name": "Jane",
    "spouse_last_name": "Doe"
  },
  "formsVerifiedData": {
    "serviceCenter": {
      "address": {
        "name": "USCIS",
        "attn": "H-4 EAD",
        "poBox": "P.O. Box 20400",
        "city": "Phoenix",
        "state": "AZ",
        "zip": "85036-0400"
      }
    },
    "latestFee": "$520"
  }
}
```

## Response Format

```json
{
  "success": true,
  "pdf": "base64-encoded-pdf",
  "message": "Cover letter generated successfully"
}
```

## PDF Formatting

- **Page Size**: Letter (8.5" x 11")
- **Font**: Times New Roman
- **Margins**: 0.75" sides, 0.5" top/bottom
- **Border**: 1px black border around content
- **Text Alignment**: Justified body text, left-aligned addresses






