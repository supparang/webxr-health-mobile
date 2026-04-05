'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle.js
 * GoodJunk Battle Controller / Compatibility Layer
 * FULL PATCH v20260405-battle-controller-runtime-full
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_BATTLE_CONTROLLER_LOADED__) return;
  W.__GJ_BATTLE_CONTROLLER_LOADED__ = true;

  const qs = (k, d='') => {
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
  };

  const num = (v, d=0) => {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, num(v, a)));
  const now = () => Date.now();

  function clean(v, max=120){
    return String(v == null ? '' : v).trim().slice(0, max);
  }

  function cleanPid(v){
    return String(v == null ? '' : v).replace(/[.#$[\]/]/g, '-').trim().slice(0, 80);
  }

  function cleanRoom(v){
    return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function emit(name, detail){
    try { W.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }
    catch {}
  }

  const CTX = {
    game: 'goodjunk',
    zone: 'nutrition',
    mode: 'battle',
    roomId: cleanRoom(qs('roomId', qs('room', ''))),
    roomKind: clean(qs('roomKind', ''), 40),
    pid: cleanPid(qs('pid', 'anon')),
    uid: cleanPid(qs('uid', '')),
    name: clean(qs('name', qs('nick', 'Player')), 80),
    role: clean(qs('role', 'player'), 24),
    diff: clean(qs('diff', 'normal'), 24).toLowerCase(),
    time: clamp(qs('time', '90'), 30, 300),
    seed: clean(qs('seed', String(now())), 80),
    roundId: clean(qs('roundId', ''), 80),
    hub: clean(qs('hub', '../hub.html'), 500),
    view: clean(qs('view', 'mobile'), 24),
    host: clean(qs('host', '0'), 8)
  };

  const STORE_LAST = 'HHA_LAST_SUMMARY';
  const STORE_LAST_BATTLE = 'HHA_LAST_SUMMARY_BATTLE';
  const STORE_LAST_BATTLE_ROOM = CTX.roomId ? `HHA_LAST_SUMMARY_BATTLE_${CTX.roomId}` : '';

  const S = {
    runtime: null,
    core: null,
    lastLive: null,
    lastSummary: null,
    lastControllerSummary: null,
    controllerSummarySent: false,
    resultWatchBound: false,
    roomPollTimer: 0,
    scoreWatchTimer: 0,
    readyAt: now()
  };

  function runtimeCtx(){
    return {
      roomId: CTX.roomId || '',
      roomKind: CTX.roomKind || '',
      pid: CTX.pid || '',
      uid: CTX.uid || '',
      name: CTX.name || '',
      role: CTX.role || '',
      diff: CTX.diff || '',
      time: Number(CTX.time || 0),
      seed: String(CTX.seed || ''),
      view: CTX.view || '',
      host: String(CTX.host || '0')
    };
  }

  function saveJson(key, value){
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function loadJson(key, fallback=null){
    if (!key) return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getCore(){
    if (W.__GJ_BATTLE_CORE__ && typeof W.__GJ_BATTLE_CORE__ === 'object') {
      return W.__GJ_BATTLE_CORE__;
    }
    return null;
  }

  function currentResultMount(){
    return D.getElementById('battleResultMount');
  }

  function normalizeSummary(detail){
    const src = (detail && typeof detail === 'object' && detail.summary && typeof detail.summary === 'object')
      ? detail.summary
      : (detail || {});

    const standings = Array.isArray(src.standings) ? src.standings.map((r, i) => ({
      pid: cleanPid(r.pid || ''),
      nick: clean(r.nick || r.name || r.pid || `player-${i+1}`, 80),
      rank: num(r.rank, i + 1),
      score: num(r.score, 0),
      miss: num(r.miss, 0),
      goodHit: num(r.goodHit, 0),
      junkHit: num(r.junkHit, 0),
      bestStreak: num(r.bestStreak, 0),
      duration: num(r.duration, CTX.time),
      hp: num(r.hp, 0),
      maxHp: num(r.maxHp, 100),
      attacksUsed: num(r.attacksUsed, 0),
      damageDealt: num(r.damageDealt, 0),
      damageTaken: num(r.damageTaken, 0),
      koCount: num(r.koCount, 0)
    })) : [];

    const compare = src.compare && typeof src.compare === 'object'
      ? src.compare
      : null;

    const me =
      (compare && compare.me) ||
      standings.find((r) => String(r.pid || '') === String(CTX.pid || '')) ||
      null;

    const opponent =
      (compare && compare.opponent) ||
      standings.find((r) => String(r.pid || '') !== String(CTX.pid || '')) ||
      null;

    return {
      controllerFinal: !!src.controllerFinal,
      game: src.game || 'goodjunk',
      zone: src.zone || 'nutrition',
      mode: src.mode || 'battle',
      roomId: cleanRoom(src.roomId || CTX.roomId || ''),
      roomKind: clean(src.roomKind || CTX.roomKind || '', 40),
      pid: cleanPid(src.pid || CTX.pid || ''),
      uid: cleanPid(src.uid || CTX.uid || ''),
      name: clean(src.name || CTX.name || 'Player', 80),
      role: clean(src.role || CTX.role || 'player', 24),
      rank: num(src.rank || (me && me.rank) || 0, 0),
      score: num(src.score || (me && me.score) || 0, 0),
      players: Math.max(1, num(src.players || standings.length || 1, 1)),
      miss: num(src.miss || (me && me.miss) || 0, 0),
      goodHit: num(src.goodHit || (me && me.goodHit) || 0, 0),
      junkHit: num(src.junkHit || (me && me.junkHit) || 0, 0),
      bestStreak: num(src.bestStreak || (me && me.bestStreak) || 0, 0),
      duration: num(src.duration || (me && me.duration) || CTX.time, CTX.time),
      result: clean(src.result || '', 80) || (num(src.rank || (me && me.rank) || 0, 0) === 1 ? 'win' : 'finished'),
      reason: clean(src.reason || '', 80) || 'finished',
      hp: num(src.hp || (me && me.hp) || 0, 0),
      maxHp: num(src.maxHp || (me && me.maxHp) || 100, 100),
      attacksUsed: num(src.attacksUsed || (me && me.attacksUsed) || 0, 0),
      damageDealt: num(src.damageDealt || (me && me.damageDealt) || 0, 0),
      damageTaken: num(src.damageTaken || (me && me.damageTaken) || 0, 0),
      koCount: num(src.koCount || (me && me.koCount) || 0, 0),
      standings,
      compare: {
        me: me || null,
        opponent: opponent || null,
        delta: num(
          (compare && compare.delta) != null
            ? compare.delta
            : ((me ? me.score : 0) - (opponent ? opponent.score : 0)),
          0
        )
      },
      raw: src.raw && typeof src.raw === 'object' ? src.raw : {}
    };
  }

  function persistSummary(summary){
    const normalized = normalizeSummary(summary);
    S.lastSummary = normalized;
    saveJson(STORE_LAST, normalized);
    saveJson(STORE_LAST_BATTLE, normalized);
    if (STORE_LAST_BATTLE_ROOM) saveJson(STORE_LAST_BATTLE_ROOM, normalized);
    W.__GJ_BATTLE_LAST_SUMMARY__ = normalized;
    return normalized;
  }

  function maybeCreateRuntime(){
    if (S.runtime) return S.runtime;
    if (!(W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function')) return null;

    S.runtime = W.HHARuntimeContract.create({
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'battle',
      getCtx: runtimeCtx
    });

    return S.runtime;
  }

  async function flushRuntime(){
    const rt = maybeCreateRuntime();
    if (!rt) return;
    try { await rt.flush(); } catch (_) {}
  }

  async function maybeSendControllerSummary(summary){
    const normalized = persistSummary(summary);
    if (normalized.controllerFinal) return normalized;
    if (S.controllerSummarySent) return normalized;

    S.controllerSummarySent = true;
    S.lastControllerSummary = Object.assign({}, normalized, { controllerFinal: true });

    emit('gj:controller-summary', S.lastControllerSummary);
    emit('hha:controller-summary', S.lastControllerSummary);

    const rt = maybeCreateRuntime();
    if (rt && typeof rt.summary === 'function') {
      try { await rt.summary(S.lastControllerSummary); } catch (_) {}
    }

    return S.lastControllerSummary;
  }

  function readCoreRoomResults(){
    const core = getCore();
    if (!core || !core.state || !core.state.room || !core.state.room.results) return {};
    return core.state.room.results || {};
  }

  function computeControllerSummaryFromResults(){
    const resultsObj = readCoreRoomResults();
    const rows = Object.keys(resultsObj || {}).map((pid) => {
      const r = resultsObj[pid] || {};
      return {
        pid: cleanPid(r.pid || pid),
        nick: clean(r.nick || r.name || pid || 'player', 80),
        score: num(r.score, 0),
        miss: num(r.miss, 0),
        goodHit: num(r.goodHit, 0),
        junkHit: num(r.junkHit, 0),
        bestStreak: num(r.bestStreak, 0),
        duration: num(r.duration, CTX.time),
        hp: num(r.hp, 0),
        maxHp: num(r.maxHp, 100),
        attacksUsed: num(r.attacksUsed, 0),
        damageDealt: num(r.damageDealt, 0),
        damageTaken: num(r.damageTaken, 0),
        koCount: num(r.koCount, 0)
      };
    });

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.hp !== a.hp) return b.hp - a.hp;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      if (b.koCount !== a.koCount) return b.koCount - a.koCount;
      return String(a.pid || '').localeCompare(String(b.pid || ''));
    });

    rows.forEach((r, i) => { r.rank = i + 1; });

    if (!rows.length) return null;

    const me = rows.find((r) => String(r.pid || '') === String(CTX.pid || '')) || rows[0];
    const opponent = rows.find((r) => String(r.pid || '') !== String(CTX.pid || '')) || null;

    return normalizeSummary({
      controllerFinal: true,
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'battle',
      roomId: CTX.roomId,
      roomKind: CTX.roomKind,
      pid: CTX.pid,
      uid: CTX.uid,
      name: CTX.name,
      role: CTX.role,
      rank: me ? me.rank : 0,
      score: me ? me.score : 0,
      players: rows.length,
      miss: me ? me.miss : 0,
      goodHit: me ? me.goodHit : 0,
      junkHit: me ? me.junkHit : 0,
      bestStreak: me ? me.bestStreak : 0,
      duration: me ? me.duration : CTX.time,
      result: me && me.rank === 1 ? 'win' : (me && me.rank === 2 ? 'lose' : 'finished'),
      reason: 'controller-compare',
      hp: me ? me.hp : 0,
      maxHp: me ? me.maxHp : 100,
      attacksUsed: me ? me.attacksUsed : 0,
      damageDealt: me ? me.damageDealt : 0,
      damageTaken: me ? me.damageTaken : 0,
      koCount: me ? me.koCount : 0,
      standings: rows,
      compare: {
        me,
        opponent,
        delta: (me ? me.score : 0) - (opponent ? opponent.score : 0)
      }
    });
  }

  async function maybeUpgradeStoredSummary(){
    if (S.controllerSummarySent) return;

    const mount = currentResultMount();
    const alreadyVisible = mount && mount.hidden === false;
    const candidate =
      computeControllerSummaryFromResults() ||
      loadJson(STORE_LAST_BATTLE_ROOM, null) ||
      loadJson(STORE_LAST_BATTLE, null) ||
      loadJson(STORE_LAST, null);

    if (!candidate) return;

    const normalized = normalizeSummary(candidate);
    if (!normalized || !normalized.roomId) return;
    if (normalized.roomId && CTX.roomId && String(normalized.roomId) !== String(CTX.roomId)) return;

    if (normalized.standings && normalized.standings.length >= 2) {
      await maybeSendControllerSummary(normalized);
      if (!alreadyVisible) {
        emit('hha:summary', S.lastControllerSummary || normalized);
      }
    }
  }

  function patchResultMountDebug(summary){
    const mount = currentResultMount();
    if (!mount || mount.hidden) return;

    const shell = mount.firstElementChild;
    if (!shell) return;

    if (shell.querySelector('[data-battle-controller-debug="1"]')) return;

    const debug = D.createElement('div');
    debug.setAttribute('data-battle-controller-debug', '1');
    debug.style.borderRadius = '16px';
    debug.style.background = '#fff';
    debug.style.border = '1px dashed #bfe3f2';
    debug.style.padding = '12px';
    debug.style.color = '#6b7280';
    debug.style.fontSize = '12px';
    debug.style.lineHeight = '1.6';
    debug.style.whiteSpace = 'pre-wrap';
    debug.style.wordBreak = 'break-word';
    debug.textContent =
      `controllerFinal=${summary && summary.controllerFinal ? 'true' : 'false'}
roomId=${escapeHtml(CTX.roomId || '-')}
roomKind=${escapeHtml(CTX.roomKind || '-')}
reason=${escapeHtml(summary && summary.reason ? summary.reason : '-')}`;

    const actions = shell.querySelector('.btn') ? shell.lastElementChild : null;
    if (actions && actions.parentNode === shell) {
      shell.insertBefore(debug, actions);
    } else {
      shell.appendChild(debug);
    }
  }

  function maybePatchRematchLink(summary){
    const mount = currentResultMount();
    if (!mount || mount.hidden) return;

    const existing = D.getElementById('battleControllerRematchBtn');
    if (existing) return;

    const shell = mount.firstElementChild;
    if (!shell) return;

    const actions = Array.from(shell.querySelectorAll('a,button')).find((el) => {
      const t = String(el.textContent || '').toLowerCase();
      return t.includes('hub') || t.includes('lobby') || t.includes('อีกครั้ง');
    });

    const actionWrap = actions ? actions.parentElement : null;
    if (!actionWrap) return;

    const btn = D.createElement('button');
    btn.id = 'battleControllerRematchBtn';
    btn.type = 'button';
    btn.className = 'btn good';
    btn.textContent = '🔁 รีแมตช์ (controller)';
    btn.addEventListener('click', () => {
      const url = new URL('./goodjunk-battle-lobby.html', location.href);
      const src = new URL(location.href);

      src.searchParams.forEach((value, key) => {
        if (key === 'autostart') return;
        url.searchParams.set(key, value);
      });

      if (CTX.roomId) {
        url.searchParams.set('roomId', CTX.roomId);
        url.searchParams.set('room', CTX.roomId);
      }
      if ((summary && summary.roomKind) || CTX.roomKind) {
        url.searchParams.set('roomKind', (summary && summary.roomKind) || CTX.roomKind);
      }
      url.searchParams.set('autojoin', '1');
      url.searchParams.set('rematch', '1');

      location.href = url.toString();
    });

    actionWrap.appendChild(btn);
  }

  function bindSummaryEvents(){
    ['gj:summary','hha:summary','hha:session-summary'].forEach((eventName) => {
      W.addEventListener(eventName, async (evt) => {
        const detail = evt && evt.detail ? evt.detail : null;
        if (!detail || typeof detail !== 'object') return;

        const normalized = persistSummary(detail);
        patchResultMountDebug(normalized);
        maybePatchRematchLink(normalized);

        if (normalized.standings && normalized.standings.length >= 2 && !normalized.controllerFinal) {
          await maybeSendControllerSummary(normalized);
        }
      });
    });

    W.addEventListener('battle:update', (evt) => {
      const detail = evt && evt.detail ? evt.detail : null;
      if (!detail || typeof detail !== 'object') return;
      S.lastLive = detail;
      persistScoreSnapshot(detail);
    });

    W.addEventListener('hha:score', (evt) => {
      const detail = evt && evt.detail ? evt.detail : null;
      if (!detail || typeof detail !== 'object') return;
      persistScoreSnapshot(detail);
    });
  }

  function persistScoreSnapshot(detail){
    const score = num(detail.score, 0);
    const miss = num(detail.miss, 0);
    const bestStreak = num(detail.bestStreak, 0);

    const snapshot = {
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'battle',
      roomId: CTX.roomId,
      roomKind: CTX.roomKind,
      pid: CTX.pid,
      uid: CTX.uid,
      name: CTX.name,
      role: CTX.role,
      score,
      miss,
      bestStreak,
      updatedAt: now()
    };

    saveJson('HHA_BATTLE_LIVE_SNAPSHOT', snapshot);
    if (CTX.roomId) saveJson(`HHA_BATTLE_LIVE_SNAPSHOT_${CTX.roomId}`, snapshot);
  }

  function bindResultMountObserver(){
    if (S.resultWatchBound) return;
    S.resultWatchBound = true;

    const mount = currentResultMount();
    if (!mount) return;

    const mo = new MutationObserver(async () => {
      if (mount.hidden) return;

      const summary =
        S.lastControllerSummary ||
        S.lastSummary ||
        computeControllerSummaryFromResults() ||
        loadJson(STORE_LAST_BATTLE_ROOM, null) ||
        loadJson(STORE_LAST_BATTLE, null) ||
        loadJson(STORE_LAST, null);

      if (summary) {
        patchResultMountDebug(normalizeSummary(summary));
        maybePatchRematchLink(normalizeSummary(summary));
        await maybeUpgradeStoredSummary();
      }
    });

    mo.observe(mount, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden']
    });
  }

  function startControllerPolling(){
    clearInterval(S.roomPollTimer);
    S.roomPollTimer = setInterval(async () => {
      const core = getCore();
      if (!core || !core.state) return;

      S.core = core;

      try {
        const room = core.state.room || {};
        const results = room.results || {};
        const resultCount = Object.keys(results).length;

        if (resultCount >= 2) {
          await maybeUpgradeStoredSummary();
        }

        const status = String((room.state && room.state.status) || '');
        if ((status === 'ended' || status === 'finished') && !S.controllerSummarySent) {
          await maybeUpgradeStoredSummary();
        }
      } catch (_) {}
    }, 600);

    clearInterval(S.scoreWatchTimer);
    S.scoreWatchTimer = setInterval(() => {
      const snap = loadJson('HHA_BATTLE_LIVE_SNAPSHOT', null);
      if (!snap) return;
      if (snap.roomId && CTX.roomId && String(snap.roomId) !== String(CTX.roomId)) return;
      if (!S.lastLive) {
        S.lastLive = snap;
      }
    }, 1200);
  }

  function installLegacyBridge(){
    const legacy = {
      getCtx: () => Object.assign({}, runtimeCtx()),
      getCore: () => getCore(),
      getLastSummary: () => S.lastControllerSummary || S.lastSummary || loadJson(STORE_LAST_BATTLE_ROOM, null) || loadJson(STORE_LAST_BATTLE, null) || null,
      forceControllerSummary: async () => {
        const summary = computeControllerSummaryFromResults();
        if (!summary) return null;
        await maybeSendControllerSummary(summary);
        return S.lastControllerSummary || summary;
      },
      persistSummary: (summary) => persistSummary(summary),
      normalizeSummary: (summary) => normalizeSummary(summary)
    };

    W.__GJ_BATTLE_CONTROLLER__ = legacy;
    W.GJ_BATTLE_CONTROLLER = legacy;
  }

  async function init(){
    await flushRuntime();
    maybeCreateRuntime();
    bindSummaryEvents();
    bindResultMountObserver();
    startControllerPolling();
    installLegacyBridge();

    const cached =
      loadJson(STORE_LAST_BATTLE_ROOM, null) ||
      loadJson(STORE_LAST_BATTLE, null) ||
      loadJson(STORE_LAST, null);

    if (cached) {
      S.lastSummary = normalizeSummary(cached);
    }

    await maybeUpgradeStoredSummary();
  }

  init().catch((err) => {
    console.warn('[goodjunk-battle-controller] init failed', err);
  });

  W.addEventListener('beforeunload', () => {
    clearInterval(S.roomPollTimer);
    clearInterval(S.scoreWatchTimer);
  });
})();