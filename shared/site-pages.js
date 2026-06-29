import {
  articlePath,
  buildDescription,
  escapeHtml,
  isConfirmedRecord,
  isPublished,
  normalizeText,
  renderNavItems,
  safeCoverUrl,
  simpleMarkdown,
  toDisplayDate,
} from './content.js';

const BUILD_VERSION = '__BUILD_VERSION__';
export const GOATCOUNTER_URL = 'https://cbc688.goatcounter.com/count';
export const PUBLIC_CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self'; connect-src 'self' https://cbc688.com https://challenges.cloudflare.com https://cloudflareinsights.com https://cbc688.goatcounter.com; frame-src https://challenges.cloudflare.com";

export const PAGE_HEADERS = {
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

const DEFAULT_NAV = [
  { label: '首頁', href: '/' },
  { label: '文章', href: '/articles.html' },
  { label: '期刊', href: '/issues.html' },
  { label: '紀錄', href: '/records.html' },
  { label: '關於', href: '/about.html' },
  { label: 'rss', href: '/rss.xml' },
];

const fetchStaticJson = async (context, pathname) => {
  const assetUrl = new URL(pathname, context.request.url);
  const res = context.env?.ASSETS?.fetch
    ? await context.env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }))
    : await fetch(assetUrl.toString());
  if (!res.ok) throw new Error(`Failed to load ${pathname}: ${res.status}`);
  return res.json();
};

export const loadSiteBundle = async (context) => {
  const [postsData, issuesData, recordsData, siteData] = await Promise.all([
    fetchStaticJson(context, '/posts/posts.json'),
    fetchStaticJson(context, '/posts/issues.json').catch(() => ({ issues: [] })),
    fetchStaticJson(context, '/posts/records.json').catch(() => ({ records: [] })),
    fetchStaticJson(context, '/posts/site.json').catch(() => ({})),
  ]);

  const posts = (postsData.items || postsData || []).filter(isPublished);
  posts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return {
    posts,
    issues: Array.isArray(issuesData.issues) ? issuesData.issues.filter(isPublished) : [],
    records: Array.isArray(recordsData.records)
      ? recordsData.records.filter(isConfirmedRecord)
      : [],
    site: siteData || {},
  };
};

const fallbackSiteName = (site) =>
  normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';

const fallbackFooter = (site) =>
  normalizeText(site.footerText, { allowPlaceholder: true }) ||
  `© ${new Date().getFullYear()} ${fallbackSiteName(site)}`;

const navList = (site, currentPath) =>
  renderNavItems(
    Array.isArray(site.nav) && site.nav.length > 0 ? site.nav : DEFAULT_NAV,
    currentPath,
    {}
  );

const scriptTag = (src) =>
  src ? `\n  <script src="${escapeHtml(src)}?v=${BUILD_VERSION}" type="module"></script>` : '';

export const renderAnalyticsScript = () =>
  `\n  <script src="/assets/js/analytics.js?v=${BUILD_VERSION}" defer></script>`;

const renderFooter = (site) => {
  const footerText = fallbackFooter(site);

  return `
  <footer class="site-footer">
    <div class="site-footer__copy" id="siteFooterText">${escapeHtml(footerText)}</div>
  </footer>`;
};

export const renderSiteHeader = (site, currentPath) => {
  const siteName = fallbackSiteName(site);
  const searchPlaceholder = normalizeText(site.searchPlaceholder) || '搜尋文章';
  const themeToggle = site.themeToggleEnabled === false
    ? ''
    : `
        <button class="theme-toggle" data-theme-toggle aria-label="切換背景主題">
          <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
          <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>`;

  return `
  <header class="site-header">
    <div class="site-header__inner">
      <a class="site-header__brand" href="/">${escapeHtml(siteName)}</a>
      <nav class="site-header__nav" id="primaryNav">
        ${navList(site, currentPath)}
      </nav>
      <div class="site-header__actions">
        <form class="site-header__search" onsubmit="return false" role="search">
          <span class="icon" aria-hidden="true"></span>
          <input id="globalSearchInput" type="search" placeholder="${escapeHtml(searchPlaceholder)}" aria-label="搜尋文章" autocomplete="off" />
          <div id="globalSearchResults" class="search-results" role="listbox"></div>
        </form>
        <button class="mobile-menu-toggle" id="mobileMenuBtn" aria-label="展開選單" aria-expanded="false" aria-controls="primaryNav">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18">
            <line class="mm-line mm-line-top" x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line class="mm-line mm-line-mid" x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line class="mm-line mm-line-bot" x1="4" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>${themeToggle}
      </div>
    </div>
  </header>`;
};

