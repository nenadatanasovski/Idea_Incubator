// =============================================================================
// FILE: frontend/src/components/ideation/AgentMessage.tsx
// Agent message component with buttons/form support
// =============================================================================

import 'react';
import { Bot } from 'lucide-react';
import { MessageText } from './MessageText';
import { ButtonGroup } from './ButtonGroup';
import { FormRenderer } from './FormRenderer';
import { SourceCitations } from './SourceCitations';
import type { AgentMessageProps } from '../../types/ideation';

export function AgentMessage({
  message,
  onButtonClick,
  onFormSubmit,
  isLatest,
}: AgentMessageProps) {
  return (
    <div className="agent-message flex gap-3">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5 text-blue-600" />
        </div>
      </div>
      <div className="flex-1 space-y-3 max-w-[85%]">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <MessageText content={message.content} />
        </div>

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
      </div>
    </div>
  );
}

export default AgentMessage;
