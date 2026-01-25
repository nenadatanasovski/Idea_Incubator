// =============================================================================
// FILE: frontend/src/components/ideation/MessageList.tsx
// Message list component
// =============================================================================

import { useEffect, useRef } from "react";
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
  highlightedMessageId,
}: MessageListProps) {
  const highlightedRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted message when navigating from graph
  useEffect(() => {
    if (highlightedMessageId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlightedMessageId]);

  return (
    <div className="message-list space-y-4">
      {messages.map((message, index) => {
        const isLatest = index === messages.length - 1;
        const showSubAgents =
          subAgents.length > 0 && message.id === triggerMessageId;
        const isHighlighted = message.id === highlightedMessageId;

        if (message.role === "assistant") {
          return (
            <div
              key={message.id}
              ref={isHighlighted ? highlightedRef : undefined}
              className={
                isHighlighted
                  ? "ring-2 ring-blue-400 ring-offset-2 rounded-lg transition-all duration-300"
                  : ""
              }
            >
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
          <div
            key={message.id}
            ref={isHighlighted ? highlightedRef : undefined}
            className={
              isHighlighted
                ? "ring-2 ring-blue-400 ring-offset-2 rounded-lg transition-all duration-300"
                : ""
            }
          >
            <UserMessage
              message={message}
              onEdit={onEditMessage}
              isEditable={!isLoading}
              onConvertToArtifact={onConvertToArtifact}
            />
          </div>
        );
      })}
    </div>
  );
}

export default MessageList;
