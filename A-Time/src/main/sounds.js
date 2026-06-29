'use strict';

/**
 * Built-in sound playback.
 *
 * To stay dependency-free and avoid bundling/importing custom audio files, the
 * sounds are synthesized in the overlay renderer using the Web Audio API. The
 * main process simply asks the overlay to play one of two built-in cues:
 *   - 'section' : a soft chime when a section ends
 *   - 'complete': a distinct chord when the whole timer ends
 *
 * @param {() => (Electron.WebContents | null)} getOverlayWebContents
 */
function createSoundPlayer(getOverlayWebContents) {
  function play(kind) {
    try {
      const wc = getOverlayWebContents();
      if (wc && !wc.isDestroyed()) {
        wc.send('sound:play', kind);
      }
    } catch (err) {
      console.error('[PaceBar] Failed to play sound:', err);
    }
  }
  return {
    sectionEnd: () => play('section'),
    timerComplete: () => play('complete')
  };
}

module.exports = { createSoundPlayer };
