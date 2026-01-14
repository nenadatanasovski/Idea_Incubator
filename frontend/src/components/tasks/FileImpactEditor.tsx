/**
 * FileImpactEditor Component
 *
 * Allows users to view and edit file impacts for a task.
 * Supports AI estimates, pattern matches, and user overrides.
 *
 * Features:
 * - View predicted file impacts with confidence scores
 * - Add/remove file impacts manually (user override)
 * - Visual indicators for source (AI, pattern, user)
 * - Real-time parallelism recalculation on changes
 *
 * Part of: PTE-123, PTE-136
 */

import { useState, useEffect, useCallback } from 'react';
import {
  File,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Brain,
  User,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
} from 'lucide-react';
import type { FileImpact, FileOperation, FileImpactSource } from '../../types/task-agent';

interface FileImpactEditorProps {
  /** Task ID to manage file impacts for */
  taskId: string;
  /** Task display ID for reference */
  taskDisplayId?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when impacts change */
  onChange?: (impacts: FileImpact[]) => void;
  /** Compact display mode */
  compact?: boolean;
}

// Operation colors and icons
const OPERATION_CONFIG: Record<FileOperation, { color: string; bg: string; label: string }> = {
  CREATE: { color: 'text-green-700', bg: 'bg-green-100', label: 'Create' },
  UPDATE: { color: 'text-blue-700', bg: 'bg-blue-100', label: 'Update' },
  DELETE: { color: 'text-red-700', bg: 'bg-red-100', label: 'Delete' },
  READ: { color: 'text-gray-700', bg: 'bg-gray-100', label: 'Read' },
};

// Source icons and labels
const SOURCE_CONFIG: Record<FileImpactSource, { icon: React.ReactNode; label: string; color: string }> = {
  ai_estimate: { icon: <Brain className="h-3 w-3" />, label: 'AI Estimate', color: 'text-purple-600' },
  pattern_match: { icon: <Clock className="h-3 w-3" />, label: 'Pattern', color: 'text-blue-600' },
  user_declared: { icon: <User className="h-3 w-3" />, label: 'User', color: 'text-green-600' },
  validated: { icon: <CheckCircle className="h-3 w-3" />, label: 'Validated', color: 'text-emerald-600' },
};

export default function FileImpactEditor({
  taskId,
  taskDisplayId: _taskDisplayId,
  readOnly = false,
  onChange,
  compact = false,
}: FileImpactEditorProps): JSX.Element {
  // taskDisplayId is available for future use (e.g., display in UI)
  void _taskDisplayId;
  const [impacts, setImpacts] = useState<FileImpact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  // New impact form state
  const [newFilePath, setNewFilePath] = useState('');
  const [newOperation, setNewOperation] = useState<FileOperation>('UPDATE');
  const [newConfidence, setNewConfidence] = useState(1.0);

  // Fetch file impacts
  const fetchImpacts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/task-agent/tasks/${taskId}/file-impacts`);
      if (!response.ok) {
        throw new Error('Failed to fetch file impacts');
      }
      const data: FileImpact[] = await response.json();
      setImpacts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Initial fetch
  useEffect(() => {
    fetchImpacts();
  }, [fetchImpacts]);

  // Add new file impact
  const handleAddImpact = async () => {
    if (!newFilePath.trim()) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/task-agent/tasks/${taskId}/file-impacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: newFilePath.trim(),
          operation: newOperation,
          confidence: newConfidence,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add file impact');
      }

      // Consume response (we'll refresh from server)
      await response.json();

      // Refresh impacts
      await fetchImpacts();
      onChange?.(impacts);

      // Reset form
      setNewFilePath('');
      setNewOperation('UPDATE');
      setNewConfidence(1.0);
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  // Remove file impact
  const handleRemoveImpact = async (impact: FileImpact) => {
    if (readOnly) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/task-agent/tasks/${taskId}/file-impacts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: impact.filePath,
          operation: impact.operation,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove file impact');
      }

      // Refresh impacts
      await fetchImpacts();
      onChange?.(impacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  // Confidence bar
  const ConfidenceBar = ({ confidence }: { confidence: number }) => (
    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          confidence >= 0.8
            ? 'bg-green-500'
            : confidence >= 0.5
            ? 'bg-yellow-500'
            : 'bg-red-500'
        }`}
        style={{ width: `${confidence * 100}%` }}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={fetchImpacts}
          className="mt-2 text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  // Compact header for collapsed view
  const header = (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        <File className="h-4 w-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          File Impacts
        </span>
        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
          {impacts.length}
        </span>
      </div>
      {expanded ? (
        <ChevronUp className="h-4 w-4 text-gray-400" />
      ) : (
        <ChevronDown className="h-4 w-4 text-gray-400" />
      )}
    </button>
  );

  if (compact && !expanded) {
    return header;
  }

  return (
    <div className="space-y-3">
      {compact && header}

      {/* Impact List */}
      <div className="space-y-2">
        {impacts.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            No file impacts predicted
          </div>
        ) : (
          impacts.map((impact) => {
            const opConfig = OPERATION_CONFIG[impact.operation];
            const sourceConfig = SOURCE_CONFIG[impact.source];

            return (
              <div
                key={impact.id}
                className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Operation Badge */}
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${opConfig.bg} ${opConfig.color}`}>
                    {opConfig.label}
                  </span>

                  {/* File Path */}
                  <span className="text-sm text-gray-700 font-mono truncate">
                    {impact.filePath}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Source */}
                  <div className={`flex items-center gap-1 text-xs ${sourceConfig.color}`}>
                    {sourceConfig.icon}
                    <span>{sourceConfig.label}</span>
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center gap-1">
                    <ConfidenceBar confidence={impact.confidence} />
                    <span className="text-xs text-gray-500 w-8 text-right">
                      {Math.round(impact.confidence * 100)}%
                    </span>
                  </div>

                  {/* Remove Button */}
                  {!readOnly && (
                    <button
                      onClick={() => handleRemoveImpact(impact)}
                      disabled={saving}
                      className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Form */}
      {!readOnly && (
        <>
          {showAddForm ? (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="path/to/file.ts"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                />
                <select
                  value={newOperation}
                  onChange={(e) => setNewOperation(e.target.value as FileOperation)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                >
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                  <option value="READ">Read</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Confidence:</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newConfidence * 100}
                    onChange={(e) => setNewConfidence(parseInt(e.target.value) / 100)}
                    className="w-24"
                  />
                  <span className="text-xs text-gray-600 w-8">
                    {Math.round(newConfidence * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddImpact}
                    disabled={saving || !newFilePath.trim()}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">Add File Impact</span>
            </button>
          )}
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {impacts.filter((i) => i.source === 'user_declared').length} user overrides
        </span>
        <button
          onClick={fetchImpacts}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
    </div>
  );
}

export { FileImpactEditor };
