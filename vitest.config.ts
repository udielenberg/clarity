import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the `clarity-mind` package to core's SOURCE during tests, so the
      // React package's tests don't require a built `dist/` (CI runs the build
      // after the tests) and run against the latest source directly.
      "clarity-mind": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
