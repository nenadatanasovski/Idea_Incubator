/**
 * SpecSectionList Component
 *
 * Editable list for array fields (successCriteria, constraints, etc).
 * Supports add/remove/reorder with drag-and-drop.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-006-C)
 */

import React, { useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, Edit3, Check, X } from "lucide-react";
import type { SpecSectionListProps } from "../../types/spec";

export const SpecSectionList: React.FC<SpecSectionListProps> = ({
  items,
  isEditing,
  onAdd,
  onRemove,
  onReorder,
  onUpdate,
  placeholder = "Add item...",
}) => {
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Handle adding new item
  const handleAdd = useCallback(() => {
    if (newItem.trim()) {
      onAdd(newItem.trim());
      setNewItem("");
    }
  }, [newItem, onAdd]);

  // Handle key press in new item input
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && newItem.trim()) {
        e.preventDefault();
        handleAdd();
      }
    },
    [newItem, handleAdd],
  );

  // Start editing an item
  const startEditing = useCallback((index: number, value: string) => {
    setEditingIndex(index);
    setEditingValue(value);
  }, []);

  // Save edited item
  const saveEdit = useCallback(() => {
    if (editingIndex !== null && editingValue.trim()) {
      onUpdate(editingIndex, editingValue.trim());
    }
    setEditingIndex(null);
    setEditingValue("");
  }, [editingIndex, editingValue, onUpdate]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditingValue("");
  }, []);

  // Handle edit key press
  const handleEditKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveEdit();
      } else if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [saveEdit, cancelEdit],
  );

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Set drag image
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (
      dragIndex !== null &&
      dragOverIndex !== null &&
      dragIndex !== dragOverIndex
    ) {
      onReorder(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, onReorder]);

  // View mode
  if (!isEditing) {
    if (items.length === 0) {
      return <div className="text-sm text-gray-400 italic p-2">No items</div>;
    }

    return (
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex items-start gap-2 text-sm text-gray-700"
          >
            <span className="text-gray-400 mt-0.5">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Edit mode
  return (
    <div className="space-y-2">
      {/* Existing items */}
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li
            key={index}
            draggable={isEditing && editingIndex !== index}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
              dragIndex === index
                ? "opacity-50 bg-gray-100"
                : dragOverIndex === index
                  ? "bg-blue-50 border-t-2 border-blue-400"
                  : "bg-gray-50 hover:bg-gray-100"
            }`}
          >
            {/* Drag handle */}
            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />

            {/* Content */}
            {editingIndex === index ? (
              <input
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={handleEditKeyPress}
                onBlur={saveEdit}
                autoFocus
                className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            ) : (
              <span className="flex-1 text-sm text-gray-700">{item}</span>
            )}

            {/* Action buttons */}
            {editingIndex === index ? (
              <>
                <button
                  onClick={saveEdit}
                  className="p-1 text-green-600 hover:text-green-800"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEditing(index, item)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRemove(index)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* Add new item */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="flex items-center gap-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Help text */}
      {items.length > 1 && (
        <p className="text-xs text-gray-400">Drag items to reorder</p>
      )}
    </div>
  );
};

export default SpecSectionList;
