# SKILL: Type Complexity Sweet Spot

## When to Load
- Designing type signatures
- Fighting the type system
- Reviewing complex generic types

## Principle

Types have diminishing returns. Aim for the sweet spot: meaningful types that catch real bugs without becoming puzzles.

## Why It Matters

- **Error messages**: Complex types create cryptic errors
- **Compile times**: Type-level computation is slow
- **Cognitive load**: Developers spend time on types, not logic
- **Diminishing returns**: Simple types catch most bugs

## Application

```
WHEN designing types
AIM FOR: Domain types, union types, simple generics
AVOID: Deeply nested generics, type-level computation, mapped types on mapped types
STOP WHEN: Type signature is longer than implementation
```

## The Sweet Spot

```
Stringly-typed ──────────── Sweet Spot ──────────── Type Astronaut
(no safety)                (practical)              (theoretical purity)
      │                         │                         │
      ▼                         ▼                         ▼
function(a, b, c)     function(user: User,    function<T extends
  // any strings        order: Order)            Functor<Monad<T>>>...
```

## Good Type Complexity

### Domain Types
```typescript
// GOOD - meaningful distinction
type UserId = string & { readonly brand: unique symbol }
type OrderId = string & { readonly brand: unique symbol }

function getOrder(userId: UserId, orderId: OrderId): Order
// Can't mix up the two IDs
```

### Union Types for States
```typescript
// GOOD - compiler enforces handling
type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'loaded'; data: T }
```

### Simple Generics
```typescript
// GOOD - clear abstraction
function map<T, U>(arr: T[], fn: (t: T) => U): U[]
function filter<T>(arr: T[], pred: (t: T) => boolean): T[]
```

## Excessive Type Complexity

### Nested Generics Hell
```typescript
// BAD - unreadable
type DeepNested<T> = {
  [K in keyof T]: T[K] extends object
    ? DeepNested<T[K]>
    : T[K] extends Array<infer U>
      ? Array<DeepNested<U>>
      : T[K]
}

// Error message when this fails? Good luck.
```

### Type-Level Computation
```typescript
// BAD - compile-time overhead, cryptic errors
type PathValue<T, P extends string> =
  P extends `${infer K}.${infer R}`
    ? K extends keyof T
      ? PathValue<T[K], R>
      : never
    : P extends keyof T
      ? T[P]
      : never

// BETTER - runtime check with simple types
function getPath<T>(obj: T, path: string): unknown
```

### Conditional Type Chains
```typescript
// BAD - nobody can debug this
type Unwrap<T> =
  T extends Promise<infer U> ? Unwrap<U> :
  T extends Array<infer U> ? Unwrap<U> :
  T extends (...args: any[]) => infer U ? Unwrap<U> :
  T

// BETTER - explicit types where needed
```

## Signs You've Gone Too Far

1. **Error messages are useless**: `Type 'X' is not assignable to type 'Y'` where X and Y are 50 lines each
2. **IDE is slow**: Type-checking takes seconds
3. **Type casts everywhere**: Fighting the type system with `as`
4. **More time on types than logic**: Types should help, not dominate
5. **Only you understand it**: Types are for the team

## Simpler Alternatives

| Complex Approach | Simpler Alternative |
|-----------------|---------------------|
| Type-level string parsing | Runtime validation |
| Recursive mapped types | Explicit interface |
| HKT (Higher-Kinded Types) | Simple generic functions |
| Conditional type chains | Function overloads |
| Type-level arithmetic | Runtime calculation |

## Go's Lesson

Go's simple type system (no generics until recently, no union types) powers massive, reliable systems. The lesson: you can build great software without sophisticated types.

TypeScript's power is useful, but restraint is wisdom.

## Validation Questions

1. Can a colleague understand this type in 30 seconds?
2. Is the error message helpful when types don't match?
3. Am I encoding constraints that could be runtime checks?
4. Would a simpler type catch 90% of the bugs?
