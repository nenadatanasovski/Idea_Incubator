# SKILL: Immutability by Default

## When to Load

- Designing data structures
- Choosing between mutable and immutable approaches
- Debugging state-related bugs

## Principle

Data should be immutable by default. Create new values instead of modifying existing ones.

## Why It Matters

- **No spooky action at distance**: Changes are explicit and local
- **Thread safety**: Immutable data is inherently safe to share
- **Time travel debugging**: Previous states still exist
- **Predictable code**: No hidden mutations to track

## Application

```
WHEN designing data structures
DEFAULT to immutable
CREATE new instances instead of mutating
USE spread operators, Object.assign, or immutable update patterns
```

## Patterns

### Object Updates

```typescript
// BAD - mutates original
user.name = "New Name";
user.settings.theme = "dark";

// GOOD - creates new object
const updatedUser = {
  ...user,
  name: "New Name",
  settings: { ...user.settings, theme: "dark" },
};
```

### Array Updates

```typescript
// BAD - mutates array
items.push(newItem);
items.splice(index, 1);
items[0] = updatedItem;

// GOOD - creates new arrays
const withNew = [...items, newItem];
const withoutIndex = items.filter((_, i) => i !== index);
const withUpdated = items.map((item, i) => (i === 0 ? updatedItem : item));
```

### Const by Default

```typescript
// BAD - allows reassignment
let count = 0;
var name = "test";

// GOOD - prevents reassignment
const count = 0;
const name = "test";
```

## When Mutation is Acceptable

1. **Performance-critical loops** (profile first!)

```typescript
// OK - local mutation in a builder
function buildLargeArray(n: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    result.push(i * 2); // local mutation, not exposed
  }
  return result; // returns immutable-by-convention
}
```

2. **Builder patterns** (mutation hidden behind API)

```typescript
class QueryBuilder {
  private query = {}; // internal mutation OK
  where(field, value) {
    this.query[field] = value;
    return this;
  }
  build() {
    return { ...this.query };
  } // returns immutable copy
}
```

3. **Framework requirements** (React state, Vue reactivity)

## Common Pitfalls

### Shallow vs Deep Copy

```typescript
// WRONG - shallow copy, nested mutation affects original
const copy = { ...original };
copy.nested.value = "changed"; // original.nested.value also changed!

// RIGHT - deep update pattern
const copy = {
  ...original,
  nested: { ...original.nested, value: "changed" },
};
```

### Accidental Mutation via Methods

```typescript
// DANGER - sort() mutates in place
const sorted = items.sort(); // items is now mutated!

// SAFE - copy first
const sorted = [...items].sort();
```

Mutating methods in JavaScript: `sort`, `reverse`, `splice`, `push`, `pop`, `shift`, `unshift`, `fill`

## Validation Questions

1. If I change this value, could something else break unexpectedly?
2. Am I returning a reference to internal mutable state?
3. Could two parts of the code be modifying this simultaneously?
