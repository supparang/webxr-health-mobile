// === /herohealth/vr-hydration-v2/js/hydration.research.js ===
// Hydration V2 Research / Program Progress
// PATCH v20260318a-HYDRATION-V2-RESEARCH-NEXT-FIX

export function initResearchContext(ctx = {}) {
  const qs = new URLSearchParams(window.location.search);
  const storageKey = buildProgressKey(ctx);
  const stored = readJson(storageKey, {});

  const sessionFromQuery = positiveInt(qs.get('session'));
  const weekFromQuery = positiveInt(qs.get('week'));

  const sessionNo =
    sessionFromQuery ||
    positiveInt(stored.nextSessionNo) ||
    1;

  const weekNo =
    weekFromQuery ||
    positiveInt(stored.nextWeekNo) ||
    deriveWeekNo(sessionNo);

  return {
    storageKey,
    startedAt: new Date().toISOString(),
    sessionNo,
    weekNo,
    isResearchTrack: ctx.run === 'research' || ctx.mode === 'program'
  };
}

export function describeResearchBadge(researchCtx = {}, ctx = {}) {
  const prefix = researchCtx.isResearchTrack ? 'Research' : 'Starter';
  return `${prefix} • W${researchCtx.weekNo} • S${researchCtx.sessionNo}`;
}

export function buildResearchProgressText(researchCtx = {}, nextProgress = {}) {
  const currentSessionNo = positiveInt(researchCtx.sessionNo) || 1;
  const currentWeekNo = positiveInt(researchCtx.weekNo) || deriveWeekNo(currentSessionNo);

  const nextSessionNo = positiveInt(nextProgress.nextSessionNo) || (currentSessionNo + 1);
  const nextWeekNo = positiveInt(nextProgress.nextWeekNo) || deriveWeekNo(nextSessionNo);

  return `บันทึก W${currentWeekNo} S${currentSessionNo} แล้ว • ครั้งถัดไป W${nextWeekNo} S${nextSessionNo}`;
}

export function buildResearchPayload({
  ctx = {},
  state = {},
  researchCtx = {},
  socialSummary = ''
} = {}) {
  return {
    payloadVersion: '20260318a',
    savedAt: new Date().toISOString(),

    gameId: ctx.gameId || 'hydration',
    mode: ctx.mode || 'quick',
    type: ctx.type || 'solo',
    run: ctx.run || 'play',
    diff: ctx.diff || 'normal',

    pid: ctx.pid || 'anon',
    studyId: ctx.studyId || '',
    seed: ctx.seed || Date.now(),

    sessionNo: researchCtx.sessionNo || 1,
    weekNo: researchCtx.weekNo || 1,
    startedAt: researchCtx.startedAt || '',
    isResearchTrack: !!researchCtx.isResearchTrack,

    actionScore: state.actionScore || 0,
    knowledgeScore: state.knowledgeScore || 0,
    planningScore: state.planningScore || 0,
    socialScore: state.socialScore || 0,
    totalScore: state.totalScore || 0,

    goodCatch: state.goodCatch || 0,
    badCatch: state.badCatch || 0,
    missedGood: state.missedGood || 0,
    bestCombo: state.bestCombo || 0,

    rewardCount: state.rewardCount || 0,
    rewardHistory: Array.isArray(state.rewardHistory) ? [...state.rewardHistory] : [],

    correctChoices: state.correctChoices || 0,
    wrongChoices: state.wrongChoices || 0,
    scenarioSummary: state.scenarioSummary || '',

    evaluateChoice: state.evaluateChoice || null,
    evaluateCorrect: !!state.evaluateCorrect,

    createdPlan: state.createdPlan || {},
    createdPlanScore: state.createdPlanScore || 0,

    classTankContribution: state.classTankContribution || 0,
    teamMissionDone: !!state.teamMissionDone,
    socialSummary: socialSummary || ''
  };
}

export function persistResearchPayload(payload = {}, researchCtx = {}) {
  try {
    localStorage.setItem('HHA_HYDRATION_V2_RESEARCH_LAST', JSON.stringify(payload));

    const history = readJson('HHA_HYDRATION_V2_RESEARCH_HISTORY', []);
    history.unshift(payload);
    if (history.length > 30) history.length = 30;
    localStorage.setItem('HHA_HYDRATION_V2_RESEARCH_HISTORY', JSON.stringify(history));

    return payload;
  } catch (err) {
    console.warn('[HydrationV2] persistResearchPayload failed', err);
    return payload;
  }
}

export function markResearchSessionComplete(researchCtx = {}) {
  const currentSession = positiveInt(researchCtx.sessionNo) || 1;
  const nextSessionNo = currentSession + 1;
  const nextWeekNo = deriveWeekNo(nextSessionNo);

  try {
    localStorage.setItem(
      researchCtx.storageKey,
      JSON.stringify({
        nextSessionNo,
        nextWeekNo,
        updatedAt: new Date().toISOString()
      })
    );
  } catch (err) {
    console.warn('[HydrationV2] markResearchSessionComplete failed', err);
  }

  return { nextSessionNo, nextWeekNo };
}

function buildProgressKey(ctx = {}) {
  const pid = ctx.pid || 'anon';
  const studyId = ctx.studyId || 'nostudy';
  return `HHA_HYDRATION_V2_PROGRESS:${pid}:${studyId}`;
}

function deriveWeekNo(sessionNo) {
  return Math.max(1, Math.floor((Math.max(1, sessionNo) - 1) / 2) + 1);
}

function positiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}