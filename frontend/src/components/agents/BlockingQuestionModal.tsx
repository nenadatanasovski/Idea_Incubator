/**
 * BlockingQuestionModal - QUE-001
 *
 * Modal that interrupts UI flow when a blocking question needs immediate attention.
 * Features:
 * - Urgent visual styling (red border, attention-grabbing)
 * - Shows agent context (which agent, which task)
 * - Quick answer options
 * - Free-text input for custom answers
 * - Cannot be dismissed without answering (except via "Skip" with confirmation)
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Send, Sparkles, Bot, MessageSquare, X } from 'lucide-react';

export interface BlockingQuestion {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  type: 'BLOCKING' | 'APPROVAL' | 'ESCALATION' | 'DECISION';
  content: string;
  options: { label: string; value: string; description?: string }[];
  defaultOption?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  taskId?: string;
  taskDescription?: string;
  projectName?: string;
  taskListName?: string;
  createdAt: string;
  expiresAt?: string;
  context?: Record<string, unknown>;
}

interface BlockingQuestionModalProps {
  question: BlockingQuestion;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
  onSkip?: (questionId: string, reason: string) => Promise<void>;
  onClose?: () => void; // Only available for non-blocking questions
}

const AGENT_COLORS: Record<string, string> = {
  build: 'bg-blue-500',
  spec: 'bg-purple-500',
  validation: 'bg-green-500',
  monitoring: 'bg-orange-500',
  orchestrator: 'bg-indigo-500',
  sia: 'bg-pink-500',
  ux: 'bg-cyan-500',
  default: 'bg-gray-500',
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  BLOCKING: { label: 'Blocking', color: 'bg-red-100 text-red-700 border-red-200' },
  APPROVAL: { label: 'Approval Required', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  ESCALATION: { label: 'Escalation', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  DECISION: { label: 'Decision Required', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

function formatTimeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function getTimeRemaining(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Expired';
  if (remaining < 60000) return `${Math.floor(remaining / 1000)}s left`;
  if (remaining < 3600000) return `${Math.floor(remaining / 60000)}m left`;
  return `${Math.floor(remaining / 3600000)}h left`;
}

export default function BlockingQuestionModal({
  question,
  onAnswer,
  onSkip,
  onClose,
}: BlockingQuestionModalProps): JSX.Element {
  const [customAnswer, setCustomAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const agentColor = AGENT_COLORS[question.agentType] || AGENT_COLORS.default;
  const typeInfo = TYPE_LABELS[question.type] || TYPE_LABELS.BLOCKING;
  const isBlocking = question.type === 'BLOCKING' || question.type === 'APPROVAL';

  // Update time remaining
  useEffect(() => {
    if (!question.expiresAt) return;

    const updateTime = () => {
      setTimeRemaining(getTimeRemaining(question.expiresAt));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [question.expiresAt]);

  const handleOptionClick = async (value: string) => {
    setIsSubmitting(true);
    try {
      await onAnswer(question.id, value);
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async () => {
    if (!customAnswer.trim()) return;
    setIsSubmitting(true);
    try {
      await onAnswer(question.id, customAnswer.trim());
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!onSkip) return;
    setIsSubmitting(true);
    try {
      await onSkip(question.id, skipReason || 'Skipped by user');
      setShowSkipConfirm(false);
    } catch (error) {
      console.error('Failed to skip question:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 border-2 ${
          isBlocking ? 'border-red-400 animate-pulse-subtle' : 'border-orange-300'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b ${isBlocking ? 'bg-red-50' : 'bg-orange-50'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${agentColor} flex items-center justify-center`}>
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{question.agentName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimeAgo(question.createdAt)}</span>
                  {timeRemaining && (
                    <span className={`font-medium ${timeRemaining === 'Expired' ? 'text-red-600' : 'text-orange-600'}`}>
                      {timeRemaining}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!isBlocking && onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Context Info */}
          {(question.projectName || question.taskId) && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {question.projectName && (
                <span className="bg-white px-2 py-1 rounded border border-gray-200">
                  <Sparkles className="h-3 w-3 inline mr-1 text-purple-500" />
                  {question.projectName}
                </span>
              )}
              {question.taskId && (
                <span className="bg-white px-2 py-1 rounded border border-gray-200 font-mono">
                  {question.taskId}
                </span>
              )}
              {question.taskListName && (
                <span className="bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">
                  {question.taskListName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Question Content */}
        <div className="p-4">
          {isBlocking && (
            <div className="flex items-center gap-2 mb-3 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Agent is blocked until this is answered</span>
            </div>
          )}

          <p className="text-gray-900 mb-4">{question.content}</p>

          {/* Task Description if available */}
          {question.taskDescription && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm">
              <span className="font-medium text-gray-700">Related Task: </span>
              <span className="text-gray-600">{question.taskDescription}</span>
            </div>
          )}

          {/* Quick Options */}
          {question.options.length > 0 && !showSkipConfirm && (
            <div className="space-y-2 mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Options
              </label>
              {question.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(option.value)}
                  disabled={isSubmitting}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    option.value === question.defaultOption
                      ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{option.label}</span>
                    {option.value === question.defaultOption && (
                      <span className="text-xs text-blue-600 font-medium">Recommended</span>
                    )}
                  </div>
                  {option.description && (
                    <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Custom Answer */}
          {!showSkipConfirm && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="h-4 w-4 inline mr-1" />
                Custom Answer
              </label>
              <textarea
                value={customAnswer}
                onChange={(e) => setCustomAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={3}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customAnswer.trim() || isSubmitting}
                  className="btn btn-primary text-sm disabled:opacity-50"
                >
                  <Send className="h-4 w-4 mr-1" />
                  {isSubmitting ? 'Sending...' : 'Send Answer'}
                </button>
              </div>
            </div>
          )}

          {/* Skip Confirmation */}
          {showSkipConfirm && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800 mb-3">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Skipping a blocking question may cause the agent to use a default answer or fail the task.
              </p>
              <textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="Reason for skipping (optional)..."
                rows={2}
                className="w-full px-3 py-2 border border-yellow-300 rounded-lg mb-3 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="btn bg-yellow-600 text-white hover:bg-yellow-700 text-sm"
                >
                  {isSubmitting ? 'Skipping...' : 'Confirm Skip'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showSkipConfirm && onSkip && (
          <div className="px-4 pb-4 flex justify-between items-center">
            <button
              onClick={() => setShowSkipConfirm(true)}
              disabled={isSubmitting}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip this question...
            </button>
            {question.defaultOption && (
              <span className="text-xs text-gray-400">
                Default after timeout: {question.defaultOption}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
