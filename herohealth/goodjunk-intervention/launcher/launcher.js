// === /goodjunk-intervention/launcher/launcher.js ===
// PATCH v20260318b-GJI-LAUNCHER-FLOW-ALIGNED

import { APP_CONFIG, buildUrl, pickCtxFromQuery, withDefaultCtx } from '../research/config.js';
import { loadCtx, saveCtx } from '../research/localstore.js';

function $(id) {
  return document.getElementById(id);
}

function qp(name, fallback = '') {
  try {
    return new URL(location.href).searchParams.get(name) ?? fallback;
  } catch {
    return fallback;
  }
}

function buildCtxFromLegacyQuery() {
  const studentKey = qp('studentKey', '');
  const nickName = qp('nickName', '');
  const schoolName = qp('schoolName', '');
  const classRoom = qp('classRoom', '');
  const sessionId = qp('sessionId', '');
  const conditionGroup = qp('conditionGroup', '');

  return {
    pid: qp('pid', studentKey || nickName || ''),
    studyId: qp('studyId', ''),
    group: qp('group', classRoom || qp('gradeLevel', '') || conditionGroup || ''),
    condition: qp('condition', conditionGroup || ''),
    session: qp('session', sessionId || ''),
    lang: qp('lang', 'th'),
    teacher: qp('teacher', ''),
    classroom: qp('classroom', classRoom || ''),
    school: qp('school', schoolName || ''),
    mode: qp('mode', qp('run', 'play')),

    nickName,
    phase: qp('phase', ''),
    diff: qp('diff', 'easy'),
    view: qp('view', 'mobile'),
    time: qp('time', '80'),
    run: qp('run', 'play'),
    hub: qp('hub', '../../hub.html'),

    studentKey,
    sessionId,
    conditionGroup,
    schoolName,
    classRoom,

    kid: qp('kid', ''),
    readable: qp('readable', ''),
    spawnDebug: qp('spawnDebug', ''),
    seed: qp('seed', ''),
    siteCode: qp('siteCode', ''),
    projectTag: qp('projectTag', ''),
    sessionOrder: qp('sessionOrder', ''),
    blockLabel: qp('blockLabel', ''),
    studentNo: qp('studentNo', ''),
    gradeLevel: qp('gradeLevel', ''),
    gender: qp('gender', ''),
    age: qp('age', ''),
    schoolCode: qp('schoolCode', '')
  };
}

function fillField(name, value) {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el) return;
  if (value === undefined || value === null) return;
  el.value = value;
}

function fillForm(form, data = {}) {
  const fields = form.querySelectorAll('input[name], select[name], textarea[name]');
  for (const field of fields) {
    const name = field.name;
    if (!(name in data)) continue;
    const value = data[name];
    if (value === undefined || value === null || value === '') continue;
    field.value = value;
  }
}

function readForm(form) {
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());

  // canonical sync
  if (!data.pid && data.studentKey) data.pid = data.studentKey;
  if (!data.group && data.classroom) data.group = data.classroom;
  if (!data.classroom && data.classRoom) data.classroom = data.classRoom;
  if (!data.school && data.schoolName) data.school = data.schoolName;
  if (!data.condition && data.conditionGroup) data.condition = data.conditionGroup;
  if (!data.session && data.sessionId) data.session = data.sessionId;
  if (!data.mode && data.run) data.mode = data.run;

  return data;
}

function renderPreview(ctx) {
  const el = $('ctxPreview');
  if (!el) return;

  const bits = [
    `PID: ${ctx.pid || '-'}`,
    `Study: ${ctx.studyId || '-'}`,
    `Group: ${ctx.group || ctx.classroom || '-'}`,
    `Condition: ${ctx.condition || '-'}`,
    `Session: ${ctx.session || '-'}`,
    `Diff: ${ctx.diff || '-'}`,
    `View: ${ctx.view || '-'}`
  ];

  el.textContent = bits.join(' • ');
}

