import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/metabase': {
        target: 'https://ucoz.metabaseapp.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/metabase/, '')
      }
    }
  }
})
