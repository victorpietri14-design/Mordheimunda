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
  kind TEXT NOT NULL CHECK (kind IN ('password','username','verify_email')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS recovery_tokens_user_id_idx ON recovery_tokens(user_id);
CREATE INDEX IF NOT EXISTS recovery_tokens_expires_at_idx ON recovery_tokens(expires_at);

-- V153: extend the recovery_tokens.kind CHECK to accept 'verify_email' on
-- databases created before the new kind was added. `CREATE TABLE IF NOT
-- EXISTS` above never re-runs on an existing table, so the old two-value
-- constraint keeps rejecting the new kind unless we drop-and-recreate it
-- here. Constraint name matches the one Postgres auto-assigns from the
-- column-level CHECK (recovery_tokens_kind_check).
ALTER TABLE recovery_tokens DROP CONSTRAINT IF EXISTS recovery_tokens_kind_check;
ALTER TABLE recovery_tokens ADD CONSTRAINT recovery_tokens_kind_check CHECK (kind IN ('password','username','verify_email'));

-- Safe upgrades for databases created by V85.
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_idx ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci_idx ON users (lower(email)) WHERE email IS NOT NULL;

-- Admin accounts. Bootstrap admin(s) are configured via the ADMIN_EMAILS env
-- var and (re)synced onto this column on every login/session check; further
-- admins are promoted in-app (by an existing admin, selecting an account's
-- email) and persist here.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Password-reset session invalidation (V152). Bumped every time a user's
-- password is reset via the /api/auth/reset-password flow. The auth
-- middleware compares this to the version snapshotted on the session at
-- issue time; any pre-reset session whose token_version no longer matches
-- is treated as expired. Belt-and-braces alongside the existing
-- DELETE FROM sessions WHERE user_id=$1 in reset-password: even if a stray
-- session ever survives the delete (replicated reads, another pod holding
-- a cached row), it can never be used to act as the pre-reset user again.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- V154: per-device session manager (Account → Connected devices). Each
-- session snapshots the User-Agent and IP it was opened from, and tracks
-- last activity so the user can recognise and revoke a device.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- V153: grandfather every account that existed BEFORE the "verify your
-- email" feature shipped, so no pre-feature user is locked out of password
-- recovery. V156 fix: this must run exactly once — the previous
-- unconditional UPDATE re-ran on every cold boot and silently marked every
-- fresh signup / freshly-changed address as verified. A row in
-- schema_migrations records that the backfill happened; the data-modifying
-- CTE only updates when the INSERT actually inserted (first run).
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
WITH m AS (
  INSERT INTO schema_migrations(name) VALUES ('v153_grandfather_email_verified')
  ON CONFLICT (name) DO NOTHING RETURNING name
)
UPDATE users SET email_verified_at=COALESCE(email_verified_at,NOW())
WHERE email IS NOT NULL AND email_verified_at IS NULL AND EXISTS (SELECT 1 FROM m);

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

-- V146: distinguishes a read-only support lookup from a live write, now that
-- an admin can edit another account's warbands directly (PUT
-- /api/admin/support/:userId/data). Existing rows default to 'view' (they
-- predate writes entirely), so no backfill is needed.
ALTER TABLE admin_support_access_log ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'view';

