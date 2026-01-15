# SKILL: Programs as Data (Description vs Execution)

## When to Load
- Building complex operations
- Designing workflow systems
- Creating DSLs or builders

## Principle

Build programs as data structures that describe what to do. Execute them separately. Separate the "what" from the "when/how".

## Why It Matters

- **Inspectable**: Can examine the program before running
- **Optimizable**: Transform or optimize before execution
- **Testable**: Test program construction separately from execution
- **Flexible**: Different interpreters for different contexts

## Application

```
WHEN building complex operations
RETURN a description of work instead of doing the work
EXECUTE the description in a separate step
ENABLE inspection, optimization, or alternative execution
```

## Practical Examples

### Query Builders
```typescript
// BAD - executes immediately
function getActiveUsers() {
  return db.query('SELECT * FROM users WHERE active = true')
}

// GOOD - returns description
function getActiveUsers() {
  return Query
    .select('*')
    .from('users')
    .where('active', true)
  // Not executed yet - returns query description
}

// Execute when ready
const query = getActiveUsers()
console.log(query.toSQL())  // Inspect
const results = await query.execute()  // Execute
```

### Validation Pipelines
```typescript
// BAD - validates immediately, can't compose
function validateEmail(email: string): boolean {
  if (!email) return false
  if (!email.includes('@')) return false
  return true
}

// GOOD - returns validation description
const emailValidator = Validator
  .string()
  .required()
  .matches(/@/)
  .maxLength(255)

// Can compose validators
const userValidator = Validator.object({
  email: emailValidator,
  name: Validator.string().required()
})

// Execute validation
const result = userValidator.validate(input)
```

### Task/Workflow Definitions
```typescript
// BAD - executes immediately
async function deployProcess() {
  await buildCode()
  await runTests()
  await deploy()
}

// GOOD - describes workflow
const deployWorkflow = Workflow
  .step('build', buildCode)
  .step('test', runTests, { dependsOn: 'build' })
  .step('deploy', deploy, { dependsOn: 'test' })

// Can inspect
console.log(deployWorkflow.steps)
console.log(deployWorkflow.dependencies)

// Can execute with options
await deployWorkflow.run({ parallel: true, dryRun: true })
```

### Animation/Effect Descriptions
```typescript
// BAD - runs immediately
function fadeIn(element) {
  element.style.opacity = 0
  // ... animation loop
}

// GOOD - describes animation
const fadeIn = Animation
  .property('opacity')
  .from(0)
  .to(1)
  .duration(300)
  .easing('ease-in')

// Execute on specific element
fadeIn.applyTo(element)

// Or compose
const entrance = Animation.sequence([fadeIn, slideUp])
```

## When NOT to Use This Pattern

Simple, one-shot operations:
```typescript
// OVERKILL
const add = Operation.binary('+').apply(1, 2).execute()

// JUST DO IT
const sum = 1 + 2
```

Only add the indirection when you get concrete benefits:
- Need to inspect before executing
- Need to serialize/deserialize the operation
- Need multiple execution strategies
- Building a DSL users will compose

## Implementation Pattern

```typescript
// 1. Define the description type
type QueryDescription = {
  table: string
  columns: string[]
  conditions: Condition[]
  // ... no execution logic
}

// 2. Builder that constructs descriptions
class QueryBuilder {
  private desc: QueryDescription = { ... }

  select(...cols: string[]) {
    return new QueryBuilder({ ...this.desc, columns: cols })
  }

  where(condition: Condition) {
    return new QueryBuilder({
      ...this.desc,
      conditions: [...this.desc.conditions, condition]
    })
  }

  // Returns description, not results
  build(): QueryDescription {
    return this.desc
  }
}

// 3. Interpreter that executes descriptions
function executeQuery(desc: QueryDescription, db: Database) {
  const sql = toSQL(desc)  // Transform description to SQL
  return db.query(sql)      // Execute
}
```

## Validation Questions

1. Do I need to inspect or modify this operation before running it?
2. Will I need different execution strategies?
3. Is this complex enough to benefit from description/execution split?
4. Am I adding indirection for hypothetical future needs? (Don't)
