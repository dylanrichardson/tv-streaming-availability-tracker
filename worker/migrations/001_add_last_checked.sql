-- Add last_checked column for queue system
ALTER TABLE titles ADD COLUMN last_checked DATETIME;

-- Create index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_titles_last_checked ON titles(last_checked);
