-- Foundry Mail — PostgreSQL Schema
-- Run via: npm run db:migrate

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Accounts ──────────────────────────────────────────────────────────────
-- One row per mail domain this server handles
CREATE TABLE IF NOT EXISTS accounts (
  id              TEXT PRIMARY KEY,
  domain          TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  dkim_selector   TEXT NOT NULL DEFAULT 'foundry',
  dkim_private_key TEXT,
  smtp_relay_host TEXT,
  smtp_relay_port INTEGER DEFAULT 587,
  smtp_relay_user TEXT,
  smtp_relay_pass TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Mailboxes ─────────────────────────────────────────────────────────────
-- Standard system mailboxes + user-created folders
CREATE TABLE IF NOT EXISTS mailboxes (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('inbox','sent','drafts','archive','trash','spam','custom')),
  parent_id   TEXT REFERENCES mailboxes(id),
  path        TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  unread_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(account_id, path)
);

-- ─── Threads ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS threads (
  id                  TEXT PRIMARY KEY,
  account_id          TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id        TEXT,                          -- architectural seed: workspace context
  subject             TEXT NOT NULL DEFAULT '',
  normalized_subject  TEXT NOT NULL DEFAULT '',      -- Re:/Fwd: stripped, used for matching
  participants        JSONB NOT NULL DEFAULT '[]',   -- [{name, email}] all participants
  message_count       INTEGER NOT NULL DEFAULT 0,
  unread_count        INTEGER NOT NULL DEFAULT 0,
  last_message_at     TIMESTAMPTZ,
  snippet             TEXT NOT NULL DEFAULT '',      -- preview from most recent message
  is_starred          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS threads_account_last ON threads(account_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS threads_workspace ON threads(workspace_id) WHERE workspace_id IS NOT NULL;

-- ─── Messages ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mailbox_id      TEXT NOT NULL REFERENCES mailboxes(id),
  thread_id       TEXT REFERENCES threads(id),
  -- architectural seed: protocol-agnostic messages (smtp now, internal later)
  protocol        TEXT NOT NULL DEFAULT 'smtp' CHECK (protocol IN ('smtp', 'internal')),
  message_id      TEXT UNIQUE,                       -- RFC 2822 Message-ID header
  in_reply_to     TEXT,
  references      TEXT,                              -- space-separated Message-IDs
  subject         TEXT NOT NULL DEFAULT '',
  from_name       TEXT,
  from_email      TEXT NOT NULL,
  to_addrs        JSONB NOT NULL DEFAULT '[]',       -- [{name, email}]
  cc_addrs        JSONB NOT NULL DEFAULT '[]',
  bcc_addrs       JSONB NOT NULL DEFAULT '[]',       -- only for outbound drafts/sent
  date            TIMESTAMPTZ NOT NULL,
  body_html       TEXT,
  body_text       TEXT,
  raw_size        INTEGER NOT NULL DEFAULT 0,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  is_starred      BOOLEAN NOT NULL DEFAULT FALSE,
  is_draft        BOOLEAN NOT NULL DEFAULT FALSE,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector   TSVECTOR
);

CREATE INDEX IF NOT EXISTS messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS messages_mailbox ON messages(mailbox_id, received_at DESC);
CREATE INDEX IF NOT EXISTS messages_account_received ON messages(account_id, received_at DESC);
CREATE INDEX IF NOT EXISTS messages_message_id ON messages(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_fts ON messages USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS messages_from_trgm ON messages USING GIN(from_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS messages_subject_trgm ON messages USING GIN(subject gin_trgm_ops);

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION messages_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.from_email, '') || ' ' || coalesce(NEW.from_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_search_trigger ON messages;
CREATE TRIGGER messages_search_trigger
  BEFORE INSERT OR UPDATE OF subject, from_email, from_name, body_text
  ON messages FOR EACH ROW EXECUTE FUNCTION messages_search_update();

-- ─── Files ─────────────────────────────────────────────────────────────────
-- architectural seed: attachments as first-class files (mail attachments auto-populate this)
CREATE TABLE IF NOT EXISTS files (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id TEXT,                                -- seed: workspace context
  message_id   TEXT REFERENCES messages(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size         INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  search_text  TEXT,                                -- extracted text for searchable docs
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS files_account ON files(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS files_message ON files(message_id);

-- ─── Calendar Events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id                TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id      TEXT,
  title             TEXT NOT NULL,
  description       TEXT,
  location          TEXT,
  start_at          TIMESTAMPTZ NOT NULL,
  end_at            TIMESTAMPTZ NOT NULL,
  all_day           BOOLEAN NOT NULL DEFAULT FALSE,
  rrule             TEXT,                           -- RFC 5545 recurrence rule
  attendees         JSONB NOT NULL DEFAULT '[]',   -- [{name, email, status}]
  organizer_email   TEXT,
  source_message_id TEXT REFERENCES messages(id),  -- if created from email invite
  ical_uid          TEXT,                           -- iCal UID for dedup
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calendar_account_time ON calendar_events(account_id, start_at);

-- ─── Contacts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name              TEXT,
  email             TEXT NOT NULL,
  phone             TEXT,
  org               TEXT,
  notes             TEXT,
  last_contacted_at TIMESTAMPTZ,
  search_vector     TSVECTOR,
  UNIQUE(account_id, email)
);

CREATE INDEX IF NOT EXISTS contacts_fts ON contacts USING GIN(search_vector);

CREATE OR REPLACE FUNCTION contacts_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.email, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.org, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_search_trigger ON contacts;
CREATE TRIGGER contacts_search_trigger
  BEFORE INSERT OR UPDATE OF name, email, org
  ON contacts FOR EACH ROW EXECUTE FUNCTION contacts_search_update();

-- ─── Decisions ──────────────────────────────────────────────────────────────
-- architectural seed: decisions as first-class entities (no UI yet — schema ready)
CREATE TABLE IF NOT EXISTS decisions (
  id                TEXT PRIMARY KEY,
  account_id        TEXT REFERENCES accounts(id),
  workspace_id      TEXT,
  subject           TEXT NOT NULL,
  outcome           TEXT NOT NULL,
  decided_by        TEXT,
  decided_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_thread_id  TEXT REFERENCES threads(id),
  source_meeting_id TEXT,                           -- future: calendar event link
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
