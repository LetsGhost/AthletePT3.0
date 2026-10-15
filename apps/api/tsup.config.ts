import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/scripts/create-sysadmin.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Das Shared-Paket liegt nur als TypeScript-Quelle vor und wird mitgebündelt.
  noExternal: ["@athletept/shared"],
});
