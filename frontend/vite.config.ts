import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["three", "reagraph", "scheduler", "react-reconciler", "mermaid"],
    force: true, // Force re-bundling
    esbuildOptions: {
      // Needed for Three.js to work correctly
      target: "esnext",
    },
  },
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
        configure: (proxy) => {
          proxy.on("error", (err) => {
            // Suppress EPIPE errors - these are normal when connections close
            if ((err as NodeJS.ErrnoException).code !== "EPIPE") {
              console.error("[vite ws proxy]", err.message);
            }
          });
          proxy.on("proxyReqWs", (proxyReq, req, socket, options, head) => {
            console.debug(
              "[vite ws proxy] WebSocket upgrade request:",
              req.url,
            );
          });
        },
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      // Ensure Three.js is properly bundled
      output: {
        manualChunks: {
          three: ["three"],
          reagraph: ["reagraph"],
        },
      },
    },
  },
  // Handle CJS dependencies that may have issues
  resolve: {
    alias: {
      // Three.js needs this for proper ES module support
      three: "three",
    },
    // Dedupe React packages to prevent version conflicts
    dedupe: ["react", "react-dom", "scheduler"],
  },
});
