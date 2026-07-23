import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/v2/',
  build: {
    outDir: path.resolve(__dirname, '../backend/src/dist-v2'),
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7700',
        changeOrigin: true
      }
    }
  },
  // 이 저장소에서 실제로 새어 나간 결함은 전부 렌더링 계층에 있었다. 백엔드 테스트는
  // API를 직접 부르기 때문에 화면을 거쳐 만들어지는 값과 실패 상태 렌더링을 덮지 못한다.
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.jsx'],
    globals: true
  }
})
