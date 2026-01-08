import type { Env } from '../types';
import { searchTitle } from '../services/justwatch';

interface BackfillResult {
  titleId: number;
  titleName: string;
  oldFullPath: string | null;
  newFullPath: string | null;
  status: 'updated' | 'not_found' | 'already_set' | 'error';
}

export async function handleBackfill(request: Request, env: Env): Promise<Response> {
  try {
    // Get titles without full_path
    const titlesResult = await env.DB
      .prepare('SELECT id, name, full_path FROM titles WHERE full_path IS NULL ORDER BY id LIMIT 100')
      .all<{ id: number; name: string; full_path: string | null }>();

    const titles = titlesResult.results || [];

    if (titles.length === 0) {
      return Response.json({
        message: 'No titles need backfilling',
        results: [],
      });
    }

    const results: BackfillResult[] = [];

    for (const title of titles) {
      try {
        console.log(`Backfilling ${title.name}...`);

        // Search JustWatch to get fullPath
        const jwResult = await searchTitle(title.name);

        if (!jwResult || !jwResult.fullPath) {
          console.log(`  Not found or missing fullPath`);
          results.push({
            titleId: title.id,
            titleName: title.name,
            oldFullPath: title.full_path,
            newFullPath: null,
            status: 'not_found',
          });
          continue;
        }

        // Update the database
        await env.DB
          .prepare('UPDATE titles SET full_path = ? WHERE id = ?')
          .bind(jwResult.fullPath, title.id)
          .run();

        console.log(`  ✓ Updated: ${jwResult.fullPath}`);

        results.push({
          titleId: title.id,
          titleName: title.name,
          oldFullPath: title.full_path,
          newFullPath: jwResult.fullPath,
          status: 'updated',
        });

        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error backfilling ${title.name}:`, error);
        results.push({
          titleId: title.id,
          titleName: title.name,
          oldFullPath: title.full_path,
          newFullPath: null,
          status: 'error',
        });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const notFound = results.filter(r => r.status === 'not_found').length;
    const errors = results.filter(r => r.status === 'error').length;

    return Response.json({
      message: `Backfilled ${updated} titles (${notFound} not found, ${errors} errors)`,
      results,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json(
      {
        error: 'Backfill failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
