(function () {
  'use strict';

  const ROOT_KEY = 'HHA_HANDWASH';
  const KEYS = {
    last: `${ROOT_KEY}_LAST`,
    history: `${ROOT_KEY}_HISTORY`,
    flow: `${ROOT_KEY}_FLOW`
  };

  function safeParse(text, fallback) {
    try { return JSON.parse(text); } catch { return fallback; }
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return safeParse(raw, fallback);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function str(value, fallback = '') {
    const s = String(value ?? '').trim();
    return s || fallback;
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function nowTs() {
    return Date.now();
  }

  function normalizeStage(stage) {
    const s = str(stage).toLowerCase();
    if (s === 'howto' || s === 'practice' || s === 'main' || s === 'mini-order') return s;
    return 'unknown';
  }

  function stageLabel(stage) {
    switch (normalizeStage(stage)) {
      case 'howto': return 'Howto';
      case 'practice': return 'Practice Lab';
      case 'main': return 'Main Game';
      case 'mini-order': return 'Mini Order';
      default: return 'Unknown';
    }
  }

  function buildBaseContext(extra = {}) {
    return {
      pid: str(qs('pid', 'anon'), 'anon'),
      name: str(qs('name', 'Hero'), 'Hero'),
      diff: str(qs('diff', 'normal'), 'normal'),
      time: num(qs('time', 0), 0),
      view: str(qs('view', 'mobile'), 'mobile'),
      run: str(qs('run', 'play'), 'play'),
      zone: str(qs('zone', 'hygiene'), 'hygiene'),
      cat: str(qs('cat', 'hygiene'), 'hygiene'),
      game: str(qs('game', 'handwash'), 'handwash'),
      gameId: str(qs('gameId', 'handwash'), 'handwash'),
      theme: str(qs('theme', 'handwash'), 'handwash'),
      hub: str(qs('hub', ''), ''),
      ...extra
    };
  }

  function normalizeEntry(payload = {}) {
    const base = buildBaseContext();
    return {
      ...base,
      stage: normalizeStage(payload.stage),
      success: !!payload.success,
      score: Math.max(0, Math.round(num(payload.score, 0))),
      stars: clamp(Math.round(num(payload.stars, 0)), 0, 3),
      miss: Math.max(0, Math.round(num(payload.miss, 0))),
      timeLeft: Math.max(0, Math.round(num(payload.timeLeft, 0))),
      progress: clamp(Math.round(num(payload.progress, 0)), 0, 100),
      accuracy: clamp(Math.round(num(payload.accuracy, 0)), 0, 100),
      bestStreak: Math.max(0, Math.round(num(payload.bestStreak, 0))),
      whoDone: clamp(Math.round(num(payload.whoDone, 0)), 0, 7),
      notes: str(payload.notes, ''),
      timestamp: num(payload.timestamp, nowTs())
    };
  }

  function getLast() {
    return read(KEYS.last, null);
  }

  function getHistory() {
    const items = read(KEYS.history, []);
    return Array.isArray(items) ? items : [];
  }

  function getFlow() {
    return read(KEYS.flow, null);
  }

  function saveSummary(payload = {}) {
    const entry = normalizeEntry(payload);
    write(KEYS.last, entry);

    const history = getHistory();
    history.unshift(entry);
    write(KEYS.history, history.slice(0, 40));

    write(KEYS.flow, {
      pid: entry.pid,
      name: entry.name,
      stage: entry.stage,
      success: entry.success,
      timestamp: entry.timestamp
    });

    return entry;
  }

  function clearAll() {
    remove(KEYS.last);
    remove(KEYS.history);
    remove(KEYS.flow);
  }

  function getLatestByStage(stage) {
    const target = normalizeStage(stage);
    return getHistory().find(item => normalizeStage(item.stage) === target) || null;
  }

  function getLatestSuccessByStage(stage) {
    const target = normalizeStage(stage);
    return getHistory().find(item => normalizeStage(item.stage) === target && item.success) || null;
  }

  function getResumeStage() {
    const howto = getLatestSuccessByStage('howto');
    const practice = getLatestSuccessByStage('practice');
    const main = getLatestSuccessByStage('main');
    const mini = getLatestSuccessByStage('mini-order');

    if (!howto) return 'howto';
    if (!practice) return 'practice';
    if (!main) return 'main';
    if (!mini) return 'mini-order';
    return 'done';
  }

  function buildUrls(viewOverride = '') {
    const view = str(viewOverride, str(qs('view', 'mobile'), 'mobile'));
    const ctx = buildBaseContext({ view });

    const nextMini = new URL('./handwash-mini-order.html', location.href);
    const nextMain = new URL('../handwash-v2.html', location.href);
    const nextPractice = new URL('./handwash-vr.html', location.href);
    const nextHowto = new URL('./handwash-howto.html', location.href);

    const miniParams = new URLSearchParams();
    const mainParams = new URLSearchParams();
    const practiceParams = new URLSearchParams();
    const howtoParams = new URLSearchParams();

    Object.entries(ctx).forEach(([k, v]) => {
      if (v !== '' && v != null) {
        miniParams.set(k, String(v));
        mainParams.set(k, String(v));
        practiceParams.set(k, String(v));
        howtoParams.set(k, String(v));
      }
    });

    miniParams.set('time', String(qs('miniTime', 60)));
    mainParams.set('time', String(qs('time', ctx.time || 90)));
    mainParams.set('next', `${nextMini.pathname}?${miniParams.toString()}`);

    practiceParams.set('time', String(qs('time', ctx.time || 90)));
    practiceParams.set('next', `${nextMain.pathname}?${mainParams.toString()}`);

    howtoParams.set('time', String(qs('time', ctx.time || 90)));
    howtoParams.set('next', `${nextPractice.pathname}?${practiceParams.toString()}`);

    return {
      howto: `${nextHowto.pathname}?${howtoParams.toString()}`,
      practice: `${nextPractice.pathname}?${practiceParams.toString()}`,
      main: `${nextMain.pathname}?${mainParams.toString()}`,
      'mini-order': `${nextMini.pathname}?${miniParams.toString()}`
    };
  }

  window.HandwashShared = {
    ROOT_KEY,
    KEYS,
    str,
    num,
    clamp,
    qs,
    nowTs,
    stageLabel,
    buildBaseContext,
    normalizeEntry,
    saveSummary,
    getLast,
    getHistory,
    getFlow,
    clearAll,
    getLatestByStage,
    getLatestSuccessByStage,
    getResumeStage,
    buildUrls
  };
})();
