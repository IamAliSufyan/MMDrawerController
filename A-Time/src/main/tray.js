'use strict';

const path = require('path');
const fs = require('fs');
const { Tray, Menu, nativeImage } = require('electron');
const iconGen = require('../../scripts/iconGen');

/**
 * The menu bar (Tray) icon.
 *  - Colorful timer/progress ring icon.
 *  - Shows remaining time beside the icon while a timer runs.
 *  - Click opens the main window without affecting a running timer.
 */
function buildTrayImage() {
  // Prefer the generated PNG files; fall back to a runtime-rendered icon so the
  // menu bar icon always appears, even before `npm run icons` has been run.
  const base = path.join(__dirname, '..', '..', 'build', 'tray', 'trayIcon.png');
  try {
    if (fs.existsSync(base)) {
      const img = nativeImage.createFromPath(base);
      if (!img.isEmpty()) return img;
    }
  } catch (_) { /* fall through to runtime generation */ }

  const img = nativeImage.createFromBuffer(iconGen.trayIconPNG(22));
  // Provide a @2x representation for retina menu bars.
  try {
    img.addRepresentation({
      scaleFactor: 2,
      buffer: iconGen.trayIconPNG(44)
    });
  } catch (_) { /* optional */ }
  return img;
}

function createTray({ onOpen, onQuit }) {
  const tray = new Tray(buildTrayImage());
  tray.setToolTip('A-Time');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open A-Time', click: () => onOpen && onOpen() },
    { type: 'separator' },
    { label: 'Quit A-Time', click: () => onQuit && onQuit() }
  ]);

  // Left-click opens the window; right-click shows the menu. Neither affects a
  // running timer.
  tray.on('click', () => onOpen && onOpen());
  tray.on('right-click', () => tray.popUpContextMenu(contextMenu));

  return {
    tray,
    /** Show remaining time (e.g. "12:34") beside the icon, or clear it. */
    setRemaining(text) {
      try {
        tray.setTitle(text ? ` ${text}` : '');
      } catch (err) {
        console.error('[A-Time] tray.setTitle failed:', err);
      }
    },
    destroy() {
      try { tray.destroy(); } catch (_) { /* ignore */ }
    }
  };
}

module.exports = { createTray };
