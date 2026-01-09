/**
 * Format JustWatch poster URL by replacing placeholders and adding domain
 * Handles both template URLs and already-formatted URLs
 * @returns Formatted poster URL, or null if input is null/undefined
 */
export function formatPosterUrl(posterUrl: string | null | undefined): string | null {
  if (!posterUrl) return null;

  // Already formatted correctly
  if (posterUrl.startsWith('https://')) return posterUrl;

  // Format template URL with size and format placeholders
  return `https://images.justwatch.com${posterUrl}`
    .replace('{profile}', 's332')  // Use s332 size (332px width)
    .replace('{format}', 'webp');  // Use webp format for better compression
}
