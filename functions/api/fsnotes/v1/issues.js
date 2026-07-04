import {
  error,
  json,
  noContent,
  paths,
  readGithubJson,
  verifyPublishToken,
} from './_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'GET') return error(405, 'method_not_allowed', 'Method not allowed.');

  const auth = await verifyPublishToken(request, env);
  if (!auth.ok) return auth.response;

  const read = await readGithubJson(env, paths.ISSUES_PATH, { issues: [] });
  if (!read.ok) return read.response;

  const items = (Array.isArray(read.data.issues) ? read.data.issues : []).map((issue) => ({
    id: issue.id || '',
    title: issue.title || '',
    theme: issue.theme || '',
    publishDate: issue.publishDate || '',
    published: issue.published !== false,
  }));

  return json({ items }, 200);
}
