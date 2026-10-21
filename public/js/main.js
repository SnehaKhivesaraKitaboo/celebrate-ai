import { createStorage } from './storage.js';
import { createStore } from './store.js';
import { initRouter } from './router.js';
import { initMenu } from './menu.js';
import { initEventForm } from './views/eventForm.js';
import { initOverview } from './views/overview.js';
import { initPlan } from './views/planView.js';

const APP_NAME = 'CelebrateAI';

function init() {
  const store = createStore(createStorage());
  initMenu();
  initOverview(document.querySelector('[data-view="overview"]'), store);
  initPlan(document.querySelector('[data-view="plan"]'), store);
  initEventForm(document.getElementById('event-form'), store);
  initRouter({
    defaultView: 'overview',
    onNavigate: (view, label) => {
      document.getElementById('topbar-title').textContent = label;
      document.title = `${label} — ${APP_NAME}`;
    },
  });
}

init();
