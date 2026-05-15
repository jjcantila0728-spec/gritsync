export default async function handler(req: any, res: any) {
  const start = Date.now()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  const checks: Record<string, any> = {
    env: process.env.NODE_ENV,
    ts: new Date().toISOString(),
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!serviceKey,
    node: process.version,
  }

  let dbOk = false
  let dbError: any = null

  try {
    if (!supabaseUrl || !serviceKey) {
      dbError = 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    } else {
      const mod = await import('@supabase/supabase-js')
      const supabase = mod.createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await supabase
        .from('settings')
        .select('key')
        .limit(1)
      if (error) {
        dbError = { name: error.name, message: error.message, code: (error as any).code }
      } else {
        dbOk = true
        checks.rows = data?.length ?? 0
      }
    }
  } catch (e: any) {
    dbError = {
      name: e?.name,
      message: e?.message,
      code: e?.code,
      stack: typeof e?.stack === 'string' ? e.stack.split('\n').slice(0, 12) : null,
    }
  }

  checks.db = dbOk ? 'ok' : 'error'
  if (dbError) checks.dbError = dbError
  checks.latencyMs = Date.now() - start

  res.setHeader('Content-Type', 'application/json')
  res.statusCode = dbOk ? 200 : 503
  res.end(JSON.stringify({ ok: dbOk, ...checks }, null, 2))
}
