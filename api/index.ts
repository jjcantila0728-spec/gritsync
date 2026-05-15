/**
 * Vercel serverless entry-point.
 *
 * Captures any module-load error from server/index so we can surface
 * the full stack trace in the HTTP response (production logs truncate
 * the message and hide the failing module path).
 */
let app: any = null
let loadErr: any = null

try {

  app = require('../server/index').default
} catch (e: any) {
  loadErr = e
}

export default function handler(req: any, res: any) {
  if (loadErr) {
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 500
    res.end(JSON.stringify({
      error: 'module-load-failed',
      name: loadErr.name,
      code: loadErr.code,
      message: loadErr.message,
      stack: typeof loadErr.stack === 'string' ? loadErr.stack.split('\n').slice(0, 20) : null,
    }, null, 2))
    return
  }
  return app(req, res)
}
