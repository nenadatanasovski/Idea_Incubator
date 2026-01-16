# SKILL: Right Tool for Parsing

## When to Load

- Implementing parsing logic
- Evaluating parser combinator libraries
- Dealing with text processing

## Principle

Parser combinators are elegant for medium complexity. Don't over-engineer simple parsing or under-engineer complex parsing.

## Why It Matters

- **Simplicity**: Simple parsing doesn't need abstraction
- **Performance**: Parser combinators add overhead
- **Error messages**: Custom parsers often have better errors
- **Maintainability**: Match tool complexity to problem complexity

## Application

```
WHEN parsing text
SIMPLE cases → regex, split, string methods
MEDIUM cases → parser combinators shine
COMPLEX cases → dedicated parser generators
```

## Complexity Spectrum

### Simple: Use Built-in Tools

```typescript
// Parsing a comma-separated list
// DON'T: import parser combinator library
// DO:
const items = input.split(",").map((s) => s.trim());

// Extracting a pattern
// DON'T: define grammar for phone numbers
// DO:
const phoneRegex = /\d{3}-\d{3}-\d{4}/;
const phone = input.match(phoneRegex)?.[0];

// Parsing key=value
// DON'T: recursive descent parser
// DO:
const [key, value] = line.split("=", 2);
```

### Medium: Parser Combinators Shine

```typescript
// DSL parsing (good fit)
const expr = lazy(() =>
  choice([
    number,
    seq(str("("), expr, str(")")),
    seq(expr, oneOf(["+", "-", "*", "/"]), expr),
  ]),
);

// Config file format (good fit)
const configLine = seq(
  identifier,
  str("="),
  quotedString.or(number).or(boolean),
);

// Simple query language (good fit)
const query = seq(
  keyword("SELECT"),
  columns,
  keyword("FROM"),
  tableName,
  optional(whereClause),
);
```

### Complex: Use Parser Generators

For real programming languages, data formats with complex nesting, or anything requiring:

- Good error recovery
- Incremental parsing
- IDE integration
- Performance at scale

```bash
# Use dedicated tools
ANTLR    - generates parsers from grammars
tree-sitter - incremental parsing, great errors
PEG.js   - parsing expression grammars
```

## Parser Combinator Pitfalls

### 1. Performance

```typescript
// Parser combinators create many intermediate objects
// For high-throughput parsing, hand-written is faster

// Combinator version: elegant but slow
const json = recursive((json) =>
  choice([object(json), array(json), string, number, boolean, null_]),
);

// Hand-written: ugly but 10x faster for hot paths
function parseJson(input) {
  let pos = 0;
  // Manual character-by-character parsing
}
```

### 2. Error Messages

```typescript
// Combinator error: "Expected ')' at position 47"
// Custom error: "Missing closing parenthesis in function call 'foo(' on line 3"

// Good parser combinators let you customize errors
// But it's extra work - built-in errors are often poor
```

### 3. Left Recursion

```typescript
// BAD - infinite loop in most combinator libraries
const expr = seq(expr, str("+"), term); // expr calls expr first

// GOOD - rewrite to avoid left recursion
const expr = seq(term, many(seq(str("+"), term)));
```

## Decision Framework

| Parsing Task            | Recommended Tool         |
| ----------------------- | ------------------------ |
| Split on delimiter      | `String.split()`         |
| Extract with pattern    | Regex                    |
| Validate format         | Regex or simple function |
| Simple structured data  | JSON.parse, YAML library |
| Custom DSL (< 20 rules) | Parser combinators       |
| Custom DSL (> 20 rules) | Parser generator         |
| Programming language    | Parser generator         |
| Need IDE support        | tree-sitter              |

## Validation Questions

1. Could `split()` and `regex` handle this?
2. How many grammar rules are there?
3. How important are error messages?
4. What's the performance requirement?
5. Will someone else maintain this parser?
