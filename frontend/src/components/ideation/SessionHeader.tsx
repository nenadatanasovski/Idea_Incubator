// =============================================================================
// FILE: frontend/src/components/ideation/SessionHeader.tsx
// Session header with token usage and actions
// =============================================================================

import { LogOut, Minimize2 } from 'lucide-react';
import { TokenUsageIndicator } from './TokenUsageIndicator';
import type { SessionHeaderProps } from '../../types/ideation';

export function SessionHeader({
  sessionId,
  tokenUsage,
  onAbandon,
  onMinimize,
}: SessionHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      {/* Left: Session info */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">I</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Ideation Session</h1>
          <p className="text-xs text-gray-500">
            Session: {sessionId.slice(0, 8)}...
          </p>
        </div>
      </div>

      {/* Center: Token usage */}
      <div className="flex-1 max-w-xs mx-8">
        <TokenUsageIndicator usage={tokenUsage} />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMinimize}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          title="Minimize"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
        <button
          onClick={onAbandon}
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          title="Abandon session"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

export default SessionHeader;
