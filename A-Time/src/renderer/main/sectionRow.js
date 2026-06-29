'use strict';

/**
 * Builds one draggable section row for the timer form.
 * Each row supports: drag handle, optional name, optional color, a 0–15 min
 * slider, and an editable mm:ss field kept in sync with the slider.
 */

const api = window.atime;
const MAX = api.calc.MAX_SECTION_SECONDS; // 15 minutes in seconds

function clampDuration(sec) {
  return Math.max(0, Math.min(MAX, Math.round(sec)));
}

/**
 * @param {object} data { id?, name?, color?, duration? } duration in seconds
 * @param {object} handlers { onRemove(rowApi), onChange(), index }
 * @returns {object} rowApi { el, getData, setDuration, setIndex }
 */
export function createSectionRow(data, handlers) {
  let index = handlers.index || 0;
  const id = data.id || `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let color = data.color || api.palette.colorForIndex(index);
  let duration = clampDuration(Number(data.duration) || 0);

  const row = document.createElement('div');
  row.className = 'section-row';
  // Dragging is enabled only while the left grip is held (see timerForm wireDrag),
  // so the row's inputs remain fully usable.
  row.draggable = false;
  row.dataset.id = id;

  row.innerHTML = `
    <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
    <input type="color" class="sec-color" value="${color}" title="Section color" />
    <input type="text" class="sec-name" placeholder="Section name (optional)" />
    <div class="sec-slider-wrap">
      <input type="range" class="sec-slider" min="0" max="${MAX}" step="5" value="${duration}" />
    </div>
    <div class="sec-time">
      <input type="number" class="sec-min" min="0" max="15" value="${Math.floor(duration / 60)}" />
      <span class="sec-colon">:</span>
      <input type="number" class="sec-sec" min="0" max="59" value="${String(duration % 60).padStart(2, '0')}" />
    </div>
    <button type="button" class="sec-remove" title="Remove section">✕</button>
  `;

  const colorEl = row.querySelector('.sec-color');
  const nameEl = row.querySelector('.sec-name');
  const sliderEl = row.querySelector('.sec-slider');
  const minEl = row.querySelector('.sec-min');
  const secEl = row.querySelector('.sec-sec');
  const removeEl = row.querySelector('.sec-remove');

  nameEl.value = data.name || '';

  function syncFromDuration() {
    sliderEl.value = String(Math.min(MAX, duration));
    minEl.value = String(Math.floor(duration / 60));
    secEl.value = String(duration % 60).padStart(2, '0');
  }

  function emitChange() {
    handlers.onChange && handlers.onChange();
  }

  sliderEl.addEventListener('input', () => {
    duration = clampDuration(Number(sliderEl.value));
    minEl.value = String(Math.floor(duration / 60));
    secEl.value = String(duration % 60).padStart(2, '0');
    emitChange();
  });

  function readManual() {
    const m = Math.max(0, Number(minEl.value) || 0);
    const s = Math.max(0, Math.min(59, Number(secEl.value) || 0));
    duration = clampDuration(m * 60 + s);
    syncFromDuration();
    emitChange();
  }
  minEl.addEventListener('change', readManual);
  secEl.addEventListener('change', readManual);

  colorEl.addEventListener('input', () => { color = colorEl.value; emitChange(); });
  nameEl.addEventListener('input', emitChange);

  removeEl.addEventListener('click', () => handlers.onRemove && handlers.onRemove(rowApi));

  const rowApi = {
    el: row,
    id,
    getData() {
      return {
        id,
        name: nameEl.value.trim(),
        color,
        duration
      };
    },
    /** Update duration programmatically (e.g. after equal-split / proportional). */
    setDuration(sec) {
      duration = clampDuration(sec);
      syncFromDuration();
    },
    setIndex(i) {
      index = i;
      // If the user never picked a color, keep it aligned to palette order.
      if (!data.color && !colorEl.dataset.userPicked) {
        color = api.palette.colorForIndex(i);
        colorEl.value = color;
      }
    }
  };

  colorEl.addEventListener('input', () => { colorEl.dataset.userPicked = '1'; });

  return rowApi;
}
