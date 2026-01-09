import type { JustWatchSearchResult, JustWatchOffer } from '../types';
import { formatPosterUrl } from '../utils/poster';

const JUSTWATCH_GRAPHQL = 'https://apis.justwatch.com/graphql';
const COUNTRY = 'US';
const LANGUAGE = 'en';

// JustWatch GraphQL API Type Definitions
interface JustWatchNode {
  objectId: number;
  objectType: 'MOVIE' | 'SHOW';
  content: {
    title: string;
    fullPath?: string;
    posterUrl?: string;
  };
  offers?: JustWatchOffer[];
}

interface JustWatchEdge {
  node: JustWatchNode;
}

interface JustWatchGraphQLResponse {
  data?: {
    searchTitles?: {
      edges: JustWatchEdge[];
    };
  };
  errors?: Array<{ message: string }>;
}

// Map JustWatch package short names to our service slugs
const PACKAGE_MAP: Record<string, string> = {
  'nfx': 'nfx',    // Netflix
  'amp': 'amp',    // Amazon Prime Video
  'hlu': 'hlu',    // Hulu
  'dnp': 'dnp',    // Disney+
  'hbm': 'hbm',    // HBO Max
  'atp': 'atp',    // Apple TV+
  'pct': 'pck',    // Peacock (regular)
  'pcp': 'pck',    // Peacock Premium
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

const GET_TITLE_QUERY = `
query GetUrlTitleDetails($fullPath: String!, $country: Country!, $language: Language!) {
  urlV2(fullPath: $fullPath) {
    node {
      ... on MovieOrShowOrSeasonOrEpisode {
        id
        objectType
        objectId
        content(country: $country, language: $language) {
          title
        }
        offers(country: $country, platform: WEB, filter: {preAffiliate: true}) {
          monetizationType
          presentationType
          package {
            id
            packageId
            shortName
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

    const data = await response.json() as JustWatchGraphQLResponse;
    const edges = data?.data?.searchTitles?.edges;

    if (!edges || edges.length === 0) {
      return null;
    }

    const firstEdge = edges[0];
    if (!firstEdge) {
      return null;
    }

    const node = firstEdge.node;

    return {
      id: node.objectId,
      title: node.content.title,
      object_type: node.objectType === 'SHOW' ? 'show' : 'movie',
      fullPath: node.content.fullPath || undefined,
      poster: formatPosterUrl(node.content.posterUrl),
      offers: node.offers || undefined,
    };
  } catch (error) {
    console.error('JustWatch search error:', error);
    return null;
  }
}

export async function searchTitles(query: string, limit: number = 20): Promise<JustWatchSearchResult[]> {
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
          first: limit,
          location: 'SearchSuggester',
        },
        query: SEARCH_QUERY,
      }),
    });

    if (!response.ok) {
      console.error(`JustWatch search failed: ${response.status}`);
      return [];
    }

    const data = await response.json() as JustWatchGraphQLResponse;
    const edges = data?.data?.searchTitles?.edges;

    if (!edges || edges.length === 0) {
      return [];
    }

    // Map all results, not just the first one
    return edges.map((edge) => {
      const node = edge.node;

      return {
        id: node.objectId,
        title: node.content.title,
        object_type: node.objectType === 'SHOW' ? 'show' : 'movie',
        fullPath: node.content.fullPath || undefined,
        poster: formatPosterUrl(node.content.posterUrl),
        offers: node.offers || undefined,
      };
    });
  } catch (error) {
    console.error('JustWatch search error:', error);
    return [];
  }
}

async function getTitleByPath(fullPath: string): Promise<any | null> {
  try {
    const response = await fetch(JUSTWATCH_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Version': '3.13.0-web-web',
      },
      body: JSON.stringify({
        operationName: 'GetUrlTitleDetails',
        variables: {
          fullPath,
          country: COUNTRY,
          language: LANGUAGE,
        },
        query: GET_TITLE_QUERY,
      }),
    });

    if (!response.ok) {
      console.error(`JustWatch getTitleByPath failed: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;

    // Check for GraphQL errors
    if (data.errors) {
      console.error('JustWatch GraphQL errors:', JSON.stringify(data.errors));
      return null;
    }

    return data?.data?.urlV2?.node || null;
  } catch (error) {
    console.error('JustWatch getTitleByPath error:', error);
    return null;
  }
}

export async function getTitleAvailability(justwatchId: number, type: 'movie' | 'tv', titleName: string, fullPath?: string | null): Promise<string[]> {
  try {
    // If we have fullPath, use it for accurate querying
    if (fullPath) {
      const titleData = await getTitleByPath(fullPath);
      if (titleData && titleData.offers) {
        return extractServicesFromOffers(titleData.offers);
      }
      console.log(`No offers found for ${titleName} using fullPath ${fullPath}`);
    }

    // Fallback: search by name (less accurate, may match wrong version)
    const searchResult = await searchTitle(titleName);

    if (!searchResult || !searchResult.offers) {
      console.log(`No results found for ${titleName} during availability check`);
      return [];
    }

    return extractServicesFromOffers(searchResult.offers);
  } catch (error) {
    console.error('JustWatch availability error:', error);
    return [];
  }
}

export function extractServicesFromOffers(offers: JustWatchOffer[]): string[] {
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
