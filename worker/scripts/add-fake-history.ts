#!/usr/bin/env tsx
/**
 * Add fake historical availability data for local development
 *
 * This script generates realistic historical data spanning multiple days
 * to visualize how the timeline UI looks with longer term data.
 *
 * Usage:
 *   cd worker
 *   npx tsx scripts/add-fake-history.ts
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

// Find the actual database file
const fs = require('fs');
const dbDir = DB_PATH;

let dbFile: string | null = null;
if (fs.existsSync(dbDir)) {
  const files = fs.readdirSync(dbDir);
  const sqliteFile = files.find((f: string) => f.endsWith('.sqlite'));
  if (sqliteFile) {
    dbFile = path.join(dbDir, sqliteFile);
  }
}

if (!dbFile || !fs.existsSync(dbFile)) {
  console.error('❌ Local database not found. Please run "npx wrangler dev" first to create the local database.');
  process.exit(1);
}

console.log(`📂 Using database: ${dbFile}`);

const db = new Database(dbFile);

// Get all titles and services
const titles = db.prepare('SELECT * FROM titles').all() as Array<{ id: number; name: string }>;
const services = db.prepare('SELECT * FROM services').all() as Array<{ id: number; name: string; slug: string }>;

if (titles.length === 0) {
  console.error('❌ No titles found. Please import some titles first.');
  process.exit(1);
}

console.log(`\n📊 Found ${titles.length} titles and ${services.length} services`);
console.log('🎲 Generating fake historical data...\n');

// Generate dates for the past 60 days
const today = new Date();
const dates: string[] = [];
for (let i = 60; i >= 0; i--) {
  const date = new Date(today);
  date.setDate(date.getDate() - i);
  dates.push(date.toISOString().split('T')[0]);
}

// Service availability patterns
const patterns = {
  // Always unavailable
  neverAvailable: () => false,

  // Always available
  alwaysAvailable: () => true,

  // Available for first half, then removed
  removedMidway: (dayIndex: number) => dayIndex < dates.length / 2,

  // Not available at first, added midway
  addedMidway: (dayIndex: number) => dayIndex >= dates.length / 2,

  // On and off (like rotating between services)
  intermittent: (dayIndex: number) => Math.floor(dayIndex / 10) % 2 === 0,

  // Recently added (last 2 weeks)
  recentlyAdded: (dayIndex: number) => dayIndex >= dates.length - 14,
};

// Assign patterns to titles
const titlePatterns = new Map<number, Map<number, (dayIndex: number) => boolean>>();

titles.forEach((title, titleIndex) => {
  const servicePatternMap = new Map<number, (dayIndex: number) => boolean>();

  // Most titles not available
  const availableServiceCount = Math.random() < 0.3 ? 1 : Math.random() < 0.6 ? 2 : 0;

  if (availableServiceCount > 0) {
    // Pick random services to be available
    const shuffledServices = [...services].sort(() => Math.random() - 0.5);
    const selectedServices = shuffledServices.slice(0, availableServiceCount);

    selectedServices.forEach((service, idx) => {
      // Pick a pattern
      const patternKeys = Object.keys(patterns);
      let patternName: keyof typeof patterns;

      if (idx === 0) {
        // First service - more likely to be consistently available
        const choices: (keyof typeof patterns)[] = ['alwaysAvailable', 'removedMidway', 'addedMidway'];
        patternName = choices[Math.floor(Math.random() * choices.length)];
      } else {
        // Second service - might be intermittent
        const choices: (keyof typeof patterns)[] = ['alwaysAvailable', 'intermittent', 'recentlyAdded'];
        patternName = choices[Math.floor(Math.random() * choices.length)];
      }

      servicePatternMap.set(service.id, patterns[patternName]);
    });
  }

  // All other services are never available
  services.forEach(service => {
    if (!servicePatternMap.has(service.id)) {
      servicePatternMap.set(service.id, patterns.neverAvailable);
    }
  });

  titlePatterns.set(title.id, servicePatternMap);
});

// Clear existing availability logs
console.log('🗑️  Clearing existing availability logs...');
db.prepare('DELETE FROM availability_logs').run();

// Insert historical data
console.log('📝 Inserting historical data...');
const insertStmt = db.prepare(`
  INSERT INTO availability_logs (title_id, service_id, check_date, is_available)
  VALUES (?, ?, ?, ?)
`);

let insertCount = 0;
dates.forEach((date, dayIndex) => {
  titles.forEach(title => {
    const servicePatternMap = titlePatterns.get(title.id)!;

    services.forEach(service => {
      const isAvailable = servicePatternMap.get(service.id)!(dayIndex);
      insertStmt.run(title.id, service.id, date, isAvailable ? 1 : 0);
      insertCount++;
    });
  });
});

// Update last_checked for all titles
const lastCheckDate = new Date().toISOString();
db.prepare('UPDATE titles SET last_checked = ?').run(lastCheckDate);

console.log(`\n✅ Generated ${insertCount} availability log entries across ${dates.length} days`);
console.log(`📅 Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
console.log(`\n💡 Run "npx wrangler dev" and open the app to see the historical data!`);

db.close();
