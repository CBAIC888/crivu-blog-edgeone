const MAX_NAME_LENGTH = 32;
const MAX_BODY_LENGTH = 1200;
const MAX_EMAIL_LENGTH = 160;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_MAX = 5;
const MAIN_ORIGIN = 'https://cbc688.com';
const ALLOWED_ORIGINS = new Set([
  'https://cbc688.com',
  'https://www.cbc688.com',
  'https://eo.cbc688.com',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
]);

const encoder = new TextEncoder();

const json = (data, status = 200, request) =>
  new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders(request),
  });

const jsonHeaders = (request) => {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  });
  const origin = request?.headers?.get('Origin') || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Vary', 'Origin');
  }
  return headers;
};

const normalizeText = (value, maxLength) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const isValidSlug = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(String(value || ''));

const isValidEmail = (value) => {
  const email = normalizeText(value, MAX_EMAIL_LENGTH);
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

const sha256Hex = async (value) => {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(String(value || '')));
  return toHex(hash);
};

const hashPrivateValue = async (value, env) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const salt = env.COMMENT_HASH_SALT || env.TURNSTILE_SECRET_KEY || 'crivu-comments-v1';
  return sha256Hex(`${salt}:${raw}`);
};

const clientIp = (request) =>
  request.headers.get('CF-Connecting-IP') ||
  request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
  '';

const makeId = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `c_${toHex(bytes)}`;
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_email_hash TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden', 'spam')),
    source TEXT NOT NULL DEFAULT 'public',
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

const getDb = (env) => env.COMMENTS_DB || null;

const ensureSchema = async (db) => {
  for (const statement of schemaStatements) {
    await db.prepare(statement).run();
  }
  const hasSourceColumn = async () => {
    const columns = await db.prepare(`PRAGMA table_info(comments)`).all();
    return (columns.results || []).some((column) => column.name === 'source');
  };
  if (!(await hasSourceColumn())) {
    try {
      await db.prepare(`ALTER TABLE comments ADD COLUMN source TEXT NOT NULL DEFAULT 'public'`).run();
    } catch (err) {
      if (!(await hasSourceColumn())) throw err;
    }
  }
};

const turnstileConfigured = (env) => Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);

const submissionsEnabled = (env) =>
  Boolean(getDb(env) && (turnstileConfigured(env) || env.COMMENTS_ALLOW_UNVERIFIED === 'true'));

const verifyTurnstile = async ({ env, request, token }) => {
  if (env.COMMENTS_ALLOW_UNVERIFIED === 'true') return { ok: true };
  if (!env.TURNSTILE_SECRET_KEY) return { ok: false, error: 'Comments are not accepting submissions yet' };
  if (!token) return { ok: false, error: 'Missing verification token' };

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  const ip = clientIp(request);
  if (ip) form.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return data && data.success ? { ok: true } : { ok: false, error: 'Verification failed' };
};

const notifyTelegram = async ({ env, slug, authorName, body }) => {
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) return;

  const excerpt = normalizeText(body, 280);
  const text = [
    'CRIVU 有新評論待審核',
    '',
    `位置：${slug}`,
    `稱呼：${authorName}`,
    '',
    excerpt,
    '',
    '審核：https://cbc688.com/admin',
  ].join('\n');

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
};

const handleConfig = (env, request) =>
  json(
    {
      enabled: Boolean(getDb(env)),
      submissionEnabled: submissionsEnabled(env),
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
      moderation: 'manual',
      apiOrigin: MAIN_ORIGIN,
    },
    200,
    request
  );

const listComments = async (env, request, slug) => {
  const db = getDb(env);
  if (!db) return json({ enabled: false, comments: [] }, 200, request);
  if (!isValidSlug(slug)) return json({ error: 'Invalid article slug' }, 400, request);

  await ensureSchema(db);
  const result = await db
    .prepare(
      `SELECT id, author_name, body, created_at
       FROM comments
       WHERE slug = ? AND status = 'approved'
       ORDER BY created_at ASC
       LIMIT 100`
    )
    .bind(slug)
    .all();

  const comments = (result.results || []).map((row) => ({
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  }));

  return json({ enabled: true, comments }, 200, request);
};

const createComment = async (env, request, context) => {
  const db = getDb(env);
  if (!db) return json({ error: 'Comments are not configured' }, 503, request);
  if (!submissionsEnabled(env)) return json({ error: 'Comments are not accepting submissions yet' }, 503, request);

  const origin = request.headers.get('Origin') || '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403, request);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, request);
  }

  if (normalizeText(payload.website, 200)) return json({ ok: true, status: 'pending' }, 202, request);

  const slug = normalizeText(payload.slug, 80);
  const authorName = normalizeText(payload.authorName, MAX_NAME_LENGTH);
  const email = normalizeText(payload.email, MAX_EMAIL_LENGTH).toLowerCase();
  const body = normalizeText(payload.body, MAX_BODY_LENGTH);

  if (!isValidSlug(slug)) return json({ error: 'Invalid article slug' }, 400, request);
  if (authorName.length < 1) return json({ error: 'Please enter a name' }, 400, request);
  if (body.length < 2) return json({ error: 'Please enter a comment' }, 400, request);
  if (!isValidEmail(email)) return json({ error: 'Invalid email address' }, 400, request);

  const turnstile = await verifyTurnstile({
    env,
    request,
    token: payload.turnstileToken || payload['cf-turnstile-response'],
  });
  if (!turnstile.ok) return json({ error: turnstile.error || 'Verification failed' }, 403, request);

  await ensureSchema(db);
  const ipHash = await hashPrivateValue(clientIp(request), env);
  const userAgentHash = await hashPrivateValue(request.headers.get('User-Agent') || '', env);
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();

  if (ipHash) {
    const recent = await db
      .prepare(`SELECT COUNT(*) AS count FROM comments WHERE ip_hash = ? AND created_at >= ?`)
      .bind(ipHash, since)
      .first();
    if (Number(recent?.count || 0) >= RATE_LIMIT_MAX) {
      return json({ error: 'Too many comments. Please try later.' }, 429, request);
    }
  }

  const id = makeId();
  const emailHash = email ? await hashPrivateValue(email, env) : '';
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO comments
       (id, slug, author_name, author_email_hash, body, status, source, ip_hash, user_agent_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 'public', ?, ?, ?, ?)`
    )
    .bind(id, slug, authorName, emailHash, body, ipHash, userAgentHash, now, now)
    .run();

  const notification = notifyTelegram({ env, slug, authorName, body }).catch(() => {});
  if (typeof context?.waitUntil === 'function') {
    context.waitUntil(notification);
  } else {
    await notification;
  }

  return json({ ok: true, status: 'pending' }, 202, request);
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: jsonHeaders(request) });

  const url = new URL(request.url);
  if (request.method === 'GET' && url.searchParams.get('config') === '1') {
    return handleConfig(env, request);
  }
  if (request.method === 'GET') {
    return listComments(env, request, url.searchParams.get('slug') || '');
  }
  if (request.method === 'POST') {
    return createComment(env, request, context);
  }
  return json({ error: 'Method not allowed' }, 405, request);
}
