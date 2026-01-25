// =============================================================================
// FILE: frontend/src/components/ideation/ConversationPanel.tsx
// Conversation panel with message list and input
// =============================================================================

import { useRef, useEffect } from "react";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { TypingIndicator } from "./TypingIndicator";
import type { ConversationPanelProps } from "../../types/ideation";

export function ConversationPanel({
  messages,
  isLoading,
  followUpPending = false,
  streamingContent,
  error,
  subAgents = [],
  triggerMessageId,
  highlightedMessageId,
  onSendMessage,
  onStopGeneration,
  onButtonClick,
  onFormSubmit,
  onEditMessage,
  onArtifactClick,
  onConvertToArtifact,
  onRetry,
}: ConversationPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or sub-agent updates
  // Skip if a specific message is highlighted (user navigating from graph)
  useEffect(() => {
    if (!highlightedMessageId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, subAgents, highlightedMessageId]);

  return (
    <div className="conversation-panel flex-1 flex flex-col bg-gray-50 border-r border-gray-200 min-w-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        <MessageList
          messages={messages}
          onButtonClick={onButtonClick}
          onFormSubmit={onFormSubmit}
          onEditMessage={onEditMessage}
          onArtifactClick={onArtifactClick}
          onConvertToArtifact={onConvertToArtifact}
          isLoading={isLoading}
          subAgents={subAgents}
          triggerMessageId={triggerMessageId}
          highlightedMessageId={highlightedMessageId}
        />
        <TypingIndicator
          isVisible={isLoading || followUpPending}
          streamingContent={streamingContent}
        />
        {error && (
          <div className="mx-4 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <div className="flex items-start gap-2">
              <span className="text-red-500 flex-shrink-0">!</span>
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <InputArea
        onSend={onSendMessage}
        onStop={onStopGeneration}
        disabled={isLoading}
        isLoading={isLoading}
        placeholder="Type your message..."
      />
    </div>
  );
}

export default ConversationPanel;
