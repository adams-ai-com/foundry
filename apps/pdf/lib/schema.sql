-- Foundry PDF — Electronic Signature Schema
-- Run against the foundry_pdf database

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS envelopes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        TEXT        NOT NULL,          -- original job reference (may expire; PDF copied to envelope store)
  creator_id    TEXT        NOT NULL,
  creator_name  TEXT        NOT NULL,
  creator_email TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'sent',  -- sent | partial | complete | voided
  page_count    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS envelope_recipients (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id    UUID        NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  email          TEXT        NOT NULL,
  order_index    INT         NOT NULL DEFAULT 0,   -- lower = signs first; equal = parallel
  required       BOOLEAN     NOT NULL DEFAULT true,
  status         TEXT        NOT NULL DEFAULT 'pending', -- pending | active | signed | declined | voided
  token          TEXT        NOT NULL UNIQUE,
  token_used     BOOLEAN     NOT NULL DEFAULT false,
  sent_at        TIMESTAMPTZ,
  viewed_at      TIMESTAMPTZ,
  signed_at      TIMESTAMPTZ,
  cert_fingerprint TEXT,
  ip_address     INET,
  user_agent     TEXT
);

CREATE TABLE IF NOT EXISTS envelope_fields (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id  UUID    NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  recipient_id UUID    NOT NULL REFERENCES envelope_recipients(id) ON DELETE CASCADE,
  page         INT     NOT NULL,   -- 0-indexed
  x0           FLOAT   NOT NULL,   -- PDF point coordinates (top-left origin)
  y0           FLOAT   NOT NULL,
  x1           FLOAT   NOT NULL,
  y1           FLOAT   NOT NULL,
  field_type   TEXT    NOT NULL DEFAULT 'signature',  -- signature | initials | date | name
  required     BOOLEAN NOT NULL DEFAULT true,
  completed    BOOLEAN NOT NULL DEFAULT false
);

-- Append-only audit log
CREATE TABLE IF NOT EXISTS signing_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id  UUID        NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  recipient_id UUID        REFERENCES envelope_recipients(id),
  event        TEXT        NOT NULL,
  -- created | sent | viewed | signed | voided | completed
  actor        TEXT,
  ip_address   INET,
  user_agent   TEXT,
  detail       JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_envelope_recipients_envelope ON envelope_recipients(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_recipients_token    ON envelope_recipients(token);
CREATE INDEX IF NOT EXISTS idx_envelope_fields_envelope     ON envelope_fields(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_fields_recipient    ON envelope_fields(recipient_id);
CREATE INDEX IF NOT EXISTS idx_signing_events_envelope      ON signing_events(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_creator            ON envelopes(creator_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_status             ON envelopes(status);
