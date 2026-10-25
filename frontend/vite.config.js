import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    host: true, // also reachable from your phone on the same Wi-Fi
    proxy: {
      // The browser calls /api on the frontend's own origin and Vite forwards it to Express.
      // Same origin = the auth cookie is first-party, with no CORS or third-party-cookie trouble.
      "/api": {
        target: "http://localhost:8084",
        changeOrigin: true,
      },
    },
  },
});
