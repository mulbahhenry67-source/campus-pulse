-- ============================================================
-- Campus Pulse — Migration 001: core users & authentication
-- Phase 1. Later migrations add profiles, matching, messaging,
-- communities, moderation, etc. on top of this.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'super_admin');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned', 'deleted');

-- ------------------------------------------------------------
-- users: authentication + identity core.
-- Everything profile-related (bio, photos, interests, etc.)
-- lives in a separate `profiles` table added in Phase 2, kept
-- 1:1 with users, so auth concerns stay isolated from dating
-- profile concerns.
-- ------------------------------------------------------------
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT NOT NULL UNIQUE,
    phone               VARCHAR(20) UNIQUE,
    password_hash       TEXT NOT NULL,
    first_name          VARCHAR(50) NOT NULL,
    last_name           VARCHAR(50) NOT NULL,
    date_of_birth       DATE NOT NULL,
    role                user_role NOT NULL DEFAULT 'user',
    status              account_status NOT NULL DEFAULT 'active',
    email_verified_at   TIMESTAMPTZ,
    phone_verified_at   TIMESTAMPTZ,
    failed_login_count  SMALLINT NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT chk_min_age CHECK (date_of_birth <= (CURRENT_DATE - INTERVAL '18 years'))
);

-- Note: CITEXT requires the citext extension for case-insensitive email matching.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users (status) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- user_sessions: one row per refresh-token "session" (device).
-- Enables "log out of all devices" and refresh-token rotation
-- with reuse detection: if a rotated-out token is presented
-- again, we know the session was compromised and revoke the
-- whole family.
-- ------------------------------------------------------------
CREATE TABLE user_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  TEXT NOT NULL,
    family_id           UUID NOT NULL, -- shared across rotations of the same login
    user_agent          TEXT,
    ip_address          INET,
    revoked_at          TIMESTAMPTZ,
    replaced_by_id       UUID REFERENCES user_sessions(id),
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON user_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_family ON user_sessions (family_id);
CREATE UNIQUE INDEX idx_sessions_token_hash ON user_sessions (refresh_token_hash);

-- ------------------------------------------------------------
-- email_verifications: single-use, expiring tokens
-- ------------------------------------------------------------
CREATE TABLE email_verifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_verif_user ON email_verifications (user_id) WHERE consumed_at IS NULL;

-- ------------------------------------------------------------
-- password_resets: single-use, expiring tokens
-- ------------------------------------------------------------
CREATE TABLE password_resets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pw_reset_user ON password_resets (user_id) WHERE consumed_at IS NULL;

-- ------------------------------------------------------------
-- audit_logs: security-relevant event trail
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type  VARCHAR(64) NOT NULL,
    metadata    JSONB NOT NULL DEFAULT '{}',
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_logs (user_id);
CREATE INDEX idx_audit_event_type ON audit_logs (event_type);
CREATE INDEX idx_audit_created_at ON audit_logs (created_at);

-- ------------------------------------------------------------
-- updated_at trigger, reused by every future table with that column
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
