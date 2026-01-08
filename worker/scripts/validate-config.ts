#!/usr/bin/env node
/**
 * Validates that the cron schedule in wrangler.toml matches
 * the CRON_INTERVAL_MINUTES in scheduled.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function parseCronInterval(cronExpression: string): number | null {
  // Parse cron expression to extract interval in minutes
  // Format: "minute hour day month dayofweek"
  // Examples:
  //   "*/15 * * * *" = every 15 minutes
  //   "0 * * * *" = every 60 minutes (every hour)
  //   "0 */4 * * *" = every 240 minutes (every 4 hours)
  //   "* * * * *" = every 1 minute

  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [minute, hour] = parts;

  // Check for minute-based intervals: "*/N * * * *"
  const minuteMatch = minute.match(/^\*\/(\d+)$/);
  if (minuteMatch) {
    return parseInt(minuteMatch[1], 10);
  }

  // Check for every minute: "* * * * *"
  if (minute === '*' && hour === '*') {
    return 1;
  }

  // Check for hourly intervals: "0 */N * * *" or "0 * * * *"
  if (minute === '0') {
    const hourMatch = hour.match(/^\*\/(\d+)$/);
    if (hourMatch) {
      return parseInt(hourMatch[1], 10) * 60;
    }
    if (hour === '*') {
      return 60;
    }
  }

  return null;
}

function validateConfig(): void {
  const rootDir = path.resolve(__dirname, '..');
  const wranglerPath = path.join(rootDir, 'wrangler.toml');
  const scheduledPath = path.join(rootDir, 'src', 'scheduled.ts');

  // Read wrangler.toml
  if (!fs.existsSync(wranglerPath)) {
    console.error(`${RED}✗ Error: wrangler.toml not found at ${wranglerPath}${RESET}`);
    process.exit(1);
  }

  const wranglerContent = fs.readFileSync(wranglerPath, 'utf-8');
  const cronMatch = wranglerContent.match(/crons\s*=\s*\["([^"]+)"\]/);

  if (!cronMatch) {
    console.error(`${RED}✗ Error: Could not find cron schedule in wrangler.toml${RESET}`);
    process.exit(1);
  }

  const cronExpression = cronMatch[1];
  const cronIntervalMinutes = parseCronInterval(cronExpression);

  if (cronIntervalMinutes === null) {
    console.error(`${RED}✗ Error: Could not parse cron expression: "${cronExpression}"${RESET}`);
    console.error(`${YELLOW}  Supported formats:${RESET}`);
    console.error(`    - "*/N * * * *" (every N minutes)`);
    console.error(`    - "* * * * *" (every minute)`);
    console.error(`    - "0 * * * *" (every hour)`);
    console.error(`    - "0 */N * * *" (every N hours)`);
    process.exit(1);
  }

  // Read scheduled.ts
  if (!fs.existsSync(scheduledPath)) {
    console.error(`${RED}✗ Error: scheduled.ts not found at ${scheduledPath}${RESET}`);
    process.exit(1);
  }

  const scheduledContent = fs.readFileSync(scheduledPath, 'utf-8');
  const configMatch = scheduledContent.match(/CRON_INTERVAL_MINUTES:\s*(\d+)/);

  if (!configMatch) {
    console.error(`${RED}✗ Error: Could not find CRON_INTERVAL_MINUTES in scheduled.ts${RESET}`);
    process.exit(1);
  }

  const configIntervalMinutes = parseInt(configMatch[1], 10);

  // Compare
  if (cronIntervalMinutes !== configIntervalMinutes) {
    console.error(`${RED}✗ Configuration mismatch!${RESET}`);
    console.error(`  wrangler.toml cron: "${cronExpression}" = ${cronIntervalMinutes} minutes`);
    console.error(`  scheduled.ts CONFIG.CRON_INTERVAL_MINUTES: ${configIntervalMinutes} minutes`);
    console.error('');
    console.error(`${YELLOW}Fix: Update one of the following to match:${RESET}`);
    console.error(`  1. wrangler.toml: crons = ["*/${configIntervalMinutes} * * * *"]`);
    console.error(`  2. scheduled.ts: CRON_INTERVAL_MINUTES: ${cronIntervalMinutes}`);
    process.exit(1);
  }

  // Success
  console.log(`${GREEN}✓ Configuration validated successfully${RESET}`);
  console.log(`  Cron interval: ${cronIntervalMinutes} minutes`);
  console.log(`  Cron expression: "${cronExpression}"`);
}

// Run validation
validateConfig();
