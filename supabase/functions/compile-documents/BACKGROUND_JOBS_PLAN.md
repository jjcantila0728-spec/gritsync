# Background Jobs Implementation Plan

## Overview

Implement a true background job system using Supabase database as job queue to prevent CPU timeouts in the compile-documents function.

## Architecture

```
Current Flow (Synchronous):
HTTP Request → Process Everything → Return Response (❌ Timeout Risk)

New Flow (Asynchronous with Background Jobs):
HTTP Request → Create Job → Return Job ID → Worker Processes → Job Complete
                                    ↓
                            Client Polls for Status
```

## Components

### 1. Database Schema (Job Queue Table)

```sql
CREATE TABLE document_compilation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  cover_letter_blob TEXT,
  error_message TEXT,
  result_file_path TEXT,
  result_file_name TEXT,
  result_file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);

CREATE INDEX idx_compilation_jobs_status ON document_compilation_jobs(status);
CREATE INDEX idx_compilation_jobs_user_id ON document_compilation_jobs(user_id);
CREATE INDEX idx_compilation_jobs_created_at ON document_compilation_jobs(created_at);
```

### 2. Edge Functions

**A. compile-documents (Orchestrator)**
- Receives request
- Creates job record in database
- Returns job ID immediately
- No processing

**B. process-compilation-worker (Worker)**
- Called by cron/scheduled function
- Picks up pending jobs
- Processes documents
- Updates job status
- Can be called on-demand via HTTP for immediate processing

### 3. Client Flow

1. Client calls `compile-documents` → Gets job ID
2. Client polls `/functions/v1/get-compilation-status?id={jobId}` 
3. When status = 'completed', get result URL
4. When status = 'failed', get error message

## Implementation Steps

1. ✅ Create database migration for job queue table
2. ✅ Update compile-documents to create jobs (orchestrator only)
3. ✅ Create process-compilation-worker function
4. ✅ Create get-compilation-status function
5. ✅ Update client code to use job-based flow

## Benefits

- ✅ No CPU timeout (processing is async)
- ✅ Better error handling (jobs persist state)
- ✅ Retry capability (failed jobs can be retried)
- ✅ Job history (audit trail)
- ✅ Scalable (multiple workers can process jobs)






