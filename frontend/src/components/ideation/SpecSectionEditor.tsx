/**
 * SpecSectionEditor Component
 *
 * Editable text area for spec sections with auto-save.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-006-B)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Check, AlertCircle } from "lucide-react";
import type { SpecSectionEditorProps } from "../../types/spec";

// Debounce timeout for auto-save
const AUTO_SAVE_DELAY = 1000;

export const SpecSectionEditor: React.FC<SpecSectionEditorProps> = ({
  section,
  isEditing,
  onChange,
  onSave,
  onCancel: _onCancel,
  showConfidence = true,
}) => {
  // Note: onCancel is available for future use (e.g., escape key handler)
  void _onCancel;
  const [localContent, setLocalContent] = useState(section?.content || "");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update local content when section changes
  useEffect(() => {
    if (section) {
      setLocalContent(section.content);
      setHasChanges(false);
    }
  }, [section?.id, section?.content]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localContent]);

  // Handle content change with auto-save
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setLocalContent(newContent);
      setHasChanges(newContent !== section?.content);

      // Notify parent of change
      onChange(newContent);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new auto-save timeout
      saveTimeoutRef.current = setTimeout(async () => {
        if (newContent !== section?.content) {
          setIsSaving(true);
          try {
            await onSave();
            setHasChanges(false);
          } finally {
            setIsSaving(false);
          }
        }
      }, AUTO_SAVE_DELAY);
    },
    [section?.content, onChange, onSave],
  );

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle blur - save immediately
  const handleBlur = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (hasChanges) {
      setIsSaving(true);
      try {
        await onSave();
        setHasChanges(false);
      } finally {
        setIsSaving(false);
      }
    }
  }, [hasChanges, onSave]);

  if (!section) {
    return (
      <div className="text-sm text-gray-400 italic p-3 bg-gray-50 rounded">
        No content available
      </div>
    );
  }

  // View mode
  if (!isEditing) {
    return (
      <div className="relative">
        <div className="text-sm text-gray-700 whitespace-pre-wrap">
          {section.content || (
            <span className="text-gray-400 italic">No content</span>
          )}
        </div>
        {showConfidence && section.needsReview && (
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="w-3.5 h-3.5" />
            Low confidence - review recommended
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-full min-h-[100px] p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          hasChanges
            ? "border-amber-400 bg-amber-50"
            : "border-gray-200 bg-white"
        }`}
        placeholder="Enter content..."
      />

      {/* Status indicators */}
      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        {isSaving && (
          <span className="text-xs text-blue-500 animate-pulse">Saving...</span>
        )}
        {hasChanges && !isSaving && (
          <span className="text-xs text-amber-600">Unsaved changes</span>
        )}
        {!hasChanges && !isSaving && localContent && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="w-3 h-3" />
            Saved
          </span>
        )}
      </div>

      {/* Confidence indicator */}
      {showConfidence && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-400">
            {section.confidenceScore}% confidence
          </span>
          {section.needsReview && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertCircle className="w-3 h-3" />
              Needs review
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default SpecSectionEditor;
