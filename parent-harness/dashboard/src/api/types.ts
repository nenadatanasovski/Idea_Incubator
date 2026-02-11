export interface Agent {
  id: string;
  name: string;
  type: string;
  model: string;
  telegram_channel: string | null;
  status: "idle" | "working" | "error" | "stuck" | "stopped";
  current_task_id: string | null;
  current_session_id: string | null;
  last_heartbeat: string | null;
  tasks_completed: number;
  tasks_failed: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  display_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: "pending" | "in_progress" | "completed" | "failed" | "blocked";
  priority: "P0" | "P1" | "P2" | "P3" | "P4";
  assigned_agent_id: string | null;
  task_list_id: string;
  parent_task_id: string | null;
  pass_criteria: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentSession {
  id: string;
  agent_id: string;
  task_id: string | null;
  status: "starting" | "running" | "completed" | "failed" | "terminated";
  started_at: string;
  ended_at: string | null;
  total_iterations: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost: number;
  final_result: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObservabilityEvent {
  id: string;
  type: string;
  message: string;
  agent_id: string | null;
  session_id: string | null;
  task_id: string | null;
  severity: "debug" | "info" | "warning" | "error";
  metadata: string | null;
  created_at: string;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string | null;
  type: string;
  phase: number | null;
  enabled: number;
  created_at: string;
}

export interface TestRun {
  id: string;
  suite_id: string | null;
  status: "running" | "passed" | "failed" | "cancelled";
  started_at: string;
  ended_at: string | null;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  skipped_cases: number;
  triggered_by: string | null;
  created_at: string;
}
