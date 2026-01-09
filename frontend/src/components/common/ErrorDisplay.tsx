interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
}

/**
 * Error display component with optional retry button
 * Provides consistent error messaging across the app
 */
export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
      <p className="text-red-400">{error}</p>
      {onRetry && (
        <button
          className="text-sm text-red-300 underline mt-2 hover:text-red-200 transition-colors"
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}
