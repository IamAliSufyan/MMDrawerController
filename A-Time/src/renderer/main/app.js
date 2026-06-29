'use strict';

/**
 * Main window router. Switches between the Timers list, the create/edit form,
 * and the Settings tab, and wires saved-timer actions to the main process.
 */

import { createTimerCard } from './timerList.js';
import { createTimerForm } from './timerForm.js';
import { createSettingsView } from './settings.js';

const api = window.atime;
const content = document.getElementById('content');
const tabs = [...document.querySelectorAll('.tab')];

let activeTab = 'timers';

function setActiveTab(tab) {
  activeTab = tab;
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
}

tabs.forEach((t) => t.addEventListener('click', () => {
  setActiveTab(t.dataset.tab);
  if (t.dataset.tab === 'timers') renderList();
  else renderSettings();
}));

// ---- Timers list view -----------------------------------------------------
async function renderList() {
  setActiveTab('timers');
  content.innerHTML = '';

  const view = document.createElement('div');
  view.className = 'list-view';

  const newBtn = document.createElement('button');
  newBtn.className = 'btn btn-new';
  newBtn.innerHTML = '<span class="plus">+</span> New Timer';
  newBtn.addEventListener('click', () => renderForm(null));
  view.appendChild(newBtn);

  const listWrap = document.createElement('div');
  listWrap.className = 'timer-list';
  view.appendChild(listWrap);

  content.appendChild(view);

  let timers = [];
  try {
    timers = await api.timers.list();
  } catch (err) {
    listWrap.innerHTML = `<div class="empty">Could not load timers.</div>`;
    return;
  }

  if (!timers.length) {
    listWrap.innerHTML = `<div class="empty">No timers yet. Create your first one above.</div>`;
    return;
  }

  const handlers = {
    onPlay: (id) => api.control.play(id),
    onEdit: async (id) => {
      const timer = await api.timers.get(id);
      if (timer) renderForm(timer);
    },
    onDelete: async (id, name) => {
      if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
        await api.timers.remove(id);
        renderList();
      }
    },
    onDuplicate: async (id) => {
      await api.timers.duplicate(id);
      renderList();
    }
  };

  for (const timer of timers) {
    listWrap.appendChild(createTimerCard(timer, handlers));
  }
}

// ---- Form view ------------------------------------------------------------
function renderForm(timer) {
  content.innerHTML = '';
  const form = createTimerForm(timer, {
    onCancel: () => renderList(),
    onSaved: () => renderList(),
    save: (payload) => api.timers.save(payload)
  });
  content.appendChild(form.el);
}

// ---- Settings view --------------------------------------------------------
async function renderSettings() {
  setActiveTab('settings');
  content.innerHTML = '';
  try {
    const view = await createSettingsView();
    content.appendChild(view.el);
  } catch (err) {
    content.innerHTML = `<div class="empty">Could not load settings.</div>`;
  }
}

// Navigation requested from the menu-bar popover (New / Edit / Settings).
api.app.onNavigate(async ({ view, timerId } = {}) => {
  if (view === 'form') {
    if (timerId) {
      const timer = await api.timers.get(timerId);
      renderForm(timer || null);
    } else {
      renderForm(null);
    }
  } else if (view === 'settings') {
    renderSettings();
  } else {
    renderList();
  }
});

// Initial render.
renderList();
