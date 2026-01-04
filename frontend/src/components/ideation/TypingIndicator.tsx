// =============================================================================
// FILE: frontend/src/components/ideation/TypingIndicator.tsx
// Typing indicator for when agent is responding
// =============================================================================

import { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import type { TypingIndicatorProps } from '../../types/ideation';

// Rotating status messages to make waiting feel shorter
const STATUS_MESSAGES = [
  'Thinking...',
  'Analyzing your input...',
  'Considering possibilities...',
  'Formulating response...',
  'Processing...',
  'Exploring ideas...',
  'Connecting concepts...',
  'Reasoning...',
];

export function TypingIndicator({ isVisible, streamingContent }: TypingIndicatorProps) {
  const [statusIndex, setStatusIndex] = useState(0);

  // Rotate through status messages when not streaming (8 seconds per message)
  useEffect(() => {
    if (!isVisible || streamingContent) return;

    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [isVisible, streamingContent]);

  // Reset status index when indicator becomes visible
  useEffect(() => {
    if (isVisible) {
      setStatusIndex(0);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  // Get display text - only show actual LLM output, otherwise use rotating status
  const displayText = streamingContent && streamingContent.trim()
    ? streamingContent.slice(-100) // Show last 100 chars of actual streaming content
    : STATUS_MESSAGES[statusIndex];

  return (
    <div className="typing-indicator flex gap-3">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5 text-blue-600" />
        </div>
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          {/* Bouncing dots */}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          {/* Status text */}
          <span className="text-sm text-gray-500 italic transition-opacity duration-300">
            {displayText}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;
