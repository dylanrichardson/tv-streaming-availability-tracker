import type { Env } from './types';
import { getAllTitles, getStaleTitles, getAllServices, getServiceBySlug, logAvailability, updateLastChecked } from './services/database';
import { getTitleAvailability } from './services/justwatch';

// Configuration
const CONFIG = {
  CRON_INTERVAL_HOURS: 4,
  TARGET_CHECK_FREQUENCY_DAYS: 7,
  API_DELAY_MS: 500,
  RATE_LIMIT_BACKOFF_MS: 5000,
};

export async function handleScheduled(env: Env): Promise<void> {
  console.log('Starting scheduled availability check with queue system...');

  const allTitles = await getAllTitles(env.DB);
  const services = await getAllServices(env.DB);
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Calculate dynamic batch size
  const totalTitles = allTitles.length;
  const runsPerPeriod = (CONFIG.TARGET_CHECK_FREQUENCY_DAYS * 24) / CONFIG.CRON_INTERVAL_HOURS;
  const titlesPerRun = Math.max(1, Math.ceil(totalTitles / runsPerPeriod));

  // Get stale titles (not checked in 7 days or never checked)
  const staleTitles = await getStaleTitles(
    env.DB,
    titlesPerRun,
    CONFIG.TARGET_CHECK_FREQUENCY_DAYS
  );

  console.log(
    `Queue system: Checking ${staleTitles.length} of ${totalTitles} total titles (batch size: ${titlesPerRun})`
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
        title.name
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
}
