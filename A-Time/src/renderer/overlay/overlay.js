'use strict';

/**
 * Overlay renderer.
 *
 * Draws the segmented progress bar (each section shows its own name on the left
 * and its remaining time on the right), the total remaining + clock before the
 * controls, and a settings popup. The bar can be dragged to move and resized
 * from its right edge. The whole window is click-through except elements marked
 * `.interactive` (grips, controls, popup).
 */

const api = window.atime;
const root = document.documentElement;
const bar = document.getElementById('bar');
const track = document.getElementById('track');

// Time-warning thresholds (seconds): amber under WARN, red flash under DANGER.
const WARN_SECONDS = 15;
const DANGER_SECONDS = 5;

const els = {
  totalRemaining: document.getElementById('totalRemaining'),
  btnToggle: document.getElementById('btnToggle'),
  btnReset: document.getElementById('btnReset'),
  btnStop: document.getElementById('btnStop'),
  btnMenu: document.getElementById('btnMenu'),
  dragHandle: document.getElementById('dragHandle'),
  resizeHandle: document.getElementById('resizeHandle'),
  menuPopup: document.getElementById('menuPopup')
};

let segments = []; // { el, fill, nameEl, timeEl, duration }
let cfg = { menuBarOffset: 0, gap: 8, displayWidth: window.innerWidth, displayHeight: window.innerHeight };

// ---- Configuration (size / opacity / position) ---------------------------
api.overlay.onConfig((c) => {
  if (!c) return;
  cfg = { ...cfg, ...c };
  root.style.setProperty('--overlay-height', `${c.height}px`);
  root.style.setProperty('--overlay-opacity', String(c.opacity));
  root.style.setProperty('--overlay-left', c.left != null ? `${c.left}px` : '0px');
  const defaultTop = (c.menuBarOffset || 0) + (c.gap || 8);
  root.style.setProperty('--overlay-top', `${c.top != null ? c.top : defaultTop}px`);
  root.style.setProperty('--overlay-width', c.width != null ? `${c.width}px` : '100vw');
});

// ---- Build section segments on init --------------------------------------
api.overlay.onInit((meta) => buildSegments(meta));

function buildSegments(meta) {
  track.innerHTML = '';
  segments = [];
  for (const section of meta.sections) {
    const seg = document.createElement('div');
    seg.className = 'section';
    seg.style.flexGrow = String(Math.max(0.0001, section.duration));
    seg.style.flexBasis = '0';

    const fill = document.createElement('div');
    fill.className = 'section-fill';
    fill.style.background = section.color || '#cccccc';

    const nameEl = document.createElement('span');
    nameEl.className = 'section-name';
    nameEl.textContent = section.name || '';

    const timeEl = document.createElement('span');
    timeEl.className = 'section-time';
    timeEl.textContent = api.calc.formatClock(section.duration);

    seg.append(fill, nameEl, timeEl);
    track.appendChild(seg);
    segments.push({ el: seg, fill, nameEl, timeEl, duration: section.duration });
  }
}

// ---- Apply timer state ----------------------------------------------------
api.overlay.onState((state) => {
  if (!state) return;
  if (segments.length !== state.sections.length) {
    buildSegments({ sections: state.sections });
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let pct = 0;
    let remaining = seg.duration; // upcoming sections show their full length
    let warn = false;
    let danger = false;
    if (i < state.currentIndex) { pct = 100; remaining = 0; }        // done
    else if (i === state.currentIndex) {                              // active
      pct = seg.duration > 0 ? Math.min(100, (state.sectionElapsed / seg.duration) * 100) : 100;
      remaining = state.sectionRemaining;
      // Warn as the active section nears its end (overrun handled separately).
      if (!state.overrun) {
        danger = remaining <= DANGER_SECONDS;
        warn = !danger && remaining <= WARN_SECONDS;
      }
    }
    seg.fill.style.width = `${pct}%`;
    seg.timeEl.textContent = api.calc.formatClock(remaining);
    seg.el.classList.toggle('is-done', i < state.currentIndex);
    seg.el.classList.toggle('warn', warn);
    seg.el.classList.toggle('danger', danger);
    const name = state.sections[i].name || '';
    if (seg.nameEl.textContent !== name) seg.nameEl.textContent = name;
  }

  // Total readout: overrun counts up in red; otherwise warn/danger as it nears 0.
  if (state.overrun) {
    els.totalRemaining.textContent = '+' + api.calc.formatClock(state.overBy);
  } else {
    els.totalRemaining.textContent = api.calc.formatClock(state.totalRemaining);
  }
  els.totalRemaining.classList.toggle('overrun', state.overrun);
  els.totalRemaining.classList.toggle('danger', !state.overrun && state.totalRemaining <= DANGER_SECONDS);
  els.totalRemaining.classList.toggle('warn',
    !state.overrun && state.totalRemaining > DANGER_SECONDS && state.totalRemaining <= WARN_SECONDS);

  // The whole bar pulses red while overrunning.
  bar.classList.toggle('overrun', state.overrun);

  // One toggle button: pause icon while running, play icon while paused.
  els.btnToggle.textContent = state.paused ? '▶' : '❚❚';
  els.btnToggle.title = state.paused ? 'Resume (Space)' : 'Pause (Space)';
});

