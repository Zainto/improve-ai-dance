import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    open: false,
    proxy: {
      // Python backend (PoseScript + Nemotron)
      '/api/feedback': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/describe': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/correct': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Fallback: Direct NVIDIA API (for when backend is not running)
      '/api/nvidia': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, '/v1'),
        secure: true,
      }
    }
  }
})
