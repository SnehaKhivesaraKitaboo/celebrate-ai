/** Off-canvas sidebar toggle for small screens. */
export function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  const label = toggle.querySelector('.visually-hidden');

  function setOpen(open) {
    sidebar.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close navigation' : 'Open navigation';
    if (open) sidebar.querySelector('a')?.focus();
  }

  toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));
  document.addEventListener('click', (event) => {
    if (!sidebar.classList.contains('is-open')) return;
    if (sidebar.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}