// ---- Controls -------------------------------------------------------------
els.btnToggle.addEventListener('click', () => api.control.togglePause());
els.btnReset.addEventListener('click', () => api.control.reset());
els.btnStop.addEventListener('click', () => api.control.stop());
els.btnMenu.addEventListener('click', () => toggleMenu());

// ---- Click-through management --------------------------------------------
// The window is click-through by default. We enable hit-testing only when the
// pointer is over an `.interactive` element (grips, controls, popup), or while
// a drag/resize gesture is in progress.
let clicksEnabled = null;
let menuOpen = false;
function enableClicks() { if (clicksEnabled !== true) { clicksEnabled = true; api.overlay.setIgnoreMouse(false); } }
function disableClicks() { if (clicksEnabled !== false) { clicksEnabled = false; api.overlay.setIgnoreMouse(true); } }
disableClicks();

function updateInteractivity(x, y) {
  // While the settings menu is open, capture the whole window so a click
  // anywhere can dismiss it.
  if (menuOpen || dragging || resizing) { enableClicks(); return; }
  const el = document.elementFromPoint(x, y);
  if (el && el.closest('.interactive')) enableClicks();
  else disableClicks();
}

// ---- Drag to move + resize width -----------------------------------------
let dragging = false;
let resizing = false;
let dragOffset = { x: 0, y: 0 };
let pending = { left: null, top: null, width: null };

els.dragHandle.addEventListener('mousedown', (e) => {
  e.preventDefault();
  dragging = true;
  const rect = bar.getBoundingClientRect();
  dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
});

els.resizeHandle.addEventListener('mousedown', (e) => {
  e.preventDefault();
  resizing = true;
});

window.addEventListener('mousemove', (e) => {
  if (dragging) {
    const rect = bar.getBoundingClientRect();
    const maxLeft = (cfg.displayWidth || window.innerWidth) - rect.width;
    const maxTop = (cfg.displayHeight || window.innerHeight) - rect.height;
    const left = clamp(e.clientX - dragOffset.x, 0, Math.max(0, maxLeft));
    const top = clamp(e.clientY - dragOffset.y, 0, Math.max(0, maxTop));
    root.style.setProperty('--overlay-left', `${left}px`);
    root.style.setProperty('--overlay-top', `${top}px`);
    pending.left = Math.round(left);
    pending.top = Math.round(top);
  } else if (resizing) {
    const rect = bar.getBoundingClientRect();
    const maxWidth = (cfg.displayWidth || window.innerWidth) - rect.left;
    const width = clamp(e.clientX - rect.left, 360, Math.max(360, maxWidth));
    root.style.setProperty('--overlay-width', `${width}px`);
    pending.width = Math.round(width);
  }
  updateInteractivity(e.clientX, e.clientY);
});

window.addEventListener('mouseup', (e) => {
  if (dragging || resizing) {
    const partial = {};
    if (pending.left != null) { partial.overlayLeft = pending.left; partial.overlayTop = pending.top; }
    if (pending.width != null) partial.overlayWidth = pending.width;
    pending = { left: null, top: null, width: null };
    dragging = false;
    resizing = false;
    if (Object.keys(partial).length) api.settings.save(partial);
  }
  updateInteractivity(e.clientX, e.clientY);
});

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// ---- Settings popup -------------------------------------------------------
const mp = {
  height: document.getElementById('mpHeight'),
  heightVal: document.getElementById('mpHeightVal'),
  opacity: document.getElementById('mpOpacity'),
  opacityVal: document.getElementById('mpOpacityVal'),
  gap: document.getElementById('mpGap'),
  gapVal: document.getElementById('mpGapVal'),
  monitor: document.getElementById('mpMonitor'),
  displayRow: document.getElementById('mpDisplayRow'),
  display: document.getElementById('mpDisplay'),
  resetPos: document.getElementById('mpResetPos')
};

