-- Foundry PDF — Bulk Send Schema
-- Run against the foundry_pdf database

CREATE TABLE IF NOT EXISTS bulk_sends (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    TEXT        NOT NULL,
  template_id   UUID        NOT NULL,
  template_name TEXT        NOT NULL,
  title_prefix  TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'ready',
  -- ready | sending | complete | error
  total_count   INT         NOT NULL DEFAULT 0,
  sent_count    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS bulk_send_id UUID REFERENCES bulk_sends(id);
CREATE INDEX IF NOT EXISTS envelopes_bulk_send_id_idx ON envelopes(bulk_send_id) WHERE bulk_send_id IS NOT NULL;
