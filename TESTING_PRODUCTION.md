# Production Testing Guide

This guide helps you test all production optimizations before deploying.

## 🧪 Pre-Deployment Testing

### 1. Environment Validation

```bash
# Run the deployment validation script
npm run deploy:check
```

This will:
- ✅ Validate all required environment variables
- ✅ Check for test keys in production
- ✅ Verify JWT_SECRET strength
- ✅ Run TypeScript type checking
- ✅ Build the application
- ✅ Verify build output

### 2. Local Production Build Test

```bash
# Build for production
npm run build:prod

# Start production server locally
npm run start
```

### 3. Test Health Endpoints

```bash
# Test health endpoint
curl http://localhost:3001/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "...",
#   "uptime": "...",
#   "environment": "production",
#   "memory": { ... },
#   "performance": { ... }
# }

# Test readiness endpoint
curl http://localhost:3001/ready

# Expected response:
# {
#   "status": "ready",
#   "checks": { ... },
#   "responseTime": "...",
#   "timestamp": "..."
# }
```

### 4. Test Compression

```bash
# Test with compression header
curl -H "Accept-Encoding: gzip" -v http://localhost:3001/health

# Look for: Content-Encoding: gzip in response headers
```

### 5. Test Performance Monitoring

```bash
# Make several requests and check response headers
curl -v http://localhost:3001/api/applications

# Look for: X-Response-Time header in response
```

### 6. Test Static File Caching

```bash
# Test static file with cache headers
curl -I http://localhost:3001/gritsync_logo.png

# Look for: Cache-Control header with appropriate max-age
```

### 7. Test Graceful Shutdown

1. Start the server: `npm run start`
2. Send SIGTERM signal: `Ctrl+C` or `kill -SIGTERM <pid>`
3. Verify server shuts down gracefully (check logs)

### 8. Test Rate Limiting

```bash
# Make multiple rapid requests to auth endpoint
for i in {1..10}; do
  curl http://localhost:3001/api/auth/login
done

# Should eventually return 429 Too Many Requests
```

### 9. Test Error Handling

```bash
# Test 404 handler
curl http://localhost:3001/api/nonexistent

# Should return proper error response without stack traces in production
```

### 10. Test Database Connection

```bash
# Test an endpoint that uses database
curl http://localhost:3001/api/dashboard/stats

# Check logs for any connection errors
```

## 🐳 Docker Testing

### 1. Build Docker Image

```bash
npm run docker:build
```

### 2. Test Docker Container

```bash
# Run container
docker run -d \
  --name gritsync-test \
  -p 3001:3001 \
  --env-file .env.production \
  gritsync:latest

# Check logs
docker logs gritsync-test

# Test health endpoint
curl http://localhost:3001/health

# Stop container
docker stop gritsync-test
docker rm gritsync-test
```

### 3. Test Docker Compose

```bash
# Start services
npm run docker:run

# Check status
docker-compose ps

# Check logs
docker-compose logs -f

# Stop services
npm run docker:stop
```

## 📊 Performance Testing

### 1. Response Time Test

```bash
# Test response times
time curl http://localhost:3001/health

# Should be < 100ms for health endpoint
```

### 2. Load Testing (Optional)

```bash
# Install Apache Bench (if not installed)
# Windows: choco install apache-httpd
# Mac: brew install httpd
# Linux: apt-get install apache2-utils

# Run load test
ab -n 1000 -c 10 http://localhost:3001/health

# Check for:
# - Average response time < 500ms
# - No failed requests
# - Consistent performance
```

### 3. Memory Usage Test

```bash
# Monitor memory while making requests
# Check /health endpoint for memory metrics
curl http://localhost:3001/health | jq .memory

# Memory should be stable and not continuously growing
```

## 🔍 Logging Verification

### 1. Check Log Format

In production mode, logs should be JSON formatted:
```json
{"timestamp":"...","level":"INFO","message":"..."}
```

### 2. Check Log Levels

```bash
# Set log level
export LOG_LEVEL=debug

# Restart server and check logs
npm run start

# Logs should include debug messages
```

### 3. Check Performance Logs

```bash
# Make a slow request (>1s)
# Check logs for slow request warnings

# Logs should show:
# {"level":"WARN","message":"Slow request detected",...}
```

## 🔒 Security Testing

### 1. Test Security Headers

```bash
curl -I http://localhost:3001/

# Check for:
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - X-XSS-Protection: 1; mode=block
# - Content-Security-Policy: ...
```

### 2. Test CORS

```bash
# Test from different origin (should fail in production)
curl -H "Origin: http://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:3001/api/auth/login

# Should be blocked if not in allowed origins
```

### 3. Test Input Sanitization

```bash
# Test with potentially malicious input
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<script>alert(1)</script>","password":"test"}'

# Should sanitize input and not execute scripts
```

## 📝 Testing Checklist

Before deploying to production, verify:

### Functionality
- [ ] All API endpoints work correctly
- [ ] Authentication works
- [ ] Database queries execute properly
- [ ] File uploads work
- [ ] Payments process correctly
- [ ] Webhooks receive events

### Performance
- [ ] Health endpoint responds < 100ms
- [ ] Average API response time < 500ms
- [ ] No memory leaks (check over time)
- [ ] Compression is working
- [ ] Static files are cached properly

### Security
- [ ] Security headers are set
- [ ] CORS is configured correctly
- [ ] Rate limiting works
- [ ] Input sanitization works
- [ ] Error messages don't expose sensitive info

### Monitoring
- [ ] Health checks return 200
- [ ] Performance metrics are tracked
- [ ] Logs are structured correctly
- [ ] Slow requests are detected
- [ ] Error tracking works

### Deployment
- [ ] Docker image builds successfully
- [ ] Docker container runs correctly
- [ ] Environment variables are validated
- [ ] Graceful shutdown works
- [ ] All services start correctly

## 🐛 Troubleshooting

### Server Won't Start
1. Check environment variables: `npm run deploy:check`
2. Check logs for errors
3. Verify port 3001 is not in use
4. Check database connectivity

### Compression Not Working
1. Verify `compression` package is installed: `npm list compression`
2. Check middleware is loaded in `server/index.js`
3. Test with `Accept-Encoding: gzip` header

### High Memory Usage
1. Check `/health` endpoint for memory metrics
2. Look for memory leaks in logs
3. Review database query patterns
4. Consider increasing container memory limits

### Slow Requests
1. Check performance logs for slow requests
2. Review database queries
3. Check external API calls (Stripe, etc.)
4. Review rate limiting settings

### Docker Issues
1. Check Docker logs: `docker logs gritsync-test`
2. Verify environment variables are set
3. Check Docker resource limits
4. Verify health checks are passing

## ✅ Success Criteria

Your application is ready for production when:

- ✅ All tests pass
- ✅ Health checks return 200
- ✅ Average response time < 500ms
- ✅ No errors in logs
- ✅ Compression working
- ✅ Security headers set
- ✅ Docker builds and runs successfully
- ✅ All functionality works correctly

## 🚀 Next Steps After Testing

1. **Deploy to Staging**: Test in staging environment first
2. **Monitor**: Watch logs and metrics closely
3. **Load Test**: Run load tests in staging
4. **Deploy to Production**: Deploy when staging is stable
5. **Monitor Production**: Watch for issues after deployment
6. **Set Up Alerts**: Configure alerts for errors and performance

---

**Ready to deploy?** Follow the [Deployment Guide](./DEPLOYMENT_GUIDE.md) next!
