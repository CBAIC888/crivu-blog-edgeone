CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email_hash TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden', 'spam')),
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_comments_slug_status_created
  ON comments (slug, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_status_created
  ON comments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_ip_created
  ON comments (ip_hash, created_at DESC);
