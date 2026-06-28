import { articlePath, buildSearchSnippet, buildSearchText, escapeHtml, renderNavItems, safeCoverUrl, toDisplayDate, withBuildVersion } from '../../shared/content.js?v=__BUILD_VERSION__';

const qs = (sel) => document.querySelector(sel);

const state = {
  site: {},
};

const setText = (sel, value) => {
  const el = qs(sel);
  if (el && value) el.textContent = value;
};

const setupHeaderOffset = () => {
  const header = qs('.site-header');
  if (!header) return;

  const apply = () => {
    const height = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--header-height', `${height}px`);
  };

  apply();
  window.addEventListener('resize', apply);
};

const setupMobileSearch = () => {
  const btn = qs('#mobileSearchBtn');
  const header = qs('.site-header');
  const input = qs('#searchInput');
  if (!btn || !header || !input) return;

  const syncAria = () => {
    btn.setAttribute(
      'aria-expanded',
      header.classList.contains('mobile-search-open') ? 'true' : 'false'
    );
  };

  btn.addEventListener('click', () => {
    header.classList.remove('mobile-menu-open');
    header.classList.toggle('mobile-search-open');
    syncAria();
    const menuBtn = qs('#mobileMenuBtn');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    if (header.classList.contains('mobile-search-open')) input.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      header.classList.remove('mobile-search-open');
      syncAria();
      btn.focus();
    }
  });

  syncAria();
};

const setupMobileMenu = () => {
  const btn = qs('#mobileMenuBtn');
  const header = qs('.site-header');
  const nav = qs('.nav');
  if (!btn || !header || !nav) return;

  const syncAria = () => {
    const open = header.classList.contains('mobile-menu-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? '收起選單' : '展開選單');
  };

  btn.addEventListener('click', () => {
    header.classList.remove('mobile-search-open');
    header.classList.toggle('mobile-menu-open');
    syncAria();
    const searchBtn = qs('#mobileSearchBtn');
    if (searchBtn) searchBtn.setAttribute('aria-expanded', 'false');
  });

  nav.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.closest('a')) {
      header.classList.remove('mobile-menu-open');
      syncAria();
    }
  });

  document.addEventListener('click', (e) => {
    if (!header.contains(e.target)) {
      header.classList.remove('mobile-menu-open');
      header.classList.remove('mobile-search-open');
      syncAria();
      const searchBtn = qs('#mobileSearchBtn');
      if (searchBtn) searchBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('mobile-menu-open')) {
      header.classList.remove('mobile-menu-open');
      syncAria();
      btn.focus();
    }
  });

  syncAria();
};

const matchesSearch = (post, query) => {
  if (!query) return true;
  return buildSearchText(post).toLowerCase().includes(query.toLowerCase());
};

const setupSearch = (posts) => {
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  if (!input || !results) return;

  const renderResults = () => {
    const query = input.value.trim();
    if (!query) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }
    const matches = posts.filter((p) => matchesSearch(p, query)).slice(0, 6);
    if (matches.length === 0) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }
    results.innerHTML = matches
      .map(
        (p) => `
          <a class="search-item" href="${escapeHtml(articlePath(p.slug))}">
            <span class="search-item-main">
              <span class="search-item-title">${escapeHtml(p.title)}</span>
              <small class="search-item-meta">${escapeHtml([p.issue, toDisplayDate(p.date)].filter(Boolean).join(' · '))}</small>
            </span>
            <small class="search-item-snippet">${escapeHtml(buildSearchSnippet(p, query, 68))}</small>
          </a>
        `
      )
      .join('');
    results.classList.add('active');
  };

  input.addEventListener('input', renderResults);
  input.addEventListener('focus', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('.search-item');
      if (first) {
        window.location.href = first.getAttribute('href');
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove('active');
    }
  });
};

const renderIssue = (issue, posts) => {
  const cover = safeCoverUrl(issue.cover);
  const countTemplate = escapeHtml(state.site.issueCountTemplate || '收錄 {count} 篇文章');
  const linkedPosts = Array.isArray(issue.posts)
    ? issue.posts
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item.slug === 'string') return item.slug;
          return '';
        })
        .filter(Boolean)
    : [];
  const count = linkedPosts.length;
  const countText = countTemplate.replace('{count}', `<strong>${count}</strong>`);
  const href = `/issues/${encodeURIComponent(issue.id || '')}`;

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
    </a>
  `;
};

const loadSite = async () => {
  try {
    const res = await fetch(withBuildVersion('/posts/site.json'));
    if (!res.ok) return;
    state.site = await res.json();
    setText('#siteName', state.site.siteName);
    setText('#siteFooterText', state.site.footerText);
    setText('#issuesPageTitle', state.site.issuesPageTitle);
    setText('#issuesPageIntro', state.site.issuesPageIntro);

    const searchInput = qs('#searchInput');
    if (searchInput && state.site.searchPlaceholder) {
      searchInput.setAttribute('placeholder', state.site.searchPlaceholder);
    }

    const nav = qs('.nav');
    if (nav && Array.isArray(state.site.nav) && state.site.nav.length > 0) {
      const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
      const items = renderNavItems(state.site.nav, currentPath, { baseOrigin: window.location.origin });
      if (items) nav.innerHTML = items;
    }
  } catch {
    state.site = {};
  }
};

const init = async () => {
  const [issuesRes, postsRes] = await Promise.all([
    fetch(withBuildVersion('/posts/issues.json')),
    fetch(withBuildVersion('/posts/posts.json')),
    loadSite(),
  ]);
  const issuesData = await issuesRes.json();
  const postsData = await postsRes.json();
  const issues = (issuesData.issues || []).filter((issue) => issue?.published !== false);
  const posts = (postsData.items || postsData).filter((post) => post?.published !== false);

  const grid = qs('#issuesGrid');
  if (grid) {
    grid.innerHTML = issues.map((issue) => renderIssue(issue, posts)).join('');
  }

  setupSearch(posts);
  setupHeaderOffset();
  setupMobileSearch();
  setupMobileMenu();
};

init();
