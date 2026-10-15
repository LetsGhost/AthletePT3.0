/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    // Der Vendor-Chunk (React, Router, Query, Radix, zod) liegt bei ca. 625 kB (200 kB gzip).
    // Die Grenze knapp darüber, damit ein unerwartetes Wachstum auffällt.
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        // Bibliotheken ändern sich seltener als App-Code und bleiben so länger im Browser-Cache.
        codeSplitting: {
          // Chart.js nicht: Es wird nur auf den Fortschrittsseiten gebraucht und lädt mit ihnen.
          groups: [{ name: "vendor", test: /node_modules[\\/](?!chart\.js[\\/])/ }],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Fester Port: Links in Mails (APP_URL) zeigen auf genau diese Adresse.
    strictPort: true,
    // Gleiche Origin wie die App: Das Refresh-Cookie (SameSite=Strict) funktioniert ohne CORS.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    css: false,
  },
});
