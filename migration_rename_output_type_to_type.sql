-- Migration: Rename output_type column to type in conversion_records table
-- Execute this SQL in your Supabase SQL Editor

-- Rename the column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversion_records'
    AND column_name = 'output_type'
  ) THEN
    ALTER TABLE conversion_records
    RENAME COLUMN output_type TO type;
    COMMENT ON COLUMN conversion_records.type IS 'Processing type: video_watermark_removed, video_logo_removed, video_subtitle_removed, image_watermark_removed';
  END IF;
END $$;

-- Verify the column was renamed
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'conversion_records'
  AND column_name = 'type';
