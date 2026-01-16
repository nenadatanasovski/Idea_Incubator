// agents/ux/accessibility-checker.ts - axe-core accessibility checking

import { AccessibilityIssue } from "../../types/ux.js";
import { MCPBridge } from "./mcp-bridge.js";

// axe-core CDN URL
const AXE_CORE_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.3/axe.min.js";

export interface AccessibilityCheckOptions {
  rules?: string[]; // Specific rules to run
  impactThreshold?: "critical" | "serious" | "moderate" | "minor";
}

// Impact levels in order of severity
const IMPACT_ORDER = ["critical", "serious", "moderate", "minor"] as const;

/**
 * Raw axe-core result structure
 */
interface AxeResult {
  violations: AxeViolation[];
  passes: unknown[];
  incomplete: unknown[];
  inapplicable: unknown[];
}

interface AxeViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
}

interface AxeNode {
  target: string[];
  failureSummary: string;
}

/**
 * Check accessibility of current page
 */
export async function checkAccessibility(
  bridge: MCPBridge,
  options: AccessibilityCheckOptions = {},
): Promise<AccessibilityIssue[]> {
  // Inject axe-core if not already present
  await injectAxe(bridge);

  // Run axe analysis
  const results = await runAxe(bridge, options.rules);

  // Parse and filter results
  const issues = parseAxeResults(results);

  // Filter by impact threshold if specified
  if (options.impactThreshold) {
    const thresholdIndex = IMPACT_ORDER.indexOf(options.impactThreshold);
    return issues.filter((issue) => {
      const issueIndex = IMPACT_ORDER.indexOf(issue.impact);
      return issueIndex <= thresholdIndex;
    });
  }

  return issues;
}

/**
 * Inject axe-core script into the page
 */
async function injectAxe(bridge: MCPBridge): Promise<void> {
  // Check if axe is already loaded
  const axeLoaded = await bridge.evaluate<boolean>(
    'typeof axe !== "undefined"',
  );
  if (axeLoaded) {
    return;
  }

  // Load axe-core from CDN
  const injectScript = `
    new Promise((resolve, reject) => {
      if (typeof axe !== 'undefined') {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = '${AXE_CORE_CDN}';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Failed to load axe-core'));
      document.head.appendChild(script);
    })
  `;

  await bridge.evaluate(injectScript);

  // Wait a bit for axe to initialize
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify axe loaded
  const loaded = await bridge.evaluate<boolean>('typeof axe !== "undefined"');
  if (!loaded) {
    throw new Error("Failed to load axe-core");
  }
}

/**
 * Run axe analysis
 */
async function runAxe(bridge: MCPBridge, rules?: string[]): Promise<AxeResult> {
  const runOptions = rules?.length
    ? JSON.stringify({ runOnly: { type: "rule", values: rules } })
    : "{}";

  const script = `
    (async () => {
      const results = await axe.run(document, ${runOptions});
      return JSON.stringify(results);
    })()
  `;

  const resultString = await bridge.evaluate<string>(script);
  return JSON.parse(resultString);
}

/**
 * Parse axe results into our AccessibilityIssue format
 */
function parseAxeResults(results: AxeResult): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (const violation of results.violations) {
    // Create an issue for each affected element
    for (const node of violation.nodes) {
      issues.push({
        ruleId: violation.id,
        impact: violation.impact,
        description: violation.help || violation.description,
        selector: node.target.join(" "),
        helpUrl: violation.helpUrl,
      });
    }
  }

  // Sort by impact (most severe first)
  issues.sort((a, b) => {
    return IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact);
  });

  return issues;
}

/**
 * Get a summary of accessibility issues by impact
 */
export function summarizeIssues(
  issues: AccessibilityIssue[],
): Record<string, number> {
  const summary: Record<string, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };

  for (const issue of issues) {
    summary[issue.impact]++;
  }

  return summary;
}

/**
 * Check if issues meet a threshold (pass/fail)
 */
export function meetsThreshold(
  issues: AccessibilityIssue[],
  maxCritical: number = 0,
  maxSerious: number = 0,
): boolean {
  const summary = summarizeIssues(issues);
  return summary.critical <= maxCritical && summary.serious <= maxSerious;
}
