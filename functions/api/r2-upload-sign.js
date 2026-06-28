const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });

const encoder = new TextEncoder();
const MAX_PRESIGN_EXPIRES = 60 * 10;
const DEFAULT_MAX_AUDIO_BYTES = 300 * 1024 * 1024;
const DEFAULT_AUDIO_CONTENT_TYPE = 'audio/mpeg';
const ALLOWED_AUDIO_CONTENT_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
]);

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');

const sha256Hex = async (input) => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(hash);
};

const hmac = async (keyBytes, message) => {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(sig);
};

const signKey = async (secret, yyyymmdd, region, service) => {
  const kDate = await hmac(encoder.encode(`AWS4${secret}`), yyyymmdd);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
};

const sanitizeFileBase = (name) =>
  String(name || 'audio')
    .trim()
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'audio';

const safeExt = (filename) => {
  const match = String(filename || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  if (!match) return 'mp3';
  const ext = match[1];
  const allow = new Set(['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac']);
  return allow.has(ext) ? ext : 'mp3';
};

const normalizeContentType = (value) => String(value || '').split(';')[0].trim().toLowerCase();

const toRfc3986 = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const buildCanonicalQuery = (query) =>
  Object.keys(query)
    .sort()
    .map((k) => `${toRfc3986(k)}=${toRfc3986(query[k])}`)
    .join('&');

const makeNow = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = now.getUTCFullYear();
  const m = pad(now.getUTCMonth() + 1);
  const d = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mm = pad(now.getUTCMinutes());
  const ss = pad(now.getUTCSeconds());
  return {
    yyyymmdd: `${y}${m}${d}`,
    amzDate: `${y}${m}${d}T${hh}${mm}${ss}Z`,
  };
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'POST, OPTIONS',
      },
    });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ error: 'Forbidden origin' }, 403);

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token) {
    return json({ error: 'Missing GitHub token' }, 401);
  }

  const repo = env.GITHUB_REPO || 'CBAIC888/crivu-blog';
  const ghRes = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'crivu-cms-oauth',
    },
  });
  if (ghRes.status === 401) return json({ error: 'Invalid GitHub token' }, 401);
  if (ghRes.status === 404) return json({ error: 'GitHub token lacks repo access' }, 403);
  if (!ghRes.ok) return json({ error: 'GitHub auth check failed' }, 502);
  let repoJson;
  try {
    repoJson = await ghRes.json();
  } catch {
    return json({ error: 'Invalid GitHub auth response' }, 502);
  }
  const permissions = repoJson && typeof repoJson === 'object' ? repoJson.permissions : null;
  const canWrite =
    permissions &&
    typeof permissions === 'object' &&
    (permissions.push === true || permissions.admin === true || permissions.maintain === true);
  if (!canWrite) {
    return json({ error: 'GitHub token lacks write access to this repo' }, 403);
  }

  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;
  const publicBase = String(env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    return json(
      {
        error:
          'Missing env vars. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL',
      },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const filename = String(body.filename || '');
  const requestedContentType = normalizeContentType(body.contentType);
  const size = Number(body.size || 0);
  const maxAudioBytes = Number(env.R2_MAX_AUDIO_BYTES || DEFAULT_MAX_AUDIO_BYTES);

  if (!filename) return json({ error: 'Missing filename' }, 400);
  if (!Number.isFinite(size) || size <= 0) return json({ error: 'Invalid file size' }, 400);
  if (size > maxAudioBytes) {
    return json(
      {
        error: `File too large. Max allowed is ${maxAudioBytes} bytes`,
      },
      413
    );
  }

  const now = makeNow();
  const region = 'auto';
  const service = 's3';
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const baseName = sanitizeFileBase(filename);
  const ext = safeExt(filename);
  if (requestedContentType && !ALLOWED_AUDIO_CONTENT_TYPES.has(requestedContentType)) {
    return json({ error: 'Unsupported content type. Only audio uploads are allowed.' }, 415);
  }
  const contentType = requestedContentType || DEFAULT_AUDIO_CONTENT_TYPE;
  const nonce = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const key = `audio/uploads/${now.yyyymmdd}/${baseName}-${nonce}.${ext}`;
  const credentialScope = `${now.yyyymmdd}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${bucket}/${key.split('/').map(toRfc3986).join('/')}`;

  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': now.amzDate,
    'X-Amz-Expires': String(MAX_PRESIGN_EXPIRES),
    'X-Amz-SignedHeaders': 'content-type;host',
  };

  const canonicalQuery = buildCanonicalQuery(query);
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = ['PUT', canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join(
    '\n'
  );
  const hashedCanonical = await sha256Hex(canonicalRequest);
  const stringToSign = ['AWS4-HMAC-SHA256', now.amzDate, credentialScope, hashedCanonical].join('\n');
  const keyBytes = await signKey(secretAccessKey, now.yyyymmdd, region, service);
  const signature = toHex(await hmac(keyBytes, stringToSign));

  const uploadUrl = `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  const publicUrl = `${publicBase}/${key}`;

  return json({
    uploadUrl,
    publicUrl,
    key,
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
  });
}
