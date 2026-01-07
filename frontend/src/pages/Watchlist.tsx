import { useEffect, useState } from 'react';
import type { Title, TitlesResponse } from '../types';
import { fetchApi } from '../hooks/useApi';
import { TitleList } from '../components/TitleList';
import { TitleTimeline } from '../components/TitleTimeline';
import { ImportModal } from '../components/ImportModal';

export function Watchlist() {
  const [titles, setTitles] = useState<(Title & { currentServices: string[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<Title | null>(null);
  const [showImport, setShowImport] = useState(false);

  const loadTitles = () => {
    setLoading(true);
    setError(null);
    fetchApi<TitlesResponse>('/api/titles')
      .then((data) => setTitles(data.titles))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTitles();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">My Watchlist</h2>
          <p className="text-gray-400 text-sm mt-1">
            {titles.length} title{titles.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <button
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          onClick={() => setShowImport(true)}
        >
          + Import Titles
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            className="text-sm text-red-300 underline mt-2"
            onClick={loadTitles}
          >
            Try again
          </button>
        </div>
      ) : titles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No titles in your watchlist yet.</p>
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            onClick={() => setShowImport(true)}
          >
            Import Your First Titles
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <TitleList
              titles={titles}
              onSelectTitle={setSelectedTitle}
              selectedId={selectedTitle?.id}
            />
          </div>
          <div>
            {selectedTitle ? (
              <TitleTimeline title={selectedTitle} />
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-500">
                Select a title to view its availability timeline
              </div>
            )}
          </div>
        </div>
      )}

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImported={loadTitles}
      />
    </div>
  );
}
