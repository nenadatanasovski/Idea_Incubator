# Escape Hatch Procedures

---

## Overview

This document defines procedures for when autonomous agents produce incorrect, incomplete, or harmful output. These escape hatches are the safety net that makes agent autonomy safe.

**Golden Rule:** When in doubt, stop the agent and assess manually.

---

## Detection

### Automated Detection

Agents are automatically stopped when:

| Signal               | Threshold                   | Action           |
| -------------------- | --------------------------- | ---------------- |
| TypeScript errors    | Any error in generated code | Pause and report |
| Test failures        | > 50% of tests fail         | Pause and report |
| Infinite loop        | > 5 minutes on single task  | Force stop       |
| File size explosion  | > 10x expected size         | Pause and report |
| Missing dependencies | Import of non-existent file | Pause and report |

### Human Detection Triggers

Stop the agent immediately if you observe:

1. **Scope Creep**: Agent modifying files not in the task list
2. **Pattern Violation**: Code that doesn't match project conventions
3. **Logic Errors**: Implementation that doesn't match spec intent
4. **Repetitive Failures**: Same error 3+ times
5. **Silent Errors**: Agent claims success but output is wrong
6. **Resource Abuse**: Excessive API calls or file operations

### Quality Thresholds

| Metric               | Acceptable | Concerning | Critical |
| -------------------- | ---------- | ---------- | -------- |
| Task completion rate | > 90%      | 70-90%     | < 70%    |
| Gotcha relevance     | > 80%      | 60-80%     | < 60%    |
| Code compiles        | 100%       | < 100%     | N/A      |
| Tests pass           | > 80%      | 60-80%     | < 60%    |

---

## Manual Override

### Stopping an Agent Mid-Execution

**Immediate Stop:**

```bash
# If running in terminal
Ctrl+C

# If running as background process
kill $(pgrep -f "agent-name")

# If running via Claude Code CLI
Ctrl+C or type "stop"
```

**Graceful Stop:**

```bash
# Create stop signal file
touch .agent-stop

# Agent should check for this file between tasks
```

### Rolling Back Agent Changes

**Option 1: Git Reset (Recommended)**

```bash
# See what changed
git status
git diff

# Discard all uncommitted changes
git checkout -- .
git clean -fd

# Or reset to specific commit
git log --oneline -10
git reset --hard <commit-hash>
```

**Option 2: Selective Rollback**

```bash
# Discard changes to specific file
git checkout -- path/to/file.ts

# Discard changes to directory
git checkout -- server/routes/

# Keep some changes, discard others
git stash
git stash pop  # Selectively apply
```

**Option 3: Branch Isolation**

```bash
# Before agent runs, create backup branch
git checkout -b agent-backup-$(date +%Y%m%d-%H%M%S)
git checkout main

# If things go wrong, switch back
git checkout agent-backup-XXXXXXXX
```

### Manually Correcting Output

**For spec.md or tasks.md:**

1. Open the file in your editor
2. Make corrections directly
3. Run validation: `npm test -- tests/spec-agent/`
4. Mark task as manually corrected in execution log

**For generated code:**

1. Stop the agent
2. Review the diff: `git diff path/to/file.ts`
3. Edit manually or regenerate specific sections
4. Run TypeScript check: `npx tsc --noEmit`
5. Run tests: `npm test`

---

## Recovery

### Restarting After Manual Correction

**For Spec Agent:**

```bash
# 1. Commit your manual corrections
git add .
git commit -m "Manual correction to spec output"

# 2. Update the task status
# Edit tasks.md, mark corrected tasks as complete

# 3. Restart from next pending task
npm run spec-agent -- --resume --from <task-id>
```

**For Build Agent:**

```bash
# 1. Commit your fixes
git add .
git commit -m "Manual fix: <description>"

# 2. Mark current task as complete with notes
# Edit tasks.md execution log

# 3. Resume build
npm run build-agent -- --resume
```

### Preventing Same Failure

**Step 1: Identify Root Cause**

| Failure Type    | Root Cause         | Prevention            |
| --------------- | ------------------ | --------------------- |
| Missing context | Brief incomplete   | Add to brief template |
| Wrong pattern   | No gotcha for this | Add to Knowledge Base |
| Scope creep     | Unclear boundaries | Add to "Out of Scope" |
| Logic error     | Spec ambiguous     | Clarify spec          |

**Step 2: Update Knowledge Base**

