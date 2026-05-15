export default function handler(_req: any, res: any) {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = 200
  res.end(JSON.stringify({
    ok: true,
    probe: 'minimal-no-imports',
    node: process.version,
    env: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ts: new Date().toISOString(),
  }))
}
