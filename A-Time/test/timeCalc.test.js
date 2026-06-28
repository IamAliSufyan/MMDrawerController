'use strict';

const test = require('node:test');
const assert = require('node:assert');
const tc = require('../src/core/timeCalc');
const { assignColors, colorForIndex, DEFAULT_PALETTE } = require('../src/core/palette');

test('sumSections adds section durations', () => {
  assert.strictEqual(tc.sumSections([{ duration: 60 }, { duration: 90 }]), 150);
  assert.strictEqual(tc.sumSections([]), 0);
  assert.strictEqual(tc.sumSections(null), 0);
});

test('divideEqually splits total and puts remainder on last section', () => {
  const result = tc.divideEqually([{}, {}, {}], 100);
  assert.deepStrictEqual(result.map((s) => s.duration), [33, 33, 34]);
  assert.strictEqual(tc.sumSections(result), 100);
});

test('reconcile divides equally when total given and sections empty', () => {
  const r = tc.reconcile({ enteredTotalSeconds: 900, sections: [{}, {}, {}] });
  assert.strictEqual(r.status, 'divided');
  assert.strictEqual(tc.sumSections(r.sections), 900);
  assert.deepStrictEqual(r.sections.map((s) => s.duration), [300, 300, 300]);
});

test('detectMismatch flags the 15-vs-18 example (+3 minutes)', () => {
  // Sadiqabad example: entered 15 min, sections 3+5+6+4 = 18 min.
  const sections = [
    { duration: 3 * 60 },
    { duration: 5 * 60 },
    { duration: 6 * 60 },
    { duration: 4 * 60 }
  ];
  const m = tc.detectMismatch(15 * 60, sections);
  assert.ok(m, 'expected a mismatch');
  assert.strictEqual(m.enteredTotal, 900);
  assert.strictEqual(m.sectionTotal, 1080);
  assert.strictEqual(m.difference, 180); // +3 minutes
});

test('reconcile returns mismatch status for the example', () => {
  const sections = [
    { duration: 180 }, { duration: 300 }, { duration: 360 }, { duration: 240 }
  ];
  const r = tc.reconcile({ enteredTotalSeconds: 900, sections });
  assert.strictEqual(r.status, 'mismatch');
  assert.strictEqual(r.mismatch.difference, 180);
});

test('reconcile is ok when sections match entered total', () => {
  const sections = [{ duration: 300 }, { duration: 600 }];
  const r = tc.reconcile({ enteredTotalSeconds: 900, sections });
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.total, 900);
});

test('adjustProportionally scales the example down to 15 minutes exactly', () => {
  const sections = [
    { duration: 180 }, { duration: 300 }, { duration: 360 }, { duration: 240 }
  ];
  const adjusted = tc.adjustProportionally(sections, 900);
  assert.strictEqual(tc.sumSections(adjusted), 900);
  // proportions preserved roughly: 180/1080*900 = 150, etc.
  assert.strictEqual(adjusted[0].duration, 150);
  assert.strictEqual(adjusted[1].duration, 250);
  assert.strictEqual(adjusted[2].duration, 300);
});

test('adjustProportionally falls back to equal split when no durations', () => {
  const adjusted = tc.adjustProportionally([{}, {}], 100);
  assert.strictEqual(tc.sumSections(adjusted), 100);
});

test('formatClock renders mm:ss and h:mm:ss', () => {
  assert.strictEqual(tc.formatClock(0), '0:00');
  assert.strictEqual(tc.formatClock(65), '1:05');
  assert.strictEqual(tc.formatClock(3661), '1:01:01');
});

test('clamp bounds values', () => {
  assert.strictEqual(tc.clamp(5, 0, 10), 5);
  assert.strictEqual(tc.clamp(-1, 0, 10), 0);
  assert.strictEqual(tc.clamp(99, 0, 10), 10);
});

test('palette assigns in order and wraps', () => {
  assert.strictEqual(colorForIndex(0), DEFAULT_PALETTE[0]);
  assert.strictEqual(colorForIndex(DEFAULT_PALETTE.length), DEFAULT_PALETTE[0]);
  const assigned = assignColors([{}, { color: '#000000' }, {}]);
  assert.strictEqual(assigned[0].color, DEFAULT_PALETTE[0]);
  assert.strictEqual(assigned[1].color, '#000000'); // user color preserved
  assert.strictEqual(assigned[2].color, DEFAULT_PALETTE[2]);
});
