import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";

interface AgentMetadata {
  id: string;
  name: string;
  type: string;
  emoji: string;
  description: string;
  role: string;
  responsibilities: string[];
  tools: string[];
  outputFormat?: string;
  triggerConditions?: string[];
  telegram: {
    channel: string;
    botEnvVar: string;
    webhookPath?: string;
  };
  defaultModel: string;
  recommendedModels: string[];
}

interface Agent {
  id: string;
  name: string;
  type: string;
  model: string;
  telegram_channel: string | null;
  status: "idle" | "working" | "error" | "stuck" | "stopped";
  current_task_id: string | null;
  last_heartbeat: string | null;
  tasks_completed: number;
  tasks_failed: number;
  running_instances: number;
  metadata: AgentMetadata | null;
}

interface BotStatus {
  type: string;
  username: string;
  webhookUrl: string;
  webhookActive: boolean;
  pendingUpdates: number;
  lastError: string | null;
  lastErrorDate: string | null;
}

interface TelegramMessage {
  id: number;
  bot_type: string;
  chat_id: string;
  message_type: string;
  content: string;
  task_id: string | null;
  task_display_id: string | null;
  sent_at: string;
}

const API_BASE = "http://localhost:3333/api";

const statusColors: Record<string, string> = {
  idle: "bg-gray-500",
  working: "bg-green-500",
  error: "bg-red-500",
  stuck: "bg-yellow-500",
  stopped: "bg-gray-700",
};

const statusLabels: Record<string, string> = {
  idle: "Idle",
  working: "Working",
  error: "Error",
  stuck: "Stuck",
  stopped: "Stopped",
};

const modelColors: Record<string, string> = {
  opus: "text-purple-400",
  sonnet: "text-blue-400",
  haiku: "text-green-400",
};

const toolDescriptions: Record<string, string> = {
  Read: "Read files and directories",
  Write: "Create and overwrite files",
  Edit: "Make precise surgical edits to files",
  Bash: "Execute shell commands",
  Browser: "Automate web browser interactions",
  Screenshot: "Capture screenshots",
  WebSearch: "Search the web for information",
  "Internal APIs": "Access orchestrator internal APIs",
};

