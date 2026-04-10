import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // リポジトリ名に合わせて変更
  base: '/stock-checker-practice/manager/',
  server: {
    host: true,
    port: 3001,
    watch: {
      usePolling: true,
    },
  },
})
