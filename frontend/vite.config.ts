import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: command === 'serve' ? '/' : '/static/frontend/',
  build: {
    outDir: path.resolve(__dirname, '../backend/static/frontend'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
      '/admin': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
      '/static': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
    },
  },
}))
