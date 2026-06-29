'use strict';

const { app, BrowserWindow, nativeTheme, ipcMain, screen } = require('electron');

const store = require('./store');
const { createMainWindow, createPopoverWindow, createSplashWindow } = require('./windows');
const { createTray } = require('./tray');
const iconGen = require('../../scripts/iconGen');
const { OverlayManager } = require('./overlayManager');
const { TimerController } = require('./controller');
const { createSoundPlayer } = require('./sounds');
const { registerIpc } = require('./ipc');
const { unregisterShortcuts } = require('./shortcuts');

let mainWindow = null;
let popover = null;
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

/** Show the branded splash with the app logo for a brief moment on launch. */
function showSplash() {
  try {
    const splash = createSplashWindow();
    splash.once('ready-to-show', () => { if (!splash.isDestroyed()) splash.show(); });
    splash.webContents.once('did-finish-load', () => {
      if (splash.isDestroyed()) return;
      const dataUrl = 'data:image/png;base64,' + iconGen.appIconPNG(256).toString('base64');
      splash.webContents.send('splash:logo', dataUrl);
      splash.show();
    });
    setTimeout(() => { if (!splash.isDestroyed()) splash.close(); }, 1400);
  } catch (err) {
    console.error('[A-Timer] Splash failed:', err);
  }
}

/** Open the main window and navigate it to a view (list / form / settings). */
function openMainAt(view, timerId) {
  showMainWindow();
  const send = () => mainWindow.webContents.send('app:navigate', { view, timerId });
  if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', send);
  else send();
}

let lastPopoverHide = 0;

/** Toggle the menu-bar popover, anchored beneath the tray icon. */
function togglePopover(trayBounds) {
  if (!popover || popover.isDestroyed()) return;
  if (popover.isVisible()) { popover.hide(); return; }
  // If the popover just closed via blur (e.g. the tray click itself stole
  // focus), treat this click as a dismissal rather than reopening it.
  if (Date.now() - lastPopoverHide < 250) return;
  positionPopover(trayBounds);
  popover.show();
  popover.webContents.send('popover:show');
}

function positionPopover(trayBounds) {
  const b = popover.getBounds();
  const anchor = trayBounds || trayWrapper.getBounds();
  const display = screen.getDisplayMatching(anchor);
  const wa = display.workArea;
  let x = Math.round(anchor.x + anchor.width / 2 - b.width / 2);
  x = Math.max(wa.x + 4, Math.min(x, wa.x + wa.width - b.width - 4));
  const y = Math.round(anchor.y + anchor.height + 2);
  popover.setPosition(x, y, false);
}

function init() {
  // Menu bar only app: hide the Dock icon on macOS.
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  store.seedIfNeeded();

  showSplash();

  mainWindow = createMainWindow();
  overlay = new OverlayManager();

  popover = createPopoverWindow();
  // Behave like a native menu-bar dropdown: close when it loses focus.
  popover.on('blur', () => {
    if (!popover.webContents.isDevToolsOpened()) {
      popover.hide();
      lastPopoverHide = Date.now();
    }
  });

  trayWrapper = createTray({
    onToggle: (bounds) => togglePopover(bounds),
    onOpen: () => showMainWindow(),
    onQuit: () => quitApp()
  });

  // Popover -> main-process navigation and sizing.
  ipcMain.on('popover:hide', () => { if (popover && !popover.isDestroyed()) popover.hide(); });
  ipcMain.on('popover:resize', (_e, height) => {
    if (!popover || popover.isDestroyed()) return;
    const b = popover.getBounds();
    const newHeight = Math.min(560, Math.max(120, Math.round(height)));
    popover.setBounds({ x: b.x, y: b.y, width: b.width, height: newHeight });
  });
  ipcMain.on('app:open-main', (_e, opts) => {
    if (popover && !popover.isDestroyed()) popover.hide();
    openMainAt((opts && opts.view) || 'list', opts && opts.timerId);
  });
  ipcMain.on('app:quit', () => quitApp());

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
