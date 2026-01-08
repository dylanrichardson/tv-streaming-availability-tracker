import { useState, useCallback } from 'react';
import { API_URL } from '../config';
import { logError } from '../services/errorTracking';

const API_BASE = API_URL;

interface UseApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (endpoint: string, options: UseApiOptions = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `HTTP error ${response.status}`);

        // Log API error
        logError(error, 'api', {
          endpoint,
          method: options.method || 'GET',
          status: response.status,
        });

        throw error;
      }

      const result = await response.json() as T;
      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);

      // Log API error (if not already logged above)
      if (err instanceof Error && !err.message.includes('HTTP error')) {
        logError(err, 'api', {
          endpoint,
          method: options.method || 'GET',
        });
      }

      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, request };
}

export async function fetchApi<T>(endpoint: string, options: UseApiOptions = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || `HTTP error ${response.status}`);

      // Log API error
      logError(error, 'api', {
        endpoint,
        method: options.method || 'GET',
        status: response.status,
      });

      throw error;
    }

    return response.json() as Promise<T>;
  } catch (err) {
    // Log network errors (if not already logged above)
    if (err instanceof Error && !err.message.includes('HTTP error')) {
      logError(err, 'network', {
        endpoint,
        method: options.method || 'GET',
      });
    }
    throw err;
  }
}
