import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5003',
      '/healthz': 'http://127.0.0.1:5003',
      '/readyz': 'http://127.0.0.1:5003',
      '/metrics': 'http://127.0.0.1:5003',
    },
  },
  build: {
    // Embedded Go build writes into internal/webui/dist; Vercel builds use
    // T4C_WEB_OUT_DIR=dist so the output stays inside the web/ deployment root.
    outDir: process.env.T4C_WEB_OUT_DIR || '../internal/webui/dist',
    emptyOutDir: true,
  },
})
