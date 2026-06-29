'use strict';

/**
 * Renders the list of saved timers. Each card shows the timer name, total time,
 * section count, a mini color preview, and Play / Edit / Duplicate / Delete.
 */

import { icon } from '../shared/icons.js';

const api = window.atime;

function sectionPreview(sections) {
  const total = Math.max(1, sections.reduce((a, s) => a + (s.duration || 0), 0));
  const wrap = document.createElement('div');
  wrap.className = 'card-preview';
  for (const s of sections) {
    const seg = document.createElement('span');
    seg.className = 'card-preview-seg';
    seg.style.background = s.color || '#cccccc';
    seg.style.flexGrow = String(Math.max(0.0001, s.duration || 0));
    seg.title = `${s.name || 'Section'} · ${api.calc.formatClock(s.duration || 0)}`;
    wrap.appendChild(seg);
  }
  return wrap;
}

export function createTimerCard(timer, handlers) {
  const total = timer.total || timer.sections.reduce((a, s) => a + (s.duration || 0), 0);
  const card = document.createElement('div');
  card.className = 'timer-card';

  const info = document.createElement('div');
  info.className = 'card-info';
  info.innerHTML = `
    <div class="card-name">${escapeHtml(timer.name)}</div>
    <div class="card-meta">
      <span>${api.calc.formatClock(total)}</span>
      <span class="dot">•</span>
      <span>${timer.sections.length} section${timer.sections.length === 1 ? '' : 's'}</span>
    </div>
  `;
  info.appendChild(sectionPreview(timer.sections));

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const playBtn = iconButton('play', 'Play', 'card-play');
  const editBtn = iconButton('edit', 'Edit');
  const dupBtn = iconButton('copy', 'Duplicate');
  const delBtn = iconButton('trash', 'Delete', 'card-delete');

  playBtn.addEventListener('click', () => handlers.onPlay(timer.id));
  editBtn.addEventListener('click', () => handlers.onEdit(timer.id));
  dupBtn.addEventListener('click', () => handlers.onDuplicate(timer.id));
  delBtn.addEventListener('click', () => handlers.onDelete(timer.id, timer.name));

  actions.append(playBtn, editBtn, dupBtn, delBtn);
  card.append(info, actions);
  return card;
}

function iconButton(iconName, label, extraClass = '') {
  const btn = document.createElement('button');
  btn.className = `card-btn ${extraClass}`.trim();
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = icon(iconName, 16);
  return btn;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
