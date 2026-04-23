# Supabase Services Unhealthy - Troubleshooting Guide

## Quick Diagnosis Steps

### 1. Check Supabase Dashboard Status
1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/warfdcbvnapietbkpild
2. Check the **Project Settings** → **Infrastructure** page
3. Look for any error messages or warnings

### 2. Common Causes & Solutions

#### A. Database Connection Issues
**Symptoms:** Database shows "unhealthy"
**Solutions:**
- Check if you've exceeded database connection limits
- Verify database is not paused (free tier pauses after inactivity)
- Check for long-running queries blocking the database
- Restart the database from Settings → Database → Restart

#### B. PostgREST Issues
**Symptoms:** PostgREST shows "unhealthy"
**Solutions:**
- Usually caused by database issues - fix database first
- Check API logs in Settings → Logs → API
- Restart PostgREST service (may require database restart)

#### C. Auth Service Issues
**Symptoms:** Auth shows "unhealthy"
**Solutions:**
- Check Auth logs in Settings → Logs → Auth
- Verify Auth configuration in Settings → Authentication
- Restart Auth service (may require project restart)

### 3. Immediate Actions to Try

#### Option 1: Restart Services (Recommended)
1. Go to **Settings** → **General**
2. Scroll to **Danger Zone**
3. Click **Restart Project** (if available)
   - ⚠️ This will cause brief downtime
   - Services should come back online in 1-2 minutes

#### Option 2: Check Resource Usage
1. Go to **Settings** → **Usage**
2. Check if you've exceeded:
   - Database size limits
   - API request limits
   - Storage limits
3. If exceeded, upgrade plan or clean up data

#### Option 3: Check Logs
1. Go to **Logs** in the sidebar
2. Check:
   - **API Logs** - for PostgREST errors
   - **Auth Logs** - for authentication errors
   - **Database Logs** - for database errors
3. Look for error patterns or rate limiting messages

### 4. Free Tier Specific Issues

If you're on the free tier:
- **Inactivity Pause:** Database pauses after 7 days of inactivity
  - Solution: Wake it up by making an API call or accessing the dashboard
- **Resource Limits:** Free tier has strict limits
  - Check your usage in Settings → Usage
  - Consider upgrading if consistently hitting limits

### 5. Network/Connection Issues

If services show unhealthy but dashboard is accessible:
1. Check your internet connection
2. Try accessing from a different network
3. Check if Supabase status page shows any outages: https://status.supabase.com

### 6. Database-Specific Fixes

If database is unhealthy:
```sql
-- Check for blocking queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Kill long-running queries (if needed)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '10 minutes';
```

### 7. Contact Support

If none of the above works:
1. Go to **Support** in your Supabase dashboard
2. Create a support ticket with:
   - Project reference: `warfdcbvnapietbkpild`
   - Screenshot of unhealthy services
   - Any error messages from logs
   - Time when issue started

### 8. Temporary Workaround

While waiting for services to recover:
- Your application will not be able to:
  - Authenticate users
  - Access the database
  - Store/retrieve files
- Consider putting up a maintenance message

## Prevention

1. **Monitor Usage:** Regularly check Settings → Usage
2. **Set Up Alerts:** Configure alerts for resource usage
3. **Optimize Queries:** Ensure database queries are efficient
4. **Regular Backups:** Set up automated backups
5. **Upgrade Plan:** If consistently hitting limits, consider upgrading

## Status Check Commands

You can check service health via API:
```bash
# Check database
curl https://warfdcbvnapietbkpild.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"

# Check auth
curl https://warfdcbvnapietbkpild.supabase.co/auth/v1/health
```







