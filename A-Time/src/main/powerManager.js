'use strict';

const { powerSaveBlocker } = require('electron');

/**
 * Prevents the Mac from sleeping while a timer is actively running.
 * Sleep is allowed again as soon as the timer is paused, stopped, or completed.
 */
let blockerId = null;

function preventSleep() {
  try {
    if (blockerId === null || !powerSaveBlocker.isStarted(blockerId)) {
      // 'prevent-display-sleep' keeps the screen awake too, ideal for a
      // presentation where the overlay must stay visible.
      blockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
  } catch (err) {
    console.error('[PaceBar] Failed to start power save blocker:', err);
  }
}

function allowSleep() {
  try {
    if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) {
      powerSaveBlocker.stop(blockerId);
    }
  } catch (err) {
    console.error('[PaceBar] Failed to stop power save blocker:', err);
  } finally {
    blockerId = null;
  }
}

module.exports = { preventSleep, allowSleep };
