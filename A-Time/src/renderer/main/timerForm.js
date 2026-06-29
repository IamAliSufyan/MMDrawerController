'use strict';

/**
 * The single-page timer creation / edit form.
 * Handles section rows (add/remove/drag-reorder), the total-duration input, and
 * the save flow including equal-split and the mismatch reconciliation popup.
 */

import { createSectionRow } from './sectionRow.js';
import { showMismatchModal } from './mismatchModal.js';

const api = window.atime;

/**
 * @param {object|null} timer existing timer to edit, or null for a new one
 * @param {object} handlers { onCancel(), onSaved(), save(payload) }
 * @returns {{ el: HTMLElement }}
 */
export function createTimerForm(timer, handlers) {
  const isEdit = !!timer;
  const rowsById = new Map();

  const el = document.createElement('div');
  el.className = 'form-view';
  el.innerHTML = `
    <div class="form-header">
      <button type="button" class="btn btn-ghost" id="formBack">‹ Back</button>
      <h1 class="form-title">${isEdit ? 'Edit Timer' : 'New Timer'}</h1>
      <button type="button" class="btn btn-primary" id="formSave">${isEdit ? 'Save' : 'Create'}</button>
    </div>

    <div class="form-body">
      <label class="field">
        <span class="field-label">Timer name</span>
        <input type="text" id="timerName" class="field-input" placeholder="e.g. Conference Talk" />
      </label>

      <div class="field">
        <span class="field-label">Total time <em>(optional — up to 1 hour)</em></span>
        <div class="total-input">
          <input type="number" id="totalMin" class="field-input small" min="0" max="60" value="0" />
          <span class="unit">min</span>
          <input type="number" id="totalSec" class="field-input small" min="0" max="59" value="0" />
          <span class="unit">sec</span>
        </div>
        <p class="field-hint">Leave at 0 to use the sum of your sections. If sections are empty, the total is split equally.</p>
      </div>

      <div class="sections-block">
        <div class="sections-head">
          <span class="field-label">Sections</span>
          <div class="sections-summary" id="sectionsSummary"></div>
        </div>
        <div class="section-rows" id="sectionRows"></div>
        <div class="sections-buttons">
          <button type="button" class="btn" id="addSection">+ Add Section</button>
          <button type="button" class="btn btn-ghost" id="removeSection">− Remove Section</button>
        </div>
      </div>

      <div class="form-error" id="formError" hidden></div>
    </div>
  `;

  const nameEl = el.querySelector('#timerName');
  const totalMinEl = el.querySelector('#totalMin');
  const totalSecEl = el.querySelector('#totalSec');
  const rowsEl = el.querySelector('#sectionRows');
  const summaryEl = el.querySelector('#sectionsSummary');
  const errorEl = el.querySelector('#formError');

  // ---- Populate when editing ----
  if (isEdit) {
    nameEl.value = timer.name || '';
    (timer.sections || []).forEach((s, i) => addRow(s, i));
  } else {
    // Start with two empty sections for convenience.
    addRow({}, 0);
    addRow({}, 1);
  }
  updateSummary();

  // ---- Section row management ----
  function addRow(data, index) {
    const rowApi = createSectionRow(data, {
      index,
      onRemove: (r) => removeRow(r),
      onChange: updateSummary
    });
    rowsById.set(rowApi.id, rowApi);
    rowsEl.appendChild(rowApi.el);
    wireDrag(rowApi.el);
    reindex();
    updateSummary();
  }

  function removeRow(rowApi) {
    rowApi.el.remove();
    rowsById.delete(rowApi.id);
    reindex();
    updateSummary();
  }

  /** Re-apply palette colors / indexes in current DOM order. */
  function reindex() {
    [...rowsEl.children].forEach((child, i) => {
      const r = rowsById.get(child.dataset.id);
      if (r) r.setIndex(i);
    });
  }

  function orderedRows() {
    return [...rowsEl.children].map((child) => rowsById.get(child.dataset.id)).filter(Boolean);
  }

  function collectSections() {
    return orderedRows().map((r) => r.getData());
  }

  function enteredTotalSeconds() {
    const m = Math.max(0, Math.min(60, Number(totalMinEl.value) || 0));
    const s = Math.max(0, Math.min(59, Number(totalSecEl.value) || 0));
    return Math.min(api.calc.MAX_TOTAL_SECONDS, m * 60 + s);
  }

  function updateSummary() {
    const sections = collectSections();
    const sum = api.calc.sumSections(sections);
    const entered = enteredTotalSeconds();
    let text = `${sections.length} section${sections.length === 1 ? '' : 's'} · ${api.calc.formatClock(sum)}`;
    if (entered > 0 && sum > 0 && entered !== sum) {
      const diff = sum - entered;
      text += `  (entered ${api.calc.formatClock(entered)}, ${diff > 0 ? '+' : '−'}${api.calc.formatClock(Math.abs(diff))})`;
    }
    summaryEl.textContent = text;
  }

  totalMinEl.addEventListener('input', updateSummary);
  totalSecEl.addEventListener('input', updateSummary);

  // ---- Drag reorder (only from the left grip, so inputs stay usable) ----
  function wireDrag(rowEl) {
    const handle = rowEl.querySelector('.drag-handle');
    rowEl.draggable = false;
    if (handle) {
      // The row only becomes draggable while the grip is held.
      handle.addEventListener('mousedown', () => { rowEl.draggable = true; });
      handle.addEventListener('mouseup', () => { rowEl.draggable = false; });
    }
    rowEl.addEventListener('dragstart', () => rowEl.classList.add('dragging'));
    rowEl.addEventListener('dragend', () => {
      rowEl.classList.remove('dragging');
      rowEl.draggable = false;
      reindex();
      updateSummary();
    });
  }

  rowsEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = rowsEl.querySelector('.dragging');
    if (!dragging) return;
    const after = getDragAfterElement(rowsEl, e.clientY);
    if (after == null) rowsEl.appendChild(dragging);
    else rowsEl.insertBefore(dragging, after);
  });

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll('.section-row:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  // ---- Buttons ----
  el.querySelector('#addSection').addEventListener('click', () => {
    addRow({}, rowsEl.children.length);
  });
  el.querySelector('#removeSection').addEventListener('click', () => {
    const last = rowsEl.lastElementChild;
    if (last) {
      const r = rowsById.get(last.dataset.id);
      if (r) removeRow(r);
    }
  });
  el.querySelector('#formBack').addEventListener('click', () => handlers.onCancel());

  el.querySelector('#formSave').addEventListener('click', onSave);

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }
  function clearError() { errorEl.hidden = true; }

  // ---- Save flow with reconciliation ----
  async function onSave() {
    clearError();
    const name = nameEl.value.trim();
    let sections = collectSections();
    const entered = enteredTotalSeconds();

    if (!name) return showError('Please enter a timer name.');
    if (sections.length === 0) return showError('Add at least one section.');

    const sectionSum = api.calc.sumSections(sections);

    // Rule: total given but sections empty/zero → split equally.
    if (sectionSum <= 0 && entered > 0) {
      const divided = api.calc.divideEqually(sections, entered);
      applyDurations(divided);
      sections = divided;
    } else if (entered > 0 && sectionSum > 0 && entered !== sectionSum) {
      // Rule: mismatch → confirmation popup.
      const choice = await showMismatchModal({
        enteredTotal: entered,
        sectionTotal: sectionSum,
        difference: sectionSum - entered
      });
      if (choice === 'goBack') return; // abort, let the user edit
      if (choice === 'keepTotal') {
        const adjusted = api.calc.adjustProportionally(sections, entered);
        applyDurations(adjusted);
        sections = adjusted;
      }
      // 'useSections' → keep sections as entered
    } else if (sectionSum <= 0 && entered <= 0) {
      return showError('Set a total time or give your sections durations.');
    }

    const payload = {
      id: isEdit ? timer.id : undefined,
      name,
      createdAt: isEdit ? timer.createdAt : undefined,
      sections: sections.map((s) => ({
        name: s.name || '',
        color: s.color,
        duration: s.duration
      }))
    };

    const result = await handlers.save(payload);
    if (result && result.ok) {
      handlers.onSaved();
    } else {
      showError((result && result.errors && result.errors.join(' ')) || 'Could not save timer.');
    }
  }

  /** Push computed durations back into the visible rows. */
  function applyDurations(sections) {
    const rows = orderedRows();
    sections.forEach((s, i) => { if (rows[i]) rows[i].setDuration(s.duration); });
    updateSummary();
  }

  return { el };
}
