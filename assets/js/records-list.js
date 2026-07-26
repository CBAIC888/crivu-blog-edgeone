const grid = document.querySelector('.records-grid');

if (grid && grid.childElementCount === 0) {
  fetch('/posts/records.json')
    .then((response) => response.json())
    .then((data) => {
      const escapeHtml = (value) =>
        String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
      const recordHref = (record) => {
        const standalone = String(record?.page || '').trim();
        return standalone.startsWith('/') ? standalone : `/records/${encodeURIComponent(record?.id || '')}`;
      };
      grid.innerHTML = (data.records || []).filter((record) => record?.published === true).map((record) => `
        <a class="book record-book" href="${escapeHtml(recordHref(record))}" aria-label="${escapeHtml(record.title || '')}">
          <div class="book__cover"><img src="${escapeHtml(record.cover || '')}" alt="" loading="lazy" decoding="async" /></div>
          <div class="book__meta">
            ${record.date ? `<p class="book__id">${escapeHtml(String(record.date).slice(0, 10))}</p>` : ''}
            <p class="book__title">${escapeHtml(record.title || '')}</p>
            <p class="book__theme">${escapeHtml(record.summary || '')}</p>
          </div>
        </a>`).join('');
    })
    .catch(() => {});
}
