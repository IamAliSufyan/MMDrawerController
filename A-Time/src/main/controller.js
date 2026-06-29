'use strict';

const { Notification, screen } = require('electron');
const { TimerEngine } = require('../core/timerEngine');
const { formatClock } = require('../core/timeCalc');
const { assignColors } = require('../core/palette');
const power = require('./powerManager');
const { registerShortcuts, unregisterShortcuts } = require('./shortcuts');
const { createCountdownWindow } = require('./windows');

/**
 * Orchestrates a running timer: drives the TimerEngine and connects its events
 * to the overlay, tray, sounds, notifications, sleep prevention and global
 * shortcuts. Keeps all timer side-effects in one place, separate from UI.
 */
class TimerController {
  /**
   * @param {object} deps
   * @param {import('./overlayManager').OverlayManager} deps.overlay
   * @param {object} deps.tray  tray wrapper from createTray()
   * @param {() => object} deps.getSettings
   * @param {object} deps.sounds  sound player from createSoundPlayer()
   */
  constructor(deps) {
    this.overlay = deps.overlay;
    this.tray = deps.tray;
    this.getSettings = deps.getSettings;
    this.sounds = deps.sounds;

    this.engine = null;
    this.currentTimer = null;
    this.countdownWindow = null;
  }

  /** Pick the display the countdown/overlay should appear on. */
  _primaryTargetDisplay() {
    const settings = this.getSettings();
    if (settings.monitorBehavior === 'specific') {
      const match = screen.getAllDisplays().find((d) => d.id === settings.specificDisplayId);
      if (match) return match;
    }
    return screen.getPrimaryDisplay();
  }

  isRunning() {
    return !!this.engine && this.engine.running && !this.engine.finished;
  }

  /**
   * Begin the play sequence for a saved timer: show the 3-2-1 countdown, then
   * start the overlay timer.
   * @param {object} timer
   */
  play(timer) {
    if (!timer || !Array.isArray(timer.sections) || timer.sections.length === 0) {
      return;
    }
    // Stop anything already running.
    this.stop();

    // Ensure every section has a color (assign defaults in order).
    this.currentTimer = { ...timer, sections: assignColors(timer.sections) };

    this._showCountdown(() => this._startEngine());
  }

  _showCountdown(onDone) {
    const display = this._primaryTargetDisplay();
    const win = createCountdownWindow(display);
    this.countdownWindow = win;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (!win.isDestroyed()) win.close();
      this.countdownWindow = null;
      onDone();
    };

    win.webContents.once('did-finish-load', () => {
      if (win.isDestroyed()) return;
      win.webContents.send('countdown:start', { from: 3 });
      win.showInactive();
    });

