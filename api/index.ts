/**
 * Vercel serverless entry-point.
 *
 * Vercel calls the default export as an HTTP handler — it passes (req, res)
 * directly to the Express app, so no `listen()` is needed here.
 *
 * Static import (not dynamic) so esbuild bundles everything into a single
 * CJS file. A dynamic import() causes esbuild to code-split the dependency
 * into a separate ESM chunk, and require()ing an ESM chunk with cyclical
 * imports throws ERR_REQUIRE_CYCLE_MODULE on Node 22.
 */
import app from '../server/index'

export default app
