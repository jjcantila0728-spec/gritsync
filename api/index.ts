/**
 * Vercel serverless entry-point.
 *
 * Vercel calls the exported default value as an HTTP handler — it passes
 * (req, res) directly to the Express app, so no `listen()` is needed here.
 * Environment variables are injected by Vercel; dotenv is a no-op in that
 * context and is harmless to leave in server/index.ts.
 */
export { default } from '../server/index'
