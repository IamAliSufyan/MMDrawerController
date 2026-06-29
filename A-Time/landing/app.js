'use strict';

/* PaceBar landing — interactions: scroll reveal, sticky nav, FAQ accordion,
   feature grid, and two animated overlay-bar demos. Vanilla JS, no deps. */

const PALETTE = ['#4C8BF5', '#34C759', '#FF9F0A', '#FF375F', '#AF52DE', '#5AC8FA', '#FFD60A', '#FF6B35', '#30D158'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Year ----
document.getElementById('year').textContent = new Date().getFullYear();

// ---- Sticky nav background on scroll ----
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---- Scroll reveal ----
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('in'));
}

// ---- Feature grid (built from data) ----
const FEATURES = [
  ['M4 6h16M4 12h10M4 18h16', 'Sectioned progress bar', 'Split your talk into sections; each fills with its own color as you go.'],
  ['M12 8v4l3 2M21 12a9 9 0 1 1-9-9', 'Warning colors + overrun', 'Amber then flashing red near the end — and it counts up in red if you run over.'],
  ['M3 12h18M7 8l-4 4 4 4', 'Click-through overlay', 'Pinned below the menu bar, above all apps. Resizable and draggable.'],
  ['M6 4h12v16l-6-3-6 3z', 'Global shortcuts', 'Space pause/resume, ⌘R restart, ⌘→/⌘← sections, Esc stop.'],
  ['M3 5h18v10H3zM8 19h8', 'Multi-monitor', 'Show on the main screen, all screens, or a specific display.'],
  ['M12 4v4M12 4a8 8 0 1 0 0 16', '3-2-1 countdown', 'A clean, silent full-screen countdown before every run.'],
  ['M11 5 6 9H2v6h4l5 4zM19 9a5 5 0 0 1 0 6', 'Sounds & notifications', 'Soft chime at each section, a final cue and macOS notification at the end.'],
  ['M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z', 'Private & offline', 'Timers saved locally. No account, no internet, no tracking.']
];
const grid = document.getElementById('featureGrid');
grid.innerHTML = FEATURES.map(([d, title, desc]) => `
  <div class="feature reveal">
    <div class="feature-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></div>
    <h3>${title}</h3>
    <p>${desc}</p>
  </div>`).join('');
// observe the freshly added cards
if ('IntersectionObserver' in window && !reduceMotion) {
  const io2 = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => { if (e.isIntersecting) { e.target.style.transitionDelay = `${(i % 4) * 0.06}s`; e.target.classList.add('in'); io2.unobserve(e.target); } });
  }, { threshold: 0.15 });
  grid.querySelectorAll('.reveal').forEach((el) => io2.observe(el));
} else {
  grid.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
}

// ---- FAQ accordion ----
const FAQS = [
  ['Does it work over Keynote, PowerPoint and Zoom?', 'Yes. The bar floats above every app, including full-screen presentations and screen shares — your audience sees your content, you see your pacing.'],
  ['Is it really click-through?', 'Yes. Everything except the small control cluster on the right passes clicks straight through to whatever app is underneath, so your slides and demos stay fully usable.'],
  ['Which macOS versions are supported?', 'The latest macOS plus the two previous major releases (macOS 12 and up), on both Apple Silicon and Intel Macs.'],
  ['Does it support multiple monitors?', 'Yes — choose the main screen, all screens, or a specific display. You can also drag and resize the bar to taste.'],
  ['Is PaceBar free?', 'Yes. PaceBar is completely free and open source. Download it, use it, and check out the code on GitHub.'],
  ['Does it need an internet connection or account?', 'No. There’s no sign-up and nothing to upload. Your timers are stored locally on your Mac.'],
  ['Can I see how far over time I went?', 'Yes. With overrun mode, when your time is up the bar keeps counting up in red (e.g. +1:12) so you know exactly how far over you are.']
];
const faqList = document.getElementById('faqList');
faqList.innerHTML = FAQS.map(([q, a]) => `
  <div class="faq-item reveal">
    <button class="faq-q" aria-expanded="false">
      <span>${q}</span>
      <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="faq-a"><p>${a}</p></div>
  </div>`).join('');
