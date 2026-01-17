/**
 * ReadinessIndicator Component
 *
 * Visual badge showing readiness percentage for a task.
 * Can be used inline in task cards or as a standalone badge.
 *
 * Reference: TASK-READINESS-PIPELINE-ENHANCEMENTS-IMPLEMENTATION-PLAN.md Phase 3
 */

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, XCircle, Loader2 } from "lucide-react";

interface ReadinessIndicatorProps {
  taskId: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function ReadinessIndicator({
  taskId,
  size = "md",
  showLabel = true,
  onClick,
  className = "",
}: ReadinessIndicatorProps) {
  const [readiness, setReadiness] = useState<number | null>(null);
  const [isReady, setIsReady] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchReadiness = async () => {
      setIsLoading(true);
      setError(false);

      try {
        const response = await fetch(`/api/pipeline/tasks/${taskId}/readiness`);
        if (!response.ok) throw new Error("Failed to fetch");

        const data = await response.json();
        setReadiness(data.overall);
        setIsReady(data.isReady);
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReadiness();
  }, [taskId]);

  // Size configurations
  const sizeConfig = {
    sm: {
      container: "px-1.5 py-0.5 text-xs gap-1",
      icon: "w-3 h-3",
    },
    md: {
      container: "px-2 py-1 text-sm gap-1.5",
      icon: "w-4 h-4",
    },
    lg: {
      container: "px-3 py-1.5 text-base gap-2",
      icon: "w-5 h-5",
    },
  };

  const config = sizeConfig[size];

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="readiness-indicator"
        className={`inline-flex items-center ${config.container} bg-gray-100 rounded ${className}`}
      >
        <Loader2 className={`${config.icon} animate-spin text-gray-400`} />
        {showLabel && <span className="text-gray-400">Loading...</span>}
      </div>
    );
  }

  // Error state
  if (error || readiness === null) {
    return (
      <div
        data-testid="readiness-indicator"
        className={`inline-flex items-center ${config.container} bg-gray-100 rounded ${className}`}
      >
        <AlertCircle className={`${config.icon} text-gray-400`} />
        {showLabel && <span className="text-gray-400">N/A</span>}
      </div>
    );
  }

  // Determine status color
  const getStatusConfig = () => {
    if (isReady) {
      return {
        bg: "bg-green-100",
        text: "text-green-700",
        icon: <CheckCircle className={`${config.icon} text-green-500`} />,
      };
    } else if (readiness >= 50) {
      return {
        bg: "bg-amber-100",
        text: "text-amber-700",
        icon: <AlertCircle className={`${config.icon} text-amber-500`} />,
      };
    } else {
      return {
        bg: "bg-red-100",
        text: "text-red-700",
        icon: <XCircle className={`${config.icon} text-red-500`} />,
      };
    }
  };

  const statusConfig = getStatusConfig();

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      data-testid="readiness-indicator"
      data-readiness={readiness}
      data-is-ready={isReady}
      onClick={handleClick}
      className={`
        inline-flex items-center ${config.container} ${statusConfig.bg} rounded
        ${onClick ? "cursor-pointer hover:opacity-80" : ""}
        ${className}
      `}
    >
      {statusConfig.icon}
      {showLabel && (
        <span className={`font-medium ${statusConfig.text}`}>{readiness}%</span>
      )}
    </div>
  );
}

// Compact inline version for table cells
interface ReadinessBadgeProps {
  readiness: number;
  isReady: boolean;
  size?: "sm" | "md";
}

export function ReadinessBadge({
  readiness,
  isReady,
  size = "sm",
}: ReadinessBadgeProps) {
  const sizeClass =
    size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  let colorClass = "";
  if (isReady) {
    colorClass = "bg-green-100 text-green-700";
  } else if (readiness >= 50) {
    colorClass = "bg-amber-100 text-amber-700";
  } else {
    colorClass = "bg-red-100 text-red-700";
  }

  return (
    <span
      data-testid="readiness-badge"
      className={`inline-flex items-center rounded font-medium ${sizeClass} ${colorClass}`}
    >
      {readiness}%
    </span>
  );
}

// Progress ring version for visual emphasis
interface ReadinessRingProps {
  readiness: number;
  isReady: boolean;
  size?: number;
  strokeWidth?: number;
}

export function ReadinessRing({
  readiness,
  isReady,
  size = 40,
  strokeWidth = 4,
}: ReadinessRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (readiness / 100) * circumference;

  let strokeColor = "";
  if (isReady) {
    strokeColor = "stroke-green-500";
  } else if (readiness >= 50) {
    strokeColor = "stroke-amber-500";
  } else {
    strokeColor = "stroke-red-500";
  }

  return (
    <div
      data-testid="readiness-ring"
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={`transition-all duration-500 ${strokeColor}`}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold text-gray-700">
          {readiness}%
        </span>
      </div>
    </div>
  );
}
