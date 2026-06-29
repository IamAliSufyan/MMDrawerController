'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Pure core logic is required directly here (preload runs in Node) and exposed
// to the renderers so form math and overlay rendering share one source of truth
// without IPC round-trips.
const timeCalc = require('../core/timeCalc');
const palette = require('../core/palette');

/** Helper: subscribe to a channel, return an unsubscribe function. */
function on(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('atime', {
  // ---- Storage (request/response) ----
  timers: {
    list: () => ipcRenderer.invoke('timers:list'),
    get: (id) => ipcRenderer.invoke('timers:get', id),
    save: (timer) => ipcRenderer.invoke('timers:save', timer),
    remove: (id) => ipcRenderer.invoke('timers:delete', id),
    duplicate: (id) => ipcRenderer.invoke('timers:duplicate', id)
  },

  // ---- Settings ----
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (partial) => ipcRenderer.invoke('settings:save', partial)
  },

  // ---- Displays ----
  displays: {
    list: () => ipcRenderer.invoke('displays:list')
  },

  // ---- Timer control (fire-and-forget) ----
  control: {
    play: (timerId) => ipcRenderer.send('timer:play', timerId),
    togglePause: () => ipcRenderer.send('timer:togglePause'),
    pause: () => ipcRenderer.send('timer:pause'),
    resume: () => ipcRenderer.send('timer:resume'),
    stop: () => ipcRenderer.send('timer:stop'),
    reset: () => ipcRenderer.send('timer:reset'),
    next: () => ipcRenderer.send('timer:next'),
    prev: () => ipcRenderer.send('timer:prev')
  },

  // ---- Countdown renderer -> main ----
  countdownDone: () => ipcRenderer.send('countdown:done'),
  onCountdownStart: (cb) => on('countdown:start', cb),

  // ---- Splash ----
  splash: {
    onLogo: (cb) => on('splash:logo', cb)
  },

  // ---- Menu-bar popover ----
  popover: {
    hide: () => ipcRenderer.send('popover:hide'),
    resize: (height) => ipcRenderer.send('popover:resize', height),
    onShow: (cb) => on('popover:show', cb)
  },

  // ---- Main window navigation (from the popover) ----
  app: {
    openMain: (opts) => ipcRenderer.send('app:open-main', opts),
    onNavigate: (cb) => on('app:navigate', cb),
    quit: () => ipcRenderer.send('app:quit')
  },

  // ---- Overlay ----
  overlay: {
    setIgnoreMouse: (ignore) => ipcRenderer.send('overlay:set-ignore-mouse', ignore),
    onConfig: (cb) => on('overlay:config', cb),
    onInit: (cb) => on('overlay:init', cb),
    onState: (cb) => on('overlay:state', cb),
    onSound: (cb) => on('sound:play', cb)
  },

  // ---- Pure helpers (shared core logic) ----
  calc: {
    reconcile: timeCalc.reconcile,
    adjustProportionally: timeCalc.adjustProportionally,
    divideEqually: timeCalc.divideEqually,
    detectMismatch: timeCalc.detectMismatch,
    sumSections: timeCalc.sumSections,
    formatClock: timeCalc.formatClock,
    toSeconds: timeCalc.toSeconds,
    MAX_TOTAL_SECONDS: timeCalc.MAX_TOTAL_SECONDS,
    MAX_SECTION_SECONDS: timeCalc.MAX_SECTION_SECONDS
  },
  palette: {
    list: palette.DEFAULT_PALETTE,
    colorForIndex: palette.colorForIndex,
    assignColors: palette.assignColors
  }
});
