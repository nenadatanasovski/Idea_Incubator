import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'

interface HarnessConfig {
  planning: {
    interval_hours: number
    model: string
    timeout_minutes: number
    enabled: boolean
  }
  agents: {
    model: string
    model_fallback: string[]
    timeout_minutes: number
    max_concurrent: number
    max_per_type: Record<string, number>
    max_output_tokens: number
    enabled: boolean
  }
  budget: {
    daily_token_limit: number
    warn_thresholds: number[]
    pause_at_limit: boolean
    notify_telegram: boolean
    p0_reserve_percent: number
  }
  cleanup: {
    retention_days: number
    auto_cleanup: boolean
  }
  qa: {
    enabled: boolean
    every_n_ticks: number
  }
  retry: {
    max_attempts: number
    backoff_base_ms: number
    backoff_multiplier: number
    max_backoff_ms: number
  }
  circuit_breaker: {
    enabled: boolean
    failure_threshold: number
    window_minutes: number
    cooldown_minutes: number
  }
}

interface BudgetStatus {
  daily: {
    tokens: { input: number; output: number; total: number }
    cost_usd: number
    limit_tokens: number
    percent_used: number
  }
  budget_status: string
}

interface Stats {
  agents: { total: number; working: number; idle: number; stuck: number }
  tasks: { pending: number; in_progress: number; completed: number; failed: number }
  sessions: { active: number; recent: number }
}

const API_BASE = 'http://localhost:3333/api'

