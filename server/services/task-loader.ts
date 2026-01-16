/**
 * Task Loader Service
 *
 * Parses task lists from markdown files in various formats:
 * - Table format: | ID | Task | Pri | Status |
 * - Checkbox format: - [ ] Task description
 */

import * as fs from "fs";
import * as path from "path";

export interface ParsedTask {
  id: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status: "pending" | "in_progress" | "complete";
  section: string;
  subsection?: string;
  lineNumber: number;
  dependencies?: string[]; // Task IDs that must complete before this task
}

export interface TaskList {
  filePath: string;
  fileName: string;
  title: string;
  description?: string;
  sections: TaskSection[];
  tasks: ParsedTask[];
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    complete: number;
    byPriority: Record<string, number>;
  };
  lastModified: string;
}

export interface TaskSection {
  name: string;
  description?: string;
  tasks: ParsedTask[];
}

// Patterns for parsing
const TABLE_ROW_PATTERN =
  /^\|\s*([A-Z]+-\d+)\s*\|\s*(.+?)\s*\|\s*(P[1-4])\s*\|\s*\[([x~\s])\]\s*\|/;
const CHECKBOX_PATTERN = /^[-*]\s*\[([x~\s])\]\s*(.+)$/;
const SECTION_PATTERN = /^##\s+(\d+\.?\s*)?(.+)$/;
const SUBSECTION_PATTERN = /^###\s+(.+)$/;
const TITLE_PATTERN = /^#\s+(.+)$/;

/**
 * Parse status character to status string
 */
function parseStatus(char: string): "pending" | "in_progress" | "complete" {
  switch (char.toLowerCase()) {
    case "x":
      return "complete";
    case "~":
      return "in_progress";
    default:
      return "pending";
  }
}

/**
 * Generate a task ID from description if not present
 */
function generateId(description: string, index: number): string {
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return `TASK-${index.toString().padStart(3, "0")}-${slug}`;
}

/**
 * Parse a markdown task list file
 */
export function parseTaskList(filePath: string): TaskList {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const stats = fs.statSync(filePath);

  let title = path.basename(filePath, ".md");
  let description: string | undefined;
  let currentSection = "General";
  let currentSubsection: string | undefined;
  const tasks: ParsedTask[] = [];
  const sections: TaskSection[] = [];
  const sectionMap = new Map<string, TaskSection>();
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Match title
    const titleMatch = line.match(TITLE_PATTERN);
    if (titleMatch) {
      title = titleMatch[1].trim();
      // Look for description in next line(s)
      if (i + 1 < lines.length && lines[i + 1].startsWith(">")) {
        description = lines[i + 1].replace(/^>\s*/, "").trim();
      }
      continue;
    }

    // Match section
    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      currentSection = sectionMatch[2].trim();
      currentSubsection = undefined;
      if (!sectionMap.has(currentSection)) {
        const section: TaskSection = { name: currentSection, tasks: [] };
        sectionMap.set(currentSection, section);
        sections.push(section);
      }
      continue;
    }

    // Match subsection
    const subsectionMatch = line.match(SUBSECTION_PATTERN);
    if (subsectionMatch) {
      currentSubsection = subsectionMatch[1].trim();
      continue;
    }

    // Match table row with task
    const tableMatch = line.match(TABLE_ROW_PATTERN);
    if (tableMatch) {
      const task: ParsedTask = {
        id: tableMatch[1],
        description: tableMatch[2].trim(),
        priority: tableMatch[3] as "P1" | "P2" | "P3" | "P4",
        status: parseStatus(tableMatch[4]),
        section: currentSection,
        subsection: currentSubsection,
        lineNumber,
      };
      tasks.push(task);
      sectionMap.get(currentSection)?.tasks.push(task);
      taskIndex++;
      continue;
    }

    // Match checkbox task
    const checkboxMatch = line.match(CHECKBOX_PATTERN);
    if (checkboxMatch) {
      const task: ParsedTask = {
        id: generateId(checkboxMatch[2], taskIndex),
        description: checkboxMatch[2].trim(),
        priority: "P2", // Default priority for checkbox tasks
        status: parseStatus(checkboxMatch[1]),
        section: currentSection,
        subsection: currentSubsection,
        lineNumber,
      };
      tasks.push(task);
      sectionMap.get(currentSection)?.tasks.push(task);
      taskIndex++;
    }
  }

  // Calculate summary
  const summary = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    complete: tasks.filter((t) => t.status === "complete").length,
    byPriority: {
      P1: tasks.filter((t) => t.priority === "P1").length,
      P2: tasks.filter((t) => t.priority === "P2").length,
      P3: tasks.filter((t) => t.priority === "P3").length,
      P4: tasks.filter((t) => t.priority === "P4").length,
    },
  };

  return {
    filePath,
    fileName: path.basename(filePath),
    title,
    description,
    sections,
    tasks,
    summary,
    lastModified: stats.mtime.toISOString(),
  };
}

/**
 * Find all task list files in the project
 */
