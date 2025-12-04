# GritSync Deployment Guide

This guide will help you deploy the GritSync application to production.

## 📋 Pre-Deployment Checklist

### ✅ Code Quality
- [x] All MVP features implemented
- [x] No linter errors
- [x] Error boundaries in place
- [x] Form validation complete
- [x] Security best practices followed

### ⚠️ Before Deploying

1. **Environment Variables**: Set all required environment variables
2. **Database**: Ensure database is properly configured
3. **File Storage**: Configure file upload storage
4. **Stripe**: Set up production Stripe keys
5. **Security**: Change default JWT_SECRET
6. **Domain**: Configure CORS for your domain

---

## 🚀 Deployment Options

### Option 1: Vercel (Frontend) + Railway/Render (Backend)

#### Frontend Deployment (Vercel)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Set Environment Variables** in Vercel Dashboard:
   - `VITE_API_URL` - Your backend API URL
   - `VITE_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key

#### Backend Deployment (Railway/Render)

1. **Create account** on Railway.app or Render.com

2. **Connect your repository**

3. **Set Build Command**: (if needed)
   ```bash
   npm install
   ```

4. **Set Start Command**:
   ```bash
   node server/index.js
   ```

5. **Set Environment Variables**:
   - `PORT` - Usually auto-set by platform
   - `JWT_SECRET` - Generate secure secret
   - `STRIPE_SECRET_KEY` - Your Stripe secret key
   - `FRONTEND_URL` - Your frontend URL
   - `NODE_ENV=production`

6. **Database**: 
   - Railway/Render will handle SQLite file storage
   - Or migrate to PostgreSQL for better production support

---

### Option 2: Docker Deployment

#### Create Dockerfile

```dockerfile
# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY server/ ./server/
COPY gritsync.db* ./

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "server/index.js"]
```

#### Frontend Dockerfile

```dockerfile
# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - JWT_SECRET=${JWT_SECRET}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - FRONTEND_URL=${FRONTEND_URL}
    volumes:
      - ./gritsync.db:/app/gritsync.db
      - ./server/uploads:/app/server/uploads

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=${VITE_API_URL}
      - VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY}
```

---

## 🔐 Security Checklist

### Before Going Live

- [ ] **Change JWT_SECRET**: Generate a secure random string
  ```bash
  openssl rand -base64 32
  ```

- [ ] **Use Production Stripe Keys**: Switch from test to live keys

- [ ] **Configure CORS**: Update CORS settings in `server/index.js`:
  ```javascript
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://yourdomain.com',
    credentials: true
  }))
  ```

- [ ] **Set Secure Cookies**: If using cookies, set secure flags

- [ ] **Enable HTTPS**: Always use HTTPS in production

- [ ] **Rate Limiting**: Consider adding rate limiting for API endpoints

- [ ] **Input Sanitization**: Verify all inputs are sanitized

- [ ] **File Upload Limits**: Set appropriate file size limits

---

## 📊 Database Migration (Optional)

### Migrate from SQLite to PostgreSQL

For better production performance, consider migrating to PostgreSQL:

1. **Export SQLite data**:
   ```bash
   sqlite3 gritsync.db .dump > backup.sql
   ```

2. **Set up PostgreSQL database** (Supabase, Railway, etc.)

3. **Import schema** from `supabase/schema.sql`

4. **Update connection** in `server/index.js`

---

## 🔧 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://api.yourdomain.com/api` |
| `PORT` | Backend server port | `3001` |
| `JWT_SECRET` | Secret for JWT tokens | `your-secure-secret` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `FRONTEND_URL` | Frontend URL for CORS | `https://yourdomain.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `development` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | - |

---

## 📝 Post-Deployment Steps

1. **Test Authentication**: Verify login/register works

2. **Test File Uploads**: Ensure file uploads work correctly

3. **Test Payments**: Verify Stripe integration (use test mode first)

4. **Monitor Logs**: Check for any errors in logs

5. **Set Up Monitoring**: Consider adding error tracking (Sentry, etc.)

6. **Backup Database**: Set up regular database backups

7. **SSL Certificate**: Ensure SSL is properly configured

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: CORS errors
- **Solution**: Update CORS settings in `server/index.js` with your frontend URL

**Issue**: Database locked
- **Solution**: Ensure only one instance of the backend is running

**Issue**: File uploads fail
- **Solution**: Check file permissions on `server/uploads` directory

**Issue**: Stripe payments fail
- **Solution**: Verify Stripe keys are correct and webhook is configured

---

## 📞 Support

For deployment issues, check:
- Server logs
- Browser console
- Network tab in DevTools
- Backend terminal output

---

## ✅ Production Checklist

- [ ] All environment variables set
- [ ] JWT_SECRET changed from default
- [ ] Stripe keys updated to production
- [ ] CORS configured correctly
- [ ] HTTPS enabled
- [ ] Database backups configured
- [ ] Error monitoring set up
- [ ] File storage configured
- [ ] Domain DNS configured
- [ ] SSL certificate installed

---

**Your application is ready for production!** 🎉

