# Fix Connection Timeout Error in Supabase

## Error Message
```
Error: Failed to run sql query: Connection terminated due to connection timeout
```

## What This Means
Your Supabase database is experiencing connection issues, likely due to:
- Too many active connections
- Long-running queries blocking the database
- Idle connections not being released
- Database overload

## Immediate Solutions

### Solution 1: Kill Long-Running Queries (Recommended)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/sql/new

2. **Run the diagnostic query first:**
   ```sql
   SELECT 
     pid,
     now() - pg_stat_activity.query_start AS duration,
     state,
     query
   FROM pg_stat_activity
   WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
     AND state != 'idle'
   ORDER BY duration DESC;
   ```

3. **If you see long-running queries, kill them:**
   ```sql
   -- Replace <PID> with the actual pid from the query above
   SELECT pg_terminate_backend(<PID>);
   ```

### Solution 2: Kill Idle Connections

Run this to kill idle connections that are holding resources:
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND now() - state_change > interval '5 minutes';
```

### Solution 3: Check Connection Count

See how many connections you're using:
```sql
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity
WHERE datname = current_database();
```

### Solution 4: Restart Database (Nuclear Option)

If nothing else works:
1. Go to **Settings** → **Database**
2. Click **Restart Database** (if available)
   - ⚠️ This will cause brief downtime
   - All connections will be reset

## Prevention

### 1. Optimize Your Application Code

Make sure your application:
- Closes database connections properly
- Uses connection pooling
- Doesn't hold transactions open unnecessarily
- Uses `SET LOCAL` for transaction-scoped settings

### 2. Check for Connection Leaks

Look for code that:
- Opens connections but doesn't close them
- Keeps transactions open too long
- Doesn't handle errors properly (leaving connections open)

### 3. Use Connection Pooling

Supabase automatically pools connections, but make sure:
- You're not creating too many Supabase clients
- You're reusing the same client instance
- You're not opening multiple connections per request

### 4. Monitor Connection Usage

Regularly check:
- Settings → Database → Connection Pooling
- Monitor active connections
- Set up alerts for high connection usage

## Common Causes

### 1. Application Code Issues
```javascript
// BAD - Creates new connection each time
function getData() {
  const supabase = createClient(url, key) // Don't do this
  return supabase.from('table').select()
}

// GOOD - Reuse single client
const supabase = createClient(url, key)
function getData() {
  return supabase.from('table').select()
}
```

### 2. Long-Running Queries
- Missing indexes causing slow queries
- Full table scans
- Complex joins without optimization

### 3. Idle in Transaction
- Transactions left open
- Error handling that doesn't rollback
- Debugging code that keeps transactions open

## Quick Fix Script

I've created a SQL file with all diagnostic queries:
- File: `supabase/fix-connection-timeout.sql`
- Run queries 1-3 first to diagnose
- Then use query 4-5 to fix if needed

## If Problem Persists

1. **Check Supabase Status**
   - https://status.supabase.com
   - See if there are known issues

2. **Check Your Plan Limits**
   - Free tier: 60 direct connections
   - Pro tier: 200 direct connections
   - Check Settings → Usage

3. **Contact Support**
   - Include the diagnostic query results
   - Mention when the issue started
   - Include any recent code changes

## Next Steps

1. Run the diagnostic queries from `supabase/fix-connection-timeout.sql`
2. Kill any problematic queries/connections
3. Check your application code for connection leaks
4. Monitor connection usage going forward







