-- ============================================================
-- Campus Pulse — Migration 005: interest communities and the
-- post-match date planner.
-- ============================================================

CREATE TYPE date_activity AS ENUM (
    'coffee', 'restaurant', 'walk', 'study_session', 'gaming', 'sports', 'movie', 'campus_event', 'other'
);
CREATE TYPE date_plan_status AS ENUM ('proposed', 'confirmed', 'declined', 'cancelled');

-- ------------------------------------------------------------
-- Communities
-- ------------------------------------------------------------
CREATE TABLE communities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL UNIQUE,
    slug          VARCHAR(120) NOT NULL UNIQUE,
    description   VARCHAR(1000) NOT NULL DEFAULT '',
    rules         VARCHAR(2000) NOT NULL DEFAULT '',
    category      VARCHAR(60),
    member_count  INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_communities_category ON communities (category);

CREATE TABLE community_members (
    community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (community_id, user_id)
);

CREATE INDEX idx_community_members_user ON community_members (user_id);

CREATE TABLE community_posts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id   UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content        VARCHAR(2000) NOT NULL,
    like_count     INT NOT NULL DEFAULT 0,
    comment_count  INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);

CREATE INDEX idx_community_posts_community ON community_posts (community_id, created_at DESC);
CREATE INDEX idx_community_posts_author ON community_posts (author_id);

CREATE TABLE community_post_likes (
    post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE community_post_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     VARCHAR(1000) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_post_comments_post ON community_post_comments (post_id, created_at);

-- ------------------------------------------------------------
-- Date planner: proposals tied to a match. Only a general location note is
-- stored (never coordinates) — spec requires location privacy stays protected
-- even between two matched, presumably-trusting users.
-- ------------------------------------------------------------
CREATE TABLE date_plans (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id                 UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    proposed_by              UUID NOT NULL REFERENCES users(id),
    activity                 date_activity NOT NULL,
    custom_activity          VARCHAR(100),
    proposed_date            DATE NOT NULL,
    proposed_time            TIME NOT NULL,
    location_note            VARCHAR(300),
    status                   date_plan_status NOT NULL DEFAULT 'proposed',
    confirmed_by_proposer    BOOLEAN NOT NULL DEFAULT true,
    confirmed_by_recipient   BOOLEAN NOT NULL DEFAULT false,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_custom_activity CHECK (activity <> 'other' OR custom_activity IS NOT NULL)
);

CREATE TRIGGER trg_date_plans_updated_at
    BEFORE UPDATE ON date_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_date_plans_match ON date_plans (match_id, created_at DESC);

-- ------------------------------------------------------------
-- Seed starter communities matching the interest categories from Phase 2.
-- ------------------------------------------------------------
INSERT INTO communities (name, slug, description, rules, category) VALUES
    ('Football', 'football', 'For anyone who lives and breathes football — game threads, pickup games, and rivalries.', 'Keep it respectful. No harassment of players, refs, or fellow members.', 'sports'),
    ('Gaming', 'gaming', 'Console, PC, or mobile — find teammates, talk strategy, and share clips.', 'No cheating discussion. Keep spoilers tagged.', 'entertainment'),
    ('Coding', 'coding', 'Study groups, project collabs, and “why is this bug happening” therapy.', 'Be patient with beginners. No unpaid work solicitation.', 'academic'),
    ('Anime', 'anime', 'From classics to this season''s new releases.', 'Tag spoilers clearly.', 'entertainment'),
    ('Music', 'music', 'Share what you''re listening to, find a jam session, or talk gear.', 'Credit artists when sharing work.', 'entertainment'),
    ('Engineering', 'engineering', 'Cross-discipline space for engineering students.', 'Keep discussions constructive.', 'academic'),
    ('Fashion', 'fashion', 'Campus style, thrifting finds, and outfit inspo.', 'No unsolicited body commentary.', 'lifestyle'),
    ('Business', 'business', 'Case comps, internship talk, and networking.', 'No unsolicited MLM pitches.', 'academic'),
    ('Photography', 'photography', 'Share your shots and get feedback.', 'Credit your own work only.', 'creative'),
    ('Fitness', 'fitness', 'Gym buddies, campus runs, and form checks.', 'No extreme dieting content.', 'sports')
ON CONFLICT (name) DO NOTHING;
