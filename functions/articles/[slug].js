import {
  articlePath,
  buildDescription,
  escapeHtml,
  formatDate,
  isPublished,
  normalizeText,
  safeCoverUrl,
  simpleMarkdown,
} from '../../shared/content.js';
import {
  PUBLIC_CONTENT_SECURITY_POLICY,
  renderAnalyticsScript,
  renderSiteHeader,
  renderSiteFooter,
} from '../../shared/site-pages.js';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=UTF-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': PUBLIC_CONTENT_SECURITY_POLICY,
};

const fetchStaticJson = async (context, pathname) => {
  const assetUrl = new URL(pathname, context.request.url);
  const res = context.env?.ASSETS?.fetch
    ? await context.env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }))
    : await fetch(assetUrl.toString());
  if (!res.ok) {
    throw new Error(`Failed to load ${pathname}: ${res.status}`);
  }
  return res.json();
};

const renderFooter = (site, currentPath) => renderSiteFooter(site, currentPath);

const renderPage = ({ currentPath, description, origin, post, site }) => {
  const canonicalPath = articlePath(post.slug);
  const canonicalUrl = new URL(canonicalPath, origin).toString();
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const excerpt = normalizeText(post.excerpt);
  const bodyHtml = simpleMarkdown(post.body || '', { baseOrigin: origin });
  const title = `${post.title} · ${siteName}`;
  const keywords = normalizeText(site.siteKeywords);
  const favicon =
    safeCoverUrl(site.favicon) !== '/assets/img/cover-01.svg'
      ? safeCoverUrl(site.favicon)
      : '/assets/img/favicon.png';
  const ogImg = safeCoverUrl(post.cover || site.ogImage);
  const ogImgTag =
    ogImg && ogImg !== '/assets/img/cover-01.svg'
      ? `\n  <meta property="og:image" content="${escapeHtml(ogImg)}" />\n  <meta name="twitter:image" content="${escapeHtml(ogImg)}" />`
      : '';
  const twitterCard = ogImgTag ? 'summary_large_image' : 'summary';
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="build-version" content="__BUILD_VERSION__" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />${keywords ? `\n  <meta name="keywords" content="${escapeHtml(keywords)}" />` : ''}
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${escapeHtml(siteName)}" />${ogImgTag}
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS" href="/rss.xml" />
  <link rel="stylesheet" href="/assets/css/style.css?v=__BUILD_VERSION__" />
  <link rel="icon" href="${escapeHtml(favicon)}" type="image/png" />
  <script src="/assets/js/theme.js?v=__BUILD_VERSION__"></script>
</head>
<body class="page-post">
  ${renderSiteHeader(site, currentPath)}

  <main class="page-post__main post-page">
    <article class="reading post-article" id="post">
      <header class="reading__head post-hero">
        <time class="reading__date">${escapeHtml(formatDate(post.date || ''))}</time>
        <h1 class="reading__title" id="postTitle">${escapeHtml(post.title || '')}</h1>
        ${excerpt ? `<p class="post-excerpt" id="postExcerpt">${escapeHtml(excerpt)}</p>` : ''}
        ${post.cover ? `<div class="post-cover" id="postCover"><img src="${escapeHtml(safeCoverUrl(post.cover))}" alt="${escapeHtml(post.title || '')}" decoding="async" /></div>` : ''}
      </header>

      <div class="reading__body post-body" id="postBody">${bodyHtml}</div>
    </article>
  </main>

  ${renderFooter(site, currentPath)}

  <script src="/assets/js/search.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/mobile-nav.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/scroll-rails.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/post.js?v=__BUILD_VERSION__" type="module"></script>${renderAnalyticsScript()}
</body>
</html>`;
};

const renderNotFound = ({ currentPath, origin, site }) => {
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const favicon =
    safeCoverUrl(site.favicon) !== '/assets/img/cover-01.svg'
      ? safeCoverUrl(site.favicon)
      : '/assets/img/favicon.png';
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="build-version" content="__BUILD_VERSION__" />
  <title>文章未找到 · ${escapeHtml(siteName)}</title>
  <meta name="description" content="找不到你要查看的文章。" />
  <link rel="stylesheet" href="/assets/css/style.css?v=__BUILD_VERSION__" />
  <link rel="icon" href="${escapeHtml(favicon)}" type="image/png" />
  <script src="/assets/js/theme.js?v=__BUILD_VERSION__"></script>
</head>
<body>
  ${renderSiteHeader(site, currentPath)}
  <main class="page-list list-page">
    <header class="page-head">
      <p class="kicker">404</p>
      <h1 class="page-title">文章未找到</h1>
      <p class="page-intro">這篇文章可能尚未發布、已更名，或網址有誤。<a href="/articles.html">返回文章列表</a>。</p>
    </header>
  </main>
  ${renderFooter(site, currentPath)}
  <script src="/assets/js/search.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/mobile-nav.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/scroll-rails.js?v=__BUILD_VERSION__"></script>${renderAnalyticsScript()}
</body>
</html>`;
};

export async function onRequest(context) {
  const slug = normalizeText(context.params?.slug, { allowPlaceholder: true });
  const origin = new URL(context.request.url).origin;
  const currentPath = new URL(context.request.url).pathname;

  const [postsData, site] = await Promise.all([
    fetchStaticJson(context, '/posts/posts.json'),
    fetchStaticJson(context, '/posts/site.json').catch(() => ({})),
  ]);

  const posts = postsData.items || postsData;
  const post = Array.isArray(posts)
    ? posts.find((item) => item.slug === slug && isPublished(item))
    : null;

  if (!post) {
    return new Response(renderNotFound({ currentPath, origin, site }), {
      status: 404,
      headers: HTML_HEADERS,
    });
  }

  const description = buildDescription(post);

  return new Response(
    renderPage({
      currentPath,
      description,
      origin,
      post,
      site,
    }),
    { headers: HTML_HEADERS }
  );
}
