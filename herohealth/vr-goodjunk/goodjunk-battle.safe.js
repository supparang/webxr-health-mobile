/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle.safe.js
 * FULL PATCH v20260327-GOODJUNK-BATTLE-ENGINE-R2
 * ---------------------------------------------------------
 * Engine role:
 * - actual playable battle engine
 * - works with lobby schema: hha-battle/goodjunk/rooms/{roomId}/{meta,state,players}
 * - injects stage + HUD into #gameMount
 * - syncs score / hp / charge / attacks to Firebase
 * - host promotes countdown -> playing automatically
 * - host ends round when time up or someone is KO
 * - emits battle:* events for goodjunk.safe.battle.js
 * ========================================================= */

(() => {
  'use strict';

  const W = window;
  const D = document;

  if (W.__GJ_BATTLE_ENGINE_LOADED__) return;
  W.__GJ_BATTLE_ENGINE_LOADED__ = true;

  const ROOT_PATH = 'hha-battle/goodjunk/rooms';
  const HEARTBEAT_MS = 2500;
  const ACTIVE_TTL_MS = 15000;
  const SYNC_MIN_MS = 120;
  const FIREBASE_SDKS = [
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js',
    '../firebase-config.js'
  ];

  const GOOD_ITEMS = [
    { emoji:'🍎', name:'Apple' },
    { emoji:'🍌', name:'Banana' },
    { emoji:'🍉', name:'Watermelon' },
    { emoji:'🥕', name:'Carrot' },
    { emoji:'🥦', name:'Broccoli' },
    { emoji:'🍓', name:'Strawberry' },
    { emoji:'🍇', name:'Grapes' },
    { emoji:'🥛', name:'Milk' }
  ];

  const JUNK_ITEMS = [
    { emoji:'🍩', name:'Donut' },
    { emoji:'🍟', name:'Fries' },
    { emoji:'🍭', name:'Lollipop' },
    { emoji:'🍬', name:'Candy' },
    { emoji:'🧃', name:'Sweet Drink' },
    { emoji:'🧁', name:'Cupcake' },
    { emoji:'🍪', name:'Cookie' }
  ];

  const DIFF_CFG = {
    easy:   { spawnEvery: 860, maxTargets: 5, ttl: 3200, speed: 110, goodRatio: 0.78, atkDamage: 16 },
    normal: { spawnEvery: 700, maxTargets: 6, ttl: 2700, speed: 140, goodRatio: 0.72, atkDamage: 18 },
    hard:   { spawnEvery: 560, maxTargets: 7, ttl: 2300, speed: 175, goodRatio: 0.66, atkDamage: 20 }
  };

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

  function cleanText(v, max=64){
    return String(v == null ? '' : v).trim().slice(0, max);
  }

  function cleanPid(v){
    const s = String(v == null ? '' : v).replace(/[.#$[\]/]/g, '-').trim();
    if (!s || s.toLowerCase() === 'anon') return '';
    return s.slice(0, 80);
  }

  function cleanRoom(v){
    return String(v == null ? '' : v)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 24);
  }

  function roomIdCandidates(raw){
    const exact = cleanRoom(raw);
    const compact = exact.replace(/[^A-Z0-9]/g, '');
    const out = [];

    function push(v){
      v = cleanRoom(v);
      if (!v) return;
      if (!out.includes(v)) out.push(v);
    }

    push(exact);
    push(compact);

    if (/^GJB[A-Z0-9]{5,8}$/.test(compact)) push(`GJB-${compact.slice(3)}`);
    if (/^GJB-[A-Z0-9]{5,8}$/.test(exact)) push(exact.replace('-', ''));

    return out;
  }

  function formatClock(sec){
    sec = Math.max(0, Math.ceil(num(sec, 0)));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function raf(fn){
    return (W.requestAnimationFrame || function(cb){ return setTimeout(() => cb(performance.now()), 16); })(fn);
  }

  function caf(id){
    return (W.cancelAnimationFrame || clearTimeout)(id);
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const full = new URL(src, location.href).toString();
      const existing = Array.from(D.scripts).find(s => s.src === full);
      if (existing){
        if (existing.dataset.loaded === '1') return resolve(full);
        existing.addEventListener('load', () => resolve(full), { once:true });
        existing.addEventListener('error', () => reject(new Error('load failed: ' + src)), { once:true });
        return;
      }

      const s = D.createElement('script');
      s.src = full;
      s.async = true;
      s.onload = () => {
        s.dataset.loaded = '1';
        resolve(full);
      };
      s.onerror = () => reject(new Error('load failed: ' + src));
      D.head.appendChild(s);
    });
  }

  const RUN_CTX = W.__GJ_RUN_CTX__ || W.__GJ_MULTI_RUN_CTX__ || W.RUN_CTX || {};
  const BOOT = W.HHA_BATTLE_BOOT || W.__GJ_BATTLE_BOOT__ || {};

  const STATE = {
    roomId: roomIdCandidates(qs('roomId') || qs('room') || BOOT.roomId || RUN_CTX.roomId || '')[0] || '',
    queryUid: cleanPid(qs('uid') || qs('playerId') || BOOT.uid || BOOT.playerId || RUN_CTX.uid || RUN_CTX.playerId || ''),
    pid: cleanPid(qs('pid') || BOOT.pid || RUN_CTX.pid || '') || 'anon',
    uid: '',
    name: cleanText(qs('name') || qs('nick') || BOOT.name || BOOT.nick || RUN_CTX.name || RUN_CTX.nick || 'Player', 40),
    role: cleanText(qs('role') || BOOT.role || RUN_CTX.role || 'player', 20),
    diff: (() => {
      const v = String(qs('diff', BOOT.diff || RUN_CTX.diff || 'normal')).toLowerCase();
      return (v === 'easy' || v === 'hard') ? v : 'normal';
    })(),
    timeSec: clamp(qs('time', String(BOOT.timeSec || BOOT.time || RUN_CTX.time || 150)), 30, 300),
    seed: cleanText(qs('seed') || BOOT.seed || RUN_CTX.seed || String(Date.now()), 60),
    roundToken: cleanText(qs('roundToken') || BOOT.roundToken || '', 120),
    startAtQuery: num(qs('startAt', String(BOOT.startAt || 0)), 0),
    hub: qs('hub', BOOT.hub || RUN_CTX.hub || '../hub.html'),
    view: cleanText(qs('view', BOOT.view || RUN_CTX.view || 'mobile'), 20),
    run: cleanText(qs('run', BOOT.run || RUN_CTX.run || 'play'), 20),

    firebaseReady: false,
    db: null,
    auth: null,
    roomRef: null,
    refs: { meta:null, state:null, players:null, self:null },

    room: { meta:{}, state:{}, players:{} },

    started: false,
    finished: false,
    localKo: false,
    lastFrameTs: 0,
    lastSpawnAt: 0,
    loopId: 0,
    heartbeatId: 0,
    syncTimer: 0,
    lastSyncTs: 0,

    rng: null,
    cfg: DIFF_CFG.normal,

    targets: [],
    seq: 0,
    seenAttackIds: Object.create(null),

    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
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
    goodHit: 0,
    junkHit: 0,

    lastAttackId: '',
    lastAttackAt: 0,
    lastAttackDamage: 0,
    lastAttackTarget: '',

    hostEndingBusy: false,
    countdownPromoteBusy: false,
    roundPreparedToken: '',
    startedRoundToken: '',
    bannerLockUntil: 0
  };

  const UI = {
    mount: null,
    root: null,
    field: null,
    statusBanner: null,
    attackBtn: null,

    battleModePill: null,
    battleRoomPill: null,
    battleScoreValue: null,
    battleTimeValue: null,
    battleMissValue: null,
    battleStreakValue: null,
    battleHpValue: null,
    battleHpFill: null,
    battleChargeValue: null,
    battleChargeFill: null,
    battleAttackReady: null,

    opponentStrip: null
  };

  function getCfg(){
    return DIFF_CFG[STATE.diff] || DIFF_CFG.normal;
  }

  function currentRoomEndsAt(){
    return num((STATE.room.state || {}).endsAt, 0);
  }

  function currentCountdownEndsAt(){
    return num((STATE.room.state || {}).countdownEndsAt, 0);
  }

  function currentStartedAt(){
    return num((STATE.room.state || {}).startedAt, 0);
  }

  function currentRoundToken(){
    return cleanText((STATE.room.state || {}).roundToken || STATE.roundToken || '', 120);
  }

  function roomStatus(){
    return String(((STATE.room || {}).state || {}).status || '');
  }

  function getSelfKey(){
    return STATE.uid || STATE.queryUid || '';
  }

  function normalizeRoomPlayersMap(obj){
    const out = {};
    const src = (obj && typeof obj === 'object') ? obj : {};
    Object.keys(src).forEach((key) => {
      const p = src[key] || {};
      out[key] = Object.assign({}, p, {
        uid: cleanPid(p.uid || p.playerId || key),
        playerId: cleanPid(p.playerId || p.uid || key),
        pid: cleanPid(p.pid || p.playerId || p.uid || key),
        name: cleanText(p.name || p.nick || 'Player', 40)
      });
    });
    return out;
  }

  function roomPlayersArray(){
    return Object.entries(normalizeRoomPlayersMap(STATE.room.players)).map(([key, p]) => Object.assign({ key }, p));
  }

  function activePlayers(){
    const t = now();
    return roomPlayersArray()
      .filter((p) => {
        if (p.connected === false) return false;
        const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
        if (!lastSeen) return true;
        return (t - lastSeen) <= ACTIVE_TTL_MS;
      })
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function selfPlayer(){
    const key = getSelfKey();
    const players = normalizeRoomPlayersMap(STATE.room.players);
    return players[key] || null;
  }

  function opponentPlayers(){
    const key = getSelfKey();
    return activePlayers().filter((p) => p.key !== key);
  }

  function topOpponent(){
    const arr = opponentPlayers();
    return arr[0] || null;
  }

  function isHost(){
    const host = cleanPid((STATE.room.meta || {}).hostPid || '');
    return !!host && host === getSelfKey();
  }

  function updateGlobals(){
    W.battleRoom = STATE.room;
    W.__BATTLE_ROOM__ = STATE.room;

    W.state = Object.assign({}, W.state || {}, {
      room: STATE.room,
      roomId: STATE.roomId,
      pid: STATE.pid,
      uid: STATE.uid,
      playerId: STATE.uid,
      score: STATE.score,
      miss: STATE.miss,
      bestStreak: STATE.bestStreak,
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
      timeLeftSec: timeLeftSec(),
      started: STATE.started,
      finished: STATE.finished,
      isEnded: STATE.finished,
      endsAtMs: currentRoomEndsAt()
    });

    W.gameState = W.state;
  }

  function emit(name, detail){
    try { W.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  }

  function emitLiveEvents(){
    updateGlobals();

    emit('battle:update', {
      roomId: STATE.roomId,
      pid: STATE.pid,
      uid: STATE.uid,
      name: STATE.name,
      score: STATE.score,
      miss: STATE.miss,
      bestStreak: STATE.bestStreak,
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
      timeLeftSec: timeLeftSec(),
      players: normalizeRoomPlayersMap(STATE.room.players),
      room: STATE.room
    });

    emit('battle:room', STATE.room);
    emit('battle:players', { players: normalizeRoomPlayersMap(STATE.room.players) });
    emit('battle:judge', {
      score: STATE.score,
      miss: STATE.miss,
      bestStreak: STATE.bestStreak
    });
    emit('battle:damage', {
      hp: STATE.hp,
      maxHp: STATE.maxHp,
      shield: STATE.shield,
      damageDealt: STATE.damageDealt,
      damageTaken: STATE.damageTaken,
      koCount: STATE.koCount
    });
    emit('battle:charge', {
      attackCharge: STATE.attackCharge,
      maxAttackCharge: STATE.maxAttackCharge,
      attackReady: STATE.attackReady,
      attacksUsed: STATE.attacksUsed
    });
  }

  function injectStyles(){
    if (D.getElementById('gjBattleEngineStyles')) return;

    const style = D.createElement('style');
    style.id = 'gjBattleEngineStyles';
    style.textContent = `
      #battleEngineRoot{
        position:absolute; inset:0; z-index:1; overflow:hidden;
        background:
          radial-gradient(circle at 12% 10%, rgba(255,255,255,.9), transparent 18%),
          radial-gradient(circle at 86% 14%, rgba(255,255,255,.76), transparent 16%),
          linear-gradient(180deg,#dff4ff,#bfe8ff 54%, #fff7d8);
      }
      #battleEngineStage{
        position:absolute; inset:0; overflow:hidden;
      }
      #battleField{
        position:absolute; inset:0; overflow:hidden;
      }
      #battleField::before{
        content:"";
        position:absolute; left:0; right:0; bottom:0; height:140px;
        background:
          radial-gradient(circle at 20% 40%, rgba(126,217,87,.34), transparent 18%),
          radial-gradient(circle at 72% 44%, rgba(126,217,87,.28), transparent 18%),
          linear-gradient(180deg,#b3f28f,#88d96b);
        border-top:1px solid rgba(88,195,63,.26);
        pointer-events:none;
      }
      #battleHud{
        position:absolute; left:14px; right:14px; top:14px; z-index:6;
        display:grid; gap:10px; pointer-events:none;
      }
      .gjb-hud-row{
        display:flex; gap:8px; flex-wrap:wrap; align-items:center;
      }
      .gjb-pill, .gjb-stat, .gjb-gauge, .gjb-opponent-card{
        background:rgba(255,255,255,.92);
        border:2px solid #bfe3f2;
        border-radius:18px;
        box-shadow:0 10px 20px rgba(86,155,194,.12);
      }
      .gjb-pill{
        min-height:42px; padding:10px 14px;
        font-size:13px; font-weight:1000; color:#4d4a42;
        display:inline-flex; align-items:center; gap:8px;
      }
      .gjb-stat{
        min-width:108px; padding:10px 12px; text-align:center;
      }
      .gjb-stat-k{
        font-size:11px; color:#7b7a72; font-weight:1000;
      }
      .gjb-stat-v{
        margin-top:5px; font-size:22px; line-height:1; font-weight:1000; color:#244260;
      }
      .gjb-gauge{
        padding:10px 12px; min-width:190px;
      }
      .gjb-gauge-head{
        display:flex; justify-content:space-between; gap:8px; align-items:center;
        font-size:12px; color:#6d6a62; font-weight:1000;
      }
      .gjb-gauge-bar{
        position:relative; height:12px; margin-top:7px; overflow:hidden;
        border-radius:999px; background:#e8f6ff;
      }
      .gjb-gauge-fill{
        position:absolute; left:0; top:0; bottom:0; width:0%;
        border-radius:999px; transition:width .14s linear;
      }
      #battleHpFill{ background:linear-gradient(90deg,#7ed957,#58c33f); }
      #battleChargeFill{ background:linear-gradient(90deg,#7fcfff,#58b7f5); }
      #battleOpponentStrip{
        position:absolute; left:14px; right:14px; bottom:14px; z-index:5;
        display:flex; gap:10px; flex-wrap:wrap;
      }
      .gjb-opponent-card{
        min-width:220px; padding:12px 14px; color:#4d4a42;
      }
      .gjb-opponent-top{
        display:flex; justify-content:space-between; gap:8px; align-items:center;
      }
      .gjb-opponent-name{
        font-size:15px; font-weight:1000;
      }
      .gjb-opponent-mini{
        margin-top:7px; font-size:12px; color:#7b7a72; font-weight:1000;
      }
      #battleBanner{
        position:absolute; left:50%; top:110px; transform:translateX(-50%);
        z-index:7; min-width:min(92vw,520px); max-width:min(92vw,620px);
        border-radius:22px; padding:12px 16px;
        border:2px solid #bfe3f2;
        background:rgba(255,255,255,.95);
        box-shadow:0 14px 24px rgba(86,155,194,.16);
        color:#4d4a42; text-align:center; font-size:14px; line-height:1.6; font-weight:1000;
      }
      #battleActionDock{
        position:absolute; right:14px; bottom:86px; z-index:8; pointer-events:auto;
        display:grid; gap:8px; justify-items:end;
      }
      #battleAttackBtn{
        appearance:none; border:none; cursor:pointer;
        min-width:146px; min-height:54px; padding:12px 16px;
        border-radius:18px; font-size:15px; font-weight:1000;
        color:#fffef9; background:linear-gradient(180deg,#7fcfff,#58b7f5);
        box-shadow:0 14px 24px rgba(86,155,194,.18);
        transition:transform .12s ease, opacity .12s ease, filter .12s ease;
      }
      #battleAttackBtn:hover{ transform:translateY(-1px); filter:brightness(1.03); }
      #battleAttackBtn:active{ transform:translateY(0); }
      #battleAttackBtn:disabled{
        cursor:not-allowed; opacity:.55; filter:grayscale(.06); transform:none;
      }
      #attackReadyBadge{
        background:rgba(255,255,255,.92);
        border:2px solid #bfe3f2;
        border-radius:999px; min-height:36px; padding:7px 12px;
        box-shadow:0 10px 20px rgba(86,155,194,.12);
        font-size:12px; font-weight:1000; color:#7b7a72;
      }
      .gjb-cloud{
        position:absolute; background:#fff; border-radius:999px;
        box-shadow:0 8px 18px rgba(0,0,0,.06); opacity:.8; pointer-events:none;
      }
      .gjb-cloud.c1{ width:130px;height:42px;left:4%;top:8%; }
      .gjb-cloud.c2{ width:95px;height:34px;left:72%;top:11%; }
      .gjb-cloud.c3{ width:110px;height:36px;left:38%;top:18%; }
      .gjb-target{
        position:absolute;
        display:grid; place-items:center;
        border-radius:22px; border:2px solid #fff;
        box-shadow:0 12px 24px rgba(0,0,0,.14);
        cursor:pointer; user-select:none;
        transform:translateZ(0);
        min-width:56px; min-height:56px;
      }
      .gjb-target.good{
        background:linear-gradient(180deg,#ffffff,#f1fff1);
      }
      .gjb-target.junk{
        background:linear-gradient(180deg,#fff3f3,#ffe1e1);
      }
      .gjb-target .emoji{
        font-size:clamp(24px, 3.8vw, 38px);
        line-height:1;
      }
      .gjb-hitfx{
        position:absolute; pointer-events:none; z-index:9;
        font-size:20px; font-weight:1000; color:#244260;
        text-shadow:0 1px 0 #fff;
        animation:gjb-float .48s ease-out forwards;
      }
      .gjb-hitfx.good{ color:#15803d; }
      .gjb-hitfx.bad{ color:#b91c1c; }
      .gjb-hitfx.atk{ color:#2563eb; font-size:24px; }
      @keyframes gjb-float{
        0%{ opacity:0; transform:translateY(8px) scale(.9); }
        15%{ opacity:1; }
        100%{ opacity:0; transform:translateY(-28px) scale(1.04); }
      }
      @media (max-width: 860px){
        #battleHud{ gap:8px; left:10px; right:10px; top:10px; }
        .gjb-stat{ min-width:94px; }
        .gjb-gauge{ min-width:160px; }
        #battleBanner{
          top:116px; min-width:min(94vw,520px); font-size:13px;
        }
        #battleActionDock{ right:10px; bottom:74px; }
        #battleAttackBtn{ min-width:130px; min-height:50px; font-size:14px; }
      }
      @media (max-width: 640px){
        .gjb-stat-v{ font-size:20px; }
        .gjb-opponent-card{ min-width:unset; width:100%; }
        #battleBanner{ top:136px; }
        #battleOpponentStrip{ left:10px; right:10px; bottom:10px; }
      }
    `;
    D.head.appendChild(style);
  }

  function buildDom(){
    injectStyles();

    UI.mount = D.getElementById('gameMount');
    if (!UI.mount) throw new Error('#gameMount not found');

    UI.mount.innerHTML = `
      <div id="battleEngineRoot">
        <div id="battleEngineStage">
          <div class="gjb-cloud c1"></div>
          <div class="gjb-cloud c2"></div>
          <div class="gjb-cloud c3"></div>

          <div id="battleHud">
            <div class="gjb-hud-row">
              <div class="gjb-pill" id="battleModePill">MODE battle</div>
              <div class="gjb-pill" id="battleRoomPill">ROOM -</div>
            </div>

            <div class="gjb-hud-row">
              <div class="gjb-stat">
                <div class="gjb-stat-k">SCORE</div>
                <div class="gjb-stat-v" id="battleScoreValue">0</div>
              </div>

              <div class="gjb-stat">
                <div class="gjb-stat-k">TIME</div>
                <div class="gjb-stat-v" id="battleTimeValue">0:00</div>
              </div>

              <div class="gjb-stat">
                <div class="gjb-stat-k">MISS</div>
                <div class="gjb-stat-v" id="battleMissValue">0</div>
              </div>

              <div class="gjb-stat">
                <div class="gjb-stat-k">BEST STREAK</div>
                <div class="gjb-stat-v" id="battleStreakValue">0</div>
              </div>

              <div class="gjb-gauge">
                <div class="gjb-gauge-head">
                  <span>HP</span>
                  <span id="battleHpValue">100/100</span>
                </div>
                <div class="gjb-gauge-bar">
                  <div class="gjb-gauge-fill" id="battleHpFill"></div>
                </div>
              </div>

              <div class="gjb-gauge">
                <div class="gjb-gauge-head">
                  <span>ATTACK CHARGE</span>
                  <span id="battleChargeValue">0/100</span>
                </div>
                <div class="gjb-gauge-bar">
                  <div class="gjb-gauge-fill" id="battleChargeFill"></div>
                </div>
              </div>
            </div>
          </div>

          <div id="battleBanner">กำลังเตรียมห้อง Battle…</div>
          <div id="battleField"></div>

          <div id="battleActionDock">
            <div id="attackReadyBadge">CHARGING</div>
            <button id="battleAttackBtn" type="button" disabled>⚡ ATTACK</button>
          </div>

          <div id="battleOpponentStrip"></div>
        </div>
      </div>
    `;

    UI.root = D.getElementById('battleEngineRoot');
    UI.field = D.getElementById('battleField');
    UI.statusBanner = D.getElementById('battleBanner');
    UI.attackBtn = D.getElementById('battleAttackBtn');

    UI.battleModePill = D.getElementById('battleModePill');
    UI.battleRoomPill = D.getElementById('battleRoomPill');
    UI.battleScoreValue = D.getElementById('battleScoreValue');
    UI.battleTimeValue = D.getElementById('battleTimeValue');
    UI.battleMissValue = D.getElementById('battleMissValue');
    UI.battleStreakValue = D.getElementById('battleStreakValue');
    UI.battleHpValue = D.getElementById('battleHpValue');
    UI.battleHpFill = D.getElementById('battleHpFill');
    UI.battleChargeValue = D.getElementById('battleChargeValue');
    UI.battleChargeFill = D.getElementById('battleChargeFill');
    UI.battleAttackReady = D.getElementById('attackReadyBadge');
    UI.opponentStrip = D.getElementById('battleOpponentStrip');

    UI.attackBtn.addEventListener('click', useAttack);
    W.addEventListener('keydown', (ev) => {
      if ((ev.code === 'Space' || ev.key === ' ') && !ev.repeat){
        ev.preventDefault();
        useAttack();
      }
    });
  }

  function setBanner(text, lockMs=0){
    if (!UI.statusBanner) return;
    const t = now();
    if (t < STATE.bannerLockUntil && lockMs === 0) return;
    UI.statusBanner.textContent = text;
    if (lockMs > 0) STATE.bannerLockUntil = t + lockMs;
  }

  function flashText(x, y, text, kind){
    if (!UI.field) return;
    const el = D.createElement('div');
    el.className = `gjb-hitfx ${kind || ''}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    UI.field.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  function renderHud(){
    if (UI.battleModePill) UI.battleModePill.textContent = 'MODE battle';
    if (UI.battleRoomPill) UI.battleRoomPill.textContent = `ROOM ${STATE.roomId || '-'}`;
    if (UI.battleScoreValue) UI.battleScoreValue.textContent = String(Math.max(0, Math.round(STATE.score)));
    if (UI.battleTimeValue) UI.battleTimeValue.textContent = formatClock(timeLeftSec());
    if (UI.battleMissValue) UI.battleMissValue.textContent = String(STATE.miss);
    if (UI.battleStreakValue) UI.battleStreakValue.textContent = String(STATE.bestStreak);

    if (UI.battleHpValue) UI.battleHpValue.textContent = `${STATE.hp}/${STATE.maxHp}`;
    if (UI.battleHpFill) UI.battleHpFill.style.width = `${((STATE.hp / Math.max(1, STATE.maxHp)) * 100).toFixed(1)}%`;

    if (UI.battleChargeValue) UI.battleChargeValue.textContent = `${STATE.attackCharge}/${STATE.maxAttackCharge}`;
    if (UI.battleChargeFill) UI.battleChargeFill.style.width = `${((STATE.attackCharge / Math.max(1, STATE.maxAttackCharge)) * 100).toFixed(1)}%`;

    if (UI.battleAttackReady){
      UI.battleAttackReady.textContent = STATE.attackReady ? 'ATTACK READY' : 'CHARGING';
      UI.battleAttackReady.style.color = STATE.attackReady ? '#2563eb' : '#7b7a72';
      UI.battleAttackReady.style.borderColor = STATE.attackReady ? '#7fcfff' : '#bfe3f2';
    }

    if (UI.attackBtn){
      UI.attackBtn.disabled = !(STATE.started && !STATE.finished && !STATE.localKo && STATE.attackReady && !!topOpponent());
      UI.attackBtn.textContent = STATE.attackReady ? '⚡ ATTACK' : '⚡ CHARGING';
    }

    renderOpponents();
    emitLiveEvents();
  }

  function renderOpponents(){
    if (!UI.opponentStrip) return;
    const opponents = opponentPlayers();

    if (!opponents.length){
      UI.opponentStrip.innerHTML = `
        <div class="gjb-opponent-card">
          <div class="gjb-opponent-top">
            <div class="gjb-opponent-name">รอคู่ต่อสู้</div>
            <div>⌛</div>
          </div>
          <div class="gjb-opponent-mini">เมื่ออีกฝั่งเข้ามา จะเห็นคะแนนและ HP ที่นี่</div>
        </div>
      `;
      return;
    }

    UI.opponentStrip.innerHTML = opponents.map((p) => {
      const alive = num(p.hp, 100) > 0;
      return `
        <div class="gjb-opponent-card">
          <div class="gjb-opponent-top">
            <div class="gjb-opponent-name">${escapeHtml(p.name || p.nick || 'Opponent')}</div>
            <div>${alive ? '⚔️' : '💥'}</div>
          </div>
          <div class="gjb-opponent-mini">
            Score ${num(p.score,0)} • HP ${num(p.hp,100)}/${num(p.maxHp,100)} • Miss ${num(p.miss,0)}
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fieldRect(){
    const r = UI.field.getBoundingClientRect();
    return {
      w: Math.max(320, Math.round(r.width || 960)),
      h: Math.max(400, Math.round(r.height || 580))
    };
  }

  function timeLeftSec(){
    const endsAt = currentRoomEndsAt();
    if (!endsAt) return STATE.started ? 0 : STATE.timeSec;
    return Math.max(0, (endsAt - now()) / 1000);
  }

  function makeTarget(kind){
    const rect = fieldRect();
    const size = Math.round(60 + STATE.rng() * 28);
    const pad = 10;
    const x = pad + Math.round((rect.w - size - pad * 2) * STATE.rng());
    const y = -size - Math.round(STATE.rng() * 30);
    const speed = STATE.cfg.speed * (0.9 + STATE.rng() * 0.55);
    const ttl = Math.round(STATE.cfg.ttl * (0.92 + STATE.rng() * 0.18));
    const sway = (STATE.rng() - 0.5) * 52;
    const bank = kind === 'good' ? GOOD_ITEMS : JUNK_ITEMS;
    const pick = bank[Math.floor(STATE.rng() * bank.length)];

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `gjb-target ${kind}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = `<span class="emoji">${pick.emoji}</span>`;
    el.setAttribute('aria-label', pick.name);

    const t = {
      id: `t-${++STATE.seq}`,
      kind,
      x, y, size, speed, ttl, sway,
      bornAt: now(),
      el,
      dead: false
    };

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      hitTarget(t);
    }, { passive:false });

    UI.field.appendChild(el);
    STATE.targets.push(t);
  }

  function spawnTarget(){
    if (!STATE.started || STATE.finished || STATE.localKo) return;
    if (STATE.targets.length >= STATE.cfg.maxTargets) return;
    const kind = STATE.rng() < STATE.cfg.goodRatio ? 'good' : 'junk';
    makeTarget(kind);
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try { t.el.remove(); } catch {}
  }

  function scheduleSync(force=false){
    if (!STATE.refs.self) return;
    if (force){
      syncSelfNow(true);
      return;
    }
    if (STATE.syncTimer) return;
    STATE.syncTimer = setTimeout(() => {
      STATE.syncTimer = 0;
      syncSelfNow(false);
    }, 60);
  }

  async function syncSelfNow(force){
    if (!STATE.refs.self) return;
    const t = now();
    if (!force && (t - STATE.lastSyncTs < SYNC_MIN_MS)) return;

    STATE.lastSyncTs = t;

    const status = STATE.finished
      ? 'finished'
      : STATE.localKo
        ? 'ko'
        : STATE.started
          ? 'playing'
          : 'waiting';

    const payload = {
      pid: STATE.pid,
      uid: STATE.uid,
      playerId: STATE.uid,
      name: STATE.name,
      nick: STATE.name,
      connected: true,
      ready: true,
      status,
      score: Math.max(0, Math.round(STATE.score)),
      miss: Math.max(0, STATE.miss),
      combo: Math.max(0, STATE.streak),
      bestStreak: Math.max(0, STATE.bestStreak),
      hp: Math.max(0, STATE.hp),
      maxHp: Math.max(1, STATE.maxHp),
      shield: Math.max(0, STATE.shield),
      attackCharge: Math.max(0, STATE.attackCharge),
      maxAttackCharge: Math.max(1, STATE.maxAttackCharge),
      attackReady: !!STATE.attackReady,
      attacksUsed: Math.max(0, STATE.attacksUsed),
      damageDealt: Math.max(0, STATE.damageDealt),
      damageTaken: Math.max(0, STATE.damageTaken),
      koCount: Math.max(0, STATE.koCount),
      updatedAt: t,
      lastSeen: t
    };

    if (STATE.lastAttackId){
      payload.lastAttackId = STATE.lastAttackId;
      payload.lastAttackAt = STATE.lastAttackAt;
      payload.lastAttackDamage = STATE.lastAttackDamage;
      payload.lastAttackTarget = STATE.lastAttackTarget;
    }

    try {
      await STATE.refs.self.update(payload);
    } catch (err){
      console.warn('[gj-battle] syncSelfNow failed:', err);
    }
  }

  function addCharge(delta){
    STATE.attackCharge = clamp(STATE.attackCharge + delta, 0, STATE.maxAttackCharge);
    STATE.attackReady = STATE.attackCharge >= STATE.maxAttackCharge;
  }

  function pulseScore(){
    const el = UI.battleScoreValue;
    if (!el || !el.animate) return;
    el.animate(
      [{ transform:'scale(1)' }, { transform:'scale(1.08)' }, { transform:'scale(1)' }],
      { duration:180, easing:'ease-out' }
    );
  }

  function hitTarget(t){
    if (!t || t.dead || !STATE.started || STATE.finished || STATE.localKo) return;
    removeTarget(t);

    if (t.kind === 'good'){
      STATE.streak += 1;
      STATE.bestStreak = Math.max(STATE.bestStreak, STATE.streak);
      STATE.goodHit += 1;

      const bonus = Math.min(12, Math.floor(STATE.streak / 3) * 2);
      STATE.score += 10 + bonus;
      addCharge(20);

      pulseScore();
      flashText(t.x, t.y, `+${10 + bonus}`, 'good');
      setBanner('เก่งมาก! แตะอาหารดีต่อเนื่องเพื่อชาร์จพลังโจมตี', 900);
    } else {
      STATE.junkHit += 1;
      STATE.miss += 1;
      STATE.streak = 0;
      STATE.score = Math.max(0, STATE.score - 8);
      STATE.hp = Math.max(0, STATE.hp - 8);
      addCharge(-10);

      flashText(t.x, t.y, '-8', 'bad');
      setBanner('โดน junk! คะแนนและ HP ลดลง', 900);
      applyLocalDamageCheck();
    }

    renderHud();
    scheduleSync(false);
  }

  function expireTarget(t){
    removeTarget(t);

    if (t.kind === 'good'){
      STATE.miss += 1;
      STATE.streak = 0;
      STATE.hp = Math.max(0, STATE.hp - 2);
      flashText(t.x, t.y, 'MISS', 'bad');
      setBanner('อาหารดีหลุดไปแล้ว ระวังให้มากขึ้นอีกนิด', 800);
      applyLocalDamageCheck();
      renderHud();
      scheduleSync(false);
    }
  }

  function applyLocalDamageCheck(){
    if (STATE.hp <= 0){
      STATE.hp = 0;
      STATE.localKo = true;
      STATE.attackCharge = 0;
      STATE.attackReady = false;
      setBanner('HP หมดแล้ว! รอระบบสรุปรอบนี้…', 1600);
      renderHud();
      scheduleSync(true);
      maybeHostEndRound();
    }
  }

  function useAttack(){
    if (!STATE.started || STATE.finished || STATE.localKo || !STATE.attackReady) return;
    const opp = topOpponent();
    if (!opp) return;

    const dmg = STATE.cfg.atkDamage || 18;
    const attackId = `atk-${STATE.uid}-${now()}-${Math.random().toString(36).slice(2,6)}`;

    STATE.attacksUsed += 1;
    STATE.attackCharge = 0;
    STATE.attackReady = false;
    STATE.damageDealt += dmg;
    STATE.lastAttackId = attackId;
    STATE.lastAttackAt = now();
    STATE.lastAttackDamage = dmg;
    STATE.lastAttackTarget = opp.uid || opp.playerId || opp.key || '';

    flashText(fieldRect().w * 0.52, fieldRect().h * 0.42, `⚡-${dmg}`, 'atk');
    setBanner(`ปล่อย ATTACK ใส่ ${opp.name || 'คู่ต่อสู้'} แล้ว!`, 1000);

    renderHud();
    scheduleSync(true);
  }

  function processRemoteAttacks(playersMap){
    const selfKey = getSelfKey();
    const players = normalizeRoomPlayersMap(playersMap);

    Object.keys(players).forEach((key) => {
      if (key === selfKey) return;

      const p = players[key] || {};
      const attackId = cleanText(p.lastAttackId || '', 120);
      if (!attackId) return;
      if (STATE.seenAttackIds[key] === attackId) return;

      const target = cleanPid(p.lastAttackTarget || '');
      const selfCandidates = new Set([selfKey, STATE.uid, STATE.pid].filter(Boolean));
      if (target && !selfCandidates.has(target)){
        STATE.seenAttackIds[key] = attackId;
        return;
      }

      const attackAt = num(p.lastAttackAt, 0);
      const roundStart = currentStartedAt();
      if (roundStart && attackAt && attackAt < roundStart - 500){
        STATE.seenAttackIds[key] = attackId;
        return;
      }

      const dmg = clamp(num(p.lastAttackDamage, 0), 0, 100);
      if (dmg <= 0){
        STATE.seenAttackIds[key] = attackId;
        return;
      }

      STATE.seenAttackIds[key] = attackId;
      if (!STATE.started || STATE.finished || STATE.localKo) return;

      STATE.damageTaken += dmg;
      STATE.hp = Math.max(0, STATE.hp - dmg);
      flashText(fieldRect().w * 0.34, fieldRect().h * 0.28, `-${dmg} HP`, 'bad');
      setBanner(`${p.name || 'คู่ต่อสู้'} ใช้ ATTACK ใส่คุณ!`, 1000);
      applyLocalDamageCheck();
      renderHud();
      scheduleSync(true);
    });
  }

  function maybeAwardKoFromOpponentState(){
    const opp = topOpponent();
    if (!opp) return;
    if (num(opp.hp, 100) <= 0 && STATE.hp > 0){
      STATE.koCount = Math.max(STATE.koCount, 1);
    }
  }

  function hydrateLocalFromSelf(){
    const me = selfPlayer();
    if (!me) return;

    if ((!STATE.name || STATE.name === 'Player') && me.name){
      STATE.name = cleanText(me.name, 40);
    }

    if (!STATE.started){
      STATE.score = num(me.score, 0);
      STATE.miss = num(me.miss, 0);
      STATE.bestStreak = num(me.bestStreak, 0);
      STATE.hp = clamp(me.hp, 0, 100);
      STATE.maxHp = Math.max(1, num(me.maxHp, 100));
      STATE.attackCharge = clamp(me.attackCharge, 0, 100);
      STATE.maxAttackCharge = Math.max(1, num(me.maxAttackCharge, 100));
      STATE.attackReady = !!me.attackReady;
      STATE.attacksUsed = num(me.attacksUsed, 0);
      STATE.damageDealt = num(me.damageDealt, 0);
      STATE.damageTaken = num(me.damageTaken, 0);
      STATE.koCount = num(me.koCount, 0);
    }
  }

  function updatePlayersFromRoom(playersValue){
    STATE.room.players = normalizeRoomPlayersMap(playersValue);
    hydrateLocalFromSelf();
    maybeAwardKoFromOpponentState();
    processRemoteAttacks(STATE.room.players);
    renderHud();
  }

  async function maybePromoteCountdownToPlaying(){
    if (!isHost() || !STATE.roomRef || STATE.countdownPromoteBusy) return false;
    if (roomStatus() !== 'countdown') return false;

    const countdownEndsAt = currentCountdownEndsAt();
    if (!countdownEndsAt || now() < countdownEndsAt) return false;

    STATE.countdownPromoteBusy = true;
    try{
      await new Promise((resolve, reject) => {
        STATE.roomRef.transaction((cur) => {
          cur = cur || {};
          cur.meta = cur.meta || {};
          cur.state = cur.state || {};
          cur.players = cur.players || {};

          if (String(cur.state.status || '') !== 'countdown') return cur;

          const t = now();
          const plannedSec = clamp(cur.state.plannedSec || STATE.timeSec || 150, 30, 300);
          const roundToken = cleanText(cur.state.roundToken || `r-${t}-${Math.random().toString(36).slice(2,7)}`, 120);

          cur.state.status = 'playing';
          cur.state.startedAt = t;
          cur.state.endsAt = t + plannedSec * 1000;
          cur.state.countdownEndsAt = 0;
          cur.state.roundToken = roundToken;
          cur.state.updatedAt = t;

          Object.keys(cur.players).forEach((key) => {
            const p = cur.players[key] || {};
            cur.players[key] = Object.assign({}, p, {
              pid: cleanPid(p.pid || p.playerId || p.uid || key),
              uid: cleanPid(p.uid || p.playerId || key),
              playerId: cleanPid(p.playerId || p.uid || key),
              name: cleanText(p.name || p.nick || 'Player', 40),
              nick: cleanText(p.nick || p.name || 'Player', 40),
              connected: p.connected !== false,
              ready: true,
              status: 'playing',
              score: 0,
              miss: 0,
              combo: 0,
              bestStreak: 0,
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
              updatedAt: t,
              lastSeen: t,
              lastAttackId: '',
              lastAttackAt: 0,
              lastAttackDamage: 0,
              lastAttackTarget: ''
            });
          });

          return cur;
        }, (err, committed) => {
          if (err) return reject(err);
          if (!committed) return reject(new Error('countdown-promote-not-committed'));
          resolve();
        }, false);
      });

      return true;
    }catch(err){
      console.warn('[gj-battle] promote countdown->playing failed:', err);
      return false;
    }finally{
      STATE.countdownPromoteBusy = false;
    }
  }

  async function maybeHostEndRound(){
    if (!isHost() || !STATE.refs.state || STATE.hostEndingBusy) return;
    const status = roomStatus();
    if (status !== 'playing') return;

    const endsAt = currentRoomEndsAt();
    const actives = activePlayers();
    const anyKo = actives.some((p) => num(p.hp, 100) <= 0);
    const timeUp = endsAt > 0 && now() >= endsAt;

    if (!timeUp && !anyKo) return;

    STATE.hostEndingBusy = true;
    try{
      await STATE.refs.state.transaction((cur) => {
        cur = cur || {};
        if (String(cur.status || '') !== 'playing') return cur;
        cur.status = 'ended';
        cur.endedAt = now();
        cur.updatedAt = now();
        return cur;
      });
    } catch (err){
      console.warn('[gj-battle] host end round failed:', err);
    } finally {
      STATE.hostEndingBusy = false;
    }
  }

  function clearTargets(){
    STATE.targets.forEach(removeTarget);
    STATE.targets = [];
  }

  function resetLocalRoundStateFromRoom(){
    const me = selfPlayer();

    STATE.started = false;
    STATE.finished = false;
    STATE.localKo = false;
    STATE.lastFrameTs = 0;
    STATE.lastSpawnAt = 0;
    STATE.targets = [];
    STATE.seq = 0;
    STATE.seenAttackIds = Object.create(null);

    STATE.score = num(me && me.score, 0);
    STATE.miss = num(me && me.miss, 0);
    STATE.streak = 0;
    STATE.bestStreak = num(me && me.bestStreak, 0);
    STATE.hp = clamp(me && me.hp, 0, 100);
    STATE.maxHp = Math.max(1, num(me && me.maxHp, 100));
    STATE.shield = num(me && me.shield, 0);
    STATE.attackCharge = clamp(me && me.attackCharge, 0, 100);
    STATE.maxAttackCharge = Math.max(1, num(me && me.maxAttackCharge, 100));
    STATE.attackReady = !!(me && me.attackReady);
    STATE.attacksUsed = num(me && me.attacksUsed, 0);
    STATE.damageDealt = num(me && me.damageDealt, 0);
    STATE.damageTaken = num(me && me.damageTaken, 0);
    STATE.koCount = num(me && me.koCount, 0);
    STATE.goodHit = 0;
    STATE.junkHit = 0;
    STATE.lastAttackId = '';
    STATE.lastAttackAt = 0;
    STATE.lastAttackDamage = 0;
    STATE.lastAttackTarget = '';

    STATE.cfg = getCfg();
  }

  function loop(frameTs){
    if (STATE.finished) return;

    const status = roomStatus();
    if (status === 'ended' || status === 'finished'){
      finishGame('room-ended');
      return;
    }

    if (!STATE.started){
      renderHud();
      STATE.loopId = raf(loop);
      return;
    }

    const ts = Number(frameTs || performance.now());
    if (!STATE.lastFrameTs) STATE.lastFrameTs = ts;
    const dt = Math.min(40, ts - STATE.lastFrameTs) / 1000;
    STATE.lastFrameTs = ts;

    const tNow = now();
    if (!STATE.localKo && tNow - STATE.lastSpawnAt >= STATE.cfg.spawnEvery){
      STATE.lastSpawnAt = tNow;
      spawnTarget();
    }

    const rect = fieldRect();

    for (let i = STATE.targets.length - 1; i >= 0; i--){
      const t = STATE.targets[i];
      if (!t || t.dead){
        STATE.targets.splice(i, 1);
        continue;
      }

      t.y += t.speed * dt;
      t.x += Math.sin((tNow - t.bornAt) / 240) * t.sway * dt;
      t.x = Math.max(2, Math.min(rect.w - t.size - 2, t.x));

      t.el.style.left = `${t.x.toFixed(1)}px`;
      t.el.style.top = `${t.y.toFixed(1)}px`;

      const expired = (tNow - t.bornAt > t.ttl) || (t.y > rect.h + t.size + 8);
      if (expired){
        STATE.targets.splice(i, 1);
        expireTarget(t);
      }
    }

    if (isHost()) maybeHostEndRound();

    if (currentRoomEndsAt() && now() >= currentRoomEndsAt()){
      if (isHost()){
        maybeHostEndRound();
      } else if (roomStatus() !== 'ended' && roomStatus() !== 'finished'){
        setBanner('หมดเวลาแล้ว รอหัวหน้าห้องปิดรอบ…', 1200);
      }
    }

    renderHud();
    STATE.loopId = raf(loop);
  }

  function computeResultSummary(reason){
    const players = roomPlayersArray().map((p) => ({
      key: p.key,
      pid: p.pid,
      uid: p.uid,
      playerId: p.playerId,
      name: p.name,
      score: num(p.score, 0),
      miss: num(p.miss, 0),
      bestStreak: num(p.bestStreak, 0),
      hp: num(p.hp, 100),
      maxHp: num(p.maxHp, 100),
      koCount: num(p.koCount, 0),
      alive: num(p.hp, 100) > 0
    }));

    players.sort((a, b) => {
      if (Number(b.alive) !== Number(a.alive)) return Number(b.alive) - Number(a.alive);
      if (b.score !== a.score) return b.score - a.score;
      if (b.hp !== a.hp) return b.hp - a.hp;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      if (b.koCount !== a.koCount) return b.koCount - a.koCount;
      return String(a.name || '').localeCompare(String(b.name || ''), 'th');
    });

    const me = players.find((p) => p.key === getSelfKey() || (STATE.pid && p.pid === STATE.pid)) || null;
    const rank = me ? (players.findIndex((p) => p.key === me.key) + 1) : '';
    const opp = players.find((p) => !me || p.key !== me.key) || null;
    const result = rank === 1 ? 'win' : rank ? `อันดับ ${rank}` : 'finished';

    return {
      mode: 'battle',
      game: 'goodjunk-battle',
      roomId: STATE.roomId,
      pid: STATE.pid,
      uid: STATE.uid,
      name: STATE.name,
      rank,
      score: STATE.score,
      opponentScore: opp ? opp.score : '',
      players: players.length,
      miss: STATE.miss,
      bestStreak: STATE.bestStreak,
      result,
      reason: reason || 'finished',
      hp: STATE.hp,
      maxHp: STATE.maxHp,
      attackCharge: STATE.attackCharge,
      maxAttackCharge: STATE.maxAttackCharge,
      attackReady: STATE.attackReady,
      attacksUsed: STATE.attacksUsed,
      damageDealt: STATE.damageDealt,
      damageTaken: STATE.damageTaken,
      koCount: STATE.koCount,
      raw: {
        players,
        room: STATE.room,
        endedAt: now(),
        goodHit: STATE.goodHit,
        junkHit: STATE.junkHit
      }
    };
  }

  async function finishGame(reason){
    if (STATE.finished) return;
    STATE.finished = true;
    STATE.started = false;

    caf(STATE.loopId);
    clearTargets();

    setBanner('จบรอบแล้ว กำลังสรุปผล Battle…', 1500);
    scheduleSync(true);

    const detail = { summary: computeResultSummary(reason || 'finished') };

    updateGlobals();
    W.state.showSummary = true;
    W.state.finished = true;
    W.state.reason = reason || 'finished';

    emit('battle:finish', detail);
    emit('hha:battle:finish', detail);

    if (W.BattleSafe && typeof W.BattleSafe.finishGame === 'function'){
      try { W.BattleSafe.finishGame(detail.summary); } catch {}
    }
  }

  function startGameIfReady(){
    if (STATE.finished) return;
    if (roomStatus() !== 'playing') return;

    const startedAt = currentStartedAt();
    const endsAt = currentRoomEndsAt();
    const roundToken = currentRoundToken();

    if (!endsAt || !startedAt || !roundToken) return;

    if (STATE.started && STATE.startedRoundToken === roundToken) return;

    clearTargets();
    resetLocalRoundStateFromRoom();

    const seedHash = xmur3(`${STATE.seed}|${STATE.roomId}|${roundToken}|${STATE.pid}|${startedAt}`)();
    STATE.rng = mulberry32(seedHash);
    STATE.cfg = getCfg();
    STATE.started = true;
    STATE.finished = false;
    STATE.localKo = false;
    STATE.lastFrameTs = 0;
    STATE.lastSpawnAt = now();
    STATE.startedRoundToken = roundToken;
    STATE.roundPreparedToken = roundToken;

    setBanner('เริ่มแล้ว! แตะอาหารดี ชาร์จพลัง แล้วใช้ ATTACK ให้ถูกจังหวะ', 1300);
    renderHud();
    scheduleSync(true);

    caf(STATE.loopId);
    STATE.loopId = raf(loop);
  }

  async function ensureFirebaseReady(){
    if (!(W.firebase && W.firebase.apps && W.firebase.database && W.firebase.auth)){
      for (const src of FIREBASE_SDKS){
        await loadScript(src);
      }
    }

    const cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.__HHA_FIREBASE_CONFIG__ ||
      W.firebaseConfig ||
      null;

    if (W.firebase.apps && !W.firebase.apps.length){
      if (!cfg) throw new Error('Firebase config not found');
      W.firebase.initializeApp(cfg);
    }

    if (!W.firebase.apps || !W.firebase.apps.length){
      throw new Error('Firebase app init failed');
    }

    STATE.db = W.firebase.database();
    STATE.auth = W.firebase.auth();

    if (typeof W.HHA_ensureAnonymousAuth === 'function'){
      await W.HHA_ensureAnonymousAuth();
    } else if (!STATE.auth.currentUser){
      await STATE.auth.signInAnonymously();
    }

    const user = STATE.auth.currentUser;
    if (!user) throw new Error('Anonymous auth failed');

    STATE.uid = cleanPid(user.uid);
    STATE.firebaseReady = true;
  }

  function bindRoomRefs(){
    STATE.roomRef = STATE.db.ref(`${ROOT_PATH}/${STATE.roomId}`);
    STATE.refs.meta = STATE.roomRef.child('meta');
    STATE.refs.state = STATE.roomRef.child('state');
    STATE.refs.players = STATE.roomRef.child('players');
    STATE.refs.self = STATE.refs.players.child(getSelfKey());
  }

  async function ensureRoomExists(){
    const snap = await STATE.roomRef.once('value');
    if (snap.exists()){
      const room = snap.val() || {};
      STATE.room.meta = room.meta || {};
      STATE.room.state = room.state || {};
      STATE.room.players = normalizeRoomPlayersMap(room.players || {});
      return;
    }

    const t = now();
    const bootstrap = {
      meta: {
        roomId: STATE.roomId,
        game: 'goodjunk',
        mode: 'battle',
        diff: STATE.diff,
        hostPid: getSelfKey(),
        createdAt: t,
        updatedAt: t
      },
      state: {
        status: 'waiting',
        plannedSec: STATE.timeSec,
        countdownEndsAt: 0,
        startedAt: 0,
        endsAt: 0,
        roundToken: '',
        updatedAt: t
      },
      players: {}
    };

    await STATE.roomRef.set(bootstrap);
    STATE.room = bootstrap;
  }

  async function ensureSelfPlayerInRoom(){
    const t = now();
    const existing = (STATE.room.players || {})[getSelfKey()] || null;

    const base = {
      pid: STATE.pid,
      uid: STATE.uid,
      playerId: STATE.uid,
      name: STATE.name,
      nick: STATE.name,
      connected: true,
      ready: true,
      status: roomStatus() === 'playing' ? 'playing' : 'waiting',
      score: existing ? num(existing.score, 0) : 0,
      miss: existing ? num(existing.miss, 0) : 0,
      combo: 0,
      bestStreak: existing ? num(existing.bestStreak, 0) : 0,
      hp: existing ? clamp(existing.hp, 0, 100) : 100,
      maxHp: 100,
      shield: 0,
      attackCharge: existing ? clamp(existing.attackCharge, 0, 100) : 0,
      maxAttackCharge: 100,
      attackReady: !!(existing && existing.attackReady),
      attacksUsed: existing ? num(existing.attacksUsed, 0) : 0,
      damageDealt: existing ? num(existing.damageDealt, 0) : 0,
      damageTaken: existing ? num(existing.damageTaken, 0) : 0,
      koCount: existing ? num(existing.koCount, 0) : 0,
      joinedAt: existing ? num(existing.joinedAt, t) : t,
      updatedAt: t,
      lastSeen: t
    };

    await STATE.refs.self.update(base);

    try{
      STATE.refs.self.onDisconnect().update({
        connected: false,
        status: 'left',
        updatedAt: W.firebase.database.ServerValue.TIMESTAMP,
        lastSeen: W.firebase.database.ServerValue.TIMESTAMP
      });
    } catch {}
  }

  function attachRoomListeners(){
    STATE.refs.meta.on('value', (snap) => {
      STATE.room.meta = snap.val() || {};
      renderHud();
      updateGlobals();
    });

    STATE.refs.state.on('value', async (snap) => {
      STATE.room.state = snap.val() || {};
      renderHud();
      updateGlobals();

      const status = roomStatus();

      if (status === 'countdown'){
        const leftMs = currentCountdownEndsAt() - now();
        const sec = Math.max(0, Math.ceil(leftMs / 1000));
        setBanner(sec > 0 ? `Battle จะเริ่มใน ${sec}...` : 'กำลังเริ่มรอบ Battle...');
        await maybePromoteCountdownToPlaying();
        return;
      }

      if (status === 'playing'){
        startGameIfReady();
        return;
      }

      if ((status === 'ended' || status === 'finished') && !STATE.finished){
        finishGame('room-state-ended');
        return;
      }

      if (status === 'waiting' && !STATE.started && !STATE.finished){
        setBanner('รอหัวหน้าห้องเริ่มรอบ Battle…');
      }
    });

    STATE.refs.players.on('value', (snap) => {
      updatePlayersFromRoom(snap.val() || {});
      updateGlobals();

      if (isHost()) {
        maybeHostEndRound();
      }

      if (roomStatus() === 'playing'){
        startGameIfReady();
      }
    });
  }

  function startHeartbeat(){
    clearInterval(STATE.heartbeatId);
    STATE.heartbeatId = setInterval(() => {
      if (!STATE.refs.self) return;
      STATE.refs.self.update({
        connected: true,
        updatedAt: now(),
        lastSeen: now(),
        status: STATE.finished ? 'finished' : (STATE.localKo ? 'ko' : (STATE.started ? 'playing' : 'waiting'))
      }).catch(() => {});
    }, HEARTBEAT_MS);
  }

  async function initEngine(){
    buildDom();

    setBanner('กำลังเชื่อม GoodJunk Battle…');
    renderHud();

    await ensureFirebaseReady();

    const roomCandidates = roomIdCandidates(STATE.roomId || qs('roomId') || qs('room') || BOOT.roomId || RUN_CTX.roomId);
    STATE.roomId = roomCandidates[0] || STATE.roomId;
    if (!STATE.roomId){
      throw new Error('roomId missing');
    }

    bindRoomRefs();
    await ensureRoomExists();
    await ensureSelfPlayerInRoom();
    attachRoomListeners();
    startHeartbeat();

    STATE.cfg = getCfg();
    if (!STATE.rng){
      const seedHash = xmur3(`${STATE.seed}|${STATE.roomId}|${STATE.roundToken}|${STATE.pid}`)();
      STATE.rng = mulberry32(seedHash);
    }

    const status = roomStatus();
    if (status === 'countdown'){
      await maybePromoteCountdownToPlaying();
    } else if (status === 'playing'){
      startGameIfReady();
    } else {
      setBanner('เชื่อมห้องสำเร็จ รอสถานะเล่นจาก Lobby…');
    }

    renderHud();
    updateGlobals();
  }

  function failUi(err){
    console.error('[gj-battle] init failed:', err);
    try { buildDom(); } catch {}

    setBanner('เข้า GoodJunk Battle ไม่สำเร็จ');
    if (UI.opponentStrip){
      UI.opponentStrip.innerHTML = `
        <div class="gjb-opponent-card" style="min-width:320px;">
          <div class="gjb-opponent-top">
            <div class="gjb-opponent-name">เกิดปัญหาระหว่างเชื่อมเกม</div>
            <div>⚠️</div>
          </div>
          <div class="gjb-opponent-mini">${escapeHtml(String(err && err.message ? err.message : err))}</div>
          <div class="gjb-opponent-mini" style="margin-top:10px;">
            ลองกลับไปที่ Lobby แล้วเข้ารอบใหม่อีกครั้ง
          </div>
        </div>
      `;
    }
    renderHud();
  }

  W.addEventListener('beforeunload', () => {
    clearInterval(STATE.heartbeatId);
    clearTimeout(STATE.syncTimer);
    caf(STATE.loopId);

    try{
      if (STATE.refs && STATE.refs.self){
        STATE.refs.self.update({
          connected: false,
          status: STATE.finished ? 'finished' : 'left',
          updatedAt: now(),
          lastSeen: now()
        }).catch(() => {});
      }
    } catch {}
  });

  initEngine().catch(failUi);
})();