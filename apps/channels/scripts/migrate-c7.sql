-- C7: Post-call pipeline tables

ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS video_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES video_calls(id) UNIQUE,
  transcript_text text,
  processed_at timestamptz,
  whisper_model text DEFAULT 'whisper-1',
  language text DEFAULT 'en'
);

CREATE TABLE IF NOT EXISTS video_transcript_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id uuid NOT NULL REFERENCES video_transcripts(id) ON DELETE CASCADE,
  speaker_label text,
  speaker_user_id uuid,
  start_seconds numeric NOT NULL,
  end_seconds numeric NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_transcript_segments_transcript_idx
  ON video_transcript_segments(transcript_id);

CREATE TABLE IF NOT EXISTS video_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES video_calls(id) UNIQUE,
  summary text NOT NULL,
  action_items jsonb DEFAULT '[]',
  decisions jsonb DEFAULT '[]',
  generated_at timestamptz DEFAULT now(),
  posted_to_channel boolean DEFAULT false,
  posted_message_id uuid
);
