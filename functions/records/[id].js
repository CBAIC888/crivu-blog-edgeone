import {
  escapeHtml,
  isPublished,
  normalizeText,
  safeCoverUrl,
  sanitizeUrl,
  toDisplayDate,
} from '../../shared/content.js';
import {
  PAGE_HEADERS,
  loadSiteBundle,
  renderPageShell,
} from '../../shared/site-pages.js';

const renderNotFound = (site) =>
  renderPageShell({
    bodyClass: 'page-record',
    currentPath: '/records.html',
    description: '找不到這項專題紀錄。',
    mainHtml: `<main class="page-list records-page">
      <header class="page-head">
        <h1 class="page-title">紀錄未找到</h1>
        <p class="page-intro">這項紀錄可能尚未發布、已更名，或網址有誤。<a href="/records.html">返回紀錄列表</a>。</p>
      </header>
    </main>`,
    site,
    title: '紀錄未找到 · CRIVU',
  });

const renderVideo = (video) => {
  const url = sanitizeUrl(video.url, { allowHash: false });
  const isExternal = /^https?:\/\//i.test(url);
  return `<a class="record-video" href="${escapeHtml(url)}"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>
    <span class="record-video__media">
      <img src="${escapeHtml(safeCoverUrl(video.cover))}" alt="" loading="lazy" decoding="async" />
      <span class="record-video__play" aria-hidden="true">
        <svg viewBox="0 0 48 48" focusable="false"><path d="M18 13.5 36 24 18 34.5Z" fill="currentColor"/></svg>
      </span>
    </span>
    <span class="record-video__title">${escapeHtml(video.title || '')}</span>
    <span class="record-video__description">${escapeHtml(normalizeText(video.description) || '')}</span>
  </a>`;
};

const renderPhoto = (photo, index) => {
  const image = safeCoverUrl(photo.image);
  return `<article class="record-photo">
    <button class="record-photo__button" type="button"
      data-lightbox-index="${index}"
      data-lightbox-src="${escapeHtml(image)}"
      data-lightbox-alt="${escapeHtml(photo.alt || '')}"
      data-lightbox-description="${escapeHtml(normalizeText(photo.description) || '')}"
      aria-label="放大查看：${escapeHtml(photo.alt || `照片 ${index + 1}`)}">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(photo.alt || '')}" loading="lazy" decoding="async" />
    </button>
  </article>`;
};

export async function onRequest(context) {
  const data = await loadSiteBundle(context);
  const id = normalizeText(context.params?.id, { allowPlaceholder: true });
  const record = data.records.find((item) => String(item.id) === id);

  if (!record) {
    return new Response(renderNotFound(data.site), {
      status: 404,
      headers: PAGE_HEADERS,
    });
  }

  const videos = Array.isArray(record.videos) ? record.videos.filter(isPublished) : [];
  const photos = Array.isArray(record.photos) ? record.photos.filter(isPublished) : [];
  const mainHtml = `<main class="record-detail">
    <section class="record-hero">
      <figure class="record-hero__cover">
        <img src="${escapeHtml(safeCoverUrl(record.cover))}" alt="${escapeHtml(record.title || '')}" decoding="async" fetchpriority="high" />
      </figure>
      <div class="record-hero__title">
        <h1>${escapeHtml(record.title || '')}</h1>
      </div>
      <dl class="record-hero__facts">
        <div><dt>專題紀錄</dt><dd>建立日 ${escapeHtml(toDisplayDate(record.date))}</dd></div>
        <div><dt>主編</dt><dd>${escapeHtml(data.site.siteName || 'CRIVU')}</dd></div>
        <div><dt>收錄</dt><dd>${videos.length} 部影片 · ${photos.length} 張照片</dd></div>
      </dl>
      <p class="record-hero__summary">${escapeHtml(normalizeText(record.summary) || '')}</p>
    </section>

    ${videos.length ? `<section class="record-section">
      <h2 class="record-section__title">視頻</h2>
      <div class="record-video-grid">${videos.map(renderVideo).join('')}</div>
    </section>` : ''}

    ${photos.length ? `<section class="record-section record-section--photos">
      <h2 class="record-section__title">照片</h2>
      <div class="record-photo-list" data-scroll-rail>${photos.map(renderPhoto).join('')}</div>
    </section>` : ''}

    <div class="lightbox" id="recordLightbox" hidden aria-hidden="true">
      <button class="lightbox__backdrop" type="button" data-lightbox-close aria-label="關閉圖片"></button>
      <div class="lightbox__dialog" role="dialog" aria-modal="true" aria-label="照片預覽">
        <div class="lightbox__stage">
          <button class="lightbox__nav lightbox__nav--prev" type="button" data-lightbox-prev aria-label="上一張照片">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <img id="recordLightboxImage" src="" alt="" />
          <button class="lightbox__nav lightbox__nav--next" type="button" data-lightbox-next aria-label="下一張照片">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="lightbox__info">
          <span class="lightbox__counter" id="recordLightboxCounter"></span>
          <p class="lightbox__caption" id="recordLightboxCaption"></p>
        </div>
        <button class="lightbox__close" type="button" data-lightbox-close aria-label="關閉圖片">×</button>
      </div>
    </div>
  </main>`;

  return new Response(
    renderPageShell({
      bodyClass: 'page-record',
      currentPath: `/records/${encodeURIComponent(id)}`,
      description: normalizeText(record.summary) || record.title || '專題紀錄',
      mainHtml,
      ogImage: safeCoverUrl(record.cover),
      scriptSrc: '/assets/js/records.js',
      site: data.site,
      title: `${record.title || '紀錄'} · ${data.site.siteName || 'CRIVU'}`,
    }),
    { headers: PAGE_HEADERS }
  );
}
