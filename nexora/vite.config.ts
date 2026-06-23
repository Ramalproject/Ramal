import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor'
          if (id.includes('node_modules/react/')) return 'vendor'
          if (id.includes('@mantine/')) return 'mantine'
          if (id.includes('@supabase/')) return 'supabase'
          if (id.includes('@tanstack/')) return 'query'
        },
      },
    },
  },
})
