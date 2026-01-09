import type { Env } from './types';
import { getAllTitles, getStaleTitles, getAllServices, logAvailability, updateLastChecked } from './services/database';
import { getTitleAvailability } from './services/justwatch';

// Configuration
// IMPORTANT: If you change CRON_INTERVAL_MINUTES, also update the cron schedule in wrangler.toml
const CONFIG = {
  CRON_INTERVAL_MINUTES: 15, // Must match wrangler.toml cron schedule
  TARGET_CHECK_FREQUENCY_DAYS: 7,
  API_DELAY_MS: 500,
  RATE_LIMIT_BACKOFF_MS: 5000,
};

export async function handleScheduled(env: Env): Promise<void> {
  console.log('Starting scheduled availability check with queue system...');

  const allTitles = await getAllTitles(env.DB);
  const services = await getAllServices(env.DB);
  const today = new Date().toISOString().split('T')[0]!; // ISO date always has 'T'
  const now = new Date().toISOString();

  // Calculate dynamic batch size for steady-state checks
  const totalTitles = allTitles.length;
  const runsPerPeriod = (CONFIG.TARGET_CHECK_FREQUENCY_DAYS * 24 * 60) / CONFIG.CRON_INTERVAL_MINUTES;
  const steadyStateBatchSize = Math.max(1, Math.ceil(totalTitles / runsPerPeriod));

  // Prioritize never-checked titles (from bulk imports)
  // Check up to 20 never-checked titles per run, or all if fewer
  const neverCheckedTitles = allTitles.filter(t => !t.last_checked);
  const neverCheckedBatchSize = Math.min(20, neverCheckedTitles.length);

  // Add stale titles to fill the rest of the batch
  const regularBatchSize = Math.max(0, steadyStateBatchSize - neverCheckedBatchSize);
  const totalBatchSize = neverCheckedBatchSize + regularBatchSize;

  // Get titles to check
  const staleTitles = await getStaleTitles(
    env.DB,
    totalBatchSize,
    CONFIG.TARGET_CHECK_FREQUENCY_DAYS
  );

  console.log(
    `Queue system: Checking ${staleTitles.length} titles (${neverCheckedBatchSize} never-checked + ${regularBatchSize} stale) of ${totalTitles} total`
  );

  let checked = 0;
  let errors = 0;
  let skipped = 0;

  for (const title of staleTitles) {
    try {
      if (!title.justwatch_id) {
        console.log(`Skipping ${title.name} - no JustWatch ID`);
        skipped++;
        continue;
      }

      // Get current availability from JustWatch
      const availableSlugs = await getTitleAvailability(
        parseInt(title.justwatch_id, 10),
        title.type,
        title.name,
        title.full_path
      );

      // Log availability for each service
      for (const service of services) {
        const isAvailable = availableSlugs.includes(service.slug);
        await logAvailability(env.DB, title.id, service.id, today, isAvailable);
      }

      // Update last_checked timestamp
      await updateLastChecked(env.DB, title.id, now);

      checked++;
      console.log(`✓ Checked ${title.name} (last checked: ${title.last_checked || 'never'})`);

      // Delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, CONFIG.API_DELAY_MS));
    } catch (error) {
      console.error(`Error checking ${title.name}:`, error);
      errors++;

      // If getting rate limited, back off more
      if (error instanceof Error && error.message.includes('429')) {
        console.warn(`Rate limit detected, backing off for ${CONFIG.RATE_LIMIT_BACKOFF_MS}ms...`);
        await new Promise((resolve) => setTimeout(resolve, CONFIG.RATE_LIMIT_BACKOFF_MS));
      }
    }
  }

  console.log(
    `Queue check complete: ${checked} checked, ${errors} errors, ${skipped} skipped`
  );
  console.log(
    `Next run will check titles not updated since: ${new Date(Date.now() - CONFIG.TARGET_CHECK_FREQUENCY_DAYS * 24 * 60 * 60 * 1000).toISOString()}`
  );

  // Run error log cleanup once per day at 3 AM UTC
  const currentHour = new Date().getUTCHours();
  if (currentHour === 3) {
    try {
      const result = await env.DB.prepare(`
        DELETE FROM error_logs
        WHERE timestamp < datetime('now', '-30 days')
      `).run();

      const deleted = result.meta?.changes || 0;
      if (deleted > 0) {
        console.log(`Cleaned up ${deleted} old error logs (>30 days)`);
      }
    } catch (error) {
      console.error('Error during error log cleanup:', error);
    }
  }
}
