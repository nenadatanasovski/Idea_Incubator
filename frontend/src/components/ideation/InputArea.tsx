// =============================================================================
// FILE: frontend/src/components/ideation/InputArea.tsx
// Input area for sending messages
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import type { InputAreaProps } from '../../types/ideation';

export function InputArea({
  onSend,
  disabled,
  placeholder = 'Type a message...',
}: InputAreaProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
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
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       disabled:bg-gray-100 disabled:text-gray-500
                       placeholder:text-gray-400"
            style={{ minHeight: '48px', maxHeight: '150px' }}
          />
        </div>
        <button
          role="button"
          data-testid="send-message-btn"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          aria-label="Send"
          className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                     disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors flex-shrink-0
                     focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

export default InputArea;
