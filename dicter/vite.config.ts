import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/stock-checker/dicter/',
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true,
    port: 3001,
    watch: {
      usePolling: true,
    },
  },
})
