import { defineConfig } from "tsup";
import fs from "node:fs";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  target: "node18",
  clean: true,
  dts: true,
  onSuccess: async () => {
    fs.copyFileSync("src/extension/monk-extension.ts", "dist/monk-extension.ts");
  },
});
