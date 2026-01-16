# SKILL: Errors as Values

## When to Load

- Writing functions that can fail
- Designing error handling strategy
- Refactoring exception-heavy code

## Principle

Represent errors as return values, not exceptions. Make failure explicit in function signatures.

## Why It Matters

- **Visible failure modes**: Types show what can go wrong
- **Forced handling**: Compiler ensures errors are handled
- **No hidden control flow**: Exceptions jump unpredictably
- **Composable**: Error values chain cleanly

## Application

```
WHEN a function can fail
RETURN a Result/Either type instead of throwing
RESERVE exceptions for truly exceptional cases
MAKE error types specific and actionable
```

## Pattern: Result Type

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Helper constructors
const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

## Practical Examples

### Instead of Throwing

```typescript
// BAD - throws, caller may not know
function parseJson(str: string): any {
  return JSON.parse(str); // throws on invalid JSON
}

// GOOD - failure is explicit
type ParseError = { type: "invalid_json"; input: string };

function parseJson<T>(str: string): Result<T, ParseError> {
  try {
    return Ok(JSON.parse(str));
  } catch {
    return Err({ type: "invalid_json", input: str });
  }
}

// Caller must handle both cases
const result = parseJson<Config>(input);
if (!result.ok) {
  console.error("Failed to parse:", result.error.input);
  return;
}
const config = result.value; // TypeScript knows this is Config
```

### Specific Error Types

```typescript
// BAD - stringly typed errors
function createUser(data): Result<User, string> {
  if (!data.email) return Err("Email required");
  if (!validEmail(data.email)) return Err("Invalid email");
  // ...
}

// GOOD - typed errors enable handling
type CreateUserError =
  | { type: "missing_email" }
  | { type: "invalid_email"; email: string }
  | { type: "email_taken"; email: string }
  | { type: "weak_password"; requirements: string[] };

function createUser(data): Result<User, CreateUserError> {
  if (!data.email) return Err({ type: "missing_email" });
  if (!validEmail(data.email))
    return Err({ type: "invalid_email", email: data.email });
  // ...
}

// Caller can handle specific errors
const result = createUser(data);
if (!result.ok) {
  switch (result.error.type) {
    case "email_taken":
      return suggestLogin(result.error.email);
    case "weak_password":
      return showRequirements(result.error.requirements);
    // ...
  }
}
```

### Chaining Results

```typescript
// Without Result - try/catch nesting
try {
  const parsed = parseJson(input);
  try {
    const validated = validate(parsed);
    try {
      const saved = await save(validated);
      return saved;
    } catch (e) {
      handleSaveError(e);
    }
  } catch (e) {
    handleValidationError(e);
  }
} catch (e) {
  handleParseError(e);
}

// With Result - clean chaining
parseJson(input)
  .andThen(validate)
  .andThen(save)
  .match({
    ok: (saved) => handleSuccess(saved),
    err: (error) => handleError(error), // typed error
  });
```

## When to Use Exceptions

Truly exceptional circumstances:

- Out of memory
- Stack overflow
- Programmer errors (should never happen in correct code)
- Unrecoverable failures

**Not for**: Validation errors, missing data, network failures, user errors.

## Language-Specific Patterns

| Language   | Pattern                          |
| ---------- | -------------------------------- |
| Rust       | `Result<T, E>` built-in          |
| Go         | `(value, error)` tuple returns   |
| TypeScript | Discriminated union or libraries |
| Swift      | `Result<Success, Failure>`       |
| Kotlin     | `Result<T>` or sealed classes    |

## Validation Questions

1. Can this function fail? If yes, is failure in the return type?
2. Will the caller know this can fail without reading implementation?
3. Are error types specific enough to handle differently?
4. Am I using exceptions for control flow? (Don't)
