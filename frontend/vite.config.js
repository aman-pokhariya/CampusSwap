import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Defaults match backend/.env.example. The env overrides let a second copy run side by side (e.g. for testing).
const API_TARGET = process.env.VITE_DEV_API || "http://localhost:8084";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: process.env.VITE_CACHE_DIR || "node_modules/.vite",
  server: {
    port: Number(process.env.VITE_DEV_PORT) || 5173,
    strictPort: true,
    host: true, // also reachable from your phone on the same Wi-Fi
    proxy: {
      // The browser calls /api on the frontend's own origin and Vite forwards it to Express.
      // Same origin = the auth cookie is first-party, with no CORS or third-party-cookie trouble.
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
      // Live chat (Socket.io) runs on the same Express server; ws: true forwards the WebSocket upgrade.
      "/socket.io": {
        target: API_TARGET,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
