import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:4000',
      '/agents': 'http://localhost:4000',
      '/grants': 'http://localhost:4000',
      '/audit': 'http://localhost:4000',
    },
  },
})
