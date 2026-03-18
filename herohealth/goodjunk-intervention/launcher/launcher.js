// === /goodjunk-intervention/launcher/launcher.js ===
// PATCH v20260318a-GJI-LAUNCHER-JS

import { APP_CONFIG, buildUrl, pickCtxFromQuery, withDefaultCtx } from '../research/config.js';
import { loadCtx, saveCtx } from '../research/localstore.js';

function $(id) {
  return document.getElementById(id);
}

function fillForm(form, data = {}) {
  const fields = ['pid', 'studyId', 'group', 'condition', 'session', 'lang', 'teacher', 'classroom', 'school', 'mode'];
  for (const name of fields) {
    const el = form.elements[name];
    if (!el) continue;
    const value = data[name];
    if (value !== undefined && value !== null && value !== '') {
      el.value = value;
    }
  }
}

function readForm(form) {
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}

function renderPreview(ctx) {
  const el = $('ctxPreview');
  if (!el) return;
  const lines = [
    `PID: ${ctx.pid || '-'}`,
    `Study: ${ctx.studyId || '-'}`,
    `Group: ${ctx.group || '-'}`,
    `Condition: ${ctx.condition || '-'}`,
    `Session: ${ctx.session || '-'}`,
    `Lang: ${ctx.lang || '-'}`
  ];
  el.textContent = lines.join(' • ');
}

function init() {
  const form = $('studentLauncherForm');
  if (!form) return;

  const fromQuery = pickCtxFromQuery();
  const fromStorage = loadCtx();
  const initial = withDefaultCtx({
    mode: 'student',
    ...fromStorage,
    ...fromQuery
  });

  if (!initial.studyId) initial.studyId = APP_CONFIG.defaultStudyId;
  if (!initial.condition) initial.condition = APP_CONFIG.defaultCondition;
  if (!initial.group) initial.group = APP_CONFIG.defaultGroup;
  if (!initial.session) initial.session = APP_CONFIG.defaultSession;
  if (!initial.lang) initial.lang = APP_CONFIG.defaultLang;

  fillForm(form, initial);
  renderPreview(initial);

  form.addEventListener('input', () => {
    renderPreview(readForm(form));
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();

    const ctx = withDefaultCtx(readForm(form));
    if (!ctx.pid || !String(ctx.pid).trim()) {
      alert('กรุณากรอก Participant ID ก่อนเริ่ม');
      $('pid')?.focus();
      return;
    }

    saveCtx(ctx);
    window.location.href = buildUrl('PRE_KNOWLEDGE', ctx, false);
  });

  $('gotoTeacherBtn')?.addEventListener('click', () => {
    const ctx = withDefaultCtx(readForm(form));
    saveCtx(ctx);
    window.location.href = buildUrl('TEACHER_PANEL', ctx, false);
  });

  $('gotoParentBtn')?.addEventListener('click', () => {
    const ctx = withDefaultCtx(readForm(form));
    saveCtx(ctx);
    window.location.href = buildUrl('PARENT_FORM', ctx, false);
  });
}

document.addEventListener('DOMContentLoaded', init);