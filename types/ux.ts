// types/ux.ts - UX Agent type definitions

export type JourneyStepAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'wait'
  | 'screenshot'
  | 'assert'
  | 'select';

export interface JourneyStep {
  action: JourneyStepAction;
  target?: string;      // CSS selector or URL
  value?: string;       // Text to type or expected value
  timeout?: number;     // Step timeout in ms
  description?: string; // Human-readable description
}

export interface Journey {
  id: string;
  name: string;
  description: string;
  startUrl: string;
  steps: JourneyStep[];
  timeout?: number;     // Journey timeout in ms (default 60000)
  tags?: string[];
}

export interface StepResult {
  stepIndex: number;
  action: JourneyStepAction;
  target?: string;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  screenshotPath?: string;
  durationMs: number;
}

export interface AccessibilityIssue {
  ruleId: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  selector: string;
  helpUrl: string;
}

export interface UXRunResult {
  id: string;
  journeyId: string;
  status: 'completed' | 'failed' | 'timeout';
  passed: boolean;
  steps: StepResult[];
  accessibilityIssues: AccessibilityIssue[];
  screenshots: string[];
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

export interface UXRunRequest {
  journeyId: string;
  buildId?: string;
  options?: {
    screenshotOnFailure?: boolean;
    runAccessibility?: boolean;
    timeout?: number;
  };
}

// Database row types
export interface UXRun {
  id: string;
  buildId: string | null;
  journeyId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  passed: number;
  summaryJson: string;
}

export interface UXStepResult {
  id: string;
  runId: string;
  stepIndex: number;
  action: string;
  target: string | null;
  status: string;
  passed: number;
  error: string | null;
  screenshotPath: string | null;
  durationMs: number;
  createdAt: string;
}

export interface UXAccessibilityIssue {
  id: string;
  runId: string;
  ruleId: string;
  impact: string;
  description: string;
  selector: string;
  helpUrl: string;
  createdAt: string;
}

// MCP Tool types (for bridge)
export interface MCPTools {
  navigate: (params: { url: string }) => Promise<unknown>;
  click: (params: { selector: string }) => Promise<unknown>;
  fill: (params: { selector: string; value: string }) => Promise<unknown>;
  select: (params: { selector: string; value: string }) => Promise<unknown>;
  screenshot: (params: { name: string }) => Promise<unknown>;
  evaluate: (params: { script: string }) => Promise<unknown>;
  hover: (params: { selector: string }) => Promise<unknown>;
}
