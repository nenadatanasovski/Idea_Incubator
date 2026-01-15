# Coding Best Practices Skills

Skills derived from functional programming principles, critically evaluated for practical application.

## Skill Categories

| Folder | Load When | Contains |
|--------|-----------|----------|
| `function-design/` | Writing or refactoring functions | Purity, totality, composition |
| `data-design/` | Designing data structures or types | Immutability, type safety, domain modeling |
| `error-handling/` | Implementing error paths | Explicit errors, result types |
| `architecture/` | Making structural decisions | Separation of concerns, programs as data |
| `abstraction-guidance/` | Considering abstractions | When to abstract, tradeoffs, pragmatism |

## Loading Skills

Agents should load skills based on current task:

```python
# Example: Agent writing a new function
skills = load_skills("coding-best-practices/function-design/")

# Example: Agent designing a data model
skills = load_skills("coding-best-practices/data-design/")

# Example: Agent refactoring with new abstractions
skills = load_skills("coding-best-practices/abstraction-guidance/")
```

## Core Principles (Universal)

These apply almost always:
- Pure functions
- Immutability by default
- Composition over complexity
- Explicit error handling
- Total functions (handle all cases)

## Contextual Principles (Use Judgment)

These require situational awareness:
- Laziness (memory tradeoffs)
- Higher abstractions (team familiarity)
- Type-level programming (complexity cost)

## Source

Derived from "Functional Programming in Scala" (Chiusano & Bjarnason), critically evaluated through first principles reasoning. Not all FP dogma applies universally.
