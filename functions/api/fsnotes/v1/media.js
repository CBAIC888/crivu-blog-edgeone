import {
  arrayBufferToBase64,
  commitGithubFiles,
  datePrefix,
  error,
  imageExtension,
  isAllowedImage,
  json,
  maxImageBytes,
  noContent,
  sha256Hex,
  verifyPublishToken,
} from './_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return noContent();
  if (request.method !== 'POST') return error(405, 'method_not_allowed', 'Method not allowed.');

  const auth = await verifyPublishToken(request, env);
  if (!auth.ok) return auth.response;

  let form;
  try {
    form = await request.formData();
  } catch {
    return error(400, 'invalid_multipart', 'Request must be multipart/form-data.');
  }

  const kind = String(form.get('kind') || 'image').trim() || 'image';
  if (kind !== 'image') return error(422, 'unsupported_kind', 'Only image media uploads are supported in v1.', { field: 'kind' });

  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return error(422, 'validation_failed', 'file is required.', { field: 'file' });

  const contentType = String(file.type || '').split(';')[0].trim().toLowerCase();
  if (!isAllowedImage(contentType)) return error(415, 'unsupported_media_type', 'Only jpeg, png, webp, gif, and avif images are allowed.');

  const size = Number(file.size || 0);
  const maxBytes = maxImageBytes(env);
  if (!Number.isFinite(size) || size <= 0) return error(422, 'validation_failed', 'file is empty.', { field: 'file' });
  if (size > maxBytes) return error(413, 'file_too_large', `Image exceeds ${maxBytes} bytes.`);

  const buffer = await file.arrayBuffer();
  const hash = await sha256Hex(buffer);
  const ext = imageExtension(contentType);
  const day = datePrefix();
  const filename = `${hash.slice(0, 12)}.${ext}`;
  const repoPath = `assets/img/uploads/${day}/${filename}`;
  const publicUrl = `/${repoPath}`;
  const origin = String(env.SITE_ORIGIN || 'https://cbc688.com').replace(/\/$/, '');

  const commit = await commitGithubFiles(
    env,
    [{ path: repoPath, content: arrayBufferToBase64(buffer), encoding: 'base64' }],
    `media: upload fsnotes image '${repoPath}'`
  );
  if (!commit.ok) return commit.response;

  return json(
    {
      mediaId: `${day}/${filename}`,
      publicUrl,
      absoluteUrl: `${origin}${publicUrl}`,
      contentType,
      size,
      commitSha: commit.commitSha,
    },
    201
  );
}
