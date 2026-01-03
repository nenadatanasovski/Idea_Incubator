// =============================================================================
// FILE: frontend/src/components/ideation/AgentMessage.tsx
// Agent message component with buttons/form support
// =============================================================================

import 'react';
import { Bot, FileText } from 'lucide-react';
import { MessageText } from './MessageText';
import { ButtonGroup } from './ButtonGroup';
import { FormRenderer } from './FormRenderer';
import { SourceCitations } from './SourceCitations';
import type { AgentMessageProps } from '../../types/ideation';

// Format timestamp for display
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return timeStr;
  }

  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
}

export function AgentMessage({
  message,
  onButtonClick,
  onFormSubmit,
  isLatest,
  onArtifactClick,
  onConvertToArtifact,
}: AgentMessageProps) {
  const handleConvertToArtifact = () => {
    if (onConvertToArtifact) {
      // Generate a title from the first line or first 50 chars
      const firstLine = message.content.split('\n')[0];
      const title = firstLine.length > 50
        ? firstLine.substring(0, 47) + '...'
        : firstLine || 'Agent Response';
      onConvertToArtifact(message.content, title);
    }
  };

  return (
    <div className="agent-message space-y-3">
      <div className="flex gap-2 items-start">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div className="flex-1 max-w-[85%] min-w-0 overflow-hidden">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 overflow-hidden">
            <MessageText content={message.content} onArtifactClick={onArtifactClick} />
          </div>
        </div>
        {/* Save as artifact button - sticky positioning */}
        {onConvertToArtifact && (
          <div className="sticky top-4 self-start flex-shrink-0">
            <button
              onClick={handleConvertToArtifact}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-500 hover:text-gray-700 transition-all shadow-sm border border-gray-200 hover:shadow"
            >
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium">Save</span>
            </button>
          </div>
        )}
      </div>

      {/* Additional content below the main message row */}
      <div className="ml-11 space-y-3">
        {message.buttons && message.buttons.length > 0 && (
          <ButtonGroup
            buttons={message.buttons}
            onSelect={onButtonClick}
            disabled={!isLatest || !!message.buttonClicked}
            selectedId={message.buttonClicked}
          />
        )}

        {message.form && isLatest && (
          <FormRenderer
            form={message.form}
            onSubmit={(answers) => onFormSubmit(message.form!.id, answers)}
            onCancel={() => {}}
            disabled={false}
          />
        )}

        {message.webSearchResults && message.webSearchResults.length > 0 && (
          <SourceCitations sources={message.webSearchResults} />
        )}

        {/* Timestamp at the bottom */}
        <div className="text-xs text-gray-400">
          {formatTimestamp(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

export default AgentMessage;
