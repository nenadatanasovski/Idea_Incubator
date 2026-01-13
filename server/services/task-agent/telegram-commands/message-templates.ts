/**
 * Task Agent Telegram Message Templates
 *
 * Pre-formatted message templates for consistent Telegram output.
 * All templates follow the "Always include a recommendation" rule.
 *
 * Part of: PTE-096 to PTE-100
 */

import type {
  GroupingSuggestion,
  ExecutionWave,
  BuildAgentInstance,
} from '../../../../types/task-agent.js';
import type { CycleDetectionResult } from '../circular-dependency-prevention.js';

/**
 * Task creation confirmation message
 */
export function taskCreatedMessage(task: {
  displayId: string;
  title: string;
  category?: string;
  estimatedFiles?: string[];
}): string {
  let message = `📝 **Task Created:** ${task.displayId}

**Title:** ${task.title}`;

  if (task.category) {
    message += `\n**Category:** ${task.category}`;
  }

  if (task.estimatedFiles && task.estimatedFiles.length > 0) {
    message += `\n**Estimated files:** ${task.estimatedFiles.slice(0, 3).join(', ')}`;
    if (task.estimatedFiles.length > 3) {
      message += ` (+${task.estimatedFiles.length - 3} more)`;
    }
  }

  message += `

**Status:** In Evaluation Queue

📊 Analysis in progress...`;

  return message;
}

/**
 * Analysis complete message with related tasks
 */
export function analysisCompleteWithRelatedMessage(task: {
  displayId: string;
  relatedTasks: Array<{ displayId: string; title: string }>;
  suggestedListName: string;
  reason: string;
  suggestionId: string;
}): string {
  let message = `🔍 **Analysis Complete:** ${task.displayId}

**Related tasks found:**`;

  for (const related of task.relatedTasks.slice(0, 5)) {
    message += `\n• \`${related.displayId}\`: ${related.title.substring(0, 50)}${related.title.length > 50 ? '...' : ''}`;
  }

  message += `

💡 **My Recommendation:** Create a task list "${task.suggestedListName}" with these ${task.relatedTasks.length} related tasks. They ${task.reason}.

[✅ Create List](callback:grouping:accept:${task.suggestionId}) | [✏️ Modify](callback:grouping:modify:${task.suggestionId}) | [⏭️ Keep Separate](callback:grouping:reject:${task.suggestionId})`;

  return message;
}

/**
 * Analysis complete message without related tasks
 */
export function analysisCompleteNoRelatedMessage(task: {
  displayId: string;
}): string {
  return `✅ **Analysis Complete:** ${task.displayId}

No related tasks found in Evaluation Queue.

💡 **My Recommendation:** Keep this task in the queue until more related tasks are added, or add it to an existing task list.

[📋 Add to List](callback:task:addtolist:${task.displayId}) | [⏭️ Keep in Queue](callback:task:keepinqueue:${task.displayId})`;
}

/**
 * Execution started message
 */
export function executionStartedMessage(data: {
  taskListName: string;
  totalCount: number;
  parallelCount: number;
  agentCount: number;
  taskListId: string;
}): string {
  return `🚀 **Execution Started:** ${data.taskListName}

**Tasks:** ${data.totalCount}
**Parallel:** ${data.parallelCount} tasks in Wave 1
**Build Agents:** ${data.agentCount} spawned

**Progress:** 0/${data.totalCount}

[⏸️ Pause](callback:exec:pause:${data.taskListId}) | [📊 Details](callback:exec:details:${data.taskListId})`;
}

/**
 * Task failed message with recommendation
 */
export function taskFailedMessage(data: {
  displayId: string;
  errorMessage: string;
  blockedCount: number;
  independentCount: number;
  aiRecommendation: string;
  taskId: string;
}): string {
  return `❌ **Task Failed:** ${data.displayId}

**Error:** ${data.errorMessage.substring(0, 200)}${data.errorMessage.length > 200 ? '...' : ''}

**Impact:**
• ${data.blockedCount} tasks now blocked
• ${data.independentCount} tasks unaffected (continuing)

💡 **My Recommendation:** ${data.aiRecommendation}

[🔧 Create Fix Task](callback:task:createfix:${data.taskId}) | [🔄 Retry](callback:task:retry:${data.taskId}) | [⏭️ Skip](callback:task:skip:${data.taskId}) | [📊 Show Impact](callback:task:impact:${data.taskId})`;
}

/**
 * Circular dependency detected message
 */
export function circularDependencyMessage(data: CycleDetectionResult): string {
  if (!data.hasCycle || !data.cycleDisplayIds || !data.recommendation) {
    return `⚠️ **Dependency Warning**

A potential circular dependency was detected, but I couldn't determine the exact cycle.

Please review task dependencies manually.`;
  }

  const cyclePath = data.cycleDisplayIds.join(' → ');

  return `🔄 **Circular Dependency Detected**

**Cycle:** ${cyclePath}

💡 **My Recommendation:** Remove the dependency from \`${data.cycleDisplayIds[data.cycleDisplayIds.length - 2]}\` to \`${data.cycleDisplayIds[data.cycleDisplayIds.length - 1]}\` because ${data.recommendation.reason}

[✅ Apply Fix](callback:cycle:apply:${data.recommendation.sourceTaskId}:${data.recommendation.targetTaskId}) | [🔀 Different Fix](callback:cycle:different) | [👀 Show Graph](callback:cycle:graph)`;
}

