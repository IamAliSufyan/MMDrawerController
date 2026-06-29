'use strict';

/**
 * Splash renderer. The main process sends the app logo as a data URL once the
 * window has loaded; we display it for the brief splash duration.
 */
const logo = document.getElementById('logo');

window.atime.splash.onLogo((dataUrl) => {
  if (dataUrl) logo.src = dataUrl;
});