type DetailTab = "info" | "tools" | "telegram" | "activity";

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("info");
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);
  const [agentMessages, setAgentMessages] = useState<TelegramMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsRes, botsRes] = await Promise.all([
          fetch(`${API_BASE}/agents/detailed`),
          fetch(`${API_BASE}/telegram/bots`),
        ]);

        if (agentsRes.ok) {
          const data = await agentsRes.json();
          setAgents(data);
        }
        if (botsRes.ok) {
          const data = await botsRes.json();
          setBotStatuses(data);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages when agent or tab changes
  useEffect(() => {
    if (selectedAgent && activeTab === "activity") {
      fetchAgentMessages(selectedAgent);
    }
  }, [selectedAgent, activeTab]);

  async function fetchAgentMessages(agent: Agent) {
    try {
      // Map agent type to bot type
      const botTypeMap: Record<string, string> = {
        build: "build",
        build_agent: "build",
        qa: "qa",
        qa_agent: "qa",
        planning: "planning",
        planning_agent: "planning",
        validation: "validation",
        validation_agent: "validation",
        research: "research",
        research_agent: "research",
        spec: "spec",
        spec_agent: "spec",
        orchestrator: "orchestrator",
        sia: "sia",
        sia_agent: "sia",
        monitor: "monitor",
      };
      const botType =
        botTypeMap[agent.type] || botTypeMap[agent.id] || agent.type;
      const res = await fetch(
        `${API_BASE}/telegram/messages?bot_type=${botType}&limit=20`,
      );
      if (res.ok) {
        const data = await res.json();
        setAgentMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to fetch agent messages:", err);
    }
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" });
  };

  const getBotStatus = (agent: Agent): BotStatus | undefined => {
    if (!agent.metadata?.telegram) return undefined;
    // Match by webhook path or type
    const webhookPath = agent.metadata.telegram.webhookPath;
    return botStatuses.find(
      (b) =>
        webhookPath?.includes(b.type) ||
        agent.type === b.type ||
        agent.id.replace("_agent", "") === b.type,
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-400">Loading agents...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-5rem)]">
        {/* Agent List - Left Panel */}
        <div className="col-span-3 bg-gray-800 rounded-lg p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">
            🤖 Agent Fleet ({agents.length})
          </h2>
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent);
                  setActiveTab("info");
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedAgent?.id === agent.id
                    ? "bg-blue-900/50 border border-blue-500"
                    : "bg-gray-700/50 hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {agent.metadata?.emoji || "🤖"}
                    </span>
                    <div>
                      <div className="font-medium text-white text-sm">
                        {agent.name}
                      </div>
                      <div className="text-xs text-gray-400">{agent.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`}
                    />
                  </div>
                </div>

                {/* Quick stats */}
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  <span className={modelColors[agent.model] || "text-gray-400"}>
                    {agent.model}
                  </span>
                  <span>✅{agent.tasks_completed}</span>
                  <span>❌{agent.tasks_failed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Details - Right Panel */}
        <div className="col-span-9 bg-gray-800 rounded-lg overflow-hidden flex flex-col">
          {selectedAgent ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">
                      {selectedAgent.metadata?.emoji || "🤖"}
                    </span>
                    <div>
                      <h1 className="text-xl font-bold text-white">
                        {selectedAgent.name}
                      </h1>
                      <p className="text-sm text-gray-400">
                        {selectedAgent.metadata?.description ||
                          selectedAgent.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${modelColors[selectedAgent.model] || "text-gray-400"} bg-gray-900`}
                    >
                      {selectedAgent.model}
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900">
                      <span
                        className={`w-2 h-2 rounded-full ${statusColors[selectedAgent.status]}`}
                      />
                      <span className="text-sm">
                        {statusLabels[selectedAgent.status]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-gray-700">
                {(["info", "tools", "telegram", "activity"] as DetailTab[]).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-3 text-sm font-medium transition-colors ${
                        activeTab === tab
                          ? "text-blue-400 border-b-2 border-blue-400 bg-gray-900/50"
                          : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                      }`}
                    >
                      {tab === "info" && "📋 Info"}
                      {tab === "tools" && "🔧 Tools"}
                      {tab === "telegram" && "📱 Telegram"}
                      {tab === "activity" && "📊 Activity"}
                    </button>
                  ),
                )}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === "info" && (
                  <InfoTab agent={selectedAgent} formatTime={formatTime} />
                )}
                {activeTab === "tools" && <ToolsTab agent={selectedAgent} />}
                {activeTab === "telegram" && (
                  <TelegramTab
                    agent={selectedAgent}
                    botStatus={getBotStatus(selectedAgent)}
                  />
                )}
                {activeTab === "activity" && (
                  <ActivityTab
                    messages={agentMessages}
                    formatTime={formatTime}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <span className="text-6xl block mb-4">🤖</span>
                <p>Select an agent to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function InfoTab({
  agent,
  formatTime,
}: {
  agent: Agent;
  formatTime: (t: string | null) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Tasks Completed"
          value={agent.tasks_completed}
          icon="✅"
        />
        <StatCard label="Tasks Failed" value={agent.tasks_failed} icon="❌" />
        <StatCard
          label="Running Instances"
          value={agent.running_instances}
          icon="🏃"
        />
        <StatCard
          label="Last Heartbeat"
          value={formatTime(agent.last_heartbeat)}
          icon="💓"
        />
      </div>

      {agent.metadata && (
        <>
          {/* Role */}
          <Section title="🎯 Role">
            <p className="text-gray-300">{agent.metadata.role}</p>
          </Section>

          {/* Responsibilities */}
          <Section title="📋 Responsibilities">
            <ul className="space-y-2">
              {agent.metadata.responsibilities.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-300">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Output Format */}
          {agent.metadata.outputFormat && (
            <Section title="📤 Output Format">
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300">
                {agent.metadata.outputFormat}
              </div>
            </Section>
          )}

          {/* Trigger Conditions */}
          {agent.metadata.triggerConditions &&
            agent.metadata.triggerConditions.length > 0 && (
              <Section title="⚡ Trigger Conditions">
                <ul className="space-y-2">
                  {agent.metadata.triggerConditions.map((c, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-gray-300"
                    >
                      <span className="text-yellow-400 mt-1">⚡</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

          {/* Recommended Models */}
          <Section title="🎨 Recommended Models">
            <div className="flex gap-2 flex-wrap">
              {agent.metadata.recommendedModels.map((model, i) => (
                <span
                  key={model}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    i === 0
                      ? "bg-purple-900/50 text-purple-300 border border-purple-500"
                      : "bg-gray-700 text-gray-300"
                  }`}
                >
                  {model} {i === 0 && "★"}
                </span>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* Current Task */}
      {agent.current_task_id && (
        <Section title="🔄 Current Task">
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
            <span className="font-mono text-blue-300">
              {agent.current_task_id}
            </span>
          </div>
        </Section>
      )}
    </div>
  );
}

function ToolsTab({ agent }: { agent: Agent }) {
  const tools = agent.metadata?.tools || [];

  return (
    <div className="space-y-4">
      <p className="text-gray-400 mb-6">
        This agent has access to {tools.length} tool
        {tools.length !== 1 ? "s" : ""}.
      </p>

      <div className="grid gap-4">
        {tools.map((tool) => (
          <div
            key={tool}
            className="bg-gray-900 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">
                {tool === "Read" && "📖"}
                {tool === "Write" && "✏️"}
                {tool === "Edit" && "🔧"}
                {tool === "Bash" && "💻"}
                {tool === "Browser" && "🌐"}
                {tool === "Screenshot" && "📸"}
                {tool === "WebSearch" && "🔍"}
                {tool === "Internal APIs" && "🔌"}
              </span>
              <h3 className="text-lg font-semibold text-white">{tool}</h3>
            </div>
            <p className="text-gray-400 text-sm">
              {toolDescriptions[tool] || "No description available"}
            </p>
          </div>
        ))}
      </div>

      {tools.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <span className="text-4xl block mb-4">🔧</span>
          <p>No tools configured for this agent</p>
        </div>
      )}
    </div>
  );
}

