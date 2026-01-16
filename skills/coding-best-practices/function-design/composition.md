# SKILL: Composition Over Complexity

## When to Load

- Building complex functionality
- Refactoring large functions
- Designing APIs

## Principle

Build complex behavior by combining simple, focused functions rather than writing monolithic code.

## Why It Matters

- **Testability**: Small functions are easy to test in isolation
- **Reusability**: Composed pieces can be recombined differently
- **Readability**: Each piece has one job, easy to understand
- **Debuggability**: Failures are localized to specific pieces

## Application

```
WHEN building functionality
BREAK into small functions that do ONE thing
COMBINE via composition (piping, chaining, nesting)
NAME each piece by what it does, not how
```

## Composition Patterns

### Pipeline/Pipe

```typescript
// Instead of nested calls
const result = format(validate(parse(clean(input))))

// Use pipeline (if language supports)
const result = input
  |> clean
  |> parse
  |> validate
  |> format

// Or method chaining
const result = input
  .clean()
  .parse()
  .validate()
  .format()
```

### Function Composition

```typescript
// Combine functions into new functions
const processInput = compose(format, validate, parse, clean);
const result = processInput(input);
```

### Builder Pattern

```typescript
const query = QueryBuilder.select("name", "email")
  .from("users")
  .where("active", true)
  .orderBy("name")
  .build();
```

## Practical Example

```typescript
// BAD - monolithic function doing many things
function processOrder(order) {
  // Validate
  if (!order.items || order.items.length === 0) throw new Error("Empty order");
  if (!order.customer) throw new Error("No customer");

  // Calculate totals
  let subtotal = 0;
  for (const item of order.items) {
    subtotal += item.price * item.quantity;
  }
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  // Apply discounts
  let discount = 0;
  if (order.customer.tier === "gold") discount = total * 0.1;

  // Format output
  return {
    orderId: order.id,
    customer: order.customer.name,
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    discount: discount.toFixed(2),
    total: (total - discount).toFixed(2),
  };
}

// GOOD - composed from focused functions
const validateOrder = (order) => {
  /* returns Result */
};
const calculateSubtotal = (items) => {
  /* pure calculation */
};
const calculateTax = (subtotal, rate) => {
  /* pure calculation */
};
const applyDiscount = (total, customerTier) => {
  /* pure calculation */
};
const formatOrderSummary = (order, totals) => {
  /* pure transformation */
};

function processOrder(order) {
  return validateOrder(order)
    .map((o) => ({
      order: o,
      subtotal: calculateSubtotal(o.items),
    }))
    .map(({ order, subtotal }) => ({
      order,
      subtotal,
      tax: calculateTax(subtotal, 0.1),
    }))
    .map(({ order, subtotal, tax }) => ({
      order,
      subtotal,
      tax,
      discount: applyDiscount(subtotal + tax, order.customer.tier),
    }))
    .map(formatOrderSummary);
}
```

## Signs You Need Composition

- Function over 20-30 lines
- Multiple levels of nesting
- Comments separating "sections" within a function
- Variables used far from where they're defined
- Hard to name the function (it does multiple things)

## Anti-Pattern: Premature Abstraction

Don't create abstractions for one-time operations:

```typescript
// BAD - abstraction for single use
const addOne = (x) => x + 1;
const result = addOne(5);

// GOOD - just write it
const result = 5 + 1;
```

Three similar lines of code are better than a premature abstraction.

## Validation Questions

1. Can I describe this function's purpose in 5 words or less?
2. Can I test this function without setup/teardown?
3. If I needed to change one behavior, would I only change one function?
