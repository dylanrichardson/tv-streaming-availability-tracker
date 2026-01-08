export interface Env {
  DB: D1Database;
  CORS_ORIGIN: string;
  ERROR_ANALYTICS?: AnalyticsEngineDataset;
}

export interface Title {
  id: number;
  name: string;
  type: 'movie' | 'tv';
  external_id: string | null;
  justwatch_id: string | null;
  full_path: string | null;
  poster_url: string | null;
  created_at: string;
  last_checked: string | null;
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
  fullPath?: string;
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

export interface SearchResponse {
  query: string;
  results: JustWatchSearchResult[];
  count: number;
}

export interface PreviewRequest {
  titles: string[];
}

export interface PreviewResultItem {
  query: string;
  status: 'unique' | 'multiple' | 'none' | 'exists';
  matches: JustWatchSearchResult[];
  existingTitle?: Title;
}

export interface PreviewResponse {
  results: PreviewResultItem[];
}

export interface ConfirmSelection {
  query: string;
  jwResult: JustWatchSearchResult;
}

export interface ConfirmRequest {
  selections: ConfirmSelection[];
}

export interface ConfirmResultItem {
  name: string;
  status: 'created' | 'exists' | 'error';
  title?: Title;
  error?: string;
}
