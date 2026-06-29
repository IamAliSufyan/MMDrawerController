'use strict';

/**
 * The Settings tab: overlay height, overlay opacity, and multi-monitor
 * behavior. Changes are persisted immediately and applied live to a visible
 * overlay.
 */

const api = window.atime;

export async function createSettingsView() {
  const el = document.createElement('div');
  el.className = 'settings-view';

  const settings = await api.settings.get();
  const displays = await api.displays.list();

  el.innerHTML = `
    <h1 class="view-title">Settings</h1>

    <div class="settings-group">
      <div class="setting-row">
        <label class="setting-label" for="setHeight">Overlay height</label>
        <input type="range" id="setHeight" min="28" max="80" step="1" value="${settings.overlayHeight}" />
        <span class="setting-value" id="heightVal">${settings.overlayHeight}px</span>
      </div>

      <div class="setting-row">
        <label class="setting-label" for="setOpacity">Overlay opacity</label>
        <input type="range" id="setOpacity" min="0.2" max="1" step="0.01" value="${settings.overlayOpacity}" />
        <span class="setting-value" id="opacityVal">${Math.round(settings.overlayOpacity * 100)}%</span>
      </div>

      <div class="setting-row">
        <label class="setting-label" for="setGap">Gap below menu bar</label>
        <input type="range" id="setGap" min="0" max="30" step="1" value="${settings.overlayGap}" />
        <span class="setting-value" id="gapVal">${settings.overlayGap}px</span>
      </div>
    </div>

    <div class="settings-group">
      <span class="settings-group-title">Overlay monitor</span>
      <label class="radio-row"><input type="radio" name="monitor" value="main" /> Main screen only</label>
      <label class="radio-row"><input type="radio" name="monitor" value="all" /> All screens</label>
      <label class="radio-row"><input type="radio" name="monitor" value="specific" /> Specific monitor
        <select id="displaySelect" class="field-input small"></select>
      </label>
    </div>

    <div class="settings-group">
      <span class="settings-group-title">General</span>
      <label class="switch-row">
        <span>Open PaceBar at login</span>
        <input type="checkbox" id="openAtLogin" />
      </label>
      <label class="switch-row">
        <span>Count up after time's up (overrun)<br><small>Keep the overlay showing how far over you are, in red.</small></span>
        <input type="checkbox" id="overrunMode" />
      </label>
    </div>
  `;

  const heightEl = el.querySelector('#setHeight');
  const opacityEl = el.querySelector('#setOpacity');
  const gapEl = el.querySelector('#setGap');
  const heightVal = el.querySelector('#heightVal');
  const opacityVal = el.querySelector('#opacityVal');
  const gapVal = el.querySelector('#gapVal');
  const displaySelect = el.querySelector('#displaySelect');
  const openAtLoginEl = el.querySelector('#openAtLogin');
  const overrunModeEl = el.querySelector('#overrunMode');

  openAtLoginEl.checked = !!settings.openAtLogin;
  overrunModeEl.checked = settings.overrunMode !== false;

  // Populate display dropdown.
  for (const d of displays) {
    const opt = document.createElement('option');
    opt.value = String(d.id);
    opt.textContent = `${d.label} (${d.width}×${d.height})${d.isPrimary ? ' — Primary' : ''}`;
    displaySelect.appendChild(opt);
  }
  if (settings.specificDisplayId != null) displaySelect.value = String(settings.specificDisplayId);

  // Set monitor radio.
  const radio = el.querySelector(`input[name="monitor"][value="${settings.monitorBehavior}"]`);
  if (radio) radio.checked = true;
  displaySelect.disabled = settings.monitorBehavior !== 'specific';

  // ---- Persistence (live) ----
  async function save(partial) {
    await api.settings.save(partial);
  }

  heightEl.addEventListener('input', () => {
    heightVal.textContent = `${heightEl.value}px`;
    save({ overlayHeight: Number(heightEl.value) });
  });
  opacityEl.addEventListener('input', () => {
    opacityVal.textContent = `${Math.round(Number(opacityEl.value) * 100)}%`;
    save({ overlayOpacity: Number(opacityEl.value) });
  });
  gapEl.addEventListener('input', () => {
    gapVal.textContent = `${gapEl.value}px`;
    save({ overlayGap: Number(gapEl.value) });
  });

  openAtLoginEl.addEventListener('change', () => {
    save({ openAtLogin: openAtLoginEl.checked });
  });
  overrunModeEl.addEventListener('change', () => {
    save({ overrunMode: overrunModeEl.checked });
  });

  el.querySelectorAll('input[name="monitor"]').forEach((r) => {
    r.addEventListener('change', () => {
      const behavior = r.value;
      displaySelect.disabled = behavior !== 'specific';
      const partial = { monitorBehavior: behavior };
      if (behavior === 'specific') partial.specificDisplayId = Number(displaySelect.value);
      save(partial);
    });
  });
  displaySelect.addEventListener('change', () => {
    save({ monitorBehavior: 'specific', specificDisplayId: Number(displaySelect.value) });
  });

  return { el };
}
