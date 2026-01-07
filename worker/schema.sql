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
