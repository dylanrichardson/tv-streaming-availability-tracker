import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ServiceCoverage } from '../types';
import { SERVICE_COLORS } from '../constants/services';
import { EmptyState } from './common/EmptyState';

interface ServiceChartProps {
  services: ServiceCoverage[];
  totalTitles: number;
}

export function ServiceChart({ services, totalTitles }: ServiceChartProps) {
  if (services.length === 0 || services.every((s) => s.coverage.length === 0)) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <EmptyState message="No coverage data yet. Data will appear after the daily check runs." />
      </div>
    );
  }

  // Get all unique dates and build chart data
  const allDates = new Set<string>();
  services.forEach((s) => s.coverage.forEach((c) => allDates.add(c.date)));
  const sortedDates = Array.from(allDates).sort();

  const chartData = sortedDates.map((date) => {
    const point: Record<string, string | number> = { date };
    services.forEach((service) => {
      const coverage = service.coverage.find((c) => c.date === date);
      point[service.name] = coverage?.percentage || 0;
    });
    return point;
  });

  const activeServices = services.filter((s) => s.coverage.length > 0);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Service Coverage Over Time</h3>
        <span className="text-sm text-gray-400">{totalTitles} titles tracked</span>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fff' }}
              formatter={(value) => [`${value}%`, '']}
            />
            <Legend />
            {activeServices.map((service) => (
              <Line
                key={service.name}
                type="monotone"
                dataKey={service.name}
                stroke={SERVICE_COLORS[service.name] || '#666'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
