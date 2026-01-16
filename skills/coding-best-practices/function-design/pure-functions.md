# SKILL: Pure Functions

## When to Load

- Writing new functions
- Refactoring existing functions
- Reviewing function design

## Principle

A pure function:

1. Returns the same output for the same input (deterministic)
2. Has no side effects (no mutation, no I/O, no exceptions thrown)

## Why It Matters

- **Local reasoning**: Understand the function without knowing global state
- **Testability**: No mocks needed, just inputs and expected outputs
- **Composability**: Pure functions combine safely
- **Parallelization**: No shared state means safe concurrent execution

## Application

```
WHEN writing a function
PREFER no side effects
CHECK:
  - Does it read/write external state? (impure)
  - Does it depend on current time? (impure)
  - Does it throw exceptions? (impure)
  - Does it do I/O? (impure)
```

## Practical Pattern

```
// IMPURE - hard to test, unpredictable
function processOrder(orderId) {
  const order = database.get(orderId)  // I/O
  const now = Date.now()               // non-deterministic
  log(`Processing ${orderId}`)         // side effect
  database.save(order)                 // I/O
}

// PURE - easy to test, predictable
function calculateOrderTotal(order, currentTime) {
  // Pure calculation, all inputs explicit
  return { ...order, total: sum(order.items), processedAt: currentTime }
}

// Impurity at the boundary
async function processOrder(orderId) {
  const order = await database.get(orderId)
  const result = calculateOrderTotal(order, Date.now())  // pure core
  await database.save(result)
}
```

## Exception

Impurity is necessary at system boundaries:

- Main entry points
- Event handlers
- API endpoints
- Database access layers

The goal is **pure core, impure shell** - push effects to the edges.

## Anti-Pattern

Don't fake purity by hiding effects:

```
// BAD - looks pure but isn't
function getUser(id) {
  return globalCache[id] || fetchFromDb(id)  // hidden I/O
}
```

## Validation Questions

Before committing a function, ask:

1. Can I test this without mocking anything?
2. Will calling it twice with same args give same result?
3. Does it change anything outside its scope?
