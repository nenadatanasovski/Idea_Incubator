// server/monitoring/baseline-learner.ts
// MON-010: Historical Baseline Learning - Learn patterns from historical data

import { EventEmitter } from "events";

/**
 * A metric data point for baseline calculation.
 */
export interface MetricDataPoint {
  timestamp: Date;
  metric: string;
  value: number;
  tags?: Record<string, string>;
}

/**
 * Statistical baseline for a metric.
 */
export interface MetricBaseline {
  metric: string;
  sampleCount: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  lastUpdated: Date;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Anomaly detected based on baseline deviation.
 */
export interface BaselineAnomaly {
  id: string;
  timestamp: Date;
  metric: string;
  value: number;
  baseline: MetricBaseline;
  deviationType: "high" | "low" | "spike" | "drop";
  deviationScore: number; // Number of standard deviations
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Time window for baseline calculation.
 */
export interface TimeWindow {
  duration: number; // ms
  name: string;
}

/**
 * Configuration for Baseline Learner.
 */
export interface BaselineLearnerConfig {
  windows: TimeWindow[];
  minSamplesForBaseline: number;
  anomalyThresholds: {
    low: number; // Standard deviations
    medium: number;
    high: number;
    critical: number;
  };
  maxDataPoints: number;
  updateInterval: number; // ms
}

const DEFAULT_CONFIG: BaselineLearnerConfig = {
  windows: [
    { duration: 5 * 60 * 1000, name: "5min" }, // 5 minutes
    { duration: 60 * 60 * 1000, name: "1hour" }, // 1 hour
    { duration: 24 * 60 * 60 * 1000, name: "1day" }, // 1 day
  ],
  minSamplesForBaseline: 10,
  anomalyThresholds: {
    low: 2, // 2 standard deviations
    medium: 3, // 3 standard deviations
    high: 4, // 4 standard deviations
    critical: 5, // 5 standard deviations
  },
  maxDataPoints: 10000,
  updateInterval: 60000, // Update baselines every minute
};

/**
 * Baseline Learner - Learns normal patterns from historical data.
 *
 * Features:
 * 1. Collects metric data points over time
 * 2. Calculates statistical baselines (mean, stddev, percentiles)
 * 3. Detects anomalies when values deviate from baselines
 * 4. Supports multiple time windows (5min, 1hour, 1day)
 * 5. Continuously updates baselines as new data arrives
 *
 * This enables the Monitoring Agent to distinguish between
 * normal variations and actual problems.
 */
export class BaselineLearner extends EventEmitter {
  private config: BaselineLearnerConfig;
  private dataPoints: Map<string, MetricDataPoint[]> = new Map();
  private baselines: Map<string, Map<string, MetricBaseline>> = new Map(); // metric -> window -> baseline
  private anomalies: BaselineAnomaly[] = [];
  private updateTimer?: ReturnType<typeof setInterval>;
  private running: boolean = false;

  constructor(config: Partial<BaselineLearnerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the baseline learner.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    console.log("[BaselineLearner] Starting baseline learning...");

    // Set up periodic baseline updates
    this.updateTimer = setInterval(() => {
      this.updateAllBaselines();
    }, this.config.updateInterval);

    // Initial baseline calculation
    this.updateAllBaselines();

    console.log(
      `[BaselineLearner] Started with ${this.config.windows.length} time windows`,
    );
  }

  /**
   * Stop the baseline learner.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }

    console.log("[BaselineLearner] Stopped");
  }

  /**
   * Record a metric data point.
   */
  recordMetric(
    metric: string,
    value: number,
    tags?: Record<string, string>,
  ): void {
    const dataPoint: MetricDataPoint = {
      timestamp: new Date(),
      metric,
      value,
      tags,
    };

    // Get or create data points array for this metric
    if (!this.dataPoints.has(metric)) {
      this.dataPoints.set(metric, []);
    }

    const points = this.dataPoints.get(metric)!;
    points.push(dataPoint);

    // Trim old data points
    if (points.length > this.config.maxDataPoints) {
      points.splice(0, points.length - this.config.maxDataPoints);
    }

    // Check for anomalies against existing baselines
    this.checkForAnomalies(dataPoint);

    this.emit("metric:recorded", dataPoint);
  }

  /**
   * Record multiple metrics at once.
   */
  recordMetrics(
    metrics: Array<{
      metric: string;
      value: number;
      tags?: Record<string, string>;
    }>,
  ): void {
    for (const m of metrics) {
      this.recordMetric(m.metric, m.value, m.tags);
    }
  }

