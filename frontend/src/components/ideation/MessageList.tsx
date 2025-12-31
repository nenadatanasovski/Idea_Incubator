// =============================================================================
// FILE: frontend/src/components/ideation/MessageList.tsx
// Message list component
// =============================================================================

import 'react';
import { AgentMessage } from './AgentMessage';
import { UserMessage } from './UserMessage';
import type { MessageListProps } from '../../types/ideation';

export function MessageList({
  messages,
  onButtonClick,
  onFormSubmit,
  isLoading,
}: MessageListProps) {
  return (
    <div className="message-list space-y-4">
      {messages.map((message, index) => {
        const isLatest = index === messages.length - 1;

        if (message.role === 'assistant') {
          return (
            <AgentMessage
              key={message.id}
              message={message}
              onButtonClick={onButtonClick}
              onFormSubmit={onFormSubmit}
              isLatest={isLatest && !isLoading}
            />
          );
        }

        return <UserMessage key={message.id} message={message} />;
      })}
    </div>
  );
}

export default MessageList;
