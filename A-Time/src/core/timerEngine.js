'use strict';

/**
 * TimerEngine — the authoritative countdown for a running A-Time timer.
 *
 * Design goals:
 *  - Pure logic, framework-free (no Electron / DOM) so it is unit-testable.
 *  - Drift-free: remaining time is always derived from wall-clock timestamps,
 *    never accumulated tick-by-tick.
 *  - Event driven via a tiny built-in subscriber list (no Node EventEmitter
 *    dependency required, though Node is fine in tests).
 *
 * All durations are in seconds. Times are computed against an injectable
 * `now()` clock so tests can advance time deterministically.
 *
 * Emitted events:
 *   'tick'         -> (state)  ~5x/sec while running
 *   'sectionChange'-> ({ from, to, state })  when crossing into a new section
 *   'sectionEnd'   -> ({ index, state })     when a section finishes
 *   'complete'     -> (state)  when the whole timer finishes
 *   'statusChange' -> (state)  on start/pause/resume/stop/reset
 */
class TimerEngine {
  /**
   * @param {object} timer  { sections: [{name, color, duration}], ... }
   * @param {object} [options]
   * @param {() => number} [options.now] clock returning ms (defaults Date.now)
   * @param {number} [options.tickMs] tick interval in ms (default 200)
   * @param {boolean} [options.autoStartTicker] start a real interval (default true)
   */
  constructor(timer, options = {}) {
    this.timer = timer || { sections: [] };
    this.sections = (this.timer.sections || []).map((s) => ({
      name: s.name || '',
      color: s.color || '#cccccc',
      duration: Math.max(0, Number(s.duration) || 0)
    }));
    this.totalDuration = this.sections.reduce((a, s) => a + s.duration, 0);

    // Precompute cumulative boundaries: starts[i] = elapsed at which section i begins.
    this.starts = [];
    let acc = 0;
    for (const s of this.sections) {
      this.starts.push(acc);
      acc += s.duration;
    }

    this.now = options.now || (() => Date.now());
    this.tickMs = options.tickMs || 200;
    this.autoStartTicker = options.autoStartTicker !== false;

    this._listeners = {};
    this._interval = null;

    // Runtime state
    this.accumulatedElapsed = 0; // seconds elapsed while paused/stopped snapshots
    this.segmentStart = null; // ms timestamp when current running segment began
    this.running = false;
    this.paused = false;
    this.finished = false;
    this._lastSectionIndex = 0;
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event, handler) {
    (this._listeners[event] || (this._listeners[event] = [])).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const arr = this._listeners[event];
    if (!arr) return;
    const i = arr.indexOf(handler);
    if (i >= 0) arr.splice(i, 1);
  }

  _emit(event, payload) {
    const arr = this._listeners[event];
    if (!arr) return;
    for (const h of arr.slice()) {
      try { h(payload); } catch (err) { /* never let a listener break the engine */ }
    }
  }

  /** Total elapsed seconds (live while running). */
  getElapsed() {
    if (this.running && !this.paused && this.segmentStart != null) {
      return this.accumulatedElapsed + (this.now() - this.segmentStart) / 1000;
    }
    return this.accumulatedElapsed;
  }

  /** Index of the section the given elapsed time falls into. */
  sectionIndexAt(elapsed) {
    if (this.sections.length === 0) return 0;
    if (elapsed >= this.totalDuration) return this.sections.length - 1;
    for (let i = this.sections.length - 1; i >= 0; i--) {
      if (elapsed >= this.starts[i]) return i;
    }
    return 0;
  }

  /** Build an immutable snapshot of the current state for views. */
  getState() {
    const elapsed = Math.min(this.getElapsed(), this.totalDuration);
    const index = this.sectionIndexAt(elapsed);
    const section = this.sections[index] || { name: '', color: '#cccccc', duration: 0 };
    const sectionElapsed = Math.max(0, elapsed - this.starts[index]);
    const sectionRemaining = Math.max(0, section.duration - sectionElapsed);
    const totalRemaining = Math.max(0, this.totalDuration - elapsed);

    return {
      running: this.running,
      paused: this.paused,
      finished: this.finished,
      totalDuration: this.totalDuration,
      elapsed,
      totalRemaining,
      currentIndex: index,
      currentName: section.name,
      currentColor: section.color,
      sectionElapsed,
      sectionRemaining,
      sectionDuration: section.duration,
      sections: this.sections,
      starts: this.starts,
      // progress 0..1 across the whole timer
      progress: this.totalDuration > 0 ? elapsed / this.totalDuration : 0
    };
  }