  /**
   * Update baselines for all metrics across all time windows.
   */
  private updateAllBaselines(): void {
    const now = Date.now();

    for (const [metric, points] of this.dataPoints) {
      for (const window of this.config.windows) {
        const windowStart = new Date(now - window.duration);
        const windowPoints = points.filter((p) => p.timestamp >= windowStart);

        if (windowPoints.length >= this.config.minSamplesForBaseline) {
          const baseline = this.calculateBaseline(
            metric,
            windowPoints,
            window,
            windowStart,
          );
          this.storeBaseline(metric, window.name, baseline);
        }
      }
    }

    this.emit("baselines:updated", this.getAllBaselines());
  }

  /**
   * Calculate baseline statistics from data points.
   */
  private calculateBaseline(
    metric: string,
    points: MetricDataPoint[],
    _window: TimeWindow,
    windowStart: Date,
  ): MetricBaseline {
    const values = points.map((p) => p.value).sort((a, b) => a - b);
    const n = values.length;

    // Calculate mean
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    // Calculate standard deviation
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Calculate percentiles
    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * n) - 1;
      return values[Math.max(0, Math.min(index, n - 1))];
    };

    return {
      metric,
      sampleCount: n,
      mean,
      stdDev,
      min: values[0],
      max: values[n - 1],
      percentiles: {
        p50: percentile(50),
        p90: percentile(90),
        p95: percentile(95),
        p99: percentile(99),
      },
      lastUpdated: new Date(),
      windowStart,
      windowEnd: new Date(),
    };
  }

  /**
   * Store a baseline.
   */
  private storeBaseline(
    metric: string,
    windowName: string,
    baseline: MetricBaseline,
  ): void {
    if (!this.baselines.has(metric)) {
      this.baselines.set(metric, new Map());
    }
    this.baselines.get(metric)!.set(windowName, baseline);
  }

  /**
   * Check if a data point is an anomaly.
   */
  private checkForAnomalies(dataPoint: MetricDataPoint): void {
    const metricBaselines = this.baselines.get(dataPoint.metric);
    if (!metricBaselines) return;

    // Check against the shortest window baseline (most sensitive)
    const shortestWindow = this.config.windows[0];
    const baseline = metricBaselines.get(shortestWindow.name);
    if (!baseline || baseline.stdDev === 0) return;

    // Calculate deviation score (z-score)
    const deviationScore =
      Math.abs(dataPoint.value - baseline.mean) / baseline.stdDev;

    // Determine severity
    let severity: BaselineAnomaly["severity"] | null = null;
    if (deviationScore >= this.config.anomalyThresholds.critical) {
      severity = "critical";
    } else if (deviationScore >= this.config.anomalyThresholds.high) {
      severity = "high";
    } else if (deviationScore >= this.config.anomalyThresholds.medium) {
      severity = "medium";
    } else if (deviationScore >= this.config.anomalyThresholds.low) {
      severity = "low";
    }

    if (severity) {
      // Determine deviation type
      let deviationType: BaselineAnomaly["deviationType"];
      const isHigh = dataPoint.value > baseline.mean;

      // Check if it's a sudden change (spike/drop) vs sustained deviation
      const recentPoints = this.getRecentPoints(dataPoint.metric, 5);
      const isSudden =
        recentPoints.length < 3 ||
        Math.abs(
          dataPoint.value - recentPoints[recentPoints.length - 2]?.value || 0,
        ) >
          baseline.stdDev * 2;

      if (isHigh) {
        deviationType = isSudden ? "spike" : "high";
      } else {
        deviationType = isSudden ? "drop" : "low";
      }

      const anomaly: BaselineAnomaly = {
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: dataPoint.timestamp,
        metric: dataPoint.metric,
        value: dataPoint.value,
        baseline,
        deviationType,
        deviationScore,
        severity,
      };

      this.addAnomaly(anomaly);
      this.emit("anomaly:detected", anomaly);

      // Emit issue for high severity anomalies
      if (severity === "high" || severity === "critical") {
        this.emit("issue:detected", {
          type: "baseline_anomaly",
          severity,
          description: `${deviationType === "spike" ? "Spike" : deviationType === "drop" ? "Drop" : "Anomaly"} detected in ${dataPoint.metric}: ${dataPoint.value.toFixed(2)} (${deviationScore.toFixed(1)}σ from baseline)`,
          evidence: anomaly,
        });
      }
    }
  }

  /**
   * Get recent data points for a metric.
   */
  private getRecentPoints(metric: string, count: number): MetricDataPoint[] {
    const points = this.dataPoints.get(metric) || [];
    return points.slice(-count);
  }

