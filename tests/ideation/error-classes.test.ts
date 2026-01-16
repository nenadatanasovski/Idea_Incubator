import { describe, test, expect } from "vitest";
import {
  IdeationError,
  SessionNotFoundError,
  SessionNotActiveError,
  SessionAlreadyExistsError,
  CandidateNotFoundError,
  NoCandidateError,
  ProfileNotFoundError,
  ValidationError,
  ContextLimitError,
  AgentProcessingError,
  WebSearchError,
  MemoryFileError,
  ideationErrorHandler,
  asyncHandler,
} from "../../server/errors/ideation-errors.js";

describe("IdeationErrors", () => {
  describe("IdeationError base class", () => {
    test("PASS: Creates error with all fields", () => {
      const error = new IdeationError("Test error", "TEST_ERROR", 400, {
        extra: "data",
      });

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ extra: "data" });
    });

    test("PASS: toJSON returns correct structure", () => {
      const error = new IdeationError("Test", "TEST", 500, { foo: "bar" });
      const json = error.toJSON();

      expect(json.error).toBe("Test");
      expect(json.code).toBe("TEST");
      expect(json.details).toEqual({ foo: "bar" });
    });

    test("PASS: Defaults to 500 status code", () => {
      const error = new IdeationError("Test", "TEST");

      expect(error.statusCode).toBe(500);
    });
  });

  describe("SessionNotFoundError", () => {
    test("PASS: Has correct properties", () => {
      const error = new SessionNotFoundError("session_123");

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("SESSION_NOT_FOUND");
      expect(error.message).toContain("session_123");
    });
  });

  describe("SessionNotActiveError", () => {
    test("PASS: Includes current status in details", () => {
      const error = new SessionNotActiveError("session_123", "completed");

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("SESSION_NOT_ACTIVE");
      expect(error.details).toEqual({ currentStatus: "completed" });
    });
  });

  describe("SessionAlreadyExistsError", () => {
    test("PASS: Returns 409 conflict", () => {
      const error = new SessionAlreadyExistsError(
        "profile_1",
        "existing_session",
      );

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe("SESSION_ALREADY_EXISTS");
      expect(error.details).toEqual({ existingSessionId: "existing_session" });
    });
  });

  describe("CandidateNotFoundError", () => {
    test("PASS: Has correct properties", () => {
      const error = new CandidateNotFoundError("candidate_456");

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("CANDIDATE_NOT_FOUND");
      expect(error.message).toContain("candidate_456");
    });
  });

  describe("NoCandidateError", () => {
    test("PASS: Has correct properties", () => {
      const error = new NoCandidateError("session_789");

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("NO_CANDIDATE");
      expect(error.message).toContain("session_789");
    });
  });

  describe("ProfileNotFoundError", () => {
    test("PASS: Has correct properties", () => {
      const error = new ProfileNotFoundError("profile_abc");

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("PROFILE_NOT_FOUND");
      expect(error.message).toContain("profile_abc");
    });
  });

  describe("ValidationError", () => {
    test("PASS: Includes validation issues", () => {
      const issues = [{ field: "email", message: "Invalid email" }];
      const error = new ValidationError(issues);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual({ issues });
    });
  });

  describe("ContextLimitError", () => {
    test("PASS: Includes token counts", () => {
      const error = new ContextLimitError(85000, 80000);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("CONTEXT_LIMIT_EXCEEDED");
      expect(error.details).toEqual({
        currentTokens: 85000,
        limit: 80000,
        requiresHandoff: true,
      });
    });
  });

  describe("AgentProcessingError", () => {
    test("PASS: Includes original error message", () => {
      const originalError = new Error("LLM timeout");
      const error = new AgentProcessingError(
        "Failed to process",
        originalError,
      );

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("AGENT_PROCESSING_ERROR");
      expect(error.details).toEqual({ originalError: "LLM timeout" });
    });

    test("PASS: Works without original error", () => {
      const error = new AgentProcessingError("Processing failed");

      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ originalError: undefined });
    });
  });

  describe("WebSearchError", () => {
    test("PASS: Includes query and original error", () => {
      const originalError = new Error("API rate limit");
      const error = new WebSearchError("best CRM software", originalError);

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("WEB_SEARCH_ERROR");
      expect(error.details).toEqual({
        query: "best CRM software",
        originalError: "API rate limit",
      });
    });
  });

  describe("MemoryFileError", () => {
    test("PASS: Includes all context", () => {
      const error = new MemoryFileError(
        "session_123",
        "self_discovery",
        "write",
      );

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("MEMORY_FILE_ERROR");
      expect(error.details).toEqual({
        sessionId: "session_123",
        fileType: "self_discovery",
        operation: "write",
      });
    });
  });

  describe("ideationErrorHandler", () => {
    test("PASS: Handles IdeationError", () => {
      const error = new SessionNotFoundError("test");
      let capturedCode: number | null = null;
      let capturedBody: unknown = null;

      const mockRes = {
        status: (code: number) => {
          capturedCode = code;
          return {
            json: (body: unknown) => {
              capturedBody = body;
              return { code, body };
            },
          };
        },
      };

      ideationErrorHandler(error, {}, mockRes, () => {});

      expect(capturedCode).toBe(404);
      expect(capturedBody).toEqual({
        error: "Session not found: test",
        code: "SESSION_NOT_FOUND",
        details: undefined,
      });
    });

    test("PASS: Handles generic Error", () => {
      const error = new Error("Random error");
      let capturedCode: number | null = null;
      let capturedBody: unknown = null;

      const mockRes = {
        status: (code: number) => {
          capturedCode = code;
          return {
            json: (body: unknown) => {
              capturedBody = body;
              return { code, body };
            },
          };
        },
      };

      // Suppress expected console.error output during test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      ideationErrorHandler(error, {}, mockRes, () => {});

      expect(capturedCode).toBe(500);
      expect(capturedBody).toEqual({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
      expect(consoleSpy).toHaveBeenCalledWith("Unexpected error:", error);

      consoleSpy.mockRestore();
    });
  });

  describe("asyncHandler", () => {
    test("PASS: Catches async errors", async () => {
      let caughtError: Error | null = null;
      const handler = asyncHandler(async () => {
        throw new Error("Async error");
      });

      await new Promise<void>((resolve) => {
        handler({}, {}, (err?: Error) => {
          caughtError = err || null;
          resolve();
        });
      });

      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe("Async error");
    });

    test("PASS: Passes through successful async results", async () => {
      let handlerResult: unknown = null;

      const handler = asyncHandler(async (_req, _res, _next) => {
        handlerResult = "success";
        return handlerResult;
      });

      // Just execute the handler - if no error, it won't call next
      const nextFn = vi.fn();
      await handler({}, {}, nextFn);

      // Give it a tick to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      // If no error thrown, next should not be called
      expect(handlerResult).toBe("success");
      expect(nextFn).not.toHaveBeenCalled();
    });
  });
});
