'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { TimerEngine } = require('../src/core/timerEngine');

/**
 * Helper that builds an engine with a controllable clock so we can advance
 * time deterministically without real timers.
 */
function makeEngine(sections) {
  let nowMs = 1000;
  const engine = new TimerEngine(
    { sections },
    { now: () => nowMs, autoStartTicker: false }
  );
  const advance = (seconds) => { nowMs += seconds * 1000; };
  return { engine, advance };
}

const SECTIONS = [
  { name: 'A', color: '#f00', duration: 10 },
  { name: 'B', color: '#0f0', duration: 20 },
  { name: 'C', color: '#00f', duration: 30 }
];

test('initial state reflects total and first section', () => {
  const { engine } = makeEngine(SECTIONS);
  const s = engine.getState();
  assert.strictEqual(s.totalDuration, 60);
  assert.strictEqual(s.currentIndex, 0);
  assert.strictEqual(s.currentName, 'A');
});

test('start then advance reports correct remaining', () => {
  const { engine, advance } = makeEngine(SECTIONS);
  engine.start();
  advance(5);
  const s = engine.getState();
  assert.strictEqual(Math.round(s.elapsed), 5);
  assert.strictEqual(Math.round(s.sectionRemaining), 5);
  assert.strictEqual(Math.round(s.totalRemaining), 55);
  assert.strictEqual(s.currentIndex, 0);
});

test('crossing a boundary emits sectionEnd and sectionChange', () => {
  const { engine, advance } = makeEngine(SECTIONS);
  const events = [];
  engine.on('sectionEnd', (e) => events.push(['end', e.index]));
  engine.on('sectionChange', (e) => events.push(['change', e.from, e.to]));
  engine.start();
  advance(12); // into section B
  engine.tick();
  assert.deepStrictEqual(events[0], ['end', 0]);
  assert.deepStrictEqual(events[1], ['change', 0, 1]);
  assert.strictEqual(engine.getState().currentIndex, 1);
});

test('pause freezes elapsed and resume continues', () => {
  const { engine, advance } = makeEngine(SECTIONS);
  engine.start();
  advance(5);
  engine.pause();
  const pausedElapsed = engine.getState().elapsed;
  advance(100); // time passes while paused
  assert.strictEqual(Math.round(engine.getState().elapsed), Math.round(pausedElapsed));
  engine.resume();
  advance(5);
  assert.strictEqual(Math.round(engine.getState().elapsed), 10);
});

test('completion fires once at the end', () => {
  const { engine, advance } = makeEngine(SECTIONS);
  let completes = 0;
  engine.on('complete', () => completes++);
  engine.start();
  advance(60);
  engine.tick();
  advance(5);
  engine.tick();
  assert.strictEqual(completes, 1);
  assert.strictEqual(engine.getState().finished, true);
  assert.strictEqual(engine.getState().running, false);
});

test('nextSection jumps to the start of the following section', () => {
  const { engine, advance } = makeEngine(SECTIONS);
  engine.start();
  advance(3);
  engine.nextSection();
  const s = engine.getState();
  assert.strictEqual(s.currentIndex, 1);
  assert.strictEqual(Math.round(s.elapsed), 10);
});

test('previousSection restarts current section then steps back', () => {
  const { engine, advance } = makeEngine(SECTIONS);
  engine.start();
  advance(15); // 5s into section B
  engine.previousSection(); // >1s in → restart B
  assert.strictEqual(engine.getState().currentIndex, 1);
  assert.strictEqual(Math.round(engine.getState().elapsed), 10);
  engine.previousSection(); // at start of B → go to A
  assert.strictEqual(engine.getState().currentIndex, 0);
  assert.strictEqual(Math.round(engine.getState().elapsed), 0);
});

test('reset returns to zero', () => {
  const { engine, advance } = makeEngine(SECTIONS);
  engine.start();
  advance(30);
  engine.reset();
  assert.strictEqual(Math.round(engine.getState().elapsed), 0);
  assert.strictEqual(engine.getState().currentIndex, 0);
});
