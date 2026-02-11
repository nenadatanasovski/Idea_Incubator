// tests/e2e/test-mon-structure.ts
// Structural validation tests for MON module - verifies exports exist

const results: { test: string; passed: boolean; error?: string }[] = [];

async function validateExports() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        MONITORING MODULE STRUCTURE TESTS                   ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  // Test monitoring-agent.ts exports
  console.log("─────────────────────────────────────────────────────────────");
  console.log("MON-001: Monitoring Agent Exports");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  try {
    const monitoringModule =
      await import("../../server/monitoring/monitoring-agent");

    const hasMonitoringAgent =
      typeof monitoringModule.MonitoringAgent === "function";
    results.push({
      test: "MON-001.1: MonitoringAgent class exported",
      passed: hasMonitoringAgent,
    });
    console.log(
      hasMonitoringAgent
        ? "  ✅ MonitoringAgent class exported"
        : "  ❌ MonitoringAgent class missing",
    );

    // Verify MonitoringAgent has expected methods (by checking prototype)
    const proto = monitoringModule.MonitoringAgent.prototype as any;
    const methods = [
      "start",
      "stop",
      "registerAgent",
      "updateAgentStatus",
      "getAgentState",
      "getSystemMetrics",
      "detectIssue",
    ];
    for (const method of methods) {
      const hasMethod =
        typeof (proto as unknown as Record<string, unknown>)[method] ===
        "function";
      results.push({ test: `MON-001: ${method} method`, passed: hasMethod });
      console.log(
        hasMethod
          ? `  ✅ ${method}() method`
          : `  ❌ ${method}() method missing`,
      );
    }
  } catch (error) {
    results.push({
      test: "MON-001: Import",
      passed: false,
      error: String(error),
    });
    console.log(`  ❌ Import failed: ${error}`);
  }

  // Test hub-integration.ts exports
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-002: Hub Integration Exports");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  try {
    const hubModule = await import("../../server/monitoring/hub-integration");

    const hasIntegrate =
      typeof hubModule.integrateMonitoringWithHub === "function";
    results.push({
      test: "MON-002.1: integrateMonitoringWithHub function",
      passed: hasIntegrate,
    });
    console.log(
      hasIntegrate
        ? "  ✅ integrateMonitoringWithHub function"
        : "  ❌ integrateMonitoringWithHub missing",
    );

    const hasCreate =
      typeof hubModule.createIntegratedMonitoring === "function";
    results.push({
      test: "MON-002.2: createIntegratedMonitoring function",
      passed: hasCreate,
    });
    console.log(
      hasCreate
        ? "  ✅ createIntegratedMonitoring function"
        : "  ❌ createIntegratedMonitoring missing",
    );
  } catch (error) {
    results.push({
      test: "MON-002: Import",
      passed: false,
      error: String(error),
    });
    console.log(`  ❌ Import failed: ${error}`);
  }

  // Test response-escalator.ts exports
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-006: Response Escalator Exports");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  try {
    const escalatorModule =
      await import("../../server/monitoring/response-escalator");

    const hasEscalator =
      typeof escalatorModule.ResponseEscalator === "function";
    results.push({
      test: "MON-006.1: ResponseEscalator class",
      passed: hasEscalator,
    });
    console.log(
      hasEscalator
        ? "  ✅ ResponseEscalator class exported"
        : "  ❌ ResponseEscalator class missing",
    );

    const hasLevel = escalatorModule.ResponseLevel !== undefined;
    results.push({ test: "MON-006.2: ResponseLevel enum", passed: hasLevel });
    console.log(
      hasLevel
        ? "  ✅ ResponseLevel enum exported"
        : "  ❌ ResponseLevel enum missing",
    );

    // Check ResponseLevel values
    if (hasLevel) {
      const levels = ["LOG", "NOTIFY", "ALERT", "ESCALATE", "HALT"];
      for (const level of levels) {
        const hasLevelValue =
          (escalatorModule.ResponseLevel as Record<string, string>)[level] !==
          undefined;
        results.push({
          test: `MON-006: ResponseLevel.${level}`,
          passed: hasLevelValue,
        });
        console.log(
          hasLevelValue
            ? `  ✅ ResponseLevel.${level}`
            : `  ❌ ResponseLevel.${level} missing`,
        );
      }
    }

    // Verify ResponseEscalator methods
    const proto = escalatorModule.ResponseEscalator.prototype as any;
    const methods = [
      "handleIssue",
      "resolveIssue",
      "getActionHistory",
      "getEscalationStates",
      "stopAll",
    ];
    for (const method of methods) {
      const hasMethod =
        typeof (proto as unknown as Record<string, unknown>)[method] ===
        "function";
      results.push({ test: `MON-006: ${method} method`, passed: hasMethod });
      console.log(
        hasMethod
          ? `  ✅ ${method}() method`
          : `  ❌ ${method}() method missing`,
      );
    }
  } catch (error) {
    results.push({
      test: "MON-006: Import",
      passed: false,
      error: String(error),
    });
    console.log(`  ❌ Import failed: ${error}`);
  }

  // Test puppeteer-observer.ts exports
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-003: Puppeteer Observer Exports");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  try {
    const observerModule =
      await import("../../server/monitoring/puppeteer-observer");

    const hasObserver = typeof observerModule.PuppeteerObserver === "function";
    results.push({
      test: "MON-003.1: PuppeteerObserver class",
      passed: hasObserver,
    });
    console.log(
      hasObserver
        ? "  ✅ PuppeteerObserver class exported"
        : "  ❌ PuppeteerObserver class missing",
    );

    // Verify PuppeteerObserver methods
    const proto = observerModule.PuppeteerObserver.prototype;
    const methods = [
      "setMCPTools",
      "start",
      "stop",
      "runRule",
      "runAllRules",
      "getObservations",
      "getLatestObservations",
      "addRule",
      "removeRule",
      "getRules",
      "getStatus",
    ];
    for (const method of methods) {
      const hasMethod =
        typeof (proto as unknown as Record<string, unknown>)[method] ===
        "function";
      results.push({ test: `MON-003: ${method} method`, passed: hasMethod });
      console.log(
        hasMethod
          ? `  ✅ ${method}() method`
          : `  ❌ ${method}() method missing`,
      );
    }
  } catch (error) {
    results.push({
      test: "MON-003: Import",
      passed: false,
      error: String(error),
    });
    console.log(`  ❌ Import failed: ${error}`);
  }

  // Test state-reconciler.ts exports
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-004: State Reconciler Exports");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  try {
    const reconcilerModule =
      await import("../../server/monitoring/state-reconciler");

    const hasReconciler =
      typeof reconcilerModule.StateReconciler === "function";
    results.push({
      test: "MON-004.1: StateReconciler class",
      passed: hasReconciler,
    });
    console.log(
      hasReconciler
        ? "  ✅ StateReconciler class exported"
        : "  ❌ StateReconciler class missing",
    );

    const hasDefaultDomains =
      typeof reconcilerModule.createDefaultDomains === "function";
    results.push({
      test: "MON-004.2: createDefaultDomains function",
      passed: hasDefaultDomains,
    });
    console.log(
      hasDefaultDomains
        ? "  ✅ createDefaultDomains function"
        : "  ❌ createDefaultDomains missing",
    );

    // Verify StateReconciler methods
    const proto = reconcilerModule.StateReconciler.prototype;
    const methods = [
      "registerDomain",
      "unregisterDomain",
      "start",
      "stop",
      "reconcileDomain",
      "reconcileAll",
      "getResults",
      "getLatestResults",
      "getDomains",
      "getStatus",
    ];
    for (const method of methods) {
      const hasMethod =
        typeof (proto as unknown as Record<string, unknown>)[method] ===
        "function";
      results.push({ test: `MON-004: ${method} method`, passed: hasMethod });
      console.log(
        hasMethod
          ? `  ✅ ${method}() method`
          : `  ❌ ${method}() method missing`,
      );
    }
  } catch (error) {
    results.push({
      test: "MON-004: Import",
      passed: false,
      error: String(error),
    });
    console.log(`  ❌ Import failed: ${error}`);
  }

  // Test action-executor.ts exports
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-007: Action Executor Exports");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  try {
    const executorModule =
      await import("../../server/monitoring/action-executor");

    const hasExecutor = typeof executorModule.ActionExecutor === "function";
    results.push({
      test: "MON-007.1: ActionExecutor class",
      passed: hasExecutor,
    });
    console.log(
      hasExecutor
        ? "  ✅ ActionExecutor class exported"
        : "  ❌ ActionExecutor class missing",
    );

    const hasDefaultActions =
      typeof executorModule.createDefaultActions === "function";
    results.push({
      test: "MON-007.2: createDefaultActions function",
      passed: hasDefaultActions,
    });
    console.log(
      hasDefaultActions
        ? "  ✅ createDefaultActions function"
        : "  ❌ createDefaultActions missing",
    );

    // Verify ActionExecutor methods
    const proto = executorModule.ActionExecutor.prototype;
    const methods = [
      "setCommunicationHub",
      "registerAction",
      "unregisterAction",
      "getActions",
      "createObservation",
      "createPlan",
      "requestConfirmation",
      "executePlan",
      "observeConfirmAct",
      "cancelPlan",
      "getPlan",
      "getPlans",
      "getPlansByStatus",
      "getStatus",
      "cleanup",
    ];
    for (const method of methods) {
      const hasMethod =
        typeof (proto as unknown as Record<string, unknown>)[method] ===
        "function";
      results.push({ test: `MON-007: ${method} method`, passed: hasMethod });
      console.log(
        hasMethod
          ? `  ✅ ${method}() method`
          : `  ❌ ${method}() method missing`,
      );
    }
  } catch (error) {
    results.push({
      test: "MON-007: Import",
      passed: false,
      error: String(error),
    });
    console.log(`  ❌ Import failed: ${error}`);
  }

  // Test baseline-learner.ts exports
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-010: Baseline Learner Exports");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  try {
    const learnerModule =
      await import("../../server/monitoring/baseline-learner");

    const hasLearner = typeof learnerModule.BaselineLearner === "function";
    results.push({
      test: "MON-010.1: BaselineLearner class",
      passed: hasLearner,
    });
    console.log(
      hasLearner
        ? "  ✅ BaselineLearner class exported"
        : "  ❌ BaselineLearner class missing",
    );

    const hasMetrics = typeof learnerModule.VIBE_METRICS === "object";
    results.push({
      test: "MON-010.2: VIBE_METRICS constant",
      passed: hasMetrics,
    });
    console.log(
      hasMetrics ? "  ✅ VIBE_METRICS constant" : "  ❌ VIBE_METRICS missing",
    );

    // Verify BaselineLearner methods
    const proto = learnerModule.BaselineLearner.prototype;
    const methods = [
      "start",
      "stop",
      "recordMetric",
      "recordMetrics",
      "getBaseline",
      "getMetricBaselines",
      "getAllBaselines",
      "getAnomalies",
      "getRecentAnomalies",
      "getTrackedMetrics",
      "getDataPoints",
      "clearMetric",
      "clearAll",
      "importData",
      "exportData",
      "getStatus",
    ];
    for (const method of methods) {
      const hasMethod =
        typeof (proto as unknown as Record<string, unknown>)[method] ===
        "function";
      results.push({ test: `MON-010: ${method} method`, passed: hasMethod });
      console.log(
        hasMethod
          ? `  ✅ ${method}() method`
          : `  ❌ ${method}() method missing`,
      );
    }
  } catch (error) {
    results.push({
      test: "MON-010: Import",
      passed: false,
      error: String(error),
    });
    console.log(`  ❌ Import failed: ${error}`);
  }

  // Test index.ts re-exports (only runtime exports, not types)
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("Index Exports (Runtime Only)");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  try {
    const indexModule = await import("../../server/monitoring/index");

    // Only check for runtime exports (classes, functions, enums)
    // Types/interfaces are compile-time only and won't be available at runtime
    const runtimeExports = [
      "MonitoringAgent",
      "integrateMonitoringWithHub",
      "createIntegratedMonitoring",
      "ResponseEscalator",
      "ResponseLevel",
      "PuppeteerObserver",
      "StateReconciler",
      "createDefaultDomains",
      "ActionExecutor",
      "createDefaultActions",
      "BaselineLearner",
      "VIBE_METRICS",
    ];

    for (const exp of runtimeExports) {
      const hasExport =
        (indexModule as Record<string, unknown>)[exp] !== undefined;
      results.push({ test: `Index: ${exp}`, passed: hasExport });
      console.log(hasExport ? `  ✅ ${exp}` : `  ❌ ${exp} missing`);
    }
  } catch (error) {
    results.push({
      test: "Index: Import",
      passed: false,
      error: String(error),
    });
    console.log(`  ❌ Import failed: ${error}`);
  }

  // Summary
  console.log(
    "\n═════════════════════════════════════════════════════════════",
  );
  console.log("                    TEST SUMMARY");
  console.log(
    "═════════════════════════════════════════════════════════════\n",
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`  Total:  ${results.length}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ❌`);

  if (failed > 0) {
    console.log("\n  Failed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    - ${r.test}${r.error ? `: ${r.error}` : ""}`);
    }
    process.exit(1);
  }

  console.log(
    "\n═════════════════════════════════════════════════════════════\n",
  );
  process.exit(0);
}

validateExports().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
