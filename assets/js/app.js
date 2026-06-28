import {
  articlePath,
  buildDescription,
  withBuildVersion,
  buildSearchSnippet,
  buildSearchText,
  escapeHtml,
  normalizeText,
  renderNavItems,
  safeCoverUrl,
  simpleMarkdown,
  toDisplayDate,
} from '../../shared/content.js?v=__BUILD_VERSION__';

const state = {
  posts: [],
  site: {},
  search: '',
  applyPosts: null,
};

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

const setText = (sel, value) => {
  const el = qs(sel);
  if (el && value !== undefined && value !== null && value !== '') el.textContent = value;
};

const setHtml = (sel, value) => {
  const el = qs(sel);
  if (el && value !== undefined && value !== null && value !== '') el.innerHTML = value;
};

const revealSiteContent = () => {
  document.body.classList.remove('site-loading');
};

const loadPosts = async () => {
  const res = await fetch(withBuildVersion('/posts/posts.json'));
  const data = await res.json();
  state.posts = (data.items || data).filter((post) => post?.published !== false);
  state.posts.sort((a, b) => b.date.localeCompare(a.date));
};

const loadSite = async () => {
  try {
    const res = await fetch(withBuildVersion('/posts/site.json'));
    if (!res.ok) return;
    state.site = await res.json();
  } catch {
    state.site = {};
  }
};

const applySiteSettings = () => {
  const site = state.site;
  qsa('#siteName').forEach((el) => {
    if (site.siteName) el.textContent = site.siteName;
  });
  qsa('#siteFooterText').forEach((el) => {
    if (site.footerText) el.textContent = site.footerText;
  });

  setText('#articlesPageTitle', site.articlesPageTitle);
  setText('#articlesPageIntro', site.articlesPageIntro);
  setText('#issuesPageTitle', site.issuesPageTitle);
  setText('#issuesPageIntro', site.issuesPageIntro);
  setText('#aboutTitle', site.aboutTitle);
  setHtml('#aboutBody', simpleMarkdown(site.aboutBody || ''));

  qsa('#searchInput').forEach((input) => {
    if (site.searchPlaceholder) input.setAttribute('placeholder', site.searchPlaceholder);
  });
};

const applyNavigation = (site) => {
  const nav = qs('.site-header__nav') || qs('.nav');
  if (!nav || !Array.isArray(site.nav) || site.nav.length === 0) return;

  const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
  const items = renderNavItems(site.nav, currentPath, { baseOrigin: window.location.origin });
  if (items) nav.innerHTML = items;
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

const initLazyBackgrounds = (root = document) => {
  const nodes = Array.from(root.querySelectorAll('[data-bg]'));
  if (nodes.length === 0) return;

  const applyBg = (node) => {
    if (node.dataset.bgLoaded === '1') return;
    const src = node.getAttribute('data-bg');
    if (!src) return;
    node.style.backgroundImage = `url('${safeCoverUrl(src)}')`;
    node.dataset.bgLoaded = '1';
  };

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(applyBg);
    return;
  }

  const io = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        applyBg(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '280px 0px' }
  );

  nodes.forEach((node) => io.observe(node));
};

const setupMobileSearch = () => {
  const btn = qs('#mobileSearchBtn');
  const header = qs('.site-header');
  const input = qs('#searchInput');
  if (!btn || !header || !input) return;

  const syncAria = () => {
    const open = header.classList.contains('mobile-search-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  btn.addEventListener('click', () => {
    header.classList.remove('mobile-menu-open');
    header.classList.toggle('mobile-search-open');
    syncAria();
    // menu button aria should reset too
    const menuBtn = qs('#mobileMenuBtn');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    if (header.classList.contains('mobile-search-open')) input.focus();
  });

  // ESC 關閉搜尋
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

  // ESC 鍵關閉
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('mobile-menu-open')) {
      header.classList.remove('mobile-menu-open');
      syncAria();
      btn.focus();
    }
  });

  syncAria();
};

const renderCard = (post, index) => {
  const safeLink = articlePath(post.slug);
  const excerpt = buildDescription(post, 72);
  const displayDate = toDisplayDate(post.date);
  const metaBits = [
    displayDate ? `<span class="cap">${escapeHtml(displayDate)}</span>` : '',
  ].filter(Boolean);
  const num = String((index ?? 0) + 1).padStart(2, '0');
  const hasCover = Boolean(normalizeText(post.cover, { allowPlaceholder: true }));
  const cover = hasCover ? safeCoverUrl(post.cover) : '';
  const thumb = hasCover
    ? `
      <a class="toc__thumb" href="${escapeHtml(safeLink)}" aria-hidden="true">
        <img src="${escapeHtml(cover)}" alt="" loading="lazy" />
      </a>`
    : '';
  return `
    <li class="toc__row${hasCover ? '' : ' toc__row--no-cover'}">
      <span class="toc__num">${num}</span>
      <div class="toc__body">
        <p class="toc__meta">${metaBits.join('')}</p>
        <h3 class="toc__title"><a href="${escapeHtml(safeLink)}">${escapeHtml(post.title || '')}</a></h3>
        ${excerpt ? `<p class="toc__excerpt">${escapeHtml(excerpt)}</p>` : ''}
      </div>${thumb}
    </li>
  `;
};

const renderGrid = (el, posts) => {
  if (!el) return;
  // 確保容器是 <ol class="toc">
  if (el.tagName !== 'OL') {
    const ol = document.createElement('ol');
    ol.className = 'toc';
    el.parentNode.replaceChild(ol, el);
    el = ol;
  } else {
    el.classList.add('toc');
    el.classList.remove('post-grid', 'list-mode');
  }
  el.innerHTML = posts.map((p, i) => renderCard(p, i)).join('');
};

const matchesSearch = (post, query) => {
  if (!query) return true;
  return buildSearchText(post).toLowerCase().includes(query.toLowerCase());
};

const setupSearch = () => {
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  if (!input || !results) return;

  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  input.value = q;
  state.search = q;

  const renderResults = () => {
    const query = state.search.trim();
    if (!query) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }

    const matches = state.posts.filter((p) => matchesSearch(p, query)).slice(0, 6);
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

  const applyAll = () => {
    if (state.applyPosts) state.applyPosts();
    renderResults();
  };

  input.addEventListener('input', () => {
    state.search = input.value.trim();
    applyAll();
  });

  input.addEventListener('focus', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('.search-item');
      if (first) window.location.href = first.getAttribute('href');
    }
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) results.classList.remove('active');
  });

  renderResults();
};

const setupFilters = () => {
  const grid = qs('#postGrid');
  if (!grid) return;

  const apply = () => {
    const filtered = state.posts.filter((p) => matchesSearch(p, state.search));
    renderGrid(grid, filtered);
  };

  state.applyPosts = apply;
  apply();
};

const init = async () => {
  await Promise.all([loadPosts(), loadSite()]);

  applySiteSettings();
  applyNavigation(state.site);
  setupSearch();
  setupFilters();
  setupHeaderOffset();
  setupMobileSearch();
  setupMobileMenu();

  const grid = qs('#postGrid');
  if (grid && grid.childElementCount === 0) {
    renderGrid(grid, state.posts.filter((p) => matchesSearch(p, state.search)));
  }

  revealSiteContent();
};

init().catch(() => {
  revealSiteContent();
});
