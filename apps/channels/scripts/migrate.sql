-- Foundry Channels — database migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'stream',   -- 'stream' | 'dm'
  is_private  BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS channel_topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL,
  name            TEXT NOT NULL,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  message_count   INTEGER DEFAULT 0,
  is_resolved     BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS channel_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  topic_id     UUID NOT NULL REFERENCES channel_topics(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL,
  author_id    UUID NOT NULL,
  author_name  TEXT NOT NULL,
  author_email TEXT NOT NULL,
  body         TEXT NOT NULL,
  edited_at    TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  reactions    JSONB DEFAULT '[]',
  attachments  JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_read_state (
  user_id      UUID NOT NULL,
  topic_id     UUID NOT NULL REFERENCES channel_topics(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  role       TEXT DEFAULT 'member',
  joined_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channels_org      ON channels(org_id);
CREATE INDEX IF NOT EXISTS idx_topics_channel    ON channel_topics(channel_id);
CREATE INDEX IF NOT EXISTS idx_topics_org        ON channel_topics(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_topic    ON channel_messages(topic_id);
CREATE INDEX IF NOT EXISTS idx_messages_created  ON channel_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_read_state_user   ON channel_read_state(user_id);
