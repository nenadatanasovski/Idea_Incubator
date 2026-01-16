/**
 * Base error class for all Idea Incubator errors
 */
export class IdeaIncubatorError extends Error {
  constructor(message) {
    super(message);
    this.name = "IdeaIncubatorError";
  }
}
/**
 * Thrown when an idea cannot be found by slug or id
 */
export class IdeaNotFoundError extends IdeaIncubatorError {
  slug;
  constructor(slug) {
    super(`Idea not found: ${slug}`);
    this.name = "IdeaNotFoundError";
    this.slug = slug;
  }
}
/**
 * Thrown when agent response cannot be parsed
 */
export class EvaluationParseError extends IdeaIncubatorError {
  constructor(message) {
    super(`Failed to parse evaluation: ${message}`);
    this.name = "EvaluationParseError";
  }
}
/**
 * Thrown when API rate limit is hit
 */
export class APIRateLimitError extends IdeaIncubatorError {
  retryAfter;
  constructor(retryAfter) {
    super(`Rate limited. Retry after ${retryAfter || "unknown"} seconds`);
    this.name = "APIRateLimitError";
    this.retryAfter = retryAfter;
  }
}
/**
 * Thrown when evaluation budget is exceeded
 */
export class BudgetExceededError extends IdeaIncubatorError {
  spent;
  budget;
  constructor(spent, budget) {
    super(
      `Budget exceeded: $${spent.toFixed(2)} spent of $${budget.toFixed(2)} limit`,
    );
    this.name = "BudgetExceededError";
    this.spent = spent;
    this.budget = budget;
  }
}
/**
 * Thrown when API call limit is exceeded
 */
export class ApiCallLimitError extends IdeaIncubatorError {
  calls;
  maxCalls;
  constructor(calls, maxCalls) {
    super(`API call limit exceeded: ${calls} calls made of ${maxCalls} limit`);
    this.name = "ApiCallLimitError";
    this.calls = calls;
    this.maxCalls = maxCalls;
  }
}
/**
 * Thrown when debate fails to converge within limits
 */
export class ConvergenceTimeoutError extends IdeaIncubatorError {
  rounds;
  maxRounds;
  constructor(rounds, maxRounds) {
    super(`Convergence timeout: ${rounds} rounds reached max ${maxRounds}`);
    this.name = "ConvergenceTimeoutError";
    this.rounds = rounds;
    this.maxRounds = maxRounds;
  }
}
/**
 * Thrown when input validation fails
 */
export class ValidationError extends IdeaIncubatorError {
  field;
  constructor(field, message) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = "ValidationError";
    this.field = field;
  }
}
/**
 * Thrown when database operation fails
 */
export class DatabaseError extends IdeaIncubatorError {
  operation;
  constructor(operation, message) {
    super(`Database error during ${operation}: ${message}`);
    this.name = "DatabaseError";
    this.operation = operation;
  }
}
/**
 * Thrown when file sync operation fails
 */
export class SyncError extends IdeaIncubatorError {
  filePath;
  constructor(message, filePath) {
    super(`Sync error: ${message}${filePath ? ` (${filePath})` : ""}`);
    this.name = "SyncError";
    this.filePath = filePath;
  }
}
/**
 * Thrown when markdown parsing fails
 */
export class MarkdownParseError extends IdeaIncubatorError {
  filePath;
  constructor(filePath, message) {
    super(`Failed to parse markdown at ${filePath}: ${message}`);
    this.name = "MarkdownParseError";
    this.filePath = filePath;
  }
}
/**
 * Thrown when configuration is invalid
 */
export class ConfigurationError extends IdeaIncubatorError {
  configKey;
  constructor(configKey, message) {
    super(`Invalid configuration for ${configKey}: ${message}`);
    this.name = "ConfigurationError";
    this.configKey = configKey;
  }
}
