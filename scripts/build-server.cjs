/**
 * Bundle server/index.ts into a single CJS file at api/_server.cjs.
 *
 * Vercel's @vercel/node compiles api/*.ts to ESM, which causes
 * require-of-ESM cycle errors with our Express + routes graph at runtime.
 * By pre-bundling everything to CJS here, api/index.js can just require()
 * the bundle — no compiler runs at deploy time, no ESM in the chain.
 */
const esbuild = require('esbuild')
const path = require('path')

esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'server', 'index.ts')],
  outfile: path.join(__dirname, '..', 'api', '_server.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  // Keep native deps and Node built-ins external.
  // Playwright (used by agents.ts) is loaded behind `if (!process.env.VERCEL)`
  // so it's marked external just in case esbuild still tries to trace it.
  external: ['playwright', 'pg-native', 'bufferutil', 'utf-8-validate'],
  loader: { '.ts': 'ts' },
  sourcemap: false,
  minify: false,
  logLevel: 'info',
})
