import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // The e2e files share one fixture (dist and cache), so files run one at a time.
    fileParallelism: false,
    exclude: ["test/fixtures/**", "node_modules/**"],
  },
});
