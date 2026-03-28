/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.coop.js
 * FULL SAFE LAYER FOR COOP
 * ---------------------------------------------------------
 * Features:
 * - robust self detection (PID-first)
 * - coop HUD bridge
 * - team score / team goal / contribution / player count
 * - room/player bridge
 * - stable coop sorting
 * - fixed result table / rank badge
 * - no "guess first row as me"
 * - fallback result modal if existing result DOM is absent
 * - public API for legacy gameplay logic
 *
 * Public API:
 *   window.CoopSafe.setState(patch)
 *   window.CoopSafe.setRoomState(room)
 *   window.CoopSafe.setPlayers(players)
 *   window.CoopSafe.onJudge(judge)
 *   window.CoopSafe.setTeamProgress(detail)
 *   window.CoopSafe.finishGame(detail)
 *   window.CoopSafe.render()
 *   window.CoopSafe.getState()
 * ========================================================= */

(() => {
  if (window.__GJ_COOP_SAFE_LOADED__) return;
  window.__GJ_COOP_SAFE_LOADED__ = true;

  const LS_KEYS = {
    devicePid: 'GJ_DEVICE_PID',
    selfPidGlobal: 'GJ_COOP_SELF_PID',
    selfNameGlobal: 'GJ_COOP_SELF_NAME',
    selfPidByRoomPrefix: 'GJ_COOP_SELF_BY_ROOM:',
    selfNameByRoomPrefix: 'GJ_COOP_SELF_NAME_BY_ROOM:',
    lastSummaryScoped: 'HHA_LAST_SUMMARY:goodjunk-coop',
    lastSummaryGlobal: 'HHA_LAST_SUMMARY'
  };

  const REF = {
    hud: null,
    mode: null,
    room: null,
    score: null,
    time: null,
    miss: null,
    streak: null,

    teamScore: null,
    goal: null,
    teamFill: null,
    contribution: null,
    players: null,

    resultMount: null
  };

  const BRIDGE = {
    started: false,
    timer: null,
    resultShown: false,
    wrapped: false
  };

  const STATE = {
    pid: '',
    name: '',
    roomId: '-',

    score: 0,
    miss: 0,
    bestStreak: 0,
    timeLeftSec: 0,

    teamScore: 0,
    teamGoal: 360,
    contribution: 0,
    playersReady: 0,
    playerCount: 0,
    finalClear: false,

    helps: 0,
    stars: 0,

    players: [],
    room: null,

    ended: false,
    endedAt: '',
    endReason: ''
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function q(sel, root = document) {
    try { return root.querySelector(sel); } catch (_) { return null; }
  }

  function txt(v) {
    return String(v ?? '').trim();
  }

  function num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function int(v, d = 0) {
    return Math.round(num(v, d));
  }

  function esc(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function qsGet(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) ?? d;
    } catch (_) {
      return d;
    }
  }

  function parseNumText(v, d = 0) {
    const n = Number(String(v || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : d;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function pct(n, d) {
    const den = Math.max(1, num(d, 1));
    return clamp((num(n, 0) / den) * 100, 0, 100);
  }

  function readText(key) {
    try {
      return txt(localStorage.getItem(key));
    } catch (_) {
      return '';
    }
  }

  function writeText(key, value) {
    try {
      localStorage.setItem(key, txt(value));
    } catch (_) {}
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (_) {
      return '';
    }
  }

  function shortDateTime(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '-';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
    } catch (_) {
      return '-';
    }
  }

  function fmtClock(sec) {
    const s = Math.max(0, int(sec, 0));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }

  function setText(el, value) {
    if (el) el.textContent = String(value ?? '');
  }

  function setWidth(el, percent) {
    if (el) el.style.width = `${clamp(num(percent, 0), 0, 100)}%`;
  }

  function safeCall(fn, ...args) {
    try {
      if (typeof fn === 'function') return fn(...args);
    } catch (err) {
      console.warn('[coop-safe] safeCall error:', err);
    }
    return undefined;
  }

  function devicePid() {
    try {
      let pid = localStorage.getItem(LS_KEYS.devicePid);
      if (!pid) {
        pid = `p-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(LS_KEYS.devicePid, pid);
      }
      return pid;
    } catch (_) {
      return `p-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function normalizePid(raw) {
    const v = txt(raw).replace(/[.#$[\]/]/g, '-');
    if (!v) return '';
    if (v.toLowerCase() === 'anon') return '';
    return v;
  }

  function normalizeName(raw) {
    return txt(raw).replace(/\s+/g, ' ').slice(0, 64);
  }

  function currentRoomId() {
    const raw = txt(
      STATE.roomId ||
      STATE.room?.roomId ||
      STATE.room?.roomCode ||
      qsGet('roomId') ||
      qsGet('room') ||
      window.__COOP_ROOM__?.roomId ||
      window.__COOP_ROOM__?.roomCode ||
      window.coopRoom?.roomId ||
      window.coopRoom?.roomCode ||
      window.roomState?.roomId ||
      window.roomState?.roomCode ||
      window.state?.room?.roomId ||
      window.state?.room?.roomCode ||
      window.gameState?.room?.roomId ||
      window.gameState?.room?.roomCode
    );
    return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) || '-';
  }

  function getSelfPid() {
    return normalizePid(
      window.RUN_CTX?.pid ||
      window.RUN_CTX?.playerPid ||
      window.__GJ_CTX?.pid ||
      window.__COOP_SELF_PID__ ||
      qsGet('pid') ||
      readText(LS_KEYS.selfPidGlobal) ||
      devicePid()
    );
  }

  function getSelfName() {
    return normalizeName(
      window.RUN_CTX?.name ||
      window.RUN_CTX?.nick ||
      window.__GJ_CTX?.name ||
      window.__COOP_SELF_NAME__ ||
      qsGet('name') ||
      readText(LS_KEYS.selfNameGlobal)
    );
  }

  function rememberSelfIdentity() {
    const roomId = currentRoomId();
    const pid = getSelfPid();
    const name = getSelfName();

    if (pid) {
      window.__COOP_SELF_PID__ = pid;
      writeText(LS_KEYS.selfPidGlobal, pid);
      if (roomId && roomId !== '-') {
        writeText(`${LS_KEYS.selfPidByRoomPrefix}${roomId}`, pid);
      }
    }

    if (name) {
      window.__COOP_SELF_NAME__ = name;
      writeText(LS_KEYS.selfNameGlobal, name);
      if (roomId && roomId !== '-') {
        writeText(`${LS_KEYS.selfNameByRoomPrefix}${roomId}`, name);
      }
    }
  }

  function gatherKnownSelfPidSet(roomId = '') {
    const set = new Set();
    [
      getSelfPid(),
      normalizePid(qsGet('pid')),
      normalizePid(window.RUN_CTX?.pid),
      normalizePid(window.RUN_CTX?.playerPid),
      normalizePid(window.__GJ_CTX?.pid),
      normalizePid(readText(LS_KEYS.selfPidGlobal)),
      normalizePid(devicePid()),
      roomId ? normalizePid(readText(`${LS_KEYS.selfPidByRoomPrefix}${roomId}`)) : ''
    ].forEach(v => { if (v) set.add(v); });
    return set;
  }

  function gatherKnownSelfNameSet(roomId = '') {
    const set = new Set();
    [
      getSelfName(),
      normalizeName(qsGet('name')),
      normalizeName(window.RUN_CTX?.name),
      normalizeName(window.RUN_CTX?.nick),
      normalizeName(window.__GJ_CTX?.name),
      normalizeName(readText(LS_KEYS.selfNameGlobal)),
      roomId ? normalizeName(readText(`${LS_KEYS.selfNameByRoomPrefix}${roomId}`)) : ''
    ].forEach(v => { if (v) set.add(v); });
    return set;
  }

  function normalizePlayers(input) {
    const arr = Array.isArray(input)
      ? input
      : Array.isArray(input?.players)
        ? input.players
        : Object.values(input?.players || {});

    return arr.map((p, idx) => ({
      pid: normalizePid(p?.pid || p?.playerId || p?.id || `p${idx + 1}`),
      name: normalizeName(p?.name || p?.nick || p?.playerName || p?.displayName || `Player ${idx + 1}`),
      score: int(p?.score ?? p?.contribution ?? 0, 0),
      contribution: int(p?.contribution ?? p?.score ?? 0, 0),
      miss: int(p?.miss ?? p?.misses ?? 0, 0),
      bestStreak: int(p?.bestStreak ?? p?.comboMax ?? p?.streak ?? 0, 0),
      helps: int(p?.helps ?? p?.supportCount ?? 0, 0),
      stars: int(p?.stars ?? 0, 0),
      ready: !!p?.ready,
      finished: !!p?.finished,
      isHost: !!p?.isHost,
      raw: p || {}
    }));
  }

  function sortCoopPlayers(players) {
    return [...players].sort((a, b) => {
      if (b.contribution !== a.contribution) return b.contribution - a.contribution;
      if (b.score !== a.score) return b.score - a.score;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      if (b.helps !== a.helps) return b.helps - a.helps;
      return a.name.localeCompare(b.name, 'th');
    });
  }

  function resolveSelfPlayer(players, roomId = '') {
    const knownPids = gatherKnownSelfPidSet(roomId);
    const knownNames = gatherKnownSelfNameSet(roomId);

    let self = players.find(p => p.pid && knownPids.has(p.pid));
    if (self) return self;

    const matchedByName = players.filter(p => p.name && knownNames.has(p.name));
    if (matchedByName.length === 1) return matchedByName[0];

    return null;
  }

  function bindNodes() {
    REF.hud = byId('coopHud') || byId('hudCoop') || byId('coopHUD');

    REF.mode = byId('coopModePill') || byId('coopModeValue');
    REF.room = byId('coopRoomPill') || byId('coopRoomValue');
    REF.score = byId('coopScoreValue') || byId('scoreValue');
    REF.time = byId('coopTimeValue') || byId('timeValue');
    REF.miss = byId('coopMissValue') || byId('missValue');
    REF.streak = byId('coopStreakValue') || byId('bestStreakValue');

    REF.teamScore = byId('coopTeamScoreValue') || byId('teamScoreValue');
    REF.goal = byId('coopGoalValue') || byId('teamGoalValue') || byId('goalValue');
    REF.teamFill = byId('coopTeamFill') || byId('teamProgressFill') || byId('goalFill');
    REF.contribution = byId('coopContributionValue') || byId('contributionValue');
    REF.players = byId('coopPlayersValue') || byId('playersValue');

    ensureResultMount();
  }

  function ensureResultMount() {
    let mount = byId('coopSafeResultMount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'coopSafeResultMount';
      mount.hidden = true;
      mount.style.position = 'fixed';
      mount.style.inset = '0';
      mount.style.zIndex = '1400';
      mount.style.alignItems = 'flex-end';
      mount.style.justifyContent = 'center';
      mount.style.padding = '12px';
      mount.style.background = 'rgba(2,6,23,.66)';
      mount.style.backdropFilter = 'blur(8px)';
      mount.style.display = 'none';
      document.body.appendChild(mount);
    }
    REF.resultMount = mount;
    return mount;
  }

  function recalcState() {
    STATE.pid = getSelfPid();
    STATE.name = getSelfName();
    STATE.roomId = currentRoomId();

    const players = normalizePlayers(STATE.players);
    if (players.length) {
      const sorted = sortCoopPlayers(players);
      const self = resolveSelfPlayer(sorted, STATE.roomId);

      STATE.players = sorted;
      STATE.playerCount = sorted.length;
      STATE.playersReady = sorted.filter(p => p.ready).length;

      if (self) {
        STATE.score = self.score;
        STATE.contribution = self.contribution;
        STATE.miss = self.miss;
        STATE.bestStreak = self.bestStreak;
        STATE.helps = self.helps;
        STATE.stars = self.stars;
      }

      const sumContribution = sorted.reduce((sum, p) => sum + int(p.contribution, 0), 0);
      const sumScore = sorted.reduce((sum, p) => sum + int(p.score, 0), 0);
      STATE.teamScore = Math.max(sumContribution, sumScore, int(STATE.teamScore, 0));
    } else {
      STATE.score = int(STATE.score, 0);
      STATE.contribution = int(STATE.contribution || STATE.score, 0);
      STATE.miss = int(STATE.miss, 0);
      STATE.bestStreak = int(STATE.bestStreak, 0);
      STATE.teamScore = int(STATE.teamScore || STATE.score, 0);
      STATE.teamGoal = Math.max(1, int(STATE.teamGoal, 360));
      STATE.playersReady = int(STATE.playersReady, 0);
      STATE.playerCount = Math.max(int(STATE.playerCount, 0), 0);
      STATE.helps = int(STATE.helps, 0);
      STATE.stars = int(STATE.stars, 0);
      STATE.players = [];
    }

    STATE.teamGoal = Math.max(1, int(STATE.teamGoal, 360));
    STATE.finalClear = STATE.teamScore >= STATE.teamGoal || !!STATE.finalClear;

    window.__COOP_STATE__ = STATE;
    if (STATE.room) window.__COOP_ROOM__ = STATE.room;
  }

  function renderHud() {
    recalcState();

    setText(REF.mode, 'MODE coop');
    setText(REF.room, `ROOM ${STATE.roomId}`);
    setText(REF.score, STATE.score);
    setText(REF.time, fmtClock(STATE.timeLeftSec));
    setText(REF.miss, STATE.miss);
    setText(REF.streak, STATE.bestStreak);

    setText(REF.teamScore, STATE.teamScore);
    setText(REF.goal, STATE.teamGoal);
    setWidth(REF.teamFill, pct(STATE.teamScore, STATE.teamGoal));

    setText(REF.contribution, STATE.contribution);
    setText(REF.players, `${STATE.playerCount}`);
  }

  function findExistingResultRoot() {
    return (
      q('#coopResultMount:not([hidden])') ||
      q('#coopResult:not([hidden])') ||
      q('.coop-result-card') ||
      q('.coop-result') ||
      q('[data-coop-result]')
    );
  }

  function findResultTbody(root) {
    return (
      q('#coopResultTable tbody', root) ||
      q('.coop-result-table tbody', root) ||
      q('[data-coop-result-table] tbody', root) ||
      q('tbody', root)
    );
  }

  function findRankBadge(root) {
    return (
      q('#coopRankBadge', root) ||
      q('.coop-rank-badge', root) ||
      q('[data-coop-rank-badge]', root)
    );
  }

  function findResultSubtitle(root) {
    return (
      q('.coop-result-sub', root) ||
      q('[data-coop-result-sub]', root)
    );
  }

  function buildSummary() {
    recalcState();

    const players = sortCoopPlayers(normalizePlayers(STATE.players));
    const self = resolveSelfPlayer(players, STATE.roomId);
    const selfIndex = self ? players.findIndex(p => p.pid === self.pid) : -1;
    const selfRank = selfIndex >= 0 ? selfIndex + 1 : null;

    return {
      game: 'goodjunk-coop',
      mode: 'coop',
      pid: getSelfPid(),
      name: getSelfName(),
      roomId: STATE.roomId,

      scoreFinal: STATE.score,
      contribution: STATE.contribution,
      missTotal: STATE.miss,
      comboMax: STATE.bestStreak,

      teamScore: STATE.teamScore,
      teamGoal: STATE.teamGoal,
      finalClear: STATE.finalClear,
      playersReady: STATE.playersReady,
      playerCount: STATE.playerCount,

      helps: STATE.helps,
      stars: STATE.stars,

      players,
      self,
      selfRank,
      selfKnown: !!self,

      endedAt: STATE.endedAt || nowIso(),
      endReason: STATE.endReason || 'finished',
      timestampIso: nowIso()
    };
  }

  function saveLastSummary(summary) {
    try {
      writeJSON(`${LS_KEYS.lastSummaryScoped}:${summary.pid}`, summary);
      writeJSON(LS_KEYS.lastSummaryGlobal, summary);
    } catch (_) {}
  }

  function renderRowsHTML(summary) {
    return summary.players.map((p, idx) => {
      const isMe = summary.self && p.pid === summary.self.pid;
      return `
        <tr class="${isMe ? 'me-row' : ''}">
          <td>
            <div style="font-weight:1100;line-height:1.1">${esc(p.name || p.pid || `Player ${idx + 1}`)}</div>
            ${p.pid ? `<div style="margin-top:4px;color:#94a3b8;font-size:12px;font-weight:900">${esc(p.pid)}</div>` : ''}
            ${isMe ? `<div style="margin-top:6px;color:#c4b5fd;font-size:12px;font-weight:1100">• คุณ</div>` : ''}
            <div style="margin-top:4px;color:#86efac;font-size:12px;font-weight:1100">
              ${p.finished ? 'รอบนี้จบแล้ว' : 'ส่งคะแนนแล้ว'}
            </div>
          </td>
          <td>${p.contribution}</td>
          <td>${p.miss}</td>
          <td>${p.bestStreak}</td>
          <td>${p.helps}</td>
        </tr>
      `;
    }).join('');
  }

  function patchExistingResultDOM(summary) {
    const root = findExistingResultRoot();
    if (!root) return false;

    const badge = findRankBadge(root);
    if (badge) {
      if (!summary.selfKnown || !summary.selfRank) {
        badge.textContent = 'อันดับ ?';
        badge.style.opacity = '.72';
      } else {
        badge.textContent = `อันดับ #${summary.selfRank}`;
        badge.style.opacity = '1';
      }
    }

    const sub = findResultSubtitle(root);
    if (sub) {
      sub.textContent = `ผลสุดท้าย • ผู้เล่นทั้งหมด ${summary.players.length} คน`;
    }

    const tbody = findResultTbody(root);
    if (tbody) {
      tbody.innerHTML = renderRowsHTML(summary);
    }

    return true;
  }

  function buildCoopLobbyUrl() {
    const src = new URL(location.href);
    const u = new URL('./goodjunk-coop-lobby.html', location.href);

    [
      'hub','pid','name','room','roomId','diff','time','seed','view','run',
      'zone','studyId','phase','conditionGroup','sessionOrder','blockLabel',
      'siteCode','schoolYear','semester','api','log','debug'
    ].forEach(k => {
      const v = src.searchParams.get(k);
      if (v != null && v !== '') u.searchParams.set(k, v);
    });

    u.searchParams.set('roomId', currentRoomId());
    return u.toString();
  }

  function mountFallbackResult(summary) {
    const mount = ensureResultMount();
    if (!mount) return;

    mount.hidden = false;
    mount.style.display = 'flex';

    mount.innerHTML = `
      <div style="
        width:min(980px,100%);
        max-height:min(92vh,920px);
        overflow:auto;
        border-radius:28px;
        border:1px solid rgba(148,163,184,.18);
        background:linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.96));
        color:#f8fafc;
        box-shadow:0 24px 80px rgba(0,0,0,.42);
        padding:18px;
      ">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
          <div>
            <div style="font-size:24px;line-height:1.15;font-weight:1100;">🤝 Coop Result</div>
            <div style="margin-top:6px;color:#94a3b8;font-size:13px;font-weight:900;line-height:1.45;">
              ROOM ${esc(summary.roomId)} • ${esc(shortDateTime(summary.endedAt))}
            </div>
          </div>
          <button id="coopSafeCloseBtn" type="button" style="
            min-width:44px;min-height:44px;padding:8px 12px;border-radius:14px;
            border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.04);
            color:#e5e7eb;font-weight:1100;cursor:pointer;">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1.1fr .9fr;gap:12px;margin-bottom:14px;">
          <div style="
            border-radius:22px;border:1px solid rgba(148,163,184,.16);
            background:rgba(15,23,42,.72);padding:14px;">
            <div style="color:#cbd5e1;font-size:13px;font-weight:1000;">TEAM SCORE</div>
            <div style="margin-top:8px;font-size:42px;line-height:1;font-weight:1100;color:#f8fafc;">${summary.teamScore}</div>

            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px;">
              <div style="border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.42);padding:10px 12px;">
                <div style="color:#94a3b8;font-size:12px;font-weight:1000;">MY SCORE</div>
                <div style="margin-top:4px;font-size:22px;line-height:1;font-weight:1100;">${summary.scoreFinal}</div>
              </div>
              <div style="border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.42);padding:10px 12px;">
                <div style="color:#94a3b8;font-size:12px;font-weight:1000;">CONTRIB</div>
                <div style="margin-top:4px;font-size:22px;line-height:1;font-weight:1100;">${summary.contribution}</div>
              </div>
              <div style="border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.42);padding:10px 12px;">
                <div style="color:#94a3b8;font-size:12px;font-weight:1000;">HELPS</div>
                <div style="margin-top:4px;font-size:22px;line-height:1;font-weight:1100;">${summary.helps}</div>
              </div>
            </div>
          </div>

          <div style="
            border-radius:22px;border:1px solid rgba(148,163,184,.16);
            background:rgba(15,23,42,.72);padding:14px;display:flex;flex-direction:column;justify-content:center;gap:12px;">
            <div style="
              display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:18px;
              border:1px solid rgba(139,92,246,.24);background:rgba(139,92,246,.12);
              color:#c4b5fd;font-size:18px;font-weight:1100;width:max-content;">
              ${summary.selfKnown && summary.selfRank ? `อันดับ #${summary.selfRank}` : 'อันดับ ?'}
            </div>

            <div style="color:#cbd5e1;font-size:13px;font-weight:1000;">Team goal ${summary.teamGoal}</div>
            <div style="color:#cbd5e1;font-size:13px;font-weight:1000;">Players ${summary.playerCount}</div>
            <div style="color:${summary.finalClear ? '#86efac' : '#fca5a5'};font-size:13px;font-weight:1100;">
              ${summary.finalClear ? 'ทีมทำเป้าหมายสำเร็จ' : 'ทีมยังไม่ถึงเป้าหมาย'}
            </div>
          </div>
        </div>

        <div style="
          border-radius:22px;border:1px solid rgba(148,163,184,.16);
          background:rgba(15,23,42,.66);padding:12px;">
          <div style="overflow:auto;-webkit-overflow-scrolling:touch;">
            <table style="width:100%;min-width:760px;border-collapse:separate;border-spacing:0 8px;">
              <thead>
                <tr>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">ผู้เล่น</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">Contribution</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">Miss</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">Best Streak</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">Helps</th>
                </tr>
              </thead>
              <tbody>
                ${summary.players.map((p) => {
                  const isMe = summary.self && p.pid === summary.self.pid;
                  const bg = isMe ? 'rgba(30,41,59,.78)' : 'rgba(2,6,23,.42)';
                  const outline = isMe ? 'outline:1px solid rgba(139,92,246,.26);' : '';
                  return `
                    <tr>
                      <td style="padding:12px 10px;background:${bg};${outline}border-top-left-radius:14px;border-bottom-left-radius:14px;">
                        <div style="font-weight:1100;line-height:1.1">${esc(p.name || p.pid)}</div>
                        ${p.pid ? `<div style="margin-top:4px;color:#94a3b8;font-size:12px;font-weight:900">${esc(p.pid)}</div>` : ''}
                        ${isMe ? `<div style="margin-top:6px;color:#c4b5fd;font-size:12px;font-weight:1100">• คุณ</div>` : ''}
                        <div style="margin-top:4px;color:#86efac;font-size:12px;font-weight:1100">
                          ${p.finished ? 'รอบนี้จบแล้ว' : 'ส่งคะแนนแล้ว'}
                        </div>
                      </td>
                      <td style="padding:12px 10px;background:${bg};${outline}">${p.contribution}</td>
                      <td style="padding:12px 10px;background:${bg};${outline}">${p.miss}</td>
                      <td style="padding:12px 10px;background:${bg};${outline}">${p.bestStreak}</td>
                      <td style="padding:12px 10px;background:${bg};${outline}border-top-right-radius:14px;border-bottom-right-radius:14px;">${p.helps}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
          <button id="coopSafeRematchBtn" type="button" style="
            min-width:140px;min-height:46px;padding:10px 14px;border-radius:16px;
            border:1px solid rgba(34,197,94,.28);background:rgba(34,197,94,.14);
            color:#f8fafc;font-weight:1100;cursor:pointer;">🔁 เล่นใหม่</button>

          <button id="coopSafeHubBtn" type="button" style="
            min-width:140px;min-height:46px;padding:10px 14px;border-radius:16px;
            border:1px solid rgba(59,130,246,.28);background:rgba(59,130,246,.14);
            color:#f8fafc;font-weight:1100;cursor:pointer;">🏠 กลับ HUB</button>

          <button id="coopSafeCloseBtn2" type="button" style="
            min-width:140px;min-height:46px;padding:10px 14px;border-radius:16px;
            border:1px solid rgba(167,139,250,.28);background:rgba(167,139,250,.14);
            color:#f8fafc;font-weight:1100;cursor:pointer;">✅ ปิด</button>
        </div>
      </div>
    `;

    const close = () => {
      mount.hidden = true;
      mount.style.display = 'none';
      mount.innerHTML = '';
    };

    byId('coopSafeCloseBtn')?.addEventListener('click', close);
    byId('coopSafeCloseBtn2')?.addEventListener('click', close);
    byId('coopSafeHubBtn')?.addEventListener('click', () => {
      location.href = qsGet('hub', '../hub.html');
    });
    byId('coopSafeRematchBtn')?.addEventListener('click', () => {
      location.href = buildCoopLobbyUrl();
    });
  }

  function mergeState(patch = {}) {
    const src = patch || {};

    STATE.pid = normalizePid(src.pid ?? STATE.pid ?? getSelfPid());
    STATE.name = normalizeName(src.name ?? src.nick ?? STATE.name ?? getSelfName());
    STATE.roomId = txt(src.roomId ?? src.room ?? src.roomCode ?? STATE.roomId ?? currentRoomId()) || '-';

    if (src.room && typeof src.room === 'object') {
      STATE.room = src.room;
    }

    STATE.score = int(src.score ?? src.myScore ?? STATE.score, 0);
    STATE.miss = int(src.miss ?? src.misses ?? STATE.miss, 0);
    STATE.bestStreak = int(src.bestStreak ?? src.comboMax ?? src.streak ?? STATE.bestStreak, 0);
    STATE.timeLeftSec = int(src.timeLeftSec ?? src.timeLeft ?? STATE.timeLeftSec, 0);

    STATE.teamScore = int(src.teamScore ?? src.scoreTeam ?? STATE.teamScore, 0);
    STATE.teamGoal = Math.max(1, int(src.teamGoal ?? src.goal ?? STATE.teamGoal, 360));
    STATE.contribution = int(src.contribution ?? src.myContribution ?? src.score ?? STATE.contribution, 0);
    STATE.playersReady = int(src.playersReady ?? STATE.playersReady, 0);
    STATE.playerCount = int(src.playerCount ?? STATE.playerCount, 0);
    STATE.finalClear = !!(src.finalClear ?? src.goalReached ?? STATE.finalClear);

    STATE.helps = int(src.helps ?? src.supportCount ?? STATE.helps, 0);
    STATE.stars = int(src.stars ?? STATE.stars, 0);

    if (Array.isArray(src.players)) {
      STATE.players = normalizePlayers(src.players);
    } else if (src.players && typeof src.players === 'object') {
      STATE.players = normalizePlayers(src.players);
    }

    STATE.ended = !!(src.ended ?? src.finished ?? src.isEnded ?? STATE.ended);
    STATE.endedAt = txt(src.endedAt ?? src.timestampIso ?? src.finishedAt ?? STATE.endedAt);
    STATE.endReason = txt(src.endReason ?? src.reason ?? STATE.endReason);

    window.__COOP_STATE__ = STATE;
    if (STATE.room) window.__COOP_ROOM__ = STATE.room;

    rememberSelfIdentity();
    recalcState();
  }

  function setRoomState(room) {
    if (!room || typeof room !== 'object') return;
    STATE.room = room;
    STATE.roomId = txt(room.roomId || room.roomCode || room.id || STATE.roomId || '-');
    STATE.players = normalizePlayers(room.players || room);
    if (room.teamGoal != null || room.goal != null) {
      STATE.teamGoal = Math.max(1, int(room.teamGoal ?? room.goal, STATE.teamGoal));
    }
    if (room.teamScore != null || room.scoreTeam != null) {
      STATE.teamScore = int(room.teamScore ?? room.scoreTeam, STATE.teamScore);
    }
    window.__COOP_ROOM__ = room;
    rememberSelfIdentity();
    renderHud();
  }

  function setPlayers(players) {
    STATE.players = normalizePlayers(players);
    rememberSelfIdentity();
    renderHud();
  }

  function onJudge(judge = {}) {
    if (judge.score != null) STATE.score = int(judge.score, STATE.score);
    if (judge.contribution != null) STATE.contribution = int(judge.contribution, STATE.contribution);
    if (judge.miss != null) STATE.miss = int(judge.miss, STATE.miss);
    if (judge.bestStreak != null) STATE.bestStreak = int(judge.bestStreak, STATE.bestStreak);
    if (judge.teamScore != null) STATE.teamScore = int(judge.teamScore, STATE.teamScore);
    renderHud();
  }

  function setTeamProgress(detail = {}) {
    if (detail.teamScore != null || detail.scoreTeam != null) {
      STATE.teamScore = int(detail.teamScore ?? detail.scoreTeam, STATE.teamScore);
    }
    if (detail.teamGoal != null || detail.goal != null) {
      STATE.teamGoal = Math.max(1, int(detail.teamGoal ?? detail.goal, STATE.teamGoal));
    }
    if (detail.playerCount != null) {
      STATE.playerCount = int(detail.playerCount, STATE.playerCount);
    }
    if (detail.playersReady != null) {
      STATE.playersReady = int(detail.playersReady, STATE.playersReady);
    }
    if (detail.finalClear != null || detail.goalReached != null) {
      STATE.finalClear = !!(detail.finalClear ?? detail.goalReached);
    } else {
      STATE.finalClear = STATE.teamScore >= STATE.teamGoal;
    }
    renderHud();
  }

  function finishGame(detail = {}) {
    if (BRIDGE.resultShown) return;

    mergeState({
      ...detail,
      ended: true,
      endedAt: detail.endedAt || detail.timestampIso || nowIso(),
      endReason: detail.endReason || detail.reason || 'finished'
    });

    const summary = buildSummary();
    saveLastSummary(summary);

    if (window.__GJ_COOP_RUN_HAS_SUMMARY_OVERLAY__) {
      BRIDGE.resultShown = true;
      STATE.ended = true;
      stopBridge();
      return;
    }

    const patchedExisting = patchExistingResultDOM(summary);
    if (!patchedExisting) {
      mountFallbackResult(summary);
    }

    BRIDGE.resultShown = true;
    STATE.ended = true;
    stopBridge();
  }

  function render() {
    renderHud();
    if (BRIDGE.resultShown) {
      patchExistingResultDOM(buildSummary());
    }
  }

  function getState() {
    return JSON.parse(JSON.stringify(STATE));
  }

  function readKnownGlobals() {
    const candidates = [
      window.state,
      window.gameState,
      window.__COOP_STATE__,
      window.RUN_CTX,
      window.__GJ_CTX
    ].filter(Boolean);

    for (const src of candidates) {
      if (src && typeof src === 'object') mergeState(src);
    }

    const roomCandidates = [
      window.__COOP_ROOM__,
      window.coopRoom,
      window.roomState,
      window.state?.room,
      window.gameState?.room
    ].filter(Boolean);

    for (const room of roomCandidates) {
      if (room && typeof room === 'object') {
        setRoomState(room);
        break;
      }
    }
  }

  function readLegacyDom() {
    const score =
      parseNumText(txt(q('#scoreValue')?.textContent)) ||
      parseNumText(txt(q('.score-value')?.textContent)) ||
      parseNumText(txt(q('[data-score]')?.textContent)) ||
      STATE.score;

    const miss =
      parseNumText(txt(q('#missValue')?.textContent)) ||
      parseNumText(txt(q('.miss-value')?.textContent)) ||
      parseNumText(txt(q('[data-miss]')?.textContent)) ||
      STATE.miss;

    const bestStreak =
      parseNumText(txt(q('#bestStreakValue')?.textContent)) ||
      parseNumText(txt(q('.best-streak-value')?.textContent)) ||
      parseNumText(txt(q('[data-best-streak]')?.textContent)) ||
      STATE.bestStreak;

    const teamScore =
      parseNumText(txt(q('#teamScoreValue')?.textContent)) ||
      parseNumText(txt(q('.team-score-value')?.textContent)) ||
      STATE.teamScore;

    const goal =
      parseNumText(txt(q('#goalValue')?.textContent)) ||
      parseNumText(txt(q('.goal-value')?.textContent)) ||
      STATE.teamGoal;

    const contribution =
      parseNumText(txt(q('#contributionValue')?.textContent)) ||
      parseNumText(txt(q('.contribution-value')?.textContent)) ||
      STATE.contribution;

    const timerText =
      txt(q('#timeValue')?.textContent) ||
      txt(q('.time-value')?.textContent) ||
      '';

    let timeLeftSec = STATE.timeLeftSec;
    if (timerText.includes(':')) {
      const parts = timerText.split(':').map(v => Number(v || 0));
      if (parts.length === 2) timeLeftSec = (parts[0] * 60) + parts[1];
    } else if (timerText) {
      timeLeftSec = parseNumText(timerText, STATE.timeLeftSec);
    }

    mergeState({
      score,
      miss,
      bestStreak,
      teamScore,
      teamGoal: goal,
      contribution,
      finalClear: teamScore >= Math.max(1, goal),
      timeLeftSec
    });
  }

  function tickTimeFromEndsAt() {
    const s = window.state || window.gameState || window.__COOP_STATE__ || {};
    const endsAtMs = num(s.endsAtMs || s.endAtMs || 0, 0);
    if (endsAtMs > 0 && !STATE.ended) {
      STATE.timeLeftSec = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
    }
  }

  function bridgeLoop() {
    try {
      installEndHooks();
      readKnownGlobals();
      readLegacyDom();
      tickTimeFromEndsAt();
      renderHud();

      const s = window.state || window.gameState || window.__COOP_STATE__ || {};
      const ended =
        !!STATE.ended ||
        !!s.isEnded ||
        !!s.ended ||
        !!s.finished ||
        !!s.showSummary ||
        !!s.showResult ||
        (num(s.endsAtMs || s.endAtMs || 0, 0) > 0 && Date.now() > num(s.endsAtMs || s.endAtMs || 0, 0) + 300);

      if (ended && !BRIDGE.resultShown) {
        finishGame({ reason: s.reason || 'finished' });
      }

      if (BRIDGE.resultShown) {
        patchExistingResultDOM(buildSummary());
      }
    } catch (err) {
      console.warn('[coop-safe] bridgeLoop error:', err);
    }
  }

  function startBridge() {
    if (BRIDGE.started) return;
    BRIDGE.started = true;
    bridgeLoop();
    BRIDGE.timer = setInterval(bridgeLoop, 120);
  }

  function stopBridge() {
    if (BRIDGE.timer) {
      clearInterval(BRIDGE.timer);
      BRIDGE.timer = null;
    }
  }

  function wrapEndFunction(obj, key) {
    try {
      if (!obj || typeof obj[key] !== 'function') return false;
      if (obj[key].__coopWrapped) return true;

      const original = obj[key];
      const wrapped = function (...args) {
        const out = original.apply(this, args);
        try {
          finishGame({ reason: key });
        } catch (err) {
          console.warn(`[coop-safe] wrapped end fn error for ${key}:`, err);
        }
        return out;
      };
      wrapped.__coopWrapped = true;
      wrapped.__coopOriginal = original;
      obj[key] = wrapped;
      return true;
    } catch (err) {
      console.warn(`[coop-safe] wrapEndFunction failed for ${key}:`, err);
      return false;
    }
  }

  function installEndHooks() {
    const keys = [
      'showCoopResult',
      'openCoopResult',
      'renderCoopResult',
      'finishGame',
      'endGame',
      'showSummary',
      'showResult',
      'openResult'
    ];

    let wrappedAny = false;
    for (const key of keys) {
      if (wrapEndFunction(window, key)) wrappedAny = true;
    }
    if (wrappedAny) BRIDGE.wrapped = true;
  }

  function installCustomEventHooks() {
    if (window.__COOP_SAFE_EVENTS_BOUND__) return;
    window.__COOP_SAFE_EVENTS_BOUND__ = true;

    const on = (name, fn) => window.addEventListener(name, (ev) => {
      try {
        fn(ev?.detail || {});
      } catch (err) {
        console.warn(`[coop-safe] custom event ${name} error:`, err);
      }
    });

    on('coop:update', detail => {
      mergeState(detail);
      renderHud();
    });

    on('coop:room', detail => {
      setRoomState(detail);
    });

    on('coop:players', detail => {
      setPlayers(detail.players || detail);
    });

    on('coop:judge', detail => {
      onJudge(detail);
    });

    on('coop:team', detail => {
      setTeamProgress(detail);
    });

    on('coop:finish', detail => {
      finishGame(detail);
    });

    on('hha:coop:update', detail => {
      mergeState(detail);
      renderHud();
    });

    on('hha:coop:finish', detail => {
      finishGame(detail);
    });
  }

  function ensureBoot() {
    bindNodes();
    rememberSelfIdentity();
    installEndHooks();
    installCustomEventHooks();
    mergeState({
      pid: getSelfPid(),
      name: getSelfName(),
      roomId: currentRoomId()
    });
    renderHud();
    startBridge();
  }

  const API = {
    setState(patch) {
      mergeState(patch);
      renderHud();
    },
    setRoomState(room) {
      setRoomState(room);
    },
    setPlayers(players) {
      setPlayers(players);
    },
    onJudge(judge) {
      onJudge(judge);
    },
    setTeamProgress(detail) {
      setTeamProgress(detail);
    },
    finishGame(detail) {
      finishGame(detail);
    },
    render() {
      render();
    },
    getState() {
      return getState();
    }
  };

  window.CoopSafe = API;
  window.__COOP_STATE__ = STATE;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBoot, { once: true });
  } else {
    ensureBoot();
  }
})();