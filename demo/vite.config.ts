import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Alias the workspace packages to their SOURCE so the demo hot-reloads on edits
// to the library — no dist build needed during development.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "clarity-mind": fileURLToPath(
        new URL("../packages/core/src/index.ts", import.meta.url),
      ),
      "@clarity-mind/react": fileURLToPath(
        new URL("../packages/react/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5310,
    strictPort: true,
  },
});
