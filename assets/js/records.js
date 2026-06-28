const lightbox = document.querySelector('#recordLightbox');
const image = document.querySelector('#recordLightboxImage');
const caption = document.querySelector('#recordLightboxCaption');
const counter = document.querySelector('#recordLightboxCounter');
const photoButtons = Array.from(document.querySelectorAll('[data-lightbox-src]'));
let returnFocus = null;
let currentIndex = 0;

const showPhoto = (index) => {
  if (!image || photoButtons.length === 0) return;
  currentIndex = (index + photoButtons.length) % photoButtons.length;
  const button = photoButtons[currentIndex];
  image.src = button.dataset.lightboxSrc || '';
  image.alt = button.dataset.lightboxAlt || '';
  if (caption) caption.textContent = button.dataset.lightboxDescription || button.dataset.lightboxAlt || '';
  if (counter) counter.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(photoButtons.length).padStart(2, '0')}`;
};

const closeLightbox = () => {
  if (!lightbox || !image || lightbox.hidden) return;
  lightbox.hidden = true;
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-open');
  image.removeAttribute('src');
  image.alt = '';
  if (caption) caption.textContent = '';
  if (counter) counter.textContent = '';
  if (returnFocus) returnFocus.focus();
};

photoButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    if (!lightbox || !image) return;
    returnFocus = button;
    showPhoto(index);
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    lightbox.querySelector('.lightbox__close')?.focus();
  });
});

document.querySelectorAll('[data-lightbox-close]').forEach((button) => {
  button.addEventListener('click', closeLightbox);
});
document.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => showPhoto(currentIndex - 1));
document.querySelector('[data-lightbox-next]')?.addEventListener('click', () => showPhoto(currentIndex + 1));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeLightbox();
  if (lightbox && !lightbox.hidden && event.key === 'ArrowLeft') showPhoto(currentIndex - 1);
  if (lightbox && !lightbox.hidden && event.key === 'ArrowRight') showPhoto(currentIndex + 1);
  if (event.key === 'Tab' && lightbox && !lightbox.hidden) {
    const focusable = Array.from(lightbox.querySelectorAll('button:not([disabled])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