  /**
   * Add an anomaly to history.
   */
  private addAnomaly(anomaly: BaselineAnomaly): void {
    this.anomalies.push(anomaly);

    // Keep last 1000 anomalies
    if (this.anomalies.length > 1000) {
      this.anomalies = this.anomalies.slice(-1000);
    }
  }

  /**
   * Get baseline for a specific metric and window.
   */
  getBaseline(metric: string, windowName?: string): MetricBaseline | undefined {
    const metricBaselines = this.baselines.get(metric);
    if (!metricBaselines) return undefined;

    if (windowName) {
      return metricBaselines.get(windowName);
    }

    // Return shortest window baseline by default
    return metricBaselines.get(this.config.windows[0].name);
  }

  /**
   * Get all baselines for a metric.
   */
  getMetricBaselines(metric: string): Map<string, MetricBaseline> | undefined {
    return this.baselines.get(metric);
  }

  /**
   * Get all baselines.
   */
  getAllBaselines(): Map<string, Map<string, MetricBaseline>> {
    return new Map(this.baselines);
  }

  /**
   * Get anomaly history.
   */
  getAnomalies(
    metric?: string,
    severity?: BaselineAnomaly["severity"],
  ): BaselineAnomaly[] {
    let result = [...this.anomalies];

    if (metric) {
      result = result.filter((a) => a.metric === metric);
    }

    if (severity) {
      result = result.filter((a) => a.severity === severity);
    }

    return result;
  }

  /**
   * Get recent anomalies.
   */
  getRecentAnomalies(windowMs: number = 5 * 60 * 1000): BaselineAnomaly[] {
    const cutoff = new Date(Date.now() - windowMs);
    return this.anomalies.filter((a) => a.timestamp >= cutoff);
  }

  /**
   * Get tracked metrics.
   */
  getTrackedMetrics(): string[] {
    return [...this.dataPoints.keys()];
  }

  /**
   * Get data points for a metric.
   */
  getDataPoints(metric: string, limit?: number): MetricDataPoint[] {
    const points = this.dataPoints.get(metric) || [];
    if (limit) {
      return points.slice(-limit);
    }
    return [...points];
  }

  /**
   * Clear data for a metric.
   */
  clearMetric(metric: string): void {
    this.dataPoints.delete(metric);
    this.baselines.delete(metric);
  }

  /**
   * Clear all data.
   */
  clearAll(): void {
    this.dataPoints.clear();
    this.baselines.clear();
    this.anomalies = [];
  }

  /**
   * Import historical data.
   */
  importData(data: MetricDataPoint[]): void {
    for (const point of data) {
      if (!this.dataPoints.has(point.metric)) {
        this.dataPoints.set(point.metric, []);
      }
      this.dataPoints.get(point.metric)!.push(point);
    }

    // Sort by timestamp
    for (const points of this.dataPoints.values()) {
      points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    // Update baselines
    this.updateAllBaselines();
  }

  /**
   * Export current data.
   */
  exportData(): MetricDataPoint[] {
    const allPoints: MetricDataPoint[] = [];
    for (const points of this.dataPoints.values()) {
      allPoints.push(...points);
    }
    return allPoints.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  /**
   * Get status.
   */
  getStatus(): {
    running: boolean;
    trackedMetrics: number;
    totalDataPoints: number;
    baselinesComputed: number;
    recentAnomalies: number;
  } {
    let totalDataPoints = 0;
    for (const points of this.dataPoints.values()) {
      totalDataPoints += points.length;
    }

    let baselinesComputed = 0;
    for (const metricBaselines of this.baselines.values()) {
      baselinesComputed += metricBaselines.size;
    }

    return {
      running: this.running,
      trackedMetrics: this.dataPoints.size,
      totalDataPoints,
      baselinesComputed,
      recentAnomalies: this.getRecentAnomalies().length,
    };
  }
}

/**
 * Predefined metrics for Vibe platform monitoring.
 */
export const VIBE_METRICS = {
  // Agent metrics
  AGENT_RESPONSE_TIME: "agent.response_time",
  AGENT_TASK_DURATION: "agent.task_duration",
  AGENT_ERROR_RATE: "agent.error_rate",
  AGENT_QUEUE_SIZE: "agent.queue_size",

  // Session metrics
  SESSION_DURATION: "session.duration",
  SESSION_MESSAGE_COUNT: "session.message_count",
  SESSION_CONFIDENCE: "session.confidence",

  // System metrics
  SYSTEM_CPU: "system.cpu",
  SYSTEM_MEMORY: "system.memory",
  SYSTEM_EVENT_RATE: "system.event_rate",

  // API metrics
  API_LATENCY: "api.latency",
  API_ERROR_RATE: "api.error_rate",
  API_REQUEST_RATE: "api.request_rate",
};
