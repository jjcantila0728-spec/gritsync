/**
 * Vercel serverless entry-point.
 *
 * Loads the pre-bundled CJS server (built by scripts/build-server.cjs
 * during `npm run build`). This file is plain .js so Vercel skips
 * its TypeScript→ESM compiler entirely, which is what was crashing
 * the lambda with ERR_REQUIRE_CYCLE_MODULE.
 */
const mod = require('./_server.cjs')
module.exports = mod.default || mod
