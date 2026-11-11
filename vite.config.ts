import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'build' || isPreview ? '/Schematic-Tool/' : '/',
  build: {
    target: ['chrome111', 'firefox114', 'safari16.4'],
    cssTarget: ['chrome111', 'firefox114', 'safari16.4'],
  },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
}))
