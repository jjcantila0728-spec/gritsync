# AI-Powered PDF Form Filling Edge Function

This Edge Function uses OpenAI GPT-4 to intelligently fill USCIS immigration forms (G-1145 and I-765) with applicant data.

## Features

- **AI-Powered Field Mapping**: Uses OpenAI's GPT-4 model to intelligently map applicant data to PDF form fields
- **Official Form Download**: Fetches the latest official forms directly from USCIS
- **Intelligent Field Recognition**: AI understands form field names and maps data appropriately
- **Smart Formatting**: Automatically formats dates, phone numbers, and addresses according to USCIS standards
- **Save As Functionality**: Generates unique filenames with client name and date

## Supported Forms

- **G-1145**: e-Notification of Application/Petition Acceptance
- **I-765**: Application for Employment Authorization Document

## Setup

### 1. Set Environment Variable

The function requires an OpenAI API key. Set it in your Supabase project:

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
```

Or via Supabase Dashboard:
1. Go to Project Settings → Edge Functions
2. Add secret: `OPENAI_API_KEY` = `your-api-key`

### 2. Deploy the Function

```bash
supabase functions deploy fill-pdf-form-ai
```

### 3. Verify Deployment

```bash
curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/fill-pdf-form-ai' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"formType":"G-1145","data":{"firstName":"John","lastName":"Doe","email":"john@example.com"}}'
```

## API Reference

### Request

**Endpoint**: `POST /functions/v1/fill-pdf-form-ai`

**Headers**:
- `Authorization: Bearer <supabase_anon_key>`
- `Content-Type: application/json`

**Body**:
```json
{
  "formType": "G-1145" | "I-765",
  "data": {
    "firstName": "string",
    "middleName": "string",
    "lastName": "string",
    "email": "string",
    "mobileNumber": "string",
    "address": "string",
    "city": "string",
    "province": "string",
    "zipcode": "string",
    "country": "string",
    "dateOfBirth": "MM/DD/YYYY",
    "countryOfBirth": "string",
    "gender": "string",
    "maritalStatus": "string",
    // ... additional fields
  }
}
```

### Response

**Success (200)**:
- Returns a PDF blob with filled form data
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="FormType_ClientName_Date_AI_Filled.pdf"`

**Error (500)**:
```json
{
  "error": "Error message",
  "details": "Stack trace"
}
```

## How It Works

1. **Fetch Official Form**: Downloads PDF form from your Supabase Storage (USCIS Forms bucket)
2. **Load PDF**: Parses the PDF and extracts all fillable field names
3. **AI Analysis**: Sends field names and applicant data to OpenAI GPT-4
4. **Intelligent Mapping**: AI determines which data goes in which fields
5. **Fill Form**: Populates the PDF fields with mapped data
6. **Return PDF**: Returns the filled PDF with a descriptive filename

## Error Handling

The function includes comprehensive error handling:
- Failed PDF downloads
- PDF parsing errors
- OpenAI API failures
- Field mapping errors
- PDF save errors

All errors are logged and returned with detailed messages.

## Cost Considerations

- **OpenAI API**: ~$0.01-0.02 per form fill (using GPT-4)
- **Supabase Storage**: Included in free tier (1GB storage, 2GB bandwidth)
- **Supabase Edge Functions**: Included in free tier (500K invocations/month)

## Advantages Over Traditional Method

### Traditional Method:
- ❌ Hard-coded field name patterns
- ❌ Fails when USCIS updates forms
- ❌ Limited field coverage
- ❌ Manual field mapping updates required

### AI-Powered Method:
- ✅ Adapts to form changes automatically
- ✅ Understands context and field relationships
- ✅ Higher accuracy and coverage
- ✅ Handles edge cases intelligently
- ✅ Zero maintenance for form updates

## Troubleshooting

### "OPENAI_API_KEY not configured"
Set the environment variable using `supabase secrets set OPENAI_API_KEY=your-key`

### "PDF has no fillable fields"
The form might not have editable fields. Check the form in Supabase Storage (`USCIS Forms` bucket).

### "Failed to fetch template from Supabase Storage"
- Verify the forms exist in Storage: `USCIS Forms/g-1145.pdf` and `USCIS Forms/i-765.pdf`
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Ensure the Storage bucket has proper permissions

### "AI could not map any fields successfully"
- Check that applicant data is properly formatted
- Verify OpenAI API key has sufficient credits
- Review function logs: `supabase functions logs fill-pdf-form-ai`

### Rate Limiting
OpenAI has rate limits. For high-volume usage, consider:
- Implementing request queuing
- Caching common form templates
- Using OpenAI's batch API

## Development

### Local Testing

```bash
# Start Supabase locally
supabase start

# Set local secret
echo "OPENAI_API_KEY=your-key" > supabase/.env.local

# Serve function locally
supabase functions serve fill-pdf-form-ai

# Test
curl -i --location --request POST 'http://localhost:54321/functions/v1/fill-pdf-form-ai' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  --header 'Content-Type: application/json' \
  --data '{"formType":"G-1145","data":{"firstName":"Test"}}'
```

### Logs

View logs:
```bash
supabase functions logs fill-pdf-form-ai --tail
```

## Security

- ✅ Authentication required (Supabase JWT)
- ✅ CORS enabled for frontend access
- ✅ No data stored (stateless function)
- ✅ Secure API key storage
- ✅ Input validation

## License

Part of the GRITSYNC application system.