faqList.querySelectorAll('.faq-item').forEach((item) => {
  const btn = item.querySelector('.faq-q');
  const ans = item.querySelector('.faq-a');
  btn.addEventListener('click', () => {
    const isOpen = item.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    ans.style.maxHeight = isOpen ? ans.scrollHeight + 'px' : '0';
  });
});
if ('IntersectionObserver' in window && !reduceMotion) {
  const io3 = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io3.unobserve(e.target); } }), { threshold: 0.1 });
  faqList.querySelectorAll('.reveal').forEach((el) => io3.observe(el));
} else { faqList.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')); }

// ---------------------------------------------------------------------------
//  Animated overlay-bar demos
// ---------------------------------------------------------------------------
function fmt(sec) {
  const s = Math.max(0, Math.round(Math.abs(sec)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Build a segmented bar inside `trackEl` and animate it over a loop.
 * Returns a tick(elapsed, total) function caller uses; here we self-drive.
 */
function makeBarDemo({ track, totalEl, barEl, sections, loopMs, overrunRatio = 0.18, showLabels = true }) {
  const total = sections.reduce((a, s) => a + s.dur, 0);
  const starts = [];
  let acc = 0;
  for (const s of sections) { starts.push(acc); acc += s.dur; }

  const segs = sections.map((s) => {
    const seg = document.createElement('div');
    seg.className = 'demo-seg';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.background = s.color;
    seg.style.flexGrow = String(s.dur);
    seg.appendChild(fill);
    if (showLabels) {
      const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = s.name;
      const t = document.createElement('span'); t.className = 't';
      seg.append(lbl, t);
      seg.__t = t;
    }
    track.appendChild(seg);
    return { seg, fill, dur: s.dur };
  });

  const WARN = Math.max(8, total * 0.12);
  const DANGER = Math.max(3, total * 0.05);
  const overTotal = total * (1 + overrunRatio);
  let startTs = null;

  function frame(ts) {
    if (startTs === null) startTs = ts;
    const p = ((ts - startTs) % loopMs) / loopMs; // 0..1 progress through the loop
    const elapsedRaw = p * overTotal; // goes a bit past `total` to show overrun
    const elapsed = Math.min(elapsedRaw, total);
    const overBy = Math.max(0, elapsedRaw - total);
    const overrun = overBy > 0;
    const curIndex = overrun ? segs.length - 1 : segs.findIndex((s, i) => elapsed < starts[i] + s.dur);
    const idx = curIndex < 0 ? segs.length - 1 : curIndex;

    segs.forEach((s, i) => {
      let pct = 0; let rem = s.dur;
      if (i < idx) { pct = 100; rem = 0; }
      else if (i === idx) {
        const into = elapsed - starts[i];
        pct = Math.min(100, (into / s.dur) * 100);
        rem = Math.max(0, s.dur - into);
      }
      s.fill.style.width = pct + '%';
      if (s.seg.__t) s.seg.__t.textContent = fmt(rem);
    });

    const totalRemaining = Math.max(0, total - elapsed);
    if (totalEl) {
      totalEl.textContent = overrun ? '+' + fmt(overBy) : fmt(totalRemaining);
      totalEl.classList.toggle('over', overrun);
      totalEl.classList.toggle('danger', !overrun && totalRemaining <= DANGER);
      totalEl.classList.toggle('warn', !overrun && totalRemaining > DANGER && totalRemaining <= WARN);
    }
    if (barEl) {
      barEl.classList.toggle('overrun', overrun); // hero overlay uses .overrun
      barEl.classList.toggle('over', overrun);     // mini bar uses .over
    }
    requestAnimationFrame(frame);
  }
  if (!reduceMotion) requestAnimationFrame(frame);
  else { // static state for reduced motion
    segs.forEach((s, i) => { s.fill.style.width = i === 0 ? '60%' : (i < 1 ? '100%' : '0'); if (s.seg.__t) s.seg.__t.textContent = fmt(s.dur); });
    if (totalEl) totalEl.textContent = fmt(total);
  }
}

// Hero demo — mirrors the Sadiqabad sample (scaled to a short loop).
makeBarDemo({
  track: document.getElementById('demoTrack'),
  totalEl: document.getElementById('demoTotal'),
  barEl: document.getElementById('demoOverlay'),
  sections: [
    { name: 'Intro', dur: 180, color: PALETTE[0] },
    { name: 'Problem', dur: 300, color: PALETTE[1] },
    { name: 'Demo', dur: 360, color: PALETTE[2] },
    { name: 'Wrap-up', dur: 240, color: PALETTE[3] }
  ],
  loopMs: 16000
});
// Keep the fake menu-bar time roughly in sync with the hero total.
const demoTrayTime = document.getElementById('demoTrayTime');
const demoTotal = document.getElementById('demoTotal');
if (demoTrayTime && demoTotal && !reduceMotion) {
  setInterval(() => { demoTrayTime.textContent = (demoTotal.classList.contains('over') ? '+' : '') + demoTotal.textContent.replace('+', ''); }, 250);
}

// Highlight mini demo — short loop that clearly shows warn → danger → overrun.
makeBarDemo({
  track: document.getElementById('miniTrack'),
  totalEl: document.getElementById('miniTotal'),
  barEl: document.getElementById('miniBar'),
  sections: [
    { name: '', dur: 20, color: PALETTE[1] },
    { name: '', dur: 20, color: PALETTE[2] },
    { name: '', dur: 20, color: PALETTE[3] }
  ],
  loopMs: 9000,
  overrunRatio: 0.35,
  showLabels: false
});

// The "Simulate overrun" button just scrolls attention / restarts emphasis.
const overrunToggle = document.getElementById('overrunToggle');
if (overrunToggle) {
  overrunToggle.addEventListener('click', () => {
    const mini = document.getElementById('miniBar');
    mini.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease' });
  });
}

// ---- Smooth-scroll for in-page nav links ----
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length > 1) {
      const el = document.querySelector(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }
    }
  });
});
