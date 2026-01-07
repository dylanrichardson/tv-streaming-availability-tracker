import type { JustWatchSearchResult } from '../types';

const JUSTWATCH_GRAPHQL = 'https://apis.justwatch.com/graphql';
const COUNTRY = 'US';
const LANGUAGE = 'en';

// Map JustWatch package short names to our service slugs
const PACKAGE_MAP: Record<string, string> = {
  'nfx': 'nfx',    // Netflix
  'amp': 'amp',    // Amazon Prime Video
  'hlu': 'hlu',    // Hulu
  'dnp': 'dnp',    // Disney+
  'hbm': 'hbm',    // HBO Max
  'atp': 'atp',    // Apple TV+
  'pck': 'pck',    // Peacock
  'pmp': 'pmp',    // Paramount+
};

const SEARCH_QUERY = `
query GetSearchResults($country: Country!, $language: Language!, $first: Int!, $searchQuery: String, $location: String!) {
  searchTitles(
    country: $country
    first: $first
    filter: {searchQuery: $searchQuery, includeTitlesWithoutUrl: true}
    source: $location
  ) {
    edges {
      node {
        id
        objectType
        objectId
        content(country: $country, language: $language) {
          fullPath
          title
          originalReleaseYear
          posterUrl
        }
        offers(country: $country, platform: WEB, filter: {preAffiliate: true}) {
          monetizationType
          package {
            shortName
            packageId
          }
        }
      }
    }
  }
}
`;

export async function searchTitle(query: string): Promise<JustWatchSearchResult | null> {
  try {
    const response = await fetch(JUSTWATCH_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Version': '3.13.0-web-web',
      },
      body: JSON.stringify({
        operationName: 'GetSearchResults',
        variables: {
          country: COUNTRY,
          language: LANGUAGE,
          searchQuery: query,
          first: 5,
          location: 'SearchSuggester',
        },
        query: SEARCH_QUERY,
      }),
    });

    if (!response.ok) {
      console.error(`JustWatch search failed: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    const edges = data?.data?.searchTitles?.edges;

    if (!edges || edges.length === 0) {
      return null;
    }

    const node = edges[0].node;
    return {
      id: node.objectId,
      title: node.content.title,
      object_type: node.objectType === 'SHOW' ? 'show' : 'movie',
      poster: node.content.posterUrl,
      offers: node.offers || [],
    };
  } catch (error) {
    console.error('JustWatch search error:', error);
    return null;
  }
}

export async function getTitleAvailability(justwatchId: number, type: 'movie' | 'tv'): Promise<string[]> {
  // Note: This is kept for the daily check, but could be optimized
  // For now, we'll need to search by ID or refactor to store offers differently
  console.warn('getTitleAvailability called - this may need refactoring for GraphQL');
  return [];
}

export function extractServicesFromOffers(offers: any[]): string[] {
  const serviceSlugs = new Set<string>();

  for (const offer of offers) {
    if (offer.monetizationType === 'FLATRATE') {
      const shortName = offer.package?.shortName?.toLowerCase();
      if (shortName && PACKAGE_MAP[shortName]) {
        serviceSlugs.add(PACKAGE_MAP[shortName]);
      }
    }
  }

  return Array.from(serviceSlugs);
}
