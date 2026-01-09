import { useEffect, useState } from 'react';
import type { Title, HistoryResponse } from '../types';
import { fetchApi } from '../hooks/useApi';
import { SERVICE_COLORS, DEFAULT_SERVICE_COLOR } from '../constants/services';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorDisplay } from './common/ErrorDisplay';

interface TitleTimelineProps {
  title: Title;
}

type Granularity = 'month' | 'year';

export function TitleTimeline({ title }: TitleTimelineProps) {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('month');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchApi<HistoryResponse>(`/api/history/${title.id}`)
      .then(setHistory)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [title.id]);

  // Detect gaps in tracking (missing dates)
  const detectTrackingGaps = (dates: string[]): Set<string> => {
    if (dates.length < 2) return new Set();

    const sortedDates = [...dates].sort();
    const gapPeriods = new Set<string>();

    // Check for missing dates between first and last
    const firstDate = new Date(sortedDates[0]);
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    const dateSet = new Set(dates);

    for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!dateSet.has(dateStr)) {
        // This date is missing - mark the period as having gaps
        const dateObj = new Date(dateStr);
        const periodKey = granularity === 'month'
          ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
          : `${dateObj.getFullYear()}`;
        gapPeriods.add(periodKey);
      }
    }

    return gapPeriods;
  };

  // Aggregate dates by granularity
  const aggregateDates = (dates: string[], availableDates: string[], gapPeriods: Set<string>): { period: string; isAvailable: boolean; hasGaps: boolean; label: string }[] => {
    const periodMap = new Map<string, { available: number; total: number }>();

    dates.forEach((date) => {
      const dateObj = new Date(date);
      let periodKey: string;

      if (granularity === 'month') {
        periodKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      } else {
        // year
        periodKey = `${dateObj.getFullYear()}`;
      }

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, { available: 0, total: 0 });
      }

      const stats = periodMap.get(periodKey)!;
      stats.total++;
      if (availableDates.includes(date)) {
        stats.available++;
      }
    });

    return Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, stats]) => ({
        period,
        isAvailable: stats.available > 0,
        hasGaps: gapPeriods.has(period),
        label: granularity === 'month'
          ? new Date(period + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : period,
      }));
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  // If no history but has been checked, show single-date timeline with empty bars
  if (!history) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <h3 className="text-lg font-medium mb-2">{title.name}</h3>
        <p className="text-gray-500">
          No availability history yet. Data will appear after the daily check runs.
        </p>
      </div>
    );
  }

  // Get unique dates sorted
  let dates: string[];
  if (history.history.length === 0 && history.title.last_checked) {
    // Title was checked but no availability - create single-date timeline
    dates = [new Date(history.title.last_checked).toISOString().split('T')[0]];
  } else if (history.history.length === 0) {
    // Never checked - show message
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <h3 className="text-lg font-medium mb-2">{title.name}</h3>
        <p className="text-gray-500">
          No availability history yet. Data will appear after the daily check runs.
        </p>
      </div>
    );
  } else {
    dates = [...new Set(history.history.map((h) => h.date))].sort();
  }

  // Extract all unique services from the history data
  const allServicesInHistory = new Set<string>();
  history.history.forEach((h) => {
    h.services.forEach((service) => allServicesInHistory.add(service));
  });

  const servicesToShow = Array.from(allServicesInHistory).sort();
  const hasAnyAvailability = servicesToShow.length > 0;

  // Detect tracking gaps
  const trackingGaps = detectTrackingGaps(dates);

  // Determine bar width based on granularity
  const getBarWidth = () => {
    if (granularity === 'month') return 40;
    return 80; // year
  };

  const barWidth = getBarWidth();

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
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

        {/* Granularity selector */}
        <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
          {(['month', 'year'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                granularity === g
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="space-y-3 min-w-max">
          {hasAnyAvailability ? (
            servicesToShow.map((service) => {
              const availableDates = history.history
                .filter((h) => h.services.includes(service))
                .map((h) => h.date);

              const periods = aggregateDates(dates, availableDates, trackingGaps);

              return (
                <div key={service} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-400 truncate flex-shrink-0">{service}</div>
                  <div className="flex gap-1">
                    {periods.map((period) => (
                      <div
                        key={period.period}
                        className="h-6 rounded-sm relative"
                        style={{
                          width: `${barWidth}px`,
                          minWidth: `${barWidth}px`,
                          backgroundColor: period.isAvailable
                            ? SERVICE_COLORS[service] || DEFAULT_SERVICE_COLOR
                            : '#374151',
                          border: period.hasGaps ? '2px dashed #ef4444' : undefined,
                          boxSizing: 'border-box',
                        }}
                        title={`${period.label}: ${period.isAvailable ? 'Available' : 'Not available'}${period.hasGaps ? ' (incomplete tracking data)' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-500 italic flex-shrink-0">Not available</div>
              <div className="flex gap-1">
                {aggregateDates(dates, [], trackingGaps).map((period) => (
                  <div
                    key={period.period}
                    className="h-6 rounded-sm bg-gray-700"
                    style={{
                      width: `${barWidth}px`,
                      minWidth: `${barWidth}px`,
                      border: period.hasGaps ? '2px dashed #ef4444' : undefined,
                      boxSizing: 'border-box',
                    }}
                    title={`${period.label}: Not available on any service${period.hasGaps ? ' (incomplete tracking data)' : ''}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeline markers */}
        <div className="relative mt-4 min-w-max" style={{ marginLeft: '144px' }}>
          <div className="relative h-8">
            {aggregateDates(dates, [], trackingGaps).map((period, index) => {
              // For month view, show every 12th month to avoid overlap
              // For year view, show all
              if (granularity === 'month' && index % 12 !== 0) {
                return null;
              }

              return (
                <div
                  key={period.period}
                  className="absolute flex flex-col items-start"
                  style={{ left: `${index * (barWidth + 4)}px` }}
                >
                  <div className="h-2 w-px bg-gray-600"></div>
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-1">
                    {period.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
