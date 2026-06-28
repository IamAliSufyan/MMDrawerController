'use strict';

const { app, BrowserWindow, nativeTheme } = require('electron');

const store = require('./store');
const { createMainWindow } = require('./windows');
const { createTray } = require('./tray');
const { OverlayManager } = require('./overlayManager');
const { TimerController } = require('./controller');
const { createSoundPlayer } = require('./sounds');
const { registerIpc } = require('./ipc');
const { unregisterShortcuts } = require('./shortcuts');

let mainWindow = null;
let trayWrapper = null;
let overlay = null;
let controller = null;

// Single-instance lock: focus the existing instance instead of launching twice.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(init);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  }
  mainWindow.show();
  mainWindow.focus();
}

function init() {
  // Menu bar only app: hide the Dock icon on macOS.
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  store.seedIfNeeded();

  mainWindow = createMainWindow();
  overlay = new OverlayManager();

  trayWrapper = createTray({
    onOpen: () => showMainWindow(),
    onQuit: () => quitApp()
  });

  const sounds = createSoundPlayer(() => overlay.primaryWebContents());

  controller = new TimerController({
    overlay,
    tray: trayWrapper,
    getSettings: () => store.getSettings(),
    sounds
  });

  registerIpc({ controller, overlay });

  // Keep the overlay/theme in sync if the OS appearance changes.
  nativeTheme.on('updated', () => {
    if (overlay.isActive()) overlay.applySettings(store.getSettings());
  });

  // On macOS, re-show the window when the app is activated (e.g. dock/spotlight).
  app.on('activate', () => showMainWindow());
}

function quitApp() {
  try {
    if (controller) controller.stop();
    unregisterShortcuts();
    if (trayWrapper) trayWrapper.destroy();
    // Allow the main window to actually close.
    BrowserWindow.getAllWindows().forEach((w) => { w._forceClose = true; });
  } catch (err) {
    console.error('[A-Time] Error during quit:', err);
  }
  app.quit();
}

// Do not quit when all windows are closed — the app lives in the menu bar.
app.on('window-all-closed', (e) => {
  // No-op on macOS; the tray keeps the app alive.
});

app.on('will-quit', () => {
  unregisterShortcuts();
});
