import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Настройка прокси для перенаправления запросов в локальной среде разработки
    proxy: {
      // Все запросы к /api перенаправляем на локальный PostgREST (порт 3000)
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => {
          console.log(`[Vite Proxy] Перенаправление /api запроса: ${path}`); // Логирование проксируемых путей
          return path.replace(/^\/api/, "");
        },
      },
      // Все запросы к /auth перенаправляем на локальный Express-бэкенд (порт 5000)
      "/auth": {
        target: "http://localhost:5000",
        changeOrigin: true,
        rewrite: (path) => {
          console.log(`[Vite Proxy] Перенаправление /auth запроса: ${path}`); // Логирование проксируемых путей
          return path.replace(/^\/auth/, "");
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt"],
      manifest: {
        name: "Домофондар",
        short_name: "Домофондар",
        description: "Система управления заявками и сотрудниками",
        theme_color: "#1e3a5f",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/fsm",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        importScripts: ['/sw-push.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  publicDir: "public", // по умолчанию
  // Добавляем папку media как статическую директорию
  build: {
    copyPublicDir: true,
  },
}));