export const renderPageShell = ({
  bodyClass = '',
  currentPath,
  description,
  mainHtml,
  scriptSrc,
  site,
  title,
  ogImage,
}) => {
  const siteName = fallbackSiteName(site);
  const keywords = normalizeText(site.siteKeywords);
  const favicon =
    safeCoverUrl(site.favicon) !== '/assets/img/cover-01.svg'
      ? safeCoverUrl(site.favicon)
      : '/assets/img/favicon.png';
  const ogImg = ogImage || safeCoverUrl(site.ogImage);
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
  <meta name="build-version" content="${BUILD_VERSION}" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />${keywords ? `\n  <meta name="keywords" content="${escapeHtml(keywords)}" />` : ''}
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(siteName)}" />${ogImgTag}
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS" href="/rss.xml" />
  <link rel="stylesheet" href="/assets/css/style.css?v=${BUILD_VERSION}" />
  <link rel="icon" href="${escapeHtml(favicon)}" type="image/png" />
  <script src="/assets/js/theme.js?v=${BUILD_VERSION}"></script>
</head>
<body${bodyClass ? ` class="${escapeHtml(bodyClass)}"` : ''}>
  ${renderSiteHeader(site, currentPath)}

  ${mainHtml}

  ${renderFooter(site, currentPath)}

  <script src="/assets/js/search.js?v=${BUILD_VERSION}"></script>
  <script src="/assets/js/mobile-nav.js?v=${BUILD_VERSION}"></script>
  <script src="/assets/js/scroll-rails.js?v=${BUILD_VERSION}"></script>${scriptTag(scriptSrc)}${renderAnalyticsScript()}
