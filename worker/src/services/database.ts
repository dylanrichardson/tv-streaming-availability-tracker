import type { Env, Title, Service, HistoryResponse, StatsResponse } from '../types';
import { formatPosterUrl } from '../utils/poster';

export async function getAllTitles(db: D1Database): Promise<Title[]> {
  const result = await db.prepare('SELECT * FROM titles ORDER BY name').all<Title>();
  const titles = result.results || [];

  // Fix poster URLs on read
  return titles.map(title => ({
    ...title,
    poster_url: formatPosterUrl(title.poster_url)
  }));
}

export async function getTitleById(db: D1Database, id: number): Promise<Title | null> {
  const result = await db.prepare('SELECT * FROM titles WHERE id = ?').bind(id).first<Title>();
  if (!result) return null;

  return {
    ...result,
    poster_url: formatPosterUrl(result.poster_url)
  };
}

export async function createTitle(
  db: D1Database,
  name: string,
  type: 'movie' | 'tv',
  justwatchId: string | null,
  fullPath: string | null,
  posterUrl: string | null
): Promise<Title> {
  const result = await db
    .prepare('INSERT INTO titles (name, type, justwatch_id, full_path, poster_url) VALUES (?, ?, ?, ?, ?) RETURNING *')
    .bind(name, type, justwatchId, fullPath, posterUrl)
    .first<Title>();
  return result!;
}

export async function findTitleByName(db: D1Database, name: string): Promise<Title | null> {
  const result = await db
    .prepare('SELECT * FROM titles WHERE LOWER(name) = LOWER(?)')
    .bind(name)
    .first<Title>();
  if (!result) return null;

  return {
    ...result,
    poster_url: formatPosterUrl(result.poster_url)
  };
}

export async function findTitleByJustWatchId(db: D1Database, justwatchId: string): Promise<Title | null> {
  const result = await db
    .prepare('SELECT * FROM titles WHERE justwatch_id = ?')
    .bind(justwatchId)
    .first<Title>();
  if (!result) return null;

  return {
    ...result,
    poster_url: formatPosterUrl(result.poster_url)
  };
}

export async function getAllServices(db: D1Database): Promise<Service[]> {
  const result = await db.prepare('SELECT * FROM services').all<Service>();
  return result.results || [];
}

export async function getServiceBySlug(db: D1Database, slug: string): Promise<Service | null> {
  const result = await db.prepare('SELECT * FROM services WHERE slug = ?').bind(slug).first<Service>();
  return result;
}

export async function updateLastChecked(db: D1Database, titleId: number, timestamp: string): Promise<void> {
  await db
    .prepare('UPDATE titles SET last_checked = ? WHERE id = ?')
    .bind(timestamp, titleId)
    .run();
}

export async function getStaleTitles(db: D1Database, limit: number, daysStale: number): Promise<Title[]> {
  // Get titles that haven't been checked in X days, or never checked
  const result = await db
    .prepare(`
      SELECT * FROM titles
      WHERE last_checked IS NULL
         OR last_checked < datetime('now', '-${daysStale} days')
      ORDER BY last_checked ASC NULLS FIRST
      LIMIT ?
    `)
    .bind(limit)
    .all<Title>();

  const titles = result.results || [];

  // Fix poster URLs on read
  return titles.map(title => ({
    ...title,
    poster_url: formatPosterUrl(title.poster_url)
  }));
}

export async function logAvailability(
  db: D1Database,
  titleId: number,
  serviceId: number,
  checkDate: string,
  isAvailable: boolean
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO availability_logs (title_id, service_id, check_date, is_available) VALUES (?, ?, ?, ?)'
    )
    .bind(titleId, serviceId, checkDate, isAvailable ? 1 : 0)
    .run();
}

export async function getTitleHistory(db: D1Database, titleId: number): Promise<HistoryResponse | null> {
  const title = await getTitleById(db, titleId);
  if (!title) {
    return null;
  }

  // Get all unique check dates for this title
  const dates = await db
    .prepare(`
      SELECT DISTINCT check_date
      FROM availability_logs
      WHERE title_id = ?
      ORDER BY check_date DESC
    `)
    .bind(titleId)
    .all<{ check_date: string }>();

  // Get all available services for each date
  const logs = await db
    .prepare(`
      SELECT al.check_date, s.name as service_name
      FROM availability_logs al
      JOIN services s ON al.service_id = s.id
      WHERE al.title_id = ? AND al.is_available = 1
      ORDER BY al.check_date DESC
    `)
    .bind(titleId)
    .all<{ check_date: string; service_name: string }>();

  // Group services by date
  const servicesMap = new Map<string, string[]>();
  for (const log of logs.results || []) {
    const existing = servicesMap.get(log.check_date) || [];
    existing.push(log.service_name);
    servicesMap.set(log.check_date, existing);
  }

  // Build history with all dates (including those with no availability)
  const history = (dates.results || []).map(({ check_date }) => ({
    date: check_date,
    services: servicesMap.get(check_date) || [],
  }));

  return { title, history };
}

