import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'

interface AgentMetadata {
  id: string
  name: string
  type: string
  emoji: string
  description: string
  role: string
  responsibilities: string[]
  tools: string[]
  outputFormat?: string
  triggerConditions?: string[]
  telegram: {
    channel: string
    botEnvVar: string
    webhookPath?: string
  }
  defaultModel: string
  recommendedModels: string[]
}

interface Agent {
  id: string
  name: string
  type: string
  model: string
  telegram_channel: string | null
  status: 'idle' | 'working' | 'error' | 'stuck' | 'stopped'
  current_task_id: string | null
  last_heartbeat: string | null
  tasks_completed: number
  tasks_failed: number
  running_instances: number
  metadata: AgentMetadata | null
}

const API_BASE = 'http://localhost:3333/api'

const statusColors: Record<string, string> = {
  idle: 'bg-gray-500',
  working: 'bg-green-500',
  error: 'bg-red-500',
  stuck: 'bg-yellow-500',
  stopped: 'bg-gray-700',
}

const statusLabels: Record<string, string> = {
  idle: 'Idle',
  working: 'Working',
  error: 'Error',
  stuck: 'Stuck',
  stopped: 'Stopped',
}

const modelColors: Record<string, string> = {
  opus: 'text-purple-400',
  sonnet: 'text-blue-400',
  haiku: 'text-green-400',
}

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch(`${API_BASE}/agents/detailed`)
        if (res.ok) {
          const data = await res.json()
          setAgents(data)
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
    const interval = setInterval(fetchAgents, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-400">Loading agents...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-5rem)]">
        {/* Agent List */}
        <div className="col-span-4 bg-gray-800 rounded-lg p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">🤖 Agent Fleet</h2>
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedAgent?.id === agent.id
                    ? 'bg-blue-900/50 border border-blue-500'
                    : 'bg-gray-700/50 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{agent.metadata?.emoji || '🤖'}</span>
                    <div>
                      <div className="font-medium text-white">{agent.name}</div>
                      <div className="text-xs text-gray-400">{agent.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${modelColors[agent.model] || 'text-gray-400'}`}>
                      {agent.model}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`} />
                  </div>
                </div>
                
                {/* Quick stats */}
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                  <span>✅ {agent.tasks_completed}</span>
                  <span>❌ {agent.tasks_failed}</span>
                  {agent.running_instances > 0 && (
                    <span className="text-green-400">🏃 {agent.running_instances} running</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Details */}
        <div className="col-span-8 bg-gray-800 rounded-lg p-6 overflow-y-auto">
          {selectedAgent ? (
            <div>
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{selectedAgent.metadata?.emoji || '🤖'}</span>
                  <div>
                    <h1 className="text-2xl font-bold text-white">{selectedAgent.name}</h1>
                    <p className="text-gray-400">{selectedAgent.metadata?.description || selectedAgent.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${statusColors[selectedAgent.status]}`} />
                  <span className="text-sm font-medium">{statusLabels[selectedAgent.status]}</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="Model" value={selectedAgent.model} color={modelColors[selectedAgent.model]} />
                <StatCard label="Tasks Done" value={selectedAgent.tasks_completed} />
                <StatCard label="Tasks Failed" value={selectedAgent.tasks_failed} />
                <StatCard label="Last Heartbeat" value={formatTime(selectedAgent.last_heartbeat)} />
              </div>

              {selectedAgent.metadata && (
                <>
                  {/* Role */}
                  <Section title="🎯 Role">
                    <p className="text-gray-300">{selectedAgent.metadata.role}</p>
                  </Section>

                  {/* Responsibilities */}
                  <Section title="📋 Responsibilities">
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                      {selectedAgent.metadata.responsibilities.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </Section>

                  {/* Tools */}
                  <Section title="🔧 Tools">
                    <div className="flex flex-wrap gap-2">
                      {selectedAgent.metadata.tools.map((tool) => (
                        <span key={tool} className="px-3 py-1 bg-gray-700 rounded-full text-sm text-blue-300">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </Section>

                  {/* Output Format */}
                  {selectedAgent.metadata.outputFormat && (
                    <Section title="📤 Output Format">
                      <p className="text-gray-300 font-mono text-sm bg-gray-900 p-3 rounded">
                        {selectedAgent.metadata.outputFormat}
                      </p>
                    </Section>
                  )}

                  {/* Trigger Conditions */}
                  {selectedAgent.metadata.triggerConditions && (
                    <Section title="⚡ Trigger Conditions">
                      <ul className="list-disc list-inside space-y-1 text-gray-300">
                        {selectedAgent.metadata.triggerConditions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {/* Telegram Integration */}
                  <Section title="📱 Telegram Integration">
                    <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Channel:</span>
                        <span className="text-blue-400 font-mono">{selectedAgent.metadata.telegram.channel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Bot Token Env:</span>
                        <code className="text-yellow-400 text-sm">{selectedAgent.metadata.telegram.botEnvVar}</code>
                      </div>
                      {selectedAgent.metadata.telegram.webhookPath && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Webhook Path:</span>
                          <code className="text-green-400 text-sm">{selectedAgent.metadata.telegram.webhookPath}</code>
                        </div>
                      )}
                    </div>
                  </Section>

                  {/* Recommended Models */}
                  <Section title="🎨 Recommended Models">
                    <div className="flex gap-2">
                      {selectedAgent.metadata.recommendedModels.map((model, i) => (
                        <span
                          key={model}
                          className={`px-3 py-1 rounded-full text-sm ${
                            i === 0 ? 'bg-purple-900/50 text-purple-300 border border-purple-500' : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          {model} {i === 0 && '(default)'}
                        </span>
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {/* Current Task */}
              {selectedAgent.current_task_id && (
                <Section title="🔄 Current Task">
                  <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                    <span className="font-mono text-blue-300">{selectedAgent.current_task_id}</span>
                  </div>
                </Section>
              )}
            </div>
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
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color || 'text-white'}`}>{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default Agents
