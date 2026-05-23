-- Foundry Channels — C4 migration (Foundry Connect)

-- Guest flag on messages
ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false;

-- Pending invitations
CREATE TABLE IF NOT EXISTS channel_connect_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  channel_id   UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  topic_id     UUID NOT NULL REFERENCES channel_topics(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL,
  name         TEXT,
  invited_by   UUID NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Guest accounts (one per email per org)
CREATE TABLE IF NOT EXISTS channel_connect_guests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, email)
);

-- Which topics a guest can access
CREATE TABLE IF NOT EXISTS channel_connect_access (
  guest_id   UUID NOT NULL REFERENCES channel_connect_guests(id) ON DELETE CASCADE,
  topic_id   UUID NOT NULL REFERENCES channel_topics(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (guest_id, topic_id)
);

-- Guest browser sessions
CREATE TABLE IF NOT EXISTS channel_connect_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id   UUID NOT NULL REFERENCES channel_connect_guests(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connect_invites_token  ON channel_connect_invites(token);
CREATE INDEX IF NOT EXISTS idx_connect_sessions_token ON channel_connect_sessions(token);
CREATE INDEX IF NOT EXISTS idx_connect_access_guest   ON channel_connect_access(guest_id);
