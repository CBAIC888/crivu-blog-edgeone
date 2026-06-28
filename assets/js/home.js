const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const stripMarkdown = (value) =>
  String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_>`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const bindExpand = () => {
  const list = document.querySelector('#homePostList');
  const button = document.querySelector('#homeExpandButton');
  if (!list || !button || button.dataset.bound) return;
  button.dataset.bound = '1';
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    list.classList.toggle('is-expanded', !expanded);
    button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    button.textContent = expanded ? '展開全部文章' : '收起文章';
  });
};

const renderStaticFallback = async () => {
  const issueRail = document.querySelector('.home-issue-rail');
  const postList = document.querySelector('#homePostList');
  const recordRail = document.querySelector('.record-rail');
  if (!issueRail || !postList || !recordRail) return;
  if (issueRail.childElementCount || postList.childElementCount || recordRail.childElementCount) return;

  const [issuesRes, postsRes, recordsRes] = await Promise.all([
    fetch('/posts/issues.json'),
    fetch('/posts/posts.json'),
    fetch('/posts/records.json'),
  ]);
  const issues = ((await issuesRes.json()).issues || []).filter((issue) => issue?.published !== false);
  const postsData = await postsRes.json();
  const posts = (postsData.items || postsData || [])
    .filter((post) => post?.published !== false)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const records = ((await recordsRes.json()).records || []).filter((record) => record?.published === true);

  issueRail.innerHTML = issues.map((issue) => `
    <a class="home-cover" href="/issues/${encodeURIComponent(issue.id || '')}" aria-label="${escapeHtml(issue.title || '')}">
      <img src="${escapeHtml(issue.cover || '')}" alt="${escapeHtml(issue.title || '')}" loading="lazy" decoding="async" />
    </a>`).join('');

  postList.innerHTML = posts.map((post, index) => {
    const excerpt = String(post.excerpt || '').trim() || stripMarkdown(post.body).slice(0, 80);
    const cover = String(post.cover || '').trim();
    return `<li class="home-article-item${index >= 5 ? ' is-collapsed' : ''} toc__row${cover ? '' : ' toc__row--no-cover'}">
      <span class="toc__num">${String(index + 1).padStart(2, '0')}</span>
      <div class="toc__body">
        <p class="toc__meta"><span class="cap">${escapeHtml(String(post.date || '').slice(0, 10))}</span></p>
        <h3 class="toc__title"><a href="/articles/${encodeURIComponent(post.slug || '')}">${escapeHtml(post.title || '')}</a></h3>
        ${excerpt ? `<p class="toc__excerpt">${escapeHtml(excerpt)}${excerpt.length >= 80 ? '…' : ''}</p>` : ''}
      </div>
      ${cover ? `<a class="toc__thumb" href="/articles/${encodeURIComponent(post.slug || '')}" aria-hidden="true"><img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" /></a>` : ''}
    </li>`;
  }).join('');

  if (posts.length > 5 && !document.querySelector('#homeExpandButton')) {
    postList.insertAdjacentHTML('afterend', '<div class="home-expand"><button class="text-button" id="homeExpandButton" type="button" aria-expanded="false">展開全部文章</button></div>');
  }

  const recordSection = recordRail.closest('.home-section--records');
  if (recordSection) recordSection.hidden = records.length === 0;
  recordRail.innerHTML = records.map((record) => `
    <a class="record-card record-card--rail" href="/records/${encodeURIComponent(record.id || '')}">
      <span class="record-card__media"><img src="${escapeHtml(record.cover || '')}" alt="" loading="lazy" decoding="async" /></span>
      <span class="record-card__title">${escapeHtml(record.title || '')}</span>
    </a>`).join('');
};

renderStaticFallback().catch(() => {}).finally(bindExpand);
bindExpand();
