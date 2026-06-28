'use strict';

/**
 * The time-mismatch confirmation popup.
 * Shows the entered total, the summed section time, the signed difference, and
 * three resolution options. Resolves to one of:
 *   'useSections' | 'keepTotal' | 'goBack'
 */

const api = window.atime;

export function showMismatchModal({ enteredTotal, sectionTotal, difference }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const sign = difference > 0 ? '+' : '−';
    const diffAbs = Math.abs(difference);

    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2 class="modal-title">Section times don't match the total</h2>
        <p class="modal-sub">The sum of your sections is different from the total you entered.</p>

        <div class="modal-figures">
          <div class="figure">
            <span class="figure-label">Entered total</span>
            <span class="figure-value">${api.calc.formatClock(enteredTotal)}</span>
          </div>
          <div class="figure">
            <span class="figure-label">Added sections</span>
            <span class="figure-value">${api.calc.formatClock(sectionTotal)}</span>
          </div>
          <div class="figure figure-diff ${difference > 0 ? 'over' : 'under'}">
            <span class="figure-label">Difference</span>
            <span class="figure-value">${sign}${api.calc.formatClock(diffAbs)}</span>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary" data-choice="useSections">
            Use section time as total (${api.calc.formatClock(sectionTotal)})
          </button>
          <button class="btn" data-choice="keepTotal">
            Keep ${api.calc.formatClock(enteredTotal)} &amp; adjust sections proportionally
          </button>
          <button class="btn btn-ghost" data-choice="goBack">Go back and edit</button>
        </div>
      </div>
    `;

    function close(choice) {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(choice);
    }

    function onKey(e) {
      if (e.key === 'Escape') close('goBack');
    }

    backdrop.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-choice]');
      if (btn) close(btn.dataset.choice);
      else if (e.target === backdrop) close('goBack');
    });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(backdrop);
  });
}
