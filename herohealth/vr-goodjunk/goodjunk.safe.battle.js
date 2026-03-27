/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.battle.js
 * FULL SAFE LAYER FOR BATTLE
 * ---------------------------------------------------------
 * Features:
 * - robust self detection (PID / UID / playerId / key)
 * - new schema aware: rooms/{roomId}/{meta,state,players}
 * - preserves player key when players is an object map
 * - battle HUD bridge
 * - HP / attack charge / ready state
 * - stable battle sorting
 * - fixed result table / rank badge
 * - no "guess first row as me"
 * - fallback result modal if existing result DOM is absent
 * - emits summary events for battle run shell
 *
 * Public API:
 *   window.BattleSafe.setState(patch)
 *   window.BattleSafe.setRoomState(room)
 *   window.BattleSafe.setPlayers(players)
 *   window.BattleSafe.onJudge(judge)
 *   window.BattleSafe.onDamage(detail)
 *   window.BattleSafe.onAttackCharge(detail)
 *   window.BattleSafe.finishGame(detail)
 *   window.BattleSafe.render()
 *   window.BattleSafe.getState()
 * ========================================================= */

(() => {
  if (window.__GJ_BATTLE_SAFE_LOADED__) return;
  window.__GJ_BATTLE_SAFE_LOADED__ = true;

  const BOOT = window.HHA_BATTLE_BOOT || window.__GJ_BATTLE_BOOT__ || null;
  const RUN_CTX = window.__GJ_RUN_CTX__ || window.__GJ_MULTI_RUN_CTX__ || window.RUN_CTX || null;
  const DEBUG = (
    String(new URL(location.href).searchParams.get('debug') || '0') === '1' ||
    String(new URL(location.href).searchParams.get('battleDebug') || '0') === '1'
  );

  const LS_KEYS = {
    devicePid: 'GJ_DEVICE_PID',
    selfPidGlobal: 'GJ_BATTLE_SELF_PID',
    selfNameGlobal: 'GJ_BATTLE_SELF_NAME',
    selfPidByRoomPrefix: 'GJ_BATTLE_SELF_BY_ROOM:',
    selfNameByRoomPrefix: 'GJ_BATTLE_SELF_NAME_BY_ROOM:',
    lastSummaryScoped: 'HHA_LAST_SUMMARY:goodjunk-battle',
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
    hp: null,
    hpFill: null,
    charge: null,
    chargeFill: null,
    attackReady: null,
    resultMount: null
  };

  const BRIDGE = {
    started: false,
    timer: null,
    resultShown: false,
    wrapped: false,
    summaryEmitted: false
  };

  const STATE = {
    pid: '',
    name: '',
    roomId: '-',

    score: 0,
    miss: 0,
    bestStreak: 0,
    timeLeftSec: 0,

    hp: 100,
    maxHp: 100,
    shield: 0,

    attackCharge: 0,
    maxAttackCharge: 100,
    attackReady: false,
    attacksUsed: 0,
    damageDealt: 0,
    damageTaken: 0,
    koCount: 0,

    players: [],
    room: null,
    roomMeta: null,
    roomState: null,

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
      console.warn('[battle-safe] safeCall error:', err);
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
    return v.slice(0, 80);
  }

  function normalizeName(raw) {
    return txt(raw).replace(/\s+/g, ' ').slice(0, 64);
  }

  function normalizeRoomId(raw) {
    return txt(raw)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 24);
  }

  function roomIdCandidates(raw) {
    const exact = normalizeRoomId(raw);
    const compact = exact.replace(/[^A-Z0-9]/g, '');
    const out = [];

    function push(v) {
      v = normalizeRoomId(v);
      if (!v) return;
      if (!out.includes(v)) out.push(v);
    }

    push(exact);
    push(compact);

    if (/^GJB[A-Z0-9]{5,8}$/.test(compact)) {
      push(`GJB-${compact.slice(3)}`);
    }
    if (/^GJB-[A-Z0-9]{5,8}$/.test(exact)) {
      push(exact.replace('-', ''));
    }

    if (/^GJ[A-Z0-9]{5,10}$/.test(compact)) {
      push(compact);
    }

    return out;
  }

  function currentRoomId() {
    const raw = txt(
      STATE.roomId ||
      STATE.room?.roomId ||
      STATE.room?.id ||
      STATE.roomMeta?.roomId ||
      BOOT?.roomId ||
      BOOT?.room ||
      RUN_CTX?.roomId ||
      RUN_CTX?.room ||
      qsGet('roomId') ||
      qsGet('room') ||
      window.__BATTLE_ROOM__?.roomId ||
      window.__BATTLE_ROOM__?.id ||
      window.battleRoom?.roomId ||
      window.roomState?.roomId ||
      window.state?.room?.roomId ||
      window.gameState?.room?.roomId
    );

    const candidates = roomIdCandidates(raw);
    return candidates[0] || '-';
  }

  function getSelfPid() {
    return normalizePid(
      BOOT?.uid ||
      BOOT?.playerId ||
      BOOT?.pid ||
      RUN_CTX?.uid ||
      RUN_CTX?.playerId ||
      RUN_CTX?.pid ||
      window.RUN_CTX?.pid ||
      window.RUN_CTX?.playerPid ||
      window.RUN_CTX?.uid ||
      window.__GJ_CTX?.pid ||
      window.__GJ_CTX?.uid ||
      window.__BATTLE_SELF_PID__ ||
      qsGet('uid') ||
      qsGet('playerId') ||
      qsGet('pid') ||
      readText(LS_KEYS.selfPidGlobal) ||
      devicePid()
    );
  }

  function getSelfName() {
    return normalizeName(
      BOOT?.name ||
      BOOT?.nick ||
      RUN_CTX?.name ||
      RUN_CTX?.nick ||
      window.RUN_CTX?.name ||
      window.RUN_CTX?.nick ||
      window.__GJ_CTX?.name ||
      window.__BATTLE_SELF_NAME__ ||
      qsGet('name') ||
      qsGet('nick') ||
      readText(LS_KEYS.selfNameGlobal)
    );
  }

  function rememberSelfIdentity() {
    const roomId = currentRoomId();
    const pid = getSelfPid();
    const name = getSelfName();

    if (pid) {
      window.__BATTLE_SELF_PID__ = pid;
      writeText(LS_KEYS.selfPidGlobal, pid);
      if (roomId && roomId !== '-') {
        writeText(`${LS_KEYS.selfPidByRoomPrefix}${roomId}`, pid);
      }
    }

    if (name) {
      window.__BATTLE_SELF_NAME__ = name;
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
      normalizePid(BOOT?.uid),
      normalizePid(BOOT?.playerId),
      normalizePid(BOOT?.pid),
      normalizePid(RUN_CTX?.uid),
      normalizePid(RUN_CTX?.playerId),
      normalizePid(RUN_CTX?.pid),
      normalizePid(qsGet('uid')),
      normalizePid(qsGet('playerId')),
      normalizePid(qsGet('pid')),
      normalizePid(window.RUN_CTX?.pid),
      normalizePid(window.RUN_CTX?.playerPid),
      normalizePid(window.RUN_CTX?.uid),
      normalizePid(window.__GJ_CTX?.pid),
      normalizePid(window.__GJ_CTX?.uid),
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
      normalizeName(BOOT?.name),
      normalizeName(BOOT?.nick),
      normalizeName(RUN_CTX?.name),
      normalizeName(RUN_CTX?.nick),
      normalizeName(qsGet('name')),
      normalizeName(qsGet('nick')),
      normalizeName(window.RUN_CTX?.name),
      normalizeName(window.RUN_CTX?.nick),
      normalizeName(window.__GJ_CTX?.name),
      normalizeName(readText(LS_KEYS.selfNameGlobal)),
      roomId ? normalizeName(readText(`${LS_KEYS.selfNameByRoomPrefix}${roomId}`)) : ''
    ].forEach(v => { if (v) set.add(v); });
    return set;
  }

  function normalizePlayers(input) {
    let rows = [];

    if (Array.isArray(input)) {
      rows = input.map((p, idx) => ({ key: '', value: p || {}, idx }));
    } else if (input && typeof input === 'object' && input.players && typeof input.players === 'object') {
      rows = Object.entries(input.players).map(([key, value], idx) => ({ key, value: value || {}, idx }));
    } else if (input && typeof input === 'object') {
      rows = Object.entries(input).map(([key, value], idx) => ({ key, value: value || {}, idx }));
    }

    return rows.map(({ key, value: p, idx }) => {
      const pid = normalizePid(p?.pid || p?.playerId || p?.uid || p?.id || key || `p${idx + 1}`);
      const name = normalizeName(p?.name || p?.nick || p?.playerName || p?.displayName || `Player ${idx + 1}`);
      return {
        key: txt(key),
        pid,
        uid: normalizePid(p?.uid || p?.playerId || p?.pid || key || ''),
        playerId: normalizePid(p?.playerId || p?.uid || p?.pid || key || ''),
        name,
        score: int(p?.score, 0),
        miss: int(p?.miss ?? p?.misses, 0),
        bestStreak: int(p?.bestStreak ?? p?.comboMax ?? p?.streak, 0),
        hp: int(p?.hp ?? p?.health, 100),
        maxHp: Math.max(1, int(p?.maxHp ?? p?.maxHealth, 100)),
        shield: int(p?.shield, 0),
        attackCharge: int(p?.attackCharge ?? p?.charge, 0),
        maxAttackCharge: Math.max(1, int(p?.maxAttackCharge ?? p?.maxCharge, 100)),
        attackReady: !!(p?.attackReady ?? p?.canAttack ?? false),
        attacksUsed: int(p?.attacksUsed, 0),
        damageDealt: int(p?.damageDealt, 0),
        damageTaken: int(p?.damageTaken, 0),
        koCount: int(p?.koCount ?? p?.kills, 0),
        alive: (p?.alive != null) ? !!p.alive : int(p?.hp ?? p?.health, 100) > 0,
        ready: !!p?.ready,
        isHost: !!p?.isHost,
        raw: p || {}
      };
    });
  }

  function normalizeRoomShape(room) {
    if (!room || typeof room !== 'object') {
      return {
        roomId: currentRoomId(),
        status: '',
        meta: null,
        state: null,
        players: []
      };
    }

    const meta = room.meta && typeof room.meta === 'object' ? room.meta : null;
    const state = room.state && typeof room.state === 'object' ? room.state : null;

    const roomId = normalizeRoomId(
      room.roomId ||
      room.id ||
      meta?.roomId ||
      qsGet('roomId') ||
      qsGet('room') ||
      currentRoomId()
    ) || '-';

    const status = txt(
      state?.status ||
      room.status ||
      room.match?.status ||
      ''
    );

    const players = normalizePlayers(
      room.players ? room.players : room
    );

    return {
      raw: room,
      roomId,
      status,
      meta,
      state,
      players
    };
  }

  function sortBattlePlayers(players) {
    return [...players].sort((a, b) => {
      if (Number(b.alive) !== Number(a.alive)) return Number(b.alive) - Number(a.alive);
      if (b.score !== a.score) return b.score - a.score;
      if (b.hp !== a.hp) return b.hp - a.hp;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      if (b.koCount !== a.koCount) return b.koCount - a.koCount;
      return a.name.localeCompare(b.name, 'th');
    });
  }

  function resolveSelfPlayer(players, roomId = '') {
    const knownPids = gatherKnownSelfPidSet(roomId);
    const knownNames = gatherKnownSelfNameSet(roomId);

    let self = players.find(p =>
      (p.pid && knownPids.has(p.pid)) ||
      (p.uid && knownPids.has(p.uid)) ||
      (p.playerId && knownPids.has(p.playerId)) ||
      (p.key && knownPids.has(normalizePid(p.key)))
    );
    if (self) return self;

    const matchedByName = players.filter(p => p.name && knownNames.has(p.name));
    if (matchedByName.length === 1) return matchedByName[0];

    return null;
  }

  function bindNodes() {
    REF.hud = byId('battleHud') || byId('hudBattle') || byId('battleHUD');
    REF.mode = byId('battleModePill') || byId('battleModeValue');
    REF.room = byId('battleRoomPill') || byId('battleRoomValue');
    REF.score = byId('battleScoreValue') || byId('scoreValue');
    REF.time = byId('battleTimeValue') || byId('timeValue');
    REF.miss = byId('battleMissValue') || byId('missValue');
    REF.streak = byId('battleStreakValue') || byId('bestStreakValue');

    REF.hp = byId('battleHpValue') || byId('hpValue');
    REF.hpFill = byId('battleHpFill') || byId('hpFill');
    REF.charge = byId('battleChargeValue') || byId('attackChargeValue') || byId('chargeValue');
    REF.chargeFill = byId('battleChargeFill') || byId('attackChargeFill') || byId('chargeFill');
    REF.attackReady = byId('battleAttackReady') || byId('attackReadyBadge') || byId('attackReady');

    ensureResultMount();
  }

  function ensureResultMount() {
    let mount = byId('battleSafeResultMount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'battleSafeResultMount';
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
      const sorted = sortBattlePlayers(players);
      const self = resolveSelfPlayer(sorted, STATE.roomId);

      if (self) {
        STATE.score = self.score;
        STATE.miss = self.miss;
        STATE.bestStreak = self.bestStreak;
        STATE.hp = self.hp;
        STATE.maxHp = self.maxHp;
        STATE.shield = self.shield;
        STATE.attackCharge = self.attackCharge;
        STATE.maxAttackCharge = self.maxAttackCharge;
        STATE.attackReady = !!self.attackReady;
        STATE.attacksUsed = self.attacksUsed;
        STATE.damageDealt = self.damageDealt;
        STATE.damageTaken = self.damageTaken;
        STATE.koCount = self.koCount;
      }

      STATE.players = sorted;
    } else {
      STATE.score = int(STATE.score, 0);
      STATE.miss = int(STATE.miss, 0);
      STATE.bestStreak = int(STATE.bestStreak, 0);
      STATE.hp = clamp(int(STATE.hp, 100), 0, Math.max(1, int(STATE.maxHp, 100)));
      STATE.maxHp = Math.max(1, int(STATE.maxHp, 100));
      STATE.shield = Math.max(0, int(STATE.shield, 0));
      STATE.attackCharge = clamp(int(STATE.attackCharge, 0), 0, Math.max(1, int(STATE.maxAttackCharge, 100)));
      STATE.maxAttackCharge = Math.max(1, int(STATE.maxAttackCharge, 100));
      STATE.attackReady = !!STATE.attackReady;
      STATE.attacksUsed = int(STATE.attacksUsed, 0);
      STATE.damageDealt = int(STATE.damageDealt, 0);
      STATE.damageTaken = int(STATE.damageTaken, 0);
      STATE.koCount = int(STATE.koCount, 0);
      STATE.players = [];
    }

    window.__BATTLE_STATE__ = STATE;
    if (STATE.room) window.__BATTLE_ROOM__ = STATE.room;
  }

  function renderAttackReady() {
    if (!REF.attackReady) return;

    REF.attackReady.textContent = STATE.attackReady ? 'ATTACK READY' : 'CHARGING';
    REF.attackReady.style.opacity = STATE.attackReady ? '1' : '.72';
    REF.attackReady.style.color = STATE.attackReady ? '#fcd34d' : '#cbd5e1';
    REF.attackReady.style.fontWeight = '1100';
  }

  function renderHud() {
    recalcState();

    setText(REF.mode, 'MODE battle');
    setText(REF.room, `ROOM ${STATE.roomId}`);
    setText(REF.score, STATE.score);
    setText(REF.time, fmtClock(STATE.timeLeftSec));
    setText(REF.miss, STATE.miss);
    setText(REF.streak, STATE.bestStreak);

    setText(REF.hp, `${STATE.hp}/${STATE.maxHp}`);
    setWidth(REF.hpFill, pct(STATE.hp, STATE.maxHp));

    setText(REF.charge, `${STATE.attackCharge}/${STATE.maxAttackCharge}`);
    setWidth(REF.chargeFill, pct(STATE.attackCharge, STATE.maxAttackCharge));

    renderAttackReady();
    renderRunDebug();
  }

  let __runDebugLastPaint = 0;
  function ensureRunDebugBox(){
    if (!DEBUG) return null;
    let el = document.getElementById('battleRunDebugBox');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'battleRunDebugBox';
    el.style.cssText = [
      'position:fixed',
      'left:10px',
      'right:10px',
      'bottom:10px',
      'z-index:9999',
      'padding:10px 12px',
      'border-radius:14px',
      'border:1px solid rgba(191,227,242,.9)',
      'background:rgba(15,23,42,.92)',
      'color:#f8fafc',
      'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
      'box-shadow:0 18px 40px rgba(0,0,0,.28)',
      'white-space:pre-wrap',
      'word-break:break-word',
      'backdrop-filter:blur(8px)',
      'max-height:42vh',
      'overflow:auto'
    ].join(';');

    document.body.appendChild(el);
    return el;
  }

  function renderRunDebug() {
    if (!DEBUG) return;
    const t = Date.now();
    if (t - __runDebugLastPaint < 120) return;
    __runDebugLastPaint = t;

    const el = ensureRunDebugBox();
    if (!el) return;

    const summary = buildSummary();
    const self = summary.self || null;
    const room = normalizeRoomShape(STATE.room || {});
    const lines = [
      '[BATTLE SAFE DEBUG]',
      `room=${summary.roomId || '-'}`,
      `pid=${summary.pid || '-'}`,
      `name=${summary.name || '-'}`,
      `players=${summary.players.length}`,
      `selfKnown=${summary.selfKnown}`,
      `selfRank=${summary.selfRank || '-'}`,
      `status=${room.status || '-'}`,
      `score=${summary.scoreFinal}`,
      `hp=${summary.hp}/${summary.maxHp}`,
      `charge=${summary.attackCharge}/${summary.maxAttackCharge}`,
      `attackReady=${summary.attackReady}`,
      `ko=${summary.koCount}`,
      `damageDealt=${summary.damageDealt}`,
      `damageTaken=${summary.damageTaken}`,
      `selfPid=${self ? self.pid : '-'}`,
      `selfUid=${self ? self.uid : '-'}`,
      `selfKey=${self ? self.key : '-'}`
    ];

    el.textContent = lines.join('\n');
  }

  function findExistingResultRoot() {
    return (
      q('#battleResultMount:not([hidden])') ||
      q('#battleResult:not([hidden])') ||
      q('.battle-result-card') ||
      q('.battle-result') ||
      q('[data-battle-result]')
    );
  }

  function findResultTbody(root) {
    return (
      q('#battleResultTable tbody', root) ||
      q('.battle-result-table tbody', root) ||
      q('[data-battle-result-table] tbody', root) ||
      q('tbody', root)
    );
  }

  function findRankBadge(root) {
    return (
      q('#battleRankBadge', root) ||
      q('.battle-rank-badge', root) ||
      q('[data-battle-rank-badge]', root)
    );
  }

  function findResultSubtitle(root) {
    return (
      q('.battle-result-sub', root) ||
      q('[data-battle-result-sub]', root)
    );
  }

  function buildSummary() {
    recalcState();

    const players = sortBattlePlayers(normalizePlayers(STATE.players));
    const self = resolveSelfPlayer(players, STATE.roomId);
    const selfIndex = self ? players.findIndex(p => p.pid === self.pid && p.key === self.key) : -1;
    const selfRank = selfIndex >= 0 ? selfIndex + 1 : null;

    return {
      game: 'goodjunk-battle',
      mode: 'battle',
      pid: getSelfPid(),
      name: getSelfName(),
      roomId: STATE.roomId,

      scoreFinal: STATE.score,
      missTotal: STATE.miss,
      comboMax: STATE.bestStreak,

      hp: STATE.hp,
      maxHp: STATE.maxHp,
      shield: STATE.shield,
      attackCharge: STATE.attackCharge,
      maxAttackCharge: STATE.maxAttackCharge,
      attackReady: STATE.attackReady,
      attacksUsed: STATE.attacksUsed,
      damageDealt: STATE.damageDealt,
      damageTaken: STATE.damageTaken,
      koCount: STATE.koCount,

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
      const isMe = summary.self && p.pid === summary.self.pid && p.key === summary.self.key;
      return `
        <tr class="${isMe ? 'me-row' : ''}">
          <td>
            <div style="font-weight:1100;line-height:1.1">${esc(p.name || p.pid || `Player ${idx + 1}`)}</div>
            ${p.pid ? `<div style="margin-top:4px;color:#94a3b8;font-size:12px;font-weight:900">${esc(p.pid)}</div>` : ''}
            ${isMe ? `<div style="margin-top:6px;color:#7dd3fc;font-size:12px;font-weight:1100">• คุณ</div>` : ''}
            <div style="margin-top:4px;color:${p.alive ? '#86efac' : '#fca5a5'};font-size:12px;font-weight:1100">
              ${p.alive ? 'ยังยืนอยู่' : 'HP หมดแล้ว'}
            </div>
          </td>
          <td>${p.score}</td>
          <td>${p.hp}</td>
          <td>${p.miss}</td>
          <td>${p.bestStreak}</td>
          <td>${p.koCount}</td>
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
            <div style="font-size:24px;line-height:1.15;font-weight:1100;">⚔ Battle Result</div>
            <div style="margin-top:6px;color:#94a3b8;font-size:13px;font-weight:900;line-height:1.45;">
              ROOM ${esc(summary.roomId)} • ${esc(shortDateTime(summary.endedAt))}
            </div>
          </div>
          <button id="battleSafeCloseBtn" type="button" style="
            min-width:44px;min-height:44px;padding:8px 12px;border-radius:14px;
            border:1px solid rgba(148,163,184,.18);background:rgba(255,255,255,.04);
            color:#e5e7eb;font-weight:1100;cursor:pointer;">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1.1fr .9fr;gap:12px;margin-bottom:14px;">
          <div style="
            border-radius:22px;border:1px solid rgba(148,163,184,.16);
            background:rgba(15,23,42,.72);padding:14px;">
            <div style="color:#cbd5e1;font-size:13px;font-weight:1000;">MY BATTLE STATUS</div>
            <div style="margin-top:8px;font-size:42px;line-height:1;font-weight:1100;color:#f8fafc;">${summary.scoreFinal}</div>

            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px;">
              <div style="border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.42);padding:10px 12px;">
                <div style="color:#94a3b8;font-size:12px;font-weight:1000;">HP</div>
                <div style="margin-top:4px;font-size:22px;line-height:1;font-weight:1100;">${summary.hp}/${summary.maxHp}</div>
              </div>
              <div style="border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.42);padding:10px 12px;">
                <div style="color:#94a3b8;font-size:12px;font-weight:1000;">ATTACKS</div>
                <div style="margin-top:4px;font-size:22px;line-height:1;font-weight:1100;">${summary.attacksUsed}</div>
              </div>
              <div style="border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.42);padding:10px 12px;">
                <div style="color:#94a3b8;font-size:12px;font-weight:1000;">KO</div>
                <div style="margin-top:4px;font-size:22px;line-height:1;font-weight:1100;">${summary.koCount}</div>
              </div>
            </div>
          </div>

          <div style="
            border-radius:22px;border:1px solid rgba(148,163,184,.16);
            background:rgba(15,23,42,.72);padding:14px;display:flex;flex-direction:column;justify-content:center;gap:12px;">
            <div style="
              display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:18px;
              border:1px solid rgba(245,158,11,.24);background:rgba(245,158,11,.12);
              color:#fcd34d;font-size:18px;font-weight:1100;width:max-content;">
              ${summary.selfKnown && summary.selfRank ? `อันดับ #${summary.selfRank}` : 'อันดับ ?'}
            </div>

            <div style="color:#cbd5e1;font-size:13px;font-weight:1000;">Damage dealt ${summary.damageDealt}</div>
            <div style="color:#cbd5e1;font-size:13px;font-weight:1000;">Damage taken ${summary.damageTaken}</div>
            <div style="color:#cbd5e1;font-size:13px;font-weight:1000;">
              ${summary.attackReady ? 'ตอนจบมีสถานะ ATTACK READY' : 'ตอนจบยังชาร์จไม่เต็ม'}
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
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">คะแนน</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">HP</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">Miss</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">Best Streak</th>
                  <th style="text-align:left;color:#94a3b8;font-size:12px;font-weight:1000;padding:0 10px 6px;">KO</th>
                </tr>
              </thead>
              <tbody>
                ${summary.players.map((p) => {
                  const isMe = summary.self && p.pid === summary.self.pid && p.key === summary.self.key;
                  const bg = isMe ? 'rgba(30,41,59,.78)' : 'rgba(2,6,23,.42)';
                  const outline = isMe ? 'outline:1px solid rgba(245,158,11,.26);' : '';
                  return `
                    <tr>
                      <td style="padding:12px 10px;background:${bg};${outline}border-top-left-radius:14px;border-bottom-left-radius:14px;">
                        <div style="font-weight:1100;line-height:1.1">${esc(p.name || p.pid)}</div>
                        ${p.pid ? `<div style="margin-top:4px;color:#94a3b8;font-size:12px;font-weight:900">${esc(p.pid)}</div>` : ''}
                        ${isMe ? `<div style="margin-top:6px;color:#fcd34d;font-size:12px;font-weight:1100">• คุณ</div>` : ''}
                        <div style="margin-top:4px;color:${p.alive ? '#86efac' : '#fca5a5'};font-size:12px;font-weight:1100">
                          ${p.alive ? 'ยังยืนอยู่' : 'HP หมดแล้ว'}
                        </div>
                      </td>
                      <td style="padding:12px 10px;background:${bg};${outline}">${p.score}</td>
                      <td style="padding:12px 10px;background:${bg};${outline}">${p.hp}</td>
                      <td style="padding:12px 10px;background:${bg};${outline}">${p.miss}</td>
                      <td style="padding:12px 10px;background:${bg};${outline}">${p.bestStreak}</td>
                      <td style="padding:12px 10px;background:${bg};${outline}border-top-right-radius:14px;border-bottom-right-radius:14px;">${p.koCount}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
          <button id="battleSafeRematchBtn" type="button" style="
            min-width:140px;min-height:46px;padding:10px 14px;border-radius:16px;
            border:1px solid rgba(34,197,94,.28);background:rgba(34,197,94,.14);
            color:#f8fafc;font-weight:1100;cursor:pointer;">🔁 เล่นใหม่</button>

          <button id="battleSafeHubBtn" type="button" style="
            min-width:140px;min-height:46px;padding:10px 14px;border-radius:16px;
            border:1px solid rgba(59,130,246,.28);background:rgba(59,130,246,.14);
            color:#f8fafc;font-weight:1100;cursor:pointer;">🏠 กลับ HUB</button>

          <button id="battleSafeCloseBtn2" type="button" style="
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

    byId('battleSafeCloseBtn')?.addEventListener('click', close);
    byId('battleSafeCloseBtn2')?.addEventListener('click', close);
    byId('battleSafeHubBtn')?.addEventListener('click', () => {
      location.href = qsGet('hub', '../hub.html');
    });
    byId('battleSafeRematchBtn')?.addEventListener('click', () => {
      const u = new URL(location.href);
      location.href = u.toString();
    });
  }

  function emitBattleSummary(summary) {
    if (BRIDGE.summaryEmitted) return;
    BRIDGE.summaryEmitted = true;

    const others = (summary.players || []).filter((p) => {
      if (!summary.self) return true;
      return !(p.pid === summary.self.pid && p.key === summary.self.key);
    });

    const opponent = others[0] || null;
    const resultText =
      summary.selfRank === 1 ? 'win'
      : summary.selfRank ? `อันดับ ${summary.selfRank}`
      : 'finished';

    const detail = {
      summary: {
        mode: 'battle',
        game: 'goodjunk-battle',
        roomId: summary.roomId,
        pid: summary.pid,
        name: summary.name,
        rank: summary.selfRank ?? '',
        score: summary.scoreFinal ?? 0,
        opponentScore: opponent ? opponent.score : '',
        players: (summary.players || []).length,
        miss: summary.missTotal ?? 0,
        bestStreak: summary.comboMax ?? 0,
        result: resultText,
        reason: summary.endReason || 'finished',
        hp: summary.hp,
        maxHp: summary.maxHp,
        attackCharge: summary.attackCharge,
        maxAttackCharge: summary.maxAttackCharge,
        attackReady: summary.attackReady,
        attacksUsed: summary.attacksUsed,
        damageDealt: summary.damageDealt,
        damageTaken: summary.damageTaken,
        koCount: summary.koCount,
        raw: summary
      }
    };

    const eventNames = [
      'gj:battle-summary',
      'gj:summary',
      'gj:match-summary',
      'gj:session-end',
      'hha:summary',
      'hha:session-summary',
      'hha:match-summary'
    ];

    eventNames.forEach((name) => {
      try {
        window.dispatchEvent(new CustomEvent(name, { detail }));
      } catch (err) {
        console.warn('[battle-safe] emit summary event failed:', name, err);
      }
    });

    try {
      window.postMessage({
        type: 'gj:battle-summary',
        detail
      }, '*');
    } catch (err) {
      console.warn('[battle-safe] postMessage summary failed:', err);
    }

    try {
      if (typeof window.__GJ_SHOW_BATTLE_SUMMARY__ === 'function') {
        window.__GJ_SHOW_BATTLE_SUMMARY__(detail);
      }
    } catch (err) {
      console.warn('[battle-safe] direct summary bridge failed:', err);
    }
  }

  function mergeState(patch = {}) {
    const src = patch || {};

    if (src.room && typeof src.room === 'object') {
      setRoomState(src.room);
    }

    STATE.pid = normalizePid(src.pid ?? src.uid ?? src.playerId ?? STATE.pid ?? getSelfPid());
    STATE.name = normalizeName(src.name ?? src.nick ?? STATE.name ?? getSelfName());
    STATE.roomId = txt(src.roomId ?? src.room ?? STATE.roomId ?? currentRoomId()) || '-';

    STATE.score = int(src.score ?? src.myScore ?? STATE.score, 0);
    STATE.miss = int(src.miss ?? src.misses ?? STATE.miss, 0);
    STATE.bestStreak = int(src.bestStreak ?? src.comboMax ?? src.streak ?? STATE.bestStreak, 0);
    STATE.timeLeftSec = int(src.timeLeftSec ?? src.timeLeft ?? STATE.timeLeftSec, 0);

    STATE.hp = clamp(int(src.hp ?? src.health ?? STATE.hp, 100), 0, Math.max(1, int(src.maxHp ?? src.maxHealth ?? STATE.maxHp, 100)));
    STATE.maxHp = Math.max(1, int(src.maxHp ?? src.maxHealth ?? STATE.maxHp, 100));
    STATE.shield = Math.max(0, int(src.shield ?? STATE.shield, 0));

    STATE.attackCharge = clamp(
      int(src.attackCharge ?? src.charge ?? STATE.attackCharge, 0),
      0,
      Math.max(1, int(src.maxAttackCharge ?? src.maxCharge ?? STATE.maxAttackCharge, 100))
    );
    STATE.maxAttackCharge = Math.max(1, int(src.maxAttackCharge ?? src.maxCharge ?? STATE.maxAttackCharge, 100));
    STATE.attackReady = !!(src.attackReady ?? src.canAttack ?? STATE.attackReady);

    STATE.attacksUsed = int(src.attacksUsed ?? STATE.attacksUsed, 0);
    STATE.damageDealt = int(src.damageDealt ?? STATE.damageDealt, 0);
    STATE.damageTaken = int(src.damageTaken ?? STATE.damageTaken, 0);
    STATE.koCount = int(src.koCount ?? src.kills ?? STATE.koCount, 0);

    if (Array.isArray(src.players)) {
      STATE.players = normalizePlayers(src.players);
    } else if (src.players && typeof src.players === 'object') {
      STATE.players = normalizePlayers(src.players);
    }

    STATE.ended = !!(src.ended ?? src.finished ?? src.isEnded ?? STATE.ended);
    STATE.endedAt = txt(src.endedAt ?? src.timestampIso ?? src.finishedAt ?? STATE.endedAt);
    STATE.endReason = txt(src.endReason ?? src.reason ?? STATE.endReason);

    window.__BATTLE_STATE__ = STATE;
    if (STATE.room) window.__BATTLE_ROOM__ = STATE.room;

    rememberSelfIdentity();
    recalcState();
  }

  function setRoomState(room) {
    const normalized = normalizeRoomShape(room);
    STATE.room = normalized.raw;
    STATE.roomMeta = normalized.meta;
    STATE.roomState = normalized.state;
    STATE.roomId = normalized.roomId || STATE.roomId || '-';
    STATE.players = normalized.players;
    window.__BATTLE_ROOM__ = normalized.raw;
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
    if (judge.miss != null) STATE.miss = int(judge.miss, STATE.miss);
    if (judge.bestStreak != null) STATE.bestStreak = int(judge.bestStreak, STATE.bestStreak);
    renderHud();
  }

  function onDamage(detail = {}) {
    if (detail.hp != null || detail.health != null) {
      STATE.hp = clamp(int(detail.hp ?? detail.health, STATE.hp), 0, STATE.maxHp);
    }
    if (detail.maxHp != null || detail.maxHealth != null) {
      STATE.maxHp = Math.max(1, int(detail.maxHp ?? detail.maxHealth, STATE.maxHp));
      STATE.hp = clamp(STATE.hp, 0, STATE.maxHp);
    }
    if (detail.shield != null) {
      STATE.shield = Math.max(0, int(detail.shield, STATE.shield));
    }
    if (detail.damageTaken != null) {
      STATE.damageTaken = int(detail.damageTaken, STATE.damageTaken);
    }
    if (detail.damageDealt != null) {
      STATE.damageDealt = int(detail.damageDealt, STATE.damageDealt);
    }
    if (detail.koCount != null || detail.kills != null) {
      STATE.koCount = int(detail.koCount ?? detail.kills, STATE.koCount);
    }
    renderHud();
  }

  function onAttackCharge(detail = {}) {
    if (detail.attackCharge != null || detail.charge != null) {
      STATE.attackCharge = clamp(
        int(detail.attackCharge ?? detail.charge, STATE.attackCharge),
        0,
        STATE.maxAttackCharge
      );
    }
    if (detail.maxAttackCharge != null || detail.maxCharge != null) {
      STATE.maxAttackCharge = Math.max(1, int(detail.maxAttackCharge ?? detail.maxCharge, STATE.maxAttackCharge));
      STATE.attackCharge = clamp(STATE.attackCharge, 0, STATE.maxAttackCharge);
    }
    if (detail.attackReady != null || detail.canAttack != null) {
      STATE.attackReady = !!(detail.attackReady ?? detail.canAttack);
    } else {
      STATE.attackReady = STATE.attackCharge >= STATE.maxAttackCharge;
    }
    if (detail.attacksUsed != null) {
      STATE.attacksUsed = int(detail.attacksUsed, STATE.attacksUsed);
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

    const patchedExisting = patchExistingResultDOM(summary);
    if (!patchedExisting) {
      mountFallbackResult(summary);
    }

    emitBattleSummary(summary);

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
      window.__BATTLE_STATE__,
      window.RUN_CTX,
      window.__GJ_CTX,
      window.__GJ_RUN_CTX__,
      window.__GJ_MULTI_RUN_CTX__,
      BOOT,
      RUN_CTX
    ].filter(Boolean);

    for (const src of candidates) {
      if (src && typeof src === 'object') mergeState(src);
    }

    const roomCandidates = [
      window.__BATTLE_ROOM__,
      window.battleRoom,
      window.roomState,
      window.state?.room,
      window.gameState?.room,
      window.__GJ_RUN_CTX__?.room,
      window.__GJ_MULTI_RUN_CTX__?.room,
      BOOT?.room
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

    const hp =
      parseNumText(txt(q('#hpValue')?.textContent)) ||
      parseNumText(txt(q('.hp-value')?.textContent)) ||
      STATE.hp;

    const charge =
      parseNumText(txt(q('#attackChargeValue')?.textContent)) ||
      parseNumText(txt(q('#chargeValue')?.textContent)) ||
      parseNumText(txt(q('.charge-value')?.textContent)) ||
      STATE.attackCharge;

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
      hp,
      attackCharge: charge,
      attackReady: charge >= STATE.maxAttackCharge,
      timeLeftSec
    });
  }

  function tickTimeFromEndsAt() {
    const s = window.state || window.gameState || window.__BATTLE_STATE__ || {};
    const endsAtMs = num(s.endsAtMs || s.endAtMs || 0, 0);
    if (endsAtMs > 0 && !STATE.ended) {
      STATE.timeLeftSec = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
    }
  }

  function bridgeLoop() {
    try {
      readKnownGlobals();
      readLegacyDom();
      tickTimeFromEndsAt();
      renderHud();

      const s = window.state || window.gameState || window.__BATTLE_STATE__ || {};
      const roomShape = normalizeRoomShape(s.room || window.__BATTLE_ROOM__ || {});
      const roomEnded = ['ended', 'finished'].includes((roomShape.status || '').toLowerCase());

      const ended =
        !!STATE.ended ||
        !!s.isEnded ||
        !!s.ended ||
        !!s.finished ||
        !!s.showSummary ||
        !!s.showResult ||
        roomEnded ||
        (num(s.endsAtMs || s.endAtMs || 0, 0) > 0 && Date.now() > num(s.endsAtMs || s.endAtMs || 0, 0) + 300);

      if (ended && !BRIDGE.resultShown) {
        finishGame({ reason: s.reason || roomShape.status || 'finished' });
      }

      if (BRIDGE.resultShown) {
        patchExistingResultDOM(buildSummary());
      }
    } catch (err) {
      console.warn('[battle-safe] bridgeLoop error:', err);
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
      if (obj[key].__battleWrapped) return true;

      const original = obj[key];
      const wrapped = function (...args) {
        const out = original.apply(this, args);
        try {
          finishGame({ reason: key });
        } catch (err) {
          console.warn(`[battle-safe] wrapped end fn error for ${key}:`, err);
        }
        return out;
      };
      wrapped.__battleWrapped = true;
      wrapped.__battleOriginal = original;
      obj[key] = wrapped;
      return true;
    } catch (err) {
      console.warn(`[battle-safe] wrapEndFunction failed for ${key}:`, err);
      return false;
    }
  }

  function installEndHooks() {
    if (BRIDGE.wrapped) return;
    BRIDGE.wrapped = true;

    const keys = [
      'showBattleResult',
      'openBattleResult',
      'renderBattleResult',
      'finishGame',
      'endGame',
      'showSummary',
      'showResult',
      'openResult'
    ];

    for (const key of keys) {
      wrapEndFunction(window, key);
    }
  }

  function installCustomEventHooks() {
    if (window.__BATTLE_SAFE_EVENTS_BOUND__) return;
    window.__BATTLE_SAFE_EVENTS_BOUND__ = true;

    const on = (name, fn) => window.addEventListener(name, (ev) => {
      try {
        fn(ev?.detail || {});
      } catch (err) {
        console.warn(`[battle-safe] custom event ${name} error:`, err);
      }
    });

    on('battle:update', detail => {
      mergeState(detail);
      renderHud();
    });

    on('battle:room', detail => {
      setRoomState(detail);
    });

    on('battle:players', detail => {
      setPlayers(detail.players || detail);
    });

    on('battle:judge', detail => {
      onJudge(detail);
    });

    on('battle:damage', detail => {
      onDamage(detail);
    });

    on('battle:charge', detail => {
      onAttackCharge(detail);
    });

    on('battle:finish', detail => {
      finishGame(detail);
    });

    on('hha:battle:update', detail => {
      mergeState(detail);
      renderHud();
    });

    on('hha:battle:finish', detail => {
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
    onDamage(detail) {
      onDamage(detail);
    },
    onAttackCharge(detail) {
      onAttackCharge(detail);
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

  window.BattleSafe = API;
  window.__BATTLE_STATE__ = STATE;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBoot, { once: true });
  } else {
    ensureBoot();
  }
})();