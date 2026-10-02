# Mordheimunda 26 — V88

V88 is the online-ready architecture release built on the existing M17 roster manager.

### Included
- Existing roster/campaign/custom-content application preserved.
- Versioned local data migrations.
- Account API with PostgreSQL persistence.
- Secure password hashing and HttpOnly sessions.
- Password/username recovery by email.
- Cross-device cloud synchronization.
- Optimistic cloud revision checks to prevent silent overwrites.
- Production-oriented security middleware and rate limiting.
- Modular content-pack registry.
- Deployment and update documentation.

### Before public launch
The package still needs a real hosting environment and provider credentials: HTTPS/domain, PostgreSQL, and SMTP. No production secret is included in this archive.

## Vercel

Cette version contient désormais l'adaptateur Vercel (`api/[...path].js`) et `vercel.json`. Voir `VERCEL_DEPLOYMENT.md` pour la configuration PostgreSQL, SMTP et variables d'environnement.
