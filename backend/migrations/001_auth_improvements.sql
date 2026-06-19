-- Migración: mejoras al sistema de auth
-- Aplicar con: psql $DATABASE_URL -f migrations/001_auth_improvements.sql

-- Columnas para reset de contraseña en users
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ix_users_reset_token ON users (reset_token);

-- Tabla para tokens revocados (logout real)
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(64) UNIQUE NOT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_revoked_tokens_jti ON revoked_tokens (jti);
