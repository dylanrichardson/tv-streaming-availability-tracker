import { useEffect, useState } from 'react';
import type { Title, HistoryResponse } from '../types';
import { fetchApi } from '../hooks/useApi';

interface TitleTimelineProps {
  title: Title;
}

const SERVICE_COLORS: Record<string, string> = {
  Netflix: '#e50914',
  'Amazon Prime Video': '#00a8e1',
  Hulu: '#1ce783',
  'Disney+': '#113ccf',
  'HBO Max': '#b385f2',
  'Apple TV+': '#555555',
  Peacock: '#ffc107',
  'Paramount+': '#0064ff',
};

const ALL_SERVICES = [
  'Netflix',
  'Amazon Prime Video',
  'Hulu',
  'Disney+',
  'HBO Max',
  'Apple TV+',
  'Peacock',
  'Paramount+',
];

export function TitleTimeline({ title }: TitleTimelineProps) {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchApi<HistoryResponse>(`/api/history/${title.id}`)
      .then(setHistory)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [title.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!history || history.history.length === 0) {
    const lastCheckedDate = history?.title.last_checked
      ? new Date(history.title.last_checked).toLocaleDateString()
      : null;

    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <h3 className="text-lg font-medium mb-2">{title.name}</h3>
        {lastCheckedDate ? (
          <p className="text-gray-500">
            Checked on {lastCheckedDate}. Not currently available on any tracked streaming services.
          </p>
        ) : (
          <p className="text-gray-500">
            No availability history yet. Data will appear after the daily check runs.
          </p>
        )}
      </div>
    );
  }

  // Get unique dates sorted
  const dates = [...new Set(history.history.map((h) => h.date))].sort();

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-4 mb-6">
        {title.poster_url && (
          <img
            src={title.poster_url}
            alt={title.name}
            className="w-20 h-30 object-cover rounded"
          />
        )}
        <div>
          <h3 className="text-xl font-medium">{title.name}</h3>
          <p className="text-gray-400 text-sm">
            {title.type === 'tv' ? 'TV Show' : 'Movie'} &middot; {dates.length} day{dates.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {ALL_SERVICES.map((service) => {
          const availableDates = history.history
            .filter((h) => h.services.includes(service))
            .map((h) => h.date);

          return (
            <div key={service} className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-400 truncate">{service}</div>
              <div className="flex-1 flex gap-0.5">
                {dates.map((date) => (
                  <div
                    key={date}
                    className="h-6 flex-1 rounded-sm"
                    style={{
                      backgroundColor: availableDates.includes(date)
                        ? SERVICE_COLORS[service]
                        : '#374151',
                    }}
                    title={`${date}: ${availableDates.includes(date) ? 'Available' : 'Not available'}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-4 text-xs text-gray-500">
        <span>{dates[0]}</span>
        <span>{dates[dates.length - 1]}</span>
      </div>
    </div>
  );
}
