// /herohealth/goodjunk-intervention/assessments/assessment.js
// Shared helper for GoodJunk intervention assessments

(function () {
  'use strict';

  const WIN = window;
  const CFG = WIN.GJ_INT_CONFIG;

  if (!CFG) {
    console.warn('[GJ assessment] Missing GJ_INT_CONFIG');
    return;
  }

  if (WIN.GJ_INT_ASSESSMENT) return;

  function q(k, d = '') {
    return CFG.utils.q(k, d);
  }

  function withContext(base, sourceUrl) {
    return CFG.urls.withContext(base, sourceUrl || location.href);
  }

  function renderContextChips(targetId, chipList) {
    const el = document.getElementById(targetId);
    if (!el) return;

    const items = Array.isArray(chipList) && chipList.length
      ? chipList
      : [
          `study:${q('studyId', '-')}`,
          `phase:${q('phase', '-')}`,
          `student:${q('studentKey', '-')}`,
          `nick:${q('nickName', '-')}`
        ];

    el.innerHTML = items.map(t => `<span class="chip">${t}</span>`).join('');
  }

  function collectRadioAnswers(formId, names) {
    const form = document.getElementById(formId);
    const fd = new FormData(form);
    const out = {};
    (names || []).forEach((name) => {
      out[name] = fd.get(name) || '';
    });
    return out;
  }

  function collectTextareaValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function updateAnsweredStatus(statusId, answers, keys) {
    const el = document.getElementById(statusId);
    if (!el) return;

    const ks = keys || Object.keys(answers || {});
    const answered = ks.filter(k => !!answers[k]).length;
    el.textContent = `ตอบแล้ว ${answered}/${ks.length} ข้อ`;
  }

  function wireRadioStatus(formSelector, onChange) {
    document.querySelectorAll(`${formSelector} input[type="radio"]`).forEach((el) => {
      el.addEventListener('change', onChange);
    });
  }

  function scoreKnowledge(answers) {
    const key = CFG.answerKeys.knowledge || {};
    let score = 0;
    Object.keys(key).forEach((k) => {
      if (answers[k] === key[k]) score += 1;
    });
    return score;
  }

  function scoreLikert(answers, keys) {
    return CFG.utils.sumLikert(answers, keys);
  }

  function buildCommonRow(instrument, extra = {}) {
    return {
      timestampIso: CFG.utils.nowIso(),
      instrument,
      projectTag: q('projectTag', ''),
      studyId: q('studyId', ''),
      phase: q('phase', ''),
      conditionGroup: q('conditionGroup', ''),
      sessionId: q('sessionId', ''),
      studentKey: q('studentKey', ''),
      nickName: q('nickName', ''),
      classRoom: q('classRoom', ''),
      gradeLevel: q('gradeLevel', ''),
      ...extra
    };
  }

  function saveRow(storageKey, row) {
    return CFG.utils.writeJson(storageKey, row);
  }

  function loadRow(storageKey, fallback = null) {
    return CFG.utils.readJson(storageKey, fallback);
  }

  function compareScoreText(preRow, postRow) {
    if (!preRow && !postRow) return 'ยังไม่มีข้อมูลก่อนหรือหลังในเครื่องนี้';
    if (!preRow && postRow) return `มีข้อมูลหลังเล่น ${postRow.score}/${postRow.total}`;
    if (preRow && !postRow) return `ก่อนเล่น ${preRow.score}/${preRow.total}`;
    const delta = (postRow.score || 0) - (preRow.score || 0);
    return `ก่อนเล่น ${preRow.score}/${preRow.total} • หลังเล่น ${postRow.score}/${postRow.total} • เปลี่ยนแปลง ${delta >= 0 ? '+' : ''}${delta}`;
  }

  function go(url) {
    location.href = url;
  }

  function backTo(path) {
    go(withContext(path));
  }

  WIN.GJ_INT_ASSESSMENT = {
    q,
    withContext,
    renderContextChips,
    collectRadioAnswers,
    collectTextareaValue,
    updateAnsweredStatus,
    wireRadioStatus,
    scoreKnowledge,
    scoreLikert,
    buildCommonRow,
    saveRow,
    loadRow,
    compareScoreText,
    go,
    backTo
  };
})();