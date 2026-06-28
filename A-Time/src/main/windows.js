'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');

const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const RENDERER = path.join(__dirname, '..', 'renderer');

const baseWebPreferences = {
  preload: PRELOAD,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false // preload needs require() for the contextBridge wiring
};

/**
 * The main app window: timer list, creation form and settings.
 */
function createMainWindow() {
  const win = new BrowserWindow({
    width: 760,
    height: 680,
    minWidth: 560,
    minHeight: 480,
    show: false,
    title: 'A-Time',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1c1c1e',
    webPreferences: baseWebPreferences
  });

  win.loadFile(path.join(RENDERER, 'main', 'index.html'));

  // Hide instead of quitting when the user closes the window — the app lives
  // in the menu bar.
  win.on('close', (event) => {
    if (!win._forceClose) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

/**
 * The click-through overlay window. Created spanning a given display's bounds.
 * @param {Electron.Display} display
 * @param {object} settings
 */
function createOverlayWindow(display, settings) {
  const { bounds } = display;
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false, // never steal focus from the presentation
    skipTaskbar: true,
    fullscreenable: false,
    acceptFirstMouse: true,
    backgroundColor: '#00000000',
    webPreferences: baseWebPreferences
  });

  // Float above everything, including full-screen apps and other spaces.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Start fully click-through; the renderer re-enables hit-testing only over
  // the controls cluster.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(RENDERER, 'overlay', 'overlay.html'));
  return win;
}

/**
 * The full-screen 3-2-1 countdown window for a given display.
 */
function createCountdownWindow(display) {
  const { bounds } = display;
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: baseWebPreferences
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(RENDERER, 'countdown', 'countdown.html'));
  return win;
}

module.exports = { createMainWindow, createOverlayWindow, createCountdownWindow };
