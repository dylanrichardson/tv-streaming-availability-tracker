import { useEffect, useState } from 'react';
import type { StatsResponse } from '../types';
import { fetchApi } from '../hooks/useApi';
import { ServiceChart } from '../components/ServiceChart';
import { BuyRecommendations } from '../components/BuyRecommendations';

export function Analytics() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<StatsResponse>('/api/stats/services')
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Analytics</h2>
        <p className="text-gray-400 text-sm mt-1">
          Track how tracked title availability changes across streaming services
        </p>
      </div>

      {stats && (
        <>
          <ServiceChart services={stats.services} totalTitles={stats.totalTitles} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.services.map((service) => {
              const latestCoverage = service.coverage[0]?.percentage || 0;
              return (
                <div key={service.name} className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm text-gray-400">{service.name}</h4>
                  <p className="text-2xl font-bold mt-1">{latestCoverage}%</p>
                  <p className="text-xs text-gray-500 mt-1">of tracked titles</p>
                </div>
              );
            })}
          </div>

          <BuyRecommendations />
        </>
      )}
    </div>
  );
}
