import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/globalSetup.ts"],
    testTimeout: 30000, // Integration tests may take longer
    hookTimeout: 60000, // Allow time for server startup
  },
});
