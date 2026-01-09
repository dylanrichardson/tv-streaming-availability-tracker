interface EmptyStateProps {
  message: string;
  submessage?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Empty state component for displaying when no data is available
 * Can optionally include a call-to-action button
 */
export function EmptyState({ message, submessage, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500 mb-2">{message}</p>
      {submessage && <p className="text-gray-600 text-sm mb-4">{submessage}</p>}
      {action && (
        <button
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
