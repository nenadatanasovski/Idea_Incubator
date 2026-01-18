/**
 * URL Utilities for Observability Deep Linking
 *
 * Centralized URL generation and parsing for observability routes.
 * Enables consistent navigation and cross-referencing across the UI.
 */

/**
 * URL path patterns for observability deep linking.
 */
export const OBSERVABILITY_PATHS = {
  // Top-level
  root: "/observability",
  events: "/observability/events",
  executions: "/observability/executions",
  agents: "/observability/agents",
  analytics: "/observability/analytics",

  // Execution-level
  execution: "/observability/executions/:id",

  // Entity-level (within execution)
  task: "/observability/executions/:id/tasks/:taskId",
  tool: "/observability/executions/:id/tools/:toolId",
  assertion: "/observability/executions/:id/assertions/:assertId",
  wave: "/observability/executions/:id/waves/:waveNum",
  skill: "/observability/executions/:id/skills/:skillId",
  transcript: "/observability/executions/:id/transcript/:entryId",

  // Agent-level
  agent: "/observability/agents/:agentId",
} as const;

export type ObservabilityPath = keyof typeof OBSERVABILITY_PATHS;

/**
 * Generate URL for an observability entity.
 */
export function buildObservabilityUrl(
  path: ObservabilityPath,
  params: Record<string, string | number> = {},
  query?: Record<string, string>,
): string {
  let url = OBSERVABILITY_PATHS[path] as string;

  // Replace path parameters
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, String(value));
  }

  // Add query parameters
  if (query && Object.keys(query).length > 0) {
    const searchParams = new URLSearchParams(query);
    url += `?${searchParams.toString()}`;
  }

  return url;
}

/**
 * Parse execution ID from current URL.
 */
export function parseExecutionId(pathname: string): string | null {
  const match = pathname.match(/\/observability\/executions\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * Entity types that can be parsed from URLs.
 */
export type EntityTypeFromUrl =
  | "task"
  | "tool"
  | "assertion"
  | "wave"
  | "skill"
  | "transcript";

/**
 * Parse entity type and ID from URL.
 */
export function parseEntityFromUrl(pathname: string): {
  entityType: EntityTypeFromUrl | null;
  entityId: string | null;
  executionId: string | null;
} {
  const executionId = parseExecutionId(pathname);

  const patterns: Array<{ type: EntityTypeFromUrl; pattern: RegExp }> = [
    { type: "task", pattern: /\/tasks\/([^\/]+)/ },
    { type: "tool", pattern: /\/tools\/([^\/]+)/ },
    { type: "assertion", pattern: /\/assertions\/([^\/]+)/ },
    { type: "wave", pattern: /\/waves\/([^\/]+)/ },
    { type: "skill", pattern: /\/skills\/([^\/]+)/ },
    { type: "transcript", pattern: /\/transcript\/([^\/]+)/ },
  ];

  for (const { type, pattern } of patterns) {
    const match = pathname.match(pattern);
    if (match) {
      return { entityType: type, entityId: match[1], executionId };
    }
  }

  return { entityType: null, entityId: null, executionId };
}

/**
 * Breadcrumb item structure.
 */
export interface BreadcrumbItem {
  label: string;
  path: string;
}

/**
 * Generate breadcrumb items for current path.
 */
export function generateBreadcrumbs(
  pathname: string,
  entityNames?: Record<string, string>,
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Observability", path: OBSERVABILITY_PATHS.root },
  ];

  const executionId = parseExecutionId(pathname);
  if (executionId) {
    breadcrumbs.push({
      label: "Executions",
      path: OBSERVABILITY_PATHS.executions,
    });
    breadcrumbs.push({
      label: entityNames?.execution || executionId.slice(0, 8),
      path: buildObservabilityUrl("execution", { id: executionId }),
    });
  }

  const { entityType, entityId } = parseEntityFromUrl(pathname);
  if (entityType && entityId && executionId) {
    const labelMap: Record<string, string> = {
      task: "Tasks",
      tool: "Tool Uses",
      assertion: "Assertions",
      wave: "Waves",
      skill: "Skills",
      transcript: "Transcript",
    };

    breadcrumbs.push({
      label: labelMap[entityType] || entityType,
      path: buildObservabilityUrl("execution", { id: executionId }),
    });

    const entityLabel = entityNames?.[entityType] || entityId.slice(0, 8);
    breadcrumbs.push({
      label: entityLabel,
      path: pathname,
    });
  }

  return breadcrumbs;
}

/**
 * Check if a path is an observability route.
 */
export function isObservabilityPath(pathname: string): boolean {
  return pathname.startsWith("/observability");
}

/**
 * Get the tab name from an observability path.
 */
export function getObservabilityTab(
  pathname: string,
): "overview" | "events" | "executions" | "agents" | "analytics" | null {
  if (!isObservabilityPath(pathname)) return null;

  if (pathname.includes("/events")) return "events";
  if (pathname.includes("/executions")) return "executions";
  if (pathname.includes("/agents")) return "agents";
  if (pathname.includes("/analytics")) return "analytics";
  if (pathname === "/observability" || pathname === "/observability/")
    return "overview";

  return null;
}
