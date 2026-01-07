import type { Env } from './types';
import { handleSync } from './routes/sync';
import { handleHistory } from './routes/history';
import { handleStats, handleRecommendations } from './routes/stats';
import { handleTitles } from './routes/titles';
import { handleScheduled } from './scheduled';

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function withCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsOrigin = env.CORS_ORIGIN || '*';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(corsOrigin) });
    }

    let response: Response;

    try {
      // API Routes
      if (path === '/api/sync' && request.method === 'POST') {
        response = await handleSync(request, env);
      } else if (path === '/api/titles' && request.method === 'GET') {
        response = await handleTitles(env);
      } else if (path.startsWith('/api/history/') && request.method === 'GET') {
        const titleId = path.split('/api/history/')[1];
        response = await handleHistory(titleId, env);
      } else if (path === '/api/stats/services' && request.method === 'GET') {
        response = await handleStats(env);
      } else if (path === '/api/recommendations' && request.method === 'GET') {
        response = await handleRecommendations(request, env);
      } else if (path === '/api/trigger-check' && request.method === 'POST') {
        // Manual trigger for testing (should be protected in production)
        await handleScheduled(env);
        response = Response.json({ message: 'Availability check triggered' });
      } else {
        response = Response.json({ error: 'Not found' }, { status: 404 });
      }
    } catch (error) {
      console.error('Request error:', error);
      response = Response.json({ error: 'Internal server error' }, { status: 500 });
    }

    return withCors(response, corsOrigin);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },
};
