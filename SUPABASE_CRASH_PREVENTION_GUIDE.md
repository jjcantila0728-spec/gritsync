# Supabase Server Crash Prevention Guide

This guide addresses common causes of Supabase server crashes and provides solutions to prevent them.

## Common Causes of Supabase Server Crashes

### 1. Database Overload (Too Many Connections)
**Symptoms:**
- "too many connections" errors
- Slow query responses
- Connection pool exhaustion

**Solutions:**

#### Client-Side Fixes
- ✅ **Use singleton Supabase client** - Only create one client instance per application
- ✅ **Reuse connections** - Supabase client handles connection pooling automatically
- ✅ **Close unused subscriptions** - Always unsubscribe from Realtime channels on component unmount
- ✅ **Batch queries** - Combine multiple queries into single requests where possible
- ✅ **Use database functions** - Use RPC functions for complex operations (reduces round trips)

#### Server-Side Fixes
- Check Supabase dashboard → Database → Connection Pooling settings
- Monitor active connections in dashboard
- Scale up compute resources if needed
- Optimize slow queries with indexes

### 2. Resource Limits (CPU/Memory)
**Symptoms:**
- High CPU usage alerts
- Memory exhaustion
- Slow response times
- Timeout errors

**Solutions:**

#### Query Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_applications_user_status 
ON applications(user_id, status);

-- Use EXPLAIN ANALYZE to identify slow queries
EXPLAIN ANALYZE SELECT * FROM applications WHERE user_id = 'xxx';
```

#### Code Optimization
- ✅ **Use pagination** - Never fetch all records at once
- ✅ **Limit query results** - Use `.limit()` on all queries
- ✅ **Select only needed columns** - Use `.select('col1, col2')` instead of `*`
- ✅ **Cache frequently accessed data** - Use client-side caching for static data
- ✅ **Debounce search queries** - Prevent rapid-fire queries

#### Monitor Resources
- Check Supabase dashboard → Database → Performance metrics
- Review slow query logs
- Set up alerts for CPU/memory usage

### 3. Bad Migrations
**Symptoms:**
- Migration failures
- Database schema inconsistencies
- RLS policy errors
- Function errors

**Solutions:**

#### Pre-Migration Checklist
- ✅ **Test migrations locally first** - Use Supabase CLI local development
- ✅ **Check for breaking changes** - Review migration compatibility
- ✅ **Backup database** - Always backup before running migrations
- ✅ **Run migrations in order** - Follow migration file naming convention
- ✅ **Verify dependencies** - Ensure required tables/functions exist

#### Migration Best Practices
```sql
-- Use IF NOT EXISTS for safety
CREATE TABLE IF NOT EXISTS my_table (...);

-- Use IF EXISTS for drops
DROP TABLE IF EXISTS my_table;

-- Wrap in transactions where possible
BEGIN;
-- migration code
COMMIT;

-- Add rollback scripts
-- File: rollback_migration_name.sql
```

#### Troubleshooting
1. Check Supabase dashboard → Logs for migration errors
2. Review SQL Editor → Recent queries for failed statements
3. Use `verify-all-migrations.sql` to check current state
4. Rollback problematic migrations if needed

### 4. Client-Side Issues (Auth/Realtime Bugs)
**Symptoms:**
- Authentication failures
- Realtime connection issues
- Memory leaks
- Excessive WebSocket connections

**Solutions:**

#### Authentication Token Management
- ✅ **Enable auto-refresh** - Already configured: `autoRefreshToken: true`
- ✅ **Handle token expiration** - Check session before critical operations
- ✅ **Implement retry logic** - Retry failed requests with refreshed tokens
- ✅ **Persist sessions** - Use `persistSession: true` (already configured)

#### Realtime Subscription Management
- ✅ **Always unsubscribe** - Cleanup subscriptions in useEffect cleanup
- ✅ **Use optimized subscriptions** - Combine multiple subscriptions into single channels
- ✅ **Limit active subscriptions** - Unsubscribe when navigating away
- ✅ **Handle connection errors** - Implement reconnection logic

#### Code Patterns to Avoid
```typescript
// ❌ BAD: Creating multiple Supabase clients
const supabase1 = createClient(...)
const supabase2 = createClient(...)

