import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup.ts"],
    // Erster Lauf lädt ggf. das MongoDB-Binary herunter.
    hookTimeout: 120_000,
    testTimeout: 20_000,
  },
});
