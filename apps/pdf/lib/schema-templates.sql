-- Envelope templates — S7
-- Run against the foundry_pdf database

CREATE TABLE IF NOT EXISTS envelope_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   TEXT        NOT NULL,
  creator_name TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  page_count   INT         NOT NULL DEFAULT 0,
  recipients   JSONB       NOT NULL DEFAULT '[]',
  -- [{name, email, order_index, required, color}]
  fields       JSONB       NOT NULL DEFAULT '[]',
  -- [{recipient_index, page, x0, y0, x1, y1, field_type, required}]
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_envelope_templates_creator ON envelope_templates(creator_id);
