import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Prototipo F2: una sola entrada, sin división de código, para empaquetarlo en un único HTML. */
export default defineConfig({
  root: "prototype",
  base: "./",
  plugins: [react()],
  json: { stringify: true },
  build: {
    outDir: "../dist/prototype",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 2000,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
