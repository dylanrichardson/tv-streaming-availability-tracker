import type { Env } from './types';
import { getAllTitles, getAllServices, getServiceBySlug, logAvailability } from './services/database';
import { getTitleAvailability } from './services/justwatch';

export async function handleScheduled(env: Env): Promise<void> {
  console.log('Starting scheduled availability check...');

  const titles = await getAllTitles(env.DB);
  const services = await getAllServices(env.DB);
  const today = new Date().toISOString().split('T')[0];

  console.log(`Checking availability for ${titles.length} titles`);

  let checked = 0;
  let errors = 0;

  for (const title of titles) {
    try {
      if (!title.justwatch_id) {
        console.log(`Skipping ${title.name} - no JustWatch ID`);
        continue;
      }

      // Get current availability from JustWatch
      const availableSlugs = await getTitleAvailability(
        parseInt(title.justwatch_id, 10),
        title.type
      );

      // Log availability for each service
      for (const service of services) {
        const isAvailable = availableSlugs.includes(service.slug);
        await logAvailability(env.DB, title.id, service.id, today, isAvailable);
      }

      checked++;

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error checking ${title.name}:`, error);
      errors++;
    }
  }

  console.log(`Availability check complete: ${checked} checked, ${errors} errors`);
}
