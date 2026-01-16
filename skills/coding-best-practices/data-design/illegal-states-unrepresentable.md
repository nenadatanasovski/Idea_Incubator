# SKILL: Make Illegal States Unrepresentable

## When to Load

- Modeling domain concepts
- Fixing state-related bugs
- Reviewing data structures

## Principle

Design types so that invalid states cannot be constructed. Let the compiler enforce invariants.

## Why It Matters

- **Bugs eliminated by design**: Invalid states can't exist
- **No defensive coding**: No need to check for impossible states
- **Self-documenting**: Type structure shows valid states
- **Refactoring confidence**: Compiler catches state violations

## Application

```
WHEN modeling state
ENSURE only valid combinations are representable
USE union types to enumerate possible states
AVOID boolean flags that create impossible combinations
```

## Anti-Pattern: Boolean Flags

```typescript
// BAD - 4 possible states, only 3 are valid
type Request = {
  isLoading: boolean;
  isError: boolean;
  data?: User;
  error?: Error;
};

// Invalid states possible:
// { isLoading: true, isError: true }  - loading AND error?
// { isLoading: false, isError: false, data: undefined }  - success with no data?
// { isLoading: false, isError: true, error: undefined }  - error with no error?
```

## Pattern: Discriminated Union

```typescript
// GOOD - only 3 valid states exist
type Request =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: User };

// Impossible to create invalid combinations
// data only exists when status is 'success'
// error only exists when status is 'error'
```

## More Examples

### User Authentication State

```typescript
// BAD - flags create invalid states
type User = {
  isLoggedIn: boolean;
  isGuest: boolean;
  userId?: string;
  guestToken?: string;
};

// GOOD - only valid states
type User =
  | { type: "anonymous" }
  | { type: "guest"; guestToken: string }
  | { type: "authenticated"; userId: string };
```

### Form State

```typescript
// BAD - when is touched but not dirty?
type Field = {
  value: string;
  isDirty: boolean;
  isTouched: boolean;
  isValid: boolean;
  error?: string;
};

// GOOD - states are explicit
type Field =
  | { state: "pristine"; value: string }
  | { state: "touched"; value: string }
  | { state: "valid"; value: string }
  | { state: "invalid"; value: string; error: string };
```

### Connection State

```typescript
// BAD - what does connected + connecting mean?
type Connection = {
  isConnected: boolean;
  isConnecting: boolean;
  socket?: WebSocket;
  error?: Error;
};

// GOOD - clear state machine
type Connection =
  | { state: "disconnected" }
  | { state: "connecting" }
  | { state: "connected"; socket: WebSocket }
  | { state: "failed"; error: Error; retryCount: number };
```

### Email Verification

```typescript
// BAD - verified email without email?
type User = {
  email?: string;
  isEmailVerified: boolean;
};

// GOOD - verification requires email
type EmailStatus =
  | { status: "none" }
  | { status: "unverified"; email: string }
  | { status: "verified"; email: string; verifiedAt: Date };
```

## Refactoring Strategy

1. List all the boolean flags / optional fields
2. Enumerate all valid combinations
3. Name each combination (these become union members)
4. Move relevant fields into each union member
5. Remove impossible combinations

## Validation Questions

1. Can I construct a value that shouldn't exist?
2. Do I have boolean flags that shouldn't both be true?
3. Do I have optional fields that depend on each other?
4. Can I draw a state diagram from this type?
