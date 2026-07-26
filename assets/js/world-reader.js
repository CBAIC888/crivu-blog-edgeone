(() => {
  const desktop = matchMedia('(min-width: 901px)');
  const wideSpread = matchMedia('(min-width: 901px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const article = document.querySelector('.article-layout > .article');
  const toc = document.querySelector('#articleToc');
  if (!article || !toc) return;
  const archive = document.querySelector('#gallery');
  const archiveGrid = archive?.querySelector('.archive-grid');
  const galleryAction = document.querySelector('[data-view="gallery"]');
  const heroActions = document.querySelector('.hero-actions');
  const shareAction = document.querySelector('#sharePageButton');
  const heroCoverImage = document.querySelector('.hero-cover img');
  const heroFacts = Array.from(document.querySelectorAll('.record-hero-facts dd'));
  const archiveFact = heroFacts.find((item) => item.textContent.includes('图像档案'));
  const archiveCards = archiveGrid
    ? Array.from(archiveGrid.querySelectorAll('[data-archive-card]'))
    : [];

  if (galleryAction) galleryAction.hidden = true;

  if (heroActions && shareAction && !heroActions.querySelector('.hero-more')) {
    const more = document.createElement('div');
    more.className = 'hero-more';
    more.innerHTML = `
      <button class="secondary-action hero-more__trigger" type="button" aria-expanded="false" aria-haspopup="menu" aria-controls="recordMoreMenu">
        <span>查看更多</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.25 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="hero-more__menu" id="recordMoreMenu" role="menu" hidden>
        <a href="/records.html" role="menuitem"><span>其他紀錄</span><small>Records</small></a>
        <a href="/issues.html" role="menuitem"><span>期刊</span><small>Issues</small></a>
        <a href="/articles.html" role="menuitem"><span>文章</span><small>Articles</small></a>
      </div>
    `;
    shareAction.insertAdjacentElement('afterend', more);

    const trigger = more.querySelector('.hero-more__trigger');
    const menu = more.querySelector('.hero-more__menu');
    const closeMenu = (restoreFocus = false) => {
      if (menu.hidden) return;
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    };
    const openMenu = () => {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    };

    trigger.addEventListener('click', () => {
      if (menu.hidden) openMenu();
      else closeMenu();
    });
    document.addEventListener('pointerdown', (event) => {
      if (!more.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu(true);
    });
  }

  const reader = document.createElement('section');
  reader.className = 'book-reader is-cover';
  reader.setAttribute('aria-label', '文章閱讀區');
  reader.innerHTML = `
    <div class="book-reader__stage">
      <button class="book-reader__chrome book-reader__turn book-reader__turn--prev" type="button" aria-label="上一頁" title="上一頁（←）">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="book-reader__pages">
        <div class="book-reader__leaf" aria-hidden="true"></div>
        <button class="book-reader__cover" type="button" aria-label="翻开《世界》专题，进入正文">
          <span class="book-reader__cover-sheet">
            <img src="${heroCoverImage?.currentSrc || heroCoverImage?.src || '/assets/img/uploads/20260723/world-word-exploration-cover.png'}" alt="《世界》语言史专题封面">
          </span>
          <span class="book-reader__cover-hint">點擊封面翻開</span>
        </button>
      </div>
      <button class="book-reader__chrome book-reader__turn book-reader__turn--next" type="button" aria-label="下一頁" title="下一頁（→）">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <footer class="book-reader__chrome book-reader__footer">
      <span class="book-reader__status" aria-live="polite">第 1 頁</span>
      <span class="book-reader__progress" aria-hidden="true"><span></span></span>
      <span class="book-reader__hint">方向鍵翻頁</span>
      <button class="book-reader__chrome book-reader__fullscreen" type="button" aria-label="進入全屏閱讀" aria-pressed="false">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7 3H3v4M13 3h4v4M7 17H3v-4M13 17h4v-4" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>全屏閱讀</span>
      </button>
    </footer>
  `;

  article.before(reader);
  reader.querySelector('.book-reader__pages').prepend(article);

  const previous = reader.querySelector('.book-reader__turn--prev');
  const next = reader.querySelector('.book-reader__turn--next');
  const status = reader.querySelector('.book-reader__status');
  const progress = reader.querySelector('.book-reader__progress span');
  const leaf = reader.querySelector('.book-reader__leaf');
  const readerCover = reader.querySelector('.book-reader__cover');
  const readerCoverSheet = reader.querySelector('.book-reader__cover-sheet');
  const fullscreenButton = reader.querySelector('.book-reader__fullscreen');
  const fullscreenLabel = fullscreenButton.querySelector('span');
  const sections = Array.from(article.querySelectorAll('.article-section[id]'));
  const tocLinks = Array.from(toc.querySelectorAll('a[href^="#"]'));
  const mobileTocLinks = document.querySelector('#mobileTocLinks');
  const mobileTocCurrent = document.querySelector('#mobileTocCurrent');

  let current = 0;
  let total = 1;
  let step = 1;
  let columnAdvance = 1;
  let articlePaddingStart = 0;
  let settleTimer = 0;
  let isTurning = false;
  let onCover = true;
  let alignedSection = null;
  let columnSpacer = null;
  let mediaMounted = false;
  let immersive = false;
  let immersiveScrollY = 0;
  let stableReaderScrollY = scrollY;

  const mediaPlacements = [
    { section: 'article-01', after: '世传明帝梦见金人', cards: [8, 9] },
    { section: 'article-01', after: '安世高、支娄迦谶', cards: [1] },
    { section: 'article-03', after: '协作性质', cards: [4, 15] },
    { section: 'article-03', after: '支娄迦谶便活动', cards: [2, 3] },
    { section: 'article-03', after: '翻译的重要环境', cards: [14] },
    { section: 'article-04', after: '先看lokadhātu', cards: [16] },
    { section: 'article-06', after: '名一小千界', cards: [6] },
    { section: 'article-08', after: '明治时期的日本', cards: [5, 7] },
    { section: 'article-08', after: '一八二二年', cards: [10, 11] },
    { section: 'article-08', after: '一八九五年以后，它的出现频率', cards: [12, 13] },
    { section: 'article-09', after: '今天的「世界」', cards: [0] },
  ];

  const mountInlineMedia = () => {
    if (mediaMounted || !archiveGrid || archiveCards.length === 0) return;

    mediaPlacements.forEach((placement) => {
      const section = document.getElementById(placement.section);
      if (!section) return;
      const pair = document.createElement('div');
      pair.className = 'article-media-pair';
      pair.dataset.count = String(placement.cards.length);
      pair.setAttribute('role', 'group');
      pair.setAttribute('aria-label', '本节图像资料');
      placement.cards.forEach((index) => {
        if (archiveCards[index]) pair.append(archiveCards[index]);
      });
      const anchor = Array.from(section.querySelectorAll(':scope > p'))
        .find((paragraph) => paragraph.textContent.includes(placement.after));
      if (anchor) anchor.insertAdjacentElement('afterend', pair);
      else section.append(pair);
    });

    archive.hidden = true;
    if (archiveFact) archiveFact.textContent = '正文 · 互动展览 · 图文资料';
    mediaMounted = true;
  };

  const sectionPage = (section) => {
    if (!section || !desktop.matches) return 0;
    return Math.max(
      0,
      Math.min(total - 1, Math.round((section.offsetLeft - articlePaddingStart) / step))
    );
  };

  const activeSection = () => {
    const probe = current * step + Math.max(1, article.clientWidth * .12);
    let active = sections[0];
    sections.forEach((section) => {
      if (section.offsetLeft <= probe + 2) active = section;
    });
    return active;
  };

  const render = () => {
    current = Math.max(0, Math.min(total - 1, current));
    previous.disabled = onCover;
    next.disabled = !onCover && current >= total - 1;
    status.textContent = onCover
      ? '封面'
      : wideSpread.matches
        ? `第 ${current + 1} / ${total} 跨頁`
        : `第 ${current + 1} / ${total} 頁`;
    progress.style.transform = `scaleX(${onCover ? 0 : total <= 1 ? 1 : current / (total - 1)})`;

    const active = activeSection();
    const allTocLinks = [
      ...tocLinks,
      ...(mobileTocLinks ? Array.from(mobileTocLinks.querySelectorAll('a[href^="#"]')) : []),
    ];
    allTocLinks.forEach((link) => {
      const selected = link.getAttribute('href') === `#${active?.id}`;
      link.classList.toggle('is-current', selected);
      if (selected) {
        link.setAttribute('aria-current', 'location');
        const index = link.querySelector('span')?.textContent?.trim();
        if (index && mobileTocCurrent) mobileTocCurrent.textContent = index;
      }
      else link.removeAttribute('aria-current');
    });
  };

  const turnTo = (index) => {
    if (!desktop.matches) return;
    current = Math.max(0, Math.min(total - 1, index));
    const left = Math.min(article.scrollWidth - article.clientWidth, current * step);
    article.scrollTo({ left, behavior: 'auto' });
    render();
  };

  const setCoverInstant = (visible) => {
    onCover = visible;
    readerCover.hidden = !visible;
    reader.classList.toggle('is-cover', visible);
    readerCover.removeAttribute('style');
    readerCoverSheet.removeAttribute('style');
    render();
  };

  const openBook = async (animate = true) => {
    if (!desktop.matches || !onCover || isTurning) return;
    if (!animate || reducedMotion.matches || typeof readerCoverSheet.animate !== 'function') {
      setCoverInstant(false);
      return;
    }

    isTurning = true;
    reader.setAttribute('aria-busy', 'true');
    reader.classList.remove('is-cover');
    const restingTransform = 'translate3d(-50%,0,0) rotateY(0deg)';
    const openingTransform = 'translate3d(calc(-50% - 10px),0,0) rotateY(-82deg)';
    const sheetAnimation = readerCoverSheet.animate(
      [
        { transform: restingTransform, opacity: 1 },
        { transform: openingTransform, opacity: .78 },
      ],
      { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }
    );
    const fieldAnimation = readerCover.animate(
      [{ opacity: 1 }, { opacity: 1, offset: .48 }, { opacity: 0 }],
      { duration: 220, easing: 'linear', fill: 'both' }
    );

    try {
      await Promise.all([sheetAnimation.finished, fieldAnimation.finished]);
    } catch {
      // The final state below remains authoritative if an animation is interrupted.
    } finally {
      sheetAnimation.cancel();
      fieldAnimation.cancel();
      setCoverInstant(false);
      reader.removeAttribute('aria-busy');
      isTurning = false;
    }
  };

  const closeBook = async (animate = true) => {
    if (!desktop.matches || onCover || current !== 0 || isTurning) return;
    onCover = true;
    readerCover.hidden = false;
    render();
    if (!animate || reducedMotion.matches || typeof readerCoverSheet.animate !== 'function') {
      setCoverInstant(true);
      return;
    }

    isTurning = true;
    reader.setAttribute('aria-busy', 'true');
    const restingTransform = 'translate3d(-50%,0,0) rotateY(0deg)';
    const openingTransform = 'translate3d(calc(-50% - 10px),0,0) rotateY(-82deg)';
    const sheetAnimation = readerCoverSheet.animate(
      [
        { transform: openingTransform, opacity: .78 },
        { transform: restingTransform, opacity: 1 },
      ],
      { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
    );
    const fieldAnimation = readerCover.animate(
      [{ opacity: 0 }, { opacity: 1, offset: .52 }, { opacity: 1 }],
      { duration: 220, easing: 'linear', fill: 'both' }
    );

    try {
      await Promise.all([sheetAnimation.finished, fieldAnimation.finished]);
    } catch {
      // The final state below remains authoritative if an animation is interrupted.
    } finally {
      sheetAnimation.cancel();
      fieldAnimation.cancel();
      setCoverInstant(true);
      reader.removeAttribute('aria-busy');
      isTurning = false;
    }
  };

  const turnWithEffect = async (index) => {
    if (!desktop.matches || isTurning) return;
    const destination = Math.max(0, Math.min(total - 1, index));
    if (destination === current) return;

    if (reducedMotion.matches || typeof leaf.animate !== 'function') {
      turnTo(destination);
      return;
    }

    isTurning = true;
    reader.setAttribute('aria-busy', 'true');
    const direction = destination > current ? 1 : -1;
    const isSpread = wideSpread.matches;
    leaf.style.left = direction > 0 && isSpread ? '50%' : '0';
    leaf.style.transformOrigin = direction > 0 ? 'left center' : 'right center';
    leaf.classList.add('is-turning');

    let animation;
    try {
      animation = leaf.animate(
        [
          { transform: 'translate3d(0,0,0) rotateY(0deg)', opacity: 1 },
          { transform: `translate3d(${direction > 0 ? '-10px' : '10px'},0,0) rotateY(${direction > 0 ? -82 : 82}deg)`, opacity: .78, offset: .82 },
          { transform: `translate3d(${direction > 0 ? '-10px' : '10px'},0,0) rotateY(${direction > 0 ? -82 : 82}deg)`, opacity: 0 },
        ],
        { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }
      );
      turnTo(destination);
      await animation.finished;
    } catch {
      turnTo(destination);
    } finally {
      animation?.cancel();
      leaf.classList.remove('is-turning');
      leaf.removeAttribute('style');
      reader.removeAttribute('aria-busy');
      isTurning = false;
    }
  };

  const measure = (preserve = true) => {
    if (!desktop.matches) {
      article.scrollLeft = 0;
      return;
    }

    const oldRatio = total > 1 ? current / (total - 1) : 0;
    const styles = getComputedStyle(article);
    const gap = Number.parseFloat(styles.columnGap) || 0;
    articlePaddingStart = Number.parseFloat(styles.paddingLeft) || 0;
    const paddingInline =
      articlePaddingStart +
      (Number.parseFloat(styles.paddingRight) || 0);
    const contentWidth = Math.max(1, article.clientWidth - paddingInline);
    const visibleColumns = wideSpread.matches ? 2 : 1;
    const columnWidth = (contentWidth - gap * (visibleColumns - 1)) / visibleColumns;
    columnAdvance = Math.max(1, columnWidth + gap);
    step = Math.max(1, columnAdvance * visibleColumns);
    total = Math.max(1, Math.ceil((article.scrollWidth - article.clientWidth) / step) + 1);
    current = preserve ? Math.round(oldRatio * Math.max(0, total - 1)) : 0;
    turnTo(current);
  };

  const alignChapterToLeftPage = (target) => {
    alignedSection?.classList.remove('is-chapter-start');
    columnSpacer?.remove();
    columnSpacer = null;
    alignedSection = target;
    target.classList.add('is-chapter-start');

    // Force layout once so the section's first column can be inspected.
    void article.scrollWidth;
    measure(true);

    if (wideSpread.matches) {
      const columnIndex = Math.max(
        0,
        Math.round((target.offsetLeft - articlePaddingStart) / columnAdvance)
      );
      if (columnIndex % 2 === 1) {
        columnSpacer = document.createElement('div');
        columnSpacer.className = 'book-reader__column-spacer';
        columnSpacer.setAttribute('aria-hidden', 'true');
        target.before(columnSpacer);
        void article.scrollWidth;
        measure(true);
      }
    }

    return sectionPage(target);
  };

  const elementSpread = (target) => {
    if (!target || !desktop.matches) return 0;
    const columnIndex = Math.max(
      0,
      Math.round((target.offsetLeft - articlePaddingStart) / columnAdvance)
    );
    return Math.max(
      0,
      Math.min(total - 1, Math.floor(columnIndex / 2))
    );
  };

  const isReaderInView = () => {
    const rect = reader.getBoundingClientRect();
    return rect.bottom > 80 && rect.top < innerHeight - 40;
  };

  readerCover.addEventListener('click', () => openBook(true));
  previous.addEventListener('click', () => {
    if (current === 0) closeBook(true);
    else turnWithEffect(current - 1);
  });
  next.addEventListener('click', () => {
    if (onCover) openBook(true);
    else turnWithEffect(current + 1);
  });

  article.addEventListener('click', (event) => {
    if (!desktop.matches) return;
    const link = event.target.closest('.note-ref[href^="#note-"], .article-notes .note-number[href^="#"]');
    if (!link || !article.contains(link)) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target || !article.contains(target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const readerTop = reader.getBoundingClientRect().top;
    const fixedScrollY = readerTop >= 70 ? scrollY : stableReaderScrollY;
    stableReaderScrollY = fixedScrollY;
    link.blur();

    if (link.classList.contains('note-ref')) {
      const back = target.querySelector('.note-number');
      if (back && link.id) back.setAttribute('href', `#${link.id}`);
    }

    setCoverInstant(false);
    const destination = elementSpread(target);
    const pageTurn = turnWithEffect(destination);
    history.replaceState(null, '', link.getAttribute('href'));
    const settleTarget = () => {
      const restoreReaderPosition = () => scrollTo({ top: fixedScrollY, behavior: 'auto' });
      restoreReaderPosition();
      requestAnimationFrame(restoreReaderPosition);
      window.setTimeout(restoreReaderPosition, 90);
      target.setAttribute('tabindex', '-1');
      target.classList.add('book-targeted');
      window.setTimeout(() => target.classList.remove('book-targeted'), 1500);
    };
    requestAnimationFrame(() => scrollTo({ top: fixedScrollY, behavior: 'auto' }));
    pageTurn.finally(settleTarget);
  }, true);

  const setImmersive = (enabled) => {
    if ((enabled && !desktop.matches) || immersive === enabled) return;
    immersive = enabled;
    if (enabled) immersiveScrollY = scrollY;
    document.body.classList.toggle('reader-immersive', enabled);
    fullscreenButton.setAttribute('aria-pressed', String(enabled));
    fullscreenButton.setAttribute('aria-label', enabled ? '退出全屏閱讀' : '進入全屏閱讀');
    fullscreenLabel.textContent = enabled ? '退出全屏' : '全屏閱讀';
    requestAnimationFrame(() => {
      measure(true);
      if (!enabled) scrollTo({ top: immersiveScrollY, behavior: 'auto' });
    });
  };

  fullscreenButton.addEventListener('click', () => setImmersive(!immersive));
  addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !immersive) return;
    const lightbox = document.querySelector('#lightbox');
    if (lightbox && !lightbox.hidden) return;
    event.preventDefault();
    setImmersive(false);
    fullscreenButton.focus();
  }, true);

  article.addEventListener('scroll', () => {
    if (!desktop.matches) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      current = Math.max(0, Math.min(total - 1, Math.round(article.scrollLeft / step)));
      render();
    }, 80);
  }, { passive: true });

  toc.addEventListener('click', (event) => {
    if (!desktop.matches) return;
    const link = event.target.closest('a[href^="#"]');
    const target = link && document.querySelector(link.getAttribute('href'));
    if (!target || !article.contains(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const fixedScrollY = scrollY;
    stableReaderScrollY = fixedScrollY;
    setCoverInstant(false);
    const destination = alignChapterToLeftPage(target);
    const pageTurn = turnWithEffect(destination);
    history.replaceState(null, '', link.getAttribute('href'));
    const restoreReaderPosition = () => scrollTo({ top: fixedScrollY, behavior: 'auto' });
    requestAnimationFrame(restoreReaderPosition);
    pageTurn.finally(restoreReaderPosition);
  }, true);

  addEventListener('scroll', () => {
    if (!desktop.matches) return;
    const rect = reader.getBoundingClientRect();
    if (rect.top >= 70 && rect.top < innerHeight - 120) stableReaderScrollY = scrollY;
  }, { passive: true });

  addEventListener('keydown', (event) => {
    if (!desktop.matches || !isReaderInView() || event.defaultPrevented) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'n' || event.key.toLowerCase() === 'j') {
      event.preventDefault();
      if (onCover) setCoverInstant(false);
      else turnTo(current + 1);
    } else if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'p' || event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!onCover && current === 0) setCoverInstant(true);
      else turnTo(current - 1);
    }
  });

  mountInlineMedia();
  const resizeObserver = new ResizeObserver(() => measure(true));
  resizeObserver.observe(reader.querySelector('.book-reader__pages'));
  desktop.addEventListener('change', () => {
    if (desktop.matches) {
      setCoverInstant(true);
    } else {
      setImmersive(false);
      alignedSection?.classList.remove('is-chapter-start');
      alignedSection = null;
      columnSpacer?.remove();
      columnSpacer = null;
      article.scrollLeft = 0;
    }
    measure(false);
  });
  wideSpread.addEventListener('change', () => measure(true));
  document.fonts?.ready.then(() => measure(false));
  requestAnimationFrame(() => measure(false));
})();
