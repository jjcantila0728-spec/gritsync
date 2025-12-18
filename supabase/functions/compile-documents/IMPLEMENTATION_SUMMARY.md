# Background Jobs Implementation Summary

## ✅ Completed Implementation

### 1. Database Migration
- **File**: `supabase/migrations/add-document-compilation-jobs.sql`
- **Creates**: Job queue table with RLS policies
- **Functions**: 
  - `get_next_pending_compilation_job()` - Gets and locks next job
  - `update_compilation_job_status()` - Updates job status
  - `cleanup_stale_compilation_jobs()` - Safety cleanup for stuck jobs

### 2. Worker Function
- **File**: `supabase/functions/process-compilation-worker/index.ts`
- **Purpose**: Processes compilation jobs from queue
- **Features**:
  - Can process specific job by ID
  - Can process next pending job
  - Handles all document processing
  - Updates job status on completion/failure

### 3. Status Function
- **File**: `supabase/functions/get-compilation-status/index.ts`
- **Purpose**: Returns job status and results
- **Features**:
  - Returns job status (pending/processing/completed/failed)
  - Returns PDF URL when completed
  - Regenerates signed URLs if expired

### 4. Updated Orchestrator
- **File**: `supabase/functions/compile-documents/index.ts`
- **Changes**: 
  - Creates job instead of processing immediately
  - Triggers worker asynchronously
  - Returns job ID immediately (HTTP 202 Accepted)

## Architecture Flow

```
1. Client → compile-documents (orchestrator)
   ↓
2. Orchestrator validates documents exist
   ↓
3. Orchestrator creates job in database (status: 'pending')
   ↓
4. Orchestrator triggers worker asynchronously
   ↓
5. Orchestrator returns job ID immediately (HTTP 202)
   ↓
6. Worker processes job:
   ├─ Updates status to 'processing'
   ├─ Processes documents
   ├─ Uploads result
   └─ Updates status to 'completed' or 'failed'
   ↓
7. Client polls get-compilation-status?id={jobId}
   ↓
8. When status = 'completed', client gets PDF URL
```

## Deployment Steps

### 1. Run Database Migration
```sql
-- Run in Supabase SQL Editor
\i supabase/migrations/add-document-compilation-jobs.sql
```

### 2. Deploy Edge Functions
```bash
# Deploy updated orchestrator
supabase functions deploy compile-documents

# Deploy new worker function
supabase functions deploy process-compilation-worker

# Deploy new status function
supabase functions deploy get-compilation-status
```

### 3. Set Up Cron Job (Optional)
For automatic processing of pending jobs:

```sql
-- Run every minute to process pending jobs
SELECT cron.schedule(
  'process-compilation-jobs',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-compilation-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('processNext', true)
    ) AS request_id;
  $$
);
```

## Client Integration

### Before (Synchronous)
```typescript
const response = await fetch('/functions/v1/compile-documents', {
  method: 'POST',
  body: JSON.stringify({ applicationId, userId }),
})
const data = await response.json()
// Wait for processing to complete...
const pdfUrl = data.pdfUrl
```

### After (Asynchronous with Polling)
```typescript
// 1. Create job
const response = await fetch('/functions/v1/compile-documents', {
  method: 'POST',
  body: JSON.stringify({ applicationId, userId }),
})
const { jobId } = await response.json()

// 2. Poll for status
const pollStatus = async () => {
  const statusResponse = await fetch(
    `/functions/v1/get-compilation-status?id=${jobId}`
  )
  const { job } = await statusResponse.json()
  
  if (job.status === 'completed') {
    return job.pdfUrl
  } else if (job.status === 'failed') {
    throw new Error(job.errorMessage)
  } else {
    // Still processing, poll again
    await new Promise(resolve => setTimeout(resolve, 2000))
    return pollStatus()
  }
}

const pdfUrl = await pollStatus()
```

## Benefits

✅ **No CPU Timeouts** - Processing happens asynchronously
✅ **Better UX** - Immediate response to user
✅ **Job History** - All compilations tracked in database
✅ **Retry Capability** - Failed jobs can be retried
✅ **Scalable** - Multiple workers can process jobs
✅ **Monitoring** - Job status visible in database

## Testing

1. **Create Job**: Call compile-documents → Should return job ID
2. **Check Status**: Call get-compilation-status → Should return pending
3. **Trigger Worker**: Call process-compilation-worker → Should process job
4. **Check Status Again**: Should return completed with PDF URL
5. **Test Failed Job**: Create job with missing documents → Should fail gracefully

## Next Steps

1. ✅ Migration created
2. ✅ Worker function created
3. ✅ Status function created
4. ✅ Orchestrator updated
5. ⏳ Deploy to Supabase
6. ⏳ Update client code to use polling
7. ⏳ Set up cron job (optional)






