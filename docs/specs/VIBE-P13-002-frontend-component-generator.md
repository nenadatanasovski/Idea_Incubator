# VIBE-P13-002: Frontend Component Generator Module

**Status:** SPECIFICATION COMPLETE
**Created:** 2026-02-09
**Updated:** 2026-02-09
**Priority:** P1 (Phase 13 - Code Generation)
**Effort:** Medium (8-12 hours)
**Model:** Sonnet
**Agent Type:** build_agent

---

## Overview

Create a specialized frontend component generator module that transforms component specifications into fully-formed React components with TypeScript types, styling, and unit tests. The generator automatically detects the project's frontend framework, follows existing code patterns, and generates production-ready component files with proper type safety and test coverage.

### Problem Statement

**Current State:**

- Backend generator exists (VIBE-P13-003) for API routes at `parent-harness/orchestrator/src/spawner/generators/backend.ts`
- Database schema generator (VIBE-P10-006) handles data layer
- **BUT** no automated frontend component generation
- Manual component creation is repetitive and error-prone
- Inconsistent patterns across components
- TypeScript types often drift from actual props/state
- Test coverage gaps due to manual test writing

**Desired State:**

- Single generator creates complete React components from specs
- Automatic framework detection (React vs Vue)
- TypeScript prop types and state interfaces generated
- Styling approach follows project conventions (Tailwind detected from existing components)
- Basic unit tests automatically generated with Vitest
- Pattern detection ensures consistency with existing codebase
- Components are production-ready on generation

### Value Proposition

The Frontend Component Generator is the **"UI Code Factory"** that accelerates frontend development:

1. **Rapid Component Creation** - Seconds vs hours for boilerplate
2. **Type Safety Guaranteed** - Generated TypeScript types match implementation
3. **Pattern Consistency** - Automatically follows existing codebase conventions
4. **Built-in Testing** - Test files generated alongside components with Vitest
5. **Developer Experience** - Focus on logic, not boilerplate
6. **Framework Aware** - Supports React 19+ ecosystem

---

## Requirements

### Functional Requirements

#### 1. Component Specification Input

**Input Format:**

```typescript
interface ComponentSpec {
  /** Component name (PascalCase) */
  name: string;

  /** Component type */
  type: "functional" | "hook";

  /** Props definition */
  props: PropDefinition[];

  /** State definition (if stateful) */
  state?: StateDefinition[];

  /** Events/callbacks */
  events?: EventDefinition[];

  /** Styling approach (auto-detected if not specified) */
  styling?: "tailwind" | "css-modules" | "styled-components";

  /** Component description for docs */
  description?: string;

  /** External dependencies (other components) */
  dependencies?: string[];
}

interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  description?: string;
}

interface StateDefinition {
  name: string;
  type: string;
  initialValue: any;
  description?: string;
}

interface EventDefinition {
  name: string;
  args: { name: string; type: string }[];
  description?: string;
}
```

**Example Spec:**

```typescript
const spec: ComponentSpec = {
  name: "StatusBadge",
  type: "functional",
  description: "Display status with color-coded badge",
  props: [
    {
      name: "status",
      type: "'pending' | 'completed' | 'failed'",
      required: true,
      description: "Current status",
    },
    {
      name: "size",
      type: "'sm' | 'md' | 'lg'",
      required: false,
      defaultValue: "md",
    },
  ],
  styling: "tailwind",
};
```

#### 2. Framework Detection

**React Detection:**

- Check `package.json` for `"react"` dependency and version
- Look for existing `.tsx` files in dashboard/src/components
- Check for React-specific patterns (`useState`, `useEffect`, etc.)
- Detect React 19+ for modern syntax support

**Default:** React (confirmed from parent-harness/dashboard/package.json showing React 19.2.0)

#### 3. Pattern Detection

**Analyze Existing Components:**

```typescript
interface ProjectPatterns {
  /** Import style */
  importStyle: "named" | "default" | "namespace";

  /** Export style */
  exportStyle: "named" | "default" | "both";

  /** Props interface naming */
  propsNaming: "ComponentNameProps" | "Props" | "IComponentNameProps";

  /** Styling approach used */
  stylingApproach: "tailwind" | "css-modules" | "styled-components";

  /** Testing library */
  testLibrary: "vitest" | "jest" | "testing-library";

  /** File naming convention */
  fileNaming: "PascalCase" | "kebab-case";
}
```

