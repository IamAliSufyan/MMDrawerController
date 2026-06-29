'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const Store = require('electron-store');
const { assignColors } = require('../core/palette');

/**
 * Persistent local storage for timers and settings.
 * Backed by electron-store (a JSON file in app.getPath('userData')), so data
 * survives app restarts.
 */

const DEFAULT_SETTINGS = {
  overlayHeight: 46, // px
  overlayOpacity: 0.95, // 0..1
  monitorBehavior: 'main', // 'main' | 'all' | 'specific'
  specificDisplayId: null, // numeric display id when monitorBehavior === 'specific'
  overlayGap: 8, // px below the menu bar
  // Overlay position/size on screen. null = use defaults (left 0, top below the
  // menu bar, full screen width). These are set when the user drags/resizes.
  overlayLeft: null, // px from the display's left edge
  overlayTop: null, // px from the display's top edge
  overlayWidth: null, // px width; null = full screen width
  openAtLogin: false // launch PaceBar automatically when the user logs in
};

const STORE_FILE = 'a-time-data.json';

// Previous app names, newest first, to migrate saved data from when renaming.
const LEGACY_APP_NAMES = ['A-Timer', 'A-Time'];

/**
 * Migrate data from a previous app name (e.g. "A-Timer", "A-Time") to the
 * current one ("PaceBar") so renaming the app doesn't lose saved timers.
 * Runs once, before the store is opened.
 */
function migrateLegacyData() {
  try {
    const newPath = path.join(app.getPath('userData'), STORE_FILE);
    if (fs.existsSync(newPath)) return; // already migrated / has data
    for (const name of LEGACY_APP_NAMES) {
      const oldPath = path.join(app.getPath('appData'), name, STORE_FILE);
      if (fs.existsSync(oldPath)) {
        fs.mkdirSync(app.getPath('userData'), { recursive: true });
        fs.copyFileSync(oldPath, newPath);
        return;
      }
    }
  } catch (err) {
    console.error('[PaceBar] Legacy data migration failed:', err);
  }
}

migrateLegacyData();

/**
 * The required sample timer. Sections add up to 18 minutes while a user would
 * typically enter 15 minutes as the total — used to exercise the mismatch popup
 * during creation. Stored here as a ready-to-run 18-minute timer.
 */
function buildSampleTimer() {
  const sections = assignColors([
    { name: 'Sadiqabad people', duration: 3 * 60 },
    { name: 'Sources of income of Sadiqabad people', duration: 5 * 60 },
    { name: 'Famous people of Sadiqabad', duration: 6 * 60 },
    { name: "Population of Sadiqabad and its contribution to Pakistan's economy", duration: 4 * 60 }
  ]).map((s, i) => ({ ...s, id: `sample_sec_${i}` }));

  const total = sections.reduce((a, s) => a + s.duration, 0);
  return {
    id: 'sample_sadiqabad',
    name: 'Sadiqabad City Presentation',
    sections,
    total,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

const store = new Store({
  name: 'a-time-data',
  defaults: {
    timers: [],
    settings: DEFAULT_SETTINGS,
    seeded: false
  }
});

/** Seed the sample timer once, on first launch. */
function seedIfNeeded() {
  if (!store.get('seeded')) {
    const timers = store.get('timers') || [];
    if (!timers.some((t) => t.id === 'sample_sadiqabad')) {
      timers.unshift(buildSampleTimer());
      store.set('timers', timers);
    }
    store.set('seeded', true);
  }
}

// ---- Timers CRUD ----------------------------------------------------------

function getTimers() {
  return store.get('timers') || [];
}

function getTimer(id) {
  return getTimers().find((t) => t.id === id) || null;
}

function saveTimer(timer) {
  const timers = getTimers();
  const index = timers.findIndex((t) => t.id === timer.id);
  if (index >= 0) {
    timers[index] = timer;
  } else {
    timers.push(timer);
  }
  store.set('timers', timers);
  return timer;
}

function deleteTimer(id) {
  const timers = getTimers().filter((t) => t.id !== id);
  store.set('timers', timers);
  return true;
}

/** Duplicate a timer, appending "(Copy)" and giving it fresh ids. */
function duplicateTimer(id) {
  const original = getTimer(id);
  if (!original) return null;
  const copy = {
    ...original,
    id: 'tmr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    name: `${original.name} (Copy)`,
    sections: original.sections.map((s, i) => ({
      ...s,
      id: `sec_${Date.now()}_${i}`
    })),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  saveTimer(copy);
  return copy;
}

// ---- Settings -------------------------------------------------------------

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(store.get('settings') || {}) };
}

function saveSettings(partial) {
  const merged = { ...getSettings(), ...(partial || {}) };
  store.set('settings', merged);
  return merged;
}

module.exports = {
  DEFAULT_SETTINGS,
  seedIfNeeded,
  getTimers,
  getTimer,
  saveTimer,
  deleteTimer,
  duplicateTimer,
  getSettings,
  saveSettings,
  buildSampleTimer
};
