import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // リポジトリ名と合わせること
  base: '/stock-checker-practice/',
  server: {
    host: true,
    port: 3000,
    watch: {
      usePolling: true,
    },
  },
})