</body>
</html>`;
};

/* ---------- 共用片段 ---------- */

const renderTocRow = (post, index) => {
  const href = articlePath(post.slug);
  const num = String(index + 1).padStart(2, '0');
  const displayDate = toDisplayDate(post.date);
  const metaBits = [
    displayDate ? `<span class="cap">${escapeHtml(displayDate)}</span>` : '',
  ]
    .filter(Boolean)
    .join('');
  const excerpt = buildDescription(post, 80);
  const hasCover = Boolean(normalizeText(post.cover, { allowPlaceholder: true }));
  const cover = hasCover ? safeCoverUrl(post.cover) : '';
  const thumb = hasCover
    ? `
      <a class="toc__thumb" href="${escapeHtml(href)}" aria-hidden="true">
        <img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" />
      </a>`
    : '';
  return `
    <li class="toc__row${hasCover ? '' : ' toc__row--no-cover'}">
      <span class="toc__num">${num}</span>
      <div class="toc__body">
        <p class="toc__meta">${metaBits}</p>
        <h3 class="toc__title"><a href="${escapeHtml(href)}">${escapeHtml(post.title || '')}</a></h3>
        ${excerpt ? `<p class="toc__excerpt">${escapeHtml(excerpt)}</p>` : ''}
      </div>${thumb}
    </li>`;
};

const renderBook = (issue, posts, site) => {
  const linkedSlugs = Array.isArray(issue.posts)
    ? issue.posts
        .map((item) => (typeof item === 'string' ? item : item && item.slug))
        .filter(Boolean)
    : [];
  const count = linkedSlugs
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter(Boolean).length;
  const countTemplate = normalizeText(site.issueCountTemplate) || '收錄 {count} 篇文章';
  const countText = countTemplate.replace('{count}', `<strong>${count}</strong>`);
  const href = `/issues/${encodeURIComponent(issue.id || '')}`;
  const cover = safeCoverUrl(issue.cover);

  return `
    <a class="book" href="${escapeHtml(href)}" aria-label="${escapeHtml(issue.title || '')}">
      <div class="book__cover">
        <img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" />
      </div>
      <div class="book__meta">
        <p class="book__id">Issue ${escapeHtml(issue.id || '')}${issue.publishDate ? ` · ${escapeHtml(toDisplayDate(issue.publishDate))}` : ''}</p>
        <p class="book__title">${escapeHtml(issue.title || '')}</p>
        ${issue.theme ? `<p class="book__theme">${escapeHtml(issue.theme)}</p>` : ''}
        <p class="book__count">${countText}</p>
      </div>
    </a>`;
};

const renderIssueCover = (issue) => `
  <a class="home-cover" href="/issues/${encodeURIComponent(issue.id || '')}" aria-label="${escapeHtml(issue.title || '')}">
    <img src="${escapeHtml(safeCoverUrl(issue.cover))}" alt="${escapeHtml(issue.title || '')}" loading="lazy" decoding="async" />
  </a>`;

const renderRecordCard = (record, options = {}) => `
  <a class="${options.rail ? 'record-card record-card--rail' : 'record-card'}" href="/records/${encodeURIComponent(record.id || '')}">
    <span class="record-card__media">
      <img src="${escapeHtml(safeCoverUrl(record.cover))}" alt="" loading="lazy" decoding="async" />
    </span>
    <span class="record-card__title">${escapeHtml(record.title || '')}</span>
    ${!options.rail && normalizeText(record.summary) ? `<span class="record-card__summary">${escapeHtml(normalizeText(record.summary))}</span>` : ''}
  </a>`;

/* ---------- 頁面渲染 ---------- */

export const renderArticlesPage = ({ posts, site }, options = {}) => {
  const siteName = fallbackSiteName(site);
  const mainHtml = `<main class="page-list list-page">
    <header class="page-head">
      <h1 class="page-title" id="articlesPageTitle">${escapeHtml(normalizeText(site.articlesPageTitle) || '文章')}</h1>
      <p class="page-intro" id="articlesPageIntro">${escapeHtml(normalizeText(site.articlesPageIntro) || '全部文章')}</p>
    </header>

    <ol class="toc" id="postGrid">${posts.map(renderTocRow).join('')}</ol>
  </main>`;

  return renderPageShell({
    currentPath: options.currentPath || '/articles.html',
    description:
      normalizeText(site.articlesPageIntro) ||
      '按時間順序閱讀 CRIVU 的全部文章。',
    mainHtml,
    scriptSrc: '/assets/js/app.js',
    site,
    title: options.isHome ? siteName : `文章 · ${siteName}`,
  });
};

export const renderHomePage = ({ issues, posts, records, site }) => {
  const featuredPosts = posts.slice(0, 5);
  const mainHtml = `<main class="home-page">
    <section class="home-section home-section--issues">
      <h1 class="home-section__title">期刊</h1>
      <div class="media-rail home-issue-rail" data-scroll-rail aria-label="期刊">${issues.map(renderIssueCover).join('')}</div>
    </section>

    <section class="home-section home-section--articles">
      <h2 class="home-section__title">文章</h2>
      <ol class="toc home-article-list" id="homePostList">
        ${posts.map((post, index) => renderTocRow(post, index).replace('<li class="', `<li class="home-article-item${index >= 5 ? ' is-collapsed' : ''} `)).join('')}
      </ol>
      ${posts.length > featuredPosts.length ? '<div class="home-expand"><button class="text-button" id="homeExpandButton" type="button" aria-expanded="false">展開全部文章</button></div>' : ''}
    </section>

    ${records.length ? `<section class="home-section home-section--records">
      <h2 class="home-section__title">專題紀錄</h2>
      <div class="media-rail record-rail" data-scroll-rail aria-label="專題紀錄">${records.map((record) => renderRecordCard(record, { rail: true })).join('')}</div>
    </section>` : ''}
  </main>`;

  return renderPageShell({
    bodyClass: 'page-home',
    currentPath: '/',
    description: normalizeText(site.siteDescription) || 'CRIVU 的期刊、文章與專題紀錄。',
    mainHtml,
    scriptSrc: '/assets/js/home.js',
    site,
    title: fallbackSiteName(site),
  });
};

export const renderIssuesPage = ({ issues, posts, site }) => {
  const mainHtml = `<main class="page-list issues-page">
    <header class="page-head">
      <h1 class="page-title" id="issuesPageTitle">${escapeHtml(normalizeText(site.issuesPageTitle) || '期刊')}</h1>
      <p class="page-intro" id="issuesPageIntro">${escapeHtml(normalizeText(site.issuesPageIntro) || '全部期刊')}</p>
    </header>

    <div class="issue-shelf issues-grid" id="issuesGrid">${issues.map((issue) => renderBook(issue, posts, site)).join('')}</div>
  </main>`;

  return renderPageShell({
    bodyClass: 'page-issues',
    currentPath: '/issues.html',
    description:
      normalizeText(site.issuesPageIntro) ||
      '以期刊方式整理主題、編者語與收錄文章。',
    mainHtml,
    scriptSrc: '/assets/js/issues.js',
    site,
    title: `期刊 · ${fallbackSiteName(site)}`,
  });
};

export const renderRecordsPage = ({ records, site }) => {
  const mainHtml = `<main class="page-list records-page">
    <header class="page-head">
      <h1 class="page-title">紀錄</h1>
      <p class="page-intro">全部紀錄</p>
    </header>
    <div class="records-grid">${records.map((record) => renderRecordCard(record)).join('')}</div>
  </main>`;

  return renderPageShell({
    bodyClass: 'page-records',
    currentPath: '/records.html',
    description: 'CRIVU 專題紀錄。',
    mainHtml,
    site,
    title: `紀錄 · ${fallbackSiteName(site)}`,
  });
};

export const renderSiteFooter = (site, currentPath) => renderFooter(site, currentPath);

export const renderAboutPage = ({ site }) => {
  const aboutTitle = normalizeText(site.aboutTitle) || '關於';
  const aboutBody = String(site.aboutBody || '').trim();
  const description = buildDescription({
    body: aboutBody,
    excerpt: normalizeText(site.aboutDescription),
    title: aboutTitle,
  });
  const mainHtml = `<main class="page-about page-post__main post-page">
    <article class="reading post-article">
      <header class="reading__head post-hero">
        <h1 class="reading__title" id="aboutTitle">${escapeHtml(aboutTitle)}</h1>
      </header>

      <div class="reading__body post-body" id="aboutBody">${simpleMarkdown(aboutBody)}</div>
    </article>
  </main>`;

  return renderPageShell({
    currentPath: '/about.html',
    description: description || `${fallbackSiteName(site)} · 關於`,
    mainHtml,
    scriptSrc: '/assets/js/app.js',
    site,
    title: `關於 · ${fallbackSiteName(site)}`,
  });
};
