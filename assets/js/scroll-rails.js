(() => {
  const rails = Array.from(document.querySelectorAll('[data-scroll-rail]'));

  rails.forEach((rail) => {
    if (rail.dataset.scrollRailBound) return;
    rail.dataset.scrollRailBound = '1';

    const shell = document.createElement('div');
    shell.className = 'rail-shell';
    rail.parentNode.insertBefore(shell, rail);
    shell.appendChild(rail);

    const controls = document.createElement('div');
    controls.className = 'rail-controls';
    controls.setAttribute('aria-label', '滑動控制');
    controls.innerHTML = `
      <button type="button" class="rail-control rail-control--prev" aria-label="向左滑動">←</button>
      <button type="button" class="rail-control rail-control--next" aria-label="向右滑動">→</button>`;
    shell.appendChild(controls);

    const prev = controls.querySelector('.rail-control--prev');
    const next = controls.querySelector('.rail-control--next');

    const sync = () => {
      const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const scrollable = max > 2;
      shell.classList.toggle('is-scrollable', scrollable);
      prev.disabled = !scrollable || rail.scrollLeft <= 2;
      next.disabled = !scrollable || rail.scrollLeft >= max - 2;
    };

    const move = (direction) => {
      rail.scrollBy({ left: direction * Math.max(rail.clientWidth * 0.72, 240), behavior: 'smooth' });
    };

    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    rail.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    new MutationObserver(sync).observe(rail, { childList: true });
    requestAnimationFrame(sync);
  });
})();
