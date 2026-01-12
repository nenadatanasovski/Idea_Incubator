/**
 * Task Loader Types
 *
 * Types for parsing and loading tasks from tasks.md files.
 */

/**
 * A loaded task from tasks.md
 */
export interface LoadedTask {
  id: string;
  phase: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  file: string;
  status: string;
  requirements: string[];
  gotchas: string[];
  validation: {
    command: string;
    expected: string;
  };
  codeTemplate?: string;
  dependsOn: string[];
}

/**
 * Frontmatter structure from tasks.md
 */
export interface TasksFileFrontmatter {
  id: string;
  complexity: string;
  totalTasks: number;
  phases: Record<string, number>;
}

/**
 * Full tasks file structure
 */
export interface TasksFile {
  frontmatter: TasksFileFrontmatter;
  tasks: LoadedTask[];
}

/**
 * Result of parsing a tasks file
 */
export interface ParseTasksResult {
  success: boolean;
  file?: TasksFile;
  error?: string;
}

/**
 * Task dependency info for ordering
 */
export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
  depth: number;
}

/**
 * Circular dependency error
 */
export interface CircularDependencyError {
  cycle: string[];
  message: string;
}
