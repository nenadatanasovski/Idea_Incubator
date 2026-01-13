# SQL Query Reference

**Part of:** [Parallel Task Execution Implementation Plan](./PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md)

This document contains all SQL queries used in the parallelism engine.

---

## Query 1: Find Parallel Opportunities

```sql
-- Find all task pairs that CAN run in parallel
-- (no file conflicts, no dependencies)

WITH task_pairs AS (
  SELECT
    t1.id AS task_a_id,
    t2.id AS task_b_id
  FROM tasks t1
  CROSS JOIN tasks t2
  WHERE t1.id < t2.id  -- Avoid duplicates
    AND t1.task_list_id = t2.task_list_id
    AND t1.status = 'pending'
    AND t2.status = 'pending'
),
dependency_conflicts AS (
  SELECT DISTINCT
    tp.task_a_id,
    tp.task_b_id
  FROM task_pairs tp
  WHERE EXISTS (
    SELECT 1 FROM task_relationships tr
    WHERE (tr.source_task_id = tp.task_a_id AND tr.target_task_id = tp.task_b_id)
       OR (tr.source_task_id = tp.task_b_id AND tr.target_task_id = tp.task_a_id)
    AND tr.relationship_type = 'depends_on'
  )
),
file_conflicts AS (
  SELECT DISTINCT
    fi1.task_id AS task_a_id,
    fi2.task_id AS task_b_id,
    fi1.file_path AS conflict_file
  FROM task_file_impacts fi1
  JOIN task_file_impacts fi2
    ON fi1.file_path = fi2.file_path
    AND fi1.task_id < fi2.task_id
  WHERE
    -- Both writing to same file = conflict
    (fi1.operation IN ('CREATE', 'UPDATE', 'DELETE')
     AND fi2.operation IN ('CREATE', 'UPDATE', 'DELETE'))
)
SELECT
  tp.task_a_id,
  tp.task_b_id,
  CASE
    WHEN dc.task_a_id IS NOT NULL THEN 0
    WHEN fc.task_a_id IS NOT NULL THEN 0
    ELSE 1
  END AS can_parallel,
  fc.conflict_file
FROM task_pairs tp
LEFT JOIN dependency_conflicts dc
  ON tp.task_a_id = dc.task_a_id AND tp.task_b_id = dc.task_b_id
LEFT JOIN file_conflicts fc
  ON tp.task_a_id = fc.task_a_id AND tp.task_b_id = fc.task_b_id;
```

---

## Query 2: Get File Conflicts for Task Pair

```sql
-- Get detailed file conflicts between two tasks

SELECT
  fi1.file_path,
  fi1.operation AS task_a_operation,
  fi2.operation AS task_b_operation,
  fi1.confidence AS task_a_confidence,
  fi2.confidence AS task_b_confidence,
  CASE
    WHEN fi1.operation = 'CREATE' AND fi2.operation = 'CREATE' THEN 'create_create'
    WHEN fi1.operation IN ('UPDATE', 'DELETE') AND fi2.operation IN ('UPDATE', 'DELETE') THEN 'write_write'
    WHEN fi1.operation = 'DELETE' OR fi2.operation = 'DELETE' THEN 'delete_conflict'
    ELSE 'unknown'
  END AS conflict_type
FROM task_file_impacts fi1
JOIN task_file_impacts fi2
  ON fi1.file_path = fi2.file_path
WHERE fi1.task_id = :task_a_id
  AND fi2.task_id = :task_b_id
  AND fi1.operation != 'READ'
  AND fi2.operation != 'READ';
```

---

## Query 3: Get Dependency Chain (Transitive)

```sql
-- Get all transitive dependencies for a task
-- Uses recursive CTE

WITH RECURSIVE dep_chain AS (
  -- Base case: direct dependencies
  SELECT
    source_task_id,
    target_task_id,
    1 AS depth
  FROM task_relationships
  WHERE source_task_id = :task_id
    AND relationship_type = 'depends_on'

  UNION ALL

  -- Recursive case: dependencies of dependencies
  SELECT
    tr.source_task_id,
    tr.target_task_id,
    dc.depth + 1
  FROM task_relationships tr
  JOIN dep_chain dc ON tr.source_task_id = dc.target_task_id
  WHERE tr.relationship_type = 'depends_on'
    AND dc.depth < 10  -- Prevent infinite loops
)
SELECT DISTINCT target_task_id, depth
FROM dep_chain
ORDER BY depth;
```

---

## Query 4: Detect Circular Dependencies

```sql
-- Detect if adding a dependency would create a cycle
-- Returns the cycle path if one would be created

WITH RECURSIVE path AS (
  -- Start from target, see if we can reach source
  SELECT
    :target_task_id AS current,
    :target_task_id AS path,
    1 AS depth

  UNION ALL

  SELECT
    tr.target_task_id,
    p.path || ' -> ' || tr.target_task_id,
    p.depth + 1
  FROM task_relationships tr
  JOIN path p ON tr.source_task_id = p.current
  WHERE tr.relationship_type = 'depends_on'
    AND p.depth < 20
    AND tr.target_task_id != :target_task_id  -- Don't revisit start
)
SELECT path || ' -> ' || :source_task_id AS cycle_path
FROM path
WHERE current = :source_task_id
LIMIT 1;
```

---

## Query 5: Calculate Execution Waves

```sql
-- Calculate which tasks can run in each wave
-- Wave 1: tasks with no unmet dependencies
-- Wave N: tasks whose dependencies are all in waves 1 to N-1

WITH RECURSIVE waves AS (
  -- Wave 1: tasks with no dependencies (or all deps completed)
  SELECT
    t.id AS task_id,
    1 AS wave_number
  FROM tasks t
  WHERE t.task_list_id = :task_list_id
    AND t.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM task_relationships tr
      JOIN tasks dep ON tr.target_task_id = dep.id
      WHERE tr.source_task_id = t.id
        AND tr.relationship_type = 'depends_on'
        AND dep.status NOT IN ('completed', 'skipped')
    )

  UNION ALL

  -- Subsequent waves
  SELECT
    t.id AS task_id,
    w.wave_number + 1
  FROM tasks t
  JOIN (
    SELECT MAX(wave_number) AS wave_number
    FROM waves
  ) w ON 1=1
  WHERE t.task_list_id = :task_list_id
    AND t.status = 'pending'
    AND t.id NOT IN (SELECT task_id FROM waves)
    AND NOT EXISTS (
      SELECT 1 FROM task_relationships tr
      WHERE tr.source_task_id = t.id
        AND tr.relationship_type = 'depends_on'
        AND tr.target_task_id NOT IN (SELECT task_id FROM waves)
    )
    AND w.wave_number < 50  -- Safety limit
)
SELECT task_id, wave_number
FROM waves
ORDER BY wave_number, task_id;
```

---

## Query 6: Invalidate Stale Parallelism Analysis

```sql
-- Invalidate parallelism analyses when task file impacts change

UPDATE parallelism_analysis
SET invalidated_at = datetime('now')
WHERE (task_a_id = :changed_task_id OR task_b_id = :changed_task_id)
  AND invalidated_at IS NULL;
```

---

## Query 7: Get Evaluation Queue Statistics

```sql
-- Get statistics for Evaluation Queue dashboard

SELECT
  COUNT(*) AS total_queued,
  COUNT(CASE WHEN created_at < datetime('now', '-3 days') THEN 1 END) AS stale_count,
  COUNT(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 END) AS new_today,
  AVG(julianday('now') - julianday(created_at)) AS avg_days_in_queue
FROM tasks
WHERE queue = 'evaluation';
```
