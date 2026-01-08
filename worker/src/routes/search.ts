import type { Env } from '../types';
import { searchTitles } from '../services/justwatch';

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  // Validate query parameter
  if (!query) {
    return Response.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }

  if (query.length < 2) {
    return Response.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  if (query.length > 100) {
    return Response.json({ error: 'Query must be at most 100 characters' }, { status: 400 });
  }

  // Search JustWatch
  const results = await searchTitles(query, 20);

  return Response.json({
    query,
    results: results.map(result => ({
      justwatch_id: result.id,
      name: result.title,
      type: result.object_type === 'show' ? 'tv' : 'movie',
      poster_url: result.poster,
      full_path: result.fullPath,
    })),
    count: results.length,
  });
}
