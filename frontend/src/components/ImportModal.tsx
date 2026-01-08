import { useState } from 'react';
import type { PreviewResponse, PreviewResultItem, ConfirmSelection, ConfirmResultItem } from '../types';
import { fetchApi } from '../hooks/useApi';
import { DisambiguationModal } from './DisambiguationModal';

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

const BATCH_SIZE = 50;

export function ImportModal({ isOpen, onClose, onImported }: ImportModalProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message: string; results: ConfirmResultItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'text' | 'file'>('text');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Disambiguation state
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  const [ambiguousResults, setAmbiguousResults] = useState<PreviewResultItem[]>([]);
  const [autoImportResults, setAutoImportResults] = useState<PreviewResultItem[]>([]);

  if (!isOpen) return null;

  const previewTitlesInBatches = async (titles: string[]): Promise<PreviewResultItem[]> => {
    const batches: string[][] = [];
    for (let i = 0; i < titles.length; i += BATCH_SIZE) {
      batches.push(titles.slice(i, i + BATCH_SIZE));
    }

    const allResults: PreviewResultItem[] = [];

    for (let i = 0; i < batches.length; i++) {
      setProgress({ current: i + 1, total: batches.length });

      try {
        const response = await fetchApi<PreviewResponse>('/api/sync/preview', {
          method: 'POST',
          body: { titles: batches[i] },
        });

        allResults.push(...response.results);
      } catch (err) {
        throw new Error(`Preview batch ${i + 1}/${batches.length} failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    setProgress(null);
    return allResults;
  };

  const confirmSelections = async (selections: ConfirmSelection[]): Promise<ConfirmResultItem[]> => {
    const batches: ConfirmSelection[][] = [];
    for (let i = 0; i < selections.length; i += BATCH_SIZE) {
      batches.push(selections.slice(i, i + BATCH_SIZE));
    }

    const allResults: ConfirmResultItem[] = [];

    for (let i = 0; i < batches.length; i++) {
      setProgress({ current: i + 1, total: batches.length });

      try {
        const response = await fetchApi<{ message: string; results: ConfirmResultItem[] }>(
          '/api/sync/confirm',
          {
            method: 'POST',
            body: { selections: batches[i] },
          }
        );

        allResults.push(...response.results);
      } catch (err) {
        throw new Error(`Confirm batch ${i + 1}/${batches.length} failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    setProgress(null);
    return allResults;
  };

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
      // Step 1: Preview titles to check for ambiguity
      const previewResults = await previewTitlesInBatches(titles);

      // Separate results by status
      const ambiguous = previewResults.filter((r) => r.status === 'multiple');
      const unique = previewResults.filter((r) => r.status === 'unique');
      const exists = previewResults.filter((r) => r.status === 'exists');
      const notFound = previewResults.filter((r) => r.status === 'none');

      // If there are ambiguous titles, show disambiguation modal
      if (ambiguous.length > 0) {
        setAmbiguousResults(ambiguous);
        setAutoImportResults([...unique, ...exists, ...notFound]);
        setShowDisambiguation(true);
        setLoading(false);
      } else {
        // No ambiguous titles, proceed to confirm unique ones
        await proceedWithConfirmation(unique, exists, notFound);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import titles');
      setLoading(false);
    }
  };

  const proceedWithConfirmation = async (
    unique: PreviewResultItem[],
    exists: PreviewResultItem[],
    notFound: PreviewResultItem[]
  ) => {
    try {
      // Auto-select unique matches and confirm them
      const selections: ConfirmSelection[] = unique.map((item) => ({
        query: item.query,
        jwResult: item.matches[0],
      }));

      let confirmed: ConfirmResultItem[] = [];
      if (selections.length > 0) {
        confirmed = await confirmSelections(selections);
      }

      // Combine with already-exists and not-found results
      const existsResults: ConfirmResultItem[] = exists.map((item) => ({
        name: item.query,
        status: 'exists' as const,
        title: item.existingTitle,
      }));

      const notFoundResults: ConfirmResultItem[] = notFound.map((item) => ({
        name: item.query,
        status: 'error' as const,
        error: 'Not found',
      }));

      const allResults = [...confirmed, ...existsResults, ...notFoundResults];

      const created = allResults.filter((r) => r.status === 'created').length;
      const existing = allResults.filter((r) => r.status === 'exists').length;
      const errors = allResults.filter((r) => r.status === 'error').length;

      setResult({
        message: `Processed ${allResults.length} titles: ${created} created, ${existing} already existed, ${errors} not found`,
        results: allResults,
      });

      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm titles');
    } finally {
      setLoading(false);
    }
  };

  const handleDisambiguationConfirm = async (selections: ConfirmSelection[]) => {
    setShowDisambiguation(false);
    setLoading(true);
    setError(null);

    try {
      // Confirm user's selections
      const confirmed = await confirmSelections(selections);

      // Also confirm auto-import results (unique matches)
      const autoUnique = autoImportResults.filter((r) => r.status === 'unique');
      const autoExists = autoImportResults.filter((r) => r.status === 'exists');
      const autoNotFound = autoImportResults.filter((r) => r.status === 'none');

      await proceedWithConfirmation(autoUnique, autoExists, autoNotFound);

      // Merge the disambiguation results with auto results
      const currentResults = result?.results || [];
      const allResults = [...confirmed, ...currentResults];

      const created = allResults.filter((r) => r.status === 'created').length;
      const existing = allResults.filter((r) => r.status === 'exists').length;
      const errors = allResults.filter((r) => r.status === 'error').length;

      setResult({
        message: `Processed ${allResults.length} titles: ${created} created, ${existing} already existed, ${errors} not found`,
        results: allResults,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm selections');
    } finally {
      setLoading(false);
    }
  };

  const handleDisambiguationCancel = () => {
    setShowDisambiguation(false);
    setAmbiguousResults([]);
    setAutoImportResults([]);
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

      // Use the same preview flow as text import
      const previewResults = await previewTitlesInBatches(titles);

      // Separate results by status
      const ambiguous = previewResults.filter((r) => r.status === 'multiple');
      const unique = previewResults.filter((r) => r.status === 'unique');
      const exists = previewResults.filter((r) => r.status === 'exists');
      const notFound = previewResults.filter((r) => r.status === 'none');

      // If there are ambiguous titles, show disambiguation modal
      if (ambiguous.length > 0) {
        setAmbiguousResults(ambiguous);
        setAutoImportResults([...unique, ...exists, ...notFound]);
        setShowDisambiguation(true);
        setLoading(false);
      } else {
        // No ambiguous titles, proceed to confirm unique ones
        await proceedWithConfirmation(unique, exists, notFound);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
      setLoading(false);
    } finally {
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
    <>
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
                  Large lists will be imported in batches of {BATCH_SIZE}.
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
                    {loading
                      ? progress
                        ? `Importing batch ${progress.current}/${progress.total}...`
                        : 'Importing...'
                      : 'Import'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-4">
                  Upload a CSV file with titles (one per line) or an IMDb list export.
                  Large lists will be imported in batches of {BATCH_SIZE}.
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
                      {loading
                        ? progress
                          ? `Importing batch ${progress.current}/${progress.total}...`
                          : 'Importing...'
                        : 'Click to upload CSV'}
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

      <DisambiguationModal
        isOpen={showDisambiguation}
        ambiguousResults={ambiguousResults}
        onConfirm={handleDisambiguationConfirm}
        onCancel={handleDisambiguationCancel}
      />
    </>
  );
}
