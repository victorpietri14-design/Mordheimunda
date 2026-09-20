# Mordheimunda 26 — V86 → V88

## V86 — Cloud reliability
- Connected account sessions to persistent cloud data.
- Local data remains available when no account is used.
- Login bootstrapping restores account data after a page/device change.
- Automatic saves use the cloud boundary.

## V87 — Production security
- HttpOnly, SameSite session cookies.
- Secure cookies in production.
- Origin protection for state-changing requests in production.
- Case-insensitive unique usernames and emails.
- Expired session/recovery-token housekeeping.
- Password changes revoke other sessions.
- Response caching disabled for API/account data.
- Graceful PostgreSQL shutdown.
- Health endpoint checks database availability.

## V88 — Update-safe persistence
- `user_data.revision` enables optimistic concurrency control.
- A stale device cannot silently overwrite newer cloud data.
- Database schema includes idempotent upgrade statements for existing V85 databases.
- Static assets can be updated independently of persistent user data.
- Deployment/update documentation has been consolidated.
- The existing versioned local migration system remains the compatibility boundary.

## Important
The package is production-oriented, but it still needs an actual hosting provider, HTTPS, PostgreSQL credentials and SMTP credentials before public launch.
