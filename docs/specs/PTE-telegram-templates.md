# Telegram Message Templates

**Part of:** [Parallel Task Execution Implementation Plan](./PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md)

**Rule:** All Telegram messages MUST include a recommendation when actionable.

---

## Task Creation Confirmation

```
📝 Task Created: {display_id}

Title: {title}
Category: {category}
Estimated files: {file_list}

Status: In Evaluation Queue

📊 Analysis in progress...

[✏️ Edit] [❌ Delete]
```

---

## Analysis Complete (with related tasks)

```
🔍 Analysis Complete: {display_id}

Related tasks found:
• {related_1_display_id}: {related_1_title}
• {related_2_display_id}: {related_2_title}

**My Recommendation:** Create a task list "{suggested_name}" with these {count} related tasks. They share {reason}.

[✅ Create List] [✏️ Modify] [⏭️ Keep Separate]
```

---

## Analysis Complete (no related tasks)

```
✅ Analysis Complete: {display_id}

No related tasks found in Evaluation Queue.

**My Recommendation:** Keep this task in the queue until more related tasks are added, or add it to an existing task list.

[📋 Add to List] [⏭️ Keep in Queue]
```

---

## Execution Started

```
🚀 Execution Started: {task_list_name}

Tasks: {total_count}
Parallel: {parallel_count} tasks in Wave 1
Build Agents: {agent_count} spawned

Progress: 0/{total_count}

[⏸️ Pause] [📊 Details]
```

---

## Task Failed (with recommendation)

```
❌ Task Failed: {display_id}

Error: {error_message}

Impact:
• {blocked_count} tasks now blocked
• {independent_count} tasks unaffected (continuing)

**My Recommendation:** {ai_recommendation}

[🔧 Create Fix Task] [🔄 Retry] [⏭️ Skip] [📊 Show Impact]
```

---

## Circular Dependency Detected

```
🔄 Circular Dependency Detected

Cycle: {task_1} → {task_2} → {task_3} → {task_1}

**My Recommendation:** Remove the dependency from {task_x} to {task_y} because {reason}.

[✅ Apply Fix] [🔀 Different Fix] [👀 Show Graph]
```

---

## Stale Queue Reminder (Daily)

```
📬 Evaluation Queue Status

You have {count} tasks awaiting grouping:
• {stale_count} are older than 3 days
• {new_count} added today

**My Recommendation:** Review the {stale_count} stale tasks and either group them or move them to existing task lists.

[📋 View Queue] [🔍 Suggest Groupings]
```
