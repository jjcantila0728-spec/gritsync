/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './attached_assets'),
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
    strictPort: false, // Allow Vite to use next available port if 5000 is busy
    allowedHosts: true,
    cors: true,
  },
  build: {
    // Production build optimizations
    target: 'es2015',
    minify: 'esbuild', // esbuild is faster than terser
    sourcemap: false, // No sourcemaps in production for security and size
    cssMinify: true, // Minify CSS
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            'react-router',
            'react-hook-form',
            'recharts',
            'lucide-react',
            '@stripe/react-stripe-js',
          ],
          'pdf-vendor': ['jspdf', 'html2canvas', 'pdf-lib'],
          'supabase-vendor': ['@supabase/supabase-js'],
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

