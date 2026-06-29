'use strict';

/**
 * Generates all icon assets from the procedurally-drawn PaceBar icon:
 *   - build/icon.png            (1024px app icon source)
 *   - build/tray/trayIcon.png   (22px) and trayIcon@2x.png (44px) menu bar icons
 *   - build/icon.iconset/*      (all sizes) -> build/icon.icns via `iconutil`
 *
 * Runs with only Node built-ins (see scripts/iconGen.js for the PNG encoder).
 * The .icns step requires macOS `iconutil`; on other platforms the PNGs are
 * still written and a notice is printed.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const iconGen = require('./iconGen');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const TRAY = path.join(BUILD, 'tray');
const ICONSET = path.join(BUILD, 'icon.iconset');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writePNG(file, png) {
  fs.writeFileSync(file, png);
  console.log('  wrote', path.relative(ROOT, file));
}

function main() {
  ensureDir(BUILD);
  ensureDir(TRAY);
  ensureDir(ICONSET);

  console.log('Generating app icon...');
  writePNG(path.join(BUILD, 'icon.png'), iconGen.appIconPNG(1024));

  console.log('Generating tray icons...');
  writePNG(path.join(TRAY, 'trayIcon.png'), iconGen.trayIconPNG(22));
  writePNG(path.join(TRAY, 'trayIcon@2x.png'), iconGen.trayIconPNG(44));

  console.log('Generating iconset...');
  // (name, pixel size) pairs required by macOS .iconset folders.
  const variants = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ];
  for (const [name, size] of variants) {
    writePNG(path.join(ICONSET, name), iconGen.appIconPNG(size));
  }

  // Convert to .icns on macOS.
  if (process.platform === 'darwin') {
    try {
      execFileSync('iconutil', ['-c', 'icns', ICONSET, '-o', path.join(BUILD, 'icon.icns')]);
      console.log('Created build/icon.icns');
    } catch (err) {
      console.error('iconutil failed — is Xcode command line tools installed?', err.message);
      process.exitCode = 1;
    }
  } else {
    console.log('\nNote: build/icon.icns was NOT created (requires macOS `iconutil`).');
    console.log('PNG assets are ready; run `npm run icons` on macOS before building the DMG.');
  }
}

main();
