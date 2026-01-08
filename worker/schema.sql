-- StreamTrack Database Schema

CREATE TABLE IF NOT EXISTS titles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('movie', 'tv')) NOT NULL,
  external_id TEXT,
  justwatch_id TEXT,
  poster_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT
);

CREATE TABLE IF NOT EXISTS availability_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  check_date DATE NOT NULL,
  is_available BOOLEAN NOT NULL,
  FOREIGN KEY (title_id) REFERENCES titles(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_availability_title ON availability_logs(title_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON availability_logs(check_date);
CREATE INDEX IF NOT EXISTS idx_availability_service ON availability_logs(service_id);

-- Error logs table for detailed error storage (last 30 days)
CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  stack TEXT,
  type TEXT CHECK(type IN ('api', 'runtime', 'render', 'network')) NOT NULL,
  url TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  component TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(type);
CREATE INDEX IF NOT EXISTS idx_error_logs_message ON error_logs(message);

-- Seed common streaming services
INSERT OR IGNORE INTO services (name, slug) VALUES
  ('Netflix', 'nfx'),
  ('Amazon Prime Video', 'amp'),
  ('Hulu', 'hlu'),
  ('Disney+', 'dnp'),
  ('HBO Max', 'hbm'),
  ('Apple TV+', 'atp'),
  ('Peacock', 'pck'),
  ('Paramount+', 'pmp');
