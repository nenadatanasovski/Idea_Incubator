// =============================================================================
// FILE: frontend/src/components/ideation/StreamingText.tsx
// Streaming text display with cursor animation
// =============================================================================

import { useState, useEffect, useRef } from "react";

interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  typingSpeed?: number;
  showCursor?: boolean;
  onComplete?: () => void;
}

export function StreamingText({
  text,
  isStreaming = false,
  typingSpeed = 10,
  showCursor = true,
  onComplete,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      // Not streaming, show full text immediately
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    // Reset for new streaming
    setDisplayedText("");
    setIsComplete(false);
    indexRef.current = 0;

    // Start typing animation
    intervalRef.current = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        // Typing complete
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setIsComplete(true);
        onComplete?.();
      }
    }, typingSpeed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, isStreaming, typingSpeed, onComplete]);

  // Update displayed text when source text changes during streaming
  useEffect(() => {
    if (isStreaming && text.length > displayedText.length) {
      // New content arrived, continue from current position
      indexRef.current = displayedText.length;
    }
  }, [text, isStreaming, displayedText.length]);

  return (
    <div className="streaming-text">
      <span>{displayedText}</span>
      {showCursor && isStreaming && !isComplete && (
        <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}

export default StreamingText;