export function Config() {
  const [config, setConfig] = useState<HarnessConfig | null>(null)
  const [budget, setBudget] = useState<BudgetStatus | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      const [configRes, budgetRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/config`),
        fetch(`${API_BASE}/config/budget`),
        fetch(`${API_BASE}/config/stats`),
      ])
      
      if (configRes.ok) setConfig(await configRes.json())
      if (budgetRes.ok) setBudget(await budgetRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    if (!config) return
    setSaving(true)
    setMessage(null)
    
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Configuration saved!' })
        fetchData()
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.details?.join(', ') || 'Failed to save' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  async function resetConfig() {
    if (!confirm('Reset all settings to defaults?')) return
    
    try {
      const res = await fetch(`${API_BASE}/config/reset`, { method: 'POST' })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Configuration reset to defaults' })
        fetchData()
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to reset' })
    }
  }

  async function clearPlanCache() {
    try {
      const res = await fetch(`${API_BASE}/config/planning/clear-cache`, { method: 'POST' })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Plan cache cleared' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to clear cache' })
    }
  }

  function updateConfig<K extends keyof HarnessConfig>(
    section: K,
    field: keyof HarnessConfig[K],
    value: any
  ) {
    if (!config) return
    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [field]: value,
      },
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-400">Loading configuration...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">⚙️ Harness Configuration</h1>
            <p className="text-gray-400 text-sm mt-1">Manage limits, timeouts, budgets, and resilience settings</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 rounded font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : '💾 Save'}
            </button>
            <button
              onClick={resetConfig}
              className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
            >
              🔄 Reset
            </button>
            <button
              onClick={clearPlanCache}
              className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
            >
              🗑️ Clear Cache
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {message.text}
          </div>
        )}

        {/* Stats Cards */}
        {stats && budget && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Agents"
              value={`${stats.agents.working}/${stats.agents.total}`}
              subtitle={`${stats.agents.idle} idle, ${stats.agents.stuck} stuck`}
              color="blue"
            />
            <StatCard
              title="Tasks"
              value={stats.tasks.pending + stats.tasks.in_progress}
              subtitle={`${stats.tasks.completed} done, ${stats.tasks.failed} failed`}
              color="green"
            />
            <StatCard
              title="Budget Used"
              value={`${budget.daily.percent_used.toFixed(1)}%`}
              subtitle={`${budget.daily.tokens.total.toLocaleString()} / ${budget.daily.limit_tokens.toLocaleString()}`}
              color={budget.daily.percent_used > 80 ? 'red' : budget.daily.percent_used > 50 ? 'yellow' : 'green'}
            />
            <StatCard
              title="Cost Today"
              value={`$${budget.daily.cost_usd.toFixed(2)}`}
              subtitle={budget.budget_status}
              color={budget.budget_status.includes('WARNING') ? 'yellow' : 'green'}
            />
          </div>
        )}

        {config && (
          <div className="grid grid-cols-3 gap-4">
            {/* Planning Section */}
            <ConfigSection title="🧠 Planning" description="Strategic planning agent settings">
              <ConfigField label="Interval (hours)">
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={config.planning.interval_hours}
                  onChange={(e) => updateConfig('planning', 'interval_hours', parseInt(e.target.value) || 24)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Model">
                <select
                  value={config.planning.model}
                  onChange={(e) => updateConfig('planning', 'model', e.target.value)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                >
                  <option value="haiku">Haiku (cheapest)</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="opus">Opus</option>
                </select>
              </ConfigField>
              <ConfigField label="Timeout (min)">
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={config.planning.timeout_minutes}
                  onChange={(e) => updateConfig('planning', 'timeout_minutes', parseInt(e.target.value) || 15)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Enabled">
                <Toggle
                  checked={config.planning.enabled}
                  onChange={(v) => updateConfig('planning', 'enabled', v)}
                />
              </ConfigField>
            </ConfigSection>

            {/* Agents Section */}
            <ConfigSection title="🤖 Agents" description="Build agent execution settings">
              <ConfigField label="Default Model">
                <select
                  value={config.agents.model}
                  onChange={(e) => updateConfig('agents', 'model', e.target.value)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                >
                  <option value="opus">Opus (best)</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="haiku">Haiku</option>
                </select>
              </ConfigField>
              <ConfigField label="Max Concurrent">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config.agents.max_concurrent}
                  onChange={(e) => updateConfig('agents', 'max_concurrent', parseInt(e.target.value) || 8)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Timeout (min)">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={config.agents.timeout_minutes}
                  onChange={(e) => updateConfig('agents', 'timeout_minutes', parseInt(e.target.value) || 5)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Max Output Tokens">
                <input
                  type="number"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={config.agents.max_output_tokens}
                  onChange={(e) => updateConfig('agents', 'max_output_tokens', parseInt(e.target.value) || 16000)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Enabled">
                <Toggle
                  checked={config.agents.enabled}
                  onChange={(v) => updateConfig('agents', 'enabled', v)}
                />
              </ConfigField>
            </ConfigSection>

            {/* Model Fallback Chain */}
            <ConfigSection title="🔄 Model Fallback" description="Order of models to try when rate-limited">
              <FallbackChainEditor
                chain={config.agents.model_fallback || ['opus', 'sonnet', 'haiku']}
                onChange={(chain) => updateConfig('agents', 'model_fallback', chain)}
              />
            </ConfigSection>

            {/* Per-Agent-Type Concurrency */}
            <ConfigSection title="⚙️ Per-Type Limits" description="Max concurrent agents per type">
              <PerTypeLimitsEditor
                limits={config.agents.max_per_type || {}}
                onChange={(limits) => updateConfig('agents', 'max_per_type', limits)}
              />
            </ConfigSection>

            {/* Budget Section */}
            <ConfigSection title="💰 Budget" description="Token limits and cost controls">
              <ConfigField label="Daily Token Limit">
                <input
                  type="number"
                  min="10000"
                  step="10000"
                  value={config.budget.daily_token_limit}
                  onChange={(e) => updateConfig('budget', 'daily_token_limit', parseInt(e.target.value) || 500000)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="P0 Reserve %">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={config.budget.p0_reserve_percent}
                  onChange={(e) => updateConfig('budget', 'p0_reserve_percent', parseInt(e.target.value) || 20)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Pause at Limit">
                <Toggle
                  checked={config.budget.pause_at_limit}
                  onChange={(v) => updateConfig('budget', 'pause_at_limit', v)}
                />
              </ConfigField>
              <ConfigField label="Telegram Alerts">
                <Toggle
                  checked={config.budget.notify_telegram}
                  onChange={(v) => updateConfig('budget', 'notify_telegram', v)}
                />
              </ConfigField>
            </ConfigSection>

            {/* Retry Section */}
            <ConfigSection title="🔁 Retry" description="Failed task retry behavior">
              <ConfigField label="Max Attempts">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config.retry.max_attempts}
                  onChange={(e) => updateConfig('retry', 'max_attempts', parseInt(e.target.value) || 5)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Base Delay (sec)">
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={Math.round(config.retry.backoff_base_ms / 1000)}
                  onChange={(e) => updateConfig('retry', 'backoff_base_ms', (parseInt(e.target.value) || 30) * 1000)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Backoff Multiplier">
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.5"
                  value={config.retry.backoff_multiplier}
                  onChange={(e) => updateConfig('retry', 'backoff_multiplier', parseFloat(e.target.value) || 2)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Max Delay (min)">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={Math.round(config.retry.max_backoff_ms / 60000)}
                  onChange={(e) => updateConfig('retry', 'max_backoff_ms', (parseInt(e.target.value) || 60) * 60000)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
            </ConfigSection>

            {/* Circuit Breaker Section */}
            <ConfigSection title="⚡ Circuit Breaker" description="Auto-pause failing agent types">
              <ConfigField label="Enabled">
                <Toggle
                  checked={config.circuit_breaker.enabled}
                  onChange={(v) => updateConfig('circuit_breaker', 'enabled', v)}
                />
              </ConfigField>
              <ConfigField label="Failure Threshold">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config.circuit_breaker.failure_threshold}
                  onChange={(e) => updateConfig('circuit_breaker', 'failure_threshold', parseInt(e.target.value) || 5)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Window (min)">
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={config.circuit_breaker.window_minutes}
                  onChange={(e) => updateConfig('circuit_breaker', 'window_minutes', parseInt(e.target.value) || 30)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Cooldown (min)">
                <input
                  type="number"
                  min="5"
                  max="240"
                  value={config.circuit_breaker.cooldown_minutes}
                  onChange={(e) => updateConfig('circuit_breaker', 'cooldown_minutes', parseInt(e.target.value) || 60)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
            </ConfigSection>

            {/* QA & Cleanup Section */}
            <ConfigSection title="🔧 QA & Cleanup" description="Quality assurance and maintenance">
              <ConfigField label="QA Enabled">
                <Toggle
                  checked={config.qa.enabled}
                  onChange={(v) => updateConfig('qa', 'enabled', v)}
                />
              </ConfigField>
              <ConfigField label="QA Every N Ticks">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.qa.every_n_ticks}
                  onChange={(e) => updateConfig('qa', 'every_n_ticks', parseInt(e.target.value) || 10)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Retention (days)">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={config.cleanup.retention_days}
                  onChange={(e) => updateConfig('cleanup', 'retention_days', parseInt(e.target.value) || 7)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                />
              </ConfigField>
              <ConfigField label="Auto Cleanup">
                <Toggle
                  checked={config.cleanup.auto_cleanup}
                  onChange={(v) => updateConfig('cleanup', 'auto_cleanup', v)}
                />
              </ConfigField>
            </ConfigSection>
          </div>
        )}
      </div>
    </Layout>
  )
}

// Helper Components
function StatCard({ title, value, subtitle, color }: { 
  title: string
  value: string | number
  subtitle: string
  color: 'blue' | 'green' | 'yellow' | 'red'
}) {
  const colors = {
    blue: 'border-blue-500',
    green: 'border-green-500',
    yellow: 'border-yellow-500',
    red: 'border-red-500',
  }
  
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border-l-4 ${colors[color]}`}>
      <div className="text-gray-400 text-sm">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-gray-500 text-xs mt-1">{subtitle}</div>
    </div>
  )
}

function ConfigSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-300 flex-shrink-0">{label}</label>
      <div className="w-36">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors flex items-center ${checked ? 'bg-blue-600' : 'bg-gray-600'}`}
    >
      <div
        className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

const AVAILABLE_MODELS = ['opus', 'sonnet', 'haiku']

function FallbackChainEditor({ chain, onChange }: { chain: string[]; onChange: (chain: string[]) => void }) {
  const moveUp = (index: number) => {
    if (index === 0) return
    const newChain = [...chain]
    ;[newChain[index - 1], newChain[index]] = [newChain[index], newChain[index - 1]]
    onChange(newChain)
  }

  const moveDown = (index: number) => {
    if (index >= chain.length - 1) return
    const newChain = [...chain]
    ;[newChain[index], newChain[index + 1]] = [newChain[index + 1], newChain[index]]
    onChange(newChain)
  }

  const toggleModel = (model: string) => {
    if (chain.includes(model)) {
      if (chain.length <= 1) return // Keep at least one
      onChange(chain.filter(m => m !== model))
    } else {
      onChange([...chain, model])
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 mb-2">Drag order determines fallback priority</div>
      <div className="space-y-2">
        {chain.map((model, index) => (
          <div key={model} className="flex items-center gap-2 bg-gray-700 rounded px-3 py-2">
            <span className="text-xs text-gray-500 w-4">{index + 1}.</span>
            <span className="flex-1 text-sm font-medium capitalize">{model}</span>
            <button
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => moveDown(index)}
              disabled={index >= chain.length - 1}
              className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
            <button
              onClick={() => toggleModel(model)}
              disabled={chain.length <= 1}
              className="p-1 hover:bg-red-700 rounded text-red-400 disabled:opacity-30"
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      
      {/* Add missing models */}
      {AVAILABLE_MODELS.filter(m => !chain.includes(m)).length > 0 && (
        <div className="pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2">Add to chain:</div>
          <div className="flex gap-2 flex-wrap">
            {AVAILABLE_MODELS.filter(m => !chain.includes(m)).map(model => (
              <button
                key={model}
                onClick={() => toggleModel(model)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs capitalize"
              >
                + {model}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const AGENT_TYPES = ['build', 'planning', 'qa', 'review', 'research', 'deploy']

function PerTypeLimitsEditor({ limits, onChange }: { limits: Record<string, number>; onChange: (limits: Record<string, number>) => void }) {
  const updateLimit = (type: string, value: number) => {
    onChange({ ...limits, [type]: value })
  }

  const removeLimit = (type: string) => {
    const newLimits = { ...limits }
    delete newLimits[type]
    onChange(newLimits)
  }

  const [newType, setNewType] = useState('')

  const addType = () => {
    if (!newType || limits[newType] !== undefined) return
    onChange({ ...limits, [newType]: 2 })
    setNewType('')
  }

  return (
    <div className="space-y-3">
      {Object.entries(limits).length === 0 ? (
        <div className="text-xs text-gray-500 italic">No per-type limits configured (using global max)</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(limits).map(([type, limit]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-sm text-gray-300 w-20 truncate capitalize">{type}</span>
              <input
                type="number"
                min="1"
                max="10"
                value={limit}
                onChange={(e) => updateLimit(type, parseInt(e.target.value) || 1)}
                className="w-16 bg-gray-700 rounded px-2 py-1 text-sm text-center"
              />
              <button
                onClick={() => removeLimit(type)}
                className="p-1 hover:bg-red-700 rounded text-red-400 text-xs"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-gray-700">
        <div className="flex gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="flex-1 bg-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="">Add type limit...</option>
            {AGENT_TYPES.filter(t => limits[t] === undefined).map(type => (
              <option key={type} value={type} className="capitalize">{type}</option>
            ))}
          </select>
          <button
            onClick={addType}
            disabled={!newType}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

export default Config
