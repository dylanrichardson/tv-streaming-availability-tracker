import type { Env, ConfirmRequest, ConfirmResultItem, Title } from '../types';
import { createTitle, findTitleByJustWatchId, getAllServices, logAvailability } from '../services/database';
import { extractServicesFromOffers } from '../services/justwatch';

// Import limits from SPAM-PREVENTION.md
const MAX_TOTAL_TITLES = 5000;
const MAX_TITLES_PER_REQUEST = 50;

export async function handleSyncConfirm(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as ConfirmRequest;
    const selections = body.selections;

    if (!Array.isArray(selections) || selections.length === 0) {
      return Response.json({ error: 'selections array is required' }, { status: 400 });
    }

    // Check per-request limit
    if (selections.length > MAX_TITLES_PER_REQUEST) {
      return Response.json({
        error: `Maximum ${MAX_TITLES_PER_REQUEST} titles per import request`,
        received: selections.length,
        limit: MAX_TITLES_PER_REQUEST
      }, { status: 400 });
    }

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

        // Extract services from offers and log initial availability
        const serviceSlugs = extractServicesFromOffers(jwResult.offers || []);
        const today = new Date().toISOString().split('T')[0];

        // Get all services to log availability (available + unavailable)
        const allServices = await getAllServices(env.DB);

        for (const service of allServices) {
          const isAvailable = serviceSlugs.includes(service.slug);
          await logAvailability(env.DB, title.id, service.id, today, isAvailable);
        }

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
    console.error('Sync confirm error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      error: 'Failed to confirm titles',
      details: errorMessage,
      timestamp: new Date().toISOString()
    };

    return Response.json(errorDetails, { status: 500 });
  }
}
