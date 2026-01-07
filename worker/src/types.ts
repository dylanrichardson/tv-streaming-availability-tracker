export interface Env {
  DB: D1Database;
  CORS_ORIGIN: string;
}

export interface Title {
  id: number;
  name: string;
  type: 'movie' | 'tv';
  external_id: string | null;
  justwatch_id: string | null;
  poster_url: string | null;
  created_at: string;
}

export interface Service {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
}

export interface AvailabilityLog {
  id: number;
  title_id: number;
  service_id: number;
  check_date: string;
  is_available: boolean;
}

export interface JustWatchSearchResult {
  id: number;
  title: string;
  object_type: 'movie' | 'show';
  poster?: string;
  offers?: JustWatchOffer[];
}

export interface JustWatchOffer {
  provider_id: number;
  monetization_type: string;
  package_short_name: string;
}

export interface SyncRequest {
  titles: string[];
}

export interface HistoryResponse {
  title: Title;
  history: {
    date: string;
    services: string[];
  }[];
}

export interface ServiceCoverage {
  name: string;
  coverage: {
    date: string;
    percentage: number;
  }[];
}

export interface StatsResponse {
  services: ServiceCoverage[];
  totalTitles: number;
}
