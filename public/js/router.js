function currentHash() {
  return window.location.hash.slice(1);
}

/** Hash-based view switching: shows one [data-view] section and marks the matching nav link. */
export function initRouter({ defaultView, onNavigate }) {
  const views = [...document.querySelectorAll('[data-view]')];
  const links = [...document.querySelectorAll('[data-nav]')];

  function show(requested, moveFocus) {
    const target = views.some((view) => view.dataset.view === requested) ? requested : defaultView;
    views.forEach((view) => {
      view.hidden = view.dataset.view !== target;
    });
    links.forEach((link) => {
      if (link.dataset.nav === target) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const label = links.find((link) => link.dataset.nav === target)?.textContent ?? '';
    onNavigate?.(target, label);
    if (moveFocus) document.querySelector(`[data-view="${target}"] h1`)?.focus();
  }

  window.addEventListener('hashchange', () => show(currentHash(), true));
  show(currentHash(), false);
}
