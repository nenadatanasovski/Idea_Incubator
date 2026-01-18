/**
 * AISyncButton - Button component for AI sync operations
 *
 * Provides a reusable button that triggers AI sync endpoints
 * with loading states and error handling.
 */

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import clsx from "clsx";

const API_BASE = "http://localhost:3001";

interface AISyncButtonProps {
  endpoint: string;
  payload: Record<string, unknown>;
  onSuccess: (data: unknown) => void;
  buttonText: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  confirmText?: string;
}

export default function AISyncButton({
  endpoint,
  payload,
  onSuccess,
  buttonText,
  className,
  variant = "secondary",
  size = "sm",
  confirmText,
}: AISyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    // If confirm text provided, show confirmation dialog
    if (confirmText) {
      const confirmed = window.confirm(confirmText);
      if (!confirmed) return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || `Request failed with status ${response.status}`,
        );
      }

      const data = await response.json();
      onSuccess(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI sync failed";
      setError(message);
      // Show error as alert for now (could be toast in future)
      alert(`AI Sync Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const variantStyles = {
    primary:
      "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-400",
    secondary:
      "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 disabled:bg-gray-100 disabled:text-gray-400",
    ghost: "text-purple-600 hover:bg-purple-50 disabled:text-gray-400",
  };

  const sizeStyles = {
    sm: "px-2.5 py-1.5 text-xs gap-1.5",
    md: "px-3 py-2 text-sm gap-2",
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={clsx(
        "inline-flex items-center font-medium rounded-lg transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      title={error || undefined}
    >
      {isLoading ? (
        <Loader2
          className={clsx(
            "animate-spin",
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
          )}
        />
      ) : (
        <Sparkles className={clsx(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      )}
      <span>{isLoading ? "Syncing..." : buttonText}</span>
    </button>
  );
}
