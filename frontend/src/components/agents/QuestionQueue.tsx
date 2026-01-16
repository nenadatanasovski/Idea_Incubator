import { AlertTriangle, MessageSquare, HelpCircle, Bell } from "lucide-react";
import type { AgentQuestion, AgentQuestionType } from "../../types/agent.js";
import { priorityColors, priorityBadgeColors } from "../../types/agent.js";

interface QuestionQueueProps {
  questions: AgentQuestion[];
  onSelectQuestion: (question: AgentQuestion) => void;
  onAnswerQuestion: (questionId: string, answer: string) => void;
}

const TYPE_ICONS: Record<AgentQuestionType, typeof MessageSquare> = {
  APPROVAL: MessageSquare,
  CLARIFICATION: HelpCircle,
  ESCALATION: AlertTriangle,
  ALERT: Bell,
};

function formatTimeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function sortQuestionsByPriority(questions: AgentQuestion[]): AgentQuestion[] {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...questions].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function QuestionQueue({
  questions,
  onSelectQuestion,
  onAnswerQuestion,
}: QuestionQueueProps): JSX.Element {
  if (questions.length === 0) {
    return (
      <div className="card text-center py-8">
        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No pending questions</p>
        <p className="text-sm text-gray-400">Agents are working autonomously</p>
      </div>
    );
  }

  const sortedQuestions = sortQuestionsByPriority(questions);

  return (
    <div className="space-y-3">
      {sortedQuestions.map((question) => {
        const TypeIcon = TYPE_ICONS[question.type];

        return (
          <div
            key={question.id}
            className={`card border-l-4 ${priorityColors[question.priority]} cursor-pointer hover:shadow-md transition-shadow`}
            onClick={() => onSelectQuestion(question)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <TypeIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">
                  {question.agentName}
                </span>
                {question.projectName && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                    {question.projectName}
                  </span>
                )}
                {question.taskListName && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                    {question.taskListName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {question.blocking && (
                  <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                    BLOCKING
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 text-xs font-medium rounded ${priorityBadgeColors[question.priority]}`}
                >
                  {question.priority.toUpperCase()}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-700 line-clamp-2 mb-2">
              {question.content}
            </p>

            {question.options && question.options.length <= 3 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {question.options.slice(0, 2).map((option, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnswerQuestion(question.id, option);
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    {option}
                  </button>
                ))}
                {question.options.length > 2 && (
                  <span className="text-xs text-gray-400 py-1">
                    +{question.options.length - 2} more
                  </span>
                )}
              </div>
            )}

            <div className="text-xs text-gray-400">
              {formatTimeAgo(question.createdAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
