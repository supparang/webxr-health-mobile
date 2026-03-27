const FALLBACK_HUB_URL = 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html';

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) n = min;
  return Math.max(min, Math.min(max, n));
}

function toInt(n, fallback = 0) {
  n = Number(n);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function safeArray(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function safeObject(v, fallback = {}) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : fallback;
}

function resolveHub(ctx = {}) {
  const raw = String(ctx.hub || '').trim();
  return raw || FALLBACK_HUB_URL;
}

function resolveResearchForm(ctx = {}) {
  const f = String(ctx.researchForm || ctx.form || '').trim().toUpperCase();
  if (f === 'A' || f === 'B' || f === 'C') return f;
  return 'B';
}

function resolveResearchPhase(ctx = {}) {
  const raw = String(ctx.researchPhase || ctx.testPhase || '').trim().toLowerCase();
  if (raw === 'pre' || raw === 'pretest') return 'pre';
  if (raw === 'delayed' || raw === 'followup' || raw === 'retention') return 'delayed';
  if (raw === 'post' || raw === 'posttest') return 'post';

  const form = resolveResearchForm(ctx);
  if (form === 'A') return 'pre';
  if (form === 'C') return 'delayed';
  return 'post';
}

function buildGateUrl(ctx = {}, phase = 'cooldown') {
  const base = new URL('../warmup-gate.html', window.location.href);

  base.searchParams.set('game', 'hydration');
  base.searchParams.set('zone', 'nutrition');
  base.searchParams.set('hub', resolveHub(ctx));

  base.searchParams.set('phase', String(phase));
  base.searchParams.set('gatePhase', String(phase));

  if (ctx.pid) base.searchParams.set('pid', String(ctx.pid));
  if (ctx.sessionId) base.searchParams.set('sessionId', String(ctx.sessionId));
  if (ctx.studyId) base.searchParams.set('studyId', String(ctx.studyId));
  if (ctx.runMode) base.searchParams.set('runMode', String(ctx.runMode));
  if (ctx.conditionGroup) base.searchParams.set('conditionGroup', String(ctx.conditionGroup));
  if (ctx.studentKey) base.searchParams.set('studentKey', String(ctx.studentKey));
  if (ctx.schoolCode) base.searchParams.set('schoolCode', String(ctx.schoolCode));
  if (ctx.classRoom) base.searchParams.set('classRoom', String(ctx.classRoom));
  if (ctx.studentNo) base.searchParams.set('studentNo', String(ctx.studentNo));
  if (ctx.nickName) base.searchParams.set('nickName', String(ctx.nickName));

  base.searchParams.set('researchForm', resolveResearchForm(ctx));
  base.searchParams.set('researchPhase', resolveResearchPhase(ctx));

  return base.toString();
}

function buildHubUrl(ctx = {}, extra = {}) {
  const hub = new URL(resolveHub(ctx), window.location.href);

  const merged = {
    game: 'hydration',
    zone: 'nutrition',
    pid: ctx.pid || '',
    sessionId: ctx.sessionId || '',
    studyId: ctx.studyId || '',
    runMode: ctx.runMode || '',
    conditionGroup: ctx.conditionGroup || '',
    studentKey: ctx.studentKey || '',
    schoolCode: ctx.schoolCode || '',
    classRoom: ctx.classRoom || '',
    studentNo: ctx.studentNo || '',
    nickName: ctx.nickName || '',
    researchForm: resolveResearchForm(ctx),
    researchPhase: resolveResearchPhase(ctx),
    ...extra
  };

  Object.entries(merged).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    hub.searchParams.set(k, String(v));
  });

  return hub.toString();
}

