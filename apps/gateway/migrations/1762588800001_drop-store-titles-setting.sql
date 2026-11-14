-- Up Migration
-- DeskPulse no longer collects window titles (SPEC §7), so the "store titles" setting is gone.
-- The Settings schema is strict: a stored row that still holds the key would fail every read.
-- `#-` is a no-op when the key is absent, so this is safe to run on any row.
UPDATE settings SET value = value #- '{privacy,storeTitles}';

-- Down Migration
-- The old value cannot come back; the default at the time was to store titles, which DeskPulse
-- no longer does, so the key is not restored.
SELECT 1;
