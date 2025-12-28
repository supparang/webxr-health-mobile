// === PATCH in /herohealth/vr/hha-cloud-logger.js ===
// Ensure event rows match Events sheet schema exactly.

function safeJson(v){
  try{
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  }catch(_){ return ''; }
}

function normalizeEvent(detail){
  const ctx = (detail && detail.ctx) || {};
  const data = (detail && detail.data) || {};
  const type = (detail && (detail.type || detail.eventType)) || data.eventType || 'event';

  // Build row EXACT columns (extra keys ok; Apps Script can map)
  const row = {
    // context columns
    timestampIso: ctx.timestampIso || data.timestampIso || new Date().toISOString(),
    projectTag: ctx.projectTag || data.projectTag || '',
    runMode: ctx.runMode || data.runMode || '',
    studyId: ctx.studyId || data.studyId || '',
    phase: ctx.phase || data.phase || '',
    conditionGroup: ctx.conditionGroup || data.conditionGroup || '',
    sessionId: data.sessionId || ctx.sessionId || '',

    // event columns
    eventType: String(type),
    gameMode: data.gameMode || ctx.gameMode || '',
    diff: data.diff || ctx.diff || '',
    timeFromStartMs: data.timeFromStartMs ?? '',

    targetId: data.targetId ?? '',
    emoji: data.emoji ?? '',
    itemType: data.itemType ?? data.kind ?? '',
    lane: data.lane ?? '',

    rtMs: data.rtMs ?? '',
    judgment: data.judgment ?? '',
    totalScore: data.totalScore ?? data.score ?? '',
    combo: data.combo ?? '',

    isGood: (data.isGood === 1 || data.isGood === true) ? 1 : (data.isGood === 0 || data.isGood === false ? 0 : ''),
    feverState: data.feverState ?? '',
    feverValue: data.feverValue ?? '',

    goalProgress: data.goalProgress ?? '',
    miniProgress: data.miniProgress ?? '',
    extra: safeJson(data.extra ?? data),

    // lightweight profile columns needed by Events sheet
    studentKey: ctx.studentKey || '',
    schoolCode: ctx.schoolCode || '',
    classRoom: ctx.classRoom || '',
    studentNo: ctx.studentNo || '',
    nickName: ctx.nickName || '',
  };

  return row;
}

function normalizeSession(detail){
  // detail should already be flat session row (best)
  // just ensure timestampIso exists
  const row = Object.assign({}, detail || {});
  if (!row.timestampIso) row.timestampIso = new Date().toISOString();
  return row;
}

window.addEventListener('hha:log_event', (e) => {
  const row = normalizeEvent(e.detail);
  // send row to Apps Script (existing send function)
  // sendToScript({ sheet: 'Events', row });
});

window.addEventListener('hha:log_session', (e) => {
  const row = normalizeSession(e.detail);
  // sendToScript({ sheet: 'Sessions', row });
});
