import { useState } from 'react';
import type { Title } from '../types';

interface TitleListProps {
  titles: (Title & { currentServices: string[] })[];
  onSelectTitle: (title: Title) => void;
  selectedId?: number;
}

const SERVICE_COLORS: Record<string, string> = {
  Netflix: 'bg-red-600',
  'Amazon Prime Video': 'bg-blue-500',
  Hulu: 'bg-green-500',
  'Disney+': 'bg-blue-700',
  'HBO Max': 'bg-purple-600',
  'Apple TV+': 'bg-gray-600',
  Peacock: 'bg-yellow-500',
  'Paramount+': 'bg-blue-800',
};

export function TitleList({ titles, onSelectTitle, selectedId }: TitleListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');

  const filtered = titles.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || t.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search titles..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'movie' | 'tv')}
        >
          <option value="all">All</option>
          <option value="movie">Movies</option>
          <option value="tv">TV Shows</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No titles found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((title) => (
            <button
              key={title.id}
              className={`w-full text-left p-4 rounded-lg transition-colors ${
                selectedId === title.id
                  ? 'bg-blue-600'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
              onClick={() => onSelectTitle(title)}
            >
              <div className="flex items-center gap-4">
                {title.poster_url && (
                  <img
                    src={title.poster_url}
                    alt={title.name}
                    className="w-12 h-18 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{title.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                      {title.type === 'tv' ? 'TV' : 'Movie'}
                    </span>
                  </div>
                  {title.currentServices && title.currentServices.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {title.currentServices.map((service) => (
                        <span
                          key={service}
                          className={`text-xs px-2 py-0.5 rounded text-white ${
                            SERVICE_COLORS[service] || 'bg-gray-600'
                          }`}
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">Not currently streaming</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
