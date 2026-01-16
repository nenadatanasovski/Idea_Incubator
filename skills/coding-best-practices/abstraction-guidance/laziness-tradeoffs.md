# SKILL: Laziness Tradeoffs

## When to Load

- Considering lazy evaluation
- Debugging memory issues
- Working with large data sets

## Principle

Lazy evaluation is a tool, not a default. Use strict evaluation normally; add laziness explicitly when needed.

## Why It Matters

- **Memory unpredictability**: Lazy values accumulate thunks (deferred computations)
- **Debugging difficulty**: Values computed "somewhere" make debugging hard
- **Performance surprises**: Work happens at unexpected times
- **Space leaks**: Accumulated thunks can exhaust memory

## Application

```
WHEN considering lazy vs strict
DEFAULT to strict (eager) evaluation
ADD laziness ONLY when you have a specific reason:
  - Infinite sequences
  - Short-circuit evaluation
  - Measured performance improvement
```

## When Laziness Helps

### 1. Infinite/Large Sequences

```typescript
// GOOD USE - generate on demand
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// Take only what you need
const first10 = take(10, fibonacci());
```

### 2. Short-Circuit Evaluation

```typescript
// GOOD USE - stops at first match
const found = users.find((u) => u.id === targetId);

// GOOD USE - stops on first false
const allValid = items.every((item) => isValid(item));
```

### 3. Expensive Computations You Might Not Need

```typescript
// GOOD USE - computed only if accessed
const lazyExpensive = lazy(() => veryExpensiveComputation());

if (condition) {
  // Only computed if condition is true
  const value = lazyExpensive.get();
}
```

## When Laziness Hurts

### Space Leaks

```typescript
// BAD - accumulates thunks
function sumLazy(list) {
  return list.reduce(
    (acc, x) => lazy(() => acc.get() + x),
    lazy(() => 0),
  );
}
// Each + creates a thunk, memory grows with list size
// When finally evaluated, huge chain of deferred computations

// GOOD - strict accumulation
function sum(list) {
  return list.reduce((acc, x) => acc + x, 0);
}
```

### Unpredictable Timing

```typescript
// BAD - when does the I/O happen?
const lazyUsers = lazy(() => fetchUsers());
// ... much later ...
doSomething(lazyUsers.get()); // Surprise network call!

// BETTER - explicit about when I/O happens
const users = await fetchUsers(); // Clear: I/O happens here
doSomething(users);
```

### Debugging Nightmares

```typescript
// With laziness, stack traces point to evaluation site,
// not where the bug was introduced
const result = lazyValue.get(); // Error here
// But the bug might be in code that created lazyValue
```

## Language Defaults

| Language   | Default | Notes                            |
| ---------- | ------- | -------------------------------- |
| Haskell    | Lazy    | Controversial - many space leaks |
| Scala      | Strict  | `lazy val` for explicit laziness |
| JavaScript | Strict  | Generators for lazy sequences    |
| Python     | Strict  | Generators for lazy sequences    |
| Rust       | Strict  | Iterators are lazy (good design) |

Haskell's default laziness is controversial even in the FP community. Most modern languages choose strict-by-default.

## Practical Pattern: Lazy Where It Matters

```typescript
// Strict by default
const users = await fetchUsers();
const filtered = users.filter((u) => u.active);
const mapped = filtered.map((u) => u.name);

// Lazy only for large/infinite sequences
function* processLargeFile(path: string) {
  for await (const line of readLines(path)) {
    yield parseLine(line); // Process one at a time
  }
}
```

## Validation Questions

1. Do I need to handle infinite data?
2. Am I short-circuiting (might not need all values)?
3. Have I measured that laziness improves performance?
4. Am I introducing unpredictability for no concrete benefit?
