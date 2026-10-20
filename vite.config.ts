/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react()],
  // PORT is set by tools that assign a free port (e.g. a preview runner).
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : { port: 5173, open: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
