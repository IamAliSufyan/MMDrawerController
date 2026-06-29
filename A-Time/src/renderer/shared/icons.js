'use strict';

/**
 * Shared inline-SVG icon set so buttons look consistent across the overlay,
 * popover and main window. Icons use `currentColor`, so they inherit the
 * button's text color automatically. 24x24 viewBox.
 */

// Each entry: { fill: true|false, body: '<svg inner markup>' }
const PATHS = {
  play:  { fill: true,  body: '<path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5z"/>' },
  pause: { fill: true,  body: '<rect x="6" y="5" width="4" height="14" rx="1.6"/><rect x="14" y="5" width="4" height="14" rx="1.6"/>' },
  stop:  { fill: true,  body: '<rect x="6" y="6" width="12" height="12" rx="2.6"/>' },
  reset: { fill: false, body: '<path d="M3 3v5h5"/><path d="M3.5 13a8.5 8.5 0 1 0 2.4-6.4L3 8"/>' },
  next:  { fill: true,  body: '<path d="M5 5.5v13a1 1 0 0 0 1.5.87L16 13v5a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v5L6.5 4.63A1 1 0 0 0 5 5.5z"/>' },
  prev:  { fill: true,  body: '<path d="M19 5.5v13a1 1 0 0 1-1.5.87L8 13v5a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5l9.5-6.37A1 1 0 0 1 19 5.5z"/>' },
  ellipsis: { fill: true, body: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>' },
  gear: { fill: false, body: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
  edit: { fill: false, body: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>' },
  copy: { fill: false, body: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>' },
  trash: { fill: false, body: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>' },
  plus: { fill: false, body: '<path d="M12 5v14M5 12h14"/>' }
};

/**
 * Return an SVG markup string for the named icon.
 * @param {string} name
 * @param {number} [size=16]
 */
export function icon(name, size = 16) {
  const p = PATHS[name];
  if (!p) return '';
  const attrs = p.fill
    ? 'fill="currentColor"'
    : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${attrs} aria-hidden="true" focusable="false">${p.body}</svg>`;
}
