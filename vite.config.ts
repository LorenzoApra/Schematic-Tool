import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, isPreview, mode }) => ({
  plugins: [
    react(),
    {
      name: 'desktop-content-policy',
      transformIndexHtml:
        mode === 'desktop'
          ? () => [
              {
                tag: 'meta',
                attrs: {
                  'http-equiv': 'Content-Security-Policy',
                  content:
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'",
                },
                injectTo: 'head-prepend',
              },
            ]
          : undefined,
    },
  ],
  base:
    mode === 'desktop'
      ? './'
      : command === 'build' || isPreview
        ? '/Schematic-Tool/'
        : '/',
  build: {
    outDir: mode === 'desktop' ? 'dist-desktop' : 'dist',
    target: ['chrome111', 'firefox114', 'safari16.4'],
    cssTarget: ['chrome111', 'firefox114', 'safari16.4'],
  },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
}))
