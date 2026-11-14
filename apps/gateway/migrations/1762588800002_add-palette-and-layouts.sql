-- Up Migration
-- T68: settings gain a palette, and each page gets a place for its widget layout.
-- The Settings schema requires `palette` and is strict, so a stored row from before this
-- migration would fail every read. `||` keeps any palette the row already has out of the way:
-- only rows without the key are touched, which also makes the migration safe to repeat.
UPDATE settings SET value = value || '{"palette": "stone-mustard"}'::jsonb WHERE NOT (value ? 'palette');

-- One row per page; a missing row means "the page's default layout", so deleting restores it.
-- The gateway validates `value` against the shared Layout schema on every write and read.
CREATE TABLE layouts (
  page text PRIMARY KEY CHECK (page IN ('control', 'performance', 'time', 'focus', 'processes', 'maintenance')),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object')
);

-- Down Migration
DROP TABLE layouts;
-- The palette of a settings row is not removed: the previous Settings schema is strict and
-- would fail on it, but rolling back past this release is not supported for stored settings.
SELECT 1;
