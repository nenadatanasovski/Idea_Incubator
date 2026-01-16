import {
  Activity,
  CheckCircle,
  XCircle,
  MessageSquare,
  Play,
} from "lucide-react";
import type { ActivityEvent, ActivityEventType } from "../../types/agent.js";

interface AgentActivityFeedProps {
  activities: ActivityEvent[];
  maxItems?: number;
}

const EVENT_CONFIG: Record<
  ActivityEventType,
  { icon: typeof Activity; color: string; bg: string }
> = {
  task_started: { icon: Play, color: "text-blue-500", bg: "bg-blue-100" },
  task_completed: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-100",
  },
  task_failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-100" },
  question_asked: {
    icon: MessageSquare,
    color: "text-amber-500",
    bg: "bg-amber-100",
  },
  question_answered: {
    icon: CheckCircle,
    color: "text-purple-500",
    bg: "bg-purple-100",
  },
};

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 60000) return "Just now";
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function AgentActivityFeed({
  activities,
  maxItems = 10,
}: AgentActivityFeedProps): JSX.Element {
  if (activities.length === 0) {
    return (
      <div className="card text-center py-8">
        <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No recent activity</p>
      </div>
    );
  }

  const displayActivities = activities.slice(0, maxItems);

  return (
    <div className="card">
      <div className="space-y-4">
        {displayActivities.map((event, idx) => {
          const config = EVENT_CONFIG[event.type];
          const EventIcon = config.icon;

          return (
            <div key={event.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`p-1.5 rounded-full ${config.bg}`}>
                  <EventIcon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                {idx < displayActivities.length - 1 && (
                  <div className="w-0.5 h-full bg-gray-200 mt-1" />
                )}
              </div>

              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {event.agentName}
                    </span>
                    {event.projectName && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                        {event.projectName}
                      </span>
                    )}
                    {event.taskListName && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                        {event.taskListName}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">
                  {event.description}
                </p>
                {event.taskId && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Task: {event.taskId}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activities.length > maxItems && (
        <div className="mt-4 pt-4 border-t text-center">
          <button className="text-sm text-primary-600 hover:text-primary-700">
            View all {activities.length} events
          </button>
        </div>
      )}
    </div>
  );
}
