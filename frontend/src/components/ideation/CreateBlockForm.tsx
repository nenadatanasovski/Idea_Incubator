/**
 * Create Block Form
 *
 * Form to create new memory blocks in the Neo4j graph.
 */

import React, { useState, useCallback } from "react";
import type { BlockType, MemoryBlockCreate } from "../../api/memory-graph";
import { memoryGraph } from "../../api/memory-graph";

interface CreateBlockFormProps {
  sessionId: string;
  ideaId?: string;
  onBlockCreated?: (block: { id: string; type: BlockType }) => void;
  onCancel?: () => void;
}

const BLOCK_TYPES: {
  value: BlockType;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "knowledge",
    label: "Knowledge",
    icon: "📚",
    description: "Verified facts, patterns, insights",
  },
  {
    value: "decision",
    label: "Decision",
    icon: "⚖️",
    description: "Choices made with rationale",
  },
  {
    value: "assumption",
    label: "Assumption",
    icon: "🤔",
    description: "Unverified beliefs to test",
  },
  {
    value: "question",
    label: "Question",
    icon: "❓",
    description: "Open unknowns to investigate",
  },
  {
    value: "requirement",
    label: "Requirement",
    icon: "📋",
    description: "Constraints, must-haves",
  },
  {
    value: "task",
    label: "Task",
    icon: "✅",
    description: "Work items, actions",
  },
  {
    value: "proposal",
    label: "Proposal",
    icon: "💡",
    description: "Suggested changes awaiting approval",
  },
  {
    value: "artifact",
    label: "Artifact",
    icon: "📦",
    description: "Outputs (code, docs, specs)",
  },
  {
    value: "evidence",
    label: "Evidence",
    icon: "🔍",
    description: "Validation data, proof",
  },
];

export function CreateBlockForm({
  sessionId,
  ideaId,
  onBlockCreated,
  onCancel,
}: CreateBlockFormProps) {
  const [type, setType] = useState<BlockType>("knowledge");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!content.trim()) {
        setError("Content is required");
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const data: MemoryBlockCreate = {
          type,
          title: title.trim() || undefined,
          content: content.trim(),
          session_id: sessionId,
          idea_id: ideaId,
          status: "active",
        };

        const block = await memoryGraph.createBlock(data);
        onBlockCreated?.({ id: block.id, type: block.type });

        // Reset form
        setTitle("");
        setContent("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create block");
      } finally {
        setIsSubmitting(false);
      }
    },
    [type, title, content, sessionId, ideaId, onBlockCreated],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 bg-white rounded-lg shadow-sm border"
    >
      <h3 className="text-lg font-semibold">Create Memory Block</h3>

      {/* Block Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Block Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {BLOCK_TYPES.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`p-2 text-sm rounded-lg border transition-colors ${
                type === value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="mr-1">{icon}</span>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {BLOCK_TYPES.find((t) => t.value === type)?.description}
        </p>
      </div>

      {/* Title (optional) */}
      <div>
        <label
          htmlFor="block-title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Title <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="block-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Short descriptive title..."
        />
      </div>

      {/* Content (required) */}
      <div>
        <label
          htmlFor="block-content"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Content <span className="text-red-500">*</span>
        </label>
        <textarea
          id="block-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="The main content of this block..."
          required
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Creating..." : "Create Block"}
        </button>
      </div>
    </form>
  );
}

export default CreateBlockForm;
