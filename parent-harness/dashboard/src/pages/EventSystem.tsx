import { useState, useEffect, useCallback } from "react";
import { Layout } from "../components/Layout";

const API_BASE = "http://localhost:3333/api";

interface ComponentMetrics {
  [key: string]: string | number | boolean | number[] | undefined;
}

interface EventEntry {
  id: number;
  type: string;
  summary: string;
  timestamp: string;
}

interface ScannerInfo {
  name: string;
  description: string;
  enabled: boolean;
  intervalMs: number;
  lastRun: string | null;
  emitsEvent: string;
}

interface ComponentData {
  name: string;
  emoji: string;
  description: string;
  status: string;
  metrics?: ComponentMetrics;
  eventCounts?: Record<string, number>;
  listenerCounts?: Record<string, number>;
  transitions?: Record<string, string[]>;
  subscribedEvents?: string[];
  emitsEvents?: string[];
  scannerList?: ScannerInfo[];
  thresholds?: Record<string, number>;
  recentEvents?: EventEntry[];
}

interface ComponentsResponse {
  timestamp: string;
  components: {
    eventBus: ComponentData;
    taskStateMachine: ComponentData;
    qaService: ComponentData;
    spawnService: ComponentData;
    resourceMonitor: ComponentData;
    scanners: ComponentData;
    stuckAgentHandler: ComponentData;
  };
}

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  healthy: "bg-green-500",
  ready: "bg-green-500",
  idle: "bg-blue-500",
  processing: "bg-yellow-500",
  spawning: "bg-yellow-500",
  paused: "bg-orange-500",
  warning: "bg-orange-500",
  disabled: "bg-red-500",
  error: "bg-red-500",
};

const statusBorders: Record<string, string> = {
  active: "border-green-500",
  healthy: "border-green-500",
  ready: "border-green-500",
  idle: "border-blue-500",
  processing: "border-yellow-500",
  spawning: "border-yellow-500",
  paused: "border-orange-500",
  warning: "border-orange-500",
  disabled: "border-red-500",
  error: "border-red-500",
};

export function EventSystem() {
  const [data, setData] = useState<ComponentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(
    null,
  );
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/event-bus/components`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 2000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const formatTime = (timestamp: string) => {
    if (!timestamp) return "-";
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-AU", { hour12: false });
  };

  const formatInterval = (ms: number) => {
    if (ms >= 3600000) return `${Math.round(ms / 3600000)}h`;
    if (ms >= 60000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 1000)}s`;
  };

  if (error) {
    return (
      <Layout>
        <div className="p-4">
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            <h2 className="text-red-400 font-bold">
              Error Loading Event System
            </h2>
            <p className="text-red-300">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 h-[calc(100vh-4rem)] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">⚡ Event-Driven Architecture</h1>
            <p className="text-gray-400 text-sm">
              Real-time visualization of all 7 system components
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">
              Last update: {data ? formatTime(data.timestamp) : "-"}
            </span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded text-sm ${
                autoRefresh
                  ? "bg-green-600 hover:bg-green-500"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {autoRefresh ? "🔄 Auto-refresh ON" : "⏸️ Auto-refresh OFF"}
            </button>
          </div>
        </div>

        {!data ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <>
            {/* Component Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {Object.entries(data.components).map(([key, component]) => (
                <ComponentCard
                  key={key}
                  componentKey={key}
                  component={component}
                  isSelected={selectedComponent === key}
                  onClick={() =>
                    setSelectedComponent(selectedComponent === key ? null : key)
                  }
                  formatTime={formatTime}
                  formatInterval={formatInterval}
                />
              ))}
            </div>

            {/* Selected Component Detail */}
            {selectedComponent &&
              data.components[
                selectedComponent as keyof typeof data.components
              ] && (
                <ComponentDetail
                  component={
                    data.components[
                      selectedComponent as keyof typeof data.components
                    ]
                  }
                  formatTime={formatTime}
                  formatInterval={formatInterval}
                />
              )}
          </>
        )}
      </div>
    </Layout>
  );
}

