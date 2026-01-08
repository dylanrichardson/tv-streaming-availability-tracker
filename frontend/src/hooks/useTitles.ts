import { useState, useEffect, useCallback } from 'react';
import type { Title, TitlesResponse } from '../types';
import { fetchApi } from './useApi';

const CACHE_KEY = 'streamtrack_titles_cache';
const CACHE_VERSION_KEY = 'streamtrack_titles_cache_version';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 50;

interface CacheData {
  titles: (Title & { currentServices: string[] })[];
  timestamp: number;
  version: number;
}

function getCachedTitles(): (Title & { currentServices: string[] })[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const version = localStorage.getItem(CACHE_VERSION_KEY);

    if (!cached || !version) return null;

    const data: CacheData = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Check version match
    if (data.version.toString() !== version) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data.titles;
  } catch (error) {
    console.error('Failed to read cache:', error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function setCachedTitles(titles: (Title & { currentServices: string[] })[]): void {
  try {
    const version = Date.now();
    const data: CacheData = {
      titles,
      timestamp: Date.now(),
      version,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_VERSION_KEY, version.toString());
  } catch (error) {
    console.error('Failed to write cache:', error);
  }
}

export function invalidateTitlesCache(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_VERSION_KEY);
}

export function useTitles() {
  const [titles, setTitles] = useState<(Title & { currentServices: string[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const loadTitles = useCallback(async () => {
    // Try cache first
    const cached = getCachedTitles();
    if (cached && cached.length > 0) {
      setTitles(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setTitles([]);

    try {
      // Fetch first page to get total count
      const firstPage = await fetchApi<TitlesResponse>(`/api/titles?page=1&limit=${PAGE_SIZE}`);

      if (!firstPage.pagination) {
        // Old API format without pagination
        setTitles(firstPage.titles);
        setLoading(false);
        setCachedTitles(firstPage.titles);
        return;
      }

      const allTitles = [...firstPage.titles];
      setTitles(allTitles);
      setProgress({ current: 1, total: firstPage.pagination.totalPages });

      // If there are more pages, fetch them progressively
      if (firstPage.pagination.hasMore) {
        const pagePromises = [];
        for (let page = 2; page <= firstPage.pagination.totalPages; page++) {
          pagePromises.push(
            fetchApi<TitlesResponse>(`/api/titles?page=${page}&limit=${PAGE_SIZE}`)
              .then((response) => {
                // Add titles as they arrive
                setTitles((prev) => [...prev, ...response.titles]);
                setProgress({ current: page, total: firstPage.pagination!.totalPages });
                return response.titles;
              })
          );
        }

        // Wait for all pages
        const results = await Promise.all(pagePromises);
        const finalTitles = [...allTitles, ...results.flat()];

        setTitles(finalTitles);
        setCachedTitles(finalTitles);
      } else {
        setCachedTitles(allTitles);
      }

      setProgress(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load titles');
      setLoading(false);
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    loadTitles();
  }, [loadTitles]);

  return {
    titles,
    loading,
    error,
    progress,
    reload: loadTitles,
  };
}
