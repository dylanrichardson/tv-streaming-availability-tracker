#!/usr/bin/env node
/**
 * Backfill script to populate full_path for existing titles
 *
 * Usage:
 *   npx tsx scripts/backfill-fullpath.ts [--dry-run] [--batch-size=10]
 *
 * Options:
 *   --dry-run: Preview changes without updating database
 *   --batch-size: Number of titles to process at once (default: 10)
 */

import { searchTitle } from '../src/services/justwatch';

const JUSTWATCH_GRAPHQL = 'https://apis.justwatch.com/graphql';
const API_DELAY_MS = 500; // Delay between requests to avoid rate limiting

interface Title {
  id: number;
  name: string;
  type: string;
  justwatch_id: string | null;
  full_path: string | null;
}

interface BackfillResult {
  titleId: number;
  titleName: string;
  fullPath: string | null;
  status: 'success' | 'not_found' | 'error';
  error?: string;
}

async function fetchTitlesWithoutFullPath(db: D1Database): Promise<Title[]> {
  const result = await db
    .prepare('SELECT id, name, type, justwatch_id, full_path FROM titles WHERE full_path IS NULL ORDER BY id')
    .all<Title>();

  return result.results || [];
}

async function updateTitleFullPath(db: D1Database, titleId: number, fullPath: string): Promise<void> {
  await db
    .prepare('UPDATE titles SET full_path = ? WHERE id = ?')
    .bind(fullPath, titleId)
    .run();
}

async function backfillTitle(title: Title, dryRun: boolean): Promise<BackfillResult> {
  try {
    console.log(`Searching JustWatch for: ${title.name}`);

    const jwResult = await searchTitle(title.name);

    if (!jwResult || !jwResult.fullPath) {
      console.log(`  ❌ Not found or missing fullPath`);
      return {
        titleId: title.id,
        titleName: title.name,
        fullPath: null,
        status: 'not_found',
      };
    }

    console.log(`  ✓ Found: ${jwResult.fullPath}`);

    if (!dryRun) {
      // Update will be done in the main loop
    }

    return {
      titleId: title.id,
      titleName: title.name,
      fullPath: jwResult.fullPath,
      status: 'success',
    };
  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      titleId: title.id,
      titleName: title.name,
      fullPath: null,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 10;

  console.log('=== Backfill full_path Script ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log('');

  // In a real environment, you'd get the D1 binding from your worker context
  // For this script, we need to use wrangler CLI commands instead
  console.log('ERROR: This script needs to be integrated with your Worker environment.');
  console.log('For now, use the manual approach below:\n');
  console.log('1. List titles without fullPath:');
  console.log('   npx wrangler d1 execute streamtrack --remote --command "SELECT id, name FROM titles WHERE full_path IS NULL"');
  console.log('');
  console.log('2. For each title, search JustWatch and update:');
  console.log('   # Search on JustWatch.com to find the correct fullPath');
  console.log('   npx wrangler d1 execute streamtrack --remote --command "UPDATE titles SET full_path = \'/us/tv-show/the-office-2005\' WHERE id = 3"');
  console.log('');
  console.log('Alternatively, create a Worker endpoint that runs this backfill and call it via curl.');
}

main().catch(console.error);
