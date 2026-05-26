-- S8: Per-org branding
-- Run against the foundry_pdf database

-- Add metadata column to envelopes (branding snapshot + future extensibility)
ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- Per-creator signing branding
CREATE TABLE IF NOT EXISTS signing_branding (
  creator_id   TEXT        PRIMARY KEY,
  display_name TEXT        NOT NULL DEFAULT '',
  logo_url     TEXT        NOT NULL DEFAULT '',
  brand_color  TEXT        NOT NULL DEFAULT '#2563eb',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
