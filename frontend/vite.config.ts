import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const core = process.env.LATTICE_CORE_URL ?? 'http://localhost:8000'
const notifications = process.env.LATTICE_NOTIFY_URL ?? 'http://localhost:8001'

// One origin for the browser: /api/v1/notifications goes to the notification
// service, everything else under /api to the core API (nginx does the same in
// production), so there is no CORS and no API URL to configure.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      '/api/v1/notifications': { target: notifications, changeOrigin: true },
      '/api': { target: core, changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          flow: ['@xyflow/react', '@dagrejs/dagre'],
        },
      },
    },
  },
})
