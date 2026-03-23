// === /goodjunk-intervention/assessments/assessment.js ===
// SHARED FORM SAVE + FLOW ROUTER + CROSS-PAGE FLOW BRIDGE
// PATCH v20260323a-GJI-ASSESSMENT-FLOW-BRIDGE

import { buildUrl, pickCtxFromQuery } from '../research/config.js';
import {
  loadCtx,
  mergeCtx,
  saveAssessment,
  loadAssessment,
  pageStorageKey
} from '../research/localstore.js';
import {
  initFlowBridge,
  appendFlowParams
} from '../research/flow-bridge.js';

const NEXT_MAP = {
  'pre-knowledge.html': 'PRE_BEHAVIOR',
  'pre-behavior.html': 'GAME',
  'post-knowledge.html': 'POST_BEHAVIOR',
  'post-behavior.html': 'POST_CHOICE',
  'post-choice.html': 'COMPLETION'
};

function getFilename() {
  return window.location.pathname.split('/').pop() || '';
}

function getPageId(filename) {
  return String(filename || 'assessment')
    .replace(/\.html$/i, '')
    .trim()
    .toLowerCase();
}

function getNextLabel(nextKey) {
  const map = {
    PRE_BEHAVIOR: 'Pre-Behavior',
    GAME: 'Game',
    POST_BEHAVIOR: 'Post-Behavior',
    POST_CHOICE: 'Post-Choice',
    COMPLETION: 'Completion'
  };
  return map[nextKey] || nextKey || 'Next';
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
    `PID: ${ctx.pid || ctx.studentKey || '-'}`,
    `Study: ${ctx.studyId || '-'}`,
    `Session: ${ctx.session || ctx.sessionId || '-'}`,
    `Condition: ${ctx.condition || ctx.conditionGroup || '-'}`
  ].join(' • ');
}

async function init() {
  const queryCtx = pickCtxFromQuery();
  mergeCtx(queryCtx);

  const form = document.querySelector('form');
  const filename = getFilename();
  const pageId = getPageId(filename);

  const flow = initFlowBridge({
    pageId,
    queryCtx,
    defaultStep: form ? 'filling' : 'reviewing',
    staticFields: {
      formPage: filename
    }
  });

  await flow.start();

  if (!form) {
    renderCtx();
    flow.setStep('reviewing', {
      reviewOnly: true
    });
    return;
  }

  const oldData = loadAssessment(filename, {});
  restoreForm(form, oldData);
  renderCtx();

  flow.setStep('filling', {
    formLoadedAt: new Date().toISOString()
  });

  form.addEventListener('input', () => {
    flow.persist({
      flowStep: 'filling',
      dirty: true,
      dirtyAt: new Date().toISOString()
    });
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();

    if (!form.reportValidity()) {
      flow.persist({
        flowStep: 'filling',
        validationFailedAt: new Date().toISOString()
      });
      return;
    }

    const answers = serializeForm(form);
    saveAssessment(filename, {
      page: filename,
      savedAt: new Date().toISOString(),
      storageKey: pageStorageKey(filename),
      answers
    });

    const ctx = loadCtx();
    const nextKey = form.dataset.nextKey || NEXT_MAP[filename];

    if (nextKey) {
      const rawNextUrl = buildUrl(nextKey, ctx, false);
      const nextUrl = appendFlowParams(rawNextUrl, {
        ...ctx,
        ...queryCtx
      });

      flow.noteRedirect('form-submit', nextUrl, {
        nextKey,
        nextLabel: getNextLabel(nextKey),
        nextPath: nextUrl,
        answerCount: Object.keys(answers || {}).length
      });

      flow.complete('form-submitted', {
        nextKey,
        nextLabel: getNextLabel(nextKey),
        nextPath: nextUrl,
        answerCount: Object.keys(answers || {}).length
      });

      window.location.href = nextUrl;
      return;
    }

    flow.complete('form-submitted-no-next', {
      answerCount: Object.keys(answers || {}).length
    });
  });

  const backBtn = document.querySelector('[data-action="back"]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      flow.noteRedirect('history-back', 'history.back()', {
        nextLabel: 'Back'
      });
      flow.complete('history-back', {
        nextLabel: 'Back',
        nextPath: 'history.back()'
      });
      window.history.back();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);