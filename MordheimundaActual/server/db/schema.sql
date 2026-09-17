-- Mordheimunda persistent data schema.
-- Application releases must never delete or overwrite this data directly.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_idx ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci_idx ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_data (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL DEFAULT 4,
  payload JSONB NOT NULL DEFAULT '{"rosters":[],"active":null}'::jsonb,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS recovery_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('password','username')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS recovery_tokens_user_id_idx ON recovery_tokens(user_id);
CREATE INDEX IF NOT EXISTS recovery_tokens_expires_at_idx ON recovery_tokens(expires_at);

-- Safe upgrades for databases created by V85.
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_idx ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci_idx ON users (lower(email)) WHERE email IS NOT NULL;

-- Admin accounts. Bootstrap admin(s) are configured via the ADMIN_EMAILS env
-- var and (re)synced onto this column on every login/session check; further
-- admins are promoted in-app (by an existing admin, selecting an account's
-- email) and persist here.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Warbands an admin has "officialized" from a custom warband: made visible to
-- every account as a normal, selectable faction (same shape the client uses
-- for official book factions), with the custom-defined restrictions kept but
-- the starting budget normalized to the standard 1000 GC.
CREATE TABLE IF NOT EXISTS official_warbands (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS official_warbands_created_at_idx ON official_warbands(created_at);
