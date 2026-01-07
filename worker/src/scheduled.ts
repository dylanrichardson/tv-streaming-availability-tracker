import type { Env } from './types';
import { getAllTitles, getAllServices, getServiceBySlug, logAvailability } from './services/database';
import { getTitleAvailability } from './services/justwatch';

export async function handleScheduled(env: Env): Promise<void> {
  console.log('Starting scheduled availability check...');

  const titles = await getAllTitles(env.DB);
  const services = await getAllServices(env.DB);
  const today = new Date().toISOString().split('T')[0];

  // Divide titles into 6 batches (for 4-hour intervals: 0, 4, 8, 12, 16, 20 UTC)
  const hour = new Date().getUTCHours();
  const batch = Math.floor(hour / 4); // 0-5
  const titlesPerBatch = Math.ceil(titles.length / 6);

  const startIdx = batch * titlesPerBatch;
  const endIdx = Math.min(startIdx + titlesPerBatch, titles.length);
  const batchTitles = titles.slice(startIdx, endIdx);

  console.log(
    `Batch ${batch} (hour ${hour}): Checking ${batchTitles.length} of ${titles.length} total titles`
  );

  let checked = 0;
  let errors = 0;

  for (const title of batchTitles) {
    try {
      if (!title.justwatch_id) {
        console.log(`Skipping ${title.name} - no JustWatch ID`);
        continue;
      }

      // Get current availability from JustWatch
      const availableSlugs = await getTitleAvailability(
        parseInt(title.justwatch_id, 10),
        title.type,
        title.name
      );

      // Log availability for each service
      for (const service of services) {
        const isAvailable = availableSlugs.includes(service.slug);
        await logAvailability(env.DB, title.id, service.id, today, isAvailable);
      }

      checked++;

      // Increased delay to reduce rate limiting risk (500ms = max 7200 requests/hour)
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error checking ${title.name}:`, error);
      errors++;

      // If getting rate limited, back off more
      if (error instanceof Error && error.message.includes('429')) {
        console.warn('Rate limited detected, backing off for 5 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  console.log(
    `Batch ${batch} complete: ${checked} checked, ${errors} errors, ${batchTitles.length - checked - errors} skipped`
  );
}
