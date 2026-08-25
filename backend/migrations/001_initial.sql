CREATE TABLE IF NOT EXISTS runbooks (
 id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]*$'),
 title JSONB NOT NULL,
 category TEXT NOT NULL,
 folder TEXT,
 data JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_runbooks_updated_at ON runbooks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_runbooks_category ON runbooks(category);
CREATE INDEX IF NOT EXISTS idx_runbooks_folder ON runbooks(folder);
CREATE INDEX IF NOT EXISTS idx_runbooks_data_gin ON runbooks USING GIN(data);

CREATE TABLE IF NOT EXISTS folders (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
