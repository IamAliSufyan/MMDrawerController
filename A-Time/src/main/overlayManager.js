'use strict';

const { screen } = require('electron');
const { createOverlayWindow } = require('./windows');

/**
 * Owns the overlay window(s): which display(s) they appear on, their size and
 * opacity, click-through state, and forwarding timer state to them.
 *
 * The overlay window spans an entire display (transparent); the renderer draws
 * the progress bar near the top using the configured gap + height. The whole
 * window is click-through except the controls cluster, which the renderer
 * toggles via the 'overlay:set-ignore-mouse' IPC channel.
 */
class OverlayManager {
  constructor() {
    /** @type {Array<{win: Electron.BrowserWindow, displayId: number}>} */
    this.windows = [];
    this.active = false;
    this.lastTimerMeta = null;
  }

  /** Resolve the displays to render on, from the user's settings. */
  _targetDisplays(settings) {
    const all = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    switch (settings.monitorBehavior) {
      case 'all':
        return all;
      case 'specific': {
        const match = all.find((d) => d.id === settings.specificDisplayId);
        return [match || primary];
      }
      case 'main':
      default:
        return [primary];
    }
  }

  /** Whether the overlay is currently shown. */
  isActive() {
    return this.active && this.windows.length > 0;
  }

  /** webContents of the first overlay window (used for sound playback). */
  primaryWebContents() {
    const first = this.windows[0];
    return first && !first.win.isDestroyed() ? first.win.webContents : null;
  }

  /**
   * Create and show overlay windows for the configured displays.
   * @param {object} timerMeta  { sections, totalDuration, name }
   * @param {object} settings
   */
  show(timerMeta, settings) {
    this.hide(); // clear any stragglers
    this.lastTimerMeta = timerMeta;
    this._monitorKey = this._keyFor(settings);
    const displays = this._targetDisplays(settings);

    for (const display of displays) {
      const win = createOverlayWindow(display, settings);
      const entry = { win, displayId: display.id };
      this.windows.push(entry);

      win.webContents.once('did-finish-load', () => {
        if (win.isDestroyed()) return;
        win.webContents.send('overlay:config', this._buildConfig(settings, display));
        win.webContents.send('overlay:init', timerMeta);
        win.showInactive(); // show without taking focus
      });
    }
    this.active = true;
  }

  /** A key describing which displays the overlay should render on. */
  _keyFor(settings) {
    return `${settings.monitorBehavior}:${settings.specificDisplayId || ''}`;
  }

  /** Build the renderer config (size, opacity, position) for a display. */
  _buildConfig(settings, display) {
    const menuBarOffset = display
      ? Math.max(0, display.workArea.y - display.bounds.y)
      : 0;
    return {
      height: settings.overlayHeight,
      opacity: settings.overlayOpacity,
      gap: settings.overlayGap,
      menuBarOffset,
      left: settings.overlayLeft,
      top: settings.overlayTop,
      width: settings.overlayWidth,
      displayWidth: display ? display.bounds.width : null,
      displayHeight: display ? display.bounds.height : null
    };
  }

  /** Re-send the timer meta so overlays rebuild their section segments. */
  reinit(meta) {
    this.lastTimerMeta = meta;
    for (const { win } of this.windows) {
      if (!win.isDestroyed()) win.webContents.send('overlay:init', meta);
    }
  }

  /** Push a timer state snapshot to every overlay window. */
  updateState(state) {
    for (const { win } of this.windows) {
      if (!win.isDestroyed()) win.webContents.send('overlay:state', state);
    }
  }

  /**
   * Re-apply live settings. Size/opacity/position update in place; a change to
   * which monitor(s) to use rebuilds the overlay windows.
   */
  applySettings(settings) {
    // If the target displays changed, rebuild the overlay windows entirely.
    if (this.isActive() && this.lastTimerMeta && this._keyFor(settings) !== this._monitorKey) {
      this.show(this.lastTimerMeta, settings);
      return;
    }
    for (const { win, displayId } of this.windows) {
      if (win.isDestroyed()) continue;
      const display = screen.getAllDisplays().find((d) => d.id === displayId);
      win.webContents.send('overlay:config', this._buildConfig(settings, display));
    }
  }

  /**
   * Toggle click-through. Called from the renderer when the pointer enters or
   * leaves the controls cluster so only the controls are interactive.
   * @param {boolean} ignore
   */
  setIgnoreMouse(ignore) {
    for (const { win } of this.windows) {
      if (!win.isDestroyed()) {
        win.setIgnoreMouseEvents(ignore, { forward: true });
      }
    }
  }

  /** Close and clear all overlay windows. */
  hide() {
    for (const { win } of this.windows) {
      if (!win.isDestroyed()) win.close();
    }
    this.windows = [];
    this.active = false;
  }
}

module.exports = { OverlayManager };
