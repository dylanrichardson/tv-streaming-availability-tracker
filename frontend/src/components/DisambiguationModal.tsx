import { useState } from 'react';
import type { PreviewResultItem, JustWatchResult, ConfirmSelection } from '../types';

interface DisambiguationModalProps {
  isOpen: boolean;
  ambiguousResults: PreviewResultItem[];
  onConfirm: (selections: ConfirmSelection[]) => void;
  onCancel: () => void;
}

export function DisambiguationModal({
  isOpen,
  ambiguousResults,
  onConfirm,
  onCancel,
}: DisambiguationModalProps) {
  // Map of query -> selected JustWatch result
  const [selections, setSelections] = useState<Map<string, JustWatchResult>>(new Map());

  if (!isOpen) return null;

  const handleSelectMatch = (query: string, match: JustWatchResult) => {
    const newSelections = new Map(selections);
    newSelections.set(query, match);
    setSelections(newSelections);
  };

  const handleSkip = (query: string) => {
    const newSelections = new Map(selections);
    newSelections.delete(query);
    setSelections(newSelections);
  };

  const handleConfirm = () => {
    const confirmSelections: ConfirmSelection[] = Array.from(selections.entries()).map(
      ([query, jwResult]) => ({
        query,
        jwResult,
      })
    );
    onConfirm(confirmSelections);
  };

  const allSelected = ambiguousResults.every((result) => selections.has(result.query));
  const hasAnySelection = selections.size > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold mb-2">Select Correct Titles</h2>
          <p className="text-gray-400 text-sm">
            Multiple matches found for {ambiguousResults.length} title
            {ambiguousResults.length !== 1 ? 's' : ''}. Please select the correct match for each,
            or skip to exclude from import.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {ambiguousResults.map((result) => {
            const selectedMatch = selections.get(result.query);

            return (
              <div key={result.query} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">"{result.query}"</h3>
                  {selectedMatch ? (
                    <span className="text-xs px-2 py-1 rounded bg-green-600 text-white">
                      Selected
                    </span>
                  ) : (
                    <button
                      className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                      onClick={() => handleSkip(result.query)}
                    >
                      Skip
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {result.matches.map((match) => {
                    const isSelected = selectedMatch?.id === match.id;

                    return (
                      <div
                        key={match.id}
                        className={`flex gap-4 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-green-500 bg-green-900/20'
                            : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                        }`}
                        onClick={() => handleSelectMatch(result.query, match)}
                      >
                        {/* Radio button */}
                        <div className="flex items-center">
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => handleSelectMatch(result.query, match)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 text-green-600 focus:ring-green-500 focus:ring-offset-0"
                          />
                        </div>

                        {/* Poster */}
                        <div className="w-16 h-24 flex-shrink-0 bg-gray-700 rounded overflow-hidden">
                          {match.poster ? (
                            <img
                              src={match.poster}
                              alt={match.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                              No Image
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white">{match.title}</h4>
                          <span
                            className={`inline-block text-xs px-2 py-1 rounded mt-1 ${
                              match.object_type === 'movie'
                                ? 'bg-purple-900/50 text-purple-300'
                                : 'bg-blue-900/50 text-blue-300'
                            }`}
                          >
                            {match.object_type === 'movie' ? 'Movie' : 'TV Show'}
                          </span>
                          {match.fullPath && (
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {match.fullPath}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            {selections.size} of {ambiguousResults.length} title
            {ambiguousResults.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleConfirm}
              disabled={!hasAnySelection}
            >
              {allSelected
                ? `Confirm All (${selections.size})`
                : `Confirm Selected (${selections.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
