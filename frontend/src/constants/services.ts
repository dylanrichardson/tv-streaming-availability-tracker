/**
 * Streaming service color constants
 * Used for badges, charts, and timeline visualizations
 */

/** Hex colors for charts and timeline visualizations */
export const SERVICE_COLORS: Record<string, string> = {
  Netflix: '#e50914',
  'Amazon Prime Video': '#00a8e1',
  Hulu: '#1ce783',
  'Disney+': '#113ccf',
  'HBO Max': '#b385f2',
  'Apple TV+': '#555555',
  Peacock: '#ffc107',
  'Paramount+': '#0064ff',
};

/** Tailwind CSS classes for service badges */
export const SERVICE_BADGE_CLASSES: Record<string, string> = {
  Netflix: 'bg-red-600',
  'Amazon Prime Video': 'bg-blue-500',
  Hulu: 'bg-green-500',
  'Disney+': 'bg-blue-700',
  'HBO Max': 'bg-purple-600',
  'Apple TV+': 'bg-gray-600',
  Peacock: 'bg-yellow-500',
  'Paramount+': 'bg-blue-800',
};

/** Default color for unknown services (chart visualizations) */
export const DEFAULT_SERVICE_COLOR = '#64748b';

/** Default badge class for unknown services */
export const DEFAULT_BADGE_CLASS = 'bg-gray-500';
