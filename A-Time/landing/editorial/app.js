'use strict';

/* PaceBar landing — editorial build. Reveal, sticky nav, FAQ, and the
   timeline-ruler demos (hero + pacing). Vanilla JS, no dependencies. */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SECTION_COLORS = ['#E2533B', '#E89B2E', '#2E9E6B', '#2B7C86'];

document.getElementById('year').textContent = new Date().getFullYear();

// ---- Sticky nav ----
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---- Reveal ----
function observeReveals(els) {
  if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });
  els.forEach((el) => io.observe(el));
}
observeReveals([...document.querySelectorAll('.reveal')]);

// ---- FAQ ----
const FAQS = [
  ['Does it work over Keynote, PowerPoint and Zoom?', 'Yes. The bar floats above every app, including full-screen presentations and screen shares — your audience sees your content, you see your pacing.'],
  ['Is it really click-through?', 'Yes. Everything except the small control cluster on the right passes clicks straight through to whatever app is underneath, so your slides and demos stay fully usable.'],
  ['Which macOS versions are supported?', 'The latest macOS plus the two previous major releases (macOS 12 and up), on both Apple Silicon and Intel Macs.'],
  ['Does it support multiple monitors?', 'Yes — choose the main screen, all screens, or one specific display. You can also drag and resize the bar.'],
  ['Is PaceBar free?', 'Completely. PaceBar is free and open source — download it, use it, and read the code on GitHub.'],
  ['Does it need an internet connection or account?', 'No. There is no sign-up and nothing is uploaded. Your timers are stored locally on your Mac.'],
  ['Can I see how far over time I went?', 'Yes. With overrun mode, once your time is up the bar keeps counting up in red (e.g. +1:12) so you know exactly how far over you are.']
];
const faqList = document.getElementById('faqList');
faqList.innerHTML = FAQS.map(([q, a]) => `
  <div class="faq-item reveal">
    <button class="faq-q" aria-expanded="false"><span>${q}</span><span class="faq-sign" aria-hidden="true"></span></button>
    <div class="faq-a"><p>${a}</p></div>
  </div>`).join('');
faqList.querySelectorAll('.faq-item').forEach((item) => {
  const btn = item.querySelector('.faq-q');
  const ans = item.querySelector('.faq-a');
  btn.addEventListener('click', () => {
    const open = item.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    ans.style.maxHeight = open ? ans.scrollHeight + 'px' : '0';
  });
});
observeReveals([...faqList.querySelectorAll('.reveal')]);