// ✅ GOOD: Use singleton client
import { supabase } from '@/lib/supabase'

// ❌ BAD: Not cleaning up subscriptions
useEffect(() => {
  const channel = supabase.channel(...).subscribe()
  // Missing cleanup!
}, [])

// ✅ GOOD: Always cleanup
useEffect(() => {
  const channel = supabase.channel(...).subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}, [])

// ❌ BAD: Fetching all data
const { data } = await supabase.from('applications').select('*')

// ✅ GOOD: Limit and paginate
const { data } = await supabase
  .from('applications')
  .select('id, status, created_at')
  .limit(50)
```

## Implementation Checklist

### Immediate Actions

1. **Review Supabase Dashboard**
   - [ ] Check current connection count
   - [ ] Review error logs
   - [ ] Check CPU/memory usage
   - [ ] Review slow query logs

2. **Client Code Review**
   - [x] Verify single Supabase client instance
   - [x] Check all Realtime subscriptions have cleanup
   - [ ] Review query patterns for optimization
   - [ ] Check for N+1 query problems

3. **Database Optimization**
   - [ ] Review and add missing indexes
   - [ ] Analyze slow queries
   - [ ] Optimize RLS policies
   - [ ] Review function performance

4. **Migration Safety**
   - [ ] Review all pending migrations
   - [ ] Test migrations in staging
   - [ ] Verify rollback scripts exist
   - [ ] Document migration dependencies

### Long-Term Monitoring

1. **Set Up Alerts**
   - Connection pool usage > 80%
   - CPU usage > 80%
   - Memory usage > 80%
   - Error rate > 1%

2. **Regular Maintenance**
   - Weekly query performance review
   - Monthly migration audit
   - Quarterly resource usage review
   - Regular backup verification

## Quick Fixes Applied in Codebase

### 1. Enhanced Supabase Client Configuration (`src/lib/supabase.ts`)
- ✅ Singleton client pattern to prevent connection pool exhaustion
- ✅ Optimized Realtime connection settings (events per second limit)
- ✅ Proper session persistence and auto-refresh configuration
- ✅ Added connection management comments

### 2. Fixed Realtime Subscription Pooling (`src/lib/realtime-optimized.ts`)
- ✅ Fixed channel reuse bug (channels are now per-component, not shared)
- ✅ Proper cleanup on unmount with `unsubscribe()` function
- ✅ Optimized subscription patterns (multiple events on single channel)
- ✅ Added `unsubscribeAll()` helper for batch cleanup

### 3. Session Refresh Handling (`src/lib/session-utils.ts`) **NEW**
- ✅ `ensureValidSession()` - Checks and refreshes session if needed
- ✅ `requireAuth()` - Ensures authentication before critical operations
- ✅ `getAuthenticatedUserId()` - Gets user ID with session validation
- ✅ `forceRefreshSession()` - Force refresh (useful after role changes)
- ✅ `isSessionExpired()` - Check session expiration status
- ✅ User ID caching to reduce auth.getUser calls

**Usage Example:**
```typescript
import { requireAuth, getAuthenticatedUserId } from '@/lib/session-utils'

