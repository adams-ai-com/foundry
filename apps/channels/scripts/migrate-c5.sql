CREATE TABLE IF NOT EXISTS video_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  channel_id uuid,
  topic_id uuid,
  livekit_room_name text NOT NULL UNIQUE,
  title text,
  created_by uuid NOT NULL,
  created_by_name text,
  started_at timestamptz,
  ended_at timestamptz,
  status text DEFAULT 'waiting',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES video_calls(id),
  user_id uuid NOT NULL,
  display_name text,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  duration_seconds integer,
  UNIQUE (call_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_video_calls_topic    ON video_calls(topic_id)   WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_calls_org      ON video_calls(org_id, status);
CREATE INDEX IF NOT EXISTS idx_video_participants_call ON video_participants(call_id);
