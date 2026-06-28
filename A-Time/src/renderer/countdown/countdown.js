'use strict';

/**
 * Full-screen 3-2-1 countdown. Each number shows for one second. No sound.
 * When it reaches zero, it tells the main process to start the overlay timer.
 */
const numberEl = document.getElementById('number');
let started = false;

function show(n) {
  numberEl.textContent = String(n);
  // Restart the CSS pop animation on each number.
  numberEl.style.animation = 'none';
  void numberEl.offsetWidth; // force reflow
  numberEl.style.animation = '';
}

function runCountdown(from) {
  if (started) return;
  started = true;
  let current = from;
  show(current);
  const interval = setInterval(() => {
    current -= 1;
    if (current <= 0) {
      clearInterval(interval);
      window.atime.countdownDone();
      return;
    }
    show(current);
  }, 1000);
}

// Primary trigger: the main process tells us to start (and the start number).
window.atime.onCountdownStart((payload) => runCountdown((payload && payload.from) || 3));

// Safety fallback: if the start signal is missed, begin with 3 shortly after load.
setTimeout(() => runCountdown(3), 350);
