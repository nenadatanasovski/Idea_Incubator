// server/monitoring/index.ts
// Monitoring module exports

export { MonitoringAgent } from "./monitoring-agent";
export type {
  MonitoringLevel,
  AgentState,
  SystemMetrics,
  DetectedIssue,
  MonitoringConfig,
} from "./monitoring-agent";

export {
  integrateMonitoringWithHub,
  createIntegratedMonitoring,
} from "./hub-integration";

export { ResponseEscalator, ResponseLevel } from "./response-escalator";
export type { ResponseAction, EscalationRule } from "./response-escalator";

export { PuppeteerObserver } from "./puppeteer-observer";
export type {
  UIElement,
  UIValidationRule,
  UIObservation,
  PuppeteerObserverConfig,
} from "./puppeteer-observer";

export { StateReconciler, createDefaultDomains } from "./state-reconciler";
export type {
  StateSource,
  FieldComparison,
  ReconciliationResult,
  ReconciliationDomain,
  StateReconcilerConfig,
} from "./state-reconciler";

export { ActionExecutor, createDefaultActions } from "./action-executor";
export type {
  Action,
  ActionResult,
  Observation,
  ExecutionPlan,
  ActionExecutorConfig,
} from "./action-executor";

export { BaselineLearner, VIBE_METRICS } from "./baseline-learner";
export type {
  MetricDataPoint,
  MetricBaseline,
  BaselineAnomaly,
  TimeWindow,
  BaselineLearnerConfig,
} from "./baseline-learner";
