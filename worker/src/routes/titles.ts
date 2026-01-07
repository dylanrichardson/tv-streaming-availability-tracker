import type { Env } from '../types';
import { getTitlesWithCurrentAvailability } from '../services/database';

export async function handleTitles(env: Env): Promise<Response> {
  const titles = await getTitlesWithCurrentAvailability(env.DB);
  return Response.json({ titles });
}
