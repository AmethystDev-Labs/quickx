import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: "esm",
  target: "node20",
  outDir: "dist",
  clean: true,
  outputOptions: {
    banner: "#!/usr/bin/env node\n",
  },
});
