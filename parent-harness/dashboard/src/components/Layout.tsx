import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NotificationCenter } from './NotificationCenter'

function NavLinks() {
  const location = useLocation()
  
  const links = [
    { path: '/', label: 'Dashboard' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/sessions', label: 'Sessions' },
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
  leftPanel?: ReactNode
  rightPanel?: ReactNode
}

export function Layout({ children, leftPanel, rightPanel }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header 
        data-testid="layout-header"
        className="h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between"
      >
        <div className="flex items-center gap-4">
          {/* Notification center - top left */}
          <NotificationCenter />
          <h1 className="text-xl font-semibold text-blue-400">Parent Harness</h1>
        </div>
        <NavLinks />
      </header>

      {/* Main content - 3 column grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4">
        {/* Left sidebar - Agent Status */}
        <aside 
          data-testid="layout-left"
          className="col-span-3 bg-gray-800 rounded-lg p-4 overflow-y-auto"
        >
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Agent Status
          </h2>
          {leftPanel}
        </aside>

        {/* Main content - Event Stream */}
        <main 
          data-testid="layout-main"
          className="col-span-6 bg-gray-800 rounded-lg p-4 overflow-y-auto"
        >
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Event Stream
          </h2>
          {children}
        </main>

        {/* Right sidebar - Task Queue */}
        <aside 
          data-testid="layout-right"
          className="col-span-3 bg-gray-800 rounded-lg p-4 overflow-y-auto"
        >
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Task Queue
          </h2>
          {rightPanel}
        </aside>
      </div>
    </div>
  )
}

export default Layout
