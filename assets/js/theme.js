// 背景主題切換：白色、紙黃、深色；localStorage 記住使用者選擇
// 使用前綴 crivu-theme，避免跟其他站/工具衝突
(() => {
  const KEY = 'crivu-theme';
  const THEMES = ['white', 'light', 'dark'];
  const root = document.documentElement;

  const readStored = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };

  const writeStored = (value) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* private mode or disabled — silently ignore */
    }
  };

  const resolve = () => {
    const stored = readStored();
    return THEMES.includes(stored) ? stored : 'white';
  };

  const apply = (theme) => {
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('title', `目前：${labelOf(theme)}，點按切換背景`);
      btn.setAttribute(
        'aria-label',
        `目前是${labelOf(theme)}背景，點按切換背景主題`
      );
    });
  };

  const labelOf = (theme) => {
    if (theme === 'dark') return '深色';
    if (theme === 'light') return '紙黃';
    return '白色';
  };

  // 立即套用，避免進站閃爍
  apply(resolve());

  const bind = () => {
    apply(root.getAttribute('data-theme') || resolve());
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', () => {
        const current = root.getAttribute('data-theme');
        const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length] || 'white';
        writeStored(next);
        apply(next);
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

})();
