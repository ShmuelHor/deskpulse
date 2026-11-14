-- Up Migration
-- Categories and their rules are gone (T61). The data is dropped, not migrated.
DROP TABLE category_rules;
ALTER TABLE sessions DROP COLUMN category;
ALTER TABLE apps DROP COLUMN category;

-- Down Migration
ALTER TABLE apps ADD COLUMN category text CHECK (category ~ '^[a-z0-9-]{1,32}$');
ALTER TABLE sessions ADD COLUMN category text CHECK (category ~ '^[a-z0-9-]{1,32}$');
CREATE TABLE category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field text NOT NULL CHECK (field IN ('wmClass', 'title')),
  match_type text NOT NULL CHECK (match_type IN ('exact', 'prefix', 'contains')),
  pattern text NOT NULL CHECK (char_length(pattern) BETWEEN 1 AND 256),
  category text NOT NULL CHECK (category ~ '^[a-z0-9-]{1,32}$'),
  priority integer NOT NULL CHECK (priority BETWEEN 0 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
