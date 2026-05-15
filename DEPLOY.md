# GritSync — Deployment Runbook
> Last updated: 2026-05-14

Run through **both sections** in order every time you deploy.

---

## Pre-flight checklist (verify before every deploy)

| Check | Command | Expected |
|---|---|---|
| Node version | `node --version` | v20.x |
| Clean working tree | `git status` | nothing untracked / modified |
| Frontend builds | `npm run build` | exits 0, `dist/` created |
| TypeScript clean | `npx tsc --noEmit` | 0 errors |

---

## Step 1 — Apply the Supabase security migration

This only needs to be run **once** (or re-run if new tables are added later).

### Option A — Supabase SQL Editor (easiest)
1. Open https://supabase.com/dashboard → your project → **SQL Editor**
2. Click **New query**
3. Copy-paste the entire contents of:
   ```
   scripts/migrations/2026-05-14_fix_supabase_security_warnings.sql
   ```
4. Click **Run**
5. Confirm the output contains lines like:
   ```
   NOTICE: RLS enabled: users
   NOTICE: RLS enabled: applications
   ...
   NOTICE: Fixed: active_email_addresses → security_invoker
   NOTICE: Fixed search_path on: public.validate_promo_code(...)
   ```

### Option B — psql (if you have the connection string)
```bash
# Get the connection string from:
# Supabase Dashboard → Project Settings → Database → Connection string → URI
# (use the "Direct connection" not the pooler)

psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  -f scripts/migrations/2026-05-14_fix_supabase_security_warnings.sql
```

### Option C — Supabase CLI
```bash
# Requires: npm install -g supabase  +  supabase login
supabase db execute --file scripts/migrations/2026-05-14_fix_supabase_security_warnings.sql \
  --project-ref [YOUR_PROJECT_REF]
```

### Verify in Supabase Dashboard
After running, go to **Database → Security Advisor**. 
All "RLS Disabled in Public", "Security Definer View", and "Function Search Path Mutable" 
items should be gone. Residual warnings (if any) are for tables created after the migration.

---

## Step 2 — Deploy to Vercel

### Via Git (recommended — Vercel auto-deploys on push)
```bash
git add -A
git commit -m "fix: vercel runtime config + supabase security hardening"
git push origin main
```
Vercel will detect the push and deploy automatically.  
Watch progress at: https://vercel.com/dashboard

### Via Vercel CLI (manual deploy)
```bash
# First time only: npm install -g vercel  +  vercel login
vercel --prod
```

### Required Vercel environment variables
Make sure these are set in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Where to get it |
|---|---|
| `POSTGRES_URL` | Supabase → Project Settings → Database → Connection string (URI, direct) |
| `POSTGRES_PRISMA_URL` | Supabase → Project Settings → Database → Connection string (URI, pooler) |
| `JWT_SECRET` | Generate: `openssl rand -base64 48` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks |
| `RESEND_API_KEY` | resend.com → API Keys |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys |
| `NODE_ENV` | `production` |

---

## Step 3 — Smoke-test after deploy

Run these from your terminal or browser after the Vercel deployment completes:

```bash
# 1. Health check — must return 200
curl https://www.gritsync.com/api/health
# Expected: {"status":"ok","timestamp":"..."}

# 2. Settings endpoint — was 500 before, must now return 200
curl https://www.gritsync.com/api/db/settings?select=*
# Expected: {"data":[...],"error":null}

# 3. Public read (no auth needed) — services list
curl "https://www.gritsync.com/api/db/services?select=id,service_name,state&is_active=true"
# Expected: {"data":[...],"error":null}
```

If any of these return 500, check **Vercel → Deployments → [latest] → Logs** for the error.

---

## What changed in this deploy

### `vercel.json`
- **Removed** `"runtime": "nodejs20.x"` — this was AWS Lambda syntax; Vercel rejected it,
  which caused every `/api/*` request to 500.
- `memory` and `maxDuration` are preserved and still respected.

### `package.json`
- **Added** `"engines": { "node": ">=20.x" }` — the correct way to tell Vercel
  which Node.js version to use.

### `scripts/migrations/2026-05-14_fix_supabase_security_warnings.sql`
- Enables RLS on all 72 public tables (backend is unaffected — it uses service_role).
- Switches both views to `security_invoker`.
- Pins `search_path = ''` on all 33 flagged functions.
- All operations are wrapped in safe DO blocks that skip missing objects.