```bash
# Add new gotcha
echo "| G-XXX | <gotcha> | Manual Fix | High |" >> knowledge-base/gotchas.md

# Add new pattern
echo "| P-XXX | <pattern> | <context> | High |" >> knowledge-base/patterns.md
```

**Step 3: Update Templates (if needed)**

- Add missing section to template
- Add validation check
- Add example for edge case

### Recording the Failure

Always document failures in the execution log:

```markdown
## Execution Log

| Task  | Status   | Notes                                   |
| ----- | -------- | --------------------------------------- |
| T-003 | FAILED   | Missing gotcha for SQLite UPSERT syntax |
| T-003 | MANUAL   | Fixed manually, added gotcha G-042      |
| T-004 | COMPLETE | Resumed after fix                       |
```

---

## Escalation Matrix

### Agent Can Self-Correct

| Issue                           | Self-Correction          |
| ------------------------------- | ------------------------ |
| Minor TypeScript error          | Retry with error message |
| Missing import                  | Add import and retry     |
| Test failure with clear message | Fix based on assertion   |
| Lint warning                    | Auto-fix and continue    |

### Human Must Intervene

| Issue                           | Human Action               |
| ------------------------------- | -------------------------- |
| Architectural decision needed   | Clarify in brief/spec      |
| Security concern                | Review and approve         |
| Breaking change to public API   | Confirm intent             |
| Resource creation (DB, files)   | Approve resource names     |
| External API integration        | Provide credentials/config |
| Test failure with unclear cause | Debug manually             |

### Abandon and Restart

Consider starting fresh when:

1. **> 50% of tasks need manual correction**
   - Brief or spec is fundamentally flawed
   - Regenerate with updated context

2. **Agent is stuck in loop**
   - Same error 5+ times
   - Clear state and restart

3. **Output is completely wrong**
   - Misunderstood the requirement
   - Revise brief and regenerate

4. **Dependencies have changed**
   - Underlying code evolved
   - Update context and regenerate

**Fresh Start Procedure:**

```bash
# 1. Archive current attempt
git stash
mkdir -p .archive/$(date +%Y%m%d-%H%M%S)
cp -r ideas/project/build .archive/$(date +%Y%m%d-%H%M%S)/

# 2. Clear output files
rm -f ideas/project/build/spec.md
rm -f ideas/project/build/tasks.md

# 3. Update brief with learnings
vim ideas/project/planning/brief.md

# 4. Regenerate
npm run spec-agent -- --idea project
```

---

## Emergency Procedures

### Agent Consuming Too Many Resources

```bash
# Kill all node processes
pkill -f node

# Check for runaway processes
ps aux | grep -E "(node|npm)" | grep -v grep

# Clear any lock files
rm -f .agent-lock
rm -f .agent-state.json
```

### Agent Modified Wrong Files

```bash
# Find what changed
git status

# Review changes
git diff

# Revert all changes to protected directories
git checkout -- server/core/
git checkout -- database/migrations/  # Careful with migrations!
git checkout -- CLAUDE.md

# Selective revert
git diff --name-only | while read file; do
  read -p "Revert $file? (y/n) " choice
  [ "$choice" = "y" ] && git checkout -- "$file"
done
```

### Database Corrupted

```bash
# Backup current state
cp database/ideas.db database/ideas.db.bak.$(date +%s)

# Option 1: Restore from backup
cp database/ideas.db.backup database/ideas.db

# Option 2: Recreate from migrations
rm database/ideas.db
npm run migrate

# Option 3: Resync from markdown
npm run sync
```

---

## Quick Reference Card

```
+---------------------------+---------------------------+
|      STOP THE AGENT       |      ROLL BACK           |
+---------------------------+---------------------------+
| Ctrl+C                    | git checkout -- .         |
| touch .agent-stop         | git reset --hard HEAD~1   |
| kill $(pgrep agent)       | git stash                 |
+---------------------------+---------------------------+
|      RESUME               |      FRESH START         |
+---------------------------+---------------------------+
| git commit manual fixes   | Archive: cp build .archive|
| Update task status        | Clear: rm build/*.md      |
| npm run agent --resume    | Regenerate: npm run agent |
+---------------------------+---------------------------+
```

---

## Checklist Before Agent Runs

- [ ] Created backup branch or commit
- [ ] Reviewed brief for completeness
- [ ] Verified agent has correct permissions
- [ ] Cleared any stale state files
- [ ] Ready to monitor execution

---

_This document is referenced by all agent implementations._
_Last updated: 2026-01-10_
