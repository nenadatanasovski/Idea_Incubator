// =============================================================================
// FILE: frontend/src/components/ideation/InputArea.tsx
// Input area for sending messages
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import type { InputAreaProps } from '../../types/ideation';

export function InputArea({
  onSend,
  onStop,
  disabled,
  isLoading = false,
  placeholder = 'Type a message...',
}: InputAreaProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset to minimum height first to get accurate scrollHeight
      textarea.style.height = '48px';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 48), 150);
      textarea.style.height = `${newHeight}px`;
      // Only show scrollbar when at max height
      textarea.style.overflowY = newHeight >= 150 ? 'auto' : 'hidden';
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const isSubmitDisabled = disabled || !value.trim();

  return (
    <div className="input-area border-t border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <textarea
          ref={textareaRef}
          role="textbox"
          data-testid="message-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:bg-gray-100 disabled:text-gray-500
                     placeholder:text-gray-400"
          style={{ height: '48px', overflowY: 'hidden' }}
        />
        {isLoading && onStop ? (
          <button
            role="button"
            data-testid="stop-message-btn"
            onClick={onStop}
            aria-label="Stop"
            className="h-12 w-12 flex items-center justify-center bg-red-600 text-white rounded-lg hover:bg-red-700
                       transition-colors flex-shrink-0
                       focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
        ) : (
          <button
            role="button"
            data-testid="send-message-btn"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            aria-label="Send"
            className="h-12 w-12 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700
                       disabled:bg-gray-300 disabled:cursor-not-allowed
                       transition-colors flex-shrink-0
                       focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

export default InputArea;
