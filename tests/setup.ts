import { beforeAll, afterAll, vi } from "vitest";

// Global test setup
beforeAll(() => {
  // Set up test environment variables
  process.env.NODE_ENV = "test";

  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  }
});

afterAll(() => {
  // Clean up
  vi.restoreAllMocks();
});

// Global test utilities
declare global {
  var testUtils: {
    createTestIdea: (overrides?: Partial<TestIdea>) => TestIdea;
  };
}

interface TestIdea {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  stage: string;
}

globalThis.testUtils = {
  createTestIdea: (overrides = {}) => ({
    id: "test-idea-001",
    slug: "test-idea",
    title: "Test Idea",
    summary: "A test idea for unit testing",
    type: "technical",
    stage: "SPARK",
    ...overrides,
  }),
};
