import type { Env } from '../types';

export async function handleGetErrors(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let query = `
      SELECT * FROM error_logs
      WHERE timestamp > datetime('now', '-30 days')
    `;

    const bindings: string[] = [];

    if (type) {
      query += ` AND type = ?`;
      bindings.push(type);
    }

    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    bindings.push(String(limit), String(offset));

    const stmt = env.DB.prepare(query);
    const result = await stmt.bind(...bindings).all();

    return Response.json({
      errors: result.results,
      count: result.results?.length || 0,
    });
  } catch (error) {
    console.error('Failed to fetch errors:', error);
    return Response.json({ error: 'Failed to fetch errors' }, { status: 500 });
  }
}

export async function handleGetErrorStats(env: Env): Promise<Response> {
  try {
    // Get error counts by type
    const typeStats = await env.DB.prepare(`
      SELECT
        type,
        COUNT(*) as count,
        COUNT(DISTINCT message) as unique_messages
      FROM error_logs
      WHERE timestamp > datetime('now', '-7 days')
      GROUP BY type
    `).all();

    // Get top errors
    const topErrors = await env.DB.prepare(`
      SELECT
        message,
        type,
        COUNT(*) as count,
        MAX(timestamp) as last_seen
      FROM error_logs
      WHERE timestamp > datetime('now', '-7 days')
      GROUP BY message, type
      ORDER BY count DESC
      LIMIT 10
    `).all();

    return Response.json({
      typeStats: typeStats.results,
      topErrors: topErrors.results,
    });
  } catch (error) {
    console.error('Failed to fetch error stats:', error);
    return Response.json({ error: 'Failed to fetch error stats' }, { status: 500 });
  }
}
