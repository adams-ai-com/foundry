-- Foundry Channels — C2 migration

ALTER TABLE channels ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]';

CREATE TABLE IF NOT EXISTS channel_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  user_id    UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  topic_id   UUID REFERENCES channel_topics(id) ON DELETE CASCADE,
  message_id UUID REFERENCES channel_messages(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON channel_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notif_org  ON channel_notifications(org_id);
