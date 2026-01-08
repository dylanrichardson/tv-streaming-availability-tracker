import { useState, useEffect } from 'react';
import type { Title, SearchResult, SyncResponse } from '../types';
import { fetchApi } from '../hooks/useApi';
import { useSearch } from '../hooks/useSearch';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  existingTitles: Title[];
}

export function SearchModal({ isOpen, onClose, onImported, existingTitles }: SearchModalProps) {
  const { query, setQuery, results, loading, error, retry } = useSearch();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIds(new Set());
      setImporting(false);
      setImportError(null);
    }
  }, [isOpen, setQuery]);

  if (!isOpen) return null;

  const isAlreadyTracked = (searchResult: SearchResult): boolean => {
    return existingTitles.some(
      (t) => t.justwatch_id === searchResult.justwatch_id.toString()
    );
  };

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    const availableResults = results.filter((r) => !isAlreadyTracked(r));
    setSelectedIds(new Set(availableResults.map((r) => r.justwatch_id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleAddSelected = async () => {
    const selectedResults = results.filter((r) => selectedIds.has(r.justwatch_id));

    if (selectedResults.length === 0) return;

    setImporting(true);
    setImportError(null);

    try {
      await fetchApi<SyncResponse>('/api/sync', {
        method: 'POST',
        body: { titles: selectedResults.map((r) => r.name) },
      });

      onImported();
      onClose();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to add titles');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Search Titles</h2>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Search for movies and TV shows..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={importing}
              autoFocus
            />
            {query && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setQuery('')}
                disabled={importing}
              >
                ✕
              </button>
            )}
          </div>

          {/* Selection Actions */}
          {results.length > 0 && (
            <div className="flex gap-2 mt-3">
              <button
                className="text-sm text-gray-400 hover:text-white"
                onClick={handleSelectAll}
                disabled={importing || results.every((r) => isAlreadyTracked(r))}
              >
                Select All
              </button>
              {selectedIds.size > 0 && (
                <button
                  className="text-sm text-gray-400 hover:text-white"
                  onClick={handleClearSelection}
                  disabled={importing}
                >
                  Clear Selection
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-400">{error}</p>
              <button
                className="text-sm text-red-300 underline mt-2"
                onClick={retry}
              >
                Try again
              </button>
            </div>
          )}

          {importError && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-400">{importError}</p>
            </div>
          )}

          {query.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>Enter a search query to find titles</p>
              <p className="text-sm mt-2 text-gray-600">
                Search for movies and TV shows to add to your tracking list
              </p>
            </div>
          )}

          {query.length > 0 && query.length < 2 && (
            <div className="text-center py-12 text-gray-500">
              <p>Enter at least 2 characters to search</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              <p className="text-gray-400 mt-4">Searching...</p>
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500">
              <p>No titles found for "{query}"</p>
              <p className="text-sm mt-2 text-gray-600">Try a different search term</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((result) => {
                const alreadyTracked = isAlreadyTracked(result);
                const isSelected = selectedIds.has(result.justwatch_id);

                return (
                  <div
                    key={result.justwatch_id}
                    className={`relative bg-gray-900 rounded-lg p-4 border-2 transition-colors ${
                      alreadyTracked
                        ? 'border-gray-700 opacity-60'
                        : isSelected
                        ? 'border-green-500'
                        : 'border-gray-700 hover:border-gray-600 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!alreadyTracked && !importing) {
                        toggleSelection(result.justwatch_id);
                      }
                    }}
                  >
                    {/* Checkbox */}
                    <div className="absolute top-3 left-3 z-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyTracked || importing}
                        onChange={() => toggleSelection(result.justwatch_id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-0 disabled:opacity-50"
                      />
                    </div>

                    {/* Already Tracked Badge */}
                    {alreadyTracked && (
                      <div className="absolute top-3 right-3 text-xs px-2 py-1 rounded bg-blue-600 text-white">
                        Already tracked
                      </div>
                    )}

                    <div className="flex gap-4 ml-8">
                      {/* Poster */}
                      <div className="w-20 h-28 flex-shrink-0 bg-gray-800 rounded overflow-hidden">
                        {result.poster_url ? (
                          <img
                            src={result.poster_url}
                            alt={result.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            No Image
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{result.name}</h3>
                        <span
                          className={`inline-block text-xs px-2 py-1 rounded mt-2 ${
                            result.type === 'movie'
                              ? 'bg-purple-900/50 text-purple-300'
                              : 'bg-blue-900/50 text-blue-300'
                          }`}
                        >
                          {result.type === 'movie' ? 'Movie' : 'TV Show'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            {selectedIds.size > 0 && (
              <span>
                {selectedIds.size} title{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              onClick={handleClose}
              disabled={importing}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
              onClick={handleAddSelected}
              disabled={selectedIds.size === 0 || importing}
            >
              {importing
                ? `Adding ${selectedIds.size} title${selectedIds.size !== 1 ? 's' : ''}...`
                : `Add Selected (${selectedIds.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
