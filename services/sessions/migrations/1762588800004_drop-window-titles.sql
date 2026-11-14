-- Up Migration
-- DeskPulse no longer collects window titles (SPEC §7). DROP COLUMN only marks the column as
-- dropped; the old values would stay in the table's pages. Nulling them first rewrites every row
-- that had a title, so the old tuples become dead and autovacuum reclaims them. VACUUM FULL
-- cannot run inside the migration transaction, so the bytes are overwritten by autovacuum, not
-- by this migration.
UPDATE sessions SET title = NULL WHERE title IS NOT NULL;
ALTER TABLE sessions DROP COLUMN title;

-- Down Migration
-- The deleted titles cannot come back; only the empty column does.
ALTER TABLE sessions ADD COLUMN title text CHECK (char_length(title) <= 512);
