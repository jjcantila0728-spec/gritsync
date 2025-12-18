# Supabase Crash Prevention - Quick Reference

## 🚨 Emergency Troubleshooting

### When Supabase Crashes:

1. **Check Dashboard Status**
   ```
   Supabase Dashboard → Status
   - Service health
   - Recent incidents
   ```

2. **Review Error Logs**
   ```
   Supabase Dashboard → Logs
   - Filter by error level
   - Check API logs for connection errors
   ```

3. **Check Connection Pool**
   ```
   Supabase Dashboard → Database → Connection Pooler
   - If >80% usage → Scale up resources
   ```

4. **Review Recent Migrations**
   ```
   Run: supabase/migrations/check-migration-compatibility.sql
   ```

## 🔧 Code Fixes Applied

### ✅ Fixed Issues

1. **Realtime Subscription Bug**
   - **File**: `src/lib/realtime-optimized.ts`
   - **Fix**: Removed channel pooling, proper per-component channels
   - **Impact**: Prevents connection buildup and memory leaks

2. **Supabase Client Configuration**
   - **File**: `src/lib/supabase.ts`
   - **Fix**: Added connection limits and optimized settings
   - **Impact**: Better connection management

3. **Session Management**
   - **File**: `src/lib/session-utils.ts` (NEW)
   - **Fix**: Explicit session refresh utilities
   - **Impact**: Prevents auth errors from expired tokens

## 📋 Best Practices Checklist

### Before Deploying

- [ ] Run migration compatibility checker
- [ ] Test all Realtime subscriptions cleanup properly
- [ ] Verify session refresh works correctly
- [ ] Check connection pool usage < 80%

### Code Patterns

✅ **DO:**
```typescript
// Use singleton client
import { supabase } from '@/lib/supabase'

// Always cleanup subscriptions
useEffect(() => {
  const channel = subscribeToUpdates()
  return () => unsubscribe(channel)
}, [])

// Ensure valid session before critical operations
import { requireAuth } from '@/lib/session-utils'
const session = await requireAuth()
```

❌ **DON'T:**
```typescript
// Don't create multiple clients
const supabase1 = createClient(...)
const supabase2 = createClient(...)

// Don't forget cleanup
useEffect(() => {
  subscribeToUpdates() // Missing cleanup!
}, [])

// Don't skip session checks
const { data } = await supabase.from('table').select() // May fail with expired token
```

## 🔍 Monitoring

### Key Metrics to Watch

1. **Connection Count**
   - Target: < 80% of max connections
   - Alert: > 80%

2. **CPU Usage**
   - Target: < 70%
   - Alert: > 80%

3. **Memory Usage**
   - Target: < 70%
   - Alert: > 80%

4. **Error Rate**
   - Target: < 1%
   - Alert: > 1%

## 🛠️ Utility Functions

### Session Management

```typescript
import { 
  ensureValidSession,
  requireAuth,
  getAuthenticatedUserId,
  forceRefreshSession,
  isSessionExpired
} from '@/lib/session-utils'
```

### Realtime Subscriptions

```typescript
import { 
  subscribeToAdminDashboard,
  subscribeToClientDashboard,
  subscribeToApplicationDetail,
  unsubscribe,
  unsubscribeAll
} from '@/lib/realtime-optimized'
```

### Connection & Performance Monitoring

```typescript
import {
  checkConnectionHealth,
  getConnectionStats,
  getPerformanceStats,
  getPerformanceSummary,
  logSystemHealthReport
} from '@/lib/monitoring-utils'

// Check connection health
const health = await checkConnectionHealth()

// Get performance stats
const stats = getPerformanceStats()
console.log(getPerformanceSummary())

// Get comprehensive health report
await logSystemHealthReport()
```

## 📚 Related Files

- **Main Guide**: `SUPABASE_CRASH_PREVENTION_GUIDE.md`
- **Migration Checker**: `supabase/migrations/check-migration-compatibility.sql`
- **Session Utils**: `src/lib/session-utils.ts`
- **Supabase Client**: `src/lib/supabase.ts`
- **Realtime Utils**: `src/lib/realtime-optimized.ts`

