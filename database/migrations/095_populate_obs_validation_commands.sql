-- Migration 092: Populate validation commands for observability tasks
-- Part of GAP-001: Per-Task Validation Commands
-- Sets appropriate validation commands for Python/SQL/TypeScript tasks

-- Set Python validation for Python-based observability tasks
UPDATE tasks
SET validation_command = 'python3 -c "import sys; sys.exit(0)"'
WHERE display_id LIKE 'OBS-1%'
  AND (description LIKE '%python%' OR description LIKE '%.py%' OR title LIKE '%Python%');

-- Set SQLite validation for migration/schema tasks
UPDATE tasks
SET validation_command = 'sqlite3 database/ideas.db ".schema" > /dev/null && echo "Schema valid"'
WHERE display_id LIKE 'OBS-%'
  AND (description LIKE '%migration%' OR description LIKE '%.sql%' OR title LIKE '%schema%');

-- Set TypeScript validation as explicit default for TS tasks
UPDATE tasks
SET validation_command = 'npx tsc --noEmit'
WHERE display_id LIKE 'OBS-%'
  AND validation_command IS NULL
  AND (description LIKE '%.ts%' OR description LIKE '%.tsx%' OR title LIKE '%TypeScript%' OR title LIKE '%component%');
