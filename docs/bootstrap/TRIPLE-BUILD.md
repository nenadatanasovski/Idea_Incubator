# Triple-Build Verification Process

---

## Overview

Triple-build verification is a technique borrowed from compiler bootstrapping that ensures agents can reliably reproduce identical output. By building the same artifact three times and comparing results, we verify determinism and correctness.

**Why Triple-Build?**

- Build 1 may have human errors
- Build 2 proves the agent can reproduce
- Build 3 proves the reproduction is stable
- If Build 2 = Build 3, the agent is trustworthy

---

## The Three Builds

### Build 1: Human Implementation

The human developer implements the agent from its specification.

| Aspect      | Description                        |
| ----------- | ---------------------------------- |
| **Input**   | `build/spec.md` + `build/tasks.md` |
| **Actor**   | Human developer                    |
| **Output**  | Working agent code                 |
| **Purpose** | Establish baseline implementation  |

**Process:**

1. Read the specification document
2. Follow the task list in order
3. Run validation commands after each task
4. Commit when all tests pass

**Artifacts:**

```
agents/{agent-name}/
├── index.ts
├── context-loader.ts
├── template-renderer.ts
└── ...
```

---

### Build 2: Agent Self-Build

The agent from Build 1 rebuilds itself from the same specification.

| Aspect      | Description                             |
| ----------- | --------------------------------------- |
| **Input**   | Same `build/spec.md` + `build/tasks.md` |
| **Actor**   | Build 1 agent                           |
| **Output**  | `build-2/` directory with rebuilt code  |
| **Purpose** | Verify agent can reproduce itself       |

**Process:**

1. Create isolated output directory `build-2/`
2. Run Build 1 agent with spec as input
3. Agent generates all files to `build-2/`
4. Do NOT use Build 2 output yet

**Artifacts:**

```
verification/
└── build-2/
    └── agents/{agent-name}/
        ├── index.ts
        ├── context-loader.ts
        └── ...
```

---

### Build 3: Rebuilt Agent Self-Build

The agent from Build 2 rebuilds itself again.

| Aspect      | Description                             |
| ----------- | --------------------------------------- |
| **Input**   | Same `build/spec.md` + `build/tasks.md` |
| **Actor**   | Build 2 agent                           |
| **Output**  | `build-3/` directory with rebuilt code  |
| **Purpose** | Verify stability of reproduction        |

**Process:**

1. Create isolated output directory `build-3/`
2. Run Build 2 agent with spec as input
3. Agent generates all files to `build-3/`
4. Compare Build 2 and Build 3

**Artifacts:**

```
verification/
├── build-2/
│   └── agents/{agent-name}/...
└── build-3/
    └── agents/{agent-name}/...
```

---

## Comparison

### Success Criteria

**Build 2 and Build 3 must match exactly** (after normalizing acceptable differences).

```
Build 2 output  ═══════════════╗
                               ╠══► IDENTICAL = SUCCESS
Build 3 output  ═══════════════╝
```

### Comparison Methods

#### 1. File-by-File Diff

```bash
# Direct comparison
diff -r verification/build-2/ verification/build-3/

# With context for debugging
diff -rq verification/build-2/ verification/build-3/ | head -20
```

#### 2. Semantic Equivalence

For cases where syntactic differences are acceptable:

```bash
# TypeScript: Compare ASTs
npx ts-morph-compare build-2/file.ts build-3/file.ts

# JSON: Deep equality
node -e "console.log(JSON.stringify(require('./build-2/config.json')) === JSON.stringify(require('./build-3/config.json')))"
```

#### 3. Hash Comparison

```bash
# Generate file hashes
find verification/build-2 -type f -exec sha256sum {} \; | sort > build-2.hashes
find verification/build-3 -type f -exec sha256sum {} \; | sort > build-3.hashes

# Compare
diff build-2.hashes build-3.hashes
```

### Acceptable Differences

Some differences between builds are acceptable and should be normalized before comparison:

| Difference Type       | Example                           | Handling                      |
| --------------------- | --------------------------------- | ----------------------------- |
| Timestamps            | `createdAt: 2026-01-11T12:00:00Z` | Strip or normalize to epoch   |
| Generated IDs         | `id: "abc123"`                    | Replace with placeholder      |
| File order in imports | Import statement ordering         | Sort before compare           |
| Trailing whitespace   | Extra newlines                    | Trim before compare           |
| Comment variations    | JSDoc date stamps                 | Strip comments for comparison |

**Normalization Script:**

```bash
#!/bin/bash
# normalize-for-compare.sh

# Remove timestamps
sed -i 's/[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9:\.Z]*/TIMESTAMP/g' "$1"

# Remove generated UUIDs
sed -i 's/[a-f0-9]\{8\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{12\}/UUID/g' "$1"

# Normalize whitespace
sed -i 's/[[:space:]]*$//' "$1"
```

### Unacceptable Differences

These differences indicate a problem:

| Difference Type | Indicates                       |
| --------------- | ------------------------------- |
| Missing files   | Non-deterministic file creation |
| Different logic | Model temperature too high      |
| Wrong structure | Template not followed           |
| Different APIs  | Spec misinterpretation          |

---

## Automation

### Triple-Build Script

