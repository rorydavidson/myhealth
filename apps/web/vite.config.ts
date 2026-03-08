import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: resolve(__dirname, "../.."),
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  // pdfjs-dist must be excluded from Vite's dependency pre-bundling.
  // When Vite pre-bundles it, the worker file gets a content-hashed URL
  // (e.g. assets/pdf.worker.min-XXXX.mjs) that pdfjs cannot dynamically
  // import at runtime — causing "Setting up fake worker failed".
  // Excluding it lets Vite serve the file directly from node_modules at a
  // stable, importable URL.
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
