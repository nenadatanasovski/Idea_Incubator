import { useState } from "react";
import {
  X,
  DollarSign,
  AlertTriangle,
  Play,
  MessageSquare,
} from "lucide-react";
import clsx from "clsx";

interface EvaluationSettingsModalProps {
  onStart: (settings: {
    budget: number;
    unlimited: boolean;
    debateRounds: number;
  }) => void;
  onClose: () => void;
  loading?: boolean;
  initialBudget?: number;
  initialDebateRounds?: number;
}

export default function EvaluationSettingsModal({
  onStart,
  onClose,
  loading = false,
  initialBudget = 15,
  initialDebateRounds = 1,
}: EvaluationSettingsModalProps) {
  const [budget, setBudget] = useState(initialBudget);
  const [unlimited, setUnlimited] = useState(false);
  const [debateRounds, setDebateRounds] = useState(initialDebateRounds);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({ budget, unlimited, debateRounds });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Evaluation Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Budget Input */}
            <div>
              <label
                htmlFor="budget"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Budget (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  id="budget"
                  min="1"
                  max="100"
                  step="1"
                  value={budget}
                  onChange={(e) =>
                    setBudget(Math.max(1, parseInt(e.target.value) || 15))
                  }
                  disabled={unlimited}
                  className={clsx(
                    "input pl-10 w-full",
                    unlimited && "bg-gray-100 text-gray-500",
                  )}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Typical evaluation costs $3-8. Higher budgets allow more
                thorough debate rounds.
              </p>
            </div>

            {/* Debate Rounds Input */}
            <div>
              <label
                htmlFor="debateRounds"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Debate Rounds
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  id="debateRounds"
                  min="1"
                  max="3"
                  step="1"
                  value={debateRounds}
                  onChange={(e) =>
                    setDebateRounds(
                      Math.min(3, Math.max(1, parseInt(e.target.value) || 1)),
                    )
                  }
                  className="input pl-10 w-full"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Number of challenge/defense rounds per criterion (1-3). More
                rounds = deeper analysis but higher cost.
              </p>
            </div>

            {/* Unlimited Toggle */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="unlimited"
                checked={unlimited}
                onChange={(e) => setUnlimited(e.target.checked)}
                className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <label
                  htmlFor="unlimited"
                  className="block text-sm font-medium text-gray-700"
                >
                  Unlimited budget
                </label>
                <p className="text-xs text-gray-500">
                  Run evaluation to completion regardless of cost
                </p>
              </div>
            </div>

            {/* Warning for unlimited mode */}
            {unlimited && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Warning: Unlimited mode enabled</p>
                  <p className="mt-1 text-amber-700">
                    This will run the full evaluation with all debate rounds.
                    Depending on complexity, this could cost $20-50 or more.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary inline-flex items-center"
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">...</span>
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Start Evaluation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
