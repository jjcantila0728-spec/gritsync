module.exports = function handler(req, res) {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({
    ok: true,
    probe: 'js-cjs',
    node: process.version,
    env: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ts: new Date().toISOString(),
  }))
}
