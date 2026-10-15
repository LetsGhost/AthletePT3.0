/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const SW_TEMPLATE = fileURLToPath(new URL("./sw/service-worker.js", import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

/**
 * Erzeugt beim Build `sw.js` aus `sw/service-worker.js`: setzt die Liste aller auszuliefernden
 * Dateien (für den Offline-Cache) und eine Version ein. Die Version ändert sich, sobald sich
 * irgendeine Datei ändert; der Browser installiert dann den neuen Service Worker.
 */
function serviceWorker(): Plugin {
  return {
    name: "athletept-service-worker",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const hash = createHash("sha256");
      const files: string[] = [];
      for (const [fileName, output] of Object.entries(bundle).sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        // Ältere Schriftformate braucht kein Browser, der Service Worker kann.
        if (fileName.endsWith(".map") || fileName.endsWith(".woff")) continue;
        files.push(`/${fileName}`);
        hash.update(fileName).update(output.type === "chunk" ? output.code : output.source);
      }
      for (const fileName of readdirSync(PUBLIC_DIR).sort()) {
        files.push(`/${fileName}`);
        hash.update(fileName).update(readFileSync(`${PUBLIC_DIR}/${fileName}`));
      }
      const source = readFileSync(SW_TEMPLATE, "utf8")
        .replace("__SW_VERSION__", hash.digest("hex").slice(0, 16))
        .replace("__SW_PRECACHE__", JSON.stringify(files));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
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
