import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0", // Listen on all interfaces for consistent behavior
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        timeout: 400000, // 400 seconds to allow for 360s Claude CLI timeout
      },
      "/ws": {
        target: "http://localhost:3001",
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            // Suppress EPIPE errors - these are normal when connections close
            if ((err as NodeJS.ErrnoException).code !== "EPIPE") {
              console.error("[vite ws proxy]", err.message);
            }
          });
        },
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
