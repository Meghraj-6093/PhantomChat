import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "PhantomChat",
        short_name: "Phantom",
        description: "A premium real-time chat platform — messaging, calls, groups and channels.",
        theme_color: "#0A0A0C",
        background_color: "#0A0A0C",
        display: "standalone",
        // No orientation lock — the installed app runs on phones, tablets,
        // and desktops, and portrait-primary previously broke it on
        // landscape tablets/laptops.
        start_url: "/",
        scope: "/",
        categories: ["social", "communication"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Friends", url: "/friends", description: "Open your friends list" },
          { name: "Discover", url: "/discover", description: "Find public groups & channels" },
          { name: "Settings", url: "/settings", description: "Open settings" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        runtimeCaching: [
          {
            // API cache: network-first so chats work offline with last-known data.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "phantom-api",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Media (Cloudinary + avatars): cache-first.
            urlPattern: ({ url }) =>
              url.hostname.includes("res.cloudinary.com") || url.hostname.includes("googleusercontent.com") || url.hostname.includes("avatars.githubusercontent.com"),
            handler: "CacheFirst",
            options: {
              cacheName: "phantom-media",
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com",
            handler: "CacheFirst",
            options: {
              cacheName: "phantom-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:4000", ws: true },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          query: ["@tanstack/react-query", "zustand"],
        },
      },
    },
  },
});