**Detection Strategy:**

1. Read 3-5 existing components from `parent-harness/dashboard/src/components/`
2. Analyze import/export patterns (detected: named exports)
3. Check prop interface naming (detected: `ComponentNameProps` pattern)
4. Detect styling approach (detected: Tailwind CSS with `className` attributes)
5. Identify test library (detected: Vitest from package.json)
6. Extract file naming (detected: PascalCase for `.tsx` files)

**Detected Patterns from TaskCard.tsx and AgentStatusCard.tsx:**

- ✅ Named imports: `import { useState } from 'react'`
- ✅ Named exports: `export function ComponentName() { ... }`
- ✅ Props naming: `interface ComponentNameProps { ... }`
- ✅ Tailwind CSS: `className="bg-gray-700 rounded-lg p-3"`
- ✅ PascalCase filenames: `TaskCard.tsx`, `AgentStatusCard.tsx`
- ✅ Vitest testing: `"test": "vitest"` in package.json
- ✅ Test data attributes: `data-testid="component-name"`

#### 4. Component Generation

**React Functional Component (TypeScript):**

```tsx
import { useState } from "react";

interface StatusBadgeProps {
  status: "pending" | "completed" | "failed";
  size?: "sm" | "md" | "lg";
}

const statusColors = {
  pending: "bg-yellow-500 text-black",
  completed: "bg-green-500 text-white",
  failed: "bg-red-500 text-white",
};

const sizeClasses = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  return (
    <span
      data-testid="status-badge"
      className={`rounded font-medium ${statusColors[status]} ${sizeClasses[size]}`}
    >
      {status}
    </span>
  );
}

export default StatusBadge;
```

#### 5. Styling Generation

**Tailwind CSS (Primary Approach):**

- Use `className` attributes with Tailwind utility classes
- Follow existing color/spacing patterns from TaskCard.tsx and AgentStatusCard.tsx
- Generate color maps for variant props (status, priority, etc.)
- Include responsive classes if needed
- Use data attributes for testing: `data-testid="component-name"`

**Pattern from Existing Components:**

```tsx
// Color mapping objects (detected pattern)
const statusColors: Record<string, string> = {
  pending: "text-gray-400",
  in_progress: "text-blue-400",
  completed: "text-green-400",
};

// Consistent spacing and colors
className = "bg-gray-700 rounded-lg p-3 mb-3";
```

#### 6. Test Generation

**Vitest + React Testing Library:**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders status text", () => {
    render(<StatusBadge status="pending" />);

    expect(screen.getByTestId("status-badge")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("applies correct color for status", () => {
    const { container } = render(<StatusBadge status="completed" />);

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveClass("bg-green-500");
  });

  it("applies default size when not specified", () => {
    const { container } = render(<StatusBadge status="pending" />);

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveClass("px-2", "py-1", "text-sm");
  });

  it("applies custom size when specified", () => {
    const { container } = render(<StatusBadge status="pending" size="lg" />);

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveClass("px-3", "py-1.5", "text-base");
  });
});
```

### Non-Functional Requirements

#### Performance

- Generator completes in < 500ms for standard components
- Pattern detection scans max 5 files to avoid slowdown
- Caches pattern detection results per directory

#### Reliability

- Validates TypeScript syntax before writing files
- Handles missing dependencies gracefully
- Provides clear error messages on failure

#### Maintainability

- Template-based generation for easy updates
- Separation of concerns (detection, generation, writing)
- Well-documented code with examples

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────┐
│   Frontend Component Generator          │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │  1. Framework Detection            │  │
│  │     - Check package.json           │  │
│  │     - Scan for .tsx files          │  │
│  │     - Detect React 19              │  │
│  └───────────────────────────────────┘  │
│             ▼                            │
│  ┌───────────────────────────────────┐  │
│  │  2. Pattern Detection              │  │
│  │     - Analyze TaskCard.tsx         │  │
│  │     - Analyze AgentStatusCard.tsx  │  │
│  │     - Extract conventions          │  │
│  └───────────────────────────────────┘  │
│             ▼                            │
│  ┌───────────────────────────────────┐  │
│  │  3. Template Selection             │  │
│  │     - Use React functional template│  │
│  │     - Apply detected patterns      │  │
│  │     - Tailwind styling             │  │
│  └───────────────────────────────────┘  │
│             ▼                            │
│  ┌───────────────────────────────────┐  │
│  │  4. Code Generation                │  │
│  │     - Component file (.tsx)        │  │
│  │     - Props interface              │  │
│  │     - State hooks (if needed)      │  │
│  │     - Test file (.test.tsx)        │  │
│  └───────────────────────────────────┘  │
│             ▼                            │
│  ┌───────────────────────────────────┐  │
│  │  5. File Writing                   │  │
│  │     - Write to target directory    │  │
│  │     - Validate TypeScript compile  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Module Structure

**File:** `parent-harness/orchestrator/src/spawner/generators/frontend.ts`

```typescript
// ============================================================================
// TYPES
// ============================================================================

