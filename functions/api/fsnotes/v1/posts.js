import {
  commitGithubFiles,
  createBodyHash,
  error,
  findIdempotentPost,
  idempotencyKey,
  json,
  makePostListItem,
  makePostResponse,
  noContent,
  normalizePostPayload,
  parseJsonBody,
  paths,
  readGithubJson,
  sha256Hex,
  syncIssueMembership,
  verifyPublishToken,
} from './_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (!['GET', 'POST'].includes(request.method)) return error(405, 'method_not_allowed', 'Method not allowed.');

  const auth = await verifyPublishToken(request, env);
  if (!auth.ok) return auth.response;

  if (request.method === 'GET') {
    const postsRead = await readGithubJson(env, paths.POSTS_PATH, { items: [] });
    if (!postsRead.ok) return postsRead.response;

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    if (!['all', 'draft', 'published'].includes(status)) {
      return error(422, 'validation_failed', 'status must be all, draft, or published.', { field: 'status' });
    }

    const postsData = postsRead.data;
    const posts = Array.isArray(postsData.items) ? postsData.items : Array.isArray(postsData) ? postsData : [];
    const filtered = posts.filter((post) => {
      const published = post?.published !== false;
      if (status === 'published') return published;
      if (status === 'draft') return !published;
      return true;
    });
    const items = await Promise.all(filtered.map((post) => makePostListItem(post, env)));
    return json({ items, total: items.length }, 200);
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const [postsRead, issuesRead] = await Promise.all([
    readGithubJson(env, paths.POSTS_PATH, { items: [] }),
    readGithubJson(env, paths.ISSUES_PATH, { issues: [] }),
  ]);
  if (!postsRead.ok) return postsRead.response;
  if (!issuesRead.ok) return issuesRead.response;

  const postsData = postsRead.data;
  const posts = Array.isArray(postsData.items) ? postsData.items : Array.isArray(postsData) ? postsData : [];
  const key = idempotencyKey(request);
  const bodyHash = await createBodyHash(parsed.body);
  const keyHash = key ? await sha256Hex(`${auth.token}:${key}`) : '';
  const idempotent = await findIdempotentPost(posts, keyHash, bodyHash);
  if (idempotent.conflict) return error(409, 'idempotency_conflict', 'Idempotency-Key was already used with a different body.');
  if (idempotent.found) return json(await makePostResponse(idempotent.post, env), 200);

  const normalized = await normalizePostPayload(parsed.body, posts);
  if (!normalized.ok) return normalized.response;

  const post = {
    ...normalized.post,
    _fsnotes: keyHash
      ? {
          createKeyHash: keyHash,
          createBodyHash: bodyHash,
          createdAtMs: Date.now(),
        }
      : undefined,
  };
  if (!post._fsnotes) delete post._fsnotes;

  const issueSync = syncIssueMembership(issuesRead.data, null, post);
  if (!issueSync.ok) return issueSync.response;

  const nextPostsData = { ...postsData, items: [post, ...posts] };
  const commit = await commitGithubFiles(
    env,
    [
      { path: paths.POSTS_PATH, content: `${JSON.stringify(nextPostsData, null, 2)}\n` },
      { path: paths.ISSUES_PATH, content: `${JSON.stringify(issueSync.issuesData, null, 2)}\n` },
    ],
    `content: create fsnotes post '${post.slug}'`
  );
  if (!commit.ok) return commit.response;

  return json(await makePostResponse(post, env, commit.commitSha), 201);
}