// Native <select> dropdowns can misbehave in a non-focusable overlay window,
// so monitor + display are chosen via cycle buttons instead.
const MONITOR_ORDER = ['main', 'all', 'specific'];
const MONITOR_LABELS = { main: 'Main screen', all: 'All screens', specific: 'Specific' };
let menuState = { behavior: 'main', displays: [], specificId: null };

async function openMenu() {
  await populateMenu();
  menuOpen = true;
  els.menuPopup.hidden = false;
  enableClicks();
}

function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  els.menuPopup.hidden = true;
  disableClicks(); // next pointer move restores hover-based hit-testing
}

function toggleMenu() {
  if (menuOpen) closeMenu();
  else openMenu();
}

// Dismiss the menu when clicking anywhere outside it (but not on the ⋯ button,
// which toggles it).
document.addEventListener('mousedown', (e) => {
  if (!menuOpen) return;
  if (e.target.closest('#menuPopup') || e.target.closest('#btnMenu')) return;
  closeMenu();
});

async function populateMenu() {
  const s = await api.settings.get();
  mp.height.value = s.overlayHeight; mp.heightVal.textContent = `${s.overlayHeight}px`;
  mp.opacity.value = s.overlayOpacity; mp.opacityVal.textContent = `${Math.round(s.overlayOpacity * 100)}%`;
  mp.gap.value = s.overlayGap; mp.gapVal.textContent = `${s.overlayGap}px`;

  try { menuState.displays = await api.displays.list(); } catch (_) { menuState.displays = []; }
  menuState.behavior = s.monitorBehavior;
  menuState.specificId = s.specificDisplayId != null
    ? s.specificDisplayId
    : (menuState.displays[0] && menuState.displays[0].id) || null;
  renderMonitorButtons();
}

function renderMonitorButtons() {
  mp.monitor.textContent = MONITOR_LABELS[menuState.behavior] || 'Main screen';
  mp.displayRow.hidden = menuState.behavior !== 'specific';
  const d = menuState.displays.find((x) => x.id === menuState.specificId);
  mp.display.textContent = d ? `${d.label}${d.isPrimary ? ' (Primary)' : ''}` : '—';
}

mp.height.addEventListener('input', () => {
  mp.heightVal.textContent = `${mp.height.value}px`;
  api.settings.save({ overlayHeight: Number(mp.height.value) });
});
mp.opacity.addEventListener('input', () => {
  mp.opacityVal.textContent = `${Math.round(Number(mp.opacity.value) * 100)}%`;
  api.settings.save({ overlayOpacity: Number(mp.opacity.value) });
});
mp.gap.addEventListener('input', () => {
  mp.gapVal.textContent = `${mp.gap.value}px`;
  api.settings.save({ overlayGap: Number(mp.gap.value) });
});

mp.monitor.addEventListener('click', () => {
  const next = (MONITOR_ORDER.indexOf(menuState.behavior) + 1) % MONITOR_ORDER.length;
  menuState.behavior = MONITOR_ORDER[next];
  renderMonitorButtons();
  const partial = { monitorBehavior: menuState.behavior };
  if (menuState.behavior === 'specific' && menuState.specificId != null) {
    partial.specificDisplayId = menuState.specificId;
  }
  api.settings.save(partial);
});

mp.display.addEventListener('click', () => {
  if (!menuState.displays.length) return;
  const idx = menuState.displays.findIndex((x) => x.id === menuState.specificId);
  const nextDisplay = menuState.displays[(idx + 1) % menuState.displays.length];
  menuState.specificId = nextDisplay.id;
  renderMonitorButtons();
  api.settings.save({ monitorBehavior: 'specific', specificDisplayId: menuState.specificId });
});

mp.resetPos.addEventListener('click', () => {
  api.settings.save({ overlayLeft: null, overlayTop: null, overlayWidth: null });
});

// ---- Built-in sounds (synthesized, no external files) ---------------------
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (_) { audioCtx = null; }
  }
  return audioCtx;
}

function tone(freqs, duration, type = 'sine', gainPeak = 0.18) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = now + i * (duration * 0.18);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  });
}

api.overlay.onSound((kind) => {
  if (kind === 'section') tone([880], 0.35, 'sine', 0.16);
  else if (kind === 'complete') tone([523.25, 659.25, 783.99], 0.6, 'triangle', 0.2);
});
