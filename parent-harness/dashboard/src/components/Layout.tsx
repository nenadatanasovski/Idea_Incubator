import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NotificationCenter } from './NotificationCenter'
import { BudgetIndicator } from './BudgetIndicator'
import { ServerToggle } from './ServerToggle'
import { HealthIndicator } from './HealthIndicator'

const API_BASE = 'http://localhost:3333/api'

function BlockedTasksIndicator() {
  const [blockedCount, setBlockedCount] = useState(0)

  const fetchBlocked = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks?status=blocked`)
      if (res.ok) {
        const data = await res.json()
        setBlockedCount(Array.isArray(data) ? data.length : data.tasks?.length ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch blocked tasks:', err)
    }
  }, [])

  useEffect(() => {
    fetchBlocked()
    const interval = setInterval(fetchBlocked, 30000)
    return () => clearInterval(interval)
  }, [fetchBlocked])

  if (blockedCount === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-900/50 border border-orange-700 rounded-lg">
      <span className="text-orange-400">🚫</span>
      <span className="text-sm font-medium text-orange-300">{blockedCount} blocked</span>
    </div>
  )
}

function NavLinks() {
  const location = useLocation()

  const links = [
    { path: '/', label: 'Dashboard' },
    { path: '/agents', label: '🤖 Agents' },
    { path: '/activity', label: '📊 Activity' },
    { path: '/waves', label: '🌊 Waves' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/sessions', label: 'Sessions' },
    { path: '/telegram', label: '📱 Telegram' },
    { path: '/cron', label: '⏰ Cron' },
    { path: '/events', label: '📡 Events' },
    { path: '/system', label: '⚡ System' },
    { path: '/config', label: '⚙️ Config' },
  ]

  return (
    <nav className="flex gap-4">
      {links.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className={`transition-colors ${
            location.pathname === link.path
              ? 'text-white font-medium'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header
        data-testid="layout-header"
        className="h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between"
      >
        <div className="flex items-center gap-4">
          <HealthIndicator />
          <NotificationCenter />
          <BudgetIndicator />
          <BlockedTasksIndicator />
          <ServerToggle />
          <h1 className="text-xl font-semibold text-blue-400">Parent Harness</h1>
        </div>
        <NavLinks />
      </header>

      {/* Full-width content area - each page owns its layout */}
      <main
        data-testid="layout-main"
        className="flex-1 overflow-y-auto p-4"
      >
        {children}
      </main>
    </div>
  )
}

export default Layout
