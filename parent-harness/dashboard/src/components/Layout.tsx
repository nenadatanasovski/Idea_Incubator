import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NotificationCenter } from './NotificationCenter'
import { BudgetIndicator } from './BudgetIndicator'
import { ServerToggle } from './ServerToggle'

function NavLinks() {
  const location = useLocation()

  const links = [
    { path: '/', label: 'Dashboard' },
    { path: '/agents', label: '🤖 Agents' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/sessions', label: 'Sessions' },
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
          <NotificationCenter />
          <BudgetIndicator />
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
