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

  const read = await readGithubJson(env, paths.RECORDS_PATH, { records: [] });
  if (!read.ok) return read.response;

  const items = (Array.isArray(read.data.records) ? read.data.records : []).map((record) => ({
    id: record.id || '',
    title: record.title || '',
    summary: record.summary || '',
    published: record.published === true,
  }));

  return json({ items }, 200);
}