function init() {
  const form = $('studentLauncherForm');
  if (!form) return;

  const fromQuery = pickCtxFromQuery();
  const fromLegacy = buildCtxFromLegacyQuery();
  const fromStorage = loadCtx();

  const initial = withDefaultCtx({
    mode: 'play',
    lang: 'th',
    diff: 'easy',
    view: 'mobile',
    time: '80',
    ...fromStorage,
    ...fromLegacy,
    ...fromQuery
  });

  if (!initial.studyId) initial.studyId = APP_CONFIG.defaultStudyId;
  if (!initial.condition) initial.condition = APP_CONFIG.defaultCondition;
  if (!initial.group) initial.group = APP_CONFIG.defaultGroup;
  if (!initial.session) initial.session = APP_CONFIG.defaultSession;
  if (!initial.lang) initial.lang = APP_CONFIG.defaultLang;

  // sync aliases for visible/hidden fields
  if (!initial.classroom && initial.classRoom) initial.classroom = initial.classRoom;
  if (!initial.school && initial.schoolName) initial.school = initial.schoolName;
  if (!initial.mode && initial.run) initial.mode = initial.run;
  if (!initial.run && initial.mode) initial.run = initial.mode;
  if (!initial.conditionGroup && initial.condition) initial.conditionGroup = initial.condition;
  if (!initial.sessionId && initial.session) initial.sessionId = initial.session;
  if (!initial.studentKey && initial.pid) initial.studentKey = initial.pid;

  fillForm(form, initial);
  renderPreview(initial);
  saveCtx(initial);

  form.addEventListener('input', () => {
    const live = readForm(form);
    renderPreview(live);
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();

    const data = readForm(form);
    const ctx = withDefaultCtx({
      ...data,
      group: data.group || data.classroom || data.classRoom || '',
      condition: data.condition || data.conditionGroup || '',
      session: data.session || data.sessionId || '',
      mode: data.mode || data.run || 'play',
      school: data.school || data.schoolName || '',
      classroom: data.classroom || data.classRoom || '',
      pid: data.pid || data.studentKey || data.nickName || ''
    });

    if (!ctx.pid || !String(ctx.pid).trim()) {
      alert('กรุณากรอก Participant ID ก่อนเริ่ม');
      $('pid')?.focus();
      return;
    }

    // sync aliases before save
    ctx.studentKey = ctx.studentKey || ctx.pid;
    ctx.sessionId = ctx.sessionId || ctx.session;
    ctx.conditionGroup = ctx.conditionGroup || ctx.condition;
    ctx.schoolName = ctx.schoolName || ctx.school;
    ctx.classRoom = ctx.classRoom || ctx.classroom;
    ctx.run = ctx.run || ctx.mode;

    saveCtx(ctx);
    window.location.href = buildUrl('PRE_KNOWLEDGE', ctx, false);
  });

  $('gotoTeacherBtn')?.addEventListener('click', () => {
    const data = readForm(form);
    const ctx = withDefaultCtx({
      ...data,
      group: data.group || data.classroom || data.classRoom || '',
      condition: data.condition || data.conditionGroup || '',
      session: data.session || data.sessionId || '',
      mode: data.mode || data.run || 'play',
      school: data.school || data.schoolName || '',
      classroom: data.classroom || data.classRoom || '',
      pid: data.pid || data.studentKey || data.nickName || ''
    });

    ctx.studentKey = ctx.studentKey || ctx.pid;
    ctx.sessionId = ctx.sessionId || ctx.session;
    ctx.conditionGroup = ctx.conditionGroup || ctx.condition;
    ctx.schoolName = ctx.schoolName || ctx.school;
    ctx.classRoom = ctx.classRoom || ctx.classroom;
    ctx.run = ctx.run || ctx.mode;

    saveCtx(ctx);
    window.location.href = buildUrl('./teacher-panel.html', ctx, false);
  });

  $('gotoGameBtn')?.addEventListener('click', () => {
    const data = readForm(form);
    const ctx = withDefaultCtx({
      ...data,
      group: data.group || data.classroom || data.classRoom || '',
      condition: data.condition || data.conditionGroup || '',
      session: data.session || data.sessionId || '',
      mode: data.mode || data.run || 'play',
      school: data.school || data.schoolName || '',
      classroom: data.classroom || data.classRoom || '',
      pid: data.pid || data.studentKey || data.nickName || ''
    });

    ctx.studentKey = ctx.studentKey || ctx.pid;
    ctx.sessionId = ctx.sessionId || ctx.session;
    ctx.conditionGroup = ctx.conditionGroup || ctx.condition;
    ctx.schoolName = ctx.schoolName || ctx.school;
    ctx.classRoom = ctx.classRoom || ctx.classroom;
    ctx.run = ctx.run || ctx.mode;

    saveCtx(ctx);
    window.location.href = buildUrl('../game/goodjunk-vr.html', ctx, false);
  });
}

document.addEventListener('DOMContentLoaded', init);