// ---------------------------------------------------------------------------
//  Timeline demo (ruler ticks + filling sections + moving playhead)
// ---------------------------------------------------------------------------
function fmt(sec) {
  const s = Math.max(0, Math.round(Math.abs(sec)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function buildTimeline(cfg) {
  const { timelineEl, rulerEl, tickTimesEl, totalEl, stateEl, playheadEl, playheadTimeEl,
    readoutEl, sections, loopMs, overrunRatio = 0.16, showLabels = true } = cfg;

  const total = sections.reduce((a, s) => a + s.dur, 0);
  const starts = []; let acc = 0;
  for (const s of sections) { starts.push(acc); acc += s.dur; }

  // Build segments
  const segs = sections.map((s) => {
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.style.flexGrow = String(s.dur);
    const fill = document.createElement('div'); fill.className = 'seg-fill'; fill.style.background = s.color;
    seg.appendChild(fill);
    if (showLabels) {
      const name = document.createElement('span'); name.className = 'seg-name'; name.textContent = s.name;
      const t = document.createElement('span'); t.className = 'seg-time'; t.textContent = fmt(s.dur);
      seg.append(name, t); seg.__t = t;
    }
    timelineEl.insertBefore(seg, playheadEl || null);
    return { seg, fill, dur: s.dur };
  });

  // Ruler ticks — a minor tick per minute, major at section boundaries.
  if (rulerEl) {
    const minutes = Math.round(total / 60);
    for (let m = 0; m <= minutes; m++) {
      const t = document.createElement('span');
      const atBoundary = starts.includes(m * 60) || m * 60 === total;
      t.className = 'tick ' + (atBoundary ? 'major' : 'minor');
      t.style.left = `${(m * 60 / total) * 100}%`;
      rulerEl.appendChild(t);
    }
  }
  // Boundary time labels under the hero timeline.
  if (tickTimesEl) {
    [...starts, total].forEach((sec) => {
      const span = document.createElement('span');
      span.textContent = fmt(sec);
      span.style.left = `${(sec / total) * 100}%`;
      tickTimesEl.appendChild(span);
    });
  }

  const WARN = Math.max(8, total * 0.12);
  const DANGER = Math.max(3, total * 0.05);
  const overTotal = total * (1 + overrunRatio);
  let startTs = null;

  function render(elapsedRaw) {
    const elapsed = Math.min(elapsedRaw, total);
    const overBy = Math.max(0, elapsedRaw - total);
    const overrun = overBy > 0;
    let idx = segs.findIndex((s, i) => elapsed < starts[i] + s.dur);
    if (idx < 0 || overrun) idx = segs.length - 1;

    segs.forEach((s, i) => {
      let pct = 0, rem = s.dur;
      if (i < idx) { pct = 100; rem = 0; }
      else if (i === idx) { const into = elapsed - starts[i]; pct = Math.min(100, (into / s.dur) * 100); rem = Math.max(0, s.dur - into); }
      s.fill.style.width = pct + '%';
      s.seg.classList.toggle('done', i < idx);
      if (s.seg.__t) s.seg.__t.textContent = fmt(rem);
    });

    const px = Math.min(100, (elapsed / total) * 100);
    if (playheadEl) playheadEl.style.left = px + '%';
    if (playheadTimeEl) playheadTimeEl.textContent = overrun ? '+' + fmt(overBy) : fmt(elapsed);

    timelineEl.classList.toggle('over', overrun);
    const totalRemaining = Math.max(0, total - elapsed);
    if (totalEl) totalEl.textContent = overrun ? '+' + fmt(overBy) : fmt(totalRemaining);
    if (readoutEl) {
      readoutEl.classList.toggle('over', overrun);
      readoutEl.classList.toggle('danger', !overrun && totalRemaining <= DANGER);
      readoutEl.classList.toggle('warn', !overrun && totalRemaining > DANGER && totalRemaining <= WARN);
    }
    if (stateEl) stateEl.textContent = overrun ? 'over time' : (totalRemaining <= WARN ? 'wrap up' : 'on pace');
  }

  function frame(ts) {
    if (startTs === null) startTs = ts;
    const p = ((ts - startTs) % loopMs) / loopMs;
    render(p * overTotal);
    requestAnimationFrame(frame);
  }
  if (reduceMotion) render(total * 0.46); // a representative static frame
  else requestAnimationFrame(frame);
}

// Hero timeline — a realistic 18-minute talk.
buildTimeline({
  timelineEl: document.getElementById('timeline'),
  rulerEl: document.getElementById('ruler'),
  tickTimesEl: document.getElementById('tickTimes'),
  playheadEl: document.getElementById('playhead'),
  playheadTimeEl: document.getElementById('playheadTime'),
  stateEl: document.getElementById('stageState'),
  sections: [
    { name: 'Intro', dur: 180, color: SECTION_COLORS[0] },
    { name: 'The problem', dur: 300, color: SECTION_COLORS[1] },
    { name: 'Live demo', dur: 360, color: SECTION_COLORS[2] },
    { name: 'Wrap-up', dur: 240, color: SECTION_COLORS[3] }
  ],
  loopMs: 17000
});

// Pacing mini timeline — short loop emphasising warn → red → overrun.
buildTimeline({
  timelineEl: document.getElementById('miniTimeline'),
  rulerEl: document.getElementById('miniRuler'),
  playheadEl: document.getElementById('miniPlayhead'),
  totalEl: document.getElementById('miniTotal'),
  stateEl: document.getElementById('miniState'),
  readoutEl: document.querySelector('.mini-readout'),
  sections: [
    { name: '', dur: 60, color: SECTION_COLORS[2] },
    { name: '', dur: 60, color: SECTION_COLORS[1] },
    { name: '', dur: 60, color: SECTION_COLORS[0] }
  ],
  loopMs: 9000,
  overrunRatio: 0.3,
  showLabels: false
});

// ---- Smooth in-page links ----
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length > 1) { const el = document.querySelector(id); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); } }
  });
});