function TelegramTab({
  agent,
  botStatus,
}: {
  agent: Agent;
  botStatus?: BotStatus;
}) {
  const telegram = agent.metadata?.telegram;

  if (!telegram) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl block mb-4">📱</span>
        <p>No Telegram integration configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bot Status Card */}
      {botStatus && (
        <div
          className={`rounded-lg p-4 border ${
            botStatus.webhookActive
              ? "bg-green-900/20 border-green-700"
              : "bg-red-900/20 border-red-700"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${botStatus.webhookActive ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="font-semibold text-white">Webhook Status</span>
            </div>
            <span
              className={`text-sm ${botStatus.webhookActive ? "text-green-400" : "text-red-400"}`}
            >
              {botStatus.webhookActive ? "● Active" : "● Inactive"}
            </span>
          </div>

          {botStatus.pendingUpdates > 0 && (
            <div className="text-yellow-400 text-sm mb-2">
              ⚠️ {botStatus.pendingUpdates} pending updates
            </div>
          )}

          {botStatus.lastError && (
            <div className="text-red-400 text-sm">
              Last error: {botStatus.lastError}
            </div>
          )}
        </div>
      )}

      {/* Configuration */}
      <Section title="📱 Configuration">
        <div className="bg-gray-900 rounded-lg divide-y divide-gray-700">
          <ConfigRow label="Channel" value={telegram.channel} type="channel" />
          <ConfigRow
            label="Bot Token Env"
            value={telegram.botEnvVar}
            type="env"
          />
          <ConfigRow
            label="Webhook Path"
            value={telegram.webhookPath || "Not configured"}
            type="path"
          />
          {botStatus && (
            <>
              <ConfigRow
                label="Bot Username"
                value={botStatus.username}
                type="username"
              />
              <ConfigRow
                label="Webhook URL"
                value={botStatus.webhookUrl}
                type="url"
              />
            </>
          )}
        </div>
      </Section>

      {/* Commands */}
      <Section title="⌨️ Available Commands">
        <div className="bg-gray-900 rounded-lg p-4">
          <AgentCommands agentType={agent.type} />
        </div>
      </Section>
    </div>
  );
}

function AgentCommands({ agentType }: { agentType: string }) {
  const commandsByType: Record<string, { cmd: string; desc: string }[]> = {
    planning: [
      { cmd: "/approve", desc: "Approve the current plan" },
      { cmd: "/reject", desc: "Reject the plan with feedback" },
    ],
    planning_agent: [
      { cmd: "/approve", desc: "Approve the current plan" },
      { cmd: "/reject", desc: "Reject the plan with feedback" },
    ],
    build: [
      { cmd: "/retry", desc: "Retry the current task" },
      { cmd: "/pause", desc: "Pause the build agent" },
    ],
    build_agent: [
      { cmd: "/retry", desc: "Retry the current task" },
      { cmd: "/pause", desc: "Pause the build agent" },
    ],
    validation: [
      { cmd: "/retest", desc: "Re-run validation tests" },
      { cmd: "/skip", desc: "Skip current test" },
    ],
    validation_agent: [
      { cmd: "/retest", desc: "Re-run validation tests" },
      { cmd: "/skip", desc: "Skip current test" },
    ],
    sia: [
      { cmd: "/agents", desc: "List all agents and status" },
      { cmd: "/budget", desc: "Show budget status" },
      { cmd: "/pause_all", desc: "Pause all agents" },
    ],
    sia_agent: [
      { cmd: "/agents", desc: "List all agents and status" },
      { cmd: "/budget", desc: "Show budget status" },
      { cmd: "/pause_all", desc: "Pause all agents" },
    ],
  };

  const commands = commandsByType[agentType] || [];

  if (commands.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No commands available for this agent type
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {commands.map((c) => (
        <div key={c.cmd} className="flex items-center gap-4">
          <code className="text-blue-400 font-mono bg-gray-800 px-2 py-1 rounded">
            {c.cmd}
          </code>
          <span className="text-gray-400 text-sm">{c.desc}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityTab({
  messages,
  formatTime,
}: {
  messages: TelegramMessage[];
  formatTime: (t: string) => string;
}) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl block mb-4">📊</span>
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-gray-400 mb-4">
        Recent Telegram messages from this agent:
      </p>

      {messages.map((msg) => (
        <div
          key={msg.id}
          className="bg-gray-900 rounded-lg p-4 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  msg.message_type === "error"
                    ? "bg-red-900/50 text-red-300"
                    : msg.message_type === "success"
                      ? "bg-green-900/50 text-green-300"
                      : msg.message_type === "warning"
                        ? "bg-yellow-900/50 text-yellow-300"
                        : "bg-gray-700 text-gray-300"
                }`}
              >
                {msg.message_type}
              </span>
              {msg.task_display_id && (
                <span className="text-xs font-mono text-blue-400">
                  {msg.task_display_id}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {formatTime(msg.sent_at)}
            </span>
          </div>
          <p className="text-gray-300 text-sm whitespace-pre-wrap line-clamp-3">
            {msg.content}
          </p>
        </div>
      ))}
    </div>
  );
}

function ConfigRow({
  label,
  value,
  type,
}: {
  label: string;
  value: string;
  type: string;
}) {
  return (
    <div className="flex justify-between items-center p-3">
      <span className="text-gray-400 text-sm">{label}</span>
      <span
        className={`font-mono text-sm ${
          type === "channel"
            ? "text-blue-400"
            : type === "env"
              ? "text-yellow-400"
              : type === "path"
                ? "text-green-400"
                : type === "url"
                  ? "text-purple-400"
                  : type === "username"
                    ? "text-cyan-400"
                    : "text-gray-300"
        }`}
      >
        {type === "url" && value.length > 50
          ? value.slice(0, 50) + "..."
          : value}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default Agents;
