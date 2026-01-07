import { useEffect, useState } from 'react';
import type { Title, RecommendationsResponse } from '../types';
import { fetchApi } from '../hooks/useApi';

export function BuyRecommendations() {
  const [months, setMonths] = useState(3);
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchApi<RecommendationsResponse>(`/api/recommendations?months=${months}`)
      .then((data) => setTitles(data.titles))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [months]);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Buy Recommendations</h3>
        <select
          className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-sm"
          value={months}
          onChange={(e) => setMonths(parseInt(e.target.value, 10))}
        >
          <option value={1}>Unavailable 1+ month</option>
          <option value={3}>Unavailable 3+ months</option>
          <option value={6}>Unavailable 6+ months</option>
          <option value={12}>Unavailable 12+ months</option>
        </select>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Titles that haven't appeared on any streaming service for at least {months} month{months !== 1 ? 's' : ''}.
        Consider purchasing these.
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : titles.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          All titles have been available recently. No purchase recommendations.
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {titles.map((title) => (
            <div key={title.id} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded">
              {title.poster_url && (
                <img
                  src={title.poster_url}
                  alt={title.name}
                  className="w-8 h-12 object-cover rounded"
                />
              )}
              <div>
                <p className="font-medium">{title.name}</p>
                <p className="text-xs text-gray-500">
                  {title.type === 'tv' ? 'TV Show' : 'Movie'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
