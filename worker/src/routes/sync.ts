import type { Env, SyncRequest, Title } from '../types';
import { createTitle, findTitleByName, findTitleByJustWatchId, getAllServices, getServiceBySlug, logAvailability } from '../services/database';
import { searchTitle, extractServicesFromOffers } from '../services/justwatch';

// Import limits from SPAM-PREVENTION.md
const MAX_TOTAL_TITLES = 5000;
const MAX_TITLES_PER_REQUEST = 50;

export async function handleSync(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as SyncRequest;
    const titleNames = body.titles;

    if (!Array.isArray(titleNames) || titleNames.length === 0) {
      return Response.json({ error: 'titles array is required' }, { status: 400 });
    }

    // Check per-request limit
    if (titleNames.length > MAX_TITLES_PER_REQUEST) {
      return Response.json({
        error: `Maximum ${MAX_TITLES_PER_REQUEST} titles per import request`,
        received: titleNames.length,
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

    const results: { name: string; status: 'created' | 'exists' | 'not_found'; title?: Title; note?: string }[] = [];

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

      // Extract services from offers and log initial availability
      const serviceSlugs = extractServicesFromOffers(jwResult.offers || []);
      const today = new Date().toISOString().split('T')[0];

      // Get all services to log availability (available + unavailable)
      const allServices = await getAllServices(env.DB);

      for (const service of allServices) {
        const isAvailable = serviceSlugs.includes(service.slug);
        await logAvailability(env.DB, title.id, service.id, today, isAvailable);
      }

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
    console.error('Sync error:', error);

    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      error: 'Failed to sync titles',
      details: errorMessage,
      timestamp: new Date().toISOString()
    };

    return Response.json(errorDetails, { status: 500 });
  }
}
