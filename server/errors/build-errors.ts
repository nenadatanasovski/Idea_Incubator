/**
 * BUILD AGENT ERROR CLASSES
 *
 * Custom error types for structured error handling in the build agent API.
 */

export class BuildError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly buildId?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    buildId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "BuildError";
    this.code = code;
    this.statusCode = statusCode;
    this.buildId = buildId;
    this.details = details;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      buildId: this.buildId,
      details: this.details,
    };
  }
}

// Build execution errors
export class BuildNotFoundError extends BuildError {
  constructor(buildId: string) {
    super(`Build not found: ${buildId}`, "BUILD_NOT_FOUND", 404, buildId);
  }
}

export class BuildAlreadyRunningError extends BuildError {
  constructor(buildId: string) {
    super(
      `Build is already running: ${buildId}`,
      "BUILD_ALREADY_RUNNING",
      409,
      buildId,
    );
  }
}

export class BuildNotRunningError extends BuildError {
  constructor(buildId: string, currentStatus: string) {
    super(
      `Build is not running: ${buildId}`,
      "BUILD_NOT_RUNNING",
      400,
      buildId,
      { currentStatus },
    );
  }
}

export class BuildCompletedError extends BuildError {
  constructor(buildId: string) {
    super(
      `Build has already completed: ${buildId}`,
      "BUILD_COMPLETED",
      400,
      buildId,
    );
  }
}

// Task execution errors
export class TaskExecutionError extends BuildError {
  public readonly taskId: string;

  constructor(
    message: string,
    taskId: string,
    buildId?: string,
    details?: unknown,
  ) {
    super(message, "TASK_EXECUTION_ERROR", 500, buildId, {
      taskId,
      ...(details as object),
    });
    this.taskId = taskId;
  }
}

export class TaskNotFoundError extends BuildError {
  constructor(taskId: string, buildId?: string) {
    super(`Task not found: ${taskId}`, "TASK_NOT_FOUND", 404, buildId, {
      taskId,
    });
  }
}

export class TaskDependencyError extends BuildError {
  constructor(taskId: string, missingDeps: string[], buildId?: string) {
    super(
      `Task ${taskId} has unmet dependencies`,
      "TASK_DEPENDENCY_ERROR",
      400,
      buildId,
      { taskId, missingDeps },
    );
  }
}

// Validation errors
export class ValidationError extends BuildError {
  constructor(
    command: string,
    expected: string,
    actual: string,
    buildId?: string,
  ) {
    super(
      `Validation failed for command: ${command}`,
      "VALIDATION_ERROR",
      400,
      buildId,
      { command, expected, actual },
    );
  }
}

export class CodeGenerationError extends BuildError {
  constructor(taskId: string, message: string, buildId?: string) {
    super(
      `Code generation failed for task ${taskId}: ${message}`,
      "CODE_GENERATION_ERROR",
      500,
      buildId,
      { taskId },
    );
  }
}

// Checkpoint errors
export class CheckpointError extends BuildError {
  constructor(message: string, buildId?: string) {
    super(message, "CHECKPOINT_ERROR", 500, buildId);
  }
}

export class CheckpointNotFoundError extends BuildError {
  constructor(buildId: string) {
    super(
      `No checkpoint found for build: ${buildId}`,
      "CHECKPOINT_NOT_FOUND",
      404,
      buildId,
    );
  }
}

// Spec/Task file errors
export class SpecNotFoundError extends BuildError {
  constructor(specPath: string) {
    super(
      `Spec file not found: ${specPath}`,
      "SPEC_NOT_FOUND",
      404,
      undefined,
      { specPath },
    );
  }
}

export class InvalidSpecError extends BuildError {
  constructor(specPath: string, reason: string) {
    super(`Invalid spec file: ${reason}`, "INVALID_SPEC", 400, undefined, {
      specPath,
      reason,
    });
  }
}

// File operation errors
export class FileWriteError extends BuildError {
  constructor(filePath: string, reason: string, buildId?: string) {
    super(
      `Failed to write file: ${filePath}`,
      "FILE_WRITE_ERROR",
      500,
      buildId,
      { filePath, reason },
    );
  }
}

export class FileLockError extends BuildError {
  constructor(filePath: string, buildId?: string) {
    super(`File is locked: ${filePath}`, "FILE_LOCK_ERROR", 423, buildId, {
      filePath,
    });
  }
}

/**
 * Error handler middleware for Express.
 */
export function buildErrorHandler(
  error: Error,
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  _next: unknown,
): unknown {
  if (error instanceof BuildError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Log unexpected errors
  console.error("Unexpected build error:", error);

  return res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
}

/**
 * Wrap async route handlers to catch errors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>,
): (req: any, res: any, next: (err?: Error) => void) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