-- Admin-editable corrections to the base M17 catalog (V147). The book
-- factions (Reikland, Marienburg, etc.) ship baked into the client in
-- data/catalog.js so browsing/building works offline — same reasoning as
-- RULES_BOOK/rule_overrides above. This table lets an admin correct a
-- faction's fighter profiles (stats/max/cost) and equipment from the site
-- itself instead of hand-editing catalog.js and redeploying. Keyed by the
-- faction id from catalog.js; a faction with no row here just falls back to
-- the baked-in data. `warriors`/`equipment` fully REPLACE that faction's
-- arrays when present (same whole-array-replace semantics as
-- official_warbands.definition), never a partial patch. Readable by
-- everyone (reference content, not account data), writable by admins only.
CREATE TABLE IF NOT EXISTS catalog_overrides (
  faction_id TEXT PRIMARY KEY,
  warriors JSONB NOT NULL,
  equipment JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- V151: extend catalog_overrides so a base book faction can carry the same
-- full set of warband-linked content an official/community warband already
-- stores (band rule names, traits, special rules, skill trees, skills, magic
-- domains, spells) instead of only warriors/equipment. This gives the admin
-- "manage warband" editor full parity between book factions and officialized
-- warbands, using one unified UI. Each defaults to an empty JSON array so
-- existing rows (warriors/equipment only) keep working unchanged.
ALTER TABLE catalog_overrides ADD COLUMN IF NOT EXISTS band_rule_names JSONB NOT NULL DEFAULT '[]';
ALTER TABLE catalog_overrides ADD COLUMN IF NOT EXISTS traits JSONB NOT NULL DEFAULT '[]';
ALTER TABLE catalog_overrides ADD COLUMN IF NOT EXISTS special_rules JSONB NOT NULL DEFAULT '[]';
ALTER TABLE catalog_overrides ADD COLUMN IF NOT EXISTS skill_trees JSONB NOT NULL DEFAULT '[]';
ALTER TABLE catalog_overrides ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]';
ALTER TABLE catalog_overrides ADD COLUMN IF NOT EXISTS magic_domains JSONB NOT NULL DEFAULT '[]';
ALTER TABLE catalog_overrides ADD COLUMN IF NOT EXISTS spells JSONB NOT NULL DEFAULT '[]';

