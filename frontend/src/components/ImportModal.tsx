import { useState } from 'react';
import type { SyncResponse } from '../types';
import { fetchApi } from '../hooks/useApi';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

// Parse CSV content into titles array
function parseCSV(content: string): string[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);

  if (lines.length === 0) return [];

  // Check if first line looks like IMDb header
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes('const') && firstLine.includes('title') && firstLine.includes('imdb')) {
    // IMDb export format
    return parseIMDbCSV(lines);
  }

  // Simple CSV - just extract titles (could be comma-separated or one per line)
  const titles: string[] = [];
  for (const line of lines) {
    if (line.startsWith('"') && line.endsWith('"')) {
      // Quoted CSV field
      titles.push(line.slice(1, -1));
    } else if (line.includes(',')) {
      // Multiple titles per line
      titles.push(...line.split(',').map(t => t.trim()).filter(t => t));
    } else {
      // Single title per line
      titles.push(line);
    }
  }

  return titles;
}

// Parse IMDb list export format
function parseIMDbCSV(lines: string[]): string[] {
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const titleIndex = headers.findIndex(h => h === 'title');

  if (titleIndex === -1) {
    throw new Error('IMDb CSV missing "Title" column');
  }

  const titles: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Simple CSV parser (doesn't handle quoted commas perfectly, but good enough)
    const fields = line.split(',');

    if (fields.length > titleIndex) {
      let title = fields[titleIndex].trim();

      // Remove quotes if present
      if (title.startsWith('"') && title.endsWith('"')) {
        title = title.slice(1, -1);
      }

      if (title) {
        titles.push(title);
      }
    }
  }

  return titles;
}

export function ImportModal({ isOpen, onClose, onImported }: ImportModalProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'text' | 'file'>('text');

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const titles = parseCSV(content);

      if (titles.length === 0) {
        setError('No titles found in file');
        setLoading(false);
        return;
      }

      const response = await fetchApi<SyncResponse>('/api/sync', {
        method: 'POST',
        body: { titles },
      });
      setResult(response);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = '';
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
            <div className="flex gap-2 mb-4 border-b border-gray-700">
              <button
                className={`px-4 py-2 transition-colors ${
                  importMode === 'text'
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setImportMode('text')}
                disabled={loading}
              >
                Text Input
              </button>
              <button
                className={`px-4 py-2 transition-colors ${
                  importMode === 'file'
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setImportMode('file')}
                disabled={loading}
              >
                File Upload
              </button>
            </div>

            {importMode === 'text' ? (
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
                <p className="text-gray-400 text-sm mb-4">
                  Upload a CSV file with titles (one per line) or an IMDb list export.
                </p>
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`cursor-pointer inline-flex flex-col items-center ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <svg
                      className="w-12 h-12 text-gray-500 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span className="text-blue-400 hover:text-blue-300">
                      {loading ? 'Importing...' : 'Click to upload CSV'}
                    </span>
                    <span className="text-gray-500 text-xs mt-1">
                      CSV, TXT (IMDb list export supported)
                    </span>
                  </label>
                </div>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
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
