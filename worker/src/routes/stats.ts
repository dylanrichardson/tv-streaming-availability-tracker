import type { Env } from '../types';
import { getServiceStats, getUnavailableTitles } from '../services/database';

export async function handleStats(env: Env): Promise<Response> {
  const stats = await getServiceStats(env.DB);
  return Response.json(stats);
}

export async function handleRecommendations(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const months = parseInt(url.searchParams.get('months') || '3', 10);

  if (isNaN(months) || months < 1) {
    return Response.json({ error: 'Invalid months parameter' }, { status: 400 });
  }

  const unavailable = await getUnavailableTitles(env.DB, months);
  return Response.json({
    monthsThreshold: months,
    titles: unavailable,
    count: unavailable.length,
  });
}