// Before critical operation
async function updateApplication() {
  const session = await requireAuth() // Ensures valid session
  const userId = await getAuthenticatedUserId() // Gets cached user ID
  
  // Proceed with operation
  const { data, error } = await supabase
    .from('applications')
    .update({ ... })
    .eq('user_id', userId)
}
```

### 4. Query Optimization (`src/lib/supabase-api.ts`)
- ✅ Query batching with `executeQuery()` wrapper
- ✅ Retry logic with exponential backoff
- ✅ User ID caching to reduce repeated auth calls
- ✅ Error normalization and handling

### 5. Migration Compatibility Checker (`supabase/migrations/check-migration-compatibility.sql`) **NEW**
- ✅ Checks for missing dependencies (tables, functions)
- ✅ Detects orphaned foreign keys
- ✅ Identifies missing indexes
- ✅ Validates RLS policies
- ✅ Checks for performance issues
- ✅ Monitors connection usage

**Usage:**
1. Run in Supabase Dashboard → SQL Editor before deploying new migrations
2. Review warnings and fix issues before proceeding
3. Helps prevent crashes from incompatible migrations

### 6. Connection Monitoring (`src/lib/connection-monitor.ts`) **NEW**
- ✅ `checkConnectionHealth()` - Performs health check with latency measurement
- ✅ `getConnectionStats()` - Returns connection statistics (success/failure rates, active channels)
- ✅ `trackSuccessfulQuery()` / `trackFailedQuery()` - Track query outcomes
- ✅ `trackChannelSubscribed()` / `trackChannelUnsubscribed()` - Track Realtime channels
- ✅ `getConnectionSummary()` - Get formatted summary for logging

**Usage:**
```typescript
import { checkConnectionHealth, getConnectionStats } from '@/lib/connection-monitor'

// Check connection health
const health = await checkConnectionHealth()
if (health.status === 'unhealthy') {
  console.error('Connection unhealthy:', health.error)
}
```

### 7. Query Performance Monitoring (`src/lib/query-performance.ts`) **NEW**
- ✅ Automatic performance tracking for all queries
- ✅ Identifies slow queries (>1s) and very slow queries (>3s)
- ✅ Performance statistics and summaries
- ✅ Operation-level performance breakdown
- ✅ `trackQuery()` wrapper for manual tracking

**Usage:**
```typescript
import { trackQuery, getPerformanceSummary } from '@/lib/query-performance'

// Wrap queries for performance tracking
const result = await trackQuery('getApplications', () => 
  supabase.from('applications').select('*')
)

// Get performance summary
console.log(getPerformanceSummary())
```

### 8. Enhanced executeQuery with Session Refresh (`src/lib/supabase-api.ts`) **ENHANCED**
- ✅ Automatically validates session before queries (if `requireAuth: true`)
- ✅ Auto-refreshes session on auth errors and retries query
- ✅ Integrated performance tracking
- ✅ Connection monitoring integration
- ✅ Slow query detection and logging

**What Changed:**
- Session validation happens automatically before queries
- Auth errors trigger session refresh and automatic retry
- All queries are tracked for performance monitoring

## Troubleshooting Steps

When crashes occur:

1. **Check Dashboard Status**
   ```
   Supabase Dashboard → Status
   - Service health
   - Recent incidents
   - Resource usage
   ```

2. **Review Logs**
   ```
   Supabase Dashboard → Logs
   - Filter by error level
   - Check recent errors
   - Review API logs
   ```

3. **Check Database Connections**
   ```
   Supabase Dashboard → Database → Connection Pooler
   - Active connections
   - Connection pool stats
   ```

4. **Review Recent Changes**
   - Check recent migrations
   - Review recent code deployments
   - Check for configuration changes

5. **Scale Resources (if needed)**
   ```
   Supabase Dashboard → Settings → Infrastructure
   - Increase compute resources
   - Enable connection pooling
   - Add read replicas
   ```

## Emergency Rollback

If a migration causes issues:

1. **Stop the application** (if possible)
2. **Review rollback scripts** in `supabase/migrations/`
3. **Run rollback SQL** in Supabase Dashboard → SQL Editor
4. **Verify database state** using verification scripts
5. **Restart application** and test

## Resources

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Supabase Performance Guide](https://supabase.com/docs/guides/platform/performance)
- [Supabase Troubleshooting](https://supabase.com/docs/guides/platform/troubleshooting)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)

