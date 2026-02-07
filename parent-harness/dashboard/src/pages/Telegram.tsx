import { useState, useEffect, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { formatTime as formatTimeSydney } from '../utils/format'

interface TelegramMessage {
  id: string
  bot_type: string
  direction: 'outgoing' | 'incoming'
  chat_id: string
  message_type: string
  message_text: string
  task_id: string | null
  task_display_id: string | null
  agent_id: string | null
  session_id: string | null
  sent_at: string
}

interface TelegramStats {
  total: number
  byBot: Record<string, number>
  byType: Record<string, number>
  last24h: number
}

interface BotStatus {
  type: string
  username: string | null
  webhookUrl: string | null
  webhookActive: boolean
  pendingUpdates: number
  lastError: string | null
  lastErrorDate: string | null
}

const API_BASE = 'http://localhost:3333/api'

const botEmojis: Record<string, string> = {
  build: '🔨',
  spec: '📝',
  validation: '✅',
  planning: '⭐',
  clarification: '❓',
  sia: '🧠',
  orchestrator: '🎯',
  monitor: '👁️',
  system: '⚙️',
  human: '🎭',
}

const messageTypeColors: Record<string, string> = {
  task_assigned: 'text-blue-400',
  task_completed: 'text-green-400',
  task_failed: 'text-red-400',
  agent_spawned: 'text-purple-400',
  error: 'text-red-400',
  general: 'text-gray-400',
}

export function Telegram() {
  const [channels, setChannels] = useState<Record<string, TelegramMessage[]>>({})
  const [stats, setStats] = useState<TelegramStats | null>(null)
  const [bots, setBots] = useState<BotStatus[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [showBotStatus, setShowBotStatus] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [channelsRes, statsRes, botsRes] = await Promise.all([
        fetch(`${API_BASE}/telegram/channels`),
        fetch(`${API_BASE}/telegram/stats`),
        fetch(`${API_BASE}/telegram/bots`),
      ])
      
      if (channelsRes.ok) setChannels(await channelsRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
      if (botsRes.ok) setBots(await botsRes.json())
    } catch (err) {
      console.error('Failed to fetch telegram data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [fetchData])

  // Listen for WebSocket updates
  useEffect(() => {
    const wsUrl = `ws://localhost:3333/ws`
    let ws: WebSocket | null = null
    
    try {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'telegram:message') {
          // Refresh data when new message arrives
          fetchData()
        }
      }
    } catch (err) {
      console.error('WebSocket error:', err)
    }
    
    return () => ws?.close()
  }, [fetchData])

  const formatTime = (timestamp: string) => formatTimeSydney(timestamp)

  const formatDate = (timestamp: string) => {
    const sydneyOpts: Intl.DateTimeFormatOptions = { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }
    const todayStr = new Date().toLocaleDateString('en-AU', sydneyOpts)
    const dateStr = new Date(timestamp).toLocaleDateString('en-AU', sydneyOpts)
    if (dateStr === todayStr) return 'Today'
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (dateStr === yesterday.toLocaleDateString('en-AU', sydneyOpts)) return 'Yesterday'
    return new Date(timestamp).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', timeZone: 'Australia/Sydney' })
  }

  const channelList = Object.keys(channels).sort()
  const selectedMessages = selectedChannel ? channels[selectedChannel] || [] : []

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-400">Loading telegram history...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-5rem)]">
        {/* Channel List */}
        <div className="col-span-3 bg-gray-800 rounded-lg p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📱 Telegram Channels</h2>
            <button
              onClick={() => setShowBotStatus(!showBotStatus)}
              className={`text-xs px-2 py-1 rounded ${showBotStatus ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              {showBotStatus ? '📊 Msgs' : '🔗 Bots'}
            </button>
          </div>
          
          {/* Stats */}
          {stats && !showBotStatus && (
            <div className="mb-4 p-3 bg-gray-900 rounded-lg text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Total Messages:</span>
                <span className="text-white">{stats.total}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Last 24h:</span>
                <span className="text-white">{stats.last24h}</span>
              </div>
            </div>
          )}
          
          {/* Bot Status View */}
          {showBotStatus && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-400">Bot Webhook Status</h3>
                <span className="text-xs text-gray-500">
                  {bots.filter(b => b.webhookActive).length}/{bots.length} active
                </span>
              </div>
              {bots.length === 0 ? (
                <p className="text-gray-500 text-sm">Loading bot status...</p>
              ) : (
                bots.map((bot) => (
                  <div
                    key={bot.type}
                    className={`p-3 rounded-lg text-sm ${
                      bot.webhookActive 
                        ? 'bg-green-900/20 border border-green-800' 
                        : 'bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{botEmojis[bot.type] || '🤖'}</span>
                        <span className="font-medium capitalize">{bot.type}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        bot.webhookActive 
                          ? 'bg-green-900 text-green-300' 
                          : 'bg-yellow-900 text-yellow-300'
                      }`}>
                        {bot.webhookActive ? '🔗 Webhook' : '📥 Polling'}
                      </span>
                    </div>
                    {bot.username && (
                      <a 
                        href={`https://t.me/${bot.username.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        {bot.username}
                      </a>
                    )}
                    {bot.webhookUrl && (
                      <p className="text-xs text-green-500/70 truncate mt-1" title={bot.webhookUrl}>
                        → {bot.webhookUrl.replace('https://', '').split('/')[0]}
                      </p>
                    )}
                    {bot.lastError && (
                      <p className="text-xs text-red-400 mt-1">
                        ⚠️ {bot.lastError}
                      </p>
                    )}
                    {bot.pendingUpdates > 0 && (
                      <p className="text-xs text-yellow-400 mt-1">
                        📬 {bot.pendingUpdates} pending updates
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          
          {/* Channel List (Messages View) */}
          {!showBotStatus && (
            <div className="space-y-2">
              {channelList.length === 0 ? (
                <p className="text-gray-500 text-sm">No messages yet</p>
              ) : (
                channelList.map((channel) => {
                  const messages = channels[channel]
                  const unread = messages.length
                  const bot = bots.find(b => b.type === channel)
                  
                  return (
                    <button
                      key={channel}
                      onClick={() => setSelectedChannel(channel)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedChannel === channel
                          ? 'bg-blue-900/50 border border-blue-500'
                          : 'bg-gray-700/50 hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{botEmojis[channel] || '🤖'}</span>
                          <span className="font-medium capitalize">{channel}</span>
                          {bot && (
                            <span className={`text-xs ${bot.webhookActive ? 'text-green-500' : 'text-yellow-500'}`}>
                              {bot.webhookActive ? '🔗' : '📥'}
                            </span>
                          )}
                        </div>
                        {unread > 0 && (
                          <span className="px-2 py-0.5 bg-blue-600 rounded-full text-xs">
                            {unread}
                          </span>
                        )}
                      </div>
                      {bot?.username && (
                        <p className="text-xs text-blue-400 mt-0.5">{bot.username}</p>
                      )}
                      {messages[0] && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {messages[0].message_text.slice(0, 50)}...
                        </p>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Message View */}
        <div className="col-span-9 bg-gray-800 rounded-lg flex flex-col overflow-hidden">
          {selectedChannel ? (
            <>
              {/* Channel Header */}
              <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                <span className="text-2xl">{botEmojis[selectedChannel] || '🤖'}</span>
                <div>
                  <h2 className="text-lg font-semibold capitalize">{selectedChannel} Bot</h2>
                  <p className="text-xs text-gray-400">{selectedMessages.length} messages</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedMessages.length === 0 ? (
                  <p className="text-center text-gray-500">No messages in this channel</p>
                ) : (
                  selectedMessages.map((msg, index) => {
                    const prevMsg = selectedMessages[index - 1]
                    const showDate = !prevMsg || formatDate(msg.sent_at) !== formatDate(prevMsg.sent_at)
                    
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="text-center text-xs text-gray-500 my-4">
                            {formatDate(msg.sent_at)}
                          </div>
                        )}
                        <div className={`flex ${msg.direction === 'incoming' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[70%] rounded-lg p-3 ${
                            msg.direction === 'incoming' 
                              ? 'bg-gray-700' 
                              : 'bg-blue-900/50'
                          }`}>
                            {/* Message Type Badge */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-mono ${messageTypeColors[msg.message_type] || 'text-gray-400'}`}>
                                {msg.message_type}
                              </span>
                              {msg.task_display_id && (
                                <span className="text-xs bg-gray-600 px-1.5 py-0.5 rounded">
                                  {msg.task_display_id}
                                </span>
                              )}
                            </div>
                            
                            {/* Message Text */}
                            <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                              {msg.message_text}
                            </p>
                            
                            {/* Timestamp */}
                            <div className="text-right mt-1">
                              <span className="text-xs text-gray-500">
                                {formatTime(msg.sent_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <span className="text-6xl block mb-4">📱</span>
                <p>Select a channel to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default Telegram