```bash
#!/bin/bash
# scripts/triple-build.sh

set -e

AGENT_NAME=$1
SPEC_PATH="agents/${AGENT_NAME}/build/spec.md"
TASKS_PATH="agents/${AGENT_NAME}/build/tasks.md"

echo "═══════════════════════════════════════════════════════"
echo "  TRIPLE-BUILD VERIFICATION: ${AGENT_NAME}"
echo "═══════════════════════════════════════════════════════"

# Clean previous verification
rm -rf verification/build-2 verification/build-3
mkdir -p verification/build-2 verification/build-3

# Build 1 should already exist (human-built)
if [ ! -d "agents/${AGENT_NAME}" ]; then
  echo "ERROR: Build 1 not found at agents/${AGENT_NAME}"
  exit 1
fi
echo "✓ Build 1 exists"

# Build 2: Run Build 1 agent
echo ""
echo "Running Build 2 (Build 1 agent self-building)..."
node agents/${AGENT_NAME}/index.js \
  --spec "${SPEC_PATH}" \
  --tasks "${TASKS_PATH}" \
  --output "verification/build-2/agents/${AGENT_NAME}"
echo "✓ Build 2 complete"

# Build 3: Run Build 2 agent
echo ""
echo "Running Build 3 (Build 2 agent self-building)..."
node verification/build-2/agents/${AGENT_NAME}/index.js \
  --spec "${SPEC_PATH}" \
  --tasks "${TASKS_PATH}" \
  --output "verification/build-3/agents/${AGENT_NAME}"
echo "✓ Build 3 complete"

# Compare
echo ""
echo "Comparing Build 2 and Build 3..."
./scripts/normalize-for-compare.sh verification/build-2
./scripts/normalize-for-compare.sh verification/build-3

if diff -rq verification/build-2 verification/build-3 > /dev/null; then
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  ✓ TRIPLE-BUILD PASSED: Build 2 = Build 3"
  echo "═══════════════════════════════════════════════════════"
  exit 0
else
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  ✗ TRIPLE-BUILD FAILED: Build 2 ≠ Build 3"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "Differences:"
  diff -r verification/build-2 verification/build-3 | head -50
  exit 1
fi
```

### Comparison Script

```bash
#!/bin/bash
# scripts/compare-builds.sh

BUILD_A=$1
BUILD_B=$2

echo "Comparing ${BUILD_A} vs ${BUILD_B}"
echo ""

# Count files
FILES_A=$(find "${BUILD_A}" -type f | wc -l)
FILES_B=$(find "${BUILD_B}" -type f | wc -l)
echo "Files in ${BUILD_A}: ${FILES_A}"
echo "Files in ${BUILD_B}: ${FILES_B}"

if [ "${FILES_A}" != "${FILES_B}" ]; then
  echo "WARNING: Different file counts!"
fi

# Line-by-line comparison
echo ""
echo "File differences:"
diff -rq "${BUILD_A}" "${BUILD_B}" || true

# Detailed diff for TypeScript files
echo ""
echo "TypeScript semantic differences:"
for file in $(find "${BUILD_A}" -name "*.ts"); do
  relative="${file#${BUILD_A}/}"
  other="${BUILD_B}/${relative}"
  if [ -f "${other}" ]; then
    if ! diff -q "${file}" "${other}" > /dev/null 2>&1; then
      echo "  ${relative}: DIFFERS"
    fi
  else
    echo "  ${relative}: MISSING in ${BUILD_B}"
  fi
done
```

### CI Integration

```yaml
# .github/workflows/triple-build.yml

name: Triple-Build Verification

on:
  push:
    paths:
      - "agents/**"
  pull_request:
    paths:
      - "agents/**"

jobs:
  triple-build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        agent: [specification, build, validation]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Run triple-build for ${{ matrix.agent }}
        run: ./scripts/triple-build.sh ${{ matrix.agent }}

      - name: Upload verification artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: triple-build-${{ matrix.agent }}
          path: verification/
```

---

## Failure Recovery

### When Triple-Build Fails

1. **Identify the diff**: What exactly differs between Build 2 and Build 3?

2. **Categorize the cause**:
   - **Non-determinism**: Random values, timestamps, ordering
   - **Model variance**: Claude producing different output
   - **Bug in agent**: Logic error in generation code

3. **Fix based on cause**:
   - Non-determinism: Add normalization to acceptable differences
   - Model variance: Lower temperature, add more constraints to prompt
   - Bug: Fix the agent code, restart from Build 1

### Escalation Matrix

| Issue                          | Who Handles | Action                      |
| ------------------------------ | ----------- | --------------------------- |
| Acceptable diff not normalized | Human       | Update normalization script |
| Model producing variants       | Human       | Tune prompt/temperature     |
| Structural differences         | Human       | Review and fix spec         |
| Build 2 crashes                | Human       | Debug Build 1 agent         |
| Build 3 crashes                | Human       | Debug Build 2 output        |

---

## Metrics

Track these metrics over time:

| Metric              | Target  | Description                       |
| ------------------- | ------- | --------------------------------- |
| Pass rate           | > 95%   | Triple-builds that pass first try |
| Diff count          | 0       | Unacceptable differences per run  |
| Build time          | < 5 min | Time for all three builds         |
| Normalization rules | < 10    | Acceptable difference types       |

---

## References

- [Trusting Trust (Ken Thompson, 1984)](https://www.cs.cmu.edu/~rdriley/487/papers/Thompson_1984_ResearchonTrustingTrust.pdf)
- [Bootstrapping Compilers](<https://en.wikipedia.org/wiki/Bootstrapping_(compilers)>)
- [Reproducible Builds](https://reproducible-builds.org/)

---

_This document defines the verification process that ensures agent reliability._
