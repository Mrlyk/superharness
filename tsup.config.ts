import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: { "hooks/session-start": "src/hooks/session-start.ts" },
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    splitting: false,
    sourcemap: true,
    dts: false,
  },
]);
