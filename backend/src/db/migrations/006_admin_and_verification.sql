-- ============================================================
-- Campus Pulse — Migration 006: student verification and the
-- admin/moderation surface.
-- ============================================================

CREATE TYPE verification_method AS ENUM ('school_email', 'student_id');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');

-- Stronger verification than basic email confirmation (Phase 1). Kept as its
-- own column rather than overloading email_verified_at, since the two are
-- different claims: "this email address is real" vs. "we believe this is a
-- real student." The public "Verified" badge (Phase 2's discovery/profile
-- queries) is updated in this migration's application code to mean "either."
ALTER TABLE users ADD COLUMN student_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN suspended_reason VARCHAR(500);

CREATE TABLE verification_requests (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method                 verification_method NOT NULL,
    school_email           CITEXT,
    -- Never displayed publicly or to any user other than the requester and
    -- admins reviewing it — enforced in application code (admin module),
    -- same handling as any other sensitive document.
    student_id_image_url   TEXT,
    status                 verification_status NOT NULL DEFAULT 'pending',
    reviewed_by            UUID REFERENCES users(id),
    reviewer_notes         VARCHAR(1000),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at            TIMESTAMPTZ,
    CONSTRAINT chk_verification_method_data CHECK (
        (method = 'school_email' AND school_email IS NOT NULL) OR
        (method = 'student_id' AND student_id_image_url IS NOT NULL)
    )
);

CREATE INDEX idx_verification_status ON verification_requests (status);
CREATE INDEX idx_verification_user ON verification_requests (user_id);

-- Only one pending request per user at a time — resubmission replaces it
-- rather than piling up duplicates for reviewers to sort through.
CREATE UNIQUE INDEX idx_verification_one_pending_per_user
    ON verification_requests (user_id) WHERE status = 'pending';
