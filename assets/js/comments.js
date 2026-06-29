import { escapeHtml } from '../../shared/content.js?v=__BUILD_VERSION__';

const API_ORIGIN = window.location.hostname === 'eo.cbc688.com' ? 'https://cbc688.com' : window.location.origin;
const API_URL = `${API_ORIGIN}/api/comments`;

const qs = (selector, root = document) => root.querySelector(selector);

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-Hant', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const loadTurnstile = () =>
  new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('驗證元件載入逾時，請稍後再試。')), 15000);
    const finish = (turnstile) => {
      window.clearTimeout(timeout);
      resolve(turnstile);
    };
    const fail = (error) => {
      window.clearTimeout(timeout);
      reject(error);
    };

    if (window.turnstile) {
      finish(window.turnstile);
      return;
    }
    const existing = document.querySelector('script[data-turnstile-script]');
    if (existing) {
      existing.addEventListener('load', () => finish(window.turnstile), { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = '1';
    script.onload = () => finish(window.turnstile);
    script.onerror = fail;
    document.head.appendChild(script);
  });

const renderComments = (listEl, comments) => {
  if (!comments.length) {
    listEl.innerHTML = '<p class="comments__empty">暫無評論。</p>';
    return;
  }
  listEl.innerHTML = comments
    .map(
      (comment) => `
        <article class="comment-item">
          <header class="comment-item__head">
            <strong>${escapeHtml(comment.authorName || '讀者')}</strong>
            <time datetime="${escapeHtml(comment.createdAt || '')}">${escapeHtml(formatDate(comment.createdAt))}</time>
          </header>
          <p>${escapeHtml(comment.body || '')}</p>
        </article>`
    )
    .join('');
};

const setStatus = (el, message, tone = '') => {
  el.textContent = message || '';
  el.dataset.tone = tone;
};

const initComments = async () => {
  const root = qs('[data-comments]');
  if (!root) return;

  const slug = root.getAttribute('data-comments-slug') || '';
  const listEl = qs('[data-comments-list]', root);
  const form = qs('[data-comments-form]', root);
  const statusEl = qs('[data-comments-status]', root);
  const submitBtn = qs('[data-comments-submit]', root);
  const turnstileEl = qs('[data-comments-turnstile]', root);
  if (!slug || !listEl || !form || !statusEl || !submitBtn || !turnstileEl) return;

  let turnstileWidget = '';
  let canSubmit = false;
  submitBtn.disabled = true;

  const fetchJson = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '請求失敗');
    return data;
  };

  try {
    const [config, list] = await Promise.all([
      fetchJson(`${API_URL}?config=1`),
      fetchJson(`${API_URL}?slug=${encodeURIComponent(slug)}`),
    ]);

    renderComments(listEl, Array.isArray(list.comments) ? list.comments : []);

    if (!config.enabled || !config.submissionEnabled) {
      form.hidden = true;
      setStatus(statusEl, '評論功能尚未完成配置。', 'muted');
      return;
    }

    if (config.turnstileSiteKey) {
      const turnstile = await loadTurnstile();
      turnstileWidget = turnstile.render(turnstileEl, {
        sitekey: config.turnstileSiteKey,
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
      });
    }
    canSubmit = true;
    submitBtn.disabled = false;
  } catch (err) {
    form.hidden = true;
    setStatus(statusEl, err && err.message ? err.message : '評論暫不可用。', 'error');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = {
      slug,
      authorName: data.get('authorName'),
      email: data.get('email'),
      body: data.get('body'),
      website: data.get('website'),
      turnstileToken: window.turnstile && turnstileWidget ? window.turnstile.getResponse(turnstileWidget) : '',
    };

    submitBtn.disabled = true;
    setStatus(statusEl, '正在提交…', 'muted');
    try {
      await fetchJson(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      form.reset();
      if (window.turnstile && turnstileWidget) window.turnstile.reset(turnstileWidget);
      setStatus(statusEl, '已提交，待審核後顯示。', 'success');
    } catch (err) {
      setStatus(statusEl, err && err.message ? err.message : '提交失敗。', 'error');
    } finally {
      submitBtn.disabled = !canSubmit;
    }
  });
};

initComments();