export function buildHydrationV2Summary(raw = {}, ctx = {}) {
  const totalRounds = Math.max(0, toInt(raw.totalRounds, 0));
  const answerCorrect = clamp(toInt(raw.answerCorrect, 0), 0, totalRounds);
  const reasonCorrect = clamp(toInt(raw.reasonCorrect, 0), 0, totalRounds);
  const highConfidenceCount = clamp(toInt(raw.highConfidenceCount, 0), 0, totalRounds);
  const score = Math.max(0, toInt(raw.score, 0));
  const durationMs = Math.max(0, toInt(raw.durationMs, 0));

  const answerAccuracy = totalRounds > 0 ? Math.round((answerCorrect / totalRounds) * 100) : 0;
  const reasonAccuracy = totalRounds > 0 ? Math.round((reasonCorrect / totalRounds) * 100) : 0;

  let stars = 1;
  if (score >= 80 || (answerAccuracy >= 80 && reasonAccuracy >= 75)) stars = 3;
  else if (score >= 45 || (answerAccuracy >= 60 && reasonAccuracy >= 50)) stars = 2;

  let lead = 'เก่งมาก หนูได้ฝึกคิดเรื่องการดื่มน้ำแล้ว';
  if (stars === 3) lead = 'ยอดเยี่ยมมาก ทั้งตอบถูกและให้เหตุผลได้ดี';
  else if (stars === 2) lead = 'ทำได้ดีมาก ใกล้เป็นผู้เชี่ยวชาญเรื่องการดื่มน้ำแล้ว';

  let tip = 'ลองคิดเพิ่มว่าเมื่ออากาศร้อนหรือออกแรงมาก ควรปรับแผนดื่มน้ำอย่างไร';
  if (answerAccuracy >= 80 && reasonAccuracy >= 80) {
    tip = 'หนูเข้าใจทั้งคำตอบและเหตุผลได้ดี ลองรักษานิสัยนี้ต่อไป';
  } else if (answerAccuracy >= 60) {
    tip = 'หนูเริ่มจับหลักได้แล้ว ลองฝึกเชื่อม “เหตุผล” กับสถานการณ์ให้มากขึ้น';
  }

  return {
    gameId: 'hydration-v2',
    zone: 'nutrition',
    savedAt: new Date().toISOString(),

    pid: String(ctx.pid || ''),
    sessionId: String(ctx.sessionId || ''),
    studyId: String(ctx.studyId || ''),
    runMode: String(ctx.runMode || 'play'),
    phase: String(ctx.phase || ''),
    conditionGroup: String(ctx.conditionGroup || ''),
    studentKey: String(ctx.studentKey || ''),
    schoolCode: String(ctx.schoolCode || ''),
    classRoom: String(ctx.classRoom || ''),
    studentNo: String(ctx.studentNo || ''),
    nickName: String(ctx.nickName || ''),

    researchForm: resolveResearchForm(ctx),
    researchPhase: resolveResearchPhase(ctx),
    hub: resolveHub(ctx),

    score,
    totalRounds,
    answerCorrect,
    reasonCorrect,
    highConfidenceCount,
    answerAccuracy,
    reasonAccuracy,
    durationMs,

    stars,
    lead,
    tip,

    meta: safeObject(raw.meta, {})
  };
}

export function saveHydrationV2Summary(summary) {
  const payload = safeObject(summary, {});
  try {
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    localStorage.setItem('HHA_HYDRATION_V2_LAST', JSON.stringify(payload));

    const historyRaw = localStorage.getItem('HHA_SUMMARY_HISTORY') || '[]';
    const history = safeArray(JSON.parse(historyRaw), []);
    history.unshift(payload);
    if (history.length > 50) history.length = 50;
    localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(history));
  } catch (err) {
    console.warn('[HydrationV2Summary] save failed', err);
  }
  return payload;
}

export function goHydrationV2Cooldown(ctx = {}) {
  const url = buildGateUrl(ctx, 'cooldown');
  window.location.href = url;
}

export function goHydrationV2Hub(ctx = {}, extra = {}) {
  const url = buildHubUrl(ctx, extra);
  window.location.href = url;
}