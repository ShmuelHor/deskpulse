-- Up Migration
-- T68: settings gain a palette. Page layouts are stored in the same row under `layouts`, one key
-- per page, and need no migration: a row without the key simply has no saved layouts.
-- The Settings schema requires `palette` and is strict, so a stored row from before this
-- migration would fail every read. `||` keeps any palette the row already has out of the way:
-- only rows without the key are touched, which also makes the migration safe to repeat.
UPDATE settings SET value = value || '{"palette": "stone-mustard"}'::jsonb WHERE NOT (value ? 'palette');

-- Down Migration
-- The palette of a settings row is not removed: the previous Settings schema is strict and
-- would fail on it, but rolling back past this release is not supported for stored settings.
SELECT 1;
