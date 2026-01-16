/**
 * Task Test Viewer Component
 *
 * Displays test results for three-level validation system.
 * Part of: Task System V2 Implementation Plan (IMPL-7.8)
 */

import { useState, useEffect } from "react";
import {
  TestTube,
  Check,
  X,
  Clock,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

type TestLevel = "syntax" | "unit" | "e2e";

interface LevelResult {
  level: TestLevel;
  passed: boolean;
  duration: number;
  output?: string;
  errorMessage?: string;
}

interface TaskTestResult {
  id: string;
  taskId: string;
  executionId?: string;
  agentId?: string;
  overallPassed: boolean;
  totalDuration: number;
  levels: LevelResult[];
  runAt: string;
}

interface TaskTestConfig {
  level: TestLevel;
  command: string;
  timeout: number;
  requiredForPass: boolean;
}

interface TaskTestViewerProps {
  taskId: string;
  onRunTests?: () => void;
}

const levelConfig: Record<
  TestLevel,
  { color: string; bgColor: string; label: string; description: string }
> = {
  syntax: {
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    label: "Syntax",
    description: "TypeScript compilation and linting",
  },
  unit: {
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    label: "Unit",
    description: "Unit tests for the task",
  },
  e2e: {
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "E2E",
    description: "End-to-end integration tests",
  },
};

export default function TaskTestViewer({
  taskId,
  onRunTests,
}: TaskTestViewerProps) {
  const [results, setResults] = useState<TaskTestResult | null>(null);
  const [configs, setConfigs] = useState<TaskTestConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<Set<TestLevel>>(
    new Set(),
  );

  useEffect(() => {
    fetchData();
  }, [taskId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resultsRes, configsRes] = await Promise.all([
        fetch(`/api/task-agent/tasks/${taskId}/tests/results/latest`),
        fetch(`/api/task-agent/tasks/${taskId}/tests/config`),
      ]);

      if (resultsRes.ok) {
        setResults(await resultsRes.json());
      }
      if (configsRes.ok) {
        setConfigs(await configsRes.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runTests = async (levels?: TestLevel[]) => {
    try {
      setRunning(true);
      setError(null);
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/tests/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ levels }),
        },
      );

      if (!response.ok) throw new Error("Failed to run tests");

      const result = await response.json();
      setResults(result);
      onRunTests?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  };

  const toggleLevel = (level: TestLevel) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(level)) {
      newExpanded.delete(level);
    } else {
      newExpanded.add(level);
    }
    setExpandedLevels(newExpanded);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TestTube className="h-5 w-5 text-gray-400" />
          <h3 className="font-medium">Test Results</h3>
          {results && (
            <span
              className={`
              px-2 py-0.5 rounded-full text-xs font-medium
              ${results.overallPassed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
            `}
            >
              {results.overallPassed ? "Passed" : "Failed"}
            </span>
          )}
        </div>
        <button
          onClick={() => runTests()}
          disabled={running}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running ? "Running..." : "Run All Tests"}
        </button>
      </div>

      {/* Summary Stats */}
      {results && (
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {results.levels.filter((l) => l.passed).length}/
              {results.levels.length}
            </div>
            <div className="text-xs text-gray-500">Levels Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {(results.totalDuration / 1000).toFixed(1)}s
            </div>
            <div className="text-xs text-gray-500">Total Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {new Date(results.runAt).toLocaleTimeString()}
            </div>
            <div className="text-xs text-gray-500">Last Run</div>
          </div>
        </div>
      )}

      {/* Test Levels */}
      <div className="space-y-2">
        {(["syntax", "unit", "e2e"] as TestLevel[]).map((level) => {
          const config = levelConfig[level];
          const result = results?.levels.find((l) => l.level === level);
          const testConfig = configs.find((c) => c.level === level);
          const isExpanded = expandedLevels.has(level);

          return (
            <div
              key={level}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 hover:bg-gray-50">
                <button
                  onClick={() => toggleLevel(level)}
                  className="flex items-center gap-3 flex-1"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
                  >
                    {config.label}
                  </span>
                  <span className="text-sm text-gray-600">
                    {config.description}
                  </span>
                </button>

                <div className="flex items-center gap-3">
                  {result ? (
                    <>
                      {result.passed ? (
                        <Check className="h-5 w-5 text-green-600" />
                      ) : (
                        <X className="h-5 w-5 text-red-600" />
                      )}
                      <span className="text-sm text-gray-500">
                        {(result.duration / 1000).toFixed(1)}s
                      </span>
                    </>
                  ) : (
                    <Clock className="h-5 w-5 text-gray-300" />
                  )}
                  <button
                    onClick={() => runTests([level])}
                    disabled={running}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Run
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-3 bg-gray-50">
                  {testConfig && (
                    <div className="mb-3 text-sm">
                      <span className="text-gray-500">Command:</span>
                      <code className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {testConfig.command}
                      </code>
                    </div>
                  )}

                  {result?.output && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Output:
                      </div>
                      <pre className="p-2 bg-white border rounded text-xs overflow-x-auto max-h-40">
                        {result.output}
                      </pre>
                    </div>
                  )}

                  {result?.errorMessage && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      {result.errorMessage}
                    </div>
                  )}

                  {!result && (
                    <div className="text-sm text-gray-500">
                      No results yet. Run tests to see output.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}
