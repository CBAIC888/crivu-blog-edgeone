const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

const SITE_ORIGIN = 'https://cbc688.com';
const DEFAULT_REPO = 'CBAIC888/crivu-blog';
const DEFAULT_BRANCH = 'main';
const POSTS_PATH = 'posts/posts.json';
const ISSUES_PATH = 'posts/issues.json';
const RECORDS_PATH = 'posts/records.json';
const MAX_ARTICLE_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

const IMAGE_CONTENT_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/avif', 'avif'],
]);

export const paths = {
  POSTS_PATH,
  ISSUES_PATH,
  RECORDS_PATH,
};

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: JSON_HEADERS,
  });

export const noContent = () =>
  new Response(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, PATCH, DELETE, OPTIONS',
      'Cache-Control': 'no-store, max-age=0',
    },
  });

export const error = (status, code, message, extra = {}) => json({ error: code, message, ...extra }, status);

export const bearerToken = (request) => {
  const value = request.headers.get('Authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

export const timingSafeEqual = async (a, b) => {
  const left = new TextEncoder().encode(String(a || ''));
  const right = new TextEncoder().encode(String(b || ''));
  const size = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < size; i += 1) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
};

export const verifyPublishToken = async (request, env) => {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: error(401, 'unauthorized', 'Missing bearer token.') };

  const candidates = [env.FSNOTES_PUBLISH_TOKEN, env.FSNOTES_PUBLISH_TOKEN_TEST].filter(Boolean);
  if (!candidates.length) {
    return { ok: false, response: error(503, 'token_not_configured', 'FSNotes publish token is not configured.') };
  }

  for (const candidate of candidates) {
    if (await timingSafeEqual(token, candidate)) return { ok: true, token };
  }

  return { ok: false, response: error(401, 'unauthorized', 'Invalid bearer token.') };
};

export const githubToken = (env) =>
  env.FSNOTES_GITHUB_TOKEN || env.GITHUB_CONTENT_TOKEN || env.GITHUB_TOKEN || '';

export const githubConfig = (env) => ({
  repo: env.GITHUB_REPO || DEFAULT_REPO,
  branch: env.GITHUB_BRANCH || DEFAULT_BRANCH,
  token: githubToken(env),
});

export const githubRequest = async (env, path, options = {}) => {
  const config = githubConfig(env);
  if (!config.token) {
    return {
      ok: false,
      status: 503,
      json: { error: 'github_token_not_configured', message: 'GitHub write token is not configured.' },
    };
  }

  const res = await fetch(`https://api.github.com/repos/${config.repo}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'crivu-fsnotes-publish',
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  return { ok: res.ok, status: res.status, json: body };
};

const base64ToUtf8 = (value) => {
  const cleaned = String(value || '').replace(/\s/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

export const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

export const readGithubJson = async (env, filePath, fallback) => {
  const { branch } = githubConfig(env);
  const res = await githubRequest(env, `/contents/${encodeURIComponent(filePath).replaceAll('%2F', '/')}?ref=${encodeURIComponent(branch)}`, {
    method: 'GET',
  });
  if (res.status === 404) return { ok: true, data: fallback };
  if (!res.ok) return { ok: false, response: error(res.status >= 500 ? 502 : res.status, 'github_read_failed', res.json.message || 'Failed to read GitHub content.') };

  try {
    return { ok: true, data: JSON.parse(base64ToUtf8(res.json.content || '')) };
  } catch {
    return { ok: false, response: error(502, 'invalid_github_json', `${filePath} is not valid JSON.`) };
  }
};

export const commitGithubFiles = async (env, files, message) => {
  const { branch } = githubConfig(env);
  const ref = await githubRequest(env, `/git/ref/heads/${encodeURIComponent(branch)}`, { method: 'GET' });
  if (!ref.ok) return { ok: false, response: error(ref.status >= 500 ? 502 : ref.status, 'github_ref_failed', ref.json.message || 'Failed to read GitHub ref.') };

  const parentSha = ref.json.object?.sha;
  if (!parentSha) return { ok: false, response: error(502, 'github_ref_invalid', 'GitHub ref response did not include a commit SHA.') };

  const parentCommit = await githubRequest(env, `/git/commits/${parentSha}`, { method: 'GET' });
  if (!parentCommit.ok) return { ok: false, response: error(parentCommit.status >= 500 ? 502 : parentCommit.status, 'github_commit_read_failed', parentCommit.json.message || 'Failed to read GitHub commit.') };

  const treeItems = [];
  for (const file of files) {
    const blobBody = file.encoding === 'base64'
      ? { content: file.content, encoding: 'base64' }
      : { content: file.content, encoding: 'utf-8' };
    const blob = await githubRequest(env, '/git/blobs', {
      method: 'POST',
      body: JSON.stringify(blobBody),
    });
    if (!blob.ok) return { ok: false, response: error(blob.status >= 500 ? 502 : blob.status, 'github_blob_failed', blob.json.message || `Failed to create blob for ${file.path}.`) };
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.json.sha,
    });
  }

  const tree = await githubRequest(env, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parentCommit.json.tree?.sha,
      tree: treeItems,
    }),
  });
  if (!tree.ok) return { ok: false, response: error(tree.status >= 500 ? 502 : tree.status, 'github_tree_failed', tree.json.message || 'Failed to create Git tree.') };

  const commit = await githubRequest(env, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.json.sha,
      parents: [parentSha],
    }),
  });
  if (!commit.ok) return { ok: false, response: error(commit.status >= 500 ? 502 : commit.status, 'github_commit_failed', commit.json.message || 'Failed to create Git commit.') };

  const update = await githubRequest(env, `/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: commit.json.sha,
      force: false,
    }),
  });
  if (!update.ok) {
    const status = update.status === 422 ? 409 : update.status >= 500 ? 502 : update.status;
    return { ok: false, response: error(status, status === 409 ? 'revision_conflict' : 'github_ref_update_failed', update.json.message || 'Failed to update GitHub ref.') };
  }

  return { ok: true, commitSha: commit.json.sha };
};

