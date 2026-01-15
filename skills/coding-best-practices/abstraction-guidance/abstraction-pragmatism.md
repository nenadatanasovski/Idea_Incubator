# SKILL: Abstraction Pragmatism

## When to Load
- Considering monads, functors, or category theory patterns
- Evaluating "clever" vs "clear" code
- Reviewing highly abstract code

## Principle

Abstractions have costs. Only pay those costs when you get concrete benefits. Clarity beats cleverness.

## Why It Matters

- **Cognitive load**: Abstract code requires more mental effort
- **Team friction**: Not everyone knows category theory
- **Debugging difficulty**: Abstract errors are harder to trace
- **Maintenance burden**: Future developers must understand abstractions

## Application

```
WHEN considering an abstraction
ASK: What concrete problem does this solve?
ASK: Will the team understand it?
ASK: Is the simpler approach really that bad?
PREFER explicit over abstract when in doubt
```

## The Monad Question

Monads (flatMap/bind) are mathematically elegant but often unnecessary:

```typescript
// ABSTRACT - requires understanding monads
const result = fetchUser(id)
  .flatMap(user => fetchOrders(user.id))
  .flatMap(orders => calculateTotal(orders))
  .map(total => formatCurrency(total))

// EXPLICIT - anyone can read this
const user = await fetchUser(id)
if (!user) return null
const orders = await fetchOrders(user.id)
if (!orders) return null
const total = calculateTotal(orders)
return formatCurrency(total)
```

Both achieve the same thing. The explicit version:
- Is immediately readable
- Has obvious control flow
- Debugs easily (set breakpoint anywhere)
- Needs no special knowledge

## Monad Transformers: Just Don't

```typescript
// OVER-ABSTRACTED - monad transformer hell
type AppM<A> = ReaderT<Config, EitherT<Error, StateT<AppState, IO, A>>>

// Nobody can read this. Nobody wants to debug this.
// The error messages will be incomprehensible.

// BETTER - explicit dependencies
async function doThing(
  config: Config,
  state: AppState
): Promise<Result<A, Error>> {
  // ...
}
```

## When Abstraction IS Worth It

1. **Pattern appears 3+ times** with meaningful variation
2. **Team already knows** the abstraction
3. **Library provides** well-tested implementation
4. **Composition benefits** are concrete (you're actually composing)

```typescript
// WORTH IT - map/filter/reduce are universal
const total = items
  .filter(item => item.active)
  .map(item => item.price)
  .reduce((sum, price) => sum + price, 0)

// NOT WORTH IT - custom abstraction for one use
const total = items.foldMap(activeItemPrice, addMonoid)
```

## The "Rule of Three"

Don't abstract until you have **three concrete examples**:

```typescript
// First time: Just write it
function processUserOrder(user, order) { ... }

// Second time: Notice similarity, still write it
function processVendorOrder(vendor, order) { ... }

// Third time: NOW abstract
function processOrder<T extends HasId>(entity: T, order: Order) { ... }
```

Premature abstraction creates unused flexibility and maintenance burden.

## Red Flags: Over-Abstraction

- Type signature longer than implementation
- Need to explain what the abstraction is before explaining what it does
- Abstraction named after category theory (Functor, Applicative, Kleisli)
- "We might need this flexibility later"
- Single implementation of an interface

## Validation Questions

1. Can a junior developer understand this in 5 minutes?
2. Does the abstraction solve a problem I have today?
3. How many times am I actually using this abstraction?
4. What's the simplest code that works?
