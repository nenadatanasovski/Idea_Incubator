import { useState, useEffect } from "react";
import {
  PartyPopper,
  Trophy,
  Rocket,
  Star,
  CheckCircle,
  X,
} from "lucide-react";

export type MilestoneType =
  | "build_complete"
  | "all_tests_pass"
  | "first_task"
  | "streak"
  | "spec_approved"
  | "deployment_ready";

interface MilestoneConfig {
  icon: typeof PartyPopper;
  title: string;
  color: string;
  bgGradient: string;
}

const MILESTONE_CONFIG: Record<MilestoneType, MilestoneConfig> = {
  build_complete: {
    icon: Trophy,
    title: "Build Complete!",
    color: "text-yellow-500",
    bgGradient: "from-yellow-400 to-amber-500",
  },
  all_tests_pass: {
    icon: CheckCircle,
    title: "All Tests Passing!",
    color: "text-green-500",
    bgGradient: "from-green-400 to-emerald-500",
  },
  first_task: {
    icon: Star,
    title: "First Task Complete!",
    color: "text-blue-500",
    bgGradient: "from-blue-400 to-indigo-500",
  },
  streak: {
    icon: PartyPopper,
    title: "On a Roll!",
    color: "text-purple-500",
    bgGradient: "from-purple-400 to-pink-500",
  },
  spec_approved: {
    icon: CheckCircle,
    title: "Spec Approved!",
    color: "text-teal-500",
    bgGradient: "from-teal-400 to-cyan-500",
  },
  deployment_ready: {
    icon: Rocket,
    title: "Ready to Deploy!",
    color: "text-orange-500",
    bgGradient: "from-orange-400 to-red-500",
  },
};

interface CelebrationModalProps {
  milestone: MilestoneType;
  message: string;
  details?: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export default function CelebrationModal({
  milestone,
  message,
  details,
  onClose,
  autoCloseMs = 5000,
}: CelebrationModalProps): JSX.Element {
  const [isClosing, setIsClosing] = useState(false);
  const config = MILESTONE_CONFIG[milestone];
  const Icon = config.icon;

  useEffect(() => {
    if (autoCloseMs > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [autoCloseMs]);

  function handleClose(): void {
    setIsClosing(true);
    setTimeout(onClose, 300);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all duration-300 ${
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div
          className={`bg-gradient-to-r ${config.bgGradient} p-6 text-white text-center`}
        >
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <Icon className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold">{config.title}</h2>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <p className="text-lg text-gray-700 mb-2">{message}</p>
          {details && <p className="text-sm text-gray-500">{details}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <button
            onClick={handleClose}
            className={`px-6 py-2 bg-gradient-to-r ${config.bgGradient} text-white font-medium rounded-lg hover:opacity-90 transition-opacity`}
          >
            Continue
          </button>
        </div>

        {/* Confetti effect (CSS-based) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: "-10px",
                backgroundColor: [
                  "#fbbf24",
                  "#34d399",
                  "#60a5fa",
                  "#f472b6",
                  "#a78bfa",
                ][i % 5],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook to manage celebration state
export function useCelebration() {
  const [celebration, setCelebration] = useState<{
    milestone: MilestoneType;
    message: string;
    details?: string;
  } | null>(null);

  function celebrate(
    milestone: MilestoneType,
    message: string,
    details?: string,
  ): void {
    setCelebration({ milestone, message, details });
  }

  function dismiss(): void {
    setCelebration(null);
  }

  return { celebration, celebrate, dismiss };
}