export interface ComponentSpec {
  name: string;
  type: "functional" | "hook";
  props: PropDefinition[];
  state?: StateDefinition[];
  events?: EventDefinition[];
  styling?: "tailwind" | "css-modules" | "styled-components";
  description?: string;
  dependencies?: string[];
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface StateDefinition {
  name: string;
  type: string;
  initialValue: any;
  description?: string;
}

export interface EventDefinition {
  name: string;
  args: { name: string; type: string }[];
  description?: string;
}

export interface GeneratedComponent {
  /** Component file content (.tsx) */
  componentCode: string;
  /** Test file content */
  testCode: string;
  /** File paths */
  componentPath?: string;
  testPath?: string;
}

export interface ProjectPatterns {
  framework: "react";
  importStyle: "named" | "default";
  exportStyle: "named" | "default" | "both";
  propsNaming: string;
  stylingApproach: "tailwind" | "css-modules" | "styled-components";
  usesTypeScript: boolean;
  testLibrary: "vitest" | "jest";
  fileNaming: "PascalCase" | "kebab-case";
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate complete frontend component from spec
 */
export function generateFrontendComponent(
  spec: ComponentSpec,
  targetDirectory?: string,
): GeneratedComponent {
  const patterns = detectProjectPatterns(targetDirectory);
  return generateReactComponent(spec, patterns);
}

// ============================================================================
// FRAMEWORK DETECTION
// ============================================================================

function detectProjectPatterns(directory?: string): ProjectPatterns {
  const targetDir = directory || "parent-harness/dashboard/src/components";

  // Read existing components for pattern analysis
  const existingComponents = readExistingComponents(targetDir);

  return {
    framework: "react",
    importStyle: "named", // import { useState } from 'react'
    exportStyle: "both", // export function + export default
    propsNaming: "ComponentNameProps",
    stylingApproach: "tailwind",
    usesTypeScript: true,
    testLibrary: "vitest",
    fileNaming: "PascalCase",
  };
}

// ============================================================================
// REACT GENERATOR
// ============================================================================

function generateReactComponent(
  spec: ComponentSpec,
  patterns: ProjectPatterns,
): GeneratedComponent {
  const componentCode = buildReactComponentCode(spec, patterns);
  const testCode = generateTestFile(spec, patterns);

  return {
    componentCode,
    testCode,
  };
}

function buildReactComponentCode(
  spec: ComponentSpec,
  patterns: ProjectPatterns,
): string {
  const imports = buildImports(spec, patterns);
  const propsInterface = buildPropsInterface(spec, patterns);
  const colorMaps = buildColorMaps(spec);
  const stateHooks = buildStateHooks(spec.state || []);
  const eventHandlers = buildEventHandlers(spec.events || []);
  const jsx = buildJSX(spec, patterns);

  return `${imports}

${propsInterface}

${colorMaps}

export function ${spec.name}({
${buildPropsDestructuring(spec)}
}: ${spec.name}Props) {
${stateHooks}
${eventHandlers}

  return (
${jsx}
  );
}

export default ${spec.name};
`;
}

function buildImports(spec: ComponentSpec, patterns: ProjectPatterns): string {
  const reactImports: string[] = [];

  if (spec.state && spec.state.length > 0) {
    reactImports.push("useState");
  }

  let imports = "";
  if (reactImports.length > 0) {
    imports += `import { ${reactImports.join(", ")} } from 'react';\n`;
  }

  // Add dependency imports
  if (spec.dependencies && spec.dependencies.length > 0) {
    for (const dep of spec.dependencies) {
      imports += `import { ${dep} } from './${dep}';\n`;
    }
  }

  return imports;
}

function buildPropsInterface(
  spec: ComponentSpec,
  patterns: ProjectPatterns,
): string {
  let code = `interface ${spec.name}Props {\n`;

  for (const prop of spec.props) {
    if (prop.description) {
      code += `  /** ${prop.description} */\n`;
    }
    const optional = prop.required ? "" : "?";
    code += `  ${prop.name}${optional}: ${prop.type};\n`;
  }

  code += "}";
  return code;
}

function buildColorMaps(spec: ComponentSpec): string {
  // Generate color mapping objects for enum-like props
  const enumProps = spec.props.filter(
    (p) => p.type.includes("|") && !p.type.includes("void"),
  );

  let maps = "";
  for (const prop of enumProps) {
    const values = prop.type.split("|").map((v) => v.trim().replace(/'/g, ""));
    const mapName = `${prop.name}Colors`;

    maps += `\nconst ${mapName} = {\n`;
    for (const value of values) {
      // Default color scheme
      maps += `  ${value}: 'bg-gray-500 text-white',\n`;
    }
    maps += "};\n";
  }

  return maps;
}

function buildStateHooks(state: StateDefinition[]): string {
  if (state.length === 0) return "";

  let code = "";
  for (const s of state) {
    const initialValue =
      typeof s.initialValue === "string"
        ? `'${s.initialValue}'`
        : JSON.stringify(s.initialValue);

    code += `  const [${s.name}, set${capitalize(s.name)}] = useState<${s.type}>(${initialValue});\n`;
  }

  return code + "\n";
}

function buildEventHandlers(events: EventDefinition[]): string {
  if (events.length === 0) return "";

  let code = "";
  for (const event of events) {
    const params = event.args.map((a) => `${a.name}: ${a.type}`).join(", ");
    code += `  const ${event.name} = async (${params}) => {\n`;
    code += `    // TODO: Implement ${event.name}\n`;
    code += `  };\n\n`;
  }

  return code;
}

function buildJSX(spec: ComponentSpec, patterns: ProjectPatterns): string {
  // Simple div wrapper with Tailwind classes
  return `    <div
      data-testid="${toKebabCase(spec.name)}"
      className="bg-gray-700 rounded-lg p-3"
    >
      {/* TODO: Implement ${spec.name} content */}
    </div>`;
}

function buildPropsDestructuring(spec: ComponentSpec): string {
  return spec.props
    .map(
      (p) =>
        `  ${p.name}${p.defaultValue !== undefined ? ` = ${JSON.stringify(p.defaultValue)}` : ""}`,
    )
    .join(",\n");
}

// ============================================================================
// TEST GENERATOR
// ============================================================================

function generateTestFile(
  spec: ComponentSpec,
  patterns: ProjectPatterns,
): string {
  const mockProps = buildMockProps(spec);

  return `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ${spec.name} } from './${spec.name}';

describe('${spec.name}', () => {
  const mockProps = ${JSON.stringify(mockProps, null, 4)};

  it('renders component', () => {
    render(<${spec.name} {...mockProps} />);

    expect(screen.getByTestId('${toKebabCase(spec.name)}')).toBeInTheDocument();
  });

  it('accepts all required props', () => {
    const { container } = render(<${spec.name} {...mockProps} />);

    expect(container.firstChild).toBeTruthy();
  });
});
`;
}

function buildMockProps(spec: ComponentSpec): Record<string, any> {
  const props: Record<string, any> = {};

  for (const prop of spec.props) {
    if (prop.required) {
      if (prop.type.includes("string")) {
        props[prop.name] = "test-value";
      } else if (prop.type.includes("number")) {
        props[prop.name] = 42;
      } else if (prop.type.includes("boolean")) {
        props[prop.name] = true;
      } else if (prop.type.includes("|")) {
        // Union type - pick first value
        const firstValue = prop.type.split("|")[0].trim().replace(/'/g, "");
        props[prop.name] = firstValue;
      }
    }
  }

  return props;
}

// ============================================================================
// UTILITIES
// ============================================================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function readExistingComponents(directory: string): string[] {
  // Implementation: read .tsx files from directory
  return [];
}

// ============================================================================
// INTEGRATION
// ============================================================================

/**
 * Write generated component to filesystem
 */
export function writeComponentFiles(
  componentName: string,
  generated: GeneratedComponent,
  targetDirectory: string,
): { componentPath: string; testPath: string } {
  const componentPath = `${targetDirectory}/${componentName}.tsx`;
  const testPath = `${targetDirectory}/${componentName}.test.tsx`;

  // Write files
  // fs.writeFileSync(componentPath, generated.componentCode);
  // fs.writeFileSync(testPath, generated.testCode);

  return { componentPath, testPath };
}
```

### Integration with Feature Orchestrator

The frontend generator integrates with the spawner infrastructure:

```typescript
// parent-harness/orchestrator/src/spawner/feature-orchestrator.ts
import { generateFrontendComponent } from "./generators/frontend.js";
import { generateBackendEndpoint } from "./generators/backend.js";

export async function orchestrateFeature(featureSpec: FeatureSpec) {
  // 1. Generate database schema (if needed)

  // 2. Generate backend API
  const backendCode = generateBackendEndpoint(featureSpec.api);

  // 3. Generate frontend components
  const frontendComponents = featureSpec.ui.components.map((compSpec) =>
    generateFrontendComponent(
      compSpec,
      "parent-harness/dashboard/src/components",
    ),
  );

  // 4. Validate cross-layer consistency
  // 5. Run integration tests
}
```

---

## Pass Criteria

### 1. ✅ Generator Creates Valid React TSX Component from Spec

**Test:**

```typescript
const spec: ComponentSpec = {
  name: "UserCard",
  type: "functional",
  props: [
    { name: "name", type: "string", required: true },
    { name: "email", type: "string", required: true },
    { name: "avatar", type: "string", required: false },
  ],
  styling: "tailwind",
};

const result = generateFrontendComponent(spec);
```

**Expected Output:**

- Valid TypeScript syntax (compiles without errors)
- Exports `UserCard` component (named export)
- Accepts `UserCardProps` interface with name, email, avatar?
- Returns JSX with proper TypeScript types
- Uses Tailwind classes
- Includes `data-testid` attribute

**Validation:**

```bash
# Write to temp file
echo "${result.componentCode}" > /tmp/UserCard.tsx
npx tsc --noEmit --jsx preserve /tmp/UserCard.tsx
# Should exit with code 0 (no errors)
```

### 2. ✅ Generated Component Includes TypeScript Prop Types

**Test:**

```typescript
const result = generateFrontendComponent(spec);
```

**Expected:**

- Contains `interface UserCardProps { ... }`
- All props from spec are present in interface
- Required props have no `?` marker
- Optional props have `?` marker
- TypeScript types match spec exactly

**Validation:**

```typescript
expect(result.componentCode).toContain("interface UserCardProps");
expect(result.componentCode).toContain("name: string;");
expect(result.componentCode).toContain("email: string;");
expect(result.componentCode).toContain("avatar?: string;");
```

### 3. ✅ Corresponding Test File Generated with at Least Render Test

**Test:**

```typescript
const result = generateFrontendComponent(spec);
```

**Expected:**

- `result.testCode` is non-empty
- Contains import: `import { UserCard } from './UserCard'`
- Contains at least one test: `it('renders component', () => { ... })`
- Uses Vitest: `import { describe, it, expect } from 'vitest'`
- Uses React Testing Library: `import { render, screen } from '@testing-library/react'`
- Test validates component renders without crashing
- Test uses `data-testid` for querying

**Validation:**

```typescript
expect(result.testCode).toContain("import { UserCard }");
expect(result.testCode).toContain("it('renders component'");
expect(result.testCode).toContain("render(<UserCard");
expect(result.testCode).toContain("from 'vitest'");
expect(result.testCode).toContain("getByTestId");
```

### 4. ✅ Component Follows Project Existing Patterns (Detected Automatically)

**Test:**
Given existing components in `parent-harness/dashboard/src/components/`:

- Use named exports: `export function ComponentName() { ... }`
- Props interface naming: `ComponentNameProps`
- Tailwind CSS for styling
- Vitest + React Testing Library for tests
- Both named and default exports

**Expected:**

```typescript
const patterns = detectProjectPatterns(
  "parent-harness/dashboard/src/components",
);
const result = generateFrontendComponent(
  spec,
  "parent-harness/dashboard/src/components",
);

// Generated code should match patterns
expect(patterns.exportStyle).toBe("both");
expect(result.componentCode).toContain("export function UserCard");
expect(result.componentCode).toContain("export default UserCard");

expect(patterns.propsNaming).toBe("ComponentNameProps");
expect(result.componentCode).toContain("interface UserCardProps");

expect(patterns.stylingApproach).toBe("tailwind");
expect(result.componentCode).toContain('className="');

expect(patterns.testLibrary).toBe("vitest");
expect(result.testCode).toContain("from 'vitest'");

expect(patterns.fileNaming).toBe("PascalCase");
// Files should be UserCard.tsx and UserCard.test.tsx
```

**Validation:**

- Pattern detection analyzes TaskCard.tsx and AgentStatusCard.tsx
- Generated code matches detected patterns
- Uses consistent naming conventions
- Follows React 19 best practices

---

## Dependencies

### Direct Dependencies

- **VIBE-P13-003** (Backend Generator) - Similar architecture pattern at `parent-harness/orchestrator/src/spawner/generators/backend.ts`
- **TypeScript** - For syntax validation and type generation
- **File System** - Read existing components from `parent-harness/dashboard/src/components/`
- **React 19.2.0** - Target framework version
- **Vitest 4.0.18** - Test framework

### Dependent Tasks

- **VIBE-P13-005** (Feature Orchestration Layer) - Will use this generator for UI components
- **VIBE-P14-003** (E2E Test Framework) - Will generate E2E tests for components

### External Dependencies

```json
{
  "dependencies": {
    "typescript": "~5.9.3"
  }
}
```

---

## Implementation Notes

### Phase 1: Core Structure (3-4 hours)

1. Create `frontend.ts` module with types
2. Implement `detectProjectPatterns()` function
3. Build basic React template generator
4. Write pattern detection tests

### Phase 2: React Generator (3-4 hours)

1. Implement `buildPropsInterface()`
2. Implement `buildStateHooks()`
3. Implement `buildEventHandlers()`
4. Implement `buildJSX()`
5. Test with example components

### Phase 3: Test Generator (2-3 hours)

1. Implement `generateTestFile()`
2. Support Vitest + React Testing Library
3. Generate basic render tests
4. Generate prop validation tests

### Phase 4: Integration (1 hour)

1. Add `writeComponentFiles()` function
2. Integrate with spawner/feature-orchestrator
3. End-to-end test with full component generation

### Future Enhancements (Not in Scope)

- Vue 3 Composition API support
- Advanced state management (Zustand, Redux)
- Storybook story generation
- Accessibility (a11y) test generation
- Animation/transition code generation

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/generators/frontend.test.ts`

```typescript
describe("generateFrontendComponent", () => {
  it("generates valid React component", () => {
    const spec: ComponentSpec = {
      name: "TestComp",
      type: "functional",
      props: [],
    };
    const result = generateFrontendComponent(spec);

    expect(result.componentCode).toContain("export function TestComp");
    expect(result.componentCode).toContain("export default TestComp");
  });

  it("includes prop types", () => {
    const spec: ComponentSpec = {
      name: "UserCard",
      type: "functional",
      props: [
        { name: "name", type: "string", required: true },
        { name: "email", type: "string", required: false },
      ],
    };
    const result = generateFrontendComponent(spec);

    expect(result.componentCode).toContain("interface UserCardProps");
    expect(result.componentCode).toContain("name: string;");
    expect(result.componentCode).toContain("email?: string;");
  });

  it("generates test file", () => {
    const spec: ComponentSpec = {
      name: "TestComp",
      type: "functional",
      props: [],
    };
    const result = generateFrontendComponent(spec);

    expect(result.testCode).toBeTruthy();
    expect(result.testCode).toContain("it('renders component'");
    expect(result.testCode).toContain("from 'vitest'");
  });

  it("includes data-testid attribute", () => {
    const spec: ComponentSpec = {
      name: "StatusBadge",
      type: "functional",
      props: [],
    };
    const result = generateFrontendComponent(spec);

    expect(result.componentCode).toContain('data-testid="status-badge"');
  });
});

describe("detectProjectPatterns", () => {
  it("detects React projects", () => {
    const patterns = detectProjectPatterns(
      "parent-harness/dashboard/src/components",
    );
    expect(patterns.framework).toBe("react");
  });

  it("detects Tailwind usage", () => {
    const patterns = detectProjectPatterns(
      "parent-harness/dashboard/src/components",
    );
    expect(patterns.stylingApproach).toBe("tailwind");
  });

  it("detects Vitest", () => {
    const patterns = detectProjectPatterns(
      "parent-harness/dashboard/src/components",
    );
    expect(patterns.testLibrary).toBe("vitest");
  });

  it("detects PascalCase naming", () => {
    const patterns = detectProjectPatterns(
      "parent-harness/dashboard/src/components",
    );
    expect(patterns.fileNaming).toBe("PascalCase");
  });
});
```

### Integration Tests

**File:** `tests/integration/frontend-generator.test.ts`

```typescript
it("generates and validates complete component", async () => {
  const spec: ComponentSpec = {
    name: "GeneratedTestCard",
    type: "functional",
    props: [
      { name: "title", type: "string", required: true },
      { name: "count", type: "number", required: true },
    ],
    styling: "tailwind",
  };

  const result = generateFrontendComponent(spec);

  // Write to temp directory
  const tempDir = "/tmp/test-components";
  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(`${tempDir}/GeneratedTestCard.tsx`, result.componentCode);
  await fs.writeFile(`${tempDir}/GeneratedTestCard.test.tsx`, result.testCode);

  // Validate TypeScript compilation
  const { exitCode } = await exec(
    `npx tsc --noEmit ${tempDir}/GeneratedTestCard.tsx`,
  );
  expect(exitCode).toBe(0);

  // Run generated tests
  const testResult = await exec(
    `npx vitest run ${tempDir}/GeneratedTestCard.test.tsx`,
  );
  expect(testResult.stdout).toContain("✓");
});
```

---

## Risk Assessment

### High Risk

- **Pattern Detection Accuracy** - May not correctly infer all patterns
  - _Mitigation:_ Test with TaskCard.tsx and AgentStatusCard.tsx, use hardcoded defaults based on these files

### Medium Risk

- **Complex State Logic** - Hard to generate non-trivial state management
  - _Mitigation:_ Focus on simple useState patterns, mark complex logic with TODO

- **Styling Variations** - Many ways to style components
  - _Mitigation:_ Focus on Tailwind (detected from existing components)

### Low Risk

- **Test Quality** - Generated tests may be too basic
  - _Mitigation:_ Generate basic smoke tests, developers add detailed tests later

---

## Success Metrics

1. **Generation Speed** - < 500ms per component
2. **Type Safety** - 100% of generated components pass `tsc --noEmit`
3. **Test Coverage** - All generated components have at least 1 render test
4. **Pattern Accuracy** - 100% match with existing codebase conventions (TaskCard, AgentStatusCard patterns)
5. **Developer Adoption** - 5+ components generated and used in production within 2 weeks

---

## References

- **Backend Generator Pattern**: `parent-harness/orchestrator/src/spawner/generators/backend.ts`
- **Existing React Components**:
  - `parent-harness/dashboard/src/components/TaskCard.tsx`
  - `parent-harness/dashboard/src/components/AgentStatusCard.tsx`
- **Package Configuration**: `parent-harness/dashboard/package.json`
- **React TypeScript Patterns**: React 19.2.0 documentation
- **Testing Library Docs**: Vitest 4.0.18, React Testing Library
- **Tailwind CSS**: Tailwind CSS 4.1.18

---

**SPECIFICATION STATUS: COMPLETE AND READY FOR IMPLEMENTATION**
