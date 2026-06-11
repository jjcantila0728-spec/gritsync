// Verifies that every table/view the app can touch is queryable in the live
// DB: the /api/db allowlist (server/routes/query.ts), the background-job
// tables from the P1/P2 migrations, and the social/nclex tables used by
// dedicated routes. `SELECT * LIMIT 0` catches missing tables AND broken views.
// Usage: node scripts/check-schema.cjs
require('dotenv').config()
const { Client } = require('pg')

const TABLES = [
  // /api/db allowlist
  'applications', 'application_payments', 'application_timeline_steps',
  'users', 'user_details', 'user_documents', 'user_preferences',
  'services', 'service_required_documents', 'notifications', 'notification_types',
  'settings', 'promo_codes', 'quotations', 'careers', 'career_applications',
  'donations', 'partner_agencies', 'nclex_sponsorships', 'testimonials',
  'conversations', 'messages', 'email_addresses', 'email_logs', 'email_templates',
  'sessions', 'exchange_rates', 'visa_bulletin_cache', 'visa_bulletin_email_log',
  'newsletter_subscriptions', 'email_signatures', 'business_logos',
  'processing_accounts', 'receipts', 'temporary_signatures',
  'email_queue', 'email_analytics', 'email_subscribers', 'subscriber_stats',
  'email_campaigns', 'email_campaign_recipients',
  'email_ab_tests', 'email_ab_test_results', 'email_ab_test_recipients',
  'received_emails', 'workflows', 'workflow_runs', 'workflow_triggers',
  'analytics_cache', 'custom_reports', 'report_schedules',
  'active_email_addresses', 'ab_test_stats',
  // infra / background jobs (P1+P2 migrations, cron tick)
  'schema_migrations', 'cron_runs', 'push_tickets', 'webhook_queue',
  'password_reset_tokens', 'facebook_data_deletions',
  // social suite (dedicated routes)
  'social_accounts', 'social_posts', 'social_autopilot_state',
  'social_content_bank', 'social_image_templates', 'social_group_candidates',
  'social_ai_prompt_refinements', 'social_quote_drafts', 'service_integrations',
  // nclex suite
  'nclex_questions', 'nclex_case_studies', 'nclex_pending_questions',
  'nclex_pending_case_studies', 'nclex_sessions', 'nclex_session_items',
  'nclex_profiles', 'nclex_exit_access', 'nclex_site_settings',
  'nclex_testimonials', 'nclex_live_sessions',
]

;(async () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
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
  const failures = []
  for (const t of TABLES) {
    try {
      await c.query(`SELECT * FROM "${t}" LIMIT 0`)
    } catch (e) {
      failures.push(`${t}: ${e.message}`)
    }
  }
  // The column-introspection RPC the app relies on
  try {
    await c.query(`SELECT public.get_table_columns('users')`)
  } catch (e) {
    failures.push(`rpc get_table_columns: ${e.message}`)
  }
  await c.end()
  if (failures.length) {
    console.error(`FAIL — ${failures.length}/${TABLES.length} problems:`)
    failures.forEach((f) => console.error('  ' + f))
    process.exit(1)
  }
  console.log(`OK — all ${TABLES.length} tables/views queryable + get_table_columns RPC present.`)
})().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
