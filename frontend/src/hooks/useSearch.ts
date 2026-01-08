import { useState, useEffect } from 'react';
import type { SearchResult, SearchResponse } from '../types';
import { fetchApi } from './useApi';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip search if query is too short
    if (query.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    // Debounce the search
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchApi<SearchResponse>(
          `/api/search?q=${encodeURIComponent(query)}`
        );
        setResults(response.results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const retry = () => {
    // Trigger a re-search by updating the query to itself
    setQuery((prev) => prev);
  };

  return { query, setQuery, results, loading, error, retry };
}
