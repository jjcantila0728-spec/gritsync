/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Legacy alias kept for `import ... from '@db/db-js'` imports that
      // predate the local-Postgres API client.
      '@db/db-js': path.resolve(__dirname, './src/lib/api-client.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // mobile-e2e holds Playwright specs — they crash if vitest collects them.
    exclude: ['**/node_modules/**', '**/dist/**', 'mobile-e2e/**', 'mobile/**', 'review/**'],
  },
  server: {
    port: 5000,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Production build optimizations
    target: 'es2015',
    minify: 'esbuild', // esbuild is faster than terser
    sourcemap: false, // No sourcemaps in production for security and size
    cssMinify: true, // Minify CSS
    rollupOptions: {
      output: {
        // ONLY split optional heavy deps that aren't part of the React
        // initialization graph. Splitting react / react-dom / router into
        // their own chunks causes initialization-order white-screens
        // (lucide-react and axios transitively import React, and if they
        // resolve before vendor-react executes, Context.createContext is
        // undefined). Bundling react with the rest of the vendor code
        // — Vite's default — sidesteps that entirely.
        manualChunks: (id) => {
          // Vite's preload helper is shared by every dynamic import. Without an
          // explicit assignment Rollup colocates it inside the first manual
          // chunk it sees (the 1MB 'pdf' chunk), which makes the entry chunk
          // statically import 'pdf' and load it eagerly on every page.
          if (id.includes('vite/preload-helper')) return 'preload-helper'
          // Rollup's CJS interop helpers are shared by every chunk; pin them
          // to vendor-react so they don't get colocated inside a heavy chunk.
          if (id.includes('commonjsHelpers')) return 'vendor-react'
          if (!id.includes('node_modules')) return
          // Keep the React runtime in its own dependency-free chunk. If it is
          // left to default placement, Rollup hoists react/react-dom into
          // whichever manual chunk (lucide/recharts) imports them first, which
          // forces that whole heavy chunk to load eagerly with the entry.
          // vendor-react imports nothing, so it always evaluates first — no
          // initialization-order issues.
          // Includes tiny dependency-free shared libs (clsx, react-is,
          // prop-types) for the same reason as the helpers above.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-is|prop-types|clsx)[\\/]/.test(id)) return 'vendor-react'
          if (/[\\/]node_modules[\\/](jspdf|html2canvas|pdf-lib|@pdf-lib)[\\/]/.test(id)) return 'pdf'
          if (/[\\/]node_modules[\\/]@stripe[\\/]/.test(id)) return 'stripe'
          if (/[\\/]node_modules[\\/]@anthropic-ai[\\/]/.test(id)) return 'anthropic'
          if (/[\\/]node_modules[\\/]recharts[\\/]/.test(id)) return 'recharts'
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'lucide'
          if (/[\\/]node_modules[\\/]date-fns[\\/]/.test(id)) return 'date-fns'
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        },
      },
    },
    // Chunk size warnings (increased for production)
    chunkSizeWarningLimit: 1000,
    // Optimize assets - inline small assets as base64
    assetsInlineLimit: 4096,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Report compressed size
    reportCompressedSize: true,
    // Remove console logs in production (esbuild minify handles this)
    // Note: esbuild automatically removes console.log in production builds
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})

