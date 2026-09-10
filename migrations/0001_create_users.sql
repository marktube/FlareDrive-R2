-- D1 schema for FlareDrive-R2 database-backed accounts.
-- Apply with:
--   wrangler d1 execute <YOUR_DB_NAME> --file=./migrations/0001_create_users.sql
--   (add --remote to run against the production database instead of local)

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- hex-encoded PBKDF2-SHA256 hash
  salt          TEXT NOT NULL,          -- hex-encoded random salt, unique per user
  permissions   TEXT NOT NULL,          -- comma separated dir prefixes, or "*" for full access
  is_readonly   INTEGER NOT NULL DEFAULT 0,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