export async function getServiceStats(db: D1Database): Promise<StatsResponse> {
  const titles = await getAllTitles(db);
  const totalTitles = titles.length;

  if (totalTitles === 0) {
    return { services: [], totalTitles: 0 };
  }

  // Get all services
  const services = await getAllServices(db);

  // Get coverage stats per service per date
  const stats = await db
    .prepare(`
      SELECT
        s.name as service_name,
        al.check_date,
        COUNT(DISTINCT al.title_id) as available_count
      FROM availability_logs al
      JOIN services s ON al.service_id = s.id
      WHERE al.is_available = 1
      GROUP BY s.name, al.check_date
      ORDER BY al.check_date DESC
    `)
    .all<{ service_name: string; check_date: string; available_count: number }>();

  // Build coverage data per service
  const serviceMap = new Map<string, { date: string; percentage: number }[]>();

  for (const service of services) {
    serviceMap.set(service.name, []);
  }

  for (const stat of stats.results || []) {
    const coverage = serviceMap.get(stat.service_name) || [];
    coverage.push({
      date: stat.check_date,
      percentage: Math.round((stat.available_count / totalTitles) * 100),
    });
    serviceMap.set(stat.service_name, coverage);
  }

  const servicesCoverage = Array.from(serviceMap.entries()).map(([name, coverage]) => ({
    name,
    coverage,
  }));

  return { services: servicesCoverage, totalTitles };
}

export async function getTitlesCount(db: D1Database): Promise<number> {
  const result = await db.prepare('SELECT COUNT(*) as count FROM titles').first<{ count: number }>();
  return result?.count || 0;
}

export async function getTitlesWithCurrentAvailability(db: D1Database, limit?: number, offset?: number): Promise<(Title & { currentServices: string[] })[]> {
  // Build query with optional pagination
  let query = 'SELECT * FROM titles ORDER BY name';
  const params: (string | number)[] = [];

  if (limit !== undefined && offset !== undefined) {
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const result = await db.prepare(query).bind(...params).all<Title>();
  const titles = (result.results || []).map(title => ({
    ...title,
    poster_url: formatPosterUrl(title.poster_url)
  }));

  // Get latest availability for each title
  const resultWithServices: (Title & { currentServices: string[] })[] = [];

  for (const title of titles) {
    const latestDate = await db
      .prepare(`
        SELECT MAX(check_date) as latest_date
        FROM availability_logs
        WHERE title_id = ?
      `)
      .bind(title.id)
      .first<{ latest_date: string | null }>();

    if (latestDate?.latest_date) {
      const services = await db
        .prepare(`
          SELECT DISTINCT s.name
          FROM availability_logs al
          JOIN services s ON al.service_id = s.id
          WHERE al.title_id = ? AND al.check_date = ? AND al.is_available = 1
        `)
        .bind(title.id, latestDate.latest_date)
        .all<{ name: string }>();

      resultWithServices.push({
        ...title,
        currentServices: (services.results || []).map((s) => s.name),
      });
    } else {
      resultWithServices.push({ ...title, currentServices: [] });
    }
  }

  return resultWithServices;
}

export async function getUnavailableTitles(db: D1Database, monthsThreshold: number): Promise<Title[]> {
  const thresholdDate = new Date();
  thresholdDate.setMonth(thresholdDate.getMonth() - monthsThreshold);
  const dateStr = thresholdDate.toISOString().split('T')[0];

  // Get titles that have no availability logs with is_available=true after the threshold date
  const result = await db
    .prepare(`
      SELECT t.*
      FROM titles t
      WHERE NOT EXISTS (
        SELECT 1 FROM availability_logs al
        WHERE al.title_id = t.id
        AND al.is_available = 1
        AND al.check_date >= ?
      )
    `)
    .bind(dateStr)
    .all<Title>();

  return result.results || [];
}
