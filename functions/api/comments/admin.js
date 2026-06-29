const ALLOWED_STATUSES = new Set(['pending', 'approved', 'hidden', 'spam']);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });

const bearerToken = (request) => {
  const value = request.headers.get('Authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const verifyCmsToken = async (token, env) => {
  if (!token) return { ok: false, status: 401, error: 'Missing GitHub token' };

  const repo = env.GITHUB_REPO || 'CBAIC888/crivu-blog';
  const ghRes = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'crivu-cms-oauth',
    },
  });
  if (ghRes.status === 401) return { ok: false, status: 401, error: 'Invalid GitHub token' };
  if (ghRes.status === 404) return { ok: false, status: 403, error: 'GitHub token lacks repo access' };
  if (!ghRes.ok) return { ok: false, status: 502, error: 'GitHub auth check failed' };

  const repoJson = await ghRes.json().catch(() => ({}));
  const permissions = repoJson && typeof repoJson === 'object' ? repoJson.permissions : null;
  const canWrite =
    permissions &&
    typeof permissions === 'object' &&
    (permissions.push === true || permissions.admin === true || permissions.maintain === true);

  if (!canWrite) return { ok: false, status: 403, error: 'GitHub token lacks write access to this repo' };
  return { ok: true };
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS comments (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_comments_slug_status_created ON comments (slug, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_status_created ON comments (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_ip_created ON comments (ip_hash, created_at DESC)`,
];

const ensureSchema = async (db) => {
  for (const statement of schemaStatements) {
    await db.prepare(statement).run();
  }
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const auth = await verifyCmsToken(bearerToken(request), env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const db = env.COMMENTS_DB;
  if (!db) return json({ error: 'Comments database is not configured' }, 503);
  await ensureSchema(db);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const slug = url.searchParams.get('slug') || '';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);

  if (status !== 'all' && !ALLOWED_STATUSES.has(status)) return json({ error: 'Invalid status' }, 400);

  const filters = [];
  const bindings = [];
  if (status !== 'all') {
    filters.push('status = ?');
    bindings.push(status);
  }
  if (slug) {
    filters.push('slug = ?');
    bindings.push(slug);
  }
  bindings.push(limit);

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const result = await db
    .prepare(
      `SELECT id, slug, author_name, body, status, created_at, updated_at, approved_at
       FROM comments
       ${where}
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(...bindings)
    .all();

  return json({
    comments: (result.results || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      authorName: row.author_name,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedAt: row.approved_at,
    })),
  });
}
