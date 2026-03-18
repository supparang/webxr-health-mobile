// === /goodjunk-intervention/assessments/assessment.js ===
// SHARED FORM SAVE + FLOW ROUTER
// PATCH v20260318a-GJI-ASSESSMENT-JS

import { buildUrl, pickCtxFromQuery } from '../research/config.js';
import { loadCtx, mergeCtx, saveAssessment, loadAssessment, pageStorageKey } from '../research/localstore.js';

const NEXT_MAP = {
  'pre-knowledge.html': 'PRE_BEHAVIOR',
  'pre-behavior.html': 'GAME',
  'post-knowledge.html': 'POST_BEHAVIOR',
  'post-behavior.html': 'POST_CHOICE',
  'post-choice.html': 'COMPLETION',
};

function getFilename() {
  return window.location.pathname.split('/').pop() || '';
}

function serializeForm(form) {
  const data = {};
  const fd = new FormData(form);

  for (const [key, value] of fd.entries()) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      if (!Array.isArray(data[key])) data[key] = [data[key]];
      data[key].push(value);
    } else {
      data[key] = value;
    }
  }

  const checkboxNames = [...form.querySelectorAll('input[type="checkbox"][name]')]
    .map(el => el.name)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  for (const name of checkboxNames) {
    if (!Object.prototype.hasOwnProperty.call(data, name)) {
      data[name] = [];
    } else if (!Array.isArray(data[name])) {
      data[name] = [data[name]];
    }
  }

  return data;
}

function restoreForm(form, data = {}) {
  const fields = form.querySelectorAll('input[name], textarea[name], select[name]');
  for (const field of fields) {
    const { name, type } = field;
    if (!(name in data)) continue;

    const value = data[name];

    if (type === 'radio') {
      field.checked = String(field.value) === String(value);
      continue;
    }

    if (type === 'checkbox') {
      const list = Array.isArray(value) ? value.map(String) : [String(value)];
      field.checked = list.includes(String(field.value));
      continue;
    }

    field.value = value ?? '';
  }
}

function renderCtx() {
  const ctx = loadCtx();
  const el = document.getElementById('ctxBox');
  if (!el) return;

  el.textContent = [
    `PID: ${ctx.pid || '-'}`,
    `Study: ${ctx.studyId || '-'}`,
    `Session: ${ctx.session || '-'}`,
    `Condition: ${ctx.condition || '-'}`,
  ].join(' • ');
}

function init() {
  mergeCtx(pickCtxFromQuery());

  const form = document.querySelector('form');
  const filename = getFilename();
  if (!form) {
    renderCtx();
    return;
  }

  const oldData = loadAssessment(filename, {});
  restoreForm(form, oldData);
  renderCtx();

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();

    if (!form.reportValidity()) return;

    const answers = serializeForm(form);
    saveAssessment(filename, {
      page: filename,
      savedAt: new Date().toISOString(),
      storageKey: pageStorageKey(filename),
      answers,
    });

    const ctx = loadCtx();
    const nextKey = form.dataset.nextKey || NEXT_MAP[filename];
    if (nextKey) {
      window.location.href = buildUrl(nextKey, ctx, false);
    }
  });

  const backBtn = document.querySelector('[data-action="back"]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.history.back();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);