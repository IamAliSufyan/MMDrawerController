'use strict';

/**
 * Time calculation & reconciliation logic for PaceBar.
 *
 * All durations in this module are expressed in **seconds** unless a function
 * name explicitly says otherwise. Keeping this logic pure (no Electron, no DOM)
 * makes it unit-testable and reusable across processes.
 */

const MAX_TOTAL_SECONDS = 60 * 60; // total timer is capped at 1 hour
const MAX_SECTION_SECONDS = 15 * 60; // a section slider goes 0..15 minutes

/**
 * Clamp a number into [min, max].
 */
function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Sum the durations of all sections (in seconds).
 * @param {Array<{duration?: number}>} sections
 * @returns {number} total seconds
 */
function sumSections(sections) {
  if (!Array.isArray(sections)) return 0;
  return sections.reduce((acc, s) => acc + (Number(s && s.duration) || 0), 0);
}

/**
 * Returns true when every section has a zero/empty duration.
 */
function sectionsAreEmpty(sections) {
  return sumSections(sections) <= 0;
}

/**
 * Divide a total duration equally across N sections (in seconds).
 * Any rounding remainder is added to the last section so the parts always
 * sum exactly to the requested total.
 * @param {Array<object>} sections
 * @param {number} totalSeconds
 * @returns {Array<object>} new sections with `duration` set
 */
function divideEqually(sections, totalSeconds) {
  if (!Array.isArray(sections) || sections.length === 0) return [];
  const count = sections.length;
  const base = Math.floor(totalSeconds / count);
  const remainder = totalSeconds - base * count;
  return sections.map((section, index) => ({
    ...section,
    // give the remainder seconds to the final section
    duration: index === count - 1 ? base + remainder : base
  }));
}

/**
 * Re-scale section durations proportionally so they sum to `targetSeconds`.
 * Used for the mismatch popup "keep total, auto-adjust sections" option.
 * Preserves the relative weight of each section and fixes rounding drift on
 * the last section so the parts sum exactly to the target.
 * @param {Array<{duration?: number}>} sections
 * @param {number} targetSeconds
 * @returns {Array<object>} new sections
 */
function adjustProportionally(sections, targetSeconds) {
  if (!Array.isArray(sections) || sections.length === 0) return [];
  const currentTotal = sumSections(sections);
  // If sections currently have no time, fall back to an equal split.
  if (currentTotal <= 0) return divideEqually(sections, targetSeconds);

  const scaled = sections.map((section) => ({
    ...section,
    duration: Math.round(((Number(section.duration) || 0) / currentTotal) * targetSeconds)
  }));

  // Correct rounding drift so the totals match exactly.
  const drift = targetSeconds - sumSections(scaled);
  if (drift !== 0) {
    const last = scaled[scaled.length - 1];
    last.duration = Math.max(0, last.duration + drift);
  }
  return scaled;
}

/**
 * Compare an entered total against the summed section time and report a
 * mismatch. Returns null when there is no meaningful mismatch.
 *
 * @param {number} enteredTotalSeconds the total the user typed (0 if none)
 * @param {Array<object>} sections
 * @returns {null | {enteredTotal:number, sectionTotal:number, difference:number}}
 *          difference is signed: positive means sections exceed the entered total.
 */
function detectMismatch(enteredTotalSeconds, sections) {
  const sectionTotal = sumSections(sections);
  // No entered total, or no section time → nothing to reconcile here.
  if (!enteredTotalSeconds || enteredTotalSeconds <= 0) return null;
  if (sectionTotal <= 0) return null;
  if (sectionTotal === enteredTotalSeconds) return null;
  return {
    enteredTotal: enteredTotalSeconds,
    sectionTotal,
    difference: sectionTotal - enteredTotalSeconds
  };
}

/**
 * High-level reconciliation used when saving a timer.
 *
 * Rules:
 *  - If sections have durations: total = sum of sections (subject to mismatch
 *    check against any entered total).
 *  - If an entered total is provided but sections are empty/zero: divide the
 *    total equally across the sections.
 *  - If sections sum differs from the entered total: flag a mismatch so the UI
 *    can show the 3-option popup.
 *
 * @param {object} params
 * @param {number} params.enteredTotalSeconds
 * @param {Array<object>} params.sections
 * @returns {{status:'ok'|'divided'|'mismatch', sections:Array<object>, total:number, mismatch?:object}}
 */
function reconcile({ enteredTotalSeconds = 0, sections = [] }) {
  const safeSections = Array.isArray(sections) ? sections : [];

  // Case: total entered, sections empty → split equally.
  if (sectionsAreEmpty(safeSections) && enteredTotalSeconds > 0) {
    const divided = divideEqually(safeSections, enteredTotalSeconds);
    return { status: 'divided', sections: divided, total: enteredTotalSeconds };
  }

  // Case: sections provided → check for mismatch against entered total.
  const mismatch = detectMismatch(enteredTotalSeconds, safeSections);
  if (mismatch) {
    return { status: 'mismatch', sections: safeSections, total: sumSections(safeSections), mismatch };
  }

  // Case: sections provided and consistent (or no entered total).
  return { status: 'ok', sections: safeSections, total: sumSections(safeSections) };
}

/**
 * Format seconds as M:SS (or H:MM:SS when >= 1 hour).
 */
function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Convert minutes + seconds into total seconds.
 */
function toSeconds(minutes, seconds) {
  return (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
}

module.exports = {
  MAX_TOTAL_SECONDS,
  MAX_SECTION_SECONDS,
  clamp,
  sumSections,
  sectionsAreEmpty,
  divideEqually,
  adjustProportionally,
  detectMismatch,
  reconcile,
  formatClock,
  toSeconds
};
