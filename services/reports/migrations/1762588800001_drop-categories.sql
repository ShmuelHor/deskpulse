-- Up Migration
-- Categories are gone (T61). Time is kept per day and app: the categories of one app are summed.
-- Streaks were per category, so they are dropped and build up again from new sessions.
CREATE TABLE daily_rollups_by_app (
  day date NOT NULL,
  app_id text NOT NULL CHECK (app_id ~ '^[a-zA-Z0-9._-]{1,128}$'),
  active_ms bigint NOT NULL CHECK (active_ms >= 0),
  PRIMARY KEY (day, app_id)
);
INSERT INTO daily_rollups_by_app (day, app_id, active_ms)
  SELECT day, app_id, sum(active_ms) FROM daily_rollups GROUP BY day, app_id;
DROP TABLE daily_rollups;
ALTER TABLE daily_rollups_by_app RENAME TO daily_rollups;

DELETE FROM focus_streaks;
DROP INDEX focus_streaks_category_end_at;
ALTER TABLE focus_streaks DROP COLUMN category;
CREATE INDEX focus_streaks_end_at ON focus_streaks (end_at);

-- Down Migration
DROP INDEX focus_streaks_end_at;
ALTER TABLE focus_streaks ADD COLUMN category text NOT NULL DEFAULT 'work' CHECK (category ~ '^[a-z0-9-]{1,32}$');
ALTER TABLE focus_streaks ALTER COLUMN category DROP DEFAULT;
CREATE INDEX focus_streaks_category_end_at ON focus_streaks (category, end_at);

ALTER TABLE daily_rollups ADD COLUMN category text CHECK (category ~ '^[a-z0-9-]{1,32}$');
ALTER TABLE daily_rollups DROP CONSTRAINT daily_rollups_pkey;
ALTER TABLE daily_rollups ADD CONSTRAINT daily_rollups_key UNIQUE NULLS NOT DISTINCT (day, app_id, category);
