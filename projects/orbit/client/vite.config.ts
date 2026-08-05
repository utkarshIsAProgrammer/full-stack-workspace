import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      sentryVitePlugin({
        org: process.env.SENTRY_ORG || "orbit-app",
        project: process.env.SENTRY_PROJECT || "orbit-frontend",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        disable: !process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          assets: "./dist/assets/**",
        },
      }),
      // PWA — custom service worker (src/sw.js) that handles web-push
      // notifications AND workbox runtime caching for offline support.
      VitePWA({
        registerType: 'autoUpdate',
        // injectManifest builds our custom SW so the push/notificationclick
        // handlers survive the build (generateSW would produce a caching-only
        // worker with NO push support — the root cause of missing device
        // notifications).
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'ORBIT — Your Inner Circle',
          short_name: 'ORBIT',
          description: 'A modern social platform for your inner circle — share posts, chat in real-time, and stay connected.',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          orientation: 'portrait-primary',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
      }),
      // Visualize bundle composition (run with ANALYZE=true to open report)
      ...(process.env.ANALYZE === 'true' ? [visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      })] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Generate sourcemaps only in development (or when explicitly opted in)
      sourcemap: !isProd || process.env.GENERATE_SOURCEMAPS === 'true',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'motion/react'],
            icons: ['lucide-react'],
            socket: ['socket.io-client'],
            gsap: ['gsap'],
            cropper: ['react-easy-crop'],
            chat: ['./src/components/Chat.tsx'],
            feed: ['./src/components/Feed.tsx'],
            profile: ['./src/components/Profile.tsx'],
            landing: ['./src/components/LandingPage.tsx'],
            leftnav: ['./src/components/LeftSidebar.tsx'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:5006',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Origin', 'http://localhost:5006');
            });
          },
        },
        '/socket.io': {
          target: 'ws://localhost:5006',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