-- Admin-editable corrections/additions to the shared weapon/gear pool
-- (V148). D.weapons in data/catalog.js is the shared pool every book
-- faction and every official warband draws its equipment from — a
-- faction's own `equipment` array only ever lists item NAMES into this
-- pool (see catalog_overrides.equipment above), never full item objects.
-- This lets an admin correct an existing weapon's stats/price (changing it
-- everywhere it's used) or add an entirely new one, from the site itself,
-- without editing data/catalog.js and redeploying. Keyed by the weapon's
-- exact name; `data` fully replaces that weapon's object when present, or
-- is appended as a brand-new item when the name doesn't already exist in
-- D.weapons. Readable by everyone, writable by admins only.
CREATE TABLE IF NOT EXISTS weapon_overrides (
  weapon_name TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supplement warbands (V150). An official warband can optionally be marked
-- as a "supplement" of another faction (book or official) instead of a
-- standalone top-level faction: it then never appears as its own tile in
-- Create Warband, and instead shows as a selectable alternative under the
-- base faction it supplements — the same relationship the hand-coded
-- Blood Dragons pack (data/packs/blood_dragons.js) has with 'undead', but
-- authored by an admin from the site instead of hand-written as code.
-- NULL (the default) means "independent warband", matching every warband
-- created before this column existed. Holds the base faction's id exactly
-- as it appears in D.factions (a book slug like 'undead', or another
-- official warband's `official-<uuid>` id).
ALTER TABLE official_warbands ADD COLUMN IF NOT EXISTS supplement_of TEXT;

-- V-WARBANDLOCK (Task #80): set the moment an admin edits this warband
-- directly via the Admin → Gestion editor (PUT .../warbands/:id with
-- viaAdminEditor:true). Once set, the ORIGINAL custom-warband owner's own
-- "Publier les modifications" republish (a full-replace rebuilt from their
-- local draft, which never reflects the admin's direct edit) is rejected
-- instead of silently overwriting it — see the PUT route.
ALTER TABLE official_warbands ADD COLUMN IF NOT EXISTS admin_edited_at TIMESTAMPTZ;

-- Admin-editable Rules-page nav categories (V151). The Règles tab groups the
-- RULES_BOOK sections into theme cards (Pre-Battle, Game Structure, Combat…)
-- for its topic-grid nav; that grouping used to be hardcoded in app.js
-- (RULES_NAV_GROUPS). This table lets an admin rename, reorder, add, delete
-- a group, or move a rule section between groups, from the site itself. A
-- single row holds the WHOLE ordered list as JSON (same whole-payload-replace
-- semantics as official_warbands.definition/catalog_overrides) — the app's
-- baked-in default groups are the fallback used until an admin ever saves
-- here. Readable by everyone, writable by admins only.
CREATE TABLE IF NOT EXISTS rule_nav_groups (
  id INTEGER PRIMARY KEY DEFAULT 1,
  groups JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id = 1)
);

-- Race-category tags for the "Create warband" picker (V149). Purely a
-- classification layer on top of existing factions (book factions AND
-- published official warbands, keyed by whatever id they already have in
-- D.factions — a book slug or an official_warbands UUID) so the create page
-- can group them under Humain/Dwarf/Elves/Orcs and Goblin/Chaos/Undead/
-- Unique tiles. Nothing here duplicates or owns a warband — removing a row
-- just leaves that faction unassigned (shown in no race tile until an admin
-- assigns it). Readable by everyone, writable by admins only.
CREATE TABLE IF NOT EXISTS faction_race_tags (
  faction_id TEXT PRIMARY KEY,
  race TEXT NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Racial stat maximums (V-RACEMAX): one row per race name, `maxima` is a
-- JSON array of 12 numbers (or null = keep the automatic cap for that stat),
-- in profile order M WS BS S T W I A Ld Cl Wil Int. Applies to every fighter
-- of that race whose stat maximums are in Automatic mode. Readable by
-- everyone, writable by admins only.
CREATE TABLE IF NOT EXISTS race_stat_maximums (
  race TEXT PRIMARY KEY,
  maxima JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Warband categories (V-WBCATEGORIES). "créer des catégir qui
-- ressemlberait a une warband pour en mettre des warband officielle en sous
-- warband. Mais la grande serait vide" — an empty, race-scoped grouping
-- shell (e.g. "Human Mercenaries") shown on the Rules: Warbands directory,
-- under which several standalone, fully playable warbands (book factions or
-- officialized warbands, same loose faction_id convention as
-- faction_race_tags/official_warbands.supplement_of above — a book slug or
-- an official_warbands UUID, never a DB foreign key) are grouped. A category
-- itself never carries a roster/definition and never gets a detail page —
-- purely a label. Distinct from official_warbands.supplement_of, which
-- nests ONE variant warband under its single specific base (e.g. Blood
-- Dragons of Undead) rather than grouping several independent ones. Readable
-- by everyone (it only affects how the directory is organized), writable by
-- admins only.
CREATE TABLE IF NOT EXISTS faction_categories (
  id UUID PRIMARY KEY,
  race TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS faction_categories_race_idx ON faction_categories(race);

-- A faction's membership in one of the categories above. One row per
-- faction (a warband can belong to at most one category at a time), keyed
-- the same loose way as faction_race_tags. Deleting the category cascades
-- here, which simply leaves those warbands unassigned again — nothing about
-- the warband itself is touched either way.
CREATE TABLE IF NOT EXISTS faction_category_members (
  faction_id TEXT PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES faction_categories(id) ON DELETE CASCADE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS faction_category_members_category_idx ON faction_category_members(category_id);

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

-- Official magic-domain display overrides (Task #56). Lets an admin rename
-- how a book magic/prayer domain is SHOWN in the Référentiel and set its
-- card frame color, without touching the domain's actual key (which every
-- fighter's magicAccess grant and every spell's domain field still match
-- against unchanged). Purely cosmetic: domain_key never changes once set,
-- only name/color do. Readable by everyone, writable by admins only.
CREATE TABLE IF NOT EXISTS magic_domain_overrides (
  domain_key TEXT PRIMARY KEY,
  name TEXT,
  color TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin-attached weapon profile for a BOOK spell/prayer (V-SPELLWEAPON-BOOK,
-- made shared in Task #84). It used to live only in the admin's own account
-- data (state.spellWeaponProfiles) — saved there via the ordinary account
-- data endpoint, so only the admin's own fighters who knew the spell ever
-- got the weapon; every other player never saw it. Same pattern as the
-- other override tables above: public read, admin-only write. Keyed by the
-- book spell's stable RULES entry id.
CREATE TABLE IF NOT EXISTS spell_weapon_profile_overrides (
  entry_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- V-SCENARIOS: admin-authored scenarios ("battle plans") shown on the
-- Rules > Scenarios page and reused by Play mode. Same whole-payload-replace
-- shape as official_warbands.definition: `definition` is one JSONB blob
-- holding every section (battlefield, roles, preparation, specialRules,
-- bandsFormula, underdogBonus, deployment, experience, objectives,
-- endCondition, victory, rewards, campaignSeries, eventWindow, thumbnail).
-- `category` is a short denormalized tag (1v1 / multiplayers / campaign /
-- event / history) kept as its own column purely so the list page can filter
-- without parsing JSON. status mirrors official_warbands: 'draft' stays
-- admin-only (editable, not yet shown to players); 'published' is live.
-- Readable by everyone once published, writable by admins only.
-- Campaigns (V-CAMPAIGNS). A campaign is a bundle of content (optional rule
-- pages, later equipment / income / artifacts / scenarios / locations) kept
-- in `definition`, published by an admin and joined by players' warbands.
-- A warband lives in its owner's account data; campaign_members only records
-- which warband (by its roster id) of which user is in which campaign, so the
-- standings and member list can be shown to everyone.
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#ff8a3d',
  status TEXT NOT NULL DEFAULT 'draft',
  join_code TEXT NOT NULL UNIQUE,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS campaign_members (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  roster_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roster_name TEXT NOT NULL DEFAULT '',
  faction TEXT NOT NULL DEFAULT '',
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (campaign_id, roster_id)
);
CREATE INDEX IF NOT EXISTS campaign_members_user_idx ON campaign_members(user_id);

CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '1v1',
  status TEXT NOT NULL DEFAULT 'draft',
  definition JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scenarios_created_at_idx ON scenarios(created_at);
-- V-SCENARIOS-MULTICAT: a scenario can now belong to several categories at
-- once (e.g. both "campaign" and "event"). `category` stays (= categories[0])
-- for any old row/query that still reads it; `categories` is the real list
-- going forward.
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS categories JSONB NOT NULL DEFAULT '["1v1"]';

-- V-SCENARIOS: the admin-managed library of deployment-card images a
-- scenario's Déploiement section picks from (checked in the admin editor,
-- then the client's "Generate a map" button picks randomly among a
-- scenario's checked `number`s). `number` is a stable, ever-increasing
-- display id (distinct from the UUID primary key) so admins can reference a
-- card by a short number when preparing scans/imports. `image` is a data URL
-- (same inline-storage convention app.js already uses for fighter/warband
-- images via storeImportedImage), kept small by the client's own
-- downscale-before-upload step. Readable by everyone (needed to render a
-- drawn card), writable by admins only.
CREATE TABLE IF NOT EXISTS deployment_maps (
  id UUID PRIMARY KEY,
  number SERIAL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- V-MAPBUILDER2: a map can be built from flat vector shapes (the admin's own
-- in-browser builder) instead of an uploaded raster image — never depends
-- on anyone else's artwork. `image` stays for a map uploaded the old way;
-- `shapes` carries the vector ones: {tableInches:{w,h}, items:[]}. Never
-- both empty: the server enforces one or the other on write.
ALTER TABLE deployment_maps ALTER COLUMN image DROP NOT NULL;
ALTER TABLE deployment_maps ADD COLUMN IF NOT EXISTS shapes JSONB NOT NULL DEFAULT '{"tableInches":{"w":48,"h":48},"items":[]}';

-- V-HOME: the Home page's site-wide feed ("New on Mordheimunda") and the
-- admin-editable Active Event. News rows are added automatically when admin
-- content becomes visible to every player (a published warband, a new Hired
-- Sword or fighter in a published warband, a published campaign or scenario)
-- and by hand from the Home page; site_settings holds the Active Event.
CREATE TABLE IF NOT EXISTS site_news (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'update',
  title TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS site_news_created_at_idx ON site_news(created_at DESC);
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- V-RULEIMAGES: pictures inserted in rule text by an admin ([IMG id=…]). Kept
-- out of rule_overrides so the rules text every visitor downloads at boot
-- stays small; each picture is fetched only when a page shows it.
CREATE TABLE IF NOT EXISTS rule_images (
  id UUID PRIMARY KEY,
  mime TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
