# TASK-004: Fix Anthropic Client Type Compatibility

## Status
**Created:** 2026-02-08
**Status:** SPECIFICATION
**Priority:** Medium
**Estimated Effort:** 1-2 hours

## Current State

**TypeScript Compilation Status:** ✅ PASSING (0 errors)

While TypeScript currently compiles without errors, this specification addresses **type safety improvements** and **SDK alignment** to prevent future issues and improve developer experience.

## Overview

Improve TypeScript type safety in `utils/anthropic-client.ts` to fully align with the Anthropic SDK v0.71.2 type definitions. The custom `AnthropicClient` type interface uses loose types (e.g., `model: string`) instead of the SDK's strict union types, which reduces type safety and IDE support.

## Problem Statement

The `utils/anthropic-client.ts` file defines a custom `AnthropicClient` type to provide a unified interface across three authentication methods:
1. Standard Anthropic SDK (API key)
2. pi-ai library (OAuth token)
3. Claude Code CLI (OAuth via CLI session)

While the current implementation **works at runtime** and **compiles without errors**, the custom type definition uses **loose types** instead of leveraging the SDK's strict types. This results in:

### Type Safety Issues

1. **Reduced type safety**: Using `model: string` instead of the SDK's `Model` type means typos in model names won't be caught at compile time
   ```typescript
   // Current: This compiles but fails at runtime
   model: "claude-sonnett-3-5" // Typo! But TypeScript allows it

   // With SDK types: Would be caught at compile time
   model: "claude-sonnett-3-5" // Error: Type '"claude-sonnett-3-5"' is not assignable to type 'Model'
   ```

2. **Limited IDE support**: Loose string types don't provide autocomplete or inline documentation for valid model names

3. **Content structure limitations**: The custom interface only supports simple string content:
   ```typescript
   messages: Array<{ role: "user" | "assistant"; content: string }>
   ```
   The SDK's `MessageParam` supports richer content:
   ```typescript
   interface MessageParam {
     content: string | Array<ContentBlockParam>; // Images, documents, etc.
     role: 'user' | 'assistant';
   }
   ```

4. **Future SDK changes**: As the SDK evolves (e.g., adding new content types or model names), the custom type won't automatically stay in sync

### What Already Works

- **Runtime behavior**: All three auth methods work correctly
- **Basic type checking**: TypeScript compiles without errors
- **Text-only messages**: The current interface handles simple text messages fine
- **Response parsing**: Basic text response extraction works

### Current Code Context

**File:** `utils/anthropic-client.ts`

**Custom Type Definition (lines 28-46):**
```typescript
export type AnthropicClient = {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    }) => Promise<{
      content: Array<{ type: "text"; text: string }>;
      model: string;
      stop_reason: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
    }>;
  };
};
```

**SDK Types (from `@anthropic-ai/sdk@0.71.2`):**
```typescript
type Model = 'claude-opus-4-5-20251101' | 'claude-opus-4-5' | 'claude-3-7-sonnet-latest' | ... | (string & {});

interface MessageParam {
  content: string | Array<ContentBlockParam>;
  role: 'user' | 'assistant';
}

type ContentBlockParam = TextBlockParam | ImageBlockParam | DocumentBlockParam | ... ;
```

## Benefits of This Change

### Developer Experience
- **Autocomplete**: IDE will suggest valid model names
- **Type safety**: Typos in model names caught at compile time
- **Inline docs**: Hover over types to see SDK documentation
- **Refactoring support**: Easier to find all uses of specific models

### Future-Proofing
- **SDK upgrades**: Easier to upgrade SDK versions
- **New features**: Can use new SDK features (images, documents, thinking blocks)
- **Breaking changes**: SDK breaking changes will surface at compile time

### Code Quality
- **Self-documenting**: Types show what's valid without checking docs
- **Fewer runtime errors**: Invalid parameters caught before runtime
- **Consistency**: All code uses the same SDK types

## Requirements

### Functional Requirements
1. The `AnthropicClient` type must use SDK's `Model` type for the model parameter
2. The `messages` parameter must support both simple string content and structured content blocks
3. The response type must match the SDK's `Message` interface
4. All three authentication methods (SDK, pi-ai, CLI) must continue to work
5. Existing code using `client.messages.create()` should continue to work without changes
6. TypeScript compilation must complete with zero errors (maintain current state)

### Non-Functional Requirements
1. TypeScript compilation must complete without type errors
2. No runtime behavior changes
3. Type safety improvements should catch potential issues at compile time
4. Backward compatibility with existing usage patterns

## Technical Design

### Approach

Rather than creating a custom type that might drift from the SDK, we should:

1. **Import SDK types directly** where possible
2. **Use type aliases** for the actual SDK types
3. **Maintain the wrapper pattern** for pi-ai and CLI clients but with proper typing

### Proposed Changes

#### 1. Update Type Imports

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageCreateParamsNonStreaming,
  Message
} from "@anthropic-ai/sdk/resources/messages";
```

#### 2. Redefine AnthropicClient Type

Replace the custom type definition with one that references SDK types:

```typescript
/**
 * Client interface that matches the Anthropic SDK's messages.create signature
 * Used to unify SDK, pi-ai, and CLI authentication methods
 */