/**
 * Stale queue reminder (daily digest)
 */
export function staleQueueReminderMessage(data: {
  totalCount: number;
  staleCount: number;
  newCount: number;
}): string {
  return `📬 **Evaluation Queue Status**

You have **${data.totalCount}** tasks awaiting grouping:
• ⚠️ ${data.staleCount} are older than 3 days
• ✨ ${data.newCount} added today

💡 **My Recommendation:** Review the ${data.staleCount} stale tasks and either group them or move them to existing task lists.

[📋 View Queue](callback:queue:view) | [🔍 Suggest Groupings](callback:queue:suggest)`;
}

/**
 * Grouping suggestion message
 */
export function groupingSuggestionMessage(suggestion: GroupingSuggestion): string {
  const score = suggestion.similarityScore || 0;
  let message = `📁 **Grouping Suggestion**

**Suggested List:** ${suggestion.suggestedName}
**Tasks:** ${suggestion.suggestedTasks.length}
**Score:** ${Math.round(score * 100)}%

**Why:** ${suggestion.groupingReason.substring(0, 150)}${suggestion.groupingReason.length > 150 ? '...' : ''}

**Tasks to group:** ${suggestion.suggestedTasks.length} tasks`;

  message += `

[✅ Accept](callback:grouping:accept:${suggestion.id}) | [❌ Reject](callback:grouping:reject:${suggestion.id})`;

  return message;
}

/**
 * Wave execution update message
 */
export function waveUpdateMessage(wave: ExecutionWave, taskListName: string): string {
  const statusIcon =
    wave.status === 'completed'
      ? '✅'
      : wave.status === 'in_progress'
      ? '🔄'
      : wave.status === 'failed'
      ? '❌'
      : '⏳';

  return `${statusIcon} **Wave ${wave.waveNumber} ${wave.status}**

**Task List:** ${taskListName}
**Tasks:** ${wave.completedCount}/${wave.taskCount} completed
${wave.failedCount > 0 ? `**Failed:** ${wave.failedCount}` : ''}

${wave.status === 'completed' && wave.waveNumber < 10 ? '🚀 Starting next wave...' : ''}`;
}

/**
 * Execution complete message
 */
export function executionCompleteMessage(data: {
  taskListName: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  duration: string;
}): string {
  const successRate = data.totalTasks > 0
    ? Math.round((data.completedTasks / data.totalTasks) * 100)
    : 0;

  const statusEmoji = data.failedTasks === 0 ? '🎉' : data.failedTasks < data.completedTasks ? '⚠️' : '❌';

  return `${statusEmoji} **Execution Complete:** ${data.taskListName}

**Results:**
• ✅ Completed: ${data.completedTasks}
• ❌ Failed: ${data.failedTasks}
• ⏭️ Skipped: ${data.skippedTasks}

**Success Rate:** ${successRate}%
**Duration:** ${data.duration}

${data.failedTasks > 0 ? `\n💡 Review failed tasks and consider creating fix tasks.\n\n[🔧 Review Failed](callback:exec:reviewfailed)` : ''}`;
}

/**
 * Agent status message
 */
export function agentStatusMessage(agent: BuildAgentInstance): string {
  const statusIcon =
    agent.status === 'running'
      ? '🟢'
      : agent.status === 'spawning'
      ? '🟡'
      : agent.status === 'completing'
      ? '✅'
      : agent.status === 'terminated'
      ? '❌'
      : '⚪';

  let message = `${statusIcon} **Build Agent**

**Task:** \`${agent.taskId || agent.id.slice(0, 8)}\`
**Status:** ${agent.status}`;

  if (agent.lastHeartbeatAt) {
    const age = Math.floor((Date.now() - new Date(agent.lastHeartbeatAt).getTime()) / 1000);
    const healthWarning = age > 60 ? ' ⚠️' : '';
    message += `\n**Heartbeat:** ${age}s ago${healthWarning}`;
  }

  if (agent.errorMessage) {
    message += `\n**Error:** ${agent.errorMessage.substring(0, 100)}${agent.errorMessage.length > 100 ? '...' : ''}`;
  }

  return message;
}

/**
 * Help message for task agent commands
 */
export function helpMessage(): string {
  return `🤖 **Task Agent Commands**

**Task Creation:**
\`/newtask <description>\` - Create a new task
Or just describe a task in natural language!

**Queue Management:**
\`/queue\` - Show Evaluation Queue status
\`/suggest\` - Get grouping suggestions

**Execution:**
\`/parallel [task_list_id]\` - Show parallelism status
\`/agents\` - Show active Build Agents

**Tips:**
• Forward a message to create a task from it
• Tasks go to Evaluation Queue first
• I'll suggest groupings automatically
• Use inline buttons to accept/reject suggestions`;
}

export default {
  taskCreatedMessage,
  analysisCompleteWithRelatedMessage,
  analysisCompleteNoRelatedMessage,
  executionStartedMessage,
  taskFailedMessage,
  circularDependencyMessage,
  staleQueueReminderMessage,
  groupingSuggestionMessage,
  waveUpdateMessage,
  executionCompleteMessage,
  agentStatusMessage,
  helpMessage,
};