function ComponentCard({
  component,
  isSelected,
  onClick,
  formatTime,
  formatInterval,
}: {
  componentKey: string;
  component: ComponentData;
  isSelected: boolean;
  onClick: () => void;
  formatTime: (t: string) => string;
  formatInterval: (ms: number) => string;
}) {
  const status = component.status || "active";

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-lg border-2 cursor-pointer transition-all
        ${isSelected ? "ring-2 ring-blue-500" : ""}
        ${statusBorders[status] || "border-gray-600"}
        bg-gray-800/50 hover:bg-gray-800
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{component.emoji}</span>
          <h3 className="font-bold text-lg">{component.name}</h3>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || "bg-gray-600"}`}
        >
          {status}
        </span>
      </div>

      {/* Description */}
      <p className="text-gray-400 text-sm mb-3">{component.description}</p>

      {/* Quick Metrics */}
      <div className="flex flex-wrap gap-2 text-xs">
        {component.metrics &&
          Object.entries(component.metrics)
            .slice(0, 4)
            .map(([key, value]) => {
              if (typeof value === "boolean") {
                return (
                  <span
                    key={key}
                    className={`px-2 py-1 rounded ${value ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}
                  >
                    {key}: {value ? "✓" : "✗"}
                  </span>
                );
              }
              if (Array.isArray(value)) {
                return (
                  <span key={key} className="px-2 py-1 bg-gray-700 rounded">
                    {key}:{" "}
                    {value
                      .map((v) => (typeof v === "number" ? v.toFixed(2) : v))
                      .join(", ")}
                  </span>
                );
              }
              return (
                <span key={key} className="px-2 py-1 bg-gray-700 rounded">
                  {key}:{" "}
                  {typeof value === "number" && key.includes("Usage")
                    ? `${value}%`
                    : value}
                </span>
              );
            })}
      </div>

      {/* Scanners (special case) */}
      {component.scannerList && (
        <div className="mt-3 space-y-1">
          {component.scannerList.map((scanner) => (
            <div
              key={scanner.name}
              className="flex items-center justify-between text-xs"
            >
              <span
                className={scanner.enabled ? "text-green-400" : "text-gray-500"}
              >
                {scanner.enabled ? "●" : "○"} {scanner.name}
              </span>
              <span className="text-gray-500">
                {formatInterval(scanner.intervalMs)}
                {scanner.lastRun && ` • ${formatTime(scanner.lastRun)}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent Events Count */}
      {component.recentEvents && component.recentEvents.length > 0 && (
        <div className="mt-3 text-xs text-gray-500">
          {component.recentEvents.length} recent events
        </div>
      )}
    </div>
  );
}

function ComponentDetail({
  component,
  formatTime,
  formatInterval,
}: {
  component: ComponentData;
  formatTime: (t: string) => string;
  formatInterval: (ms: number) => string;
}) {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span>{component.emoji}</span>
        {component.name} - Details
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Metrics */}
        {component.metrics && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Metrics
            </h3>
            <div className="space-y-1">
              {Object.entries(component.metrics).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-400">{key}</span>
                  <span className="font-mono">
                    {typeof value === "boolean"
                      ? value
                        ? "✅"
                        : "❌"
                      : Array.isArray(value)
                        ? value
                            .map((v) =>
                              typeof v === "number" ? v.toFixed(2) : v,
                            )
                            .join(", ")
                        : typeof value === "number" && key.includes("Usage")
                          ? `${value}%`
                          : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* State Transitions */}
        {component.transitions && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Valid Transitions
            </h3>
            <div className="space-y-1 text-xs">
              {Object.entries(component.transitions).map(([from, toList]) => (
                <div key={from} className="flex items-center gap-1">
                  <span className="text-blue-400">{from}</span>
                  {toList.length > 0 ? (
                    <>
                      <span className="text-gray-600">→</span>
                      <span className="text-green-400">
                        {toList.join(" | ")}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-500">(terminal)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscribed Events */}
        {component.subscribedEvents && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Subscribes To
            </h3>
            <div className="flex flex-wrap gap-1">
              {component.subscribedEvents.map((event) => (
                <span
                  key={event}
                  className="px-1.5 py-0.5 bg-purple-900 text-purple-300 rounded text-xs"
                >
                  {event}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Emits Events */}
        {component.emitsEvents && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Emits</h3>
            <div className="flex flex-wrap gap-1">
              {component.emitsEvents.map((event) => (
                <span
                  key={event}
                  className="px-1.5 py-0.5 bg-cyan-900 text-cyan-300 rounded text-xs"
                >
                  {event}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Thresholds */}
        {component.thresholds && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Thresholds
            </h3>
            <div className="space-y-1">
              {Object.entries(component.thresholds).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-400">{key}</span>
                  <span className="font-mono">{value}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scanners */}
        {component.scannerList && (
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Scanners
            </h3>
            <div className="space-y-2">
              {component.scannerList.map((scanner) => (
                <div key={scanner.name} className="bg-gray-800 rounded p-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-medium ${scanner.enabled ? "text-green-400" : "text-gray-500"}`}
                    >
                      {scanner.enabled ? "●" : "○"} {scanner.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      Every {formatInterval(scanner.intervalMs)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {scanner.description}
                  </p>
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="text-cyan-400">
                      Emits: {scanner.emitsEvent}
                    </span>
                    {scanner.lastRun && (
                      <span className="text-gray-500">
                        Last: {formatTime(scanner.lastRun)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Counts */}
        {component.eventCounts &&
          Object.keys(component.eventCounts).length > 0 && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Event Counts
              </h3>
              <div className="flex flex-wrap gap-1">
                {Object.entries(component.eventCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 15)
                  .map(([event, count]) => (
                    <span
                      key={event}
                      className="px-1.5 py-0.5 bg-gray-700 rounded text-xs"
                    >
                      {event}:{" "}
                      <span className="font-mono text-blue-400">{count}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
      </div>

      {/* Recent Events */}
      {component.recentEvents && component.recentEvents.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">
            Recent Events
          </h3>
          <div className="bg-gray-800 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left p-2 w-20">Time</th>
                  <th className="text-left p-2 w-40">Type</th>
                  <th className="text-left p-2">Summary</th>
                </tr>
              </thead>
              <tbody>
                {component.recentEvents.map((event) => (
                  <tr key={event.id} className="border-t border-gray-700">
                    <td className="p-2 text-gray-500 font-mono">
                      {formatTime(event.timestamp)}
                    </td>
                    <td className="p-2 text-cyan-400 font-mono">
                      {event.type}
                    </td>
                    <td className="p-2 text-gray-300 truncate max-w-md">
                      {event.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventSystem;
