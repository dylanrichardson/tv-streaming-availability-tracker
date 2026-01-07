import type { Env, SyncRequest, Title } from '../types';
import { createTitle, findTitleByName, getAllServices, getServiceBySlug, logAvailability } from '../services/database';
import { searchTitle, extractServicesFromOffers } from '../services/justwatch';

export async function handleSync(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as SyncRequest;
    const titleNames = body.titles;

    if (!Array.isArray(titleNames) || titleNames.length === 0) {
      return Response.json({ error: 'titles array is required' }, { status: 400 });
    }

    const results: { name: string; status: 'created' | 'exists' | 'not_found'; title?: Title }[] = [];

    for (const name of titleNames) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;

      // Check if title already exists
      const existing = await findTitleByName(env.DB, trimmedName);
      if (existing) {
        results.push({ name: trimmedName, status: 'exists', title: existing });
        continue;
      }

      // Search JustWatch for the title
      const jwResult = await searchTitle(trimmedName);
      if (!jwResult) {
        results.push({ name: trimmedName, status: 'not_found' });
        continue;
      }

      // Create the title in our database
      const title = await createTitle(
        env.DB,
        jwResult.title,
        jwResult.object_type === 'show' ? 'tv' : 'movie',
        jwResult.id.toString(),
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
    return Response.json({ error: 'Failed to sync titles' }, { status: 500 });
  }
}
