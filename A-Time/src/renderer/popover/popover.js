'use strict';

/**
 * Menu-bar popover renderer. Shows the New button + a compact list of saved
 * timers with quick actions. New/Edit/Settings open the main window; Play starts
 * the timer and closes the popover. Reports its content height to the main
 * process so the window hugs its content.
 */

import { icon } from '../shared/icons.js';

const api = window.atime;
const listEl = document.getElementById('list');

const newBtn = document.getElementById('newBtn');
newBtn.innerHTML = `${icon('plus', 15)}<span>New Timer</span>`;
newBtn.addEventListener('click', () => api.app.openMain({ view: 'form' }));

const settingsBtn = document.getElementById('settingsBtn');
settingsBtn.innerHTML = icon('gear', 16);
settingsBtn.addEventListener('click', () => api.app.openMain({ view: 'settings' }));

document.getElementById('quitBtn').addEventListener('click', () => api.app.quit());

function fmt(t) {
  const total = t.total || (t.sections || []).reduce((a, s) => a + (s.duration || 0), 0);
  const n = (t.sections || []).length;
  return `${api.calc.formatClock(total)} · ${n} section${n === 1 ? '' : 's'}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function render() {
  let timers = [];
  try { timers = await api.timers.list(); } catch (_) { /* ignore */ }

  listEl.innerHTML = '';
  if (!timers.length) {
    listEl.innerHTML = '<div class="empty">No timers yet.<br>Tap “New Timer”.</div>';
    reportHeight();
    return;
  }

  for (const timer of timers) {
    listEl.appendChild(buildCard(timer));
  }
  reportHeight();
}

function buildCard(timer) {
  const card = document.createElement('div');
  card.className = 'pcard';
  card.innerHTML = `
    <div class="pcard-name">${escapeHtml(timer.name)}</div>
    <div class="pcard-meta">${fmt(timer)}</div>
    <div class="pcard-actions">
      <button class="pbtn pbtn-play" title="Play">${icon('play', 15)}</button>
      <button class="pbtn pbtn-edit" title="Edit">${icon('edit', 15)}</button>
      <button class="pbtn pbtn-dup" title="Duplicate">${icon('copy', 15)}</button>
      <button class="pbtn pbtn-del" title="Delete">${icon('trash', 15)}</button>
    </div>
  `;

  card.querySelector('.pbtn-play').addEventListener('click', () => {
    api.control.play(timer.id);
    api.popover.hide();
  });
  card.querySelector('.pbtn-edit').addEventListener('click', () => {
    api.app.openMain({ view: 'form', timerId: timer.id });
  });
  card.querySelector('.pbtn-dup').addEventListener('click', async () => {
    await api.timers.duplicate(timer.id);
    render();
  });
  card.querySelector('.pbtn-del').addEventListener('click', () => showDeleteConfirm(card, timer));

  return card;
}

/** Inline delete confirmation (avoids native dialogs inside the popover). */
function showDeleteConfirm(card, timer) {
  const actions = card.querySelector('.pcard-actions');
  const confirm = document.createElement('div');
  confirm.className = 'pcard-confirm';
  confirm.innerHTML = `
    <span>Delete?</span>
    <button class="confirm-yes">Yes</button>
    <button class="confirm-no">No</button>
  `;
  actions.replaceWith(confirm);
  confirm.querySelector('.confirm-yes').addEventListener('click', async () => {
    await api.timers.remove(timer.id);
    render();
  });
  confirm.querySelector('.confirm-no').addEventListener('click', () => render());
}

/** Tell the main process how tall we need to be. */
function reportHeight() {
  // Defer to the next frame so layout has settled.
  requestAnimationFrame(() => {
    const h = document.querySelector('.panel').getBoundingClientRect().height + 16;
    api.popover.resize(h);
  });
}

// Reload the list each time the popover is shown.
api.popover.onShow(() => render());
render();
