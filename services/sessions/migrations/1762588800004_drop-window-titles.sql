-- Up Migration
-- DeskPulse no longer collects window titles (SPEC §7). Dropping the column deletes every
-- stored title, so nothing recorded before the upgrade survives it.
ALTER TABLE sessions DROP COLUMN title;

-- Down Migration
-- The deleted titles cannot come back; only the empty column does.
ALTER TABLE sessions ADD COLUMN title text CHECK (char_length(title) <= 512);
