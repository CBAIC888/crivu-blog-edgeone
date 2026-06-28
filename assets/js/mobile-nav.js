// 手機版頂部導航：漢堡選單 + 折疊搜尋。
// 此檔為獨立檔，用於 SSR 頁面（不引入 app.js 的頁面也能有功能）。
// 若頁面同時載入 app.js / issues.js / post.js，它們內部也會初始化，
// 為避免重複綁定，這裡用 data-mobile-nav-bound 標記。
(() => {
  const qs = (sel, root = document) => root.querySelector(sel);

  const header = qs('.site-header');
  if (!header || header.dataset.mobileNavBound) return;
  header.dataset.mobileNavBound = '1';

  const searchBtn = qs('#mobileSearchBtn', header);
  const menuBtn = qs('#mobileMenuBtn', header);
  const searchInput = qs('#globalSearchInput', header) || qs('#searchInput', header);
  const nav = qs('.site-header__nav', header) || qs('.nav', header);

  const syncSearchAria = () => {
    if (!searchBtn) return;
    searchBtn.setAttribute(
      'aria-expanded',
      header.classList.contains('mobile-search-open') ? 'true' : 'false'
    );
  };
  const syncMenuAria = () => {
    if (!menuBtn) return;
    const open = header.classList.contains('mobile-menu-open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? '收起選單' : '展開選單');
  };

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      header.classList.remove('mobile-menu-open');
      header.classList.toggle('mobile-search-open');
      syncSearchAria();
      syncMenuAria();
      if (header.classList.contains('mobile-search-open')) searchInput.focus();
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        header.classList.remove('mobile-search-open');
        syncSearchAria();
        searchBtn.focus();
      }
    });
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      header.classList.remove('mobile-search-open');
      header.classList.toggle('mobile-menu-open');
      syncSearchAria();
      syncMenuAria();
    });
    nav.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.closest && target.closest('a')) {
        header.classList.remove('mobile-menu-open');
        syncMenuAria();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!header.contains(e.target)) {
      header.classList.remove('mobile-menu-open');
      header.classList.remove('mobile-search-open');
      syncSearchAria();
      syncMenuAria();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (header.classList.contains('mobile-menu-open')) {
      header.classList.remove('mobile-menu-open');
      syncMenuAria();
      if (menuBtn) menuBtn.focus();
    }
  });

  syncSearchAria();
  syncMenuAria();
})();
