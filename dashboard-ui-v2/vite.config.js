import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/v2/',
  build: {
    outDir: path.resolve(__dirname, '../src/dist-v2'),
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7700',
        changeOrigin: true
      }
    }
  }
})
