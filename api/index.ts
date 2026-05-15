/**
 * Vercel serverless entry-point.
 *
 * Vercel calls the exported default value as an HTTP handler — it passes
 * (req, res) directly to the Express app, so no `listen()` is needed here.
 * Environment variables are injected by Vercel; dotenv is a no-op in that
 * context and is harmless to leave in server/index.ts.
 *
 * WHY dynamic import instead of `export { default } from '../server/index'`:
 * With "type": "module" in package.json, the compiled api/index.js is an ES
 * Module. Vercel's CJS runtime calls require() on it (Node 22 allows this),
 * but Node 22's require(esm) throws ERR_REQUIRE_CYCLE_MODULE when the static
 * ESM import graph contains a cycle. Using dynamic import() here removes
 * server/index from the static graph entirely, breaking the cycle.
 */
import type { IncomingMessage, ServerResponse } from 'http'

type AppHandler = (req: IncomingMessage, res: ServerResponse) => void

let _app: AppHandler | null = null

async function loadApp(): Promise<AppHandler> {
  if (!_app) {
    const mod = await import('../server/index.js')
    _app = mod.default as AppHandler
  }
  return _app
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await loadApp()
  app(req, res)
}
