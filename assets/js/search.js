// 全域搜尋：聚焦時載入 posts.json，輸入時即時比對 title / excerpt / body
// 結果下拉卡片含高亮、上下文片段、日期
(() => {
  const input = document.querySelector('#globalSearchInput') || document.querySelector('#searchInput');
  const results =
    document.querySelector('#globalSearchResults') || document.querySelector('#searchResults');
  if (!input || !results) return;

  let posts = [];
  let loaded = false;
  let loading = null;

  const withBuildVersion = (url) => {
    const meta = document.querySelector('meta[name="build-version"]');
    const v = meta && meta.getAttribute('content');
    if (!v || v === '__BUILD_VERSION__') return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(v)}`;
  };

  const load = () => {
    if (loaded) return Promise.resolve();
    if (loading) return loading;
    loading = fetch(withBuildVersion('/posts/posts.json'))
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        posts = (data.items || data || []).filter((post) => post?.published !== false);
        loaded = true;
      })
      .catch(() => {
        posts = [];
        loaded = true;
      });
    return loading;
  };

  const escapeHtml = (s) =>
    String(s == null ? '' : s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  const stripMd = (raw) =>
    String(raw == null ? '' : raw)
      .replace(/\r\n/g, '\n')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[audio\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

  const snippet = (source, query, span = 80) => {
    const text = stripMd(source);
    if (!text) return '';
    if (!query) return text.slice(0, span) + (text.length > span ? '…' : '');
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, span) + (text.length > span ? '…' : '');
    const start = Math.max(0, idx - 20);
    const end = Math.min(text.length, idx + query.length + span - 20);
    const pre = start > 0 ? '…' : '';
    const suf = end < text.length ? '…' : '';
    return pre + text.slice(start, end) + suf;
  };

  const highlight = (text, query) => {
    if (!query) return escapeHtml(text);
    const safe = escapeHtml(text);
    const qSafe = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!qSafe) return safe;
    return safe.replace(new RegExp(qSafe, 'gi'), (m) => `<mark>${m}</mark>`);
  };

  const score = (post, q) => {
    const Q = q.toLowerCase();
    const title = String(post.title || '').toLowerCase();
    const excerpt = String(post.excerpt || '').toLowerCase();
    const body = stripMd(post.body || '').toLowerCase();
    if (title.includes(Q)) return 3;
    if (excerpt.includes(Q)) return 2;
    if (body.includes(Q)) return 1;
    return 0;
  };

  const toDisplayDate = (raw) => {
    const str = String(raw == null ? '' : raw).trim();
    const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : str;
  };

  const articlePath = (slug) =>
    slug ? `/articles/${encodeURIComponent(String(slug).trim())}` : '/articles.html';

  const render = (query) => {
    const q = query.trim();
    if (!q) {
      results.classList.remove('is-open');
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }
    const matched = posts
      .map((p) => ({ post: p, s: score(p, q) }))
      .filter((x) => x.s > 0)
      .sort(
        (a, b) =>
          b.s - a.s ||
          String(b.post.date || '').localeCompare(String(a.post.date || ''))
      )
      .slice(0, 8);

    results.classList.add('is-open');
    results.classList.add('active');

    if (matched.length === 0) {
      results.innerHTML = `<div class="search-empty">找不到與「${escapeHtml(q)}」相符的文章。</div>`;
      return;
    }

    results.innerHTML = matched
      .map(({ post }) => {
        const href = articlePath(post.slug || '');
        const title = highlight(post.title || '', q);
        const meta = escapeHtml(toDisplayDate(post.date));
        const snip = highlight(snippet(post.excerpt || post.body, q), q);
        return `
          <a class="search-hit search-item" href="${href}">
            <div class="search-hit__title search-item-title">${title}</div>
            ${meta ? `<div class="search-hit__meta search-item-meta">${meta}</div>` : ''}
            ${snip ? `<div class="search-hit__snip search-item-snippet">${snip}</div>` : ''}
          </a>
        `;
      })
      .join('');
  };

  input.addEventListener('focus', () => {
    load().then(() => {
      if (input.value.trim()) render(input.value);
    });
  });

  let raf = 0;
  input.addEventListener('input', () => {
    load().then(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => render(input.value));
    });
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove('is-open');
      results.classList.remove('active');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      results.classList.remove('is-open');
      results.classList.remove('active');
      input.blur();
    }
  });
})();
