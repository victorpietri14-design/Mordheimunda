# Mordheimunda 26 — Deployment & update plan (V88)

## Architecture
`Browser → HTTPS web server → Express API → PostgreSQL`

Static application files can be replaced independently from persistent account data.

## What survives a site update
- Accounts
- Password hashes
- Sessions (until expiry or password reset)
- Warbands
- Custom fighters
- Custom equipment
- Custom skills/spells
- Custom warbands
- Other JSON state supported by the migration layer

The database is never recreated as part of a normal application update.

## Release procedure
1. Back up PostgreSQL.
2. Deploy the new application files.
3. Run `server/db/schema.sql` (safe/idempotent for the current schema).
4. Install dependencies with `npm ci`.
5. Restart the Node process.
6. Check `/api/health`.
7. Test login and loading a test roster.
8. Only then announce the release.

## Content development
Put new factions, supplements, equipment collections and other large content in `data/packs/`. Give every object a stable ID. Keep presentation logic in feature modules rather than adding more large blocks to `app.js`.

## Database backup
Use the backup/snapshot facilities of the chosen PostgreSQL provider. Keep at least one off-site copy and periodically perform a test restore.

## Public-launch requirements
A domain, HTTPS certificate, PostgreSQL instance and SMTP account still have to be supplied by the eventual host/provider. The repository contains configuration templates but no real production credentials.
