'use strict';

const { MAX_TOTAL_SECONDS, MAX_SECTION_SECONDS, sumSections, clamp } = require('./timeCalc');

/**
 * Validation & normalization for timer objects.
 * Keeps the data model consistent and guards against edge cases before a
 * timer is saved or run.
 */

/**
 * Generate a reasonably unique id without external dependencies.
 */
function generateId() {
  return 'tmr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Normalize a single section: clamp duration, coerce types, trim name.
 */
function normalizeSection(section, index) {
  const duration = clamp(Math.round(Number(section && section.duration) || 0), 0, MAX_SECTION_SECONDS);
  return {
    id: section && section.id ? section.id : `sec_${index}_${Math.random().toString(36).slice(2, 7)}`,
    name: (section && typeof section.name === 'string') ? section.name.trim() : '',
    color: section && section.color ? section.color : '',
    duration
  };
}

/**
 * Validate a timer payload coming from the form.
 * @returns {{valid:boolean, errors:string[], timer?:object}}
 */
function validateTimer(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Invalid timer data.'] };
  }

  const name = (typeof payload.name === 'string' ? payload.name.trim() : '');
  if (!name) errors.push('Timer name is required.');

  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  if (sections.length === 0) errors.push('At least one section is required.');

  const normalizedSections = sections.map(normalizeSection);
  const total = sumSections(normalizedSections);

  if (total <= 0) errors.push('Total time must be greater than zero.');
  if (total > MAX_TOTAL_SECONDS) {
    errors.push('Total time cannot exceed 1 hour.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const timer = {
    id: payload.id || generateId(),
    name,
    sections: normalizedSections,
    total,
    createdAt: payload.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  return { valid: true, errors: [], timer };
}

module.exports = { generateId, normalizeSection, validateTimer };
