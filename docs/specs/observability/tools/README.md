# Observability Tools Directory

> **Navigation:** [Documentation Index](../../DOCUMENTATION-INDEX.md) > [Observability Spec](../SPEC.md) > Tools
> **Location:** `docs/specs/observability/tools/`
> **Purpose:** Agent-discoverable SQL tools for observability data analysis

---

## Contents

| File                                                       | Purpose                                                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [OBSERVABILITY-SQL-TOOLS.md](./OBSERVABILITY-SQL-TOOLS.md) | 35+ SQL scripts organized by category (V=Validation, T=Troubleshooting, I=Investigation, A=Aggregation, P=Parallelization, D=Detection) |
| [SKILLS.md](./SKILLS.md)                                   | Agent skill definitions for invoking tools via `/obs-*` commands                                                                        |
| [README.md](./README.md)                                   | This index file                                                                                                                         |

## Python Implementation

The Python implementation is located at:

```
coding-loops/shared/observability_skills.py
```

## Quick Start

### For Agents (via Skills)

```
/obs-validate exec-123        # Validate data integrity
/obs-errors exec-123          # Find all errors
/obs-parallel-health exec-123 # Check parallel execution
/obs-anomalies exec-123       # Detect unusual patterns
```

### For Python Code

```python
from shared.observability_skills import ObservabilitySkills

skills = ObservabilitySkills("database/observability.db")
issues = skills.validate("exec-123")
errors = skills.find_errors("exec-123")
health = skills.parallel_health("exec-123")
```

### For Direct SQL

```bash
sqlite3 database/observability.db < path/to/query.sql
```

---

## Tool Categories

| Prefix | Category        | Purpose                              | Count |
| ------ | --------------- | ------------------------------------ | ----- |
| **V**  | Validation      | Verify data integrity and invariants | 7     |
| **T**  | Troubleshooting | Find errors and blocked operations   | 6     |
| **I**  | Investigation   | Deep-dive into execution patterns    | 7     |
| **A**  | Aggregation     | Generate summaries and metrics       | 6     |
| **P**  | Parallelization | Detect concurrency issues            | 7     |
| **D**  | Detection       | Find anomalies and outliers          | 6     |

**Total: 39 SQL tools**

---

## First Principles

These tools are designed around core truth invariants:

1. **Transcript is the canonical record** - All events trace back to transcript_entries
2. **Sequences must be monotonic** - No gaps, no duplicates
3. **Temporal consistency** - start_time < end_time always
4. **Balanced resources** - Acquires match releases
5. **Referential integrity** - All FKs are valid

When these invariants are violated, validation tools detect them.

---

## Scenario → Tool Mapping

| I need to...                            | Use        |
| --------------------------------------- | ---------- |
| Verify execution completed cleanly      | V001-V007  |
| Debug why execution failed              | T001, T003 |
| Understand what a task did              | I001       |
| Find what's blocking parallel execution | P002, P003 |
| Generate dashboard metrics              | A001, A004 |
| Find performance bottlenecks            | A005, P005 |
| Detect unusual patterns                 | D001-D006  |
| Compare multiple executions             | A006, D003 |

---

## Related Documents

- [Data Model](../data-model/README.md) - Entity relationships
- [Database Schema](../appendices/DATABASE.md) - Table definitions
- [API](../api/README.md) - REST endpoints for these queries
- [Python Producers](../python/README.md) - Data writers
