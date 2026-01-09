import type { Env, PreviewResponse, PreviewResultItem } from '../types';
import { findTitleByName, findTitleByJustWatchId } from '../services/database';
import { searchTitles } from '../services/justwatch';
import { buildErrorResponse } from '../utils/errors';
import { validateRequest, PreviewRequestSchema } from '../validation/schemas';
import { ZodError } from 'zod';

export async function handleSyncPreview(request: Request, env: Env): Promise<Response> {
  try {
    // Validate and parse request body
    const body = await validateRequest(request, PreviewRequestSchema);
    const titleNames = body.titles;

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
        const firstMatch = matches[0];
        const existingTitle = firstMatch
          ? await findTitleByJustWatchId(env.DB, firstMatch.id.toString()) || undefined
          : undefined;
        results.push({
          query: trimmedName,
          status: 'exists',
          matches: matches,
          existingTitle
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
    // Handle validation errors with detailed messages
    if (error instanceof ZodError) {
      return Response.json({
        error: 'Invalid request data',
        details: error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    return buildErrorResponse(error, 'Failed to preview titles');
  }
}
