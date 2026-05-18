CREATE TABLE IF NOT EXISTS pages (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parent_id  TEXT REFERENCES pages(id) ON DELETE SET NULL,
  title      TEXT NOT NULL DEFAULT 'Untitled',
  content    JSONB NOT NULL DEFAULT '{}',
  is_home    BOOLEAN NOT NULL DEFAULT FALSE,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pages_parent ON pages(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS pages_home ON pages(is_home) WHERE is_home = TRUE;

-- Home page seed (no-op if already exists)
INSERT INTO pages (title, content, is_home, position)
VALUES ('Home', '{}', TRUE, 0)
ON CONFLICT DO NOTHING;
