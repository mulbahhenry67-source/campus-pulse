-- ============================================================
-- Campus Pulse — Migration 002: profiles, interests, availability,
-- likes/passes/matches, configurable matching weights.
-- ============================================================

CREATE TYPE relationship_goal AS ENUM ('serious', 'casual', 'friendship', 'new_connections', 'not_sure');
CREATE TYPE academic_year AS ENUM ('freshman', 'sophomore', 'junior', 'senior', 'graduate', 'alumni');

-- ------------------------------------------------------------
-- Reference tables
-- ------------------------------------------------------------
CREATE TABLE schools (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name  VARCHAR(150) NOT NULL UNIQUE,
    domain VARCHAR(100) -- e.g. "university.edu", used for school-email verification later
);

CREATE TABLE majors (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name  VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE interests (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name      VARCHAR(60) NOT NULL UNIQUE,
    category  VARCHAR(60)
);

-- ------------------------------------------------------------
-- profiles: 1:1 with users. Kept separate from auth (users table)
-- so dating-profile data has its own lifecycle (onboarding,
-- editable, publicly-ish visible) distinct from auth concerns.
-- ------------------------------------------------------------
CREATE TABLE profiles (
    user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio                     VARCHAR(500) DEFAULT '',
    gender                  VARCHAR(30),
    gender_preference       TEXT[] NOT NULL DEFAULT '{}', -- genders the user is interested in seeing
    school_id               UUID REFERENCES schools(id),
    major_id                UUID REFERENCES majors(id),
    academic_year           academic_year,
    relationship_goal       relationship_goal,
    -- Big-five-style personality scores, each 0-100. Populated by the
    -- onboarding questionnaire. Stored as jsonb so the questionnaire can
    -- evolve without a migration every time.
    personality             JSONB NOT NULL DEFAULT '{}',
    -- Free-form-but-structured lifestyle answers, e.g.
    -- {"smoking":"never","drinking":"socially","exercise":"often","sleep_schedule":"early_bird"}
    lifestyle                JSONB NOT NULL DEFAULT '{}',
    latitude                 DOUBLE PRECISION,
    longitude                DOUBLE PRECISION,
    min_age_preference       SMALLINT NOT NULL DEFAULT 18,
    max_age_preference       SMALLINT NOT NULL DEFAULT 99,
    max_distance_km          SMALLINT NOT NULL DEFAULT 50,
    discoverable              BOOLEAN NOT NULL DEFAULT true,
    show_distance             BOOLEAN NOT NULL DEFAULT true,
    onboarding_completed_at   TIMESTAMPTZ,
    last_active_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_age_pref CHECK (min_age_preference <= max_age_preference)
);

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_profiles_discoverable ON profiles (discoverable) WHERE discoverable = true;
CREATE INDEX idx_profiles_school ON profiles (school_id);
CREATE INDEX idx_profiles_location ON profiles (latitude, longitude);

CREATE TABLE profile_photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    position    SMALLINT NOT NULL DEFAULT 0,
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_photos_user ON profile_photos (user_id, position);
-- Only one primary photo per user.
CREATE UNIQUE INDEX idx_photos_one_primary ON profile_photos (user_id) WHERE is_primary = true;

CREATE TABLE user_interests (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id  UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, interest_id)
);

CREATE INDEX idx_user_interests_interest ON user_interests (interest_id);

-- ------------------------------------------------------------
-- availability: weekly recurring free-time blocks, not calendar dates.
-- ------------------------------------------------------------
CREATE TABLE availability (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_time_order CHECK (start_time < end_time)
);

CREATE INDEX idx_availability_user ON availability (user_id, day_of_week);

-- ------------------------------------------------------------
-- likes / passes / matches
-- ------------------------------------------------------------
CREATE TABLE likes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liker_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    liked_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_super_like BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_no_self_like CHECK (liker_id <> liked_id),
    CONSTRAINT uq_like UNIQUE (liker_id, liked_id)
);

CREATE INDEX idx_likes_liked ON likes (liked_id);
CREATE INDEX idx_likes_liker ON likes (liker_id);

CREATE TABLE passes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    passed_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_no_self_pass CHECK (user_id <> passed_user_id),
    CONSTRAINT uq_pass UNIQUE (user_id, passed_user_id)
);

CREATE INDEX idx_passes_user ON passes (user_id);

-- Canonical ordering (user_low_id < user_high_id) means a match between two
-- people can only ever exist as one row, however the mutual like occurred.
CREATE TABLE matches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_low_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_high_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    unmatched_at    TIMESTAMPTZ,
    unmatched_by    UUID REFERENCES users(id),
    CONSTRAINT chk_match_order CHECK (user_low_id < user_high_id),
    CONSTRAINT uq_match UNIQUE (user_low_id, user_high_id)
);

CREATE INDEX idx_matches_low ON matches (user_low_id) WHERE unmatched_at IS NULL;
CREATE INDEX idx_matches_high ON matches (user_high_id) WHERE unmatched_at IS NULL;

-- ------------------------------------------------------------
-- blocks: full moderation/reporting comes in a later phase, but block
-- enforcement has to exist from day one of discovery — a blocked user
-- must never be recommended to the blocker (or vice versa).
-- ------------------------------------------------------------
CREATE TABLE blocks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id),
    CONSTRAINT uq_block UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks (blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks (blocked_id);

-- ------------------------------------------------------------
-- matching_config: single-row, admin-editable weighting for the
-- compatibility algorithm. Weights are fractions that should sum to ~1.0;
-- enforced in application code (admin service), not the DB, so an admin
-- can save incrementally.
-- ------------------------------------------------------------
CREATE TABLE matching_config (
    id                 SMALLINT PRIMARY KEY DEFAULT 1,
    personality_weight NUMERIC(4,3) NOT NULL DEFAULT 0.25,
    interests_weight   NUMERIC(4,3) NOT NULL DEFAULT 0.20,
    goals_weight       NUMERIC(4,3) NOT NULL DEFAULT 0.20,
    lifestyle_weight   NUMERIC(4,3) NOT NULL DEFAULT 0.10,
    education_weight   NUMERIC(4,3) NOT NULL DEFAULT 0.05,
    schedule_weight    NUMERIC(4,3) NOT NULL DEFAULT 0.10,
    distance_weight    NUMERIC(4,3) NOT NULL DEFAULT 0.10,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_single_row CHECK (id = 1)
);

INSERT INTO matching_config (id) VALUES (1);

CREATE TRIGGER trg_matching_config_updated_at
    BEFORE UPDATE ON matching_config
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Seed a small starter set of interests so onboarding/discover aren't empty.
-- ------------------------------------------------------------
INSERT INTO interests (name, category) VALUES
    ('Football', 'sports'), ('Basketball', 'sports'), ('Fitness', 'sports'),
    ('Gaming', 'entertainment'), ('Anime', 'entertainment'), ('Movies', 'entertainment'), ('Music', 'entertainment'),
    ('Coding', 'academic'), ('Programming', 'academic'), ('Engineering', 'academic'), ('Business', 'academic'),
    ('Fashion', 'lifestyle'), ('Travel', 'lifestyle'), ('Photography', 'creative'), ('Art', 'creative'),
    ('Technology', 'academic')
ON CONFLICT (name) DO NOTHING;
