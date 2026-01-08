-- Add full_path column to store JustWatch fullPath for accurate availability checks
ALTER TABLE titles ADD COLUMN full_path TEXT;