export const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const sha256Hex = async (value) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const publicPostForRevision = (post) => {
  const copy = { ...(post || {}) };
  delete copy._fsnotes;
  return copy;
};

export const postRevision = async (post) => sha256Hex(stableStringify(publicPostForRevision(post)));

export const nowInShanghai = () => {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}+08:00`;
};

export const datePrefix = (dateValue = nowInShanghai()) => {
  const raw = String(dateValue || '');
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return nowInShanghai().slice(0, 10).replaceAll('-', '');
  return `${match[1]}${match[2]}${match[3]}`;
};

export const cleanText = (value, maxLength = 200) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

export const cleanLongText = (value, maxBytes = MAX_ARTICLE_BYTES) => {
  const text = String(value ?? '').replace(/\r\n/g, '\n');
  if (new TextEncoder().encode(text).byteLength > maxBytes) return null;
  return text;
};

export const cleanStringArray = (value, maxItems = 30, maxLength = 40) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const text = cleanText(item, maxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
};

export const isValidSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ''));

export const makeId = async (prefix = 'post') => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
};

export const makeSlug = async ({ date, markdown, title }, posts) => {
  const seed = `${title}\n${markdown}\n${Date.now()}\n${crypto.randomUUID()}`;
  const hash = (await sha256Hex(seed)).slice(0, 8);
  const base = `${datePrefix(date)}-${hash}`;
  if (!posts.some((post) => post.slug === base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base}-${i}`;
    if (!posts.some((post) => post.slug === candidate)) return candidate;
  }
  return `${base}-${crypto.randomUUID().replaceAll('-', '').slice(0, 4)}`;
};

export const articleUrl = (slug, env) => {
  const origin = String(env.SITE_ORIGIN || SITE_ORIGIN).replace(/\/$/, '');
  return `${origin}/articles/${encodeURIComponent(slug)}`;
};

export const editUrl = (env) => `${String(env.SITE_ORIGIN || SITE_ORIGIN).replace(/\/$/, '')}/admin/#/collections/posts/entries/posts`;

