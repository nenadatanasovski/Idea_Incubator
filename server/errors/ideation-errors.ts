/**
 * IDEATION ERROR CLASSES
 *
 * Custom error types for structured error handling in the ideation API.
 */

export class IdeationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = 'IdeationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

// Session errors
export class SessionNotFoundError extends IdeationError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', 404);
  }
}

export class SessionNotActiveError extends IdeationError {
  constructor(sessionId: string, currentStatus: string) {
    super(
      `Session is not active: ${sessionId}`,
      'SESSION_NOT_ACTIVE',
      400,
      { currentStatus }
    );
  }
}

export class SessionAlreadyExistsError extends IdeationError {
  constructor(profileId: string, existingSessionId: string) {
    super(
      'An active session already exists for this profile',
      'SESSION_ALREADY_EXISTS',
      409,
      { existingSessionId }
    );
  }
}

// Candidate errors
export class CandidateNotFoundError extends IdeationError {
  constructor(candidateId: string) {
    super(`Candidate not found: ${candidateId}`, 'CANDIDATE_NOT_FOUND', 404);
  }
}

export class NoCandidateError extends IdeationError {
  constructor(sessionId: string) {
    super(
      `No active candidate for session: ${sessionId}`,
      'NO_CANDIDATE',
      400
    );
  }
}

// Profile errors
export class ProfileNotFoundError extends IdeationError {
  constructor(profileId: string) {
    super(`Profile not found: ${profileId}`, 'PROFILE_NOT_FOUND', 404);
  }
}

// Validation errors
export class ValidationError extends IdeationError {
  constructor(issues: unknown[]) {
    super('Validation error', 'VALIDATION_ERROR', 400, { issues });
  }
}

// Token/Context errors
export class ContextLimitError extends IdeationError {
  constructor(currentTokens: number, limit: number) {
    super(
      'Context limit exceeded, handoff required',
      'CONTEXT_LIMIT_EXCEEDED',
      400,
      { currentTokens, limit, requiresHandoff: true }
    );
  }
}

// Agent errors
export class AgentProcessingError extends IdeationError {
  constructor(message: string, originalError?: Error) {
    super(
      `Agent processing failed: ${message}`,
      'AGENT_PROCESSING_ERROR',
      500,
      { originalError: originalError?.message }
    );
  }
}

export class WebSearchError extends IdeationError {
  constructor(query: string, originalError?: Error) {
    super(
      `Web search failed for: ${query}`,
      'WEB_SEARCH_ERROR',
      500,
      { query, originalError: originalError?.message }
    );
  }
}

// Memory/File errors
export class MemoryFileError extends IdeationError {
  constructor(sessionId: string, fileType: string, operation: string) {
    super(
      `Memory file operation failed: ${operation}`,
      'MEMORY_FILE_ERROR',
      500,
      { sessionId, fileType, operation }
    );
  }
}

/**
 * Error handler middleware for Express.
 */
export function ideationErrorHandler(
  error: Error,
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  _next: unknown
): unknown {
  if (error instanceof IdeationError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Wrap async route handlers to catch errors.
 */
export function asyncHandler(
  fn: (req: unknown, res: unknown, next: unknown) => Promise<unknown>
): (req: unknown, res: unknown, next: (err?: Error) => void) => void {
  return (req: unknown, res: unknown, next: (err?: Error) => void) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
