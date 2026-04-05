'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-coop.js
 * GoodJunk Coop Controller / Compatibility Layer
 * FULL PATCH v20260405-coop-controller-runtime-full
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_COOP_CONTROLLER_LOADED__) return;
  W.__GJ_COOP_CONTROLLER_LOADED__ = true;

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
    mode: 'coop',
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
    host: clean(qs('host', '0'), 8),
    spectate: qs('spectate', '0') === '1'
  };

  const STORE_LAST = 'HHA_LAST_SUMMARY';
  const STORE_LAST_COOP = 'HHA_LAST_SUMMARY_COOP';
  const STORE_LAST_COOP_ROOM = CTX.roomId ? `HHA_LAST_SUMMARY_COOP_${CTX.roomId}` : '';
  const STORE_LIVE = 'HHA_COOP_LIVE_SNAPSHOT';
  const STORE_LIVE_ROOM = CTX.roomId ? `HHA_COOP_LIVE_SNAPSHOT_${CTX.roomId}` : '';

  const S = {
    runtime: null,
    core: null,
    lastLive: null,
    lastSummary: null,
    lastControllerSummary: null,
    controllerSummarySent: false,
    resultWatchBound: false,
    roomPollTimer: 0,
    liveWatchTimer: 0,
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
    if (W.__GJ_COOP_CORE__ && typeof W.__GJ_COOP_CORE__ === 'object') {
      return W.__GJ_COOP_CORE__;
    }
    return null;
  }

  function currentResultMount(){
    return D.getElementById('coopResultMount');
  }

  function normalizeStandingRow(r, i){
    return {
      pid: cleanPid(r && (r.pid || r.playerId) || ''),
      nick: clean(r && (r.nick || r.name || r.pid) || `player-${i+1}`, 80),
      rank: num(r && r.rank, i + 1),
      score: num(r && r.score, 0),
      contribution: num(r && (r.contribution != null ? r.contribution : r.score), 0),
      miss: num(r && r.miss, 0),
      goodHit: num(r && r.goodHit, 0),
      junkHit: num(r && r.junkHit, 0),
      bestStreak: num(r && r.bestStreak, 0),
      duration: num(r && r.duration, CTX.time)
    };
  }

  function normalizeSummary(detail){
    const src = (detail && typeof detail === 'object' && detail.summary && typeof detail.summary === 'object')
      ? detail.summary
      : (detail || {});

    const standings = Array.isArray(src.standings)
      ? src.standings.map((r, i) => normalizeStandingRow(r, i))
      : [];

    const me =
      standings.find((r) => String(r.pid || '') === String(CTX.pid || '')) ||
      null;

    const goal = num((src.raw && src.raw.goal) != null ? src.raw.goal : src.goal, 0);
    const teamScore = num(src.teamScore != null ? src.teamScore : src.score, 0);
    const contribution = num(src.contribution != null ? src.contribution : (me ? me.contribution : src.score), 0);

    return {
      controllerFinal: !!src.controllerFinal,
      game: src.game || 'goodjunk',
      zone: src.zone || 'nutrition',
      mode: src.mode || 'coop',
      roomId: cleanRoom(src.roomId || CTX.roomId || ''),
      roomKind: clean(src.roomKind || CTX.roomKind || '', 40),
      pid: cleanPid(src.pid || CTX.pid || ''),
      uid: cleanPid(src.uid || CTX.uid || ''),
      name: clean(src.name || CTX.name || 'Player', 80),
      role: clean(src.role || CTX.role || 'player', 24),
      rank: num(src.rank || (me && me.rank) || 0, 0),
      score: num(src.score || (me && me.score) || 0, 0),
      teamScore,
      contribution,
      goal,
      players: Math.max(1, num(src.players || standings.length || 1, 1)),
      miss: num(src.miss || (me && me.miss) || 0, 0),
      goodHit: num(src.goodHit || (me && me.goodHit) || 0, 0),
      junkHit: num(src.junkHit || (me && me.junkHit) || 0, 0),
      bestStreak: num(src.bestStreak || (me && me.bestStreak) || 0, 0),
      duration: num(src.duration || (me && me.duration) || CTX.time, CTX.time),
      result: clean(src.result || '', 80) || (goal > 0 && teamScore >= goal ? 'goal-reached' : 'finished'),
      reason: clean(src.reason || '', 80) || 'finished',
      standings,
      raw: src.raw && typeof src.raw === 'object' ? src.raw : {}
    };
  }

  function persistSummary(summary){
    const normalized = normalizeSummary(summary);
    S.lastSummary = normalized;
    saveJson(STORE_LAST, normalized);
    saveJson(STORE_LAST_COOP, normalized);
    if (STORE_LAST_COOP_ROOM) saveJson(STORE_LAST_COOP_ROOM, normalized);
    W.__GJ_COOP_LAST_SUMMARY__ = normalized;
    return normalized;
  }

  function maybeCreateRuntime(){
    if (S.runtime) return S.runtime;
    if (!(W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function')) return null;

    S.runtime = W.HHARuntimeContract.create({
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'coop',
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

  function readCoreParticipants(){
    const core = getCore();
    if (!core || !core.state || !core.state.room) return [];
    const room = core.state.room || {};
    const ids =
      Array.isArray(room.state && room.state.participantIds) ? room.state.participantIds :
      Array.isArray(room.match && room.match.participantIds) ? room.match.participantIds :
      [];
    return ids.filter(Boolean);
  }

  function readCoreGoal(){
    const core = getCore();
    if (!core || !core.state) return 0;
    const st = core.state;
    return num(st.teamGoal || st.goal || 0, 0);
  }

  function computeControllerSummaryFromResults(){
    const resultsObj = readCoreRoomResults();
    const rows = Object.keys(resultsObj || {}).map((pid, i) => normalizeStandingRow(
      Object.assign({}, resultsObj[pid] || {}, { pid }),
      i
    ));

    rows.sort((a, b) => {
      if (b.contribution !== a.contribution) return b.contribution - a.contribution;
      if (b.score !== a.score) return b.score - a.score;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return String(a.pid || '').localeCompare(String(b.pid || ''));
    });

    rows.forEach((r, i) => { r.rank = i + 1; });

    if (!rows.length) return null;

    const me = rows.find((r) => String(r.pid || '') === String(CTX.pid || '')) || rows[0];
    const goal = readCoreGoal();
    const teamScore = rows.reduce((sum, r) => sum + num(r.score, 0), 0);
    const participantIds = readCoreParticipants();
    const playerCount = Math.max(rows.length, participantIds.length || 0, 1);

    return normalizeSummary({
      controllerFinal: true,
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'coop',
      roomId: CTX.roomId,
      roomKind: CTX.roomKind,
      pid: CTX.pid,
      uid: CTX.uid,
      name: CTX.name,
      role: CTX.role,
      rank: me ? me.rank : 0,
      score: me ? me.score : 0,
      teamScore,
      contribution: me ? me.contribution : 0,
      goal,
      players: playerCount,
      miss: me ? me.miss : 0,
      goodHit: me ? me.goodHit : 0,
      junkHit: me ? me.junkHit : 0,
      bestStreak: me ? me.bestStreak : 0,
      duration: me ? me.duration : CTX.time,
      result: goal > 0 && teamScore >= goal ? 'goal-reached' : 'finished',
      reason: 'controller-compare',
      standings: rows,
      raw: {
        goal,
        teamScore
      }
    });
  }

  async function maybeUpgradeStoredSummary(){
    if (S.controllerSummarySent) return;

    const mount = currentResultMount();
    const alreadyVisible = mount && mount.hidden === false;

    const candidate =
      computeControllerSummaryFromResults() ||
      loadJson(STORE_LAST_COOP_ROOM, null) ||
      loadJson(STORE_LAST_COOP, null) ||
      loadJson(STORE_LAST, null);

    if (!candidate) return;

    const normalized = normalizeSummary(candidate);
    if (!normalized || !normalized.roomId) return;
    if (normalized.roomId && CTX.roomId && String(normalized.roomId) !== String(CTX.roomId)) return;

    const coreParticipants = readCoreParticipants();
    const neededCount = Math.max(2, coreParticipants.length || normalized.players || 1);

    if (normalized.standings && normalized.standings.length >= neededCount) {
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

    if (shell.querySelector('[data-coop-controller-debug="1"]')) return;

    const debug = D.createElement('div');
    debug.setAttribute('data-coop-controller-debug', '1');
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

    const existing = D.getElementById('coopControllerRematchBtn');
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
    btn.id = 'coopControllerRematchBtn';
    btn.type = 'button';
    btn.className = 'btn good';
    btn.textContent = '🔁 รีแมตช์ (controller)';
    btn.addEventListener('click', () => {
      const url = new URL('./goodjunk-coop-lobby.html', location.href);
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

        const neededCount = Math.max(2, readCoreParticipants().length || normalized.players || 1);
        if (normalized.standings && normalized.standings.length >= neededCount && !normalized.controllerFinal) {
          await maybeSendControllerSummary(normalized);
        }
      });
    });

    W.addEventListener('coop:update', (evt) => {
      const detail = evt && evt.detail ? evt.detail : null;
      if (!detail || typeof detail !== 'object') return;
      S.lastLive = detail;
      persistLiveSnapshot(detail);
    });

    W.addEventListener('hha:score', (evt) => {
      const detail = evt && evt.detail ? evt.detail : null;
      if (!detail || typeof detail !== 'object') return;
      persistLiveSnapshot(detail);
    });
  }

  function persistLiveSnapshot(detail){
    const snapshot = {
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'coop',
      roomId: CTX.roomId,
      roomKind: CTX.roomKind,
      pid: CTX.pid,
      uid: CTX.uid,
      name: CTX.name,
      role: CTX.role,
      score: num(detail.score, 0),
      teamScore: num(detail.teamScore, 0),
      teamGoal: num(detail.teamGoal || detail.goal, 0),
      contribution: num(detail.contribution, num(detail.score, 0)),
      miss: num(detail.miss, 0),
      bestStreak: num(detail.bestStreak, 0),
      updatedAt: now()
    };

    saveJson(STORE_LIVE, snapshot);
    if (STORE_LIVE_ROOM) saveJson(STORE_LIVE_ROOM, snapshot);
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
        loadJson(STORE_LAST_COOP_ROOM, null) ||
        loadJson(STORE_LAST_COOP, null) ||
        loadJson(STORE_LAST, null);

      if (summary) {
        const normalized = normalizeSummary(summary);
        patchResultMountDebug(normalized);
        maybePatchRematchLink(normalized);
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
        const participantCount = Math.max(2,
          (Array.isArray(room.state && room.state.participantIds) ? room.state.participantIds.length : 0) ||
          (Array.isArray(room.match && room.match.participantIds) ? room.match.participantIds.length : 0) ||
          0
        );

        if (resultCount >= participantCount) {
          await maybeUpgradeStoredSummary();
        }

        const status = String((room.state && room.state.status) || '');
        if ((status === 'ended' || status === 'finished') && !S.controllerSummarySent) {
          await maybeUpgradeStoredSummary();
        }
      } catch (_) {}
    }, 650);

    clearInterval(S.liveWatchTimer);
    S.liveWatchTimer = setInterval(() => {
      const snap = loadJson(STORE_LIVE_ROOM, null) || loadJson(STORE_LIVE, null);
      if (!snap) return;
      if (snap.roomId && CTX.roomId && String(snap.roomId) !== String(CTX.roomId)) return;
      if (!S.lastLive) S.lastLive = snap;
    }, 1200);
  }

  function installLegacyBridge(){
    const legacy = {
      getCtx: () => Object.assign({}, runtimeCtx()),
      getCore: () => getCore(),
      getLastSummary: () =>
        S.lastControllerSummary ||
        S.lastSummary ||
        loadJson(STORE_LAST_COOP_ROOM, null) ||
        loadJson(STORE_LAST_COOP, null) ||
        null,
      forceControllerSummary: async () => {
        const summary = computeControllerSummaryFromResults();
        if (!summary) return null;
        await maybeSendControllerSummary(summary);
        return S.lastControllerSummary || summary;
      },
      persistSummary: (summary) => persistSummary(summary),
      normalizeSummary: (summary) => normalizeSummary(summary)
    };

    W.__GJ_COOP_CONTROLLER__ = legacy;
    W.GJ_COOP_CONTROLLER = legacy;
  }

  async function init(){
    await flushRuntime();
    maybeCreateRuntime();
    bindSummaryEvents();
    bindResultMountObserver();
    startControllerPolling();
    installLegacyBridge();

    const cached =
      loadJson(STORE_LAST_COOP_ROOM, null) ||
      loadJson(STORE_LAST_COOP, null) ||
      loadJson(STORE_LAST, null);

    if (cached) {
      S.lastSummary = normalizeSummary(cached);
    }

    await maybeUpgradeStoredSummary();
  }

  init().catch((err) => {
    console.warn('[goodjunk-coop-controller] init failed', err);
  });

  W.addEventListener('beforeunload', () => {
    clearInterval(S.roomPollTimer);
    clearInterval(S.liveWatchTimer);
  });
})();