import type { JustWatchSearchResult, JustWatchOffer } from '../types';

const JUSTWATCH_API = 'https://apis.justwatch.com/content';
const LOCALE = 'en_US';

// Map JustWatch provider IDs to our service slugs
const PROVIDER_MAP: Record<number, string> = {
  8: 'nfx',    // Netflix
  9: 'amp',    // Amazon Prime Video
  15: 'hlu',   // Hulu
  337: 'dnp',  // Disney+
  384: 'hbm',  // HBO Max
  350: 'atp',  // Apple TV+
  386: 'pck',  // Peacock
  531: 'pmp',  // Paramount+
};

export async function searchTitle(query: string): Promise<JustWatchSearchResult | null> {
  try {
    const response = await fetch(`${JUSTWATCH_API}/titles/${LOCALE}/popular`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        page: 1,
        page_size: 5,
        content_types: ['movie', 'show'],
      }),
    });

    if (!response.ok) {
      console.error(`JustWatch search failed: ${response.status}`);
      return null;
    }

    const data = await response.json() as { items?: any[] };
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    return {
      id: item.id,
      title: item.title,
      object_type: item.object_type === 'show' ? 'show' : 'movie',
      poster: item.poster ? `https://images.justwatch.com${item.poster.replace('{profile}', 's166')}` : undefined,
    };
  } catch (error) {
    console.error('JustWatch search error:', error);
    return null;
  }
}

export async function getTitleAvailability(justwatchId: number, type: 'movie' | 'tv'): Promise<string[]> {
  try {
    const objectType = type === 'tv' ? 'show' : 'movie';
    const response = await fetch(`${JUSTWATCH_API}/titles/${objectType}/${justwatchId}/locale/${LOCALE}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`JustWatch availability failed: ${response.status}`);
      return [];
    }

    const data = await response.json() as { offers?: JustWatchOffer[] };
    if (!data.offers) {
      return [];
    }

    // Filter for streaming offers (flatrate) and map to our service slugs
    const serviceSlugs = new Set<string>();
    for (const offer of data.offers) {
      if (offer.monetization_type === 'flatrate') {
        const slug = PROVIDER_MAP[offer.provider_id];
        if (slug) {
          serviceSlugs.add(slug);
        }
      }
    }

    return Array.from(serviceSlugs);
  } catch (error) {
    console.error('JustWatch availability error:', error);
    return [];
  }
}
