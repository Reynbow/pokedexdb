import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dexShards from './scripts/dex-shards-plugin.mjs'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), dexShards()],
  build: {
    // Enable minification (default is esbuild, which is faster)
    minify: 'esbuild', // Use esbuild for faster builds (default)
    // Alternatively, use terser for better minification (requires: npm install -D terser)
    // minify: 'terser',
    // terserOptions: {
    //   compress: {
    //     drop_console: false, // Keep console logs for debugging
    //     drop_debugger: true,
    //   },
    // },
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // React + ReactDOM in their own long-lived chunk (the object form only caught the tiny
        // `react` entry; ReactDOM's client build stayed in the main bundle)
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor'
          }
          return undefined
        },
        // Optimize chunk names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging (optional)
    sourcemap: false,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})
