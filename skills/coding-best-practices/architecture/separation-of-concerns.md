# SKILL: Separation of Concerns

## When to Load

- Designing system architecture
- Refactoring coupled code
- Reviewing module boundaries

## Principle

Each module/function/class should have one reason to change. Separate different concerns into different units.

## Why It Matters

- **Focused changes**: Modify one thing without affecting others
- **Testable units**: Test each concern independently
- **Reusable pieces**: Concerns can be recombined differently
- **Understandable code**: Each unit has one job

## Application

```
WHEN designing code structure
SEPARATE by reason to change
ONE module = ONE concern
IF explaining requires "and", split it
```

## Common Separations

| Concern        | Separate From | Why                                   |
| -------------- | ------------- | ------------------------------------- |
| Business logic | Data access   | Logic doesn't change when DB changes  |
| Validation     | Processing    | Validation rules change independently |
| Formatting     | Calculation   | Display changes independently         |
| I/O            | Pure logic    | Testability                           |
| Error handling | Happy path    | Error policies change independently   |
| Configuration  | Code          | Config changes without code changes   |

## Practical Patterns

### Layer Separation

```typescript
// BAD - mixed concerns
async function createOrder(req, res) {
  // Validation (concern 1)
  if (!req.body.items) return res.status(400).send('Items required')

  // Business logic (concern 2)
  const total = req.body.items.reduce((sum, i) => sum + i.price, 0)
  const tax = total * 0.1

  // Data access (concern 3)
  await db.query('INSERT INTO orders...')

  // Response formatting (concern 4)
  res.json({ success: true, total: `$${total.toFixed(2)}` })
}

// GOOD - separated concerns
// validation.ts
const validateOrder = (data: unknown): Result<OrderInput, ValidationError> => { ... }

// order-service.ts (business logic)
const calculateOrderTotals = (items: Item[]): OrderTotals => { ... }

// order-repository.ts (data access)
const saveOrder = async (order: Order): Promise<OrderId> => { ... }

// order-controller.ts (orchestration)
async function createOrder(req, res) {
  const validation = validateOrder(req.body)
  if (!validation.ok) return res.status(400).json(validation.error)

  const totals = calculateOrderTotals(validation.value.items)
  const orderId = await saveOrder({ ...validation.value, ...totals })

  res.json(formatOrderResponse(orderId, totals))
}
```

### Pure Core, Impure Shell

```typescript
// CORE - pure business logic (testable)
function calculateDiscount(order: Order, customer: Customer): number {
  // Pure calculation, no I/O
}

// SHELL - impure orchestration
async function applyDiscount(orderId: string): Promise<void> {
  const order = await orderRepo.get(orderId)      // I/O
  const customer = await customerRepo.get(...)    // I/O
  const discount = calculateDiscount(order, customer)  // Pure
  await orderRepo.updateDiscount(orderId, discount)    // I/O
}
```

### Configuration Separation

```typescript
// BAD - hardcoded values
function sendEmail(to: string) {
  const smtp = new SMTPClient("smtp.example.com", 587);
  // ...
}

// GOOD - configuration injected
function createEmailSender(config: EmailConfig) {
  return (to: string) => {
    const smtp = new SMTPClient(config.host, config.port);
    // ...
  };
}
```

## Anti-Pattern: Over-Separation

Don't separate things that change together:

```typescript
// OVER-SEPARATED - three files for one concept
// user-name-validator.ts
// user-email-validator.ts
// user-password-validator.ts

// BETTER - cohesive unit
// user-validation.ts (all user validation together)
```

Cohesion matters: things that change together should live together.

## Signs of Mixed Concerns

- Function name includes "and" (validateAndSave)
- Multiple reasons this code might change
- Testing requires mocking many things
- Changes ripple across many files
- Can't explain the function's job in one sentence

## Validation Questions

1. What are the distinct reasons this code might change?
2. Can I test the business logic without a database?
3. If requirements change, how many files do I touch?
4. Does this function have one job or several?
