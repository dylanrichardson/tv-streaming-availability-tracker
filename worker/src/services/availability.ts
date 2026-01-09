import { getAllServices, logAvailability } from './database';
import { extractServicesFromOffers } from './justwatch';
import type { JustWatchOffer } from '../types';

/**
 * Log initial availability for a newly created title across all services
 * This records whether the title is currently available on each streaming service
 *
 * @param db - D1 database instance
 * @param titleId - ID of the title to log availability for
 * @param offers - Array of JustWatch offers for the title
 */
export async function logInitialAvailability(
  db: D1Database,
  titleId: number,
  offers: JustWatchOffer[]
): Promise<void> {
  // Extract service slugs from JustWatch offers
  const serviceSlugs = extractServicesFromOffers(offers);
  const today = new Date().toISOString().split('T')[0]!; // ISO date always has 'T'

  // Get all services to log availability (both available and unavailable)
  const allServices = await getAllServices(db);

  for (const service of allServices) {
    const isAvailable = serviceSlugs.includes(service.slug);
    await logAvailability(db, titleId, service.id, today, isAvailable);
  }
}
