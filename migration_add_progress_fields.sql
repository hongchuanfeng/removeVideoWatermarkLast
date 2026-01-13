-- Migration: Add progress, task_id, and video_duration fields to conversion_records table
-- Execute this SQL in your Supabase SQL Editor

-- Add progress column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversion_records' 
    AND column_name = 'progress'
  ) THEN
    ALTER TABLE conversion_records 
    ADD COLUMN progress INTEGER DEFAULT 0;
    COMMENT ON COLUMN conversion_records.progress IS 'Processing progress (0-100 percentage)';
  END IF;
END $$;

-- Add task_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversion_records' 
    AND column_name = 'task_id'
  ) THEN
    ALTER TABLE conversion_records 
    ADD COLUMN task_id TEXT;
    COMMENT ON COLUMN conversion_records.task_id IS 'Tencent Cloud task ID';
  END IF;
END $$;

-- Add video_duration column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversion_records' 
    AND column_name = 'video_duration'
  ) THEN
    ALTER TABLE conversion_records 
    ADD COLUMN video_duration INTEGER;
    COMMENT ON COLUMN conversion_records.video_duration IS 'Video duration in seconds';
  END IF;
END $$;

-- Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversion_records' 
  AND column_name IN ('progress', 'task_id', 'video_duration')
ORDER BY column_name;

