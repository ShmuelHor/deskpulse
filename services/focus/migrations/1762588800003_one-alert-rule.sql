-- Up Migration
-- SPEC §5 focus: the alert rule is fixed. The per-type levels, the focus schedules and the
-- session source are gone, so their data goes with them.
DROP TABLE alert_policy;
DROP TABLE schedules;
ALTER TABLE queued_alerts DROP COLUMN level;
ALTER TABLE focus_sessions DROP COLUMN source;

-- Down Migration
ALTER TABLE focus_sessions
  ADD COLUMN source text NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'schedule', 'pomodoro', 'auto'));
ALTER TABLE focus_sessions ALTER COLUMN source DROP DEFAULT;

ALTER TABLE queued_alerts
  ADD COLUMN level text NOT NULL DEFAULT 'normal' CHECK (level IN ('critical', 'important', 'normal'));
ALTER TABLE queued_alerts ALTER COLUMN level DROP DEFAULT;

CREATE TABLE schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  days smallint[] NOT NULL CHECK (
    cardinality(days) BETWEEN 1 AND 7 AND days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  start_at text NOT NULL CHECK (start_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_at text NOT NULL CHECK (end_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_at <> end_at)
);

CREATE TABLE alert_policy (
  type text PRIMARY KEY CHECK (type IN (
    'battery-low', 'battery-critical', 'battery-plugged-full', 'pressure-incident',
    'memory-critical', 'thermal', 'memory-leak'
  )),
  level text NOT NULL CHECK (level IN ('critical', 'important', 'normal'))
);
