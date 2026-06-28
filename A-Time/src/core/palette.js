'use strict';

/**
 * Built-in default palette of 9 pleasant, distinct colors.
 * Used when a user does not pick a color for a section.
 * Colors are assigned in order and wrap around (modulo) when the
 * number of sections exceeds the palette length.
 */
const DEFAULT_PALETTE = [
  '#4C8BF5', // blue
  '#34C759', // green
  '#FF9F0A', // orange
  '#FF375F', // pink/red
  '#AF52DE', // purple
  '#5AC8FA', // teal
  '#FFD60A', // yellow
  '#FF6B35', // coral
  '#30D158'  // mint green
];

/**
 * Returns the palette color for a given section index, wrapping around
 * the palette when the index exceeds its length.
 * @param {number} index zero-based section index
 * @returns {string} hex color
 */
function colorForIndex(index) {
  if (!Number.isFinite(index) || index < 0) index = 0;
  return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
}

/**
 * Assigns default colors to any section that does not already have one.
 * Does not mutate the input array.
 * @param {Array<{color?: string}>} sections
 * @returns {Array<object>} new array with `color` guaranteed on each section
 */
function assignColors(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((section, index) => ({
    ...section,
    color: section && section.color ? section.color : colorForIndex(index)
  }));
}

module.exports = { DEFAULT_PALETTE, colorForIndex, assignColors };
