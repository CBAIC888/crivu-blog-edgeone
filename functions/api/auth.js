export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  if (!provider || provider !== 'github') {
    return new Response('Missing provider', { status: 400 });
  }

  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('Missing GITHUB_CLIENT_ID', { status: 500 });
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  const redirectUri = `${url.origin}/api/callback`;
  const scope = String(env.GITHUB_OAUTH_SCOPE || 'public_repo').trim() || 'public_repo';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  });

  const secure = url.protocol === 'https:' ? '; Secure' : '';
  const response = new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
    },
  });
  response.headers.set(
    'Set-Cookie',
    `oauth_state=${state}; HttpOnly; Path=/api/callback; SameSite=Lax; Max-Age=600${secure}`
  );
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
