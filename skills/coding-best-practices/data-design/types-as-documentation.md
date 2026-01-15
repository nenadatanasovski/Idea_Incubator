# SKILL: Types as Documentation

## When to Load
- Defining function signatures
- Creating domain models
- Reviewing type definitions

## Principle

Types should communicate intent and constraints. Use meaningful types instead of primitives.

## Why It Matters

- **Self-documenting**: Types explain what values mean
- **Compiler-checked docs**: Unlike comments, types can't lie
- **IDE support**: Autocomplete and error checking
- **Reduced bugs**: Wrong types caught at compile time

## Application

```
WHEN defining types
USE domain-specific types over primitives
NAME types by what they represent, not their structure
ENCODE constraints in the type system
```

## Primitive Obsession (Anti-Pattern)

```typescript
// BAD - primitives everywhere
function createUser(
  name: string,
  email: string,
  age: number,
  role: string
): string  // returns what? ID? name? error?

// Easy to make mistakes
createUser(email, name, role, age)  // args swapped, compiles fine
```

## Domain Types (Pattern)

```typescript
// GOOD - meaningful types
type UserId = string & { readonly brand: unique symbol }
type Email = string & { readonly brand: unique symbol }
type Age = number & { readonly brand: unique symbol }
type Role = 'admin' | 'user' | 'guest'

function createUser(
  name: string,
  email: Email,
  age: Age,
  role: Role
): UserId

// Compile error if you swap arguments
createUser(email, name, role, age)  // Type error!
```

## Practical Patterns

### Branded Types (Lightweight)
```typescript
type UserId = string & { readonly __brand: 'UserId' }
type OrderId = string & { readonly __brand: 'OrderId' }

// Can't accidentally pass OrderId where UserId expected
function getUser(id: UserId): User { ... }
getUser(orderId)  // Type error!
```

### Union Types for States
```typescript
// BAD - stringly typed
type Status = string  // 'loading' | 'error' | 'success' | anything...

// GOOD - explicit states
type Status = 'loading' | 'error' | 'success'
```

### Discriminated Unions for Variants
```typescript
type ApiResponse<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: T }

// Compiler ensures you handle all cases
function render(response: ApiResponse<User>) {
  switch (response.status) {
    case 'loading': return <Spinner />
    case 'error': return <Error msg={response.error.message} />
    case 'success': return <UserCard user={response.data} />
  }
}
```

### Units in Types
```typescript
// BAD - what unit?
function delay(time: number) { ... }
delay(1000)  // milliseconds? seconds?

// GOOD - unit in type
type Milliseconds = number & { readonly __unit: 'ms' }
type Seconds = number & { readonly __unit: 's' }

function delay(time: Milliseconds) { ... }
```

## When NOT to Over-Type

Don't create types for everything:
```typescript
// OVERKILL
type X = number
type Y = number
type Point = { x: X, y: Y }

// FINE - context is clear
type Point = { x: number, y: number }
```

The goal is clarity, not type bureaucracy.

## Validation Questions

1. Could someone pass the wrong value and it would compile?
2. Does the type name explain what it represents?
3. Are impossible states representable?
