import type { Env, PreviewRequest, PreviewResponse, PreviewResultItem } from '../types';
import { findTitleByName, findTitleByJustWatchId } from '../services/database';
import { searchTitles } from '../services/justwatch';

// Import limits from SPAM-PREVENTION.md
const MAX_TITLES_PER_REQUEST = 50;

export async function handleSyncPreview(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as PreviewRequest;
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

    const results: PreviewResultItem[] = [];

    for (const name of titleNames) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;

      // Check if title already exists by name
      const existingByName = await findTitleByName(env.DB, trimmedName);
      if (existingByName) {
        results.push({
          query: trimmedName,
          status: 'exists',
          matches: [],
          existingTitle: existingByName
        });
        continue;
      }

      // Search JustWatch for multiple matches (up to 5 results per title)
      const matches = await searchTitles(trimmedName, 5);

      if (matches.length === 0) {
        results.push({
          query: trimmedName,
          status: 'none',
          matches: []
        });
        continue;
      }

      // Filter out matches that already exist in our DB by JustWatch ID
      const uniqueMatches = [];
      for (const match of matches) {
        const existingById = await findTitleByJustWatchId(env.DB, match.id.toString());
        if (!existingById) {
          uniqueMatches.push(match);
        }
      }

      // Determine status based on number of unique matches
      if (uniqueMatches.length === 0) {
        // All matches already exist
        results.push({
          query: trimmedName,
          status: 'exists',
          matches: matches,
          existingTitle: await findTitleByJustWatchId(env.DB, matches[0].id.toString()) || undefined
        });
      } else if (uniqueMatches.length === 1) {
        results.push({
          query: trimmedName,
          status: 'unique',
          matches: uniqueMatches
        });
      } else {
        results.push({
          query: trimmedName,
          status: 'multiple',
          matches: uniqueMatches
        });
      }
    }

    return Response.json({ results } as PreviewResponse);
  } catch (error) {
    console.error('Sync preview error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      error: 'Failed to preview titles',
      details: errorMessage,
      timestamp: new Date().toISOString()
    };

    return Response.json(errorDetails, { status: 500 });
  }
}