  _startTicker() {
    if (!this.autoStartTicker || this._interval) return;
    this._interval = setInterval(() => this.tick(), this.tickMs);
    if (this._interval.unref) this._interval.unref();
  }

  _stopTicker() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  /** Begin (or restart from zero) the countdown. */
  start() {
    this.accumulatedElapsed = 0;
    this.segmentStart = this.now();
    this.running = true;
    this.paused = false;
    this.finished = false;
    this._lastSectionIndex = 0;
    this._startTicker();
    this._emit('statusChange', this.getState());
    this._emit('tick', this.getState());
  }

  pause() {
    if (!this.running || this.paused || this.finished) return;
    this.accumulatedElapsed = this.getElapsed();
    this.paused = true;
    this.segmentStart = null;
    this._emit('statusChange', this.getState());
  }

  resume() {
    if (!this.running || !this.paused || this.finished) return;
    this.segmentStart = this.now();
    this.paused = false;
    this._emit('statusChange', this.getState());
  }

  /** Toggle pause/resume (Space shortcut). */
  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.segmentStart = null;
    this._stopTicker();
    this._emit('statusChange', this.getState());
  }

  /** Reset back to the very beginning and start running again. */
  reset() {
    const wasRunning = this.running;
    this.accumulatedElapsed = 0;
    this._lastSectionIndex = 0;
    this.finished = false;
    if (wasRunning && !this.paused) {
      this.segmentStart = this.now();
    } else {
      this.segmentStart = null;
    }
    this._emit('statusChange', this.getState());
    this._emit('tick', this.getState());
  }

  /** Jump the elapsed clock to a specific value (seconds), keeping run state. */
  _seek(elapsedSeconds) {
    const target = Math.max(0, Math.min(elapsedSeconds, this.totalDuration));
    this.accumulatedElapsed = target;
    if (this.running && !this.paused) {
      this.segmentStart = this.now();
    }
    this.finished = target >= this.totalDuration;
    this._lastSectionIndex = this.sectionIndexAt(target);
  }

  /** Advance to the start of the next section. */
  nextSection() {
    const index = this.sectionIndexAt(this.getElapsed());
    if (index >= this.sections.length - 1) {
      // Already in last section → jump to completion.
      this._seek(this.totalDuration);
      this._handleCompletion();
      return;
    }
    const from = index;
    this._seek(this.starts[index + 1]);
    this._emit('sectionChange', { from, to: index + 1, state: this.getState() });
    this._emit('tick', this.getState());
  }

  /**
   * Go back. If we're more than 1s into the current section, restart it;
   * otherwise jump to the start of the previous section.
   */
  previousSection() {
    const elapsed = this.getElapsed();
    const index = this.sectionIndexAt(elapsed);
    const intoSection = elapsed - this.starts[index];
    let targetIndex = index;
    if (intoSection <= 1 && index > 0) targetIndex = index - 1;
    const from = index;
    this._seek(this.starts[targetIndex]);
    if (targetIndex !== from) {
      this._emit('sectionChange', { from, to: targetIndex, state: this.getState() });
    }
    this._emit('tick', this.getState());
  }

  _handleCompletion() {
    if (this.finished && !this.running) return;
    this.finished = true;
    this.running = false;
    this.paused = false;
    this.segmentStart = null;
    this._stopTicker();
    this._emit('complete', this.getState());
    this._emit('statusChange', this.getState());
  }

  /**
   * Advance the engine. Normally called by the internal interval, but exposed
   * so tests (and the manual stepping) can drive it deterministically.
   */
  tick() {
    if (!this.running || this.paused || this.finished) return;

    const elapsed = this.getElapsed();
    const index = this.sectionIndexAt(Math.min(elapsed, this.totalDuration));

    // Detect section boundary crossings (there may be several if a section
    // has zero duration or a long pause occurred).
    while (this._lastSectionIndex < index) {
      const ended = this._lastSectionIndex;
      this._emit('sectionEnd', { index: ended, state: this.getState() });
      this._lastSectionIndex += 1;
      this._emit('sectionChange', { from: ended, to: this._lastSectionIndex, state: this.getState() });
    }

    if (elapsed >= this.totalDuration) {
      // Fire the final section's end, then complete.
      const lastIndex = this.sections.length - 1;
      this._emit('sectionEnd', { index: lastIndex, state: this.getState() });
      this._handleCompletion();
      return;
    }

    this._emit('tick', this.getState());
  }

  /** Tear down timers/listeners. */
  dispose() {
    this._stopTicker();
    this._listeners = {};
  }
}

module.exports = { TimerEngine };
