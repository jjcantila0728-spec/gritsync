# How to Push Supabase Migrations

## Option 1: Using Supabase CLI (Recommended)

### Install Supabase CLI
```bash
# Windows (using Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or using npm
npm install -g supabase

# Or download from: https://github.com/supabase/cli/releases
```

### Login to Supabase
```bash
supabase login
```

### Link to your project
```bash
supabase link --project-ref your-project-ref
```

### Push migrations
```bash
# Push all pending migrations
supabase db push

# Or push specific migration
supabase migration up
```

## Option 2: Using Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste each migration file content
5. Run them in order (check migration file names for order)

## Option 3: Using Supabase API

You can use the Supabase Management API to apply migrations programmatically.

## Migration Files to Apply

The following migration files exist in `supabase/migrations/`:

1. Core migrations (apply in order based on timestamps)
2. Feature migrations (email system, workflows, analytics, etc.)
3. Fix migrations (RLS policies, indexes, etc.)

## Important Notes

- **Always backup your database before applying migrations**
- **Test migrations in a development environment first**
- **Apply migrations in order (check file timestamps)**
- **Some migrations depend on others - check dependencies**

## Current Migration Files

All migration files are located in: `supabase/migrations/`

Key migrations include:
- Email system (templates, logs, queue, campaigns)
- Workflows system
- Analytics system
- Email campaigns and subscribers
- RLS policies and security fixes
- Performance optimizations



