/**
 * Mock Claude CLI responses for deterministic testing
 * VIBE-P13-010
 */

export interface MockClaudeResponse {
  type: 'result';
  subtype?: 'success' | 'error';
  is_error: boolean;
  result: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  duration_ms?: number;
  num_turns?: number;
}

/**
 * Success responses for various operations
 */
export const successResponses = {
  /**
   * Multi-file change success
   */
  multiFileSuccess: {
    type: 'result' as const,
    subtype: 'success' as const,
    is_error: false,
    result: 'TASK_COMPLETE: Successfully coordinated changes across 3 files:\n- database/migrations/001_create_users.sql\n- server/routes/users.ts\n- frontend/src/components/UserList.tsx\nAll files compiled successfully.',
    total_cost_usd: 0.05,
    usage: {
      input_tokens: 1500,
      output_tokens: 800,
      cache_read_input_tokens: 200
    },
    duration_ms: 5000,
    num_turns: 3
  },

  /**
   * Frontend component generation
   */
  frontendGeneration: {
    type: 'result' as const,
    subtype: 'success' as const,
    is_error: false,
    result: 'TASK_COMPLETE: Generated React component UserCard.tsx with:\n- TypeScript interface for props\n- Tailwind CSS styling\n- Responsive design\n- Accessibility attributes',
    total_cost_usd: 0.04,
    usage: {
      input_tokens: 1000,
      output_tokens: 1500
    },
    duration_ms: 4000,
    num_turns: 2
  },

  /**
   * Backend endpoint generation
   */
  backendGeneration: {
    type: 'result' as const,
    subtype: 'success' as const,
    is_error: false,
    result: 'TASK_COMPLETE: Generated Express route handler for GET /api/users/:id with:\n- TypeScript types (UserResponse)\n- Validation middleware (validateGetUserById)\n- Error handling\n- OpenAPI documentation',
    total_cost_usd: 0.04,
    usage: {
      input_tokens: 1100,
      output_tokens: 1300
    },
    duration_ms: 4500,
    num_turns: 2
  },

  /**
   * Database migration generation
   */
  migrationGeneration: {
    type: 'result' as const,
    subtype: 'success' as const,
    is_error: false,
    result: 'TASK_COMPLETE: Generated SQL migration 001_create_users_table.sql with:\n- CREATE TABLE users statement\n- Indexes for performance\n- Foreign key constraints\n- Rollback migration included',
    total_cost_usd: 0.02,
    usage: {
      input_tokens: 800,
      output_tokens: 600
    },
    duration_ms: 3000,
    num_turns: 1
  },

  /**
   * Full feature orchestration
   */
  fullFeatureOrchestration: {
    type: 'result' as const,
    subtype: 'success' as const,
    is_error: false,
    result: 'TASK_COMPLETE: Orchestrated complete feature "User Management" with:\n- Database: 1 migration (users table)\n- API: 3 endpoints (GET, POST, PUT)\n- UI: 2 components (UserList, UserCard)\nAll layers validated and integrated successfully.',
    total_cost_usd: 0.12,
    usage: {
      input_tokens: 3500,
      output_tokens: 2800,
      cache_read_input_tokens: 500
    },
    duration_ms: 12000,
    num_turns: 5
  },

  /**
   * Context caching benefit
   */
  cachedContextAccess: {
    type: 'result' as const,
    subtype: 'success' as const,
    is_error: false,
    result: 'TASK_COMPLETE: Accessed cached context from previous layer:\n- Database schema from layer 1\n- API types from layer 2\n- Generated UI component using cached information\nCache hit rate: 80%',
    total_cost_usd: 0.015,
    usage: {
      input_tokens: 500,
      output_tokens: 800,
      cache_read_input_tokens: 1200
    },
    duration_ms: 2500,
    num_turns: 1
  }
};

/**
 * Error responses for failure scenarios
 */
export const errorResponses = {
  /**
   * Rollback triggered by compilation error
   */
  multiFileRollback: {
    type: 'result' as const,
    subtype: 'error' as const,
    is_error: true,
    result: 'TASK_FAILED: Compilation error in server/routes/users.ts:\nTypeError: Property "username" does not exist on type User.\nRolling back all changes:\n- Reverted database/migrations/001_create_users.sql\n- Reverted server/routes/users.ts',
    total_cost_usd: 0.03,
    usage: {
      input_tokens: 1200,
      output_tokens: 400
    },
    duration_ms: 3000,
    num_turns: 2
  },

  /**
   * Validation gate blocked
   */
  validationBlocked: {
    type: 'result' as const,
    subtype: 'error' as const,
    is_error: true,
    result: 'TASK_FAILED: Validation failed - preventing commit:\n- TypeScript errors: 3 errors in generated code\n- Lint errors: 2 violations\n- Test failures: 1 integration test failed\nNo files committed to git.',
    total_cost_usd: 0.01,
    usage: {
      input_tokens: 500,
      output_tokens: 200
    },
    duration_ms: 1500,
    num_turns: 1
  },

  /**
   * Cross-layer validation failure
   */
  crossLayerValidationFailure: {
    type: 'result' as const,
    subtype: 'error' as const,
    is_error: true,
    result: 'TASK_FAILED: Cross-layer validation failed:\n- API endpoint references database column "user.email_address" which does not exist\n- UI component calls endpoint "/api/user/:id" which is not defined\n- Type mismatch: API returns string but UI expects number',
    total_cost_usd: 0.02,
    usage: {
      input_tokens: 800,
      output_tokens: 300
    },
    duration_ms: 2000,
    num_turns: 1
  },

  /**
   * Database migration conflict
   */
  migrationConflict: {
    type: 'result' as const,
    subtype: 'error' as const,
    is_error: true,
    result: 'TASK_FAILED: Migration conflict detected:\n- Table "users" already exists in database\n- Cannot create duplicate table\n- Suggest renaming to "app_users" or using ALTER TABLE',
    total_cost_usd: 0.015,
    usage: {
      input_tokens: 600,
      output_tokens: 250
    },
    duration_ms: 1800,
    num_turns: 1
  },

  /**
   * Insufficient context
   */
  insufficientContext: {
    type: 'result' as const,
    subtype: 'error' as const,
    is_error: true,
    result: 'TASK_FAILED: Insufficient context to generate code:\n- Database schema not available from previous layer\n- Cannot infer types for API without database context\n- Please ensure database layer is completed first',
    total_cost_usd: 0.01,
    usage: {
      input_tokens: 400,
      output_tokens: 150
    },
    duration_ms: 1200,
    num_turns: 1
  }
};

/**
 * Helper to serialize responses for use with mocked CLI
 */
export function serializeResponse(response: MockClaudeResponse): string {
  return JSON.stringify(response);
}

/**
 * Helper to create custom response
 */
export function createMockResponse(
  success: boolean,
  result: string,
  options: {
    inputTokens?: number;
    outputTokens?: number;
    cacheTokens?: number;
    cost?: number;
    duration?: number;
    turns?: number;
  } = {}
): MockClaudeResponse {
  return {
    type: 'result',
    subtype: success ? 'success' : 'error',
    is_error: !success,
    result,
    total_cost_usd: options.cost ?? (success ? 0.03 : 0.01),
    usage: {
      input_tokens: options.inputTokens ?? 1000,
      output_tokens: options.outputTokens ?? 500,
      cache_read_input_tokens: options.cacheTokens
    },
    duration_ms: options.duration ?? 3000,
    num_turns: options.turns ?? 1
  };
}
