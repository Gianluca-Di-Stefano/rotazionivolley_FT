import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Installable PWA ("Add to Home Screen" / "Install" on Android Chrome,
    // "Add to Home Screen" on iOS Safari) that works offline. The service
    // worker is registered in src/main.tsx (state in src/update/pwaUpdates.ts,
    // UI in src/update/UpdateNotice.tsx), only on the plain web build, and a
    // new version waits for the user's OK ('prompt') instead of reloading the
    // page under them.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Rotazioni Volley',
        short_name: 'Rotazioni',
        description: 'Schemi di ricezione a 3 nella pallavolo rispetto alla posizione del palleggiatore.',
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        categories: ['sports', 'education'],
        background_color: '#fafafa',
        theme_color: '#fafafa',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'favicon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        // Only for link previews on other sites — no need to keep it offline.
        globIgnores: ['**/social-preview.png'],
        // The main bundle is over workbox's 2 MB default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
