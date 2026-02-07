import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [
      "tests/integration/**",
      "tests/e2e/**",
      "node_modules/**",
      "dist/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["tests/**", "spikes/**", "node_modules/**", "dist/**"],
    },
    globalSetup: ["tests/globalSetup.ts"],
    setupFiles: ["tests/setup.ts"],
    poolOptions: {
      threads: {
        singleThread: true,
      },
      forks: {
        singleFork: true,
      },
    },
  },
  server: {
    watch: {
      ignored: ["**/.venv/**", "**/node_modules/**", "**/.git/**"],
    },
  },
});
