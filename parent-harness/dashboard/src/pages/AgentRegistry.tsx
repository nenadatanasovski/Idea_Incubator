import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'

interface AgentType {
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

const API_BASE = 'http://localhost:3333/api'

const toolIcons: Record<string, string> = {
  Read: '📖',
  Write: '✏️',
  Edit: '🔧',
  Bash: '💻',
  Browser: '🌐',
  Screenshot: '📸',
  WebSearch: '🔍',
  'Internal APIs': '🔌',
}

export function AgentRegistry() {
  const [agentTypes, setAgentTypes] = useState<AgentType[]>([])
  const [selectedType, setSelectedType] = useState<AgentType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const res = await fetch(`${API_BASE}/agents/metadata`)
        if (res.ok) {
          const data = await res.json()
          setAgentTypes(data)
          if (data.length > 0 && !selectedType) {
            setSelectedType(data[0])
          }
        }
      } catch (err) {
        console.error('Failed to fetch agent metadata:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMetadata()
  }, [])

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-400">Loading agent registry...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-5rem)]">
        {/* Agent Type List */}
        <div className="col-span-3 bg-gray-800 rounded-lg p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-2">📋 Agent Registry</h2>
          <p className="text-xs text-gray-500 mb-4">{agentTypes.length} agent types defined</p>
          
          <div className="space-y-1">
            {agentTypes.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setSelectedType(agent)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedType?.id === agent.id
                    ? 'bg-blue-900/50 border border-blue-500'
                    : 'bg-gray-700/50 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{agent.emoji}</span>
                  <div>
                    <div className="font-medium text-white text-sm">{agent.name}</div>
                    <div className="text-xs text-gray-400">{agent.tools.length} tools</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Type Details */}
        <div className="col-span-9 bg-gray-800 rounded-lg overflow-y-auto p-6">
          {selectedType ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start gap-4 pb-4 border-b border-gray-700">
                <span className="text-5xl">{selectedType.emoji}</span>
                <div>
                  <h1 className="text-2xl font-bold text-white">{selectedType.name}</h1>
                  <p className="text-gray-400 mt-1">{selectedType.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                      ID: {selectedType.id}
                    </span>
                    <span className="px-2 py-1 bg-purple-900/50 rounded text-xs text-purple-300">
                      {selectedType.defaultModel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Role */}
              <Section title="🎯 Role">
                <p className="text-gray-300 bg-gray-900 p-4 rounded-lg">{selectedType.role}</p>
              </Section>

              {/* Responsibilities */}
              <Section title="📋 Responsibilities">
                <ul className="space-y-2">
                  {selectedType.responsibilities.map((r, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-300">
                      <span className="text-blue-400 font-bold">{i + 1}.</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* Tools */}
              <Section title="🔧 Toolset">
                <div className="grid grid-cols-2 gap-3">
                  {selectedType.tools.map((tool) => (
                    <div key={tool} className="flex items-center gap-3 bg-gray-900 p-3 rounded-lg">
                      <span className="text-xl">{toolIcons[tool] || '🔧'}</span>
                      <span className="text-white font-medium">{tool}</span>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Telegram */}
              <Section title="📱 Telegram Integration">
                <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                  <Row label="Channel" value={selectedType.telegram.channel} />
                  <Row label="Bot Env Var" value={selectedType.telegram.botEnvVar} />
                  {selectedType.telegram.webhookPath && (
                    <Row label="Webhook Path" value={selectedType.telegram.webhookPath} />
                  )}
                </div>
              </Section>

              {/* Output Format */}
              {selectedType.outputFormat && (
                <Section title="📤 Output Format">
                  <pre className="text-gray-300 bg-gray-900 p-4 rounded-lg text-sm whitespace-pre-wrap">
                    {selectedType.outputFormat}
                  </pre>
                </Section>
              )}

              {/* Trigger Conditions */}
              {selectedType.triggerConditions && selectedType.triggerConditions.length > 0 && (
                <Section title="⚡ Trigger Conditions">
                  <ul className="space-y-2">
                    {selectedType.triggerConditions.map((c, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-300">
                        <span className="text-yellow-400">⚡</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Recommended Models */}
              <Section title="🎨 Recommended Models">
                <div className="flex gap-2 flex-wrap">
                  {selectedType.recommendedModels.map((model, i) => (
                    <span
                      key={model}
                      className={`px-3 py-1.5 rounded-lg text-sm ${
                        i === 0
                          ? 'bg-purple-900/50 text-purple-300 border border-purple-500'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {model} {i === 0 && '(default)'}
                    </span>
                  ))}
                </div>
              </Section>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <span className="text-6xl block mb-4">📋</span>
                <p>Select an agent type to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className="text-blue-400 font-mono text-sm">{value}</span>
    </div>
  )
}

export default AgentRegistry
