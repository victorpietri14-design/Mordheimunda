# Mordheimunda 26 — Online backend

Production backend for accounts and per-user cloud data.

## Stack
- Node.js 20+
- Express
- PostgreSQL
- bcryptjs
- HttpOnly cookie sessions
- Nodemailer for recovery mail

## First deployment
1. Create a PostgreSQL database.
2. Run `db/schema.sql` against it. The SQL is idempotent and contains safe upgrades for V85 databases.
3. Copy `.env.example` to `.env` and set production values.
4. Run `npm ci`.
5. Start with `npm start` behind HTTPS.

The web server serves the static client and the `/api/*` endpoints from the same origin by default. This avoids cross-origin cookie complications.

## Data/update model
User data lives in PostgreSQL, not in the deployed application files. Updating the site therefore does not replace roster data. The client also keeps a local copy for offline continuity.

Every cloud save carries the last known `revision`. If another device changed the account first, the server returns `409 DATA_CONFLICT` instead of silently overwriting that newer revision. The client then asks the user to synchronize.

The local application uses versioned migrations. Never remove old migration functions or reuse an existing content ID for a different object.

## Security checklist before public launch
- Use HTTPS.
- Set `NODE_ENV=production` and `TRUST_PROXY=true` when the reverse proxy terminates TLS.
- Set `CLIENT_ORIGIN` to the exact public origin.
- Use a managed PostgreSQL database with automated backups and restricted credentials.
- Configure a real SMTP provider and a sender on your domain.
- Keep `.env` and database credentials outside the static site directory.
- Monitor authentication errors and database health.
- Periodically test restore of a PostgreSQL backup.

The server does not expose passwords or recovery tokens through API responses. Password reset tokens are stored only as SHA-256 hashes and expire after one hour.
