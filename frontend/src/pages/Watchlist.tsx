import { useState } from 'react';
import type { Title } from '../types';
import { useTitles, invalidateTitlesCache } from '../hooks/useTitles';
import { TitleList } from '../components/TitleList';
import { TitleTimeline } from '../components/TitleTimeline';
import { ImportModal } from '../components/ImportModal';

export function Watchlist() {
  const { titles, loading, error, progress, reload } = useTitles();
  const [selectedTitle, setSelectedTitle] = useState<Title | null>(null);
  const [showImport, setShowImport] = useState(false);

  const handleImported = () => {
    invalidateTitlesCache();
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tracked Titles</h2>
          {loading ? (
            progress ? (
              <p className="text-gray-400 text-sm mt-1">
                Loading page {progress.current} of {progress.total}... ({titles.length} titles loaded)
              </p>
            ) : (
              <div className="h-5 w-32 bg-gray-700 rounded animate-pulse mt-1"></div>
            )
          ) : (
            <p className="text-gray-400 text-sm mt-1">
              {titles.length} title{titles.length !== 1 ? 's' : ''} tracked · Shared database
            </p>
          )}
        </div>
        <button
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          onClick={() => setShowImport(true)}
        >
          + Import Titles
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-24 bg-gray-700 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                    <div className="flex gap-2 mt-2">
                      <div className="h-6 w-16 bg-gray-700 rounded"></div>
                      <div className="h-6 w-16 bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            className="text-sm text-red-300 underline mt-2"
            onClick={reload}
          >
            Try again
          </button>
        </div>
      ) : titles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No titles tracked yet.</p>
          <p className="text-gray-600 text-sm mb-4">
            This is a shared database. Add titles to start tracking their streaming availability.
          </p>
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
          <div className="lg:sticky lg:top-6 lg:self-start">
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
        onImported={handleImported}
      />
    </div>
  );
}
