// === /herohealth/goodjunk-intervention/assessments/assessment.js ===
// SHARED FORM SAVE + FLOW ROUTER
// PATCH v20260319a-GJI-ASSESSMENT-FINAL

import { buildUrl, pickCtxFromQuery, withDefaultCtx } from '../research/config.js';
import {
  loadCtx,
  mergeCtx,
  saveCtx,
  saveAssessment,
  loadAssessment,
  pageStorageKey
} from '../research/localstore.js';

const NEXT_MAP = {
  'pre-knowledge.html': 'PRE_BEHAVIOR',
  'pre-behavior.html': 'GAME',
  'post-knowledge.html': 'POST_BEHAVIOR',
  'post-behavior.html': 'POST_CHOICE',
  'post-choice.html': 'COMPLETION',
  'parent-questionnaire.html': 'PARENT_SUMMARY'
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
    .map((el) => el.name)
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

function restoreForm(form, saved = {}) {
  const payload =
    saved && typeof saved === 'object' && saved.answers && typeof saved.answers === 'object'
      ? saved.answers
      : (saved || {});

  const fields = form.querySelectorAll('input[name], textarea[name], select[name]');

  for (const field of fields) {
    const { name, type } = field;
    if (!(name in payload)) continue;

    const value = payload[name];

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

function renderCtx(ctx) {
  const el = document.getElementById('ctxBox');
  if (!el) return;

  el.textContent = [
    `PID: ${ctx.pid || '-'}`,
    `Student: ${ctx.nickName || ctx.studentKey || ctx.name || '-'}`,
    `Study: ${ctx.studyId || '-'}`,
    `Session: ${ctx.session || ctx.sessionId || '-'}`,
    `Condition: ${ctx.condition || ctx.conditionGroup || '-'}`
  ].join(' • ');
}

function getCorrectValuesForGroup(form, name) {
  const all = [...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
  return all.filter((el) => {
    const mark = String(el.dataset.correct || '').toLowerCase();
    return mark === '1' || mark === 'true' || mark === 'yes';
  });
}

function evaluateKnowledgeScore(form, answers) {
  const names = [...new Set(
    [...form.querySelectorAll('input[name], select[name], textarea[name]')]
      .map((el) => el.name)
      .filter(Boolean)
  )];

  let total = 0;
  let correct = 0;

  for (const name of names) {
    const correctEls = getCorrectValuesForGroup(form, name);
    if (!correctEls.length) continue;

    total += 1;

    const correctValues = correctEls.map((el) => String(el.value));
    const answer = answers[name];

    if (Array.isArray(answer)) {
      const picked = answer.map(String).sort().join('||');
      const expected = [...correctValues].sort().join('||');
      if (picked === expected) correct += 1;
      continue;
    }

    if (correctValues.includes(String(answer))) {
      correct += 1;
    }
  }

  if (!total) return null;

  return {
    correct,
    total,
    percent: Math.round((correct / total) * 100)
  };
}

function savePage(ctx, filename, form) {
  const answers = serializeForm(form);
  const knowledgeScore = evaluateKnowledgeScore(form, answers);

  const payload = {
    page: filename,
    savedAt: new Date().toISOString(),
    storageKey: pageStorageKey(filename),
    ctxSnapshot: {
      pid: ctx.pid || '',
      studentKey: ctx.studentKey || '',
      nickName: ctx.nickName || '',
      studyId: ctx.studyId || '',
      session: ctx.session || ctx.sessionId || '',
      condition: ctx.condition || ctx.conditionGroup || '',
      classRoom: ctx.classRoom || ctx.classroom || '',
      schoolName: ctx.schoolName || ctx.school || '',
      diff: ctx.diff || '',
      view: ctx.view || '',
      run: ctx.run || ctx.mode || ''
    },
    answers
  };

  if (knowledgeScore) {
    payload.knowledgeScore = knowledgeScore;
  }

  saveAssessment(filename, payload);
  return payload;
}

function initBackButton() {
  const backBtn = document.querySelector('[data-action="back"]');
  if (!backBtn) return;

  backBtn.addEventListener('click', () => {
    window.history.back();
  });
}

function init() {
  mergeCtx(pickCtxFromQuery());

  const ctx = withDefaultCtx(loadCtx());
  saveCtx(ctx);
  renderCtx(ctx);

  const form = document.querySelector('form');
  const filename = getFilename();

  initBackButton();

  if (!form) return;

  const oldData = loadAssessment(filename, {});
  restoreForm(form, oldData);

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();

    if (!form.reportValidity()) return;

    const latestCtx = withDefaultCtx(loadCtx());
    const saved = savePage(latestCtx, filename, form);

    const nextKey = form.dataset.nextKey || NEXT_MAP[filename];
    if (!nextKey) return;

    const nextCtx = withDefaultCtx({
      ...latestCtx,
      lastCompletedPage: filename,
      lastSavedAt: saved.savedAt
    });

    saveCtx(nextCtx);
    window.location.href = buildUrl(nextKey, nextCtx, false);
  });
}

document.addEventListener('DOMContentLoaded', init);