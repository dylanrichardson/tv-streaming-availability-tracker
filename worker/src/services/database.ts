import type { Env, Title, Service, HistoryResponse, StatsResponse } from '../types';

export async function getAllTitles(db: D1Database): Promise<Title[]> {
  const result = await db.prepare('SELECT * FROM titles ORDER BY name').all<Title>();
  return result.results || [];
}

export async function getTitleById(db: D1Database, id: number): Promise<Title | null> {
  const result = await db.prepare('SELECT * FROM titles WHERE id = ?').bind(id).first<Title>();
  return result;
}

export async function createTitle(
  db: D1Database,
  name: string,
  type: 'movie' | 'tv',
  justwatchId: string | null,
  posterUrl: string | null
): Promise<Title> {
  const result = await db
    .prepare('INSERT INTO titles (name, type, justwatch_id, poster_url) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(name, type, justwatchId, posterUrl)
    .first<Title>();
  return result!;
}

export async function findTitleByName(db: D1Database, name: string): Promise<Title | null> {
  const result = await db
    .prepare('SELECT * FROM titles WHERE LOWER(name) = LOWER(?)')
    .bind(name)
    .first<Title>();
  return result;
}

export async function getAllServices(db: D1Database): Promise<Service[]> {
  const result = await db.prepare('SELECT * FROM services').all<Service>();
  return result.results || [];
}

export async function getServiceBySlug(db: D1Database, slug: string): Promise<Service | null> {
  const result = await db.prepare('SELECT * FROM services WHERE slug = ?').bind(slug).first<Service>();
  return result;
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

  // Group by date
  const historyMap = new Map<string, string[]>();
  for (const log of logs.results || []) {
    const existing = historyMap.get(log.check_date) || [];
    existing.push(log.service_name);
    historyMap.set(log.check_date, existing);
  }

  const history = Array.from(historyMap.entries()).map(([date, services]) => ({
    date,
    services,
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

export async function getTitlesWithCurrentAvailability(db: D1Database): Promise<(Title & { currentServices: string[] })[]> {
  const titles = await getAllTitles(db);

  // Get latest availability for each title
  const result: (Title & { currentServices: string[] })[] = [];

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
          SELECT s.name
          FROM availability_logs al
          JOIN services s ON al.service_id = s.id
          WHERE al.title_id = ? AND al.check_date = ? AND al.is_available = 1
        `)
        .bind(title.id, latestDate.latest_date)
        .all<{ name: string }>();

      result.push({
        ...title,
        currentServices: (services.results || []).map((s) => s.name),
      });
    } else {
      result.push({ ...title, currentServices: [] });
    }
  }

  return result;
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
