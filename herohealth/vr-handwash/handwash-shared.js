(function(){
  'use strict';

  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const HANDWASH_LAST_KEY = 'HHA_HANDWASH_LAST';
  const HANDWASH_HISTORY_KEY = 'HHA_HANDWASH_HISTORY';
  const HANDWASH_FLOW_KEY = 'HHA_HANDWASH_FLOW';
  const MAX_HISTORY_ITEMS = 30;

  function safeJsonParse(text, fallback){
    try{
      return JSON.parse(text);
    }catch{
      return fallback;
    }
  }

  function safeGetItem(key, fallback = null){
    try{
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    }catch{
      return fallback;
    }
  }

  function safeSetItem(key, value){
    try{
      localStorage.setItem(key, value);
      return true;
    }catch{
      return false;
    }
  }

  function safeRemoveItem(key){
    try{
      localStorage.removeItem(key);
      return true;
    }catch{
      return false;
    }
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function qs(name, fallback = ''){
    try{
      return new URL(location.href).searchParams.get(name) ?? fallback;
    }catch{
      return fallback;
    }
  }

  function clamp(value, min, max){
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function toInt(value, fallback = 0){
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeString(value, fallback = ''){
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function buildBaseCtx(extra = {}){
    return {
      pid: normalizeString(qs('pid', 'anon'), 'anon'),
      name: normalizeString(qs('name', 'Hero'), 'Hero'),
      diff: normalizeString(qs('diff', 'normal'), 'normal'),
      view: normalizeString(qs('view', 'mobile'), 'mobile'),
      run: normalizeString(qs('run', 'play'), 'play'),
      zone: normalizeString(qs('zone', 'hygiene'), 'hygiene'),
      cat: normalizeString(qs('cat', 'hygiene'), 'hygiene'),
      game: normalizeString(qs('game', 'handwash'), 'handwash'),
      gameId: normalizeString(qs('gameId', 'handwash'), 'handwash'),
      theme: normalizeString(qs('theme', 'handwash'), 'handwash'),
      hub: normalizeString(qs('hub', ''), ''),
      time: clamp(toInt(qs('time', '0'), 0), 0, 99999),
      ...extra
    };
  }

  function makeSummary(payload = {}){
    const base = buildBaseCtx({
      stage: normalizeString(payload.stage, 'unknown')
    });

    return {
      ...base,
      success: !!payload.success,
      score: clamp(toInt(payload.score, 0), 0, 9999999),
      stars: clamp(toInt(payload.stars, 0), 0, 3),
      miss: clamp(toInt(payload.miss, 0), 0, 999999),
      timeLeft: clamp(toInt(payload.timeLeft, 0), 0, 999999),
      accuracy: clamp(Number(payload.accuracy ?? 0), 0, 100),
      progress: clamp(Number(payload.progress ?? 0), 0, 100),
      bestStreak: clamp(toInt(payload.bestStreak, 0), 0, 999999),
      whoDone: clamp(toInt(payload.whoDone, 0), 0, 7),
      notes: normalizeString(payload.notes, ''),
      finishedAt: normalizeString(payload.finishedAt, nowIso())
    };
  }

  function getLastSummary(){
    const raw = safeGetItem(HANDWASH_LAST_KEY, null);
    return raw ? safeJsonParse(raw, null) : null;
  }

  function getHistory(){
    const raw = safeGetItem(HANDWASH_HISTORY_KEY, '[]');
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function getFlowState(){
    const raw = safeGetItem(HANDWASH_FLOW_KEY, null);
    return raw ? safeJsonParse(raw, null) : null;
  }

  function saveLastSummary(summary){
    safeSetItem(LAST_SUMMARY_KEY, JSON.stringify(summary));
    safeSetItem(HANDWASH_LAST_KEY, JSON.stringify(summary));
    return summary;
  }

  function pushHistory(summary, maxItems = MAX_HISTORY_ITEMS){
    const list = getHistory();
    list.unshift(summary);
    safeSetItem(HANDWASH_HISTORY_KEY, JSON.stringify(list.slice(0, maxItems)));
    return summary;
  }

  function saveFlowState(flowState = {}){
    const base = buildBaseCtx();
    const payload = {
      ...base,
      currentStage: normalizeString(flowState.currentStage, ''),
      nextStage: normalizeString(flowState.nextStage, ''),
      success: !!flowState.success,
      updatedAt: normalizeString(flowState.updatedAt, nowIso())
    };
    safeSetItem(HANDWASH_FLOW_KEY, JSON.stringify(payload));
    return payload;
  }

  function recordSummary(payload = {}){
    const summary = makeSummary(payload);
    saveLastSummary(summary);
    pushHistory(summary);
    saveFlowState({
      currentStage: summary.stage,
      nextStage: normalizeString(payload.nextStage, ''),
      success: summary.success,
      updatedAt: summary.finishedAt
    });
    return summary;
  }

  function clearAll(){
    safeRemoveItem(LAST_SUMMARY_KEY);
    safeRemoveItem(HANDWASH_LAST_KEY);
    safeRemoveItem(HANDWASH_HISTORY_KEY);
    safeRemoveItem(HANDWASH_FLOW_KEY);
    return true;
  }

  window.HandwashShared = {
    KEYS: {
      LAST_SUMMARY_KEY,
      HANDWASH_LAST_KEY,
      HANDWASH_HISTORY_KEY,
      HANDWASH_FLOW_KEY
    },
    qs,
    clamp,
    toInt,
    nowIso,
    buildBaseCtx,
    makeSummary,
    getLastSummary,
    getHistory,
    getFlowState,
    saveLastSummary,
    pushHistory,
    saveFlowState,
    recordSummary,
    clearAll
  };
})();