    // The countdown renderer reports completion via ipcMain ('countdown:done'),
    // which calls notifyCountdownDone(). Guard with a timeout fallback in case
    // the renderer never reports (3 numbers * 1s + buffer).
    this._countdownFallback = setTimeout(finish, 3600);
    this._countdownFinish = finish;
  }

  /** Called by ipc.js when the countdown renderer signals completion. */
  notifyCountdownDone() {
    if (this._countdownFallback) clearTimeout(this._countdownFallback);
    const finish = this._countdownFinish;
    this._countdownFinish = null;
    if (finish) finish();
  }

  /** Build the renderer meta (sections/colors/total) from the current timer. */
  _buildMeta() {
    const t = this.currentTimer;
    return {
      name: t.name,
      totalDuration: t.sections.reduce((a, s) => a + s.duration, 0),
      sections: t.sections.map((s) => ({ name: s.name, color: s.color, duration: s.duration }))
    };
  }

  /** Create a TimerEngine for the current timer with all event side-effects wired. */
  _createWiredEngine() {
    const engine = new TimerEngine(this.currentTimer, { tickMs: 200 });

    engine.on('tick', (state) => {
      this.overlay.updateState(state);
      this.tray.setRemaining(formatClock(state.totalRemaining));
    });
    engine.on('statusChange', (state) => this.overlay.updateState(state));
    engine.on('sectionEnd', ({ index, state }) => {
      // Soft chime when an *intermediate* section ends (the final section's end
      // is handled by completion to avoid a double sound).
      if (index < state.sections.length - 1) this.sounds.sectionEnd();
    });
    engine.on('complete', (state) => this._onComplete(state));
    return engine;
  }

  _startEngine() {
    if (!this.currentTimer) return;

    // Show the overlay across the configured displays.
    this.overlay.show(this._buildMeta(), this.getSettings());
    this.engine = this._createWiredEngine();

    power.preventSleep();
    registerShortcuts({
      togglePause: () => this.togglePause(),
      restart: () => this.reset(),
      nextSection: () => this.nextSection(),
      previousSection: () => this.previousSection(),
      stop: () => this.stop()
    });

    this.engine.start();
  }

  /**
   * Apply an edited timer to the live session: rebuild the overlay segments and
   * engine with the new sections, preserving elapsed time and pause state where
   * possible. No-op if the edited timer isn't the one currently playing.
   */
  updateRunningTimer(updated) {
    if (!this.currentTimer || !updated || this.currentTimer.id !== updated.id) return;

    const wasRunning = this.engine && this.engine.running;
    const wasPaused = this.engine && this.engine.paused;
    const oldElapsed = this.engine ? this.engine.getElapsed() : 0;

    // Keep colors consistent with any new sections.
    this.currentTimer = { ...updated, sections: assignColors(updated.sections) };

    // If we're still in the countdown (no live engine yet), the new definition
    // will be picked up when the engine starts.
    if (!wasRunning) return;

    const meta = this._buildMeta();
    this.overlay.reinit(meta); // rebuild section segments in place (no flicker)

    this.engine.stop();
    this.engine.dispose();
    this.engine = this._createWiredEngine();
    this.engine.start();
    this.engine.seek(Math.min(oldElapsed, this.engine.totalDuration));
    if (wasPaused) this.engine.pause();
  }

  _onComplete(state) {
    this.sounds.timerComplete();
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: 'A-Time',
          body: `"${this.currentTimer ? this.currentTimer.name : 'Timer'}" has finished.`,
          silent: true // we already play our own completion sound
        }).show();
      }
    } catch (err) {
      console.error('[A-Time] Notification failed:', err);
    }

    // Give the overlay a beat to show 100%, then hide.
    setTimeout(() => this.overlay.hide(), 1200);
    this.tray.setRemaining('');
    power.allowSleep();
    unregisterShortcuts();
  }

  // ---- Controls (overlay buttons + global shortcuts) ----------------------

  togglePause() {
    if (!this.engine) return;
    this.engine.togglePause();
    if (this.engine.paused) power.allowSleep();
    else power.preventSleep();
  }

  pause() {
    if (!this.engine || this.engine.paused) return;
    this.engine.pause();
    power.allowSleep();
  }

  resume() {
    if (!this.engine || !this.engine.paused) return;
    this.engine.resume();
    power.preventSleep();
  }

  reset() {
    if (!this.engine) return;
    this.engine.reset();
    power.preventSleep();
  }

  nextSection() {
    if (this.engine) this.engine.nextSection();
  }

  previousSection() {
    if (this.engine) this.engine.previousSection();
  }

  stop() {
    // Cancel any in-flight countdown so a late 'countdown:done' can't start it.
    if (this._countdownFallback) clearTimeout(this._countdownFallback);
    this._countdownFinish = null;
    if (this.countdownWindow && !this.countdownWindow.isDestroyed()) {
      this.countdownWindow.close();
      this.countdownWindow = null;
    }
    if (this.engine) {
      this.engine.stop();
      this.engine.dispose();
      this.engine = null;
    }
    this.overlay.hide();
    this.tray.setRemaining('');
    power.allowSleep();
    unregisterShortcuts();
  }

  /**
   * Stop the running timer if it is the one being deleted, so deleting a timer
   * from the app window also clears its overlay / menu bar countdown.
   */
  stopIfDeleted(timerId) {
    if (this.currentTimer && this.currentTimer.id === timerId) {
      this.stop();
      this.currentTimer = null;
    }
  }

  /** Re-apply settings live to a visible overlay. */
  applySettings() {
    if (this.overlay.isActive()) {
      this.overlay.applySettings(this.getSettings());
    }
  }
}

module.exports = { TimerController };
