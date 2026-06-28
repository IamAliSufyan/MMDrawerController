'use strict';

/**
 * Overlay renderer: draws the segmented progress bar, keeps it in sync with the
 * timer state pushed from the main process, renders the click-through info, and
 * exposes the small interactive controls cluster.
 */

const api = window.atime;
const root = document.documentElement;
const bar = document.getElementById('bar');
const track = document.getElementById('track');
const controls = document.getElementById('controls');

const els = {
  sectionTitle: document.getElementById('sectionTitle'),
  sectionRemaining: document.getElementById('sectionRemaining'),
  totalRemaining: document.getElementById('totalRemaining'),
  clock: document.getElementById('clock'),
  btnPause: document.getElementById('btnPause'),
  btnResume: document.getElementById('btnResume'),
  btnReset: document.getElementById('btnReset'),
  btnStop: document.getElementById('btnStop')
};

let segments = []; // { el, fill, duration }

// ---- Configuration (height / opacity / position) -------------------------
api.onConfig((cfg) => {
  if (!cfg) return;
  root.style.setProperty('--overlay-height', `${cfg.height}px`);
  root.style.setProperty('--overlay-opacity', String(cfg.opacity));
  // Position the bar just below the menu bar (menuBarOffset) plus the gap.
  const top = (cfg.menuBarOffset || 0) + (cfg.gap || 8);
  root.style.setProperty('--overlay-top', `${top}px`);
});

// ---- Build the section segments on init ----------------------------------
api.onInit((meta) => {
  buildSegments(meta);
});

function buildSegments(meta) {
  track.innerHTML = '';
  segments = [];
  const total = Math.max(1, meta.totalDuration);
  for (const section of meta.sections) {
    const seg = document.createElement('div');
    seg.className = 'section';
    // Proportional width across the full bar.
    seg.style.flexGrow = String(Math.max(0.0001, section.duration));
    seg.style.flexBasis = '0';

    const fill = document.createElement('div');
    fill.className = 'section-fill';
    fill.style.background = section.color || '#cccccc';
    seg.appendChild(fill);

    track.appendChild(seg);
    segments.push({ el: seg, fill, duration: section.duration });
  }
}

// ---- Apply timer state ----------------------------------------------------
api.onState((state) => {
  if (!state) return;
  if (segments.length !== state.sections.length) {
    // Defensive: rebuild if structure changed (e.g. settings reset).
    buildSegments({ totalDuration: state.totalDuration, sections: state.sections });
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let pct = 0;
    if (i < state.currentIndex) pct = 100;
    else if (i === state.currentIndex) {
      pct = seg.duration > 0 ? Math.min(100, (state.sectionElapsed / seg.duration) * 100) : 100;
    }
    seg.fill.style.width = `${pct}%`;
  }

  els.sectionTitle.textContent = state.currentName || '';
  els.sectionRemaining.textContent = api.calc.formatClock(state.sectionRemaining);
  els.totalRemaining.textContent = api.calc.formatClock(state.totalRemaining);
  els.clock.textContent = currentClock();

  // Toggle pause/resume button visibility.
  els.btnPause.hidden = state.paused;
  els.btnResume.hidden = !state.paused;
});

function currentClock() {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${m} ${ampm}`;
}

// ---- Controls -------------------------------------------------------------
els.btnPause.addEventListener('click', () => api.control.pause());
els.btnResume.addEventListener('click', () => api.control.resume());
els.btnReset.addEventListener('click', () => api.control.reset());
els.btnStop.addEventListener('click', () => api.control.stop());

// Make ONLY the controls clickable: the window is click-through by default
// (forwarding mouse-move events), so when the pointer is over the controls we
// disable click-through, and re-enable it when the pointer leaves.
function enableClicks() { api.overlay.setIgnoreMouse(false); }
function disableClicks() { api.overlay.setIgnoreMouse(true); }

controls.addEventListener('mouseenter', enableClicks);
controls.addEventListener('mouseleave', disableClicks);
// Fallback using forwarded mousemove: enable when over controls, else disable.
window.addEventListener('mousemove', (e) => {
  const rect = controls.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
    e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (inside) enableClicks();
  else disableClicks();
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

/** Play a short tone (or sequence) using the Web Audio API. */
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

api.onSound((kind) => {
  if (kind === 'section') {
    // Soft single chime when a section ends.
    tone([880], 0.35, 'sine', 0.16);
  } else if (kind === 'complete') {
    // Distinct ascending three-note chord at the very end.
    tone([523.25, 659.25, 783.99], 0.6, 'triangle', 0.2);
  }
});
