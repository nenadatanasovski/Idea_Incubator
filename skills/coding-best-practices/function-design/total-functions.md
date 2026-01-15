# SKILL: Total Functions

## When to Load
- Writing functions that might not handle all inputs
- Reviewing error-prone code
- Refactoring partial functions

## Principle

A **total function** handles every possible input. A **partial function** crashes or behaves undefined for some inputs.

## Why It Matters

- **No surprise crashes**: Every input produces a valid output
- **Self-documenting**: The type signature tells the full story
- **Composable**: Total functions chain safely

## Partial Functions to Avoid

| Partial | Problem | Total Alternative |
|---------|---------|-------------------|
| `list[0]` | Crashes on empty | `list.at(0)` returning undefined/Option |
| `parseInt(s)` | Returns NaN | Return Result/Option |
| `obj.property` | Undefined if missing | Optional chaining `obj?.property` |
| `array.find(p)!` | Force unwrap crashes | Handle the undefined case |
| `map.get(key)` (some langs) | Returns null | `map.get(key)` returning Option |

## Application

```
WHEN writing a function
ENSURE every possible input produces a valid output
NEVER assume inputs are valid without checking
RETURN explicit failure values instead of crashing
```

## Practical Patterns

```typescript
// PARTIAL - crashes on empty array
function first<T>(arr: T[]): T {
  return arr[0]  // undefined if empty, lies about return type
}

// TOTAL - handles all cases
function first<T>(arr: T[]): T | undefined {
  return arr[0]  // type honestly reflects possibility
}

// BETTER - with explicit Option type
function first<T>(arr: T[]): Option<T> {
  return arr.length > 0 ? Some(arr[0]) : None
}
```

```typescript
// PARTIAL - throws on invalid input
function divide(a: number, b: number): number {
  return a / b  // Infinity or NaN for edge cases
}

// TOTAL - handles division by zero
function divide(a: number, b: number): Result<number, 'division_by_zero'> {
  if (b === 0) return Err('division_by_zero')
  return Ok(a / b)
}
```

## Spotting Partial Functions

Warning signs:
- No handling for empty collections
- Unchecked type casts
- Force unwrapping optionals (`!`, `!!`, `.get()`)
- Assuming non-null without checks
- Index access without bounds checking

## Exception

Performance-critical inner loops where you've **proven** the invariant holds:
```typescript
// OK if you've verified arr is non-empty before the loop
for (let i = 0; i < arr.length; i++) {
  process(arr[i])  // Safe because loop condition guarantees bounds
}
```

## Validation Questions

1. What happens if this input is empty?
2. What happens if this input is null/undefined?
3. What happens at boundary values (0, -1, MAX_INT)?
4. Does the return type honestly represent all possible outcomes?
