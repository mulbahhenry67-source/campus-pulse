-- ============================================================
-- Campus Pulse — Migration 004: real-time messaging.
-- A "conversation" is 1:1 with a match — no separate conversations
-- table needed; messages reference matches(id) directly.
-- ============================================================

CREATE TYPE report_target_type AS ENUM ('message', 'user', 'community_post', 'community');
CREATE TYPE report_status AS ENUM ('pending', 'under_review', 'resolved', 'rejected');
CREATE TYPE report_reason AS ENUM ('harassment', 'spam', 'fake_profile', 'scam', 'inappropriate_content', 'impersonation', 'other');

-- Lets the conversation list be sorted cheaply without a correlated subquery per row.
ALTER TABLE matches ADD COLUMN last_message_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id     UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content      VARCHAR(2000),
    image_url    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    CONSTRAINT chk_content_or_image CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

CREATE INDEX idx_messages_match ON messages (match_id, created_at);
CREATE INDEX idx_messages_sender ON messages (sender_id);

CREATE TABLE message_reactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       VARCHAR(16) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One reaction per user per message; re-reacting overwrites it.
    CONSTRAINT uq_reaction UNIQUE (message_id, user_id)
);

CREATE INDEX idx_reactions_message ON message_reactions (message_id);

-- Read receipts: one row per (match, user) tracking the last time they
-- opened the conversation. Unread count = messages after this timestamp
-- from the other participant.
CREATE TABLE message_reads (
    match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, user_id)
);

-- ------------------------------------------------------------
-- reports: generic across content types. Message reporting is wired up
-- in this phase; user/community-post/community reporting reuse this same
-- table when those features land, and the admin review dashboard (Phase 6)
-- reads from it too.
-- ------------------------------------------------------------
CREATE TABLE reports (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type      report_target_type NOT NULL,
    target_id        UUID NOT NULL,
    reason           report_reason NOT NULL,
    description      VARCHAR(1000),
    status           report_status NOT NULL DEFAULT 'pending',
    moderator_notes  VARCHAR(1000),
    resolved_by      UUID REFERENCES users(id),
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_status ON reports (status);
CREATE INDEX idx_reports_target ON reports (target_type, target_id);
CREATE INDEX idx_reports_reporter ON reports (reporter_id);
