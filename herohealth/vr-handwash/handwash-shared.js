(function () {
  'use strict';

  const ROOT_KEY = 'HH_HANDWASH';
  const KEYS = {
    last: `${ROOT_KEY}_LAST`,
    history: `${ROOT_KEY}_HISTORY`,
    flow: `${ROOT_KEY}_FLOW`,
    daily: `${ROOT_KEY}_DAILY`,
    streak: `${ROOT_KEY}_STREAK`
  };

  function str(v, d = '') {
    return typeof v === 'string' ? v : (v == null ? d : String(v));
  }

  function num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function nowTs() {
    return Date.now();
  }

  function bangkokDayKey(ts = nowTs()) {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return fmt.format(new Date(ts));
    } catch {
      return new Date(ts).toISOString().slice(0, 10);
    }
  }

  function yesterdayDayKey(ts = nowTs()) {
    const d = new Date(ts);
    d.setUTCDate(d.getUTCDate() - 1);
    return bangkokDayKey(d.getTime());
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
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

  function qs() {
    try {
      return new URL(location.href).searchParams;
    } catch {
      return new URLSearchParams('');
    }
  }

  function normalizeStage(stage) {
    const s = str(stage).toLowerCase().trim();
    if (s === 'mini' || s === 'miniorder' || s === 'mini_order') return 'mini-order';
    if (s === 'howto' || s === 'practice' || s === 'main' || s === 'mini-order') return s;
    return s || 'unknown';
  }

  function buildBaseContext() {
    const q = qs();
    return {
      pid: str(q.get('pid'), 'anon'),
      name: str(q.get('name'), 'Hero'),
      diff: str(q.get('diff'), 'normal'),
      view: str(q.get('view'), 'mobile'),
      run: str(q.get('run'), 'play'),
      zone: str(q.get('zone'), 'hygiene'),
      cat: str(q.get('cat'), 'hygiene'),
      game: str(q.get('game'), 'handwash'),
      gameId: str(q.get('gameId'), 'handwash'),
      theme: str(q.get('theme'), 'handwash'),
      hub: str(q.get('hub'), ''),
      seed: str(q.get('seed'), '')
    };
  }

  function normalizeEntry(payload = {}) {
    const badges = Array.isArray(payload.badges)
      ? payload.badges.map(v => str(v)).filter(Boolean)
      : [];

    const entry = {
      ...buildBaseContext(),
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
      badges,
      rank: str(payload.rank, ''),
      timestamp: num(payload.timestamp, nowTs())
    };

    return entry;
  }

  function getLast() {
    return read(KEYS.last, null);
  }

  function setLast(entry) {
    return write(KEYS.last, entry);
  }

  function getHistory() {
    const value = read(KEYS.history, []);
    return Array.isArray(value) ? value : [];
  }

  function setHistory(entries) {
    return write(KEYS.history, Array.isArray(entries) ? entries : []);
  }

  function getFlow() {
    return read(KEYS.flow, {
      pid: 'anon',
      name: 'Hero',
      stage: '',
      success: false,
      timestamp: 0
    });
  }

  function setFlow(flow) {
    return write(KEYS.flow, {
      pid: str(flow && flow.pid, 'anon'),
      name: str(flow && flow.name, 'Hero'),
      stage: normalizeStage(flow && flow.stage),
      success: !!(flow && flow.success),
      timestamp: num(flow && flow.timestamp, nowTs())
    });
  }

  function getLatestByStage(stage) {
    const s = normalizeStage(stage);
    const history = getHistory();
    return history.find(entry => normalizeStage(entry.stage) === s) || null;
  }

  function getLatestSuccessByStage(stage) {
    const s = normalizeStage(stage);
    const history = getHistory();
    return history.find(entry => normalizeStage(entry.stage) === s && !!entry.success) || null;
  }

  function collectBadges(entries) {
    const set = new Set();
    (entries || []).forEach(entry => {
      const badges = Array.isArray(entry.badges) ? entry.badges : [];
      badges.forEach(badge => {
        const clean = str(badge);
        if (clean) set.add(clean);
      });
    });
    return [...set];
  }

  function totalStars(entries) {
    return (entries || []).reduce((sum, entry) => sum + Math.max(0, num(entry.stars, 0)), 0);
  }

  function totalScore(entries) {
    return (entries || []).reduce((sum, entry) => sum + Math.max(0, num(entry.score, 0)), 0);
  }

  function computeOverallRank(entries) {
    const badges = collectBadges(entries);
    const stars = totalStars(entries);
    const score = totalScore(entries);

    const howto = !!getLatestSuccessByStage('howto');
    const practice = !!(entries || []).find(e => normalizeStage(e.stage) === 'practice' && e.success);
    const main = !!getLatestSuccessByStage('main');
    const mini = !!getLatestSuccessByStage('mini-order');

    if (howto && practice && main && mini && badges.length >= 8 && stars >= 8 && score >= 1200) {
      return 'Gold WHO Master';
    }

    if (howto && practice && main && mini && badges.length >= 5 && stars >= 5 && score >= 800) {
      return 'Silver Soap Hero';
    }

    if (howto || practice || main || mini) {
      return 'Bronze Clean Kid';
    }

    return 'Starter';
  }

  function summarizeCollection(entries) {
    const badges = collectBadges(entries);
    return {
      badges,
      badgeCount: badges.length,
      stars: totalStars(entries),
      score: totalScore(entries),
      rank: computeOverallRank(entries)
    };
  }

  function getResumeStage() {
    const howto = !!getLatestSuccessByStage('howto');
    const practice = !!getLatestSuccessByStage('practice');
    const main = !!getLatestSuccessByStage('main');
    const mini = !!getLatestSuccessByStage('mini-order');

    if (!howto) return 'howto';
    if (!practice) return 'practice';
    if (!main) return 'main';
    if (!mini) return 'mini-order';
    return 'done';
  }

  function stageLabel(stage) {
    const s = normalizeStage(stage);
    if (s === 'howto') return 'Howto';
    if (s === 'practice') return 'Practice Lab';
    if (s === 'main') return 'Main Game';
    if (s === 'mini-order') return 'Mini Order';
    return s || 'Unknown';
  }

  function buildUrls(viewOverride) {
    const q = qs();
    const pid = str(q.get('pid'), 'anon');
    const name = str(q.get('name'), 'Hero');
    const diff = str(q.get('diff'), 'normal');
    const view = str(viewOverride, str(q.get('view'), 'mobile'));
    const run = str(q.get('run'), 'play');
    const zone = 'hygiene';
    const cat = 'hygiene';
    const game = 'handwash';
    const gameId = 'handwash';
    const theme = 'handwash';
    const hub = str(q.get('hub'), new URL('../hygiene-zone.html', location.href).toString());
    const seed = String(nowTs());
    const time = str(q.get('time'), '90');
    const miniTime = str(q.get('miniTime'), '60');

    const common = new URLSearchParams();
    common.set('pid', pid);
    common.set('name', name);
    common.set('diff', diff);
    common.set('view', view);
    common.set('run', run);
    common.set('zone', zone);
    common.set('cat', cat);
    common.set('game', game);
    common.set('gameId', gameId);
    common.set('theme', theme);
    common.set('hub', hub);
    common.set('seed', seed);

    const miniParams = new URLSearchParams(common.toString());
    miniParams.set('time', miniTime);
    const mini = new URL('./handwash-mini-order.html', location.href);
    mini.search = miniParams.toString();

    const mainParams = new URLSearchParams(common.toString());
    mainParams.set('time', time);
    mainParams.set('next', mini.toString());
    const main = new URL('../handwash-v2.html', location.href);
    main.search = mainParams.toString();

    const practiceParams = new URLSearchParams(common.toString());
    practiceParams.set('time', time);
    practiceParams.set('next', main.toString());
    const practice = new URL('./handwash-vr.html', location.href);
    practice.search = practiceParams.toString();

    const howtoParams = new URLSearchParams(common.toString());
    howtoParams.set('time', time);
    howtoParams.set('next', practice.toString());
    const howto = new URL('./handwash-howto.html', location.href);
    howto.search = howtoParams.toString();

    return {
      howto: howto.toString(),
      practice: practice.toString(),
      main: main.toString(),
      mini: mini.toString(),
      hub
    };
  }

  function getDailyState() {
    return read(KEYS.daily, {
      dayKey: bangkokDayKey(),
      completed: {
        howto: false,
        practice: false,
        main: false,
        'mini-order': false
      },
      missions: {
        perfect_clear: false,
        score_500: false
      }
    });
  }

  function setDailyState(value) {
    return write(KEYS.daily, value);
  }

  function getStreakState() {
    return read(KEYS.streak, {
      lastFullDay: '',
      current: 0,
      best: 0
    });
  }

  function setStreakState(value) {
    return write(KEYS.streak, value);
  }

  function ensureDailyFresh(ts = nowTs()) {
    const today = bangkokDayKey(ts);
    const daily = getDailyState();

    if (daily.dayKey !== today) {
      const fresh = {
        dayKey: today,
        completed: {
          howto: false,
          practice: false,
          main: false,
          'mini-order': false
        },
        missions: {
          perfect_clear: false,
          score_500: false
        }
      };
      setDailyState(fresh);
      return fresh;
    }

    return daily;
  }

  function updateDailyAndStreak(entry) {
    const daily = ensureDailyFresh(entry.timestamp);

    if (entry.success && Object.prototype.hasOwnProperty.call(daily.completed, entry.stage)) {
      daily.completed[entry.stage] = true;
    }

    if (entry.success && num(entry.miss, 0) === 0) {
      daily.missions.perfect_clear = true;
    }

    if (entry.success && num(entry.score, 0) >= 500) {
      daily.missions.score_500 = true;
    }

    setDailyState(daily);

    const fullFlowDone =
      daily.completed.practice &&
      daily.completed.main &&
      daily.completed['mini-order'];

    const streak = getStreakState();

    if (fullFlowDone) {
      const today = daily.dayKey;

      if (streak.lastFullDay !== today) {
        if (streak.lastFullDay === yesterdayDayKey(entry.timestamp)) {
          streak.current += 1;
        } else {
          streak.current = 1;
        }

        streak.lastFullDay = today;
        streak.best = Math.max(streak.best || 0, streak.current || 0);
        setStreakState(streak);
      }
    }

    return {
      daily,
      streak: getStreakState()
    };
  }

  function saveSummary(payload = {}) {
    const entry = normalizeEntry(payload);

    setLast(entry);

    const history = getHistory();
    history.unshift(entry);
    const trimmed = history.slice(0, 30);
    setHistory(trimmed);

    setFlow({
      pid: entry.pid,
      name: entry.name,
      stage: entry.stage,
      success: entry.success,
      timestamp: entry.timestamp
    });

    updateDailyAndStreak(entry);

    return entry;
  }

  function clearAll() {
    try {
      localStorage.removeItem(KEYS.last);
      localStorage.removeItem(KEYS.history);
      localStorage.removeItem(KEYS.flow);
      localStorage.removeItem(KEYS.daily);
      localStorage.removeItem(KEYS.streak);
      return true;
    } catch {
      return false;
    }
  }

  window.HandwashShared = {
    ROOT_KEY,
    KEYS,
    qs,
    str,
    num,
    clamp,
    nowTs,
    bangkokDayKey,
    buildBaseContext,
    normalizeEntry,
    saveSummary,
    getLast,
    getHistory,
    getFlow,
    clearAll,
    stageLabel,
    getLatestByStage,
    getLatestSuccessByStage,
    getResumeStage,
    buildUrls,
    collectBadges,
    totalStars,
    totalScore,
    computeOverallRank,
    summarizeCollection,
    getDailyState,
    getStreakState,
    updateDailyAndStreak
  };
})();