export type AnthropicClient = {
  messages: {
    create: (
      params: MessageCreateParamsNonStreaming
    ) => Promise<Message>;
  };
};
```

#### 3. Update pi-ai Client Wrapper

The `createPiAiClient()` function needs to properly transform between the SDK's expected types and pi-ai's types:

```typescript
function createPiAiClient(): AnthropicClient {
  const apiKey = getEnvApiKey("anthropic");

  return {
    messages: {
      create: async (params: MessageCreateParamsNonStreaming): Promise<Message> => {
        // Model handling with proper typing
        const modelId = params.model;
        type AnthropicModels = "claude-3-5-sonnet-20241022" | "claude-3-5-haiku-20241022" | "claude-3-opus-20240229";
        const model = getModel("anthropic", modelId as AnthropicModels);

        if (!model) {
          throw new Error(`Model not found: ${modelId}`);
        }

        // Transform SDK MessageParam[] to pi-ai Message[]
        const messages = params.messages.map(m => {
          // Extract string content from MessageParam
          const textContent = typeof m.content === 'string'
            ? m.content
            : m.content.filter(block => block.type === 'text')
                       .map(block => (block as any).text)
                       .join('\n');

          if (m.role === "user") {
            const userMsg: PiAiUserMessage = {
              role: "user" as const,
              content: [{ type: "text" as const, text: textContent }],
              timestamp: Date.now()
            };
            return userMsg;
          } else {
            // Assistant message
            const assistantMsg: PiAiAssistantMessage = {
              role: "assistant" as const,
              content: [{ type: "text" as const, text: textContent }],
              api: model.api,
              provider: model.provider,
              model: model.id,
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                  total: 0
                }
              },
              stopReason: "stop" as const,
              timestamp: Date.now()
            };
            return assistantMsg;
          }
        });

        const context: import("@mariozechner/pi-ai").Context = {
          systemPrompt: typeof params.system === 'string' ? params.system : undefined,
          messages: messages
        };

        // Stream and collect response
        const response = streamAnthropic(model, context, {
          apiKey: apiKey!,
          maxTokens: params.max_tokens
        });

        let textContent = "";
        let stopReason: Message['stop_reason'] = "end_turn";
        let inputTokens = 0;
        let outputTokens = 0;

        for await (const chunk of response) {
          if (chunk.type === "text_delta" && chunk.delta) {
            textContent += chunk.delta;
          }
          if (chunk.type === "done") {
            stopReason = (chunk.reason || "end_turn") as Message['stop_reason'];
            if (chunk.message?.usage) {
              inputTokens = chunk.message.usage.input || 0;
              outputTokens = chunk.message.usage.output || 0;
            }
          }
        }

        // Return SDK-compatible Message object
        const message: Message = {
          id: `msg_${Date.now()}`,
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: textContent }],
          model: modelId,
          stop_reason: stopReason,
          stop_sequence: null,
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        };

        return message;
      },
    },
  };
}
```

#### 4. Update CLI Client Wrapper

Verify that `claude-cli-client.ts`'s `createCliClient()` also returns a properly typed `AnthropicClient`.

#### 5. Update Existing Usages (if needed)

Most existing code should work as-is since they use simple string content:

```typescript
// This pattern (used throughout codebase) will continue to work
const response = await client.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 2048,
  system: "You are helpful",
  messages: [
    { role: "user", content: "Hello" }
  ],
});

// Access response
const text = response.content
  .filter(block => block.type === 'text')
  .map(block => block.text)
  .join('');
```

## Implementation Steps

1. ✅ **Read and analyze current code**
   - Review `utils/anthropic-client.ts`
   - Check SDK type definitions
   - Identify all type mismatches

2. **Update type imports**
   - Import `MessageCreateParamsNonStreaming` and `Message` from SDK
   - Import other necessary types

3. **Redefine AnthropicClient type**
   - Replace custom type with SDK-referencing type
   - Ensure it covers all three auth methods

4. **Update createPiAiClient()**
   - Add proper type annotations
   - Handle `system` parameter (string vs array)
   - Handle `messages` content (string vs array)
   - Return fully-typed `Message` object

5. **Verify CLI client**
   - Check `utils/claude-cli-client.ts`
   - Ensure return type matches

6. **Run TypeScript compilation**
   - `npx tsc --noEmit`
   - Fix any new type errors

7. **Run tests**
   - `npm test`
   - Ensure no runtime regressions

8. **Manual verification**
   - Test with API key auth
   - Test with OAuth auth (if available)
   - Test with CLI auth

## Pass Criteria

### Compilation
- [ ] `npx tsc --noEmit` completes with zero errors
- [ ] No type errors in `utils/anthropic-client.ts`
- [ ] No type errors in files importing from `utils/anthropic-client.ts`

### Type Safety
- [ ] `model` parameter accepts SDK's `Model` type (strict union)
- [ ] `messages` parameter accepts both string and ContentBlockParam[] content
- [ ] `system` parameter accepts both string and TextBlockParam[]
- [ ] Return type matches SDK's `Message` interface

### Functionality
- [ ] All tests pass: `npm test`
- [ ] Existing code using `client.messages.create()` works without modification
- [ ] API key authentication continues to work
- [ ] OAuth authentication (pi-ai) continues to work
- [ ] CLI authentication continues to work

### Code Quality
- [ ] No use of `any` types (except where necessary for pi-ai interop)
- [ ] Proper type imports from SDK
- [ ] Clear comments explaining type transformations
- [ ] No runtime behavior changes

## Dependencies

### Upstream Dependencies
- `@anthropic-ai/sdk@^0.71.2` - Already installed
- `@mariozechner/pi-ai@^0.51.6` - Already installed

### Files to Modify
1. `utils/anthropic-client.ts` - Primary changes
2. `utils/claude-cli-client.ts` - Verify return type compatibility

### Files to Review (may need updates)
- `agents/evaluator.ts` - Uses `client.messages.create()`
- `agents/orchestrator.ts` - Uses `client.messages.create()`
- `server/services/agent-runner.ts` - Uses `client.messages.create()`
- And ~40 other files (see grep results)

## Risk Assessment

**Risk Level:** Low-Medium

### Risks
1. **Breaking existing code**: Type changes might reveal hidden type errors in existing code
   - *Mitigation*: Run full test suite, check compilation errors carefully

2. **pi-ai compatibility**: The pi-ai library has its own type system that may conflict
   - *Mitigation*: Use type transformations and tested conversion logic

3. **Runtime behavior change**: Type fixes might inadvertently change runtime behavior
   - *Mitigation*: Run full test suite, manual testing with all auth methods

### Benefits
1. **Type safety**: Catch potential bugs at compile time
2. **SDK alignment**: Easier to upgrade SDK versions in future
3. **Better IDE support**: Improved autocomplete and inline documentation
4. **Maintenance**: Clearer code with explicit types

## Testing Strategy

### Unit Tests
- Existing tests in `tests/` should continue to pass
- No new unit tests required (type-only change)

### Integration Tests
- Run existing agent tests
- Test all three auth methods if possible

### Type Tests
- `npx tsc --noEmit` - primary validation
- Check for any new type errors in dependent files

### Manual Testing
```bash
# 1. Type check
npx tsc --noEmit

# 2. Run full test suite
npm test

# 3. Test with different auth methods (if credentials available)
ANTHROPIC_API_KEY=sk-... npm run evaluate test-idea
ANTHROPIC_OAUTH_TOKEN=... npm run evaluate test-idea
# (CLI auth - default when no env vars set)
```

## Verification Steps

After implementation, verify:

1. **Compilation succeeds**
   ```bash
   npx tsc --noEmit
   # Should complete with no errors
   ```

2. **Tests pass**
   ```bash
   npm test
   # All test suites should pass
   ```

3. **Type checking works**
   ```typescript
   // In a test file, verify these type correctly:
   const response = await client.messages.create({
     model: "claude-3-5-sonnet-20241022", // Should autocomplete
     max_tokens: 2048,
     messages: [
       { role: "user", content: "test" } // String content works
     ]
   });

   // Response should have proper types
   const text: string = response.content[0].text; // Should type-check
   ```

4. **No runtime regressions**
   - Run an actual evaluation with `npm run evaluate <slug>`
   - Verify the response is correctly processed

## Success Metrics

### Before (Current State)
```typescript
// Typo not caught
const response = await client.messages.create({
  model: "claude-sonnett-3-5", // ❌ No error, but fails at runtime
  max_tokens: 2048,
  messages: [{ role: "user", content: "test" }]
});
```

### After (Target State)
```typescript
// Typo caught at compile time
const response = await client.messages.create({
  model: "claude-sonnett-3-5", // ✅ TypeScript error: Invalid model name
  //     ^^^^^^^^^^^^^^^^^^^
  //     Type '"claude-sonnett-3-5"' is not assignable to type 'Model'
  max_tokens: 2048,
  messages: [{ role: "user", content: "test" }]
});

// Valid model with autocomplete
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250929", // ✅ Autocompletes, validates
  max_tokens: 2048,
  messages: [{ role: "user", content: "test" }]
});
```

## Notes

- This is primarily a **type-level improvement** - no runtime behavior changes
- The SDK already has `(string & {})` as part of the `Model` union, which provides backward compatibility while enabling strict checking for known models
- The pi-ai wrapper needs careful type conversion since it uses a different type system
- Consider adding JSDoc comments to explain the type transformations
- **Current status**: TypeScript compiles without errors, so this is a **quality improvement** rather than a bug fix

## References

- Anthropic SDK: https://github.com/anthropics/anthropic-sdk-typescript
- SDK Types: `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts`
- Current Implementation: `utils/anthropic-client.ts`
- pi-ai Library: https://github.com/badlogic/pi-ai
