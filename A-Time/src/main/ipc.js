'use strict';

const { ipcMain, screen, app } = require('electron');
const store = require('./store');
const { validateTimer } = require('../core/validation');

/**
 * Registers all ipcMain handlers, bridging the renderers to storage, settings,
 * display info and the timer controller. Request/response channels use
 * ipcMain.handle; fire-and-forget control channels use ipcMain.on.
 *
 * @param {object} deps
 * @param {import('./controller').TimerController} deps.controller
 * @param {import('./overlayManager').OverlayManager} deps.overlay
 */
function registerIpc({ controller, overlay }) {
  // ---- Timers (storage) ---------------------------------------------------
  ipcMain.handle('timers:list', () => store.getTimers());
  ipcMain.handle('timers:get', (_e, id) => store.getTimer(id));

  ipcMain.handle('timers:save', (_e, payload) => {
    const result = validateTimer(payload);
    if (!result.valid) {
      return { ok: false, errors: result.errors };
    }
    const saved = store.saveTimer(result.timer);
    // If this timer is currently playing, apply the edits to the live session.
    controller.updateRunningTimer(saved);
    return { ok: true, timer: saved };
  });

  ipcMain.handle('timers:delete', (_e, id) => {
    // If the timer being deleted is currently running, stop it first.
    controller.stopIfDeleted(id);
    store.deleteTimer(id);
    return { ok: true };
  });

  ipcMain.handle('timers:duplicate', (_e, id) => {
    const copy = store.duplicateTimer(id);
    return copy ? { ok: true, timer: copy } : { ok: false };
  });

  // ---- Settings -----------------------------------------------------------
  ipcMain.handle('settings:get', () => {
    const settings = store.getSettings();
    // The OS is the source of truth for the login item.
    try { settings.openAtLogin = app.getLoginItemSettings().openAtLogin; } catch (_) { /* non-mac/dev */ }
    return settings;
  });

  ipcMain.handle('settings:save', (_e, partial) => {
    const merged = store.saveSettings(partial);
    // Apply the "open at login" preference to the OS when it changes.
    if (partial && Object.prototype.hasOwnProperty.call(partial, 'openAtLogin')) {
      try {
        app.setLoginItemSettings({ openAtLogin: !!partial.openAtLogin, openAsHidden: true });
      } catch (err) {
        console.error('[PaceBar] setLoginItemSettings failed:', err);
      }
    }
    controller.applySettings();
    return merged;
  });

  // ---- Displays -----------------------------------------------------------
  ipcMain.handle('displays:list', () => {
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: d.label || `Display ${i + 1}`,
      width: d.bounds.width,
      height: d.bounds.height,
      isPrimary: d.id === primaryId
    }));
  });

  // ---- Timer control (fire-and-forget) ------------------------------------
  ipcMain.on('timer:play', (_e, timerId) => {
    const timer = store.getTimer(timerId);
    if (timer) controller.play(timer);
  });
  ipcMain.on('timer:togglePause', () => controller.togglePause());
  ipcMain.on('timer:pause', () => controller.pause());
  ipcMain.on('timer:resume', () => controller.resume());
  ipcMain.on('timer:stop', () => controller.stop());
  ipcMain.on('timer:reset', () => controller.reset());
  ipcMain.on('timer:next', () => controller.nextSection());
  ipcMain.on('timer:prev', () => controller.previousSection());

  // ---- Countdown ----------------------------------------------------------
  ipcMain.on('countdown:done', () => controller.notifyCountdownDone());

  // ---- Overlay click-through toggle ---------------------------------------
  // The overlay renderer enables hit-testing only while the pointer is over the
  // controls cluster; everything else stays click-through.
  ipcMain.on('overlay:set-ignore-mouse', (_e, ignore) => {
    overlay.setIgnoreMouse(!!ignore);
  });
}

module.exports = { registerIpc };