export function findTaskLists(basePath: string): string[] {
  const taskLists: string[] = [];

  // Scan docs/bootstrap folder for any markdown files with task tables
  const docsBootstrapPath = path.join(basePath, "docs/bootstrap");
  if (fs.existsSync(docsBootstrapPath)) {
    scanForTaskListsByContent(docsBootstrapPath, taskLists);
  }

  // Check specific known paths
  const knownPaths = [path.join(basePath, "coding-loops/TASKS.md")];

  for (const p of knownPaths) {
    if (fs.existsSync(p) && !taskLists.includes(p)) {
      taskLists.push(p);
    }
  }

  // Scan for other task lists in ideas folder
  const ideasPath = path.join(basePath, "ideas");
  if (fs.existsSync(ideasPath)) {
    scanForTaskLists(ideasPath, taskLists);
  }

  // Scan for task lists in users folder
  const usersPath = path.join(basePath, "users");
  if (fs.existsSync(usersPath)) {
    scanForTaskLists(usersPath, taskLists);
  }

  return [...new Set(taskLists)]; // Remove duplicates
}

/**
 * Scan directory for markdown files that contain task tables
 */
function scanForTaskListsByContent(dir: string, results: string[]): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith(".md")) {
        // Check if file contains task table format
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          // Look for task table pattern: | ID | Task | Pri | Status |
          if (
            content.match(
              /\|\s*[A-Z]+-\d+\s*\|.*\|\s*P[1-4]\s*\|\s*\[[x~\s]\]\s*\|/,
            )
          ) {
            results.push(fullPath);
          }
        } catch (e) {
          // Ignore read errors
        }
      }
    }
  } catch (e) {
    // Ignore permission errors
  }
}

function scanForTaskLists(dir: string, results: string[], depth = 0): void {
  if (depth > 5) return; // Max depth to prevent infinite loops

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        scanForTaskLists(fullPath, results, depth + 1);
      } else if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase();
        if (lowerName === "tasks.md" || lowerName === "task-list.md") {
          results.push(fullPath);
        }
      }
    }
  } catch (e) {
    // Ignore permission errors
  }
}

/**
 * Update a task's status in the markdown file
 */
export function updateTaskStatus(
  filePath: string,
  taskId: string,
  newStatus: "pending" | "in_progress" | "complete",
): boolean {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let modified = false;

  const statusChar =
    newStatus === "complete" ? "x" : newStatus === "in_progress" ? "~" : " ";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for table row with this task ID
    if (line.includes(taskId)) {
      const tableMatch = line.match(TABLE_ROW_PATTERN);
      if (tableMatch && tableMatch[1] === taskId) {
        // Replace status in table row
        lines[i] = line.replace(/\|\s*\[[x~\s]\]\s*\|/, `| [${statusChar}] |`);
        modified = true;
        break;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  }

  return modified;
}

/**
 * Add a new task to a task list file
 */
export function addTask(
  filePath: string,
  sectionName: string,
  task: {
    id: string;
    description: string;
    priority: "P1" | "P2" | "P3" | "P4";
  },
): boolean {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Find the section
  let sectionIndex = -1;
  let tableEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const sectionMatch = lines[i].match(SECTION_PATTERN);
    if (
      sectionMatch &&
      sectionMatch[2].trim().toLowerCase().includes(sectionName.toLowerCase())
    ) {
      sectionIndex = i;
      // Find the end of the table in this section
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith("|") && lines[j].includes("|")) {
          tableEndIndex = j;
        } else if (lines[j].match(SECTION_PATTERN)) {
          break; // Next section
        }
      }
      break;
    }
  }

  if (tableEndIndex === -1) {
    return false;
  }

  // Insert new row after the last table row
  const newRow = `| ${task.id} | ${task.description} | ${task.priority} | [ ] |`;
  lines.splice(tableEndIndex + 1, 0, newRow);

  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return true;
}

/**
 * Get next pending task for a given priority level
 */
export function getNextPendingTask(
  taskList: TaskList,
  minPriority?: "P1" | "P2" | "P3" | "P4",
): ParsedTask | null {
  const priorityOrder = ["P1", "P2", "P3", "P4"];
  const maxIndex = minPriority ? priorityOrder.indexOf(minPriority) : 3;

  for (const priority of priorityOrder.slice(0, maxIndex + 1)) {
    const task = taskList.tasks.find(
      (t) => t.status === "pending" && t.priority === priority,
    );
    if (task) return task;
  }

  return null;
}

/**
 * Get tasks by section
 */
export function getTasksBySection(
  taskList: TaskList,
  sectionName: string,
): ParsedTask[] {
  return taskList.tasks.filter((t) =>
    t.section.toLowerCase().includes(sectionName.toLowerCase()),
  );
}

/**
 * Get summary for all task lists
 */
export function getTaskListsSummary(basePath: string): Array<{
  filePath: string;
  fileName: string;
  title: string;
  total: number;
  pending: number;
  inProgress: number;
  complete: number;
  percentComplete: number;
  lastModified: string;
}> {
  const files = findTaskLists(basePath);
  const summaries = files.map((file) => {
    const taskList = parseTaskList(file);
    return {
      filePath: taskList.filePath,
      fileName: taskList.fileName,
      title: taskList.title,
      total: taskList.summary.total,
      pending: taskList.summary.pending,
      inProgress: taskList.summary.inProgress,
      complete: taskList.summary.complete,
      percentComplete:
        taskList.summary.total > 0
          ? Math.round(
              (taskList.summary.complete / taskList.summary.total) * 100,
            )
          : 0,
      lastModified: taskList.lastModified,
    };
  });

  // Sort by lastModified date, newest first
  return summaries.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  );
}
