/**
 * useBlockingQuestions - QUE-002, QUE-003, QUE-004
 *
 * Hook to manage blocking questions via WebSocket.
 * Features:
 * - Subscribes to question events from WebSocket
 * - Maintains priority queue of questions
 * - Tracks agent blocking state
 * - Provides methods to answer questions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { BlockingQuestion } from "../components/agents/BlockingQuestionModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";

interface QuestionEvent {
  type:
    | "question:new"
    | "question:answered"
    | "question:expired"
    | "question:skipped";
  question?: BlockingQuestion;
  questionId?: string;
  answer?: string;
}

interface AgentBlockedEvent {
  type: "agent:blocked" | "agent:unblocked";
  agentId: string;
  questionId?: string;
  reason?: string;
}

interface PriorityScore {
  score: number;
  factors: {
    type: number;
    priority: number;
    age: number;
    blocking: number;
  };
}

// Priority weights for scoring algorithm (QUE-004)
const PRIORITY_WEIGHTS = {
  type: {
    BLOCKING: 100,
    APPROVAL: 80,
    ESCALATION: 60,
    DECISION: 40,
  },
  priority: {
    critical: 50,
    high: 30,
    medium: 15,
    low: 5,
  },
  ageDecay: 0.1, // Points per minute of age
  blockingBonus: 25, // Extra points if agent is blocked
};

function calculatePriorityScore(
  question: BlockingQuestion,
  blockedAgents: Set<string>,
): PriorityScore {
  const typeScore = PRIORITY_WEIGHTS.type[question.type] || 0;
  const priorityScore = PRIORITY_WEIGHTS.priority[question.priority] || 0;

  // Age bonus: older questions get slightly higher priority
  const ageMs = Date.now() - new Date(question.createdAt).getTime();
  const ageMinutes = ageMs / 60000;
  const ageScore = Math.min(ageMinutes * PRIORITY_WEIGHTS.ageDecay, 20); // Cap at 20 points

  // Blocking bonus
  const blockingScore = blockedAgents.has(question.agentId)
    ? PRIORITY_WEIGHTS.blockingBonus
    : 0;

  return {
    score: typeScore + priorityScore + ageScore + blockingScore,
    factors: {
      type: typeScore,
      priority: priorityScore,
      age: ageScore,
      blocking: blockingScore,
    },
  };
}

export interface UseBlockingQuestionsReturn {
  questions: BlockingQuestion[];
  currentQuestion: BlockingQuestion | null;
  blockedAgents: Set<string>;
  isConnected: boolean;
  answerQuestion: (questionId: string, answer: string) => Promise<void>;
  skipQuestion: (questionId: string, reason: string) => Promise<void>;
  dismissQuestion: (questionId: string) => void;
  refreshQuestions: () => Promise<void>;
}

export function useBlockingQuestions(): UseBlockingQuestionsReturn {
  const [questions, setQuestions] = useState<BlockingQuestion[]>([]);
  const [blockedAgents, setBlockedAgents] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Sort questions by priority score
  const sortedQuestions = [...questions].sort((a, b) => {
    const scoreA = calculatePriorityScore(a, blockedAgents);
    const scoreB = calculatePriorityScore(b, blockedAgents);
    return scoreB.score - scoreA.score;
  });

  const currentQuestion =
    sortedQuestions.find(
      (q) => q.type === "BLOCKING" || q.type === "APPROVAL",
    ) || null;

  // Fetch initial questions
  const refreshQuestions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/questions/pending`);
      if (res.ok) {
        const data = await res.json();
        if (data.questions) {
          setQuestions(data.questions);
        }
      }
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    }
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[BlockingQuestions] WebSocket connected");
      setIsConnected(true);

      // Subscribe to question events
      ws.send(
        JSON.stringify({
          type: "subscribe",
          channels: ["questions", "agents"],
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "question:new" && data.question) {
          setQuestions((prev) => {
            // Avoid duplicates
            if (prev.some((q) => q.id === data.question.id)) return prev;
            return [...prev, data.question];
          });
        }

        if (
          data.type === "question:answered" ||
          data.type === "question:expired" ||
          data.type === "question:skipped"
        ) {
          setQuestions((prev) => prev.filter((q) => q.id !== data.questionId));
        }

        if (data.type === "agent:blocked" && data.agentId) {
          setBlockedAgents((prev) => new Set([...prev, data.agentId]));
        }

        if (data.type === "agent:unblocked" && data.agentId) {
          setBlockedAgents((prev) => {
            const next = new Set(prev);
            next.delete(data.agentId);
            return next;
          });
        }

        // Handle task:blocked events
        if (data.type === "task:blocked" && data.taskId) {
          console.log("[BlockingQuestions] Task blocked:", data);
        }

        // Handle task:resumed events
        if (data.type === "task:resumed" && data.taskId) {
          console.log("[BlockingQuestions] Task resumed:", data);
        }
      } catch (error) {
        console.error("[BlockingQuestions] Failed to parse message:", error);
      }
    };

    ws.onclose = () => {
      console.log("[BlockingQuestions] WebSocket disconnected");
      setIsConnected(false);
      wsRef.current = null;

      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("[BlockingQuestions] WebSocket error:", error);
    };

    wsRef.current = ws;
  }, []);

  // Initialize
  useEffect(() => {
    refreshQuestions();
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [refreshQuestions, connectWebSocket]);

  // Answer a question
  const answerQuestion = useCallback(
    async (questionId: string, answer: string) => {
      const res = await fetch(
        `${API_BASE}/api/questions/${questionId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer }),
        },
      );

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to submit answer");
      }

      // Optimistically remove from local state
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    },
    [],
  );

  // Skip a question
  const skipQuestion = useCallback(
    async (questionId: string, reason: string) => {
      const res = await fetch(`${API_BASE}/api/questions/${questionId}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to skip question");
      }

      // Optimistically remove from local state
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    },
    [],
  );

  // Dismiss a non-blocking question
  const dismissQuestion = useCallback(
    (questionId: string) => {
      const question = questions.find((q) => q.id === questionId);
      if (
        question &&
        (question.type === "BLOCKING" || question.type === "APPROVAL")
      ) {
        console.warn("Cannot dismiss blocking questions");
        return;
      }
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    },
    [questions],
  );

  return {
    questions: sortedQuestions,
    currentQuestion,
    blockedAgents,
    isConnected,
    answerQuestion,
    skipQuestion,
    dismissQuestion,
    refreshQuestions,
  };
}
