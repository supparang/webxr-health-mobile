(function(){
  'use strict';

  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const HANDWASH_LAST_KEY = 'HHA_HANDWASH_LAST';
  const HANDWASH_HISTORY_KEY = 'HHA_HANDWASH_HISTORY';
  const HANDWASH_FLOW_KEY = 'HHA_HANDWASH_FLOW';

  function safeJsonParse(text, fallback){
    try{
      return JSON.parse(text);
    }catch{
      return fallback;
    }
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function qs(name, fallback=''){
    try{
      return new URL(location.href).searchParams.get(name) ?? fallback;
    }catch{
      return fallback;
    }
  }

  function clamp(n, min, max){
    return Math.max(min, Math.min(max, Number(n) || 0));
  }

  function buildBaseCtx(extra = {}){
    return {
      pid: qs('pid', 'anon'),
      name: qs('name', 'Hero'),
      diff: qs('diff', 'normal'),
      view: qs('view', 'mobile'),
      run: qs('run', 'play'),
      zone: qs('zone', 'hygiene'),
      cat: qs('cat', 'hygiene'),
      game: qs('game', 'handwash'),
      gameId: qs('gameId', 'handwash'),
      theme: qs('theme', 'handwash'),
      hub: qs('hub', ''),
      time: clamp(qs('time', '0'), 0, 9999),
      ...extra
    };
  }

  function makeSummary(payload = {}){
    const base = buildBaseCtx({
      stage: payload.stage || 'unknown'
    });

    return {
      ...base,
      success: !!payload.success,
      score: clamp(payload.score, 0, 999999),
      stars: clamp(payload.stars, 0, 3),
      miss: clamp(payload.miss, 0, 999999),
      timeLeft: clamp(payload.timeLeft, 0, 999999),
      accuracy: clamp(payload.accuracy, 0, 100),
      progress: clamp(payload.progress, 0, 100),
      bestStreak: clamp(payload.bestStreak, 0, 999999),
      whoDone: clamp(payload.whoDone, 0, 7),
      notes: payload.notes || '',
      finishedAt: payload.finishedAt || nowIso()
    };
  }

  function saveLastSummary(summary){
    try{
      localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(summary));
      localStorage.setItem(HANDWASH_LAST_KEY, JSON.stringify(summary));
    }catch{}
    return summary;
  }

  function pushHistory(summary, maxItems = 30){
    try{
      const raw = localStorage.getItem(HANDWASH_HISTORY_KEY);
      const list = Array.isArray(safeJsonParse(raw, [])) ? safeJsonParse(raw, []) : [];
      list.unshift(summary);
      localStorage.setItem(HANDWASH_HISTORY_KEY, JSON.stringify(list.slice(0, maxItems)));
    }catch{}
    return summary;
  }

  function saveFlowState(flowState = {}){
    const base = buildBaseCtx();
    const payload = {
      ...base,
      currentStage: flowState.currentStage || '',
      nextStage: flowState.nextStage || '',
      success: !!flowState.success,
      updatedAt: flowState.updatedAt || nowIso()
    };
    try{
      localStorage.setItem(HANDWASH_FLOW_KEY, JSON.stringify(payload));
    }catch{}
    return payload;
  }

  function getLastSummary(){
    try{
      return safeJsonParse(localStorage.getItem(HANDWASH_LAST_KEY), null);
    }catch{
      return null;
    }
  }

  function getHistory(){
    try{
      const parsed = safeJsonParse(localStorage.getItem(HANDWASH_HISTORY_KEY), []);
      return Array.isArray(parsed) ? parsed : [];
    }catch{
      return [];
    }
  }

  function getFlowState(){
    try{
      return safeJsonParse(localStorage.getItem(HANDWASH_FLOW_KEY), null);
    }catch{
      return null;
    }
  }

  function recordSummary(payload = {}){
    const summary = makeSummary(payload);
    saveLastSummary(summary);
    pushHistory(summary);
    saveFlowState({
      currentStage: payload.stage || '',
      nextStage: payload.nextStage || '',
      success: !!payload.success
    });
    return summary;
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
    nowIso,
    buildBaseCtx,
    makeSummary,
    saveLastSummary,
    pushHistory,
    saveFlowState,
    getLastSummary,
    getHistory,
    getFlowState,
    recordSummary
  };
})();