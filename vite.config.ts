/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    // Production build optimizations
    target: 'es2015',
    minify: 'esbuild', // esbuild is faster than terser
    sourcemap: false, // No sourcemaps in production for security and size
    cssMinify: true, // Minify CSS
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Optimize chunk splitting for better caching
          if (id.includes('node_modules')) {
            // React and core dependencies
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor'
            }
            // UI libraries
            if (id.includes('lucide-react')) {
              return 'ui-vendor'
            }
            // PDF generation
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-vendor'
            }
            // Stripe
            if (id.includes('stripe')) {
              return 'stripe-vendor'
            }
            // Supabase
            if (id.includes('supabase')) {
              return 'supabase-vendor'
            }
            // Other vendor code
            return 'vendor'
          }
        },
        // Add content hash to filenames for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
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

