// =============================================================================
// FILE: frontend/src/components/ideation/MessageList.tsx
// Message list component
// =============================================================================

import "react";
import { AgentMessage } from "./AgentMessage";
import { UserMessage } from "./UserMessage";
import { SubAgentIndicator } from "./SubAgentIndicator";
import type { MessageListProps } from "../../types/ideation";

export function MessageList({
  messages,
  onButtonClick,
  onFormSubmit,
  onEditMessage,
  onArtifactClick,
  onConvertToArtifact,
  isLoading,
  subAgents = [],
  triggerMessageId,
}: MessageListProps) {
  return (
    <div className="message-list space-y-4">
      {messages.map((message, index) => {
        const isLatest = index === messages.length - 1;
        const showSubAgents =
          subAgents.length > 0 && message.id === triggerMessageId;

        if (message.role === "assistant") {
          return (
            <div key={message.id}>
              <AgentMessage
                message={message}
                onButtonClick={onButtonClick}
                onFormSubmit={onFormSubmit}
                isLatest={isLatest && !isLoading}
                onArtifactClick={onArtifactClick}
                onConvertToArtifact={onConvertToArtifact}
              />
              {showSubAgents && (
                <div className="mt-3 ml-12">
                  <SubAgentIndicator agents={subAgents} />
                </div>
              )}
            </div>
          );
        }

        return (
          <UserMessage
            key={message.id}
            message={message}
            onEdit={onEditMessage}
            isEditable={!isLoading}
            onConvertToArtifact={onConvertToArtifact}
          />
        );
      })}
    </div>
  );
}

export default MessageList;
