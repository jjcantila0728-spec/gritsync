export default function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true, ts: new Date().toISOString(), env: process.env.NODE_ENV }))
}
