/*
 * CRIVU 後台補強
 * - 兩個編輯器元件：圖片、音訊
 * - 右下角浮動工具列：音訊上傳、在新分頁預覽正式站
 * - 站點設定頁的浮動說明卡，提醒欄位前綴的分組規則
 * - 當使用者在「品牌強調色」欄位填入 #rrggbb 時，旁邊顯示即時色塊
 */

(function () {
  if (typeof CMS === 'undefined') return;

  /* ============================================================
     1. 兩個 Markdown 自訂元件（圖片、音訊）
     ============================================================ */
  const escapeHtml = (input) =>
    String(input == null ? '' : input)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  CMS.registerEditorComponent({
    id: 'image-block',
    label: '圖片（含尺寸建議）',
    fields: [
      { name: 'src', label: '圖片', widget: 'image' },
      { name: 'alt', label: '替代文字', widget: 'string', required: false },
      {
        name: 'preset',
        label: '尺寸預設',
        widget: 'select',
        default: 'article-1200x800',
        options: [
          { label: '封面橫圖 1600x1000', value: 'cover-1600x1000' },
          { label: '文內橫圖 1200x800', value: 'article-1200x800' },
          { label: '社群直圖 1080x1350', value: 'portrait-1080x1350' }
        ]
      },
      { name: 'caption', label: '圖片說明', widget: 'string', required: false }
    ],
    pattern: /!\[(.*?)\]\((.*?)\)\n<!--\s*preset:(.*?)\s*-->\n?(?:\*(.*?)\*)?/,
    fromBlock(match) {
      return {
        alt: match[1] || '',
        src: match[2] || '',
        preset: match[3] || 'article-1200x800',
        caption: match[4] || ''
      };
    },
    toBlock(obj) {
      const alt = obj.alt || '';
      const src = obj.src || '';
      const preset = obj.preset || 'article-1200x800';
      const caption = obj.caption ? '\n*' + obj.caption + '*' : '';
      return '![' + alt + '](' + src + ')\n<!-- preset:' + preset + ' -->' + caption;
    },
    toPreview(obj) {
      const caption = obj.caption ? '<figcaption>' + escapeHtml(obj.caption) + '</figcaption>' : '';
      return '<figure><img src="' + escapeHtml(obj.src || '') + '" alt="' + escapeHtml(obj.alt || '') + '"/>' + caption + '</figure>';
    }
  });

  CMS.registerEditorComponent({
    id: 'audio-block',
    label: '音訊（Cloudflare）',
    fields: [
      { name: 'src', label: '音訊 URL', widget: 'string', hint: '可用右下角「上傳音訊」按鈕自動插入' },
      { name: 'title', label: '音訊標題', widget: 'string', required: false },
      { name: 'caption', label: '音訊說明', widget: 'string', required: false }
    ],
    pattern: /\[audio\]\((.*?)\)\n<!--\s*title:(.*?)\s*-->\n?(?:\*(.*?)\*)?/,
    fromBlock(match) {
      return {
        src: match[1] || '',
        title: match[2] || '',
        caption: match[3] || ''
      };
    },
    toBlock(obj) {
      const src = obj.src || '';
      const title = obj.title || '';
      const caption = obj.caption ? '\n*' + obj.caption + '*' : '';
      return '[audio](' + src + ')\n<!-- title:' + title + ' -->' + caption;
    },
    toPreview(obj) {
      const title = obj.title ? '<strong>' + escapeHtml(obj.title) + '</strong>' : '';
      const caption = obj.caption ? '<div>' + escapeHtml(obj.caption) + '</div>' : '';
      return (
        '<figure>' +
        title +
        '<audio controls preload="metadata" src="' +
        escapeHtml(obj.src || '') +
        '"></audio>' +
        caption +
        '</figure>'
      );
    }
  });

  /* ============================================================
     2. 插入到游標位置的工具（音訊上傳用）
     ============================================================ */
  const lastSelection = { textarea: null, start: 0, end: 0 };

  const rememberSelection = (el) => {
    if (!el || el.tagName !== 'TEXTAREA') return;
    lastSelection.textarea = el;
    lastSelection.start = Number.isFinite(el.selectionStart) ? el.selectionStart : el.value.length;
    lastSelection.end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : el.value.length;
  };

  const findEditorTextarea = () => {
    if (lastSelection.textarea && document.contains(lastSelection.textarea)) {
      return lastSelection.textarea;
    }
    const candidates = Array.from(document.querySelectorAll('textarea')).filter((el) => el.offsetParent !== null);
    return candidates[0] || null;
  };

  const insertAtCursor = (markdown) => {
    const el = findEditorTextarea();
    if (!el) throw new Error('找不到文章編輯區（textarea）');
    const value = el.value || '';
    const start = Number.isFinite(lastSelection.start) ? lastSelection.start : value.length;
    const end = Number.isFinite(lastSelection.end) ? lastSelection.end : start;
    const prefix = value.slice(0, start);
    const suffix = value.slice(end);
    const leading = prefix && !prefix.endsWith('\n') ? '\n' : '';
    const trailing = suffix && !suffix.startsWith('\n') ? '\n' : '';
    const block = leading + markdown + trailing;
    const next = prefix + block + suffix;
    el.value = next;
    const caret = prefix.length + block.length;
    el.selectionStart = caret;
    el.selectionEnd = caret;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
    rememberSelection(el);
  };

  const wrapSelection = (before, after = before, fallback = '文字') => {
    const el = findEditorTextarea();
    if (!el) throw new Error('找不到文章編輯區（textarea）');
    const value = el.value || '';
    const start = Number.isFinite(lastSelection.start) ? lastSelection.start : el.selectionStart || value.length;
    const end = Number.isFinite(lastSelection.end) ? lastSelection.end : el.selectionEnd || start;
    const selected = value.slice(start, end) || fallback;
    const nextBlock = before + selected + after;
    el.value = value.slice(0, start) + nextBlock + value.slice(end);
    el.selectionStart = start + before.length;
    el.selectionEnd = start + before.length + selected.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
    rememberSelection(el);
  };

  const prefixLine = (prefix, fallback = '文字') => {
    const el = findEditorTextarea();
    if (!el) throw new Error('找不到文章編輯區（textarea）');
    const value = el.value || '';
    const start = Number.isFinite(lastSelection.start) ? lastSelection.start : el.selectionStart || value.length;
    const end = Number.isFinite(lastSelection.end) ? lastSelection.end : el.selectionEnd || start;
    const selected = value.slice(start, end) || fallback;
    const block = selected
      .split('\n')
      .map((line) => prefix + line)
      .join('\n');
    el.value = value.slice(0, start) + block + value.slice(end);
    el.selectionStart = start + prefix.length;
    el.selectionEnd = start + block.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
    rememberSelection(el);
  };

  const escapeMd = (input) =>
    String(input == null ? '' : input).replaceAll('\n', ' ').replaceAll('\r', ' ').replaceAll('*', '\\*');

  const fileTitle = (name) => String(name || '未命名音訊').replace(/\.[^.]+$/, '');

  const getCmsToken = () => {
    try {
      const raw =
        window.localStorage.getItem('decap-cms-user') || window.localStorage.getItem('netlify-cms-user');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return '';
      if (parsed.token) return parsed.token;
      if (parsed.access_token) return parsed.access_token;
      if (parsed.auth && parsed.auth.token) return parsed.auth.token;
    } catch (err) {
      console.warn('讀取 CMS token 失敗', err);
    }
    return '';
  };

  const commentsRequest = async (path, options = {}) => {
    const token = getCmsToken();
    if (!token) throw new Error('尚未登入 CMS');
    const headers = Object.assign(
      { Authorization: 'Bearer ' + token },
      options.body ? { 'Content-Type': 'application/json' } : {},
      options.headers || {}
    );
    const res = await fetch(path, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '評論請求失敗');
    return data;
  };

  const openCommentsManager = () => {
    let modal = document.querySelector('.comments-admin-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.className = 'comments-admin-modal';
    modal.innerHTML = `
      <div class="comments-admin-backdrop" data-comments-close></div>
      <section class="comments-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="commentsAdminTitle">
        <header class="comments-admin-header">
          <div>
            <h2 id="commentsAdminTitle">評論審核</h2>
            <p>只顯示必要資料；電郵、IP 與瀏覽器資訊不在後台明文展示。</p>
          </div>
          <button type="button" class="comments-admin-close" data-comments-close aria-label="關閉">×</button>
        </header>
        <div class="comments-admin-toolbar">
          <button type="button" data-comments-status="pending">待審核</button>
          <button type="button" data-comments-status="approved">已通過</button>
          <button type="button" data-comments-status="hidden">已隱藏</button>
          <button type="button" data-comments-status="all">全部</button>
        </div>
        <div class="comments-admin-status" data-comments-admin-status>載入中…</div>
        <div class="comments-admin-list" data-comments-admin-list></div>
      </section>
    `;
    document.body.appendChild(modal);

    const list = modal.querySelector('[data-comments-admin-list]');
    const status = modal.querySelector('[data-comments-admin-status]');
    let currentStatus = 'pending';

    const setStatus = (message, isError) => {
      status.textContent = message || '';
      status.classList.toggle('is-error', Boolean(isError));
    };

    const render = (comments) => {
      if (!comments.length) {
        list.innerHTML = '<p class="comments-admin-empty">此分類暫無評論。</p>';
        return;
      }
      list.innerHTML = comments
        .map((item) => `
          <article class="comments-admin-item" data-comment-id="${escapeHtml(item.id)}">
            <div class="comments-admin-item__meta">
              <strong>${escapeHtml(item.authorName || '讀者')}</strong>
              <span>${escapeHtml(item.slug || '')}</span>
              <span>${escapeHtml(item.status || '')}</span>
              <time>${escapeHtml(String(item.createdAt || '').slice(0, 10))}</time>
            </div>
            <p>${escapeHtml(item.body || '')}</p>
            <div class="comments-admin-actions">
              <button type="button" data-comment-action="approved">通過</button>
              <button type="button" data-comment-action="hidden">隱藏</button>
              <button type="button" data-comment-action="spam">垃圾</button>
              <button type="button" data-comment-action="delete">刪除</button>
            </div>
          </article>
        `)
        .join('');
    };

    const load = async () => {
      setStatus('載入中…', false);
      list.innerHTML = '';
      try {
        const data = await commentsRequest('/api/comments/admin?status=' + encodeURIComponent(currentStatus));
        render(Array.isArray(data.comments) ? data.comments : []);
        setStatus('', false);
      } catch (err) {
        setStatus(err && err.message ? err.message : '載入評論失敗', true);
      }
    };

    modal.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('[data-comments-close]')) {
        modal.remove();
        return;
      }
      const nextStatus = target.getAttribute('data-comments-status');
      if (nextStatus) {
        currentStatus = nextStatus;
        await load();
        return;
      }
      const action = target.getAttribute('data-comment-action');
      if (!action) return;
      const item = target.closest('[data-comment-id]');
      const id = item && item.getAttribute('data-comment-id');
      if (!id) return;
      target.disabled = true;
      try {
        if (action === 'delete') {
          await commentsRequest('/api/comments/' + encodeURIComponent(id), { method: 'DELETE' });
        } else {
          await commentsRequest('/api/comments/' + encodeURIComponent(id), {
            method: 'PATCH',
            body: JSON.stringify({ status: action })
          });
        }
        await load();
      } catch (err) {
        setStatus(err && err.message ? err.message : '操作失敗', true);
      } finally {
        target.disabled = false;
      }
    });

    load();
  };

  const uploadImageToCloudflare = async (file, onProgress) => {
    const token = getCmsToken();
    if (!token) throw new Error('尚未登入 CMS，請先登入後再上傳圖片');
    if (!file || !String(file.type || '').startsWith('image/')) {
      throw new Error('請選擇圖片檔案');
    }

    const form = new FormData();
    form.append('file', file, file.name || 'image.png');
    if (typeof onProgress === 'function') onProgress('正在上傳圖片…');

    const res = await fetch('/api/r2-media-upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: form
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '圖片上傳到 Cloudflare 失敗');
    if (!data.publicUrl) throw new Error('圖片上傳成功但缺少公開網址');
    return data.publicUrl;
  };

  const createR2ImageMediaLibrary = () => ({
    name: 'crivu-r2-images',
    init({ handleInsert }) {
      let modal = null;
      let activeControlId = '';

      const removeModal = () => {
        if (modal) modal.remove();
        modal = null;
        activeControlId = '';
      };

      const setStatus = (message, isError) => {
        if (!modal) return;
        const status = modal.querySelector('[data-r2-media-status]');
        if (!status) return;
        status.textContent = message || '';
        status.classList.toggle('is-error', Boolean(isError));
      };

      const insertUrl = (url) => {
        const cleanUrl = String(url || '').trim();
        if (!cleanUrl) {
          setStatus('請先上傳圖片或輸入圖片網址', true);
          return;
        }
        handleInsert(cleanUrl);
        removeModal();
      };

      const buildModal = (options = {}) => {
        removeModal();
        activeControlId = options.id || '';

        modal = document.createElement('div');
        modal.className = 'r2-media-modal';
        modal.innerHTML = `
          <div class="r2-media-backdrop" data-r2-media-close></div>
          <section class="r2-media-dialog" role="dialog" aria-modal="true" aria-labelledby="r2MediaTitle">
            <header class="r2-media-header">
              <div>
                <h2 id="r2MediaTitle">選擇圖片</h2>
                <p>圖片會上傳到 Cloudflare R2，內容保存時只寫入圖片網址。</p>
              </div>
              <button type="button" class="r2-media-close" data-r2-media-close aria-label="關閉">×</button>
            </header>
            <div class="r2-media-body">
              <label class="r2-media-drop">
                <input type="file" accept="image/*" data-r2-media-file />
                <span>點擊選擇圖片</span>
                <small>支援 JPG、PNG、WebP、GIF、SVG、AVIF，單檔上限依部署環境設定。</small>
              </label>
              <div class="r2-media-url-row">
                <input type="url" placeholder="或貼上現有圖片網址" value="${escapeHtml(options.value || '')}" data-r2-media-url />
                <button type="button" data-r2-media-insert-url>使用網址</button>
              </div>
              <div class="r2-media-status" data-r2-media-status></div>
            </div>
          </section>
        `;

        modal.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (target.matches('[data-r2-media-close]')) removeModal();
          if (target.matches('[data-r2-media-insert-url]')) {
            insertUrl(modal.querySelector('[data-r2-media-url]')?.value || '');
          }
        });

        modal.querySelector('[data-r2-media-file]')?.addEventListener('change', async (event) => {
          const input = event.target;
          const file = input && input.files && input.files[0];
          if (!file) return;
          const drop = modal.querySelector('.r2-media-drop');
          if (drop) drop.classList.add('is-busy');
          try {
            const url = await uploadImageToCloudflare(file, (message) => setStatus(message, false));
            setStatus('圖片已上傳，正在插入…', false);
            insertUrl(url);
          } catch (err) {
            console.error(err);
            setStatus(err && err.message ? err.message : '圖片上傳失敗', true);
          } finally {
            if (drop) drop.classList.remove('is-busy');
            input.value = '';
          }
        });

        document.body.appendChild(modal);
        setTimeout(() => modal?.querySelector('[data-r2-media-file]')?.focus(), 0);
      };

      return {
        show: buildModal,
        hide: removeModal,
        enableStandalone() {},
        onClearControl({ id } = {}) {
          if (!id || id === activeControlId) removeModal();
        },
        onRemoveControl({ id } = {}) {
          if (!id || id === activeControlId) removeModal();
        }
      };
    }
  });

  CMS.registerMediaLibrary(createR2ImageMediaLibrary());

  const uploadAudioToCloudflare = async (file) => {
    const token = getCmsToken();
    if (!token) throw new Error('尚未登入 CMS，請先登入後再上傳音訊');

    const signRes = await fetch('/api/r2-upload-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size
      })
    });
    const signJson = await signRes.json().catch(() => ({}));
    if (!signRes.ok) throw new Error(signJson.error || '取得 Cloudflare 上傳簽名失敗');

    const putRes = await fetch(signJson.uploadUrl, {
      method: signJson.method || 'PUT',
      headers: signJson.headers || { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!putRes.ok) throw new Error('上傳到 Cloudflare 失敗（' + putRes.status + '）');

    return signJson.publicUrl;
  };

  /* ============================================================
     3. 右下角浮動工具列
     ============================================================ */
  const mountFabCluster = () => {
    if (document.querySelector('.cms-fab-cluster')) return;

    const cluster = document.createElement('div');
    cluster.className = 'cms-fab-cluster';

    const mdTools = document.createElement('div');
    mdTools.className = 'cms-md-tools';
    mdTools.innerHTML = `
      <div class="cms-md-tools__title">Markdown 快捷</div>
      <button type="button" data-md-action="bold">**粗體**</button>
      <button type="button" data-md-action="h2">## 標題</button>
      <button type="button" data-md-action="quote">&gt; 引用</button>
      <button type="button" data-md-action="list">- 列表</button>
      <button type="button" data-md-action="link">[連結](url)</button>
      <button type="button" data-md-action="code">\`代碼\`</button>
      <button type="button" data-md-action="red">[紅字]{red}</button>
      <button type="button" data-md-action="mark">==標記==</button>
    `;
    mdTools.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute('data-md-action');
      if (!action) return;
      try {
        if (action === 'bold') wrapSelection('**', '**', '重點文字');
        if (action === 'h2') prefixLine('## ', '小標題');
        if (action === 'quote') prefixLine('> ', '引用文字');
        if (action === 'list') prefixLine('- ', '列表項目');
        if (action === 'link') wrapSelection('[', '](https://)', '連結文字');
        if (action === 'code') wrapSelection('`', '`', '代碼');
        if (action === 'red') wrapSelection('[', ']{red}', '紅色文字');
        if (action === 'mark') wrapSelection('==', '==', '重點標記');
      } catch (err) {
        alert(err && err.message ? err.message : '插入 Markdown 失敗');
      }
    });

    // 音訊上傳按鈕（原本就有，保留）
    const audioBtn = document.createElement('button');
    audioBtn.type = 'button';
    audioBtn.id = 'cfAudioUploadButton';
    audioBtn.className = 'fab-primary';
    audioBtn.innerHTML = '🎵 上傳音訊';

    audioBtn.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac';
      fileInput.onchange = async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const originalHtml = audioBtn.innerHTML;
        audioBtn.disabled = true;
        audioBtn.innerHTML = '上傳中…';
        try {
          const publicUrl = await uploadAudioToCloudflare(file);
          const title = escapeMd(fileTitle(file.name));
          const markdown = '[audio](' + publicUrl + ')\n<!-- title:' + title + ' -->';
          insertAtCursor(markdown);
          audioBtn.innerHTML = '✓ 已插入音訊';
          setTimeout(() => {
            audioBtn.innerHTML = originalHtml;
            audioBtn.disabled = false;
          }, 1400);
        } catch (err) {
          console.error(err);
          alert(err && err.message ? err.message : '音訊上傳失敗');
          audioBtn.innerHTML = originalHtml;
          audioBtn.disabled = false;
        }
      };
      fileInput.click();
    });

    // 在新分頁預覽正式站
    const siteLink = document.createElement('a');
    siteLink.target = '_blank';
    siteLink.rel = 'noopener';
    siteLink.href = 'https://cbc688.com/';
    siteLink.innerHTML = '🌐 預覽網站';

    cluster.appendChild(mdTools);
    cluster.appendChild(audioBtn);

    const commentsBtn = document.createElement('button');
    commentsBtn.type = 'button';
    commentsBtn.innerHTML = '💬 評論審核';
    commentsBtn.addEventListener('click', openCommentsManager);
    cluster.appendChild(commentsBtn);

    cluster.appendChild(siteLink);
    document.body.appendChild(cluster);
  };

  /* ============================================================
     4. （已移除）站點設定頁的浮動說明卡
     ============================================================ */

  /* ============================================================
     5. 顏色欄位即時色塊
     ============================================================ */
  const attachColorSwatches = () => {
    document.querySelectorAll('input[type="text"]').forEach((input) => {
      if (input.dataset.swatchAttached) return;
      const labelText = input.closest('[class*="EditorControl"]')?.querySelector('[class*="ControlLabel"]')?.textContent || '';
      if (!labelText.includes('強調色') && !labelText.includes('色碼')) return;

      input.dataset.swatchAttached = '1';
      const wrapper = input.parentElement;
      if (!wrapper) return;
      wrapper.classList.add('cms-color-field');
      const swatch = document.createElement('span');
      swatch.className = 'cms-color-swatch';
      wrapper.appendChild(swatch);

      const sync = () => {
        const v = String(input.value || '').trim();
        swatch.style.background = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : 'transparent';
      };
      sync();
      input.addEventListener('input', sync);
      input.addEventListener('change', sync);
    });
  };

  /* ============================================================
     6. 事件綁定
     ============================================================ */
  ['focusin', 'click', 'keyup', 'select'].forEach((evt) => {
    document.addEventListener(evt, (e) => rememberSelection(e.target), true);
  });

  const onRouteChange = () => {
    // 色塊會在 CMS 重新渲染輸入框後失效，重綁一次
    attachColorSwatches();
  };
  window.addEventListener('hashchange', onRouteChange);

  // DOM 變動時重跑一次小工具（CMS 會動態換頁）
  let tick = 0;
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(tick);
    tick = requestAnimationFrame(() => {
      attachColorSwatches();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  /* ============================================================
     7. Boot
     ============================================================ */
  const boot = () => {
    const config = window.DECAP_CMS_CONFIG || window.CMS_CONFIG;
    if (config) {
      if (window.CMS_CONFIG) {
        try { delete window.CMS_CONFIG; } catch { window.CMS_CONFIG = undefined; }
      }
      CMS.init({ config });
    }
    mountFabCluster();
    onRouteChange();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
