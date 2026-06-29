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
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  const auth = await verifyCmsToken(bearerToken(request), env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const db = env.COMMENTS_DB;
  if (!db) return json({ error: 'Comments database is not configured' }, 503);
  await ensureSchema(db);

  const id = String(params.id || '').trim();
  if (!/^c_[a-f0-9]{24}$/.test(id)) return json({ error: 'Invalid comment id' }, 400);

  if (request.method === 'PATCH') {
    const payload = await request.json().catch(() => ({}));
    const status = String(payload.status || '').trim();
    if (!ALLOWED_STATUSES.has(status)) return json({ error: 'Invalid status' }, 400);

    const now = new Date().toISOString();
    const approvedAt = status === 'approved' ? now : null;
    const result = await db
      .prepare(`UPDATE comments SET status = ?, updated_at = ?, approved_at = ? WHERE id = ?`)
      .bind(status, now, approvedAt, id)
      .run();

    if (!result.meta || result.meta.changes === 0) return json({ error: 'Comment not found' }, 404);
    return json({ ok: true, status });
  }

  if (request.method === 'DELETE') {
    const result = await db.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run();
    if (!result.meta || result.meta.changes === 0) return json({ error: 'Comment not found' }, 404);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
