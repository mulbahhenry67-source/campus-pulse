-- ============================================================
-- Campus Pulse — Migration 003: in-app notifications.
-- Push/email delivery infrastructure is a later phase; this gives
-- likes/matches something real to write to and the API something
-- real to read from in the meantime.
-- ============================================================

CREATE TYPE notification_type AS ENUM (
    'new_match', 'new_like', 'super_like', 'new_message',
    'profile_interaction', 'verification_result', 'community_activity',
    'date_invitation', 'date_confirmation', 'safety_notification'
);

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}',
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (user_id) WHERE read_at IS NULL;
