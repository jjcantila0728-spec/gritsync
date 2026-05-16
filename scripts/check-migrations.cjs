// One-off: check which scripts/migrations/*.sql have been applied to the
// Supabase DB. There's no migration-tracking table, so we probe a
// distinctive artifact per migration. Same DB-URL handling as run-migration.cjs.
//
// Usage:  node scripts/check-migrations.cjs

require('dotenv').config()
const { Client } = require('pg')

const checks = [
  {
    file: '2026-05-12_align_schema_with_app.sql',
    probe: `SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='total_step1'`,
  },
  {
    file: '2026-05-12_unify_user_profile_data.sql',
    probe: `SELECT 1 FROM information_schema.columns WHERE table_name='user_details' AND column_name='first_name'`,
  },
  {
    file: '2026-05-13_quotations_align_with_app.sql',
    probe: `SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='line_items'`,
  },
  {
    file: '2026-05-13_user_documents_add_filename_uploaded_at.sql',
    probe: `SELECT 1 FROM information_schema.columns WHERE table_name='user_documents' AND column_name='filename'`,
  },
  {
    file: '2026-05-14_add_get_table_columns_rpc.sql',
    probe: `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='public' AND p.proname='get_table_columns'`,
  },
  {
    file: '2026-05-14_fix_supabase_security_warnings.sql',
    // Migration sets search_path = '' on public functions. Pass if at least
    // one public function has an explicit search_path config; fail if NO public
    // function has one (means the migration hasn't been applied here).
    probe: `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='public' AND p.proconfig::text LIKE '%search_path%' LIMIT 1`,
  },
  {
    file: '2026-05-15_nclex_schema.sql',
    probe: `SELECT 1 FROM information_schema.tables WHERE table_name='nclex_questions'`,
  },
  {
    file: '2026-05-15_notifications_align_with_app.sql',
    probe: `SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='application_id'`,
  },
  {
    file: '2026-05-15_password_reset_tokens_add_otp.sql',
    probe: `SELECT 1 FROM information_schema.columns WHERE table_name='password_reset_tokens' AND column_name='otp'`,
  },
  {
    file: '2026-05-15_nclex_live_sessions_and_site_settings.sql',
    probe: `SELECT 1 FROM information_schema.tables WHERE table_name='nclex_live_sessions'`,
  },
]

;(async () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
  if (!url) {
    console.error('No DATABASE_URL / POSTGRES_PRISMA_URL / POSTGRES_URL set.')
    process.exit(2)
  }
  // Avoid pg-connection-string's verify-full mapping; parse manually.
  const u = new URL(url)
  const c = new Client({
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()
  let missing = 0
  for (const { file, probe } of checks) {
    try {
      const r = await c.query(probe)
      const ok = r.rowCount > 0
      console.log(`${ok ? '✓ APPLIED ' : '✗ MISSING '} ${file}`)
      if (!ok) missing++
    } catch (err) {
      console.log(`? ERROR   ${file}  — ${err.message}`)
      missing++
    }
  }
  await c.end()
  console.log('')
  console.log(missing === 0 ? 'All migrations applied.' : `${missing} migration(s) need to be run.`)
  process.exit(missing === 0 ? 0 : 1)
})()
