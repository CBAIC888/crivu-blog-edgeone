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
      grid.innerHTML = (data.records || []).filter((record) => record?.published === true).map((record) => `
        <a class="record-card" href="/records/${encodeURIComponent(record.id || '')}">
          <span class="record-card__media"><img src="${escapeHtml(record.cover || '')}" alt="" loading="lazy" decoding="async" /></span>
          <span class="record-card__title">${escapeHtml(record.title || '')}</span>
          <span class="record-card__summary">${escapeHtml(record.summary || '')}</span>
        </a>`).join('');
    })
    .catch(() => {});
}
