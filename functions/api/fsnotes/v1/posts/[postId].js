import {
  commitGithubFiles,
  error,
  json,
  makePostResponse,
  noContent,
  normalizePostPayload,
  nowInShanghai,
  parseJsonBody,
  paths,
  postRevision,
  readGithubJson,
  syncIssueMembership,
  verifyPublishToken,
} from '../_shared.js';

const findPostIndex = (posts, postId) => posts.findIndex((post) => post?.id === postId);

const loadPostsAndIssues = async (env) => {
  const [postsRead, issuesRead] = await Promise.all([
    readGithubJson(env, paths.POSTS_PATH, { items: [] }),
    readGithubJson(env, paths.ISSUES_PATH, { issues: [] }),
  ]);
  if (!postsRead.ok) return { ok: false, response: postsRead.response };
  if (!issuesRead.ok) return { ok: false, response: issuesRead.response };
  const postsData = postsRead.data;
  const posts = Array.isArray(postsData.items) ? postsData.items : Array.isArray(postsData) ? postsData : [];
  return { ok: true, postsData, posts, issuesData: issuesRead.data };
};

const ensureRevision = async (request, post) => {
  const expected = request.headers.get('If-Match') || '';
  if (!expected) return { ok: false, response: error(428, 'precondition_required', 'If-Match revision is required.') };
  const current = await postRevision(post);
  if (expected !== current) return { ok: false, response: error(409, 'revision_conflict', 'Remote article has changed.', { revision: current }) };
  return { ok: true };
};

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (!['PATCH', 'DELETE'].includes(request.method)) return error(405, 'method_not_allowed', 'Method not allowed.');

  const auth = await verifyPublishToken(request, env);
  if (!auth.ok) return auth.response;

  const postId = String(params?.postId || '').trim();
  if (!postId) return error(404, 'post_not_found', 'Article does not exist.');

  const loaded = await loadPostsAndIssues(env);
  if (!loaded.ok) return loaded.response;

  const index = findPostIndex(loaded.posts, postId);
  if (index === -1) return error(404, 'post_not_found', 'Article does not exist.');

  const currentPost = loaded.posts[index];

  if (request.method === 'PATCH') {
    const revision = await ensureRevision(request, currentPost);
    if (!revision.ok) return revision.response;

    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const normalized = await normalizePostPayload(parsed.body, loaded.posts, currentPost);
    if (!normalized.ok) return normalized.response;

    const nextPost = normalized.post;
    const issueSync = syncIssueMembership(loaded.issuesData, currentPost, nextPost);
    if (!issueSync.ok) return issueSync.response;

    const nextPosts = [...loaded.posts];
    nextPosts[index] = nextPost;
    const nextPostsData = { ...loaded.postsData, items: nextPosts };
    const commit = await commitGithubFiles(
      env,
      [
        { path: paths.POSTS_PATH, content: `${JSON.stringify(nextPostsData, null, 2)}\n` },
        { path: paths.ISSUES_PATH, content: `${JSON.stringify(issueSync.issuesData, null, 2)}\n` },
      ],
      `content: update fsnotes post '${nextPost.slug}'`
    );
    if (!commit.ok) return commit.response;

    return json(await makePostResponse(nextPost, env, commit.commitSha), 200);
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'unpublish';
  if (mode !== 'unpublish') return error(403, 'delete_not_allowed', 'Only mode=unpublish is allowed for FSNotes.');

  const nextPost = {
    ...currentPost,
    published: false,
    updatedAt: nowInShanghai(),
  };
  const nextPosts = [...loaded.posts];
  nextPosts[index] = nextPost;
  const nextPostsData = { ...loaded.postsData, items: nextPosts };
  const commit = await commitGithubFiles(
    env,
    [{ path: paths.POSTS_PATH, content: `${JSON.stringify(nextPostsData, null, 2)}\n` }],
    `content: unpublish fsnotes post '${nextPost.slug}'`
  );
  if (!commit.ok) return commit.response;

  return json(await makePostResponse(nextPost, env, commit.commitSha), 200);
}
