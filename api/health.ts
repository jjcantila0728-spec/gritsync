import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  const start = Date.now()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  const checks: Record<string, any> = {
    env: process.env.NODE_ENV,
    ts: new Date().toISOString(),
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!serviceKey,
  }

  let dbOk = false
  let dbError: string | null = null

  if (!supabaseUrl || !serviceKey) {
    dbError = 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  } else {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await supabase
      .from('settings')
      .select('key')
      .limit(1)

    if (error) {
      dbError = error.message
    } else {
      dbOk = true
    }
  }

  checks.db = dbOk ? 'ok' : 'error'
  if (dbError) checks.dbError = dbError
  checks.latencyMs = Date.now() - start

  res.setHeader('Content-Type', 'application/json')
  res.statusCode = dbOk ? 200 : 503
  res.end(JSON.stringify({ ok: dbOk, ...checks }))
}
