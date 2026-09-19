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

-- 'published' warbands are merged into every account's faction list by
-- GET /api/warbands/official. 'draft' covers both a warband an admin has
-- pulled back for corrections (unpublish) and one not yet ready to release —
-- it stays fully visible/editable in the admin panel but disappears from
-- every other account until it's republished. Deleting a warband for good
-- requires it to be a draft first (see DELETE /api/admin/warbands/:id) so a
-- live warband can never vanish out from under active rosters in one click.
-- No CHECK constraint here (this file re-runs on every deploy, and
-- `ADD CONSTRAINT` has no `IF NOT EXISTS` guard in Postgres); the two valid
-- values are enforced in server.js instead.
ALTER TABLE official_warbands ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Friends (V89). A friendship never grants access to another account's
-- warband/custom-content data — it is a contact list only, for future
-- features (challenges, shared campaigns, invites). Stored as two directed
-- rows per accepted friendship so either side's row can be deleted
-- independently (unfriend) without needing a self-join.
CREATE TABLE IF NOT EXISTS friendships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS friendships_friend_id_idx ON friendships(friend_id);

-- A pending/accepted/declined/cancelled request between two accounts.
-- On acceptance the server inserts both directions into `friendships` and
-- marks this row 'accepted' (kept for history) rather than deleting it.
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (requester_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS friend_requests_recipient_idx ON friend_requests(recipient_id) WHERE status = 'pending';

-- Admin support access (V89). Read-only: an admin may open another
-- account's warbands/custom content to help with support, but every
-- consultation is logged here, and the consulted user can see this log
-- about themselves (who looked, when) — access is never silent. This
-- table does NOT grant write access; admin edits to a user's own rosters
-- go through the normal account endpoints and are out of scope here.
CREATE TABLE IF NOT EXISTS admin_support_access_log (
  id UUID PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_support_access_log_target_idx ON admin_support_access_log(target_user_id);
CREATE INDEX IF NOT EXISTS admin_support_access_log_admin_idx ON admin_support_access_log(admin_id);

-- Admin-editable corrections to the built-in rulebook (V145). The rulebook
-- text itself ships baked into the client (RULES_BOOK in app.js) so the
-- Règles tab works even offline; this table lets an admin fix a page's text
-- from the app itself instead of editing app.js and redeploying. Keyed by
-- the rule section id + source page number (both from RULES_BOOK); a page
-- with no row here just falls back to the baked-in text. Readable by
-- everyone (it's reference content, not account data), writable by admins
-- only.
CREATE TABLE IF NOT EXISTS rule_overrides (
  section_id TEXT NOT NULL,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (section_id, page)
);
