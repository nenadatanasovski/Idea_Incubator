import { useState, useEffect, useCallback } from 'react'

interface Notification {
  id: number
  type: string
  message: string
  severity: 'warning' | 'error'
  timestamp: string
  agentId?: string
  taskId?: string
  read: boolean
}

const API_BASE = 'http://localhost:3333/api'

// Map event types to user-friendly titles
const typeToTitle: Record<string, string> = {
  'budget:warning': '⚠️ Budget Warning',
  'budget:exceeded': '🛑 Budget Exceeded',
  'budget:spawn_blocked': '🚫 Spawn Blocked',
  'task:failed': '❌ Task Failed',
  'agent:error': '🔴 Agent Error',
  'retry:exhausted': '⛔ Retry Exhausted',
  'circuit:opened': '🔴 Circuit Breaker',
  'qa:failed': '⚠️ QA Failed',
}

const severityColors = {
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/events/notifications`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length
  const hasErrors = notifications.some((n) => !n.read && n.severity === 'error')

  const markAsRead = async (id: number) => {
    try {
      await fetch(`${API_BASE}/events/notifications/${id}/read`, { method: 'POST' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch(`${API_BASE}/events/notifications/read-all`, { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div data-testid="notification-center" className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg hover:bg-gray-700 transition-colors ${
          hasErrors && unreadCount > 0 ? 'animate-pulse' : ''
        }`}
        aria-label="Notifications"
      >
        <svg
          className={`w-5 h-5 ${hasErrors && unreadCount > 0 ? 'text-red-400' : 'text-gray-300'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 ${hasErrors ? 'bg-red-500' : 'bg-yellow-500'} text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center text-gray-500">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-center text-gray-500">No notifications</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`p-3 border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/50 transition-colors ${
                    !notification.read ? 'bg-gray-700/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        severityColors[notification.severity]
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-white truncate">
                          {typeToTitle[notification.type] || notification.type}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatTime(notification.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.taskId && (
                        <span className="text-xs text-blue-400 mt-1 inline-block">
                          Task: {notification.taskId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-2 border-t border-gray-700 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationCenter
