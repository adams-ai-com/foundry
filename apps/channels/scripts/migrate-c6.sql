ALTER TABLE video_calls
  ADD COLUMN IF NOT EXISTS recording_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_path text,
  ADD COLUMN IF NOT EXISTS egress_id text;
