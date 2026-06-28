'use strict';

const { globalShortcut } = require('electron');

/**
 * Global keyboard shortcuts, active only while a timer is running so they don't
 * hijack the keys (especially Space / Escape) during normal Mac use.
 *
 *   Space          -> pause / resume
 *   Command+R      -> restart timer
 *   Command+Right  -> next section
 *   Command+Left   -> previous section
 *   Escape         -> stop timer
 */
function registerShortcuts(handlers) {
  unregisterShortcuts();
  const bindings = [
    ['Space', handlers.togglePause],
    ['CommandOrControl+R', handlers.restart],
    ['CommandOrControl+Right', handlers.nextSection],
    ['CommandOrControl+Left', handlers.previousSection],
    ['Escape', handlers.stop]
  ];

  for (const [accelerator, fn] of bindings) {
    if (typeof fn !== 'function') continue;
    try {
      const ok = globalShortcut.register(accelerator, fn);
      if (!ok) console.warn(`[A-Time] Could not register shortcut: ${accelerator}`);
    } catch (err) {
      console.error(`[A-Time] Error registering ${accelerator}:`, err);
    }
  }
}

function unregisterShortcuts() {
  try {
    globalShortcut.unregisterAll();
  } catch (err) {
    console.error('[A-Time] Error unregistering shortcuts:', err);
  }
}

module.exports = { registerShortcuts, unregisterShortcuts };
