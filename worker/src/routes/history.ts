import type { Env } from '../types';
import { getTitleHistory } from '../services/database';

export async function handleHistory(titleId: string, env: Env): Promise<Response> {
  const id = parseInt(titleId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid title ID' }, { status: 400 });
  }

  const history = await getTitleHistory(env.DB, id);
  if (!history) {
    return Response.json({ error: 'Title not found' }, { status: 404 });
  }

  return Response.json(history);
}
