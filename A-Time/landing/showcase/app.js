'use strict';

/* PaceBar showcase — animated recreations of the app's UI components. */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#E2533B', '#E89B2E', '#2E9E6B', '#2B7C86'];
const fmt = (s) => `${Math.floor(Math.max(0, Math.round(Math.abs(s))) / 60)}:${String(Math.max(0, Math.round(Math.abs(s))) % 60).padStart(2, '0')}`;

document.getElementById('year').textContent = new Date().getFullYear();

// Sticky nav
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Reveal
function observe(els) {
  if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
  els.forEach((e) => io.observe(e));
}

// ---------------------------------------------------------------------------
//  Overlay bar mock (the real PaceBar overlay), animated.
// ---------------------------------------------------------------------------
function buildOverlay(el, { sections, loopMs, overrunRatio = 0.16, totalSync }) {
  const total = sections.reduce((a, s) => a + s.dur, 0);
  const starts = []; let acc = 0; for (const s of sections) { starts.push(acc); acc += s.dur; }

  el.innerHTML = '<span class="om-grip">⠿</span><div class="om-track"></div>' +
    '<div class="om-total">0:00</div>' +
    '<div class="om-ctrls"><button aria-label="pause">' + iconPause() + '</button><button class="stop" aria-label="stop">' + iconStop() + '</button></div>';
  const track = el.querySelector('.om-track');
  const totalEl = el.querySelector('.om-total');
  const toggleBtn = el.querySelector('.om-ctrls button');

  const segs = sections.map((s) => {
    const seg = document.createElement('div'); seg.className = 'om-seg'; seg.style.flexGrow = String(s.dur);
    const f = document.createElement('div'); f.className = 'f'; f.style.background = s.color;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = s.name;
    const t = document.createElement('span'); t.className = 't'; t.textContent = fmt(s.dur);
    seg.append(f, n, t); track.appendChild(seg);
    return { seg, f, t, dur: s.dur };
  });

  const WARN = Math.max(8, total * 0.12), DANGER = Math.max(3, total * 0.05), overTotal = total * (1 + overrunRatio);
  let startTs = null;

  function render(raw) {
    const elapsed = Math.min(raw, total), overBy = Math.max(0, raw - total), overrun = overBy > 0;
    let idx = segs.findIndex((s, i) => elapsed < starts[i] + s.dur); if (idx < 0 || overrun) idx = segs.length - 1;
    segs.forEach((s, i) => {
      let pct = 0, rem = s.dur;
      if (i < idx) { pct = 100; rem = 0; }
      else if (i === idx) { const into = elapsed - starts[i]; pct = Math.min(100, into / s.dur * 100); rem = Math.max(0, s.dur - into); }
      s.f.style.width = pct + '%'; s.seg.classList.toggle('done', i < idx); s.t.textContent = fmt(rem);
    });
    const tr = Math.max(0, total - elapsed);
    totalEl.textContent = overrun ? '+' + fmt(overBy) : fmt(tr);
    totalEl.classList.toggle('over', overrun);
    totalEl.classList.toggle('danger', !overrun && tr <= DANGER);
    totalEl.classList.toggle('warn', !overrun && tr > DANGER && tr <= WARN);
    el.classList.toggle('over', overrun);
    if (totalSync) totalSync.textContent = (overrun ? '+' : '') + (overrun ? fmt(overBy) : fmt(tr));
  }
  function frame(ts) { if (startTs === null) startTs = ts; render(((ts - startTs) % loopMs) / loopMs * overTotal); requestAnimationFrame(frame); }
  if (reduceMotion) render(total * 0.42); else requestAnimationFrame(frame);
}
function iconPause() { return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.6"/><rect x="14" y="5" width="4" height="14" rx="1.6"/></svg>'; }
function iconStop() { return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.6"/></svg>'; }

const TALK = [
  { name: 'Intro', dur: 180, color: COLORS[0] },
  { name: 'The problem', dur: 300, color: COLORS[1] },
  { name: 'Live demo', dur: 360, color: COLORS[2] },
  { name: 'Wrap-up', dur: 240, color: COLORS[3] }
];
buildOverlay(document.getElementById('heroOverlay'), { sections: TALK, loopMs: 16000, totalSync: document.getElementById('trayTime') });
buildOverlay(document.getElementById('overlayShowcase'), { sections: TALK, loopMs: 14000 });
buildOverlay(document.getElementById('overrunShowcase'), { sections: [
  { name: 'Q&A', dur: 90, color: COLORS[2] }, { name: 'Demo', dur: 90, color: COLORS[1] }, { name: 'Close', dur: 60, color: COLORS[0] }
], loopMs: 8000, overrunRatio: 0.35 });

// ---------------------------------------------------------------------------
//  Builder / form mock
// ---------------------------------------------------------------------------
const formRows = document.getElementById('formRows');
if (formRows) {
  const rows = [['Intro', 180], ['The problem', 300], ['Live demo', 360], ['Wrap-up', 240]];
  formRows.innerHTML = rows.map(([n, d], i) => `
    <div class="srow">
      <span class="grip">⠿</span>
      <span class="sw" style="background:${COLORS[i]}"></span>
      <span class="sname">${n}</span>
      <div class="slider sslider" data-val="${d / 900}"><div class="slider-fill"></div><div class="slider-knob"></div></div>
      <span class="stime">${fmt(d)}</span>
    </div>`).join('');
  // Animate the first row's slider gently (and keep its mm:ss in sync).
  const firstSlider = formRows.querySelector('.sslider');
  const firstTime = formRows.querySelector('.stime');
  animateSlider(firstSlider, (v) => { if (firstTime) firstTime.textContent = fmt(Math.round(v * 900)); }, 0.15, 0.32, 5200);
}

// Apply data-val to every custom slider, and return a setter.
function setSlider(el, v) {
  v = Math.max(0, Math.min(1, v));
  el.querySelector('.slider-fill').style.width = v * 100 + '%';
  el.querySelector('.slider-knob').style.left = v * 100 + '%';
}
document.querySelectorAll('.slider[data-val]').forEach((el) => setSlider(el, parseFloat(el.dataset.val)));

function animateSlider(el, onChange, min, max, periodMs) {
  if (reduceMotion) { setSlider(el, (min + max) / 2); onChange && onChange((min + max) / 2); return; }
  const start = performance.now();
  (function loop(t) {
    const phase = (Math.sin((t - start) / periodMs * Math.PI * 2) + 1) / 2; // 0..1
    const v = min + (max - min) * phase;
    setSlider(el, v); onChange && onChange(v);
    requestAnimationFrame(loop);
  })(start);
}

// ---------------------------------------------------------------------------
//  Popover mock cards
// ---------------------------------------------------------------------------
const popCards = document.getElementById('popCards');
if (popCards) {
  const timers = [
    ['Conference Keynote', '18:00 · 4 sections', [3, 5, 6, 4]],
    ['Toastmasters Speech', '7:00 · 3 sections', [2, 3, 2]],
    ['Lightning Talk', '5:00 · 3 sections', [1, 2, 2]]
  ];
  popCards.innerHTML = timers.map(([n, m, parts]) => {
    const sum = parts.reduce((a, b) => a + b, 0);
    const mini = parts.map((p, i) => `<i style="flex:${p};background:${COLORS[i % COLORS.length]}"></i>`).join('');
    return `<div class="pcard"><div class="pcard-n">${n}</div><div class="pcard-m">${m}</div>
      <div class="pcard-mini">${mini}</div>
      <div class="pcard-acts"><b class="play">▶</b><b>✎</b><b>⧉</b><b>🗑</b></div></div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
//  Countdown loop
// ---------------------------------------------------------------------------
const countNum = document.getElementById('countNum');
if (countNum && !reduceMotion) {
  const seq = ['3', '2', '1', 'Go'];
  let i = 0;
  const tick = () => {
    countNum.textContent = seq[i];
    countNum.style.fontSize = seq[i] === 'Go' ? 'clamp(60px, 11vw, 130px)' : '';
    countNum.animate([{ transform: 'scale(.5)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .3 }, { transform: 'scale(1)', opacity: 1, offset: .75 }, { transform: 'scale(.92)', opacity: .5 }], { duration: 1000, easing: 'ease-out' });
    i = (i + 1) % seq.length;
  };
  tick(); setInterval(tick, 1000);
}

// ---------------------------------------------------------------------------
//  Settings life: gentle slider + a toggle that flips
// ---------------------------------------------------------------------------
const setSliders = document.querySelectorAll('.settings-mock .slider');
if (setSliders[0]) animateSlider(setSliders[0], null, 0.3, 0.78, 6000);
const tog1 = document.getElementById('tog1');
if (tog1 && !reduceMotion) setInterval(() => tog1.classList.toggle('on'), 3200);

// ---------------------------------------------------------------------------
//  FAQ
// ---------------------------------------------------------------------------
const FAQS = [
  ['Does it work over Keynote, PowerPoint and Zoom?', 'Yes — the bar floats above every app, including full-screen presentations and screen shares.'],
  ['Is it really click-through?', 'Yes. Everything except the small control cluster passes clicks straight through to the app underneath.'],
  ['Which macOS versions are supported?', 'The latest macOS plus the two previous majors (macOS 12+), on Apple Silicon and Intel.'],
  ['Does it support multiple monitors?', 'Yes — main screen, all screens, or a specific display. You can drag and resize the bar too.'],
  ['Is PaceBar free?', 'Completely. PaceBar is free and open source.'],
  ['Does it need internet or an account?', 'No. Nothing is uploaded; your timers live on your Mac.']
];
const faqList = document.getElementById('faqList');
faqList.innerHTML = FAQS.map(([q, a]) => `<div class="faq-item reveal-u"><button class="faq-q" aria-expanded="false"><span>${q}</span><span class="faq-sign"></span></button><div class="faq-a"><p>${a}</p></div></div>`).join('');
faqList.querySelectorAll('.faq-item').forEach((item) => {
  const btn = item.querySelector('.faq-q'), ans = item.querySelector('.faq-a');
  btn.addEventListener('click', () => { const o = item.classList.toggle('open'); btn.setAttribute('aria-expanded', String(o)); ans.style.maxHeight = o ? ans.scrollHeight + 'px' : '0'; });
});

// Observe all reveal elements (including the dynamically built FAQ).
observe([...document.querySelectorAll('.reveal-u, .reveal-l, .reveal-r')]);

// Smooth in-page links
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href'); if (id.length > 1) { const el = document.querySelector(id); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); } }
}));
