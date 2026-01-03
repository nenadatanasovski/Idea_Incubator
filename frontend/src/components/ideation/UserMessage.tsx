// =============================================================================
// FILE: frontend/src/components/ideation/UserMessage.tsx
// User message component with edit functionality
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import { User, Pencil, Check, X, FileText } from 'lucide-react';
import type { UserMessageProps } from '../../types/ideation';

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

export function UserMessage({ message, onEdit, isEditable = true, onConvertToArtifact }: UserMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing]);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      // Reset height to auto to get accurate scrollHeight
      textareaRef.current.style.height = 'auto';
      // Set height to scrollHeight with a minimum
      const minHeight = 80; // Minimum height in pixels
      const maxHeight = 400; // Maximum height before scrolling
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
      // Enable scrolling if content exceeds max height
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [editContent, isEditing]);

  const handleStartEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onEdit) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="user-message flex gap-2 justify-end items-start">
      {/* Action buttons - sticky positioning with labels */}
      {!isEditing && (
        <div className="sticky top-4 self-start flex items-center gap-2">
          {onConvertToArtifact && (
            <button
              onClick={() => {
                const firstLine = message.content.split('\n')[0];
                const title = firstLine.length > 50
                  ? firstLine.substring(0, 47) + '...'
                  : firstLine || 'User Message';
                onConvertToArtifact(message.content, title);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-500 hover:text-gray-700 transition-all shadow-sm border border-gray-200 hover:shadow"
            >
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium">Save</span>
            </button>
          )}
          {isEditable && onEdit && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-500 hover:text-gray-700 transition-all shadow-sm border border-gray-200 hover:shadow"
            >
              <Pencil className="w-4 h-4" />
              <span className="text-xs font-medium">Edit</span>
            </button>
          )}
        </div>
      )}
      <div className={isEditing ? "flex-1 max-w-[90%]" : "max-w-[80%]"}>
        <div className="bg-blue-600 text-white rounded-lg p-4 ml-auto">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-blue-700 text-white rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-white/50 overflow-hidden"
                style={{ minHeight: '80px', minWidth: '400px' }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 rounded hover:bg-blue-700 transition-colors"
                  title="Cancel (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="p-1.5 rounded hover:bg-blue-700 transition-colors"
                  title="Save (Enter)"
                  disabled={!editContent.trim()}
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <div className="mt-1 mr-1 text-xs text-gray-400 text-right">
          {formatTimestamp(message.createdAt)}
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-gray-600" />
        </div>
      </div>
    </div>
  );
}

export default UserMessage;
