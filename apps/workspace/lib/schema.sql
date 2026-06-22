CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT REFERENCES orgs(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS magic_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  redirect_slug TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS magic_tokens_token ON magic_tokens(token);

CREATE TABLE IF NOT EXISTS org_groups (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name)
);
CREATE INDEX IF NOT EXISTS org_groups_org ON org_groups(org_id);

CREATE TABLE IF NOT EXISTS org_group_members (
  group_id TEXT NOT NULL REFERENCES org_groups(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Session IP/UA (added for session device tracking)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- TOTP rate limiting (added for brute-force protection)
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_failed_count INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_locked_until TIMESTAMPTZ;

-- Email + password auth (self-hosted default; replaces email+TOTP)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Group app access (added for group-level app permissions)
CREATE TABLE IF NOT EXISTS group_app_access (
  group_id TEXT NOT NULL REFERENCES org_groups(id) ON DELETE CASCADE,
  app TEXT NOT NULL CHECK (app IN ('docs','sheets','mail','wiki')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (group_id, app)
);
