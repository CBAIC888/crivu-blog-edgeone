/*
 * Edge 邊緣 middleware：安全網式的 __BUILD_VERSION__ 替換。
 *
 * 原本 scripts/inject-build-version.js 在 Cloudflare Pages 的 build step
 * 執行時把 HTML / Function 原始碼中的 "__BUILD_VERSION__" 換成真實版本號。
 * 若 build step 因為設定問題沒跑到（佔位符卡在線上 HTML），讀者的
 * 瀏覽器會抓到帶 `?v=__BUILD_VERSION__` 的資源，配合 _headers 對
 * /assets/* 的 immutable 長快取，會一直抓到舊版。
 *
 * 這支 middleware 在 edge 端攔截 HTML 回應，若仍存在佔位符，就用
 * 當次部署的 commit SHA（Cloudflare Pages 自動注入）即時替換；
 * 沒有 commit SHA 時（本地 dev）用 'runtime' fallback。
 *
 * 只處理 text/html；靜態 JS/CSS 資產中本來就不應出現這個佔位符，
 * 不需要 middleware 動手。
 */

const PLACEHOLDER = '__BUILD_VERSION__';
const PLACEHOLDER_ENCODED = encodeURIComponent(PLACEHOLDER); // "__BUILD_VERSION__" 不會被 encode，但照樣處理保險起見
const BLOCKED_EXACT_PATHS = new Set([
  '/_headers',
  '/.gitignore',
  '/DEPLOYMENT.md',
  '/edgeone.json',
  '/package.json',
  '/wrangler.toml',
  '/admin/config.yml',
]);
const BLOCKED_PREFIXES = ['/functions/', '/migrations/', '/scripts/'];

const isBlockedPath = (pathname) => {
  if (BLOCKED_EXACT_PATHS.has(pathname)) return true;
  if (BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return /^\/\.(env|git|hg|svn)(\/|$)/.test(pathname);
};

const resolveBuildVersion = (env) => {
  const sha = env && (env.CF_PAGES_COMMIT_SHA || env.COMMIT_REF || env.GITHUB_SHA);
  if (sha) return String(sha).slice(0, 7);
  if (env && env.BUILD_VERSION) return String(env.BUILD_VERSION).slice(0, 40);
  return 'runtime';
};

const isHtml = (contentType) => {
  if (!contentType) return false;
  return contentType.toLowerCase().includes('text/html');
};

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (isBlockedPath(url.pathname)) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // /api/* 是 JSON/OAuth 等非 HTML 路徑，省略 body 處理
  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  const response = await context.next();

  if (!isHtml(response.headers.get('content-type'))) {
    return response;
  }

  // 把 body 讀成字串；HTML 大小通常在 100KB 內，可接受。
  const body = await response.text();

  if (!body.includes(PLACEHOLDER) && !body.includes(PLACEHOLDER_ENCODED)) {
    // 通常 build step 有成功，或 Function 已自行替換；原樣回傳即可。
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const version = resolveBuildVersion(context.env);
  const replaced = body
    .replaceAll(PLACEHOLDER, version)
    .replaceAll(PLACEHOLDER_ENCODED, version);

  // 保留原 response 的 headers（尤其 Cache-Control / CSP）；
  // Content-Length 由 Response 自行重新計算。
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set(
    'x-build-version-source',
    context.env?.CF_PAGES_COMMIT_SHA ? 'edge-cf-sha' : 'edge-fallback'
  );

  return new Response(replaced, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
