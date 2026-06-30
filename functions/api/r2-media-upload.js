const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });

const encoder = new TextEncoder();
const MAX_PRESIGN_EXPIRES = 60 * 10;
const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const DEFAULT_IMAGE_CONTENT_TYPE = 'image/png';
const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const IMAGE_EXTENSIONS_BY_CONTENT_TYPE = {
  'image/jpeg': new Set(['jpg', 'jpeg']),
  'image/png': new Set(['png']),
  'image/webp': new Set(['webp']),
  'image/gif': new Set(['gif']),
  'image/avif': new Set(['avif']),
};

const bytesStartWith = (bytes, signature) => signature.every((byte, index) => bytes[index] === byte);

const asciiAt = (bytes, start, length) =>
  String.fromCharCode(...bytes.subarray(start, Math.min(bytes.length, start + length)));

const matchesImageSignature = (buffer, contentType) => {
  const bytes = new Uint8Array(buffer);
  if (contentType === 'image/jpeg') return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  if (contentType === 'image/png') return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (contentType === 'image/gif') return asciiAt(bytes, 0, 6) === 'GIF87a' || asciiAt(bytes, 0, 6) === 'GIF89a';
  if (contentType === 'image/webp') return asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP';
  if (contentType === 'image/avif') {
    if (asciiAt(bytes, 4, 4) !== 'ftyp') return false;
    const brands = asciiAt(bytes, 8, 32);
    return brands.includes('avif') || brands.includes('avis');
  }
  return false;
};

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
  String(name || 'image')
    .trim()
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'image';

const normalizeContentType = (value) => String(value || '').split(';')[0].trim().toLowerCase();

const fileExt = (filename) => {
  const match = String(filename || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return match ? match[1] : '';
};

const safeExt = (filename, contentType) => {
  const ext = fileExt(filename);
  const allowed = IMAGE_EXTENSIONS_BY_CONTENT_TYPE[contentType] || IMAGE_EXTENSIONS_BY_CONTENT_TYPE[DEFAULT_IMAGE_CONTENT_TYPE];
  if (allowed.has(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  if (contentType === 'image/avif') return 'avif';
  return 'png';
};

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

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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

  let repoJson;
  try {
    repoJson = await ghRes.json();
  } catch {
    return { ok: false, status: 502, error: 'Invalid GitHub auth response' };
  }

  const permissions = repoJson && typeof repoJson === 'object' ? repoJson.permissions : null;
  const canWrite =
    permissions &&
    typeof permissions === 'object' &&
    (permissions.push === true || permissions.admin === true || permissions.maintain === true);

  if (!canWrite) return { ok: false, status: 403, error: 'GitHub token lacks write access to this repo' };
  return { ok: true };
};

const makeImageKey = (filename, contentType, now = makeNow()) => {
  const baseName = sanitizeFileBase(filename);
  const ext = safeExt(filename, contentType);
  const nonce = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  return `images/uploads/${now.yyyymmdd}/${baseName}-${nonce}.${ext}`;
};

const uploadToGithubMedia = async ({ bytes, contentType, env, filename, token }) => {
  const repo = env.GITHUB_REPO || 'CBAIC888/crivu-blog';
  const branch = env.GITHUB_BRANCH || 'main';
  const key = makeImageKey(filename, contentType);
  const repoPath = `assets/img/uploads/${key.replace(/^images\/uploads\//, '')}`;
  const uploadRes = await fetch(`https://api.github.com/repos/${repo}/contents/${repoPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'crivu-cms-oauth',
    },
    body: JSON.stringify({
      message: `media: upload '${repoPath}'`,
      content: arrayBufferToBase64(bytes),
      branch,
    }),
  });

  let uploadJson = {};
  try {
    uploadJson = await uploadRes.json();
  } catch {
    uploadJson = {};
  }

  if (!uploadRes.ok) {
    const message = uploadJson.message || `GitHub media upload failed (${uploadRes.status})`;
    return { ok: false, status: uploadRes.status >= 500 ? 502 : uploadRes.status, error: message };
  }

  return {
    ok: true,
    publicUrl: `/${repoPath}`,
    key: repoPath,
    sitePath: `/${repoPath}`,
    storage: 'github',
  };
};

const createSignedPutUrl = async ({ env, filename, contentType }) => {
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;
  const publicBase = String(env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    throw new Error(
      'Missing env vars. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL'
    );
  }

  const now = makeNow();
  const region = 'auto';
  const service = 's3';
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const key = makeImageKey(filename, contentType, now);
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

  return {
    uploadUrl: `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    publicUrl: `${publicBase}/${key}`,
    key,
  };
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ error: 'Forbidden origin' }, 403);

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  const auth = await verifyCmsToken(token, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Invalid multipart form data' }, 400);
  }

  const file = form.get('file');
  if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
    return json({ error: 'Missing image file' }, 400);
  }

  const filename = String(file.name || form.get('filename') || 'image.png');
  const contentType = normalizeContentType(file.type) || DEFAULT_IMAGE_CONTENT_TYPE;
  const size = Number(file.size || 0);
  const maxImageBytes = Number(env.R2_MAX_IMAGE_BYTES || DEFAULT_MAX_IMAGE_BYTES);

  if (!Number.isFinite(size) || size <= 0) return json({ error: 'Invalid file size' }, 400);
  if (size > maxImageBytes) return json({ error: `Image too large. Max allowed is ${maxImageBytes} bytes` }, 413);
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) return json({ error: 'Unsupported image content type' }, 415);
  const extFromName = fileExt(filename);
  const allowedExts = IMAGE_EXTENSIONS_BY_CONTENT_TYPE[contentType] || IMAGE_EXTENSIONS_BY_CONTENT_TYPE[DEFAULT_IMAGE_CONTENT_TYPE];
  if (extFromName && !allowedExts.has(extFromName)) {
    return json({ error: 'Image file extension does not match its content type.' }, 415);
  }

  const bytes = await file.arrayBuffer();
  if (!matchesImageSignature(bytes, contentType)) return json({ error: 'Image file content does not match its type' }, 415);

  let signed;
  try {
    signed = await createSignedPutUrl({ env, filename, contentType });
  } catch (err) {
    const fallback = await uploadToGithubMedia({ bytes, contentType, env, filename, token });
    if (!fallback.ok) {
      return json(
        {
          error: fallback.error || '圖片上傳失敗',
          detail: err && err.message ? `R2 unavailable: ${err.message}` : 'R2 unavailable',
        },
        fallback.status || 502
      );
    }
    return json({
      publicUrl: fallback.publicUrl,
      key: fallback.key,
      sitePath: fallback.sitePath,
      name: filename,
      size,
      contentType,
      storage: fallback.storage,
    });
  }

  const putRes = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: bytes,
  });

  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '');
    return json({ error: `R2 upload failed (${putRes.status})`, detail: detail.slice(0, 500) }, 502);
  }

  return json({
    publicUrl: signed.publicUrl,
    key: signed.key,
    name: filename,
    size,
    contentType,
    storage: 'r2',
  });
}
