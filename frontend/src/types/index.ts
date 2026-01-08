export interface Title {
  id: number;
  name: string;
  type: 'movie' | 'tv';
  external_id: string | null;
  justwatch_id: string | null;
  poster_url: string | null;
  created_at: string;
  last_checked: string | null;
  currentServices?: string[];
}

export interface Service {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
}

export interface HistoryEntry {
  date: string;
  services: string[];
}

export interface HistoryResponse {
  title: Title;
  history: HistoryEntry[];
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

export interface SyncResult {
  name: string;
  status: 'created' | 'exists' | 'not_found';
  title?: Title;
}

export interface SyncResponse {
  message: string;
  results: SyncResult[];
}

export interface TitlesResponse {
  titles: (Title & { currentServices: string[] })[];
}

export interface RecommendationsResponse {
  monthsThreshold: number;
  titles: Title[];
  count: number;
}
