import { useState } from 'react';
import type { SyncResponse } from '../types';
import { fetchApi } from '../hooks/useApi';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportModal({ isOpen, onClose, onImported }: ImportModalProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = async () => {
    const titles = input
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (titles.length === 0) {
      setError('Please enter at least one title');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchApi<SyncResponse>('/api/sync', {
        method: 'POST',
        body: { titles },
      });
      setResult(response);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import titles');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setInput('');
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-lg w-full p-6">
        <h2 className="text-xl font-semibold mb-4">Import Titles</h2>

        {!result ? (
          <>
            <p className="text-gray-400 text-sm mb-4">
              Enter movie or TV show titles, one per line or comma-separated.
            </p>
            <textarea
              className="w-full h-48 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="The Matrix&#10;Breaking Bad&#10;Inception"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-green-400 mb-4">{result.message}</p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {result.results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2 rounded ${
                    r.status === 'created'
                      ? 'bg-green-900/30'
                      : r.status === 'exists'
                      ? 'bg-gray-700/50'
                      : 'bg-red-900/30'
                  }`}
                >
                  <span>{r.title?.name || r.name}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      r.status === 'created'
                        ? 'bg-green-600 text-white'
                        : r.status === 'exists'
                        ? 'bg-gray-600 text-gray-300'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {r.status === 'created' ? 'Added' : r.status === 'exists' ? 'Exists' : 'Not Found'}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                onClick={handleClose}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
