const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getCookie = (cookieHeader, key) => {
  if (!cookieHeader) return '';
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.trim().split('=');
    if (rawName === key) return rest.join('=');
  }
  return '';
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const clearCookie = `oauth_state=; HttpOnly; Path=/api/callback; SameSite=Lax; Max-Age=0${url.protocol === 'https:' ? '; Secure' : ''}`;
  if (!code || !state) {
    const missingResponse = new Response('Missing OAuth parameters', { status: 400 });
    missingResponse.headers.set('Set-Cookie', clearCookie);
    missingResponse.headers.set('Cache-Control', 'no-store, max-age=0');
    return missingResponse;
  }

  const cookieState = getCookie(request.headers.get('Cookie'), 'oauth_state');
  if (!cookieState || cookieState !== state) {
    const invalidResponse = new Response('Invalid OAuth state', { status: 400 });
    invalidResponse.headers.set('Set-Cookie', clearCookie);
    invalidResponse.headers.set('Cache-Control', 'no-store, max-age=0');
    return invalidResponse;
  }

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response('Missing GitHub OAuth env vars', { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'crivu-cms-oauth',
    },
    body: params.toString(),
  });

  let tokenJson;
  try {
    tokenJson = await tokenRes.json();
  } catch {
    const badResponse = new Response('Invalid token response from GitHub', { status: 502 });
    badResponse.headers.set('Set-Cookie', clearCookie);
    badResponse.headers.set('Cache-Control', 'no-store, max-age=0');
    return badResponse;
  }

  if (!tokenJson.access_token) {
    const message = escapeHtml(tokenJson.error_description || tokenJson.error || 'No access token');
    const errorResponse = new Response(
      `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>OAuth Error</title></head>
<body style="font-family: sans-serif; padding: 24px;">
  <h1>OAuth Error</h1>
  <p>No access token: ${message}</p>
  <p>Current origin: ${escapeHtml(url.origin)}</p>
  <p>Expected callback path: /api/callback</p>
  <p>You can close this window and try login again.</p>
</body>
</html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
    errorResponse.headers.set('Set-Cookie', clearCookie);
    errorResponse.headers.set('Cache-Control', 'no-store, max-age=0');
    return errorResponse;
  }

  const token = tokenJson.access_token;
  const payload = JSON.stringify({ token, provider: 'github' });
  const expectedOrigin = JSON.stringify(url.origin);
  const response = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body>
<script>
  (function() {
    var content = ${payload};
    var expectedOrigin = ${expectedOrigin};

    function finish() {
      if (!window.opener) return;
      window.opener.postMessage(
        "authorization:github:success:" + JSON.stringify(content),
        expectedOrigin
      );
      setTimeout(function() { window.close(); }, 100);
    }

    function receiveMessage(message) {
      if (!message || message.origin !== expectedOrigin) return;
      finish();
      window.removeEventListener("message", receiveMessage, false);
    }

    if (!window.opener) {
      document.body.textContent = "Login completed. You can close this tab.";
      return;
    }

    window.addEventListener("message", receiveMessage, false);
    window.opener.postMessage("authorizing:github", expectedOrigin);
  })();
</script>
</body>
</html>`;

  const okResponse = new Response(response, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  okResponse.headers.set('Set-Cookie', clearCookie);
  okResponse.headers.set('Cache-Control', 'no-store, max-age=0');
  return okResponse;
}
