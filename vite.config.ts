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
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](jspdf|html2canvas|pdf-lib|@pdf-lib)[\\/]/.test(id)) return 'pdf'
          if (/[\\/]node_modules[\\/]@stripe[\\/]/.test(id)) return 'stripe'
          if (/[\\/]node_modules[\\/]@anthropic-ai[\\/]/.test(id)) return 'anthropic'
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

