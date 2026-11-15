# Database backups

## Automatic weekly backup (GitHub)

`.github/workflows/backup.yml` runs every Monday at 03:17 UTC, and on demand
(GitHub › **Actions** › *Weekly database backup* › **Run workflow**). It:

1. dumps the whole database with `pg_dump`;
2. **encrypts** the dump with your passphrase (AES-256). The repository is
   public: an unencrypted file could be downloaded by anyone, and the dump
   holds every account (usernames, e-mail addresses);
3. keeps the encrypted file 90 days as a run artifact;
4. writes the date in the site, shown in Admin › Backup.

### One-time setup

In GitHub › the repository › **Settings › Secrets and variables › Actions ›
New repository secret**, add:

| Name | Value |
|---|---|
| `BACKUP_DATABASE_URL` | the Neon connection string (Neon › your project › **Connect**; the same one as Vercel's `DATABASE_URL`) |
| `BACKUP_PASSPHRASE` | a long passphrase (16 characters or more) that **only you** keep, e.g. in a password manager. Lost passphrase = backups that can never be opened. |

Then run it once by hand (Actions › Weekly database backup › Run workflow) and
check it ends green.

## Restoring

1. Download the artifact (Actions › a run › *Artifacts*), unzip it.
2. Decrypt: `gpg -d mordheimunda-YYYY-MM-DD.dump.gpg > db.dump` (asks for the passphrase).
3. Restore into a database (preferably a fresh Neon branch first, to check):
   `pg_restore --clean --if-exists --no-owner --no-privileges -d "<connection string>" db.dump`

## Manual backup

Admin › Backup › **Download a full backup** gives a JSON file of everything
(no passwords or sessions). Its date is shown next to the automatic one.
