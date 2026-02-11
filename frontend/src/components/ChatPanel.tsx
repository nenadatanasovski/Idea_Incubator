// =============================================================================
// ChatPanel.tsx
// Reusable chat panel for the unified layout
// Wraps existing ideation chat components with a consistent interface
// =============================================================================

import { ReactNode } from "react";
import { Loader2, Send } from "lucide-react";
import clsx from "clsx";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "agent-activity";
  content: string;
  timestamp?: Date;
  agentType?: string;
  isStreaming?: boolean;
}

interface ChatPanelProps {
  title?: string;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  agentActivity?: string;
  children?: ReactNode; // For custom message rendering
}

export function ChatPanel({
  title = "Chat",
  messages,
  onSendMessage,
  isLoading = false,
  isStreaming = false,
  placeholder = "Type a message...",
  agentActivity,
}: ChatPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-3 shrink-0">
        <span className="font-medium text-gray-700">{title}</span>
        {isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* Agent Activity Banner */}
      {agentActivity && (
        <div className="px-3 py-2 bg-blue-50 border-b text-sm flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          <span className="text-blue-700">{agentActivity}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isLoading || isStreaming}
        placeholder={placeholder}
      />
    </div>
  );
}

// Individual message bubble
function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAgentActivity = message.role === "agent-activity";

  if (isAgentActivity) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded text-sm text-gray-600">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <span>{message.content}</span>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="text-center py-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-800",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

// Input component
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("message") as HTMLTextAreaElement;
    const message = input.value.trim();

    if (message && !disabled) {
      onSend(message);
      input.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-3">
      <div className="flex gap-2">
        <textarea
          name="message"
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          className={clsx(
            "flex-1 resize-none rounded-md border px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "placeholder:text-gray-400",
            disabled && "bg-gray-50 cursor-not-allowed",
          )}
        />
        <button
          type="submit"
          disabled={disabled}
          className={clsx(
            "px-3 py-2 rounded-md transition",
            "bg-primary-600 text-white hover:bg-primary-700",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}

export default ChatPanel;