export const normalizePostPayload = async (payload, posts, currentPost = null) => {
  const title = Object.prototype.hasOwnProperty.call(payload, 'title') ? cleanText(payload.title, 160) : currentPost?.title;
  const markdownInput = Object.prototype.hasOwnProperty.call(payload, 'markdown') ? payload.markdown : undefined;
  const markdown = markdownInput === undefined ? currentPost?.body : cleanLongText(markdownInput);
  const status = Object.prototype.hasOwnProperty.call(payload, 'status') ? String(payload.status || '') : currentPost?.published === true ? 'published' : 'draft';
  const date = Object.prototype.hasOwnProperty.call(payload, 'date') && cleanText(payload.date, 40) ? cleanText(payload.date, 40) : currentPost?.date || nowInShanghai();
  const slugInput = Object.prototype.hasOwnProperty.call(payload, 'slug') ? cleanText(payload.slug, 100).toLowerCase() : '';
  const slug = slugInput || currentPost?.slug || (await makeSlug({ date, markdown, title }, posts));

  if (!title) return { ok: false, response: error(422, 'validation_failed', 'title is required.', { field: 'title' }) };
  if (markdown === null) return { ok: false, response: error(413, 'article_too_large', 'markdown is too large.', { field: 'markdown' }) };
  if (markdown === undefined || markdown === null) return { ok: false, response: error(422, 'validation_failed', 'markdown is required.', { field: 'markdown' }) };
  if (!['draft', 'published'].includes(status)) return { ok: false, response: error(422, 'validation_failed', 'status must be draft or published.', { field: 'status' }) };
  if (!isValidSlug(slug)) return { ok: false, response: error(422, 'validation_failed', 'slug must contain lowercase letters, numbers, and hyphens only.', { field: 'slug' }) };

  const ownerId = currentPost?.id || '';
  if (posts.some((post) => post.slug === slug && post.id !== ownerId)) {
    return { ok: false, response: error(409, 'slug_conflict', 'Slug already exists.', { field: 'slug' }) };
  }

  const post = {
    ...(currentPost || {}),
    id: ownerId || (await makeId('post')),
    published: status === 'published',
    title,
    slug,
    date,
    updatedAt: nowInShanghai(),
    body: markdown,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'plainText')) post.plainText = cleanLongText(payload.plainText, MAX_ARTICLE_BYTES) || '';
  if (Object.prototype.hasOwnProperty.call(payload, 'excerpt')) post.excerpt = cleanText(payload.excerpt, 500);
  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) post.tags = cleanStringArray(payload.tags);
  if (Object.prototype.hasOwnProperty.call(payload, 'category')) post.category = cleanText(payload.category, 80);
  if (Object.prototype.hasOwnProperty.call(payload, 'cover')) post.cover = cleanText(payload.cover, 300);
  if (Object.prototype.hasOwnProperty.call(payload, 'issue')) post.issue = cleanText(payload.issue, 80);
  if (Object.prototype.hasOwnProperty.call(payload, 'language')) post.language = cleanText(payload.language, 20) || 'zh-Hant';
  if (Object.prototype.hasOwnProperty.call(payload, 'canonicalUrl')) post.canonicalUrl = cleanText(payload.canonicalUrl, 300);
  if (!Object.prototype.hasOwnProperty.call(post, 'tags')) post.tags = [];
  if (!Object.prototype.hasOwnProperty.call(post, 'language')) post.language = 'zh-Hant';

  return { ok: true, post, status };
};

export const syncIssueMembership = (issuesData, previousPost, nextPost) => {
  const issues = Array.isArray(issuesData?.issues) ? issuesData.issues : [];
  const previousSlug = previousPost?.slug || '';
  const nextSlug = nextPost?.slug || '';
  const previousIssue = previousPost?.issue || '';
  const nextIssue = nextPost?.issue || '';

  if (nextIssue && !issues.some((issue) => issue.id === nextIssue)) {
    return { ok: false, response: error(422, 'invalid_issue', 'Issue does not exist.', { field: 'issue' }) };
  }

  for (const issue of issues) {
    if (!Array.isArray(issue.posts)) issue.posts = [];
    issue.posts = issue.posts.map((slug) => (slug === previousSlug && nextSlug ? nextSlug : slug));
    if (previousIssue && previousIssue !== nextIssue && issue.id === previousIssue) {
      issue.posts = issue.posts.filter((slug) => slug !== previousSlug && slug !== nextSlug);
    }
  }

  if (nextIssue && nextSlug) {
    const issue = issues.find((item) => item.id === nextIssue);
    if (issue && !issue.posts.includes(nextSlug)) issue.posts.unshift(nextSlug);
  }

  return { ok: true, issuesData: { ...issuesData, issues } };
};

export const makePostResponse = async (post, env, commitSha = '') => {
  const status = post.published === true ? 'published' : 'draft';
  return {
    postId: post.id,
    slug: post.slug,
    publicUrl: status === 'published' ? articleUrl(post.slug, env) : null,
    editUrl: editUrl(env),
    previewUrl: null,
    status,
    publishedAt: status === 'published' ? post.date || null : null,
    updatedAt: post.updatedAt || null,
    revision: await postRevision(post),
    commitSha,
  };
};

export const parseJsonBody = async (request) => {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: error(400, 'invalid_json', 'Request body must be valid JSON.') };
  }
};

export const idempotencyKey = (request) => cleanText(request.headers.get('Idempotency-Key') || '', 120);

export const createBodyHash = async (payload) => sha256Hex(stableStringify(payload));

export const findIdempotentPost = async (posts, keyHash, bodyHash) => {
  if (!keyHash) return { found: false };
  const now = Date.now();
  for (const post of posts) {
    const meta = post?._fsnotes;
    if (!meta || meta.createKeyHash !== keyHash) continue;
    if (meta.createdAtMs && now - Number(meta.createdAtMs) > IDEMPOTENCY_WINDOW_MS) continue;
    if (meta.createBodyHash !== bodyHash) return { conflict: true };
    return { found: true, post };
  }
  return { found: false };
};

export const imageExtension = (contentType) => IMAGE_CONTENT_TYPES.get(String(contentType || '').toLowerCase()) || '';

export const isAllowedImage = (contentType) => IMAGE_CONTENT_TYPES.has(String(contentType || '').toLowerCase());

export const maxImageBytes = (env) => Number(env.FSNOTES_MAX_IMAGE_BYTES || MAX_IMAGE_BYTES);
