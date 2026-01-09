import type { Env, Title } from '../types';
import { createTitle, findTitleByName, findTitleByJustWatchId } from '../services/database';
import { searchTitle } from '../services/justwatch';
import { MAX_TOTAL_TITLES } from '../config/limits';
import { logInitialAvailability } from '../services/availability';
import { buildErrorResponse } from '../utils/errors';
import { validateRequest, SyncRequestSchema } from '../validation/schemas';
import { ZodError } from 'zod';

export async function handleSync(request: Request, env: Env): Promise<Response> {
  try {
    // Validate and parse request body
    const body = await validateRequest(request, SyncRequestSchema);
    const titleNames = body.titles;

    // Check total titles limit
    const countResult = await env.DB
      .prepare('SELECT COUNT(*) as count FROM titles')
      .first<{ count: number }>();

    if (countResult && countResult.count >= MAX_TOTAL_TITLES) {
      return Response.json({
        error: `Database capacity reached (${MAX_TOTAL_TITLES} titles)`,
        message: 'This is a personal project with limited capacity. Search existing titles instead.',
        currentCount: countResult.count,
        limit: MAX_TOTAL_TITLES
      }, { status: 429 });
    }

    const results: { name: string; status: 'created' | 'exists' | 'not_found'; title?: Title | undefined; note?: string | undefined }[] = [];

    for (const name of titleNames) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;

      // Check if title already exists by name
      const existingByName = await findTitleByName(env.DB, trimmedName);
      if (existingByName) {
        results.push({ name: trimmedName, status: 'exists', title: existingByName });
        continue;
      }

      // Search JustWatch for the title
      const jwResult = await searchTitle(trimmedName);
      if (!jwResult) {
        results.push({ name: trimmedName, status: 'not_found' });
        continue;
      }

      // Check if title already exists by JustWatch ID (handles name variations)
      const existingById = await findTitleByJustWatchId(env.DB, jwResult.id.toString());
      if (existingById) {
        results.push({
          name: trimmedName,
          status: 'exists',
          title: existingById,
          note: existingById.name !== trimmedName
            ? `Already tracked as "${existingById.name}"`
            : undefined
        });
        continue;
      }

      // Create the title in our database
      const title = await createTitle(
        env.DB,
        jwResult.title,
        jwResult.object_type === 'show' ? 'tv' : 'movie',
        jwResult.id.toString(),
        jwResult.fullPath || null,
        jwResult.poster || null
      );

      // Log initial availability across all services
      await logInitialAvailability(env.DB, title.id, jwResult.offers || []);

      results.push({ name: trimmedName, status: 'created', title });
    }

    const created = results.filter((r) => r.status === 'created').length;
    const existing = results.filter((r) => r.status === 'exists').length;
    const notFound = results.filter((r) => r.status === 'not_found').length;

    return Response.json({
      message: `Processed ${results.length} titles: ${created} created, ${existing} already existed, ${notFound} not found`,
      results,
    });
  } catch (error) {
    // Handle validation errors with detailed messages
    if (error instanceof ZodError) {
      return Response.json({
        error: 'Invalid request data',
        details: error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    return buildErrorResponse(error, 'Failed to sync titles');
  }
}
