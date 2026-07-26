import {
  articlePath,
  escapeHtml,
  isPublished,
  normalizeText,
  safeCoverUrl,
  toDisplayDate,
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

const renderTocRow = (post, index) => {
  const href = articlePath(post.slug);
  const num = String(index + 1).padStart(2, '0');
  const displayDate = toDisplayDate(post.date);
  const metaBits = [
    displayDate ? `<span class="cap">${escapeHtml(displayDate)}</span>` : '',
  ]
    .filter(Boolean)
    .join('');
  const excerpt = normalizeText(post.excerpt) || '';
  return `
    <li class="toc__row toc__row--no-cover">
      <span class="toc__num">${num}</span>
      <div class="toc__body">
        <p class="toc__meta">${metaBits}</p>
        <h3 class="toc__title"><a href="${escapeHtml(href)}">${escapeHtml(post.title || '')}</a></h3>
        ${excerpt ? `<p class="toc__excerpt">${escapeHtml(excerpt)}</p>` : ''}
      </div>
    </li>`;
};

const renderShell = ({ bodyHtml, currentPath, description, origin, site, title }) => {
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="build-version" content="__BUILD_VERSION__" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS" href="/rss.xml" />
  <link rel="stylesheet" href="/assets/css/style.css?v=__BUILD_VERSION__" />
  <link rel="icon" href="/assets/img/favicon.png" type="image/png" />
  <script src="/assets/js/theme.js?v=__BUILD_VERSION__"></script>
</head>
<body>
  ${renderSiteHeader(site, currentPath)}

  ${bodyHtml}

  ${renderSiteFooter(site, currentPath)}

  <script src="/assets/js/search.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/mobile-nav.js?v=__BUILD_VERSION__"></script>
  <script src="/assets/js/scroll-rails.js?v=__BUILD_VERSION__"></script>${renderAnalyticsScript()}
</body>
</html>`;
};

const renderNotFound = ({ currentPath, origin, site }) => {
  const main = `
    <main class="page-issue">
      <section class="page-head">
        <p class="kicker">404</p>
        <h1 class="page-title">找不到這本期刊</h1>
        <p class="page-intro">可能 ID 有誤或期刊尚未發布。<a href="/issues.html">返回期刊列表</a>。</p>
      </section>
    </main>`;
  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  return renderShell({
    bodyHtml: main,
    currentPath,
    description: '找不到這本期刊。',
    origin,
    site,
    title: `期刊未找到 · ${siteName}`,
  });
};

export async function onRequest(context) {
  const id = normalizeText(context.params?.id, { allowPlaceholder: true });
  const origin = new URL(context.request.url).origin;
  const currentPath = new URL(context.request.url).pathname;

  const [issuesData, postsData, site] = await Promise.all([
    fetchStaticJson(context, '/posts/issues.json'),
    fetchStaticJson(context, '/posts/posts.json'),
    fetchStaticJson(context, '/posts/site.json').catch(() => ({})),
  ]);

  const issues = Array.isArray(issuesData?.issues) ? issuesData.issues.filter(isPublished) : [];
  const issue = issues.find((it) => String(it.id) === id);

  if (!issue) {
    return new Response(renderNotFound({ currentPath, origin, site }), {
      status: 404,
      headers: HTML_HEADERS,
    });
  }

  const posts = (postsData.items || postsData || []).filter(isPublished);
  const linkedSlugs = Array.isArray(issue.posts)
    ? issue.posts
        .map((item) => (typeof item === 'string' ? item : item && item.slug))
        .filter(Boolean)
    : [];
  const linkedPosts = linkedSlugs.map((slug) => posts.find((p) => p.slug === slug)).filter(Boolean);

  const siteName = normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';
  const title = `${issue.title || '期刊'} · ${siteName}`;
  const description = normalizeText(issue.editorNote) || normalizeText(issue.theme) || issue.title || '期刊';
  const cover = safeCoverUrl(issue.cover);

  const tocRows = linkedPosts.length > 0
    ? `<ol class="toc toc--tight">${linkedPosts.map(renderTocRow).join('')}</ol>`
    : `<p class="page-intro">${escapeHtml(normalizeText(site.issueEmptyText) || '暫無文章')}</p>`;

  const editorNote = normalizeText(issue.editorNote);

  const bodyHtml = `
    <main class="page-issue">
      <section class="issue-hero">
        <div class="issue-hero__grid">
          <figure class="issue-hero__cover">
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(issue.title || '')} 封面" decoding="async" fetchpriority="high" />
          </figure>
          <div class="issue-hero__body">
            <h1 class="issue-hero__title">${escapeHtml(issue.title || '')}</h1>
          </div>
          <dl class="issue-hero__facts">
            ${issue.theme ? `<div><dt>${escapeHtml(issue.theme)}</dt></div>` : ''}
            ${issue.publishDate ? `<div><dd>發刊日 ${escapeHtml(toDisplayDate(issue.publishDate))}</dd></div>` : ''}
            <div><dd>主編 ${escapeHtml(siteName)}</dd></div>
            <div><dd>收錄 ${linkedPosts.length} 篇文章</dd></div>
          </dl>
        </div>
        ${editorNote ? `
        <p class="issue-hero__editor">${escapeHtml(editorNote)}</p>
        ` : ''}
      </section>

      <section class="issue-toc">
        <header class="issue-toc__head">
          <p class="cap">Contents · 目次</p>
          <h2>收錄文章</h2>
        </header>
        ${tocRows}
      </section>
    </main>`;

  return new Response(
    renderShell({ bodyHtml, currentPath, description, origin, site, title }),
    { headers: HTML_HEADERS }
  );
}
