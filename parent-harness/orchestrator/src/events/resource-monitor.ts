/**
 * Resource Monitor - Backpressure via system resource monitoring
 *
 * Monitors CPU and memory usage, emits events when thresholds crossed.
 * Services subscribe to these events to implement backpressure.
 *
 * This is Phase 5 of the event-driven architecture.
 */

import { bus } from "./bus.js";
import * as os from "os";

interface ResourceThresholds {
  cpuHigh: number; // Pause spawning above this (default: 80%)
  cpuNormal: number; // Resume spawning below this (default: 60%)
  memoryHigh: number; // Pause spawning above this (default: 85%)
  memoryNormal: number; // Resume spawning below this (default: 70%)
}

export interface ResourceState {
  cpuUsage: number;
  memoryUsage: number;
  cpuStatus: "normal" | "high";
  memoryStatus: "normal" | "high";
  loadAverage: number[];
}

class ResourceMonitor {
  private interval: NodeJS.Timeout | null = null;
  private intervalMs = 10000; // Check every 10 seconds
  private thresholds: ResourceThresholds = {
    cpuHigh: 80,
    cpuNormal: 60,
    memoryHigh: 85,
    memoryNormal: 70,
  };
  private state: ResourceState = {
    cpuUsage: 0,
    memoryUsage: 0,
    cpuStatus: "normal",
    memoryStatus: "normal",
    loadAverage: [0, 0, 0],
  };
  private lastCpuInfo: os.CpuInfo[] | null = null;

  /**
   * Start monitoring resources
   */
  start(): void {
    if (this.interval) return;

    console.log("📊 Resource Monitor: Starting");

    // Initial check
    this.check();

    // Periodic checks
    this.interval = setInterval(() => {
      this.check();
    }, this.intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log("📊 Resource Monitor: Stopped");
    }
  }

  /**
   * Perform a resource check
   */
  private check(): void {
    const cpuUsage = this.getCpuUsage();
    const memoryUsage = this.getMemoryUsage();
    const loadAverage = os.loadavg();

    this.state.cpuUsage = cpuUsage;
    this.state.memoryUsage = memoryUsage;
    this.state.loadAverage = loadAverage;

    // Check CPU
    this.checkCpu(cpuUsage);

    // Check memory
    this.checkMemory(memoryUsage);
  }

  /**
   * Calculate CPU usage percentage
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();

    if (!this.lastCpuInfo) {
      this.lastCpuInfo = cpus;
      return 0;
    }

    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i];
      const lastCpu = this.lastCpuInfo[i];

      const idle = cpu.times.idle - lastCpu.times.idle;
      const total =
        cpu.times.user -
        lastCpu.times.user +
        (cpu.times.nice - lastCpu.times.nice) +
        (cpu.times.sys - lastCpu.times.sys) +
        (cpu.times.irq - lastCpu.times.irq) +
        (cpu.times.idle - lastCpu.times.idle);

      totalIdle += idle;
      totalTick += total;
    }

    this.lastCpuInfo = cpus;

    if (totalTick === 0) return 0;
    return Math.round((1 - totalIdle / totalTick) * 100);
  }

  /**
   * Get memory usage percentage
   */
  private getMemoryUsage(): number {
    const total = os.totalmem();
    const free = os.freemem();
    return Math.round((1 - free / total) * 100);
  }

  /**
   * Check CPU and emit events
   */
  private checkCpu(usage: number): void {
    const previousStatus = this.state.cpuStatus;

    if (usage >= this.thresholds.cpuHigh && previousStatus === "normal") {
      // Transition to high
      this.state.cpuStatus = "high";
      console.log(`📊 Resource Monitor: CPU HIGH (${usage}%)`);
      bus.emit("system:cpu_high", {
        usage,
        threshold: this.thresholds.cpuHigh,
      });
    } else if (
      usage <= this.thresholds.cpuNormal &&
      previousStatus === "high"
    ) {
      // Transition to normal
      this.state.cpuStatus = "normal";
      console.log(`📊 Resource Monitor: CPU normal (${usage}%)`);
      bus.emit("system:cpu_normal", { usage });
    }
  }

  /**
   * Check memory and emit events
   */
  private checkMemory(usage: number): void {
    const previousStatus = this.state.memoryStatus;

    if (usage >= this.thresholds.memoryHigh && previousStatus === "normal") {
      // Transition to high
      this.state.memoryStatus = "high";
      console.log(`📊 Resource Monitor: Memory HIGH (${usage}%)`);
      bus.emit("system:memory_high", {
        usage,
        threshold: this.thresholds.memoryHigh,
      });
    } else if (
      usage <= this.thresholds.memoryNormal &&
      previousStatus === "high"
    ) {
      // Transition to normal
      this.state.memoryStatus = "normal";
      console.log(`📊 Resource Monitor: Memory normal (${usage}%)`);
      bus.emit("system:memory_normal", { usage });
    }
  }

  /**
   * Get current resource state
   */
  getState(): ResourceState {
    return { ...this.state };
  }

  /**
   * Update thresholds
   */
  setThresholds(thresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Check if resources are healthy (can spawn)
   */
  isHealthy(): boolean {
    return (
      this.state.cpuStatus === "normal" && this.state.memoryStatus === "normal"
    );
  }

  /**
   * Force a check (for API)
   */
  forceCheck(): ResourceState {
    this.check();
    return this.getState();
  }
}

// Singleton instance
export const resourceMonitor = new ResourceMonitor();

export default resourceMonitor;
