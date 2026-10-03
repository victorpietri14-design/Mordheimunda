# Déploiement Vercel — Mordheimunda 26

## Architecture

- Frontend statique : racine du projet (`index.html`, `assets/`, `data/`).
- API : `api/[...path].js`, qui expose l'application Express comme Vercel Function.
- Base de données : PostgreSQL managé. Pour Vercel, Neon est une intégration Marketplace recommandée.
- Secrets : variables d'environnement Vercel, jamais dans Git.

## Variables de production

Configurer au minimum :

- `NODE_ENV=production`
- `DATABASE_URL=<URL PostgreSQL poolée>`
- `DATABASE_SSL=true`
- `CLIENT_ORIGIN=https://votre-domaine`
- `SESSION_DAYS=30`
- `TRUST_PROXY=true` (la valeur doit être exactement `true` — le code ne reconnaît que cette chaîne, pas `1`)
- `APP_VERSION=88`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`

Pour un domaine Vercel, `CLIENT_ORIGIN` doit correspondre exactement à l'origine utilisée par les utilisateurs.

## Base de données

Exécuter `server/db/schema.sql` dans PostgreSQL avant la première utilisation.

Les données utilisateur sont dans `user_data` et sont indépendantes des fichiers déployés. Un nouveau déploiement ne remplace donc pas les rosters enregistrés.

## Déploiement

1. Importer le dépôt dans Vercel.
2. Laisser le projet à la racine du dépôt.
3. Utiliser Node.js 22 (le projet ne doit pas cibler Node 20 pour les nouveaux déploiements après le 1er octobre 2026).
4. Ajouter les variables d'environnement dans Settings → Environment Variables.
5. Connecter PostgreSQL via Vercel Marketplace (Neon est adapté à ce projet).
6. Exécuter `server/db/schema.sql`.
7. Déployer.
8. Tester `/api/health`, création de compte, connexion, sauvegarde puis reconnexion.

## Mises à jour

Chaque déploiement Vercel remplace le code, pas la base PostgreSQL. Les migrations de données restent versionnées dans `assets/core/migrations.js`.

Avant une migration importante, effectuer une sauvegarde PostgreSQL.
