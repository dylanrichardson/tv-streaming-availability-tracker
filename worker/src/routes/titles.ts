import type { Env } from '../types';
import { getTitlesWithCurrentAvailability, getTitlesCount } from '../services/database';

export async function handleTitles(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  // Validate params
  if (page < 1 || limit < 1 || limit > 100) {
    return Response.json({ error: 'Invalid pagination params' }, { status: 400 });
  }

  const offset = (page - 1) * limit;
  const [titles, totalCount] = await Promise.all([
    getTitlesWithCurrentAvailability(env.DB, limit, offset),
    getTitlesCount(env.DB),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return Response.json({
    titles,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasMore: page < totalPages,
    },
  });
}
