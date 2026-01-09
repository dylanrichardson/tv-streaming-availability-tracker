import type { Env, ConfirmResultItem, Title } from '../types';
import { createTitle, findTitleByJustWatchId } from '../services/database';
import { MAX_TOTAL_TITLES } from '../config/limits';
import { logInitialAvailability } from '../services/availability';
import { buildErrorResponse } from '../utils/errors';
import { validateRequest, ConfirmRequestSchema } from '../validation/schemas';
import { ZodError } from 'zod';

export async function handleSyncConfirm(request: Request, env: Env): Promise<Response> {
  try {
    // Validate and parse request body
    const body = await validateRequest(request, ConfirmRequestSchema);
    const selections = body.selections;

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

    const results: ConfirmResultItem[] = [];

    for (const selection of selections) {
      try {
        const { query, jwResult } = selection;

        // Check if title already exists by JustWatch ID
        const existingById = await findTitleByJustWatchId(env.DB, jwResult.id.toString());
        if (existingById) {
          results.push({
            name: query,
            status: 'exists',
            title: existingById
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

        results.push({
          name: query,
          status: 'created',
          title
        });
      } catch (error) {
        console.error(`Error processing selection for "${selection.query}":`, error);
        results.push({
          name: selection.query,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const existing = results.filter(r => r.status === 'exists').length;
    const errors = results.filter(r => r.status === 'error').length;

    return Response.json({
      message: `Processed ${results.length} titles: ${created} created, ${existing} already existed, ${errors} errors`,
      results
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
    return buildErrorResponse(error, 'Failed to confirm titles');
  }
}
