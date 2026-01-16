// =============================================================================
// FILE: frontend/src/components/ideation/ErrorBoundary.tsx
// Error boundary component to catch and display React component errors
// Implements TEST-UI-014 requirements
// =============================================================================

import React, { Component, ErrorInfo, ReactNode } from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

const AlertIcon = () => (
  <svg
    className="w-12 h-12 text-red-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const RefreshIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

// -----------------------------------------------------------------------------
// Error Fallback Component
// -----------------------------------------------------------------------------

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry }) => {
  return (
    <div
      data-testid="error-boundary"
      className="flex flex-col items-center justify-center h-full p-6 bg-white dark:bg-gray-900"
    >
      <div className="flex flex-col items-center max-w-md text-center">
        <AlertIcon />
        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Something went wrong
        </h3>
        <p
          data-testid="error-message"
          className="mt-2 text-sm text-gray-600 dark:text-gray-400"
        >
          {error?.message ||
            "An unexpected error occurred while rendering this component."}
        </p>
        <button
          data-testid="btn-retry"
          onClick={onRetry}
          className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <RefreshIcon />
          Try Again
        </button>
        {process.env.NODE_ENV === "development" && error?.stack && (
          <details className="mt-4 w-full text-left">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Technical Details
            </summary>
            <pre className="mt-2 p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Error Boundary Class Component
// -----------------------------------------------------------------------------

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({ errorInfo });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error fallback
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// -----------------------------------------------------------------------------
// Artifact Error State Component
// Used specifically for artifact loading/operation errors
// -----------------------------------------------------------------------------

interface ArtifactErrorProps {
  error: string | Error | null;
  onRetry?: () => void;
  title?: string;
}

export const ArtifactError: React.FC<ArtifactErrorProps> = ({
  error,
  onRetry,
  title = "Failed to load artifact",
}) => {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div
      data-testid="artifact-error"
      className="flex flex-col items-center justify-center h-full p-6 bg-white dark:bg-gray-900"
    >
      <div className="flex flex-col items-center max-w-md text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {errorMessage && (
          <p
            data-testid="error-message"
            className="mt-1 text-xs text-gray-500 dark:text-gray-400"
          >
            {errorMessage}
          </p>
        )}
        {onRetry && (
          <button
            data-testid="btn-retry"
            onClick={onRetry}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <RefreshIcon />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Network/Offline Indicator Component
// -----------------------------------------------------------------------------

interface OfflineIndicatorProps {
  isOffline: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOffline,
}) => {
  if (!isOffline) return null;

  return (
    <div
      data-testid="offline-indicator"
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg">
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          You are offline
        </span>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Error Toast Component (for save/operation errors)
// -----------------------------------------------------------------------------

interface ErrorToastProps {
  message: string;
  onDismiss?: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  message,
  onDismiss,
  autoHide = true,
  autoHideDelay = 5000,
}) => {
  React.useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(onDismiss, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, onDismiss]);

  return (
    <div
      data-testid="error-toast"
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg shadow-lg">
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm font-medium">{message}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-2 p-0.5 hover:bg-red-500 rounded transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Hook for Network Status
// -----------------------------------------------------------------------------

export function useNetworkStatus(): boolean {
  const [isOffline, setIsOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOffline;
}

export default ErrorBoundary;
