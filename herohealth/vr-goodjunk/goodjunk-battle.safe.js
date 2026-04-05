'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-battle.safe.js
 * GoodJunk Battle Engine
 * FULL PATCH v20260405-gjb-engine-r1
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_BATTLE_ENGINE_FULL_LOADED__) return;
  W.__GJ_BATTLE_ENGINE_FULL_LOADED__ = true;

  const ROOT_PATH = 'hha-battle/goodjunk/rooms';
  const HEARTBEAT_MS = 2500;
  const ACTIVE_TTL_MS = 15000;
  const SYNC_MIN_MS = 120;

  const GOOD_ITEMS = [
    { emoji:'🍎', name:'Apple' },
    { emoji:'🍌', name:'Banana' },
    { emoji:'🍉', name:'Watermelon' },
    { emoji:'🥕', name:'Carrot' },
    { emoji:'🥦', name:'Broccoli' },
    { emoji:'🥛', name:'Milk' },
    { emoji:'🥚', name:'Egg' },
    { emoji:'🐟', name:'Fish' }
  ];

  const JUNK_ITEMS = [
    { emoji:'🍟', name:'Fries' },
    { emoji:'🍔', name:'Burger' },
    { emoji:'🍕', name:'Pizza' },
    { emoji:'🍩', name:'Donut' },
    { emoji:'🥤', name:'Soda' },
    { emoji:'🍬', name:'Candy' },
    { emoji:'🍰', name:'Cake' },
    { emoji:'🌭', name:'Hotdog' }
  ];

  const q = new URLSearchParams(location.search);

  const UI = {
    mount: null,
    root: null,
    field: null,
    statusBanner: null,
    announcer: null,

    attackBtn: null,
    guardBtn: null,
    junkRainBtn: null,
    drainBtn: null,

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
    guardReadyBadge: null,
    junkRainReadyBadge: null,
    drainReadyBadge: null,

    opponentStrip: null
  };

  const STATE = {
    roomId: cleanRoom(qs('roomId') || qs('room') || ''),
    pid: cleanPid(qs('pid') || 'anon'),
    uid: '',
    name: cleanText(qs('name') || qs('nick') || 'Player', 80),
    hub: qs('hub') || '../hub.html',
    seed: cleanText(qs('seed') || String(Date.now()), 120),

    db: null,
    auth: null,
    roomRef: null,
    refs: { room:null, state:null, players:null, self:null },
    room: { meta:{}, state:{}, players:{} },
    listenersAttached: false,

    started: false,
    finished: false,
    localKo: false,

    seq: 0,
    targets: [],
    rng: Math.random,
    cfg: null,

    lastFrameTs: 0,
    lastSpawnAt: 0,
    lastRoundStartedAt: 0,
    roundToken: '',

    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    hp: 100,
    maxHp: 100,
    attackCharge: 0,
    maxAttackCharge: 100,
    attackReady: false,

    goodHit: 0,
    junkHit: 0,
    attacksUsed: 0,
    damageDealt: 0,
    damageTaken: 0,
    koCount: 0,

    lastAttackId: '',
    lastAttackAt: 0,
    lastAttackDamage: 0,
    lastAttackTarget: '',
    seenAttackIds: Object.create(null),

    opponentPeekUntil: 0,
    bannerHideTimer: 0,
    bannerLockUntil: 0,

    hudPeekUntil: 0,
    hudHideTimer: 0,

    actionPeekUntil: 0,
    actionHideTimer: 0,

    guardActive: false,
    guardUntil: 0,
    guardCooldownUntil: 0,
    guardsUsed: 0,
    perfectGuardCount: 0,
    blockedDamage: 0,
    counterBonusUsed: 0,

    seenJunkRainIds: Object.create(null),
    junkRainUntil: 0,
    junkRainSent: 0,
    junkRainReceived: 0,
    lastJunkRainId: '',
    lastJunkRainAt: 0,
    lastJunkRainTarget: '',
    lastJunkRainDuration: 0,

    seenDrainIds: Object.create(null),
    drainUsed: 0,
    chargeDrained: 0,
    chargeLostToDrain: 0,
    lastDrainId: '',
    lastDrainAt: 0,
    lastDrainTarget: '',
    lastDrainAmount: 0,

    seenCounterIds: Object.create(null),
    counterTriggered: 0,
    counterDamageDealt: 0,
    counterDamageTaken: 0,
    lastCounterId: '',
    lastCounterAt: 0,
    lastCounterTarget: '',
    lastCounterDamage: 0,

    finisherUsed: 0,
    finisherBonusDamage: 0,
    bestAttackCombo: 0,

    rageTriggered: false,
    rageStartedAt: 0,
    rageAttackBonusDamage: 0,

    rageFinisherUsed: 0,
    rageFinisherBonusDamage: 0,

    opponentAttackReadyMap: Object.create(null),
    telegraphUntil: 0,

    announcerHideTimer: 0,
    lastCountdownCall: 999,

    leadSide: 'none',
    leadAnnounceLockUntil: 0,
    closeFinishCalled: false,

    leadChanges: 0,
    comebackCount: 0,
    biggestLead: 0,
    biggestDeficit: 0,

    koAnnounced: false,
    koFlashUntil: 0,
    koByAttack: 0,
    koTaken: 0,
    endedByKo: false,

    syncTimer: 0,
    lastSyncAt: 0,
    heartbeatId: 0,
    loopId: 0
  };

  /* ---------------- utils ---------------- */

  function qs(key, fb=''){
    try{
      const v = q.get(key);
      return v == null || v === '' ? fb : v;
    }catch{
      return fb;
    }
  }

  function num(v, d=0){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function clamp(v, a, b){
    v = num(v, a);
    return Math.max(a, Math.min(b, v));
  }

  function cleanText(v, max=120){
    return String(v == null ? '' : v).trim().slice(0, max);
  }

  function cleanPid(v){
    return String(v == null ? '' : v)
      .trim()
      .replace(/[.#$[\]/]/g, '-')
      .slice(0, 120);
  }

  function cleanRoom(v){
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 24);
  }

  function now(){
    return Date.now();
  }

  function raf(fn){
    return W.requestAnimationFrame(fn);
  }

  function caf(id){
    try{ W.cancelAnimationFrame(id); }catch{}
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function formatClock(sec){
    sec = Math.max(0, Math.round(num(sec, 0)));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function xmur3(str){
    str = String(str);
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

  function emit(name, detail){
    try{
      W.dispatchEvent(new CustomEvent(name, { detail }));
    }catch{}
  }

  function fieldRect(){
    const r = UI.field.getBoundingClientRect();
    return { x:r.left, y:r.top, w:r.width, h:r.height };
  }

  function currentStartedAt(){
    return num(STATE.room.state?.startedAt, 0);
  }

  function currentRoomEndsAt(){
    return num(STATE.room.state?.endsAt, 0);
  }

  function currentCountdownEndsAt(){
    return num(STATE.room.state?.countdownEndsAt, 0);
  }

  function roomStatus(){
    return cleanText(STATE.room.state?.status || 'waiting', 32) || 'waiting';
  }

  function timeLeftSec(){
    const endsAt = currentRoomEndsAt();
    if (!endsAt) return num(qs('time'), 150);
    return Math.max(0, (endsAt - now()) / 1000);
  }

  function getCfg(){
    const diff = cleanText(qs('diff') || STATE.room.meta?.diff || 'normal', 16).toLowerCase();
    const base = {
      easy:   { spawnEvery: 1180, speed: 120, ttl: 4300, maxTargets: 4, goodRatio: 0.66, atkDamage: 16 },
      normal: { spawnEvery: 980,  speed: 150, ttl: 3900, maxTargets: 5, goodRatio: 0.60, atkDamage: 18 },
      hard:   { spawnEvery: 840,  speed: 178, ttl: 3500, maxTargets: 6, goodRatio: 0.54, atkDamage: 20 }
    };
    return base[diff] || base.normal;
  }

  function selfPlayer(){
    const map = STATE.room.players || {};
    return map[STATE.uid] || null;
  }

  function activePlayers(){
    const t = now();
    const map = STATE.room.players || {};
    return Object.entries(map)
      .map(([key, p]) => Object.assign({ key }, p || {}))
      .filter((p) => {
        if (p.connected === false) return false;
        const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
        if (!lastSeen) return true;
        return (t - lastSeen) <= ACTIVE_TTL_MS;
      })
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function opponentPlayers(){
    return activePlayers()
      .filter((p) => cleanPid(p.uid || p.playerId || p.pid || p.key) !== STATE.uid);
  }

  function topOpponent(){
    return opponentPlayers()[0] || null;
  }

  function getSelfKey(){
    return STATE.uid;
  }

  function normalizeRoomPlayersMap(playersMap){
    const out = {};
    const src = playersMap && typeof playersMap === 'object' ? playersMap : {};
    Object.keys(src).forEach((key) => {
      const p = src[key] || {};
      out[key] = Object.assign({ key }, p);
    });
    return out;
  }

  /* ---------------- styles / dom ---------------- */

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
      #battleEngineStage{ position:absolute; inset:0; overflow:hidden; }
      #battleField{ position:absolute; inset:0; overflow:hidden; }
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
        transition:opacity .16s ease, transform .16s ease;
      }
      #battleHud.is-hidden-mobile{
        opacity:0;
        transform:translateY(-8px);
        pointer-events:none;
      }

      .gjb-hud-row{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
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
      .gjb-stat{ min-width:108px; padding:10px 12px; text-align:center; }
      .gjb-stat-k{ font-size:11px; color:#7b7a72; font-weight:1000; }
      .gjb-stat-v{ margin-top:5px; font-size:22px; line-height:1; font-weight:1000; color:#244260; }

      .gjb-gauge{ padding:10px 12px; min-width:190px; }
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
        transition:opacity .18s ease, transform .18s ease;
      }
      #battleOpponentStrip.is-hidden-mobile{
        opacity:0;
        transform:translateY(10px);
        pointer-events:none;
      }
      #battleOpponentStrip.is-peek{
        opacity:1;
        transform:translateY(0);
        pointer-events:auto;
      }

      .gjb-opponent-card{
        position:relative; overflow:hidden;
        min-width:220px; padding:12px 14px; color:#4d4a42;
      }
      .gjb-opponent-top{
        display:flex; justify-content:space-between; gap:8px; align-items:center;
      }
      .gjb-opponent-name{ font-size:15px; font-weight:1000; }
      .gjb-opponent-mini{
        margin-top:7px; font-size:12px; color:#7b7a72; font-weight:1000;
      }

      .gjb-opponent-statusline{
        margin-top:8px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        flex-wrap:wrap;
      }
      .gjb-opponent-primary{
        display:inline-flex;
        align-items:center;
        gap:6px;
        min-height:28px;
        padding:5px 10px;
        border-radius:999px;
        font-size:11px;
        font-weight:1000;
        border:2px solid #bfe3f2;
        background:#f8fdff;
        color:#4d4a42;
      }
      .gjb-opponent-primary.attack{ background:#fff1e7; border-color:#ffd0c7; color:#b45309; }
      .gjb-opponent-primary.guard{ background:#f7f0ff; border-color:#ddd0ff; color:#7c3aed; }
      .gjb-opponent-primary.drain{ background:#eef9ff; border-color:#c8e9ff; color:#0369a1; }
      .gjb-opponent-primary.junk{ background:#fff7ea; border-color:#ffe0b8; color:#d97706; }
      .gjb-opponent-primary.rage{ background:#fff8ef; border-color:#ffd89b; color:#c26a00; }

      .gjb-opponent-secondary{ display:flex; gap:6px; flex-wrap:wrap; }
      .gjb-op-chip{
        display:inline-flex;
        align-items:center;
        gap:5px;
        min-height:22px;
        padding:3px 7px;
        border-radius:999px;
        font-size:9px;
        font-weight:1000;
        border:2px solid #d7edf8;
        background:#ffffff;
        color:#6d6a62;
      }

      .gjb-op-bars{ margin-top:8px; display:grid; gap:6px; }
      .gjb-op-bar{
        display:grid;
        grid-template-columns:52px 1fr 42px;
        gap:6px;
        align-items:center;
      }
      .gjb-op-bar-label{
        font-size:9px;
        font-weight:1000;
        color:#7b7a72;
        text-align:left;
      }
      .gjb-op-bar-track{
        position:relative;
        height:8px;
        border-radius:999px;
        overflow:hidden;
        background:#eef7fd;
      }
      .gjb-op-bar-fill{
        position:absolute; left:0; top:0; bottom:0; width:0%;
        border-radius:999px;
      }
      .gjb-op-bar-fill.hp{ background:linear-gradient(90deg,#7ed957,#58c33f); }
      .gjb-op-bar-fill.charge{ background:linear-gradient(90deg,#7fcfff,#58b7f5); }
      .gjb-op-bar-value{
        font-size:9px; font-weight:1000; color:#6d6b63; text-align:right;
      }

      #battleBanner{
        position:absolute; left:50%; top:110px; transform:translateX(-50%);
        z-index:7; min-width:min(92vw,520px); max-width:min(92vw,620px);
        border-radius:22px; padding:12px 16px;
        border:2px solid #bfe3f2;
        background:rgba(255,255,255,.95);
        box-shadow:0 14px 24px rgba(86,155,194,.16);
        color:#4d4a42; text-align:center; font-size:14px; line-height:1.6; font-weight:1000;
        transition:opacity .16s ease, transform .16s ease;
      }
      #battleBanner.is-hidden{
        opacity:0;
        transform:translateX(-50%) translateY(-8px);
        pointer-events:none;
      }
      #battleBanner.is-danger{
        border-color:#ffd0c7;
        background:rgba(255,246,243,.96);
        color:#b45309;
      }
      #battleBanner.is-rage{
        border-color:#ffe0b8;
        background:rgba(255,251,243,.96);
        color:#c26a00;
      }
      #battleBanner.is-ko{
        border-color:#ffd0c7;
        background:rgba(255,246,243,.98);
        color:#b91c1c;
      }

      #battleAnnouncer{
        position:absolute; left:50%; top:154px; transform:translateX(-50%);
        z-index:8;
        min-width:min(86vw,380px); max-width:min(90vw,540px);
        padding:10px 14px; border-radius:18px;
        background:rgba(255,255,255,.96);
        border:2px solid #bfe3f2;
        box-shadow:0 14px 24px rgba(86,155,194,.16);
        color:#244260; text-align:center; font-size:20px; line-height:1.2; font-weight:1000;
        opacity:0; pointer-events:none;
        transition:opacity .14s ease, transform .14s ease;
      }
      #battleAnnouncer.is-show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }
      #battleAnnouncer.is-win{ border-color:#cdeebd; color:#4f7f1f; background:rgba(247,255,243,.97); }
      #battleAnnouncer.is-warn{ border-color:#ffd0c7; color:#b45309; background:rgba(255,246,243,.97); }
      #battleAnnouncer.is-skill{ border-color:#d8e8ff; color:#2563eb; background:rgba(247,251,255,.97); }
      #battleAnnouncer.is-ko{ border-color:#ffd0c7; color:#b91c1c; background:rgba(255,246,243,.98); }

      #battleActionDock{
        position:absolute; right:14px; bottom:86px; z-index:8; pointer-events:auto;
        display:grid; gap:8px; justify-items:end;
        transition:opacity .16s ease, transform .16s ease;
      }
      #battleActionDock.is-hidden-mobile{
        opacity:0;
        transform:translateY(8px);
        pointer-events:none;
      }

      #battleAttackBtn,
      #battleGuardBtn,
      #battleJunkRainBtn,
      #battleDrainBtn{
        appearance:none; border:none; cursor:pointer;
        min-width:146px; min-height:50px; padding:11px 16px;
        border-radius:18px; font-size:15px; font-weight:1000;
        color:#fffef9;
        transition:transform .12s ease, opacity .12s ease, filter .12s ease;
      }
      #battleAttackBtn{ background:linear-gradient(180deg,#7fcfff,#58b7f5); box-shadow:0 14px 24px rgba(86,155,194,.18); min-height:54px; }
      #battleGuardBtn{ background:linear-gradient(180deg,#c4b5fd,#8b5cf6); box-shadow:0 14px 24px rgba(139,92,246,.18); }
      #battleJunkRainBtn{ background:linear-gradient(180deg,#ffb547,#f97316); box-shadow:0 14px 24px rgba(249,115,22,.18); }
      #battleDrainBtn{ background:linear-gradient(180deg,#22d3ee,#0ea5e9); box-shadow:0 14px 24px rgba(14,165,233,.18); }
      #battleAttackBtn:hover,#battleGuardBtn:hover,#battleJunkRainBtn:hover,#battleDrainBtn:hover{ transform:translateY(-1px); filter:brightness(1.03); }
      #battleAttackBtn:active,#battleGuardBtn:active,#battleJunkRainBtn:active,#battleDrainBtn:active{ transform:translateY(0); }
      #battleAttackBtn:disabled,#battleGuardBtn:disabled,#battleJunkRainBtn:disabled,#battleDrainBtn:disabled{
        cursor:not-allowed; opacity:.55; filter:grayscale(.06); transform:none;
      }

      #attackReadyBadge,#guardReadyBadge,#junkRainReadyBadge,#drainReadyBadge{
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
      .gjb-target.good{ background:linear-gradient(180deg,#ffffff,#f1fff1); }
      .gjb-target.junk{ background:linear-gradient(180deg,#fff3f3,#ffe1e1); }
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

      #battleField.is-junk-rain::after{
        content:"";
        position:absolute; inset:0;
        background:
          radial-gradient(circle at 25% 24%, rgba(255,181,71,.16), transparent 18%),
          radial-gradient(circle at 72% 30%, rgba(249,115,22,.14), transparent 18%),
          radial-gradient(circle at 58% 70%, rgba(255,99,71,.10), transparent 20%);
        pointer-events:none;
      }
      #battleField.is-rage::before{
        content:"";
        position:absolute; inset:0;
        background:
          radial-gradient(circle at 20% 22%, rgba(255,181,71,.10), transparent 20%),
          radial-gradient(circle at 78% 18%, rgba(249,115,22,.12), transparent 22%),
          radial-gradient(circle at 52% 78%, rgba(255,212,92,.08), transparent 24%);
        pointer-events:none;
      }
      #battleField.is-ko-flash::after{
        content:"";
        position:absolute; inset:0;
        background:
          radial-gradient(circle at 50% 50%, rgba(255,255,255,.10), transparent 28%),
          radial-gradient(circle at 50% 50%, rgba(255,155,138,.14), transparent 52%);
        pointer-events:none;
      }

      @keyframes gjb-float{
        0%{ opacity:0; transform:translateY(8px) scale(.9); }
        15%{ opacity:1; }
        100%{ opacity:0; transform:translateY(-28px) scale(1.04); }
      }

      @media (max-width:640px){
        #battleHud{ left:6px; right:6px; top:6px; gap:4px; }
        #battleHud .gjb-hud-row:first-child{ display:none; }
        #battleHud .gjb-hud-row:nth-child(2){
          display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; align-items:start;
        }
        #battleHud .gjb-hud-row:nth-child(2) .gjb-stat:nth-child(3),
        #battleHud .gjb-hud-row:nth-child(2) .gjb-stat:nth-child(4){ display:none; }

        .gjb-pill{ min-height:26px; padding:4px 6px; font-size:9px; border-radius:10px; }
        .gjb-stat{ min-width:0; width:100%; padding:6px 6px; border-radius:10px; }
        .gjb-stat-k{ font-size:8px; }
        .gjb-stat-v{ font-size:15px; }

        .gjb-gauge{ min-width:0; width:100%; padding:6px 7px; border-radius:10px; grid-column:span 2; }
        .gjb-gauge-head{ font-size:9px; }
        .gjb-gauge-bar{ height:10px; margin-top:5px; }

        #battleBanner{ top:54px; min-width:min(92vw,360px); padding:6px 8px; font-size:10px; border-radius:12px; }
        #battleAnnouncer{ top:82px; min-width:min(86vw,280px); font-size:14px; padding:6px 10px; border-radius:14px; }

        #battleActionDock{ right:6px; bottom:6px; gap:4px; }
        #battleAttackBtn,#battleGuardBtn,#battleJunkRainBtn,#battleDrainBtn{
          min-width:82px; min-height:32px; padding:4px 6px; font-size:10px; border-radius:10px;
        }
        #attackReadyBadge,#guardReadyBadge,#junkRainReadyBadge,#drainReadyBadge{
          min-height:22px; padding:3px 6px; font-size:8px; border-radius:999px;
        }

        #battleOpponentStrip{ left:6px; right:98px; bottom:6px; gap:4px; }
        #battleOpponentStrip.is-hidden-mobile{ opacity:0; transform:translateY(12px); pointer-events:none; }
        #battleOpponentStrip.is-peek{ opacity:1; transform:translateY(0); pointer-events:auto; }

        .gjb-opponent-card{ width:100%; min-width:0; padding:6px 8px; border-radius:10px; }
        .gjb-opponent-name{ font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gjb-opponent-mini{ margin-top:3px; font-size:9px; line-height:1.3; }

        .gjb-opponent-statusline{ margin-top:5px; gap:6px; }
        .gjb-opponent-primary{ min-height:22px; padding:3px 7px; font-size:8px; }
        .gjb-op-chip{ min-height:18px; padding:2px 6px; font-size:7px; }

        .gjb-op-bars{ margin-top:5px; gap:4px; }
        .gjb-op-bar{ grid-template-columns:42px 1fr 34px; gap:5px; }
        .gjb-op-bar-label,.gjb-op-bar-value{ font-size:7px; }
        .gjb-op-bar-track{ height:6px; }

        .gjb-target{ border-radius:16px; min-width:48px; min-height:48px; }
        .gjb-target .emoji{ font-size:clamp(22px, 7vw, 30px); }
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
          <div id="battleAnnouncer" aria-live="polite"></div>
          <div id="battleField"></div>

          <div id="battleActionDock">
            <div id="attackReadyBadge">CHARGING</div>
            <div id="guardReadyBadge">GUARD READY</div>
            <div id="junkRainReadyBadge">JUNK RAIN 70</div>
            <div id="drainReadyBadge">DRAIN 55</div>

            <button id="battleAttackBtn" type="button" disabled>⚡ ATTACK</button>
            <button id="battleGuardBtn" type="button">🛡️ GUARD</button>
            <button id="battleJunkRainBtn" type="button">🌧️ JUNK RAIN</button>
            <button id="battleDrainBtn" type="button">🌀 DRAIN</button>
          </div>

          <div id="battleOpponentStrip"></div>
        </div>
      </div>
    `;

    UI.root = D.getElementById('battleEngineRoot');
    UI.field = D.getElementById('battleField');
    UI.statusBanner = D.getElementById('battleBanner');
    UI.announcer = D.getElementById('battleAnnouncer');

    UI.attackBtn = D.getElementById('battleAttackBtn');
    UI.guardBtn = D.getElementById('battleGuardBtn');
    UI.junkRainBtn = D.getElementById('battleJunkRainBtn');
    UI.drainBtn = D.getElementById('battleDrainBtn');

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
    UI.guardReadyBadge = D.getElementById('guardReadyBadge');
    UI.junkRainReadyBadge = D.getElementById('junkRainReadyBadge');
    UI.drainReadyBadge = D.getElementById('drainReadyBadge');
    UI.opponentStrip = D.getElementById('battleOpponentStrip');

    UI.attackBtn.addEventListener('click', useAttack);
    UI.guardBtn.addEventListener('click', useGuard);
    UI.junkRainBtn.addEventListener('click', useJunkRain);
    UI.drainBtn.addEventListener('click', useDrain);

    W.addEventListener('keydown', (ev) => {
      if ((ev.code === 'Space' || ev.key === ' ') && !ev.repeat){
        ev.preventDefault();
        useAttack();
      }
    });

    const revealHudOnTap = () => {
      if (W.innerWidth <= 640 && STATE.started && !STATE.finished){
        peekHud(1600);
      }
    };

    const revealActionOnTap = () => {
      if (W.innerWidth <= 640 && STATE.started && !STATE.finished){
        peekActionDock(1600);
      }
    };

    UI.field.addEventListener('pointerdown', revealHudOnTap, { passive:true });
    UI.root.addEventListener('pointerdown', revealHudOnTap, { passive:true });
    UI.attackBtn.addEventListener('pointerdown', revealHudOnTap, { passive:true });

    UI.field.addEventListener('pointerdown', revealActionOnTap, { passive:true });
    UI.root.addEventListener('pointerdown', revealActionOnTap, { passive:true });
    UI.attackBtn.addEventListener('pointerdown', revealActionOnTap, { passive:true });
  }

  /* ---------------- UI helpers ---------------- */

  function clearBannerAutoHide(){
    if (STATE.bannerHideTimer){
      clearTimeout(STATE.bannerHideTimer);
      STATE.bannerHideTimer = 0;
    }
  }

  function setBanner(text, lockMs=0){
    if (!UI.statusBanner) return;
    const t = now();
    if (t < STATE.bannerLockUntil && lockMs === 0) return;

    clearBannerAutoHide();
    UI.statusBanner.textContent = text;
    UI.statusBanner.classList.remove('is-hidden');

    if (lockMs > 0) STATE.bannerLockUntil = t + lockMs;
  }

  function hideBannerSoft(){
    if (!UI.statusBanner) return;
    UI.statusBanner.classList.add('is-hidden');
  }

  function showTransientBanner(text, lockMs=0, hideMs=1100){
    setBanner(text, lockMs);
    clearBannerAutoHide();

    STATE.bannerHideTimer = setTimeout(() => {
      STATE.bannerHideTimer = 0;
      if (roomStatus() === 'playing' && STATE.started && !STATE.finished){
        hideBannerSoft();
      }
    }, Math.max(250, hideMs));
  }

  function clearHudAutoHide(){
    if (STATE.hudHideTimer){
      clearTimeout(STATE.hudHideTimer);
      STATE.hudHideTimer = 0;
    }
  }

  function showHudSoft(){
    const hud = UI.root?.querySelector('#battleHud');
    if (hud) hud.classList.remove('is-hidden-mobile');
  }

  function hideHudSoft(){
    const hud = UI.root?.querySelector('#battleHud');
    if (hud) hud.classList.add('is-hidden-mobile');
  }

  function peekHud(ms=1500){
    STATE.hudPeekUntil = Math.max(STATE.hudPeekUntil || 0, now() + ms);
    showHudSoft();
    clearHudAutoHide();

    STATE.hudHideTimer = setTimeout(() => {
      STATE.hudHideTimer = 0;
      const mobile = W.innerWidth <= 640;
      if (mobile && roomStatus() === 'playing' && STATE.started && !STATE.finished){
        hideHudSoft();
      }
    }, Math.max(350, ms));
  }

  function clearActionAutoHide(){
    if (STATE.actionHideTimer){
      clearTimeout(STATE.actionHideTimer);
      STATE.actionHideTimer = 0;
    }
  }

  function showActionDockSoft(){
    const dock = UI.root?.querySelector('#battleActionDock');
    if (dock) dock.classList.remove('is-hidden-mobile');
  }

  function hideActionDockSoft(){
    const dock = UI.root?.querySelector('#battleActionDock');
    if (dock) dock.classList.add('is-hidden-mobile');
  }

  function peekActionDock(ms=1700){
    STATE.actionPeekUntil = Math.max(STATE.actionPeekUntil || 0, now() + ms);
    showActionDockSoft();
    clearActionAutoHide();

    STATE.actionHideTimer = setTimeout(() => {
      STATE.actionHideTimer = 0;
      const mobile = W.innerWidth <= 640;
      if (mobile && roomStatus() === 'playing' && STATE.started && !STATE.finished){
        hideActionDockSoft();
      }
    }, Math.max(350, ms));
  }

  function peekOpponentStrip(ms=1800){
    STATE.opponentPeekUntil = Math.max(STATE.opponentPeekUntil || 0, now() + ms);
    if (UI.opponentStrip){
      UI.opponentStrip.classList.add('is-peek');
    }
  }

  function clearAnnouncer(){
    if (STATE.announcerHideTimer){
      clearTimeout(STATE.announcerHideTimer);
      STATE.announcerHideTimer = 0;
    }

    if (UI.announcer){
      UI.announcer.classList.remove('is-show', 'is-win', 'is-warn', 'is-skill', 'is-ko');
      UI.announcer.textContent = '';
    }
  }

  function showAnnouncer(text, kind='skill', ms=900){
    if (!UI.announcer) return;

    clearAnnouncer();

    UI.announcer.textContent = text;
    UI.announcer.classList.add('is-show');

    if (kind === 'win') UI.announcer.classList.add('is-win');
    else if (kind === 'warn') UI.announcer.classList.add('is-warn');
    else if (kind === 'ko') UI.announcer.classList.add('is-ko');
    else UI.announcer.classList.add('is-skill');

    STATE.announcerHideTimer = setTimeout(() => {
      UI.announcer?.classList.remove('is-show', 'is-win', 'is-warn', 'is-skill', 'is-ko');
      STATE.announcerHideTimer = 0;
    }, Math.max(300, ms));
  }

  function maybeAnnounceFinalCountdown(){
    if (!STATE.started || STATE.finished || roomStatus() !== 'playing') return;

    const left = Math.max(0, Math.ceil(timeLeftSec()));
    if (left === STATE.lastCountdownCall) return;

    if ([10, 5, 3, 2, 1].includes(left)){
      STATE.lastCountdownCall = left;

      if (left === 10) showAnnouncer('FINAL 10 SECONDS!', 'warn', 950);
      else if (left === 5) showAnnouncer('FINAL 5 SECONDS!', 'warn', 900);
      else showAnnouncer(String(left), 'warn', 650);

      peekHud(1200);
      peekActionDock(1200);
      peekOpponentStrip(1200);
    }
  }

  function dangerTelegraphActive(){
    return now() < (STATE.telegraphUntil || 0);
  }

  function showAttackTelegraph(name){
    STATE.telegraphUntil = Math.max(STATE.telegraphUntil || 0, now() + 1500);
    showTransientBanner(`⚠️ ${name || 'คู่ต่อสู้'} พร้อม ATTACK แล้ว! เตรียม GUARD ได้เลย`, 900, 1200);
    peekOpponentStrip(2200);
    peekHud(1600);
    peekActionDock(1700);
  }

  function clearTelegraphVisual(){
    UI.statusBanner?.classList.remove('is-danger');
  }

  function koFlashActive(){
    return now() < (STATE.koFlashUntil || 0);
  }

  function triggerKoEmphasis(text, kind='warn'){
    STATE.koFlashUntil = now() + 900;
    showAnnouncer(text || 'KNOCKOUT!', kind, 1100);
    peekHud(1700);
    peekActionDock(1700);
    peekOpponentStrip(1700);
  }

  /* ---------------- gameplay helpers ---------------- */

  function addCharge(delta){
    STATE.attackCharge = clamp(STATE.attackCharge + delta, 0, STATE.maxAttackCharge);
    STATE.attackReady = STATE.attackCharge >= STATE.maxAttackCharge;
  }

  function pulseScore(){
    const el = UI.battleScoreValue;
    if (!el) return;
    el.style.transform = 'scale(1.08)';
    setTimeout(() => { if (el) el.style.transform = ''; }, 120);
  }

  function flashText(x, y, text, kind='good'){
    const el = D.createElement('div');
    el.className = `gjb-hitfx ${kind}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    UI.field.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try{ t.el.remove(); }catch{}
  }

  function clearTargets(){
    for (const t of STATE.targets){
      try{ t.el.remove(); }catch{}
    }
    STATE.targets = [];
  }

  function playAreaInsets(){
    const mobile = W.innerWidth <= 640;
    return {
      top: mobile ? 56 : 96,
      right: mobile ? 96 : 18,
      bottom: mobile ? 82 : 84,
      left: mobile ? 6 : 8
    };
  }

  function playBounds(){
    const rect = fieldRect();
    const inset = playAreaInsets();

    return {
      w: rect.w,
      h: rect.h,
      left: inset.left,
      right: Math.max(inset.left + 150, rect.w - inset.right),
      top: inset.top,
      bottom: Math.max(inset.top + 240, rect.h - inset.bottom)
    };
  }

  function guardReady(){
    return now() >= STATE.guardCooldownUntil;
  }

  function guardActiveNow(){
    return STATE.guardActive && now() < STATE.guardUntil;
  }

  function clearExpiredGuard(){
    if (STATE.guardActive && now() >= STATE.guardUntil){
      STATE.guardActive = false;
    }
  }

  function useGuard(){
    if (!STATE.started || STATE.finished || STATE.localKo) return;
    if (!guardReady()) return;
    if (guardActiveNow()) return;

    const t = now();
    STATE.guardActive = true;
    STATE.guardUntil = t + 950;
    STATE.guardCooldownUntil = t + 2600;
    STATE.guardsUsed += 1;

    showTransientBanner('🛡️ GUARD พร้อม! ถ้าโดนโจมตีช่วงนี้จะลดดาเมจได้มาก', 850, 850);
    showAnnouncer('GUARD ON!', 'skill', 750);
    peekHud(1200);
    peekActionDock(1400);
    renderHud();
    scheduleSync(true);
  }

  function junkRainCost(){ return 70; }
  function junkRainActiveNow(){ return now() < STATE.junkRainUntil; }
  function junkRainReady(){ return STATE.attackCharge >= junkRainCost(); }

  function drainCost(){ return 55; }
  function drainAmountBase(){ return 30; }
  function drainReady(){ return STATE.attackCharge >= drainCost(); }

  function counterDamageBase(){ return 10; }

  function finisherBonusFromStreak(streak){
    streak = Math.max(0, Number(streak || 0));
    if (streak >= 10) return 12;
    if (streak >= 7) return 8;
    if (streak >= 4) return 4;
    return 0;
  }

  function finisherLabelFromBonus(bonus){
    bonus = Number(bonus || 0);
    if (bonus >= 12) return 'MEGA FINISHER';
    if (bonus >= 8) return 'SUPER FINISHER';
    if (bonus >= 4) return 'FINISHER';
    return '';
  }

  function rageWindowMs(){ return 20000; }

  function rageTimeLeftMs(){
    const endsAt = currentRoomEndsAt();
    if (!endsAt) return 0;
    return Math.max(0, endsAt - now());
  }

  function rageActiveNow(){
    return (
      STATE.started &&
      !STATE.finished &&
      roomStatus() === 'playing' &&
      rageTimeLeftMs() > 0 &&
      rageTimeLeftMs() <= rageWindowMs()
    );
  }

  function rageAttackBonus(){
    return rageActiveNow() ? 4 : 0;
  }

  function rageFinisherBonus(streak){
    if (!rageActiveNow()) return 0;
    streak = Math.max(0, Number(streak || 0));
    if (streak >= 10) return 8;
    if (streak >= 7) return 6;
    if (streak >= 4) return 4;
    return 0;
  }

  function updateRageState(){
    const active = rageActiveNow();

    if (active && !STATE.rageTriggered){
      STATE.rageTriggered = true;
      STATE.rageStartedAt = now();

      showTransientBanner('🔥 FINAL 20s RAGE! เกมจะเร็วขึ้นและ ATTACK จะแรงขึ้น', 1200, 1400);
      showAnnouncer('RAGE MODE!', 'warn', 1000);
      peekOpponentStrip(2200);
      peekHud(1800);
      peekActionDock(1800);
    }

    if (!active && roomStatus() !== 'playing'){
      STATE.rageStartedAt = 0;
    }
  }

  function currentSpawnEvery(){
    let v = STATE.cfg.spawnEvery;
    if (junkRainActiveNow()) v *= 0.72;
    if (rageActiveNow()) v *= 0.82;
    return Math.max(260, Math.round(v));
  }

  function currentGoodRatio(){
    let ratio = STATE.cfg.goodRatio;
    if (junkRainActiveNow()) ratio -= 0.28;
    if (rageActiveNow()) ratio -= 0.08;
    return clamp(ratio, 0.16, 0.9);
  }

  function currentMaxTargets(){
    let v = STATE.cfg.maxTargets;
    if (junkRainActiveNow()) v += 2;
    if (rageActiveNow()) v += 1;
    return v;
  }

  function useJunkRain(){
    if (!STATE.started || STATE.finished || STATE.localKo) return;
    if (!junkRainReady()) return;

    const opp = topOpponent();
    if (!opp) return;

    const duration = 2600;
    const castId = `jr-${STATE.uid}-${now()}-${Math.random().toString(36).slice(2,6)}`;

    addCharge(-junkRainCost());

    STATE.junkRainSent += 1;
    STATE.lastJunkRainId = castId;
    STATE.lastJunkRainAt = now();
    STATE.lastJunkRainTarget = opp.uid || opp.playerId || opp.key || '';
    STATE.lastJunkRainDuration = duration;

    showTransientBanner(`🌧️ JUNK RAIN ใส่ ${opp.name || 'คู่ต่อสู้'} แล้ว!`, 1000, 1000);
    showAnnouncer('JUNK RAIN!', 'warn', 900);
    peekOpponentStrip(2200);
    peekHud(1400);
    peekActionDock(1600);

    renderHud();
    scheduleSync(true);
  }

  function useDrain(){
    if (!STATE.started || STATE.finished || STATE.localKo) return;
    if (!drainReady()) return;

    const opp = topOpponent();
    if (!opp) return;

    const amount = drainAmountBase();
    const castId = `dr-${STATE.uid}-${now()}-${Math.random().toString(36).slice(2,6)}`;

    addCharge(-drainCost());

    STATE.drainUsed += 1;
    STATE.chargeDrained += amount;
    STATE.lastDrainId = castId;
    STATE.lastDrainAt = now();
    STATE.lastDrainTarget = opp.uid || opp.playerId || opp.key || '';
    STATE.lastDrainAmount = amount;

    showTransientBanner(`🌀 DRAIN ใส่ ${opp.name || 'คู่ต่อสู้'} แล้ว! พลังอีกฝั่งจะลดลง`, 1000, 1000);
    showAnnouncer('DRAIN!', 'skill', 850);
    peekOpponentStrip(2200);
    peekHud(1400);
    peekActionDock(1600);

    renderHud();
    scheduleSync(true);
  }

  function useAttack(){
    if (!STATE.started || STATE.finished || STATE.localKo || !STATE.attackReady) return;
    const opp = topOpponent();
    if (!opp) return;

    const baseDmg = STATE.cfg.atkDamage || 18;
    const finisherBonus = finisherBonusFromStreak(STATE.streak);
    const rageBonus = rageAttackBonus();
    const rageFinBonus = rageFinisherBonus(STATE.streak);
    const totalDmg = baseDmg + finisherBonus + rageBonus + rageFinBonus;
    const finisherLabel = finisherLabelFromBonus(finisherBonus);
    const comboUsed = Math.max(0, STATE.streak);

    const attackId = `atk-${STATE.uid}-${now()}-${Math.random().toString(36).slice(2,6)}`;

    STATE.attacksUsed += 1;
    STATE.attackCharge = 0;
    STATE.attackReady = false;
    STATE.damageDealt += totalDmg;

    STATE.rageAttackBonusDamage += rageBonus;

    if (finisherBonus > 0){
      STATE.finisherUsed += 1;
      STATE.finisherBonusDamage += finisherBonus;
      STATE.bestAttackCombo = Math.max(STATE.bestAttackCombo, comboUsed);
    }

    if (rageFinBonus > 0){
      STATE.rageFinisherUsed += 1;
      STATE.rageFinisherBonusDamage += rageFinBonus;
    }

    STATE.lastAttackId = attackId;
    STATE.lastAttackAt = now();
    STATE.lastAttackDamage = totalDmg;
    STATE.lastAttackTarget = opp.uid || opp.playerId || opp.key || '';

    flashText(fieldRect().w * 0.52, fieldRect().h * 0.42, `⚡-${totalDmg}`, 'atk');

    if (finisherBonus > 0 && rageFinBonus > 0){
      flashText(fieldRect().w * 0.62, fieldRect().h * 0.34, `${finisherLabel} +${finisherBonus}`, 'good');
      flashText(fieldRect().w * 0.66, fieldRect().h * 0.26, `RAGE FIN +${rageFinBonus}`, 'good');
      showTransientBanner(`🔥 ${finisherLabel} + RAGE FINISHER! คอมโบ ${comboUsed} ทำดาเมจรวม ${totalDmg}`, 1050, 1150);
      showAnnouncer('RAGE FINISHER!', 'win', 1000);
    } else if (finisherBonus > 0 && rageBonus > 0){
      flashText(fieldRect().w * 0.62, fieldRect().h * 0.34, `${finisherLabel} +${finisherBonus}`, 'good');
      flashText(fieldRect().w * 0.66, fieldRect().h * 0.26, `RAGE +${rageBonus}`, 'good');
      showTransientBanner(`⚡ ${finisherLabel} + RAGE! คอมโบ ${comboUsed} ทำดาเมจรวม ${totalDmg}`, 1000, 1100);
      showAnnouncer('MEGA FINISHER!', 'win', 1000);
    } else if (finisherBonus > 0){
      flashText(fieldRect().w * 0.62, fieldRect().h * 0.34, `${finisherLabel} +${finisherBonus}`, 'good');
      showTransientBanner(`⚡ ${finisherLabel}! ใช้คอมโบ ${comboUsed} เพิ่มดาเมจเป็น ${totalDmg}`, 1000, 1050);
      showAnnouncer(finisherLabel || 'FINISHER!', 'skill', 900);
    } else if (rageBonus > 0){
      flashText(fieldRect().w * 0.62, fieldRect().h * 0.34, `RAGE +${rageBonus}`, 'good');
      showTransientBanner(`🔥 FINAL 20s ATTACK! ดาเมจเพิ่มเป็น ${totalDmg}`, 950, 1000);
      showAnnouncer('RAGE ATTACK!', 'warn', 850);
    } else {
      showTransientBanner(`ปล่อย ATTACK ใส่ ${opp.name || 'คู่ต่อสู้'} แล้ว!`, 1000, 1000);
      showAnnouncer('ATTACK!', 'skill', 700);
    }

    STATE.streak = 0;

    peekOpponentStrip(2200);
    peekHud(1400);
    peekActionDock(1600);

    renderHud();
    scheduleSync(true);
  }

  function playAreaInsets(){
    const mobile = W.innerWidth <= 640;
    return {
      top: mobile ? 56 : 96,
      right: mobile ? 96 : 18,
      bottom: mobile ? 82 : 84,
      left: mobile ? 6 : 8
    };
  }

  function playBounds(){
    const rect = fieldRect();
    const inset = playAreaInsets();
    return {
      w: rect.w,
      h: rect.h,
      left: inset.left,
      right: Math.max(inset.left + 150, rect.w - inset.right),
      top: inset.top,
      bottom: Math.max(inset.top + 240, rect.h - inset.bottom)
    };
  }

  function makeTarget(kind){
    const bounds = playBounds();
    const mobile = W.innerWidth <= 640;

    const size = Math.round((mobile ? 48 : 60) + STATE.rng() * (mobile ? 14 : 24));
    const usableW = Math.max(150, bounds.right - bounds.left);
    const x = bounds.left + Math.round((usableW - size) * STATE.rng());
    const y = bounds.top - size - Math.round(STATE.rng() * 18);
    const speed = STATE.cfg.speed * (0.94 + STATE.rng() * 0.44);
    const ttl = Math.round(STATE.cfg.ttl * (0.98 + STATE.rng() * 0.12));
    const sway = (STATE.rng() - 0.5) * 34;
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
    if (STATE.targets.length >= currentMaxTargets()) return;

    const kind = STATE.rng() < currentGoodRatio() ? 'good' : 'junk';
    makeTarget(kind);

    if (junkRainActiveNow() && STATE.targets.length < currentMaxTargets() && STATE.rng() < 0.28){
      makeTarget('junk');
    }
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
      showTransientBanner('เก่งมาก! แตะอาหารดีต่อเนื่องเพื่อชาร์จพลังโจมตี', 900, 850);
    } else {
      STATE.junkHit += 1;
      STATE.miss += 1;
      STATE.streak = 0;
      STATE.score = Math.max(0, STATE.score - 8);
      STATE.hp = Math.max(0, STATE.hp - 8);
      addCharge(-10);

      flashText(t.x, t.y, '-8', 'bad');
      showTransientBanner('โดน junk! คะแนนและ HP ลดลง', 900, 900);
      applyLocalDamageCheck();
    }

    peekHud(1200);
    peekActionDock(1200);
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
      showTransientBanner('อาหารดีหลุดไปแล้ว ระวังให้มากขึ้นอีกนิด', 800, 800);
      applyLocalDamageCheck();
      peekHud(1200);
      peekActionDock(1200);
      renderHud();
      scheduleSync(false);
    }
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try{ t.el.remove(); }catch{}
  }

  function clearTargets(){
    for (const t of STATE.targets){
      try{ t.el.remove(); }catch{}
    }
    STATE.targets = [];
  }

  function applyLocalDamageCheck(){
    if (STATE.hp <= 0){
      STATE.hp = 0;
      STATE.localKo = true;
      STATE.attackCharge = 0;
      STATE.attackReady = false;
      STATE.koTaken += 1;
      STATE.endedByKo = true;

      setBanner('HP หมดแล้ว! รอระบบสรุปรอบนี้…', 1600);
      triggerKoEmphasis('YOU GOT KNOCKED OUT!', 'ko');

      renderHud();
      scheduleSync(true);
      maybeHostEndRound();
    }
  }

  function scoreLeadInfo(){
    const opp = topOpponent();
    const myScore = Math.max(0, Number(STATE.score || 0));
    const oppScore = opp ? Math.max(0, Number(opp.score || 0)) : 0;
    const diff = myScore - oppScore;

    return {
      opponent: opp,
      myScore,
      oppScore,
      diff,
      absDiff: Math.abs(diff),
      side: diff > 0 ? 'self' : diff < 0 ? 'opp' : 'tie'
    };
  }

  function updateLeadComebackState(){
    if (!STATE.started || STATE.finished || roomStatus() !== 'playing') return;

    const info = scoreLeadInfo();
    if (!info.opponent) return;

    STATE.biggestLead = Math.max(STATE.biggestLead || 0, Math.max(0, info.diff));
    STATE.biggestDeficit = Math.min(STATE.biggestDeficit || 0, Math.min(0, info.diff));

    const prevSide = STATE.leadSide || 'none';
    const nowSide = info.side;
    const t = now();

    if (timeLeftSec() <= 10 && info.absDiff <= 15 && !STATE.closeFinishCalled){
      STATE.closeFinishCalled = true;
      showAnnouncer('TOO CLOSE TO CALL!', 'warn', 950);
      peekHud(1200);
      peekActionDock(1200);
      peekOpponentStrip(1200);
    }

    if (nowSide === 'tie') return;
    if (nowSide === prevSide) return;

    if (t < (STATE.leadAnnounceLockUntil || 0)){
      STATE.leadSide = nowSide;
      return;
    }

    if (prevSide === 'opp' && nowSide === 'self'){
      STATE.leadChanges += 1;
      STATE.comebackCount += 1;
      showAnnouncer('COMEBACK! YOU LEAD!', 'win', 1000);
      showTransientBanner('🔥 พลิกกลับมานำแล้ว! รักษาจังหวะนี้ไว้', 950, 1100);
    } else if (prevSide === 'self' && nowSide === 'opp'){
      STATE.leadChanges += 1;
      showAnnouncer(`${(info.opponent.name || 'OPPONENT').toUpperCase()} LEADS!`, 'warn', 950);
      showTransientBanner(`${info.opponent.name || 'คู่ต่อสู้'} พลิกขึ้นนำแล้ว รีบตอบโต้กลับ`, 950, 1100);
    } else if ((prevSide === 'none' || prevSide === 'tie') && nowSide === 'self'){
      showAnnouncer('YOU TAKE THE LEAD!', 'skill', 900);
    } else if ((prevSide === 'none' || prevSide === 'tie') && nowSide === 'opp'){
      showAnnouncer(`${(info.opponent.name || 'OPPONENT').toUpperCase()} TAKES THE LEAD!`, 'warn', 900);
    } else {
      STATE.leadChanges += 1;
    }

    STATE.leadSide = nowSide;
    STATE.leadAnnounceLockUntil = t + 1200;

    peekHud(1400);
    peekActionDock(1400);
    peekOpponentStrip(1400);
  }

  function opponentPrimaryStatus(p){
    const alive = num(p.hp, 100) > 0;
    if (!alive) return { cls:'', text:'💥 KO' };

    const attackReady = !!p.attackReady;
    const guardOn = !!p.guardActive && num(p.guardUntil, 0) > now();
    const junkOn = num(p.junkRainUntil, 0) > now();
    const drainReady = num(p.attackCharge, 0) >= 55;
    const rageOn = !!STATE.started && roomStatus() === 'playing' && rageActiveNow();

    if (attackReady) return { cls:'attack', text:'⚠️ ATTACK READY' };
    if (guardOn) return { cls:'guard', text:'🛡️ GUARD ON' };
    if (drainReady) return { cls:'drain', text:'🌀 DRAIN READY' };
    if (junkOn) return { cls:'junk', text:'🌧️ JUNK RAIN' };
    if (rageOn) return { cls:'rage', text:'🔥 FINAL 20s' };

    return { cls:'', text:'🎯 NORMAL' };
  }

  function opponentSecondaryStatuses(p){
    const out = [];
    const alive = num(p.hp, 100) > 0;
    if (!alive) return out;

    if (!!p.guardActive && num(p.guardUntil, 0) > now()) out.push('🛡️ Guard');
    if (num(p.junkRainUntil, 0) > now()) out.push('🌧️ Junk');
    if (num(p.attackCharge, 0) >= 55) out.push('🌀 Drain');
    if (!!p.attackReady) out.push('⚡ Attack');

    return out.slice(0, 3);
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
          <div class="gjb-opponent-mini">เมื่ออีกฝั่งเข้ามา จะเห็น HP, charge และสถานะสำคัญที่นี่</div>
        </div>
      `;
      return;
    }

    UI.opponentStrip.innerHTML = opponents.map((p) => {
      const alive = num(p.hp, 100) > 0;
      const hp = Math.max(0, num(p.hp, 100));
      const maxHp = Math.max(1, num(p.maxHp, 100));
      const charge = Math.max(0, num(p.attackCharge, 0));
      const maxCharge = Math.max(1, num(p.maxAttackCharge, 100));

      const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      const chargePct = Math.max(0, Math.min(100, (charge / maxCharge) * 100));

      const primary = opponentPrimaryStatus(p);
      const secondary = opponentSecondaryStatuses(p);

      return `
        <div class="gjb-opponent-card">
          <div class="gjb-opponent-top">
            <div class="gjb-opponent-name">${esc(p.name || p.nick || 'Opponent')}</div>
            <div>${alive ? '⚔️' : '💥'}</div>
          </div>

          <div class="gjb-opponent-mini">
            Score ${num(p.score,0)} • Miss ${num(p.miss,0)} • Streak ${num(p.bestStreak,0)}
          </div>

          <div class="gjb-opponent-statusline">
            <div class="gjb-opponent-primary ${primary.cls}">
              ${primary.text}
            </div>
            <div class="gjb-opponent-secondary">
              ${secondary.map(s => `<span class="gjb-op-chip">${s}</span>`).join('')}
            </div>
          </div>

          <div class="gjb-op-bars">
            <div class="gjb-op-bar">
              <div class="gjb-op-bar-label">HP</div>
              <div class="gjb-op-bar-track">
                <div class="gjb-op-bar-fill hp" style="width:${hpPct.toFixed(1)}%"></div>
              </div>
              <div class="gjb-op-bar-value">${hp}/${maxHp}</div>
            </div>

            <div class="gjb-op-bar">
              <div class="gjb-op-bar-label">CHARGE</div>
              <div class="gjb-op-bar-track">
                <div class="gjb-op-bar-fill charge" style="width:${chargePct.toFixed(1)}%"></div>
              </div>
              <div class="gjb-op-bar-value">${charge}/${maxCharge}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHud(){
    updateRageState();
    updateLeadComebackState();
    clearExpiredGuard();

    if (UI.battleModePill){
      const info = scoreLeadInfo();
      let suffix = '';

      if (rageActiveNow()){
        suffix = ' • FINAL 20s';
      } else if (info.opponent){
        if (info.diff > 0) suffix = ` • LEAD +${info.diff}`;
        else if (info.diff < 0) suffix = ` • TRAIL ${Math.abs(info.diff)}`;
        else suffix = ' • TIE';
      }

      UI.battleModePill.textContent = `MODE battle${suffix}`;
    }

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
      const finisherBonus = finisherBonusFromStreak(STATE.streak);
      const rageBonus = rageAttackBonus();
      const rageFinBonus = rageFinisherBonus(STATE.streak);

      if (STATE.attackReady && finisherBonus > 0 && rageFinBonus > 0){
        UI.battleAttackReady.textContent = `${finisherLabelFromBonus(finisherBonus)} +${finisherBonus} • RAGE FIN +${rageFinBonus}`;
        UI.battleAttackReady.style.color = '#f97316';
        UI.battleAttackReady.style.borderColor = '#ffb547';
      } else if (STATE.attackReady && finisherBonus > 0){
        const extra = rageBonus > 0 ? ` +RAGE ${rageBonus}` : '';
        UI.battleAttackReady.textContent = `${finisherLabelFromBonus(finisherBonus)} +${finisherBonus}${extra}`;
        UI.battleAttackReady.style.color = '#f97316';
        UI.battleAttackReady.style.borderColor = '#ffb547';
      } else if (STATE.attackReady && rageBonus > 0){
        UI.battleAttackReady.textContent = `ATTACK READY +RAGE ${rageBonus}`;
        UI.battleAttackReady.style.color = '#f97316';
        UI.battleAttackReady.style.borderColor = '#ffb547';
      } else if (STATE.attackReady){
        UI.battleAttackReady.textContent = 'ATTACK READY';
        UI.battleAttackReady.style.color = '#2563eb';
        UI.battleAttackReady.style.borderColor = '#7fcfff';
      } else if (rageBonus > 0){
        UI.battleAttackReady.textContent = 'FINAL 20s';
        UI.battleAttackReady.style.color = '#f97316';
        UI.battleAttackReady.style.borderColor = '#ffb547';
      } else {
        UI.battleAttackReady.textContent = 'CHARGING';
        UI.battleAttackReady.style.color = '#7b7a72';
        UI.battleAttackReady.style.borderColor = '#bfe3f2';
      }
    }

    if (UI.guardReadyBadge){
      if (guardActiveNow()){
        UI.guardReadyBadge.textContent = 'GUARD ON';
        UI.guardReadyBadge.style.color = '#7c3aed';
        UI.guardReadyBadge.style.borderColor = '#c4b5fd';
      } else if (guardReady()){
        UI.guardReadyBadge.textContent = 'GUARD READY';
        UI.guardReadyBadge.style.color = '#7b7a72';
        UI.guardReadyBadge.style.borderColor = '#bfe3f2';
      } else {
        const cd = Math.max(0, Math.ceil((STATE.guardCooldownUntil - now()) / 1000));
        UI.guardReadyBadge.textContent = `GUARD ${cd}`;
        UI.guardReadyBadge.style.color = '#7b7a72';
        UI.guardReadyBadge.style.borderColor = '#bfe3f2';
      }
    }

    if (UI.junkRainReadyBadge){
      if (junkRainActiveNow()){
        const left = Math.max(0, Math.ceil((STATE.junkRainUntil - now()) / 1000));
        UI.junkRainReadyBadge.textContent = `JUNK x${left}`;
        UI.junkRainReadyBadge.style.color = '#f97316';
        UI.junkRainReadyBadge.style.borderColor = '#ffb547';
      } else if (junkRainReady()){
        UI.junkRainReadyBadge.textContent = 'JUNK READY';
        UI.junkRainReadyBadge.style.color = '#f97316';
        UI.junkRainReadyBadge.style.borderColor = '#ffb547';
      } else {
        UI.junkRainReadyBadge.textContent = `JUNK ${junkRainCost()}`;
        UI.junkRainReadyBadge.style.color = '#7b7a72';
        UI.junkRainReadyBadge.style.borderColor = '#bfe3f2';
      }
    }

    if (UI.drainReadyBadge){
      if (drainReady()){
        UI.drainReadyBadge.textContent = 'DRAIN READY';
        UI.drainReadyBadge.style.color = '#0ea5e9';
        UI.drainReadyBadge.style.borderColor = '#7fcfff';
      } else {
        UI.drainReadyBadge.textContent = `DRAIN ${drainCost()}`;
        UI.drainReadyBadge.style.color = '#7b7a72';
        UI.drainReadyBadge.style.borderColor = '#bfe3f2';
      }
    }

    if (UI.attackBtn){
      UI.attackBtn.disabled = !(STATE.started && !STATE.finished && !STATE.localKo && STATE.attackReady && !!topOpponent());
      UI.attackBtn.textContent = STATE.attackReady ? '⚡ ATTACK' : '⚡ CHARGING';
    }

    if (UI.guardBtn){
      UI.guardBtn.disabled = !(STATE.started && !STATE.finished && !STATE.localKo && guardReady() && !guardActiveNow());
      UI.guardBtn.textContent = guardActiveNow() ? '🛡️ ACTIVE' : '🛡️ GUARD';
    }

    if (UI.junkRainBtn){
      UI.junkRainBtn.disabled = !(STATE.started && !STATE.finished && !STATE.localKo && junkRainReady() && !!topOpponent());
      UI.junkRainBtn.textContent = '🌧️ JUNK RAIN';
    }

    if (UI.drainBtn){
      UI.drainBtn.disabled = !(STATE.started && !STATE.finished && !STATE.localKo && drainReady() && !!topOpponent());
      UI.drainBtn.textContent = '🌀 DRAIN';
    }

    UI.statusBanner?.classList.toggle('is-danger', dangerTelegraphActive());
    UI.statusBanner?.classList.toggle('is-rage', rageActiveNow());
    UI.statusBanner?.classList.toggle('is-ko', koFlashActive());

    UI.field?.classList.toggle('is-junk-rain', junkRainActiveNow());
    UI.field?.classList.toggle('is-rage', rageActiveNow());
    UI.field?.classList.toggle('is-ko-flash', koFlashActive());

    const hudEl = UI.root?.querySelector('#battleHud');
    if (hudEl){
      const mobile = W.innerWidth <= 640;
      const shouldPeek = mobile && now() < (STATE.hudPeekUntil || 0);

      if (!mobile) hudEl.classList.remove('is-hidden-mobile');
      else if (!STATE.started || STATE.finished || roomStatus() !== 'playing') hudEl.classList.remove('is-hidden-mobile');
      else hudEl.classList.toggle('is-hidden-mobile', !shouldPeek);
    }

    const dockEl = UI.root?.querySelector('#battleActionDock');
    if (dockEl){
      const mobile = W.innerWidth <= 640;
      const shouldPeek = mobile && now() < (STATE.actionPeekUntil || 0);

      if (!mobile) dockEl.classList.remove('is-hidden-mobile');
      else if (!STATE.started || STATE.finished || roomStatus() !== 'playing') dockEl.classList.remove('is-hidden-mobile');
      else dockEl.classList.toggle('is-hidden-mobile', !shouldPeek);
    }

    if (UI.opponentStrip){
      const mobile = W.innerWidth <= 640;
      const shouldPeek = mobile && now() < (STATE.opponentPeekUntil || 0);

      if (!mobile){
        UI.opponentStrip.classList.remove('is-hidden-mobile');
        UI.opponentStrip.classList.remove('is-peek');
      } else if (!STATE.started || STATE.finished || roomStatus() !== 'playing'){
        UI.opponentStrip.classList.remove('is-hidden-mobile');
        UI.opponentStrip.classList.remove('is-peek');
      } else {
        UI.opponentStrip.classList.toggle('is-hidden-mobile', !shouldPeek);
        UI.opponentStrip.classList.toggle('is-peek', shouldPeek);
      }
    }

    renderOpponents();
    emitLiveEvents();
  }

  /* ---------------- Firebase / room sync ---------------- */

  async function ensureFirebase(){
    if (!(W.firebase && W.firebase.apps && W.firebase.database && W.firebase.auth)){
      throw new Error('Firebase SDK not found on page');
    }

    if (!W.firebase.apps.length){
      const cfg = W.HHA_FIREBASE_CONFIG || W.__HHA_FIREBASE_CONFIG__ || W.firebaseConfig;
      if (!cfg) throw new Error('Firebase config missing');
      W.firebase.initializeApp(cfg);
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

    STATE.uid = cleanPid(user.uid || STATE.pid || 'anon');
    if (!STATE.pid || STATE.pid === 'anon') STATE.pid = STATE.uid;
  }

  async function bindRoom(){
    if (!STATE.roomId) throw new Error('roomId missing');

    STATE.refs.room = STATE.db.ref(`${ROOT_PATH}/${STATE.roomId}`);
    STATE.refs.state = STATE.refs.room.child('state');
    STATE.refs.players = STATE.refs.room.child('players');
    STATE.refs.self = STATE.refs.players.child(STATE.uid);

    const snap = await STATE.refs.room.once('value');
    if (!snap.exists()) throw new Error('room not found');

    const room = snap.val() || {};
    STATE.room.meta = room.meta || {};
    STATE.room.state = room.state || {};
    STATE.room.players = room.players || {};

    await ensureSelfPlayerInRoom();

    if (!STATE.listenersAttached){
      attachRoomListeners();
      STATE.listenersAttached = true;
    }
  }

  async function ensureSelfPlayerInRoom(){
    const existing = (STATE.room.players || {})[STATE.uid] || {};
    const t = now();

    const base = {
      pid: STATE.pid,
      uid: STATE.uid,
      playerId: STATE.uid,
      name: STATE.name,
      nick: STATE.name,
      connected: true,
      status: roomStatus(),
      ready: true,

      score: num(existing.score, 0),
      miss: num(existing.miss, 0),
      bestStreak: num(existing.bestStreak, 0),
      hp: clamp(existing.hp, 0, 100) || 100,
      maxHp: Math.max(1, num(existing.maxHp, 100)),
      attackCharge: clamp(existing.attackCharge, 0, 100),
      maxAttackCharge: Math.max(1, num(existing.maxAttackCharge, 100)),
      attackReady: !!existing.attackReady,

      attacksUsed: num(existing.attacksUsed, 0),
      damageDealt: num(existing.damageDealt, 0),
      damageTaken: num(existing.damageTaken, 0),
      koCount: num(existing.koCount, 0),

      guardActive: false,
      guardUntil: 0,
      guardCooldownUntil: num(existing.guardCooldownUntil, 0),
      guardsUsed: num(existing.guardsUsed, 0),
      perfectGuardCount: num(existing.perfectGuardCount, 0),
      blockedDamage: num(existing.blockedDamage, 0),
      counterBonusUsed: num(existing.counterBonusUsed, 0),

      junkRainUntil: num(existing.junkRainUntil, 0),
      junkRainSent: num(existing.junkRainSent, 0),
      junkRainReceived: num(existing.junkRainReceived, 0),
      lastJunkRainId: cleanText(existing.lastJunkRainId || '', 120),
      lastJunkRainAt: num(existing.lastJunkRainAt, 0),
      lastJunkRainTarget: cleanPid(existing.lastJunkRainTarget || ''),
      lastJunkRainDuration: num(existing.lastJunkRainDuration, 0),

      drainUsed: num(existing.drainUsed, 0),
      chargeDrained: num(existing.chargeDrained, 0),
      chargeLostToDrain: num(existing.chargeLostToDrain, 0),
      lastDrainId: cleanText(existing.lastDrainId || '', 120),
      lastDrainAt: num(existing.lastDrainAt, 0),
      lastDrainTarget: cleanPid(existing.lastDrainTarget || ''),
      lastDrainAmount: num(existing.lastDrainAmount, 0),

      counterTriggered: num(existing.counterTriggered, 0),
      counterDamageDealt: num(existing.counterDamageDealt, 0),
      counterDamageTaken: num(existing.counterDamageTaken, 0),
      lastCounterId: cleanText(existing.lastCounterId || '', 120),
      lastCounterAt: num(existing.lastCounterAt, 0),
      lastCounterTarget: cleanPid(existing.lastCounterTarget || ''),
      lastCounterDamage: num(existing.lastCounterDamage, 0),

      finisherUsed: num(existing.finisherUsed, 0),
      finisherBonusDamage: num(existing.finisherBonusDamage, 0),
      bestAttackCombo: num(existing.bestAttackCombo, 0),

      rageTriggered: !!existing.rageTriggered,
      rageStartedAt: num(existing.rageStartedAt, 0),
      rageAttackBonusDamage: num(existing.rageAttackBonusDamage, 0),
      rageFinisherUsed: num(existing.rageFinisherUsed, 0),
      rageFinisherBonusDamage: num(existing.rageFinisherBonusDamage, 0),

      leadChanges: num(existing.leadChanges, 0),
      comebackCount: num(existing.comebackCount, 0),
      biggestLead: num(existing.biggestLead, 0),
      biggestDeficit: num(existing.biggestDeficit, 0),

      koByAttack: num(existing.koByAttack, 0),
      koTaken: num(existing.koTaken, 0),
      endedByKo: !!existing.endedByKo,

      joinedAt: num(existing.joinedAt, t) || t,
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
    }catch{}
  }

  function attachRoomListeners(){
    STATE.refs.state.on('value', (snap) => {
      STATE.room.state = snap.val() || {};
      renderWaitingStates();
    });

    STATE.refs.players.on('value', (snap) => {
      updatePlayersFromRoom(snap.val() || {});
    });
  }

  function scheduleSync(force=false){
    if (force){
      syncSelfNow(true);
      return;
    }

    if (STATE.syncTimer) return;

    const wait = Math.max(0, SYNC_MIN_MS - (now() - STATE.lastSyncAt));
    STATE.syncTimer = setTimeout(() => {
      STATE.syncTimer = 0;
      syncSelfNow(false);
    }, wait);
  }

  async function syncSelfNow(force=false){
    if (!STATE.refs.self) return;
    const t = now();
    if (!force && t - STATE.lastSyncAt < SYNC_MIN_MS) return;

    STATE.lastSyncAt = t;

    const payload = {
      pid: STATE.pid,
      uid: STATE.uid,
      playerId: STATE.uid,
      name: STATE.name,
      nick: STATE.name,
      connected: true,
      status: STATE.finished ? 'finished' : (STATE.localKo ? 'ko' : roomStatus()),
      ready: true,

      score: Math.max(0, Math.round(STATE.score)),
      miss: Math.max(0, Math.round(STATE.miss)),
      bestStreak: Math.max(0, Math.round(STATE.bestStreak)),
      hp: Math.max(0, Math.round(STATE.hp)),
      maxHp: Math.max(1, Math.round(STATE.maxHp)),
      attackCharge: Math.max(0, Math.round(STATE.attackCharge)),
      maxAttackCharge: Math.max(1, Math.round(STATE.maxAttackCharge)),
      attackReady: !!STATE.attackReady,

      attacksUsed: Math.max(0, STATE.attacksUsed),
      damageDealt: Math.max(0, STATE.damageDealt),
      damageTaken: Math.max(0, STATE.damageTaken),
      koCount: Math.max(0, STATE.koCount),

      lastAttackId: STATE.lastAttackId || '',
      lastAttackAt: Math.max(0, STATE.lastAttackAt || 0),
      lastAttackDamage: Math.max(0, STATE.lastAttackDamage || 0),
      lastAttackTarget: STATE.lastAttackTarget || '',

      guardActive: !!guardActiveNow(),
      guardUntil: guardActiveNow() ? STATE.guardUntil : 0,
      guardCooldownUntil: Math.max(0, STATE.guardCooldownUntil || 0),
      guardsUsed: Math.max(0, STATE.guardsUsed),
      perfectGuardCount: Math.max(0, STATE.perfectGuardCount),
      blockedDamage: Math.max(0, STATE.blockedDamage),
      counterBonusUsed: Math.max(0, STATE.counterBonusUsed),

      junkRainUntil: Math.max(0, STATE.junkRainUntil || 0),
      junkRainSent: Math.max(0, STATE.junkRainSent),
      junkRainReceived: Math.max(0, STATE.junkRainReceived),
      lastJunkRainId: STATE.lastJunkRainId || '',
      lastJunkRainAt: Math.max(0, STATE.lastJunkRainAt || 0),
      lastJunkRainTarget: STATE.lastJunkRainTarget || '',
      lastJunkRainDuration: Math.max(0, STATE.lastJunkRainDuration || 0),

      drainUsed: Math.max(0, STATE.drainUsed),
      chargeDrained: Math.max(0, STATE.chargeDrained),
      chargeLostToDrain: Math.max(0, STATE.chargeLostToDrain),
      lastDrainId: STATE.lastDrainId || '',
      lastDrainAt: Math.max(0, STATE.lastDrainAt || 0),
      lastDrainTarget: STATE.lastDrainTarget || '',
      lastDrainAmount: Math.max(0, STATE.lastDrainAmount || 0),

      counterTriggered: Math.max(0, STATE.counterTriggered),
      counterDamageDealt: Math.max(0, STATE.counterDamageDealt),
      counterDamageTaken: Math.max(0, STATE.counterDamageTaken),
      lastCounterId: STATE.lastCounterId || '',
      lastCounterAt: Math.max(0, STATE.lastCounterAt || 0),
      lastCounterTarget: STATE.lastCounterTarget || '',
      lastCounterDamage: Math.max(0, STATE.lastCounterDamage || 0),

      finisherUsed: Math.max(0, STATE.finisherUsed),
      finisherBonusDamage: Math.max(0, STATE.finisherBonusDamage),
      bestAttackCombo: Math.max(0, STATE.bestAttackCombo),

      rageTriggered: STATE.rageTriggered,
      rageStartedAt: STATE.rageStartedAt,
      rageAttackBonusDamage: STATE.rageAttackBonusDamage,
      rageFinisherUsed: Math.max(0, STATE.rageFinisherUsed),
      rageFinisherBonusDamage: Math.max(0, STATE.rageFinisherBonusDamage),

      leadChanges: STATE.leadChanges,
      comebackCount: STATE.comebackCount,
      biggestLead: STATE.biggestLead,
      biggestDeficit: STATE.biggestDeficit,

      koByAttack: STATE.koByAttack,
      koTaken: STATE.koTaken,
      endedByKo: STATE.endedByKo,

      updatedAt: t,
      lastSeen: t
    };

    try{
      await STATE.refs.self.update(payload);
    }catch(err){
      console.warn('[BattleEngine] syncSelfNow failed:', err);
    }
  }

  async function heartbeat(){
    if (!STATE.refs.self) return;
    try{
      await STATE.refs.self.update({
        connected: true,
        status: STATE.finished ? 'finished' : (STATE.localKo ? 'ko' : roomStatus()),
        updatedAt: now(),
        lastSeen: now()
      });
    }catch{}
  }

  function maybeHostPromoteCountdown(){
    if (!STATE.refs.state) return;
    const status = roomStatus();
    if (status !== 'countdown') return;

    const ends = currentCountdownEndsAt();
    if (ends && now() >= ends){
      const t = now();
      const timeSec = clamp(qs('time') || STATE.room.state?.plannedSec || 150, 60, 300, 150);
      STATE.refs.state.update({
        status: 'playing',
        startedAt: t,
        endsAt: t + (timeSec * 1000),
        countdownEndsAt: 0,
        roundToken: `round-${t}`,
        updatedAt: t
      }).catch(() => {});
    }
  }

  function maybeHostEndRound(){
    if (!STATE.refs.state) return;
    const status = roomStatus();
    if (status !== 'playing') return;

    const players = activePlayers();
    const someoneAlive = players.some((p) => num(p.hp, 100) > 0);
    if (someoneAlive && timeLeftSec() > 0) return;

    STATE.refs.state.update({
      status: 'ended',
      updatedAt: now()
    }).catch(() => {});
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

      const rawDmg = clamp(num(p.lastAttackDamage, 0), 0, 100);
      if (rawDmg <= 0){
        STATE.seenAttackIds[key] = attackId;
        return;
      }

      STATE.seenAttackIds[key] = attackId;
      if (!STATE.started || STATE.finished || STATE.localKo) return;

      clearExpiredGuard();

      let finalDmg = rawDmg;
      let blocked = 0;
      let perfect = false;

      if (guardActiveNow()){
        const remain = STATE.guardUntil - now();
        perfect = remain > 500;
        finalDmg = perfect ? 0 : Math.ceil(rawDmg * 0.3);
        blocked = Math.max(0, rawDmg - finalDmg);

        STATE.blockedDamage += blocked;
        if (perfect) STATE.perfectGuardCount += 1;
        STATE.guardActive = false;
        STATE.guardUntil = 0;
      }

      STATE.damageTaken += finalDmg;
      STATE.hp = Math.max(0, STATE.hp - finalDmg);

      if (perfect){
        const counterCharge = 25;
        const counterScore = 5;
        const reflectDmg = counterDamageBase();
        const counterId = `ctr-${STATE.uid}-${now()}-${Math.random().toString(36).slice(2,6)}`;

        STATE.counterBonusUsed += 1;
        STATE.counterTriggered += 1;
        STATE.counterDamageDealt += reflectDmg;

        STATE.guardCooldownUntil = now() + 900;
        addCharge(counterCharge);
        STATE.score += counterScore;

        STATE.lastCounterId = counterId;
        STATE.lastCounterAt = now();
        STATE.lastCounterTarget = cleanPid(p.uid || p.playerId || key);
        STATE.lastCounterDamage = reflectDmg;

        pulseScore();
        flashText(fieldRect().w * 0.34, fieldRect().h * 0.28, 'PERFECT GUARD!', 'good');
        flashText(fieldRect().w * 0.50, fieldRect().h * 0.34, `+${counterCharge} CHARGE`, 'good');
        flashText(fieldRect().w * 0.58, fieldRect().h * 0.40, `+${counterScore}`, 'good');
        flashText(fieldRect().w * 0.64, fieldRect().h * 0.24, `COUNTER ${reflectDmg}`, 'atk');

        showTransientBanner(`🛡️ Perfect Guard! กัน ${rawDmg} ดาเมจได้หมด • สวนกลับ ${reflectDmg} ดาเมจ`, 1000, 1150);
        showAnnouncer('PERFECT COUNTER!', 'win', 950);
      } else if (blocked > 0){
        flashText(fieldRect().w * 0.34, fieldRect().h * 0.28, `BLOCK ${blocked}`, 'good');
        flashText(fieldRect().w * 0.48, fieldRect().h * 0.33, `-${finalDmg} HP`, 'bad');
        showTransientBanner(`🛡️ Guard ช่วยบล็อก ${blocked} ดาเมจ แต่ยังโดน ${finalDmg}`, 1000, 1100);
        addCharge(8);
      } else {
        flashText(fieldRect().w * 0.34, fieldRect().h * 0.28, `-${finalDmg} HP`, 'bad');
        showTransientBanner(`${p.name || 'คู่ต่อสู้'} ใช้ ATTACK ใส่คุณ!`, 1000, 1100);
      }

      peekOpponentStrip(2400);
      peekHud(1600);
      peekActionDock(1600);
      applyLocalDamageCheck();
      renderHud();
      scheduleSync(true);
    });
  }

  function processRemoteJunkRain(playersMap){
    const selfKey = getSelfKey();
    const players = normalizeRoomPlayersMap(playersMap);

    Object.keys(players).forEach((key) => {
      if (key === selfKey) return;

      const p = players[key] || {};
      const castId = cleanText(p.lastJunkRainId || '', 120);
      if (!castId) return;
      if (STATE.seenJunkRainIds[key] === castId) return;

      const target = cleanPid(p.lastJunkRainTarget || '');
      const selfCandidates = new Set([selfKey, STATE.uid, STATE.pid].filter(Boolean));
      if (target && !selfCandidates.has(target)){
        STATE.seenJunkRainIds[key] = castId;
        return;
      }

      const castAt = num(p.lastJunkRainAt, 0);
      const roundStart = currentStartedAt();
      if (roundStart && castAt && castAt < roundStart - 500){
        STATE.seenJunkRainIds[key] = castId;
        return;
      }

      const duration = clamp(num(p.lastJunkRainDuration, 2600), 1200, 5000);

      STATE.seenJunkRainIds[key] = castId;
      if (!STATE.started || STATE.finished || STATE.localKo) return;

      STATE.junkRainUntil = Math.max(STATE.junkRainUntil || 0, now() + duration);
      STATE.junkRainReceived += 1;

      showTransientBanner(`🌧️ ${p.name || 'คู่ต่อสู้'} เรียก JUNK RAIN! ช่วงนี้ junk จะเยอะขึ้น`, 1100, 1200);
      showAnnouncer('INCOMING JUNK RAIN!', 'warn', 950);
      peekOpponentStrip(2400);
      peekHud(1600);
      peekActionDock(1600);
      renderHud();
      scheduleSync(true);
    });
  }

  function processRemoteDrain(playersMap){
    const selfKey = getSelfKey();
    const players = normalizeRoomPlayersMap(playersMap);

    Object.keys(players).forEach((key) => {
      if (key === selfKey) return;

      const p = players[key] || {};
      const castId = cleanText(p.lastDrainId || '', 120);
      if (!castId) return;
      if (STATE.seenDrainIds[key] === castId) return;

      const target = cleanPid(p.lastDrainTarget || '');
      const selfCandidates = new Set([selfKey, STATE.uid, STATE.pid].filter(Boolean));
      if (target && !selfCandidates.has(target)){
        STATE.seenDrainIds[key] = castId;
        return;
      }

      const castAt = num(p.lastDrainAt, 0);
      const roundStart = currentStartedAt();
      if (roundStart && castAt && castAt < roundStart - 500){
        STATE.seenDrainIds[key] = castId;
        return;
      }

      const amount = clamp(num(p.lastDrainAmount, drainAmountBase()), 5, 60);

      STATE.seenDrainIds[key] = castId;
      if (!STATE.started || STATE.finished || STATE.localKo) return;

      const before = STATE.attackCharge;
      const actualLost = Math.min(before, amount);
      STATE.attackCharge = Math.max(0, before - amount);
      STATE.attackReady = STATE.attackCharge >= STATE.maxAttackCharge;
      STATE.chargeLostToDrain += actualLost;

      showTransientBanner(`🌀 ${p.name || 'คู่ต่อสู้'} ใช้ DRAIN! คุณเสีย charge ${actualLost}`, 1000, 1100);
      showAnnouncer('CHARGE STOLEN!', 'warn', 900);
      flashText(fieldRect().w * 0.42, fieldRect().h * 0.30, `-${actualLost} CHARGE`, 'bad');

      peekOpponentStrip(2200);
      peekHud(1600);
      peekActionDock(1600);
      renderHud();
      scheduleSync(true);
    });
  }

  function processRemoteCounter(playersMap){
    const selfKey = getSelfKey();
    const players = normalizeRoomPlayersMap(playersMap);

    Object.keys(players).forEach((key) => {
      if (key === selfKey) return;

      const p = players[key] || {};
      const counterId = cleanText(p.lastCounterId || '', 120);
      if (!counterId) return;
      if (STATE.seenCounterIds[key] === counterId) return;

      const target = cleanPid(p.lastCounterTarget || '');
      const selfCandidates = new Set([selfKey, STATE.uid, STATE.pid].filter(Boolean));
      if (target && !selfCandidates.has(target)){
        STATE.seenCounterIds[key] = counterId;
        return;
      }

      const counterAt = num(p.lastCounterAt, 0);
      const roundStart = currentStartedAt();
      if (roundStart && counterAt && counterAt < roundStart - 500){
        STATE.seenCounterIds[key] = counterId;
        return;
      }

      const dmg = clamp(num(p.lastCounterDamage, counterDamageBase()), 0, 40);
      if (dmg <= 0){
        STATE.seenCounterIds[key] = counterId;
        return;
      }

      STATE.seenCounterIds[key] = counterId;
      if (!STATE.started || STATE.finished || STATE.localKo) return;

      STATE.counterDamageTaken += dmg;
      STATE.damageTaken += dmg;
      STATE.hp = Math.max(0, STATE.hp - dmg);

      flashText(fieldRect().w * 0.38, fieldRect().h * 0.26, `COUNTER -${dmg}`, 'bad');
      showTransientBanner(`⚠️ ${p.name || 'คู่ต่อสู้'} สวนกลับจาก Perfect Guard! คุณเสีย ${dmg} HP`, 1000, 1100);

      peekOpponentStrip(2200);
      peekHud(1600);
      peekActionDock(1600);
      applyLocalDamageCheck();
      renderHud();
      scheduleSync(true);
    });
  }

  function processAttackTelegraph(playersMap){
    const selfKey = getSelfKey();
    const players = normalizeRoomPlayersMap(playersMap);

    Object.keys(players).forEach((key) => {
      if (key === selfKey) return;

      const p = players[key] || {};
      const ready = !!p.attackReady && num(p.hp, 100) > 0;
      const prev = !!STATE.opponentAttackReadyMap[key];

      if (ready && !prev && STATE.started && !STATE.finished && !STATE.localKo){
        showAttackTelegraph(p.name || 'คู่ต่อสู้');
      }

      STATE.opponentAttackReadyMap[key] = ready;
    });

    Object.keys(STATE.opponentAttackReadyMap).forEach((key) => {
      if (!players[key]) delete STATE.opponentAttackReadyMap[key];
    });

    const anyAttackReady = Object.values(players).some((p) => !!p.attackReady && num(p.hp, 100) > 0);
    if (anyAttackReady){
      peekOpponentStrip(1800);
    }
  }

  function maybeTrackKoOutcome(){
    const opp = topOpponent();
    if (!opp) return;

    if (num(opp.hp, 100) <= 0){
      STATE.koCount = Math.max(STATE.koCount, 1);
      STATE.endedByKo = true;

      if (!STATE.koAnnounced && STATE.hp > 0){
        STATE.koByAttack = Math.max(STATE.koByAttack, 1);
        STATE.koAnnounced = true;
        triggerKoEmphasis('KNOCKOUT!', 'ko');
        showTransientBanner(`💥 ${opp.name || 'คู่ต่อสู้'} ถูกปิด KO แล้ว!`, 1000, 1100);
      }
    }
  }

  function updatePlayersFromRoom(playersValue){
    STATE.room.players = playersValue || {};

    const me = selfPlayer();
    if (me){
      STATE.score = num(me.score, STATE.score);
      STATE.miss = num(me.miss, STATE.miss);
      STATE.bestStreak = Math.max(STATE.bestStreak, num(me.bestStreak, STATE.bestStreak));
      STATE.hp = num(me.hp, STATE.hp);
      STATE.maxHp = Math.max(1, num(me.maxHp, STATE.maxHp));
      STATE.attackCharge = clamp(num(me.attackCharge, STATE.attackCharge), 0, STATE.maxAttackCharge);
      STATE.maxAttackCharge = Math.max(1, num(me.maxAttackCharge, STATE.maxAttackCharge));
      STATE.attackReady = !!me.attackReady;

      STATE.guardActive = !!me.guardActive && num(me.guardUntil, 0) > now();
      STATE.guardUntil = num(me.guardUntil, 0);
      STATE.guardCooldownUntil = num(me.guardCooldownUntil, 0);
      STATE.guardsUsed = num(me.guardsUsed, 0);
      STATE.perfectGuardCount = num(me.perfectGuardCount, 0);
      STATE.blockedDamage = num(me.blockedDamage, 0);
      STATE.counterBonusUsed = num(me.counterBonusUsed, 0);

      STATE.junkRainUntil = Math.max(num(me.junkRainUntil, 0), STATE.junkRainUntil || 0);
      STATE.junkRainSent = num(me.junkRainSent, 0);
      STATE.junkRainReceived = num(me.junkRainReceived, 0);

      STATE.drainUsed = num(me.drainUsed, 0);
      STATE.chargeDrained = num(me.chargeDrained, 0);
      STATE.chargeLostToDrain = num(me.chargeLostToDrain, 0);

      STATE.counterTriggered = num(me.counterTriggered, 0);
      STATE.counterDamageDealt = num(me.counterDamageDealt, 0);
      STATE.counterDamageTaken = num(me.counterDamageTaken, 0);

      STATE.finisherUsed = num(me.finisherUsed, 0);
      STATE.finisherBonusDamage = num(me.finisherBonusDamage, 0);
      STATE.bestAttackCombo = num(me.bestAttackCombo, 0);

      STATE.rageTriggered = !!me.rageTriggered || STATE.rageTriggered;
      STATE.rageStartedAt = num(me.rageStartedAt, STATE.rageStartedAt);
      STATE.rageAttackBonusDamage = num(me.rageAttackBonusDamage, 0);
      STATE.rageFinisherUsed = num(me.rageFinisherUsed, 0);
      STATE.rageFinisherBonusDamage = num(me.rageFinisherBonusDamage, 0);

      STATE.leadChanges = num(me.leadChanges, 0);
      STATE.comebackCount = num(me.comebackCount, 0);
      STATE.biggestLead = num(me.biggestLead, 0);
      STATE.biggestDeficit = num(me.biggestDeficit, 0);

      STATE.koByAttack = num(me.koByAttack, 0);
      STATE.koTaken = num(me.koTaken, 0);
      STATE.endedByKo = !!me.endedByKo || STATE.endedByKo;
    }

    processRemoteAttacks(STATE.room.players);
    processRemoteJunkRain(STATE.room.players);
    processRemoteDrain(STATE.room.players);
    processRemoteCounter(STATE.room.players);
    processAttackTelegraph(STATE.room.players);
    maybeTrackKoOutcome();
    renderHud();
  }

  /* ---------------- summary / events ---------------- */

  function updateGlobals(){
    W.state = W.state || {};
    Object.assign(W.state, {
      game: 'goodjunk',
      mode: 'battle',
      roomId: STATE.roomId,
      pid: STATE.pid,
      name: STATE.name,

      score: STATE.score,
      miss: STATE.miss,
      bestStreak: STATE.bestStreak,
      hp: STATE.hp,
      maxHp: STATE.maxHp,
      attackCharge: STATE.attackCharge,
      maxAttackCharge: STATE.maxAttackCharge,
      attackReady: STATE.attackReady,

      attacksUsed: STATE.attacksUsed,
      damageDealt: STATE.damageDealt,
      damageTaken: STATE.damageTaken,
      koCount: STATE.koCount,

      guardActive: guardActiveNow(),
      guardUntil: STATE.guardUntil,
      guardCooldownUntil: STATE.guardCooldownUntil,
      guardsUsed: STATE.guardsUsed,
      perfectGuardCount: STATE.perfectGuardCount,
      blockedDamage: STATE.blockedDamage,
      counterBonusUsed: STATE.counterBonusUsed,

      junkRainUntil: STATE.junkRainUntil,
      junkRainSent: STATE.junkRainSent,
      junkRainReceived: STATE.junkRainReceived,

      drainUsed: STATE.drainUsed,
      chargeDrained: STATE.chargeDrained,
      chargeLostToDrain: STATE.chargeLostToDrain,

      counterTriggered: STATE.counterTriggered,
      counterDamageDealt: STATE.counterDamageDealt,
      counterDamageTaken: STATE.counterDamageTaken,

      finisherUsed: STATE.finisherUsed,
      finisherBonusDamage: STATE.finisherBonusDamage,
      bestAttackCombo: STATE.bestAttackCombo,

      rageTriggered: STATE.rageTriggered,
      rageStartedAt: STATE.rageStartedAt,
      rageAttackBonusDamage: STATE.rageAttackBonusDamage,
      rageFinisherUsed: STATE.rageFinisherUsed,
      rageFinisherBonusDamage: STATE.rageFinisherBonusDamage,

      leadChanges: STATE.leadChanges,
      comebackCount: STATE.comebackCount,
      biggestLead: STATE.biggestLead,
      biggestDeficit: STATE.biggestDeficit,

      koByAttack: STATE.koByAttack,
      koTaken: STATE.koTaken,
      endedByKo: STATE.endedByKo,

      players: STATE.room.players || {}
    });
  }

  function computeResultSummary(reason){
    const opp = topOpponent();

    const result =
      STATE.score > num(opp?.score, 0) ? 'win' :
      STATE.score < num(opp?.score, 0) ? 'lose' : 'draw';

    const rank =
      result === 'win' ? '1' :
      result === 'lose' ? '2' : '2';

    return {
      game: 'goodjunk',
      mode: 'battle',
      roomId: STATE.roomId,
      pid: STATE.pid,
      name: STATE.name,
      rank,
      result,
      reason: cleanText(reason || 'finished', 60),

      score: STATE.score,
      opponentScore: num(opp?.score, 0),
      opponentName: cleanText(opp?.name || 'Opponent', 80),

      miss: STATE.miss,
      bestStreak: STATE.bestStreak,
      hp: STATE.hp,
      maxHp: STATE.maxHp,
      players: activePlayers().map((p) => ({
        pid: cleanPid(p.pid || p.uid || ''),
        name: cleanText(p.name || p.nick || 'Player', 80),
        score: num(p.score, 0),
        miss: num(p.miss, 0),
        bestStreak: num(p.bestStreak, 0),
        hp: num(p.hp, 100),
        maxHp: Math.max(1, num(p.maxHp, 100))
      })),

      attacksUsed: STATE.attacksUsed,
      damageDealt: STATE.damageDealt,
      damageTaken: STATE.damageTaken,
      koCount: STATE.koCount,

      guardsUsed: STATE.guardsUsed,
      perfectGuardCount: STATE.perfectGuardCount,
      blockedDamage: STATE.blockedDamage,
      counterBonusUsed: STATE.counterBonusUsed,

      junkRainSent: STATE.junkRainSent,
      junkRainReceived: STATE.junkRainReceived,

      drainUsed: STATE.drainUsed,
      chargeDrained: STATE.chargeDrained,
      chargeLostToDrain: STATE.chargeLostToDrain,

      counterTriggered: STATE.counterTriggered,
      counterDamageDealt: STATE.counterDamageDealt,
      counterDamageTaken: STATE.counterDamageTaken,

      finisherUsed: STATE.finisherUsed,
      finisherBonusDamage: STATE.finisherBonusDamage,
      bestAttackCombo: STATE.bestAttackCombo,

      rageTriggered: STATE.rageTriggered,
      rageAttackBonusDamage: STATE.rageAttackBonusDamage,
      rageFinisherUsed: STATE.rageFinisherUsed,
      rageFinisherBonusDamage: STATE.rageFinisherBonusDamage,

      leadChanges: STATE.leadChanges,
      comebackCount: STATE.comebackCount,
      biggestLead: STATE.biggestLead,
      biggestDeficit: STATE.biggestDeficit,

      koByAttack: STATE.koByAttack,
      koTaken: STATE.koTaken,
      endedByKo: STATE.endedByKo,

      raw: {
        pid: STATE.pid,
        name: STATE.name,
        roomId: STATE.roomId,
        current: {
          score: STATE.score,
          miss: STATE.miss,
          bestStreak: STATE.bestStreak,
          hp: STATE.hp,
          maxHp: STATE.maxHp,
          attackCharge: STATE.attackCharge,
          maxAttackCharge: STATE.maxAttackCharge,
          attackReady: STATE.attackReady,

          attacksUsed: STATE.attacksUsed,
          damageDealt: STATE.damageDealt,
          damageTaken: STATE.damageTaken,
          koCount: STATE.koCount,

          guardsUsed: STATE.guardsUsed,
          perfectGuardCount: STATE.perfectGuardCount,
          blockedDamage: STATE.blockedDamage,
          counterBonusUsed: STATE.counterBonusUsed,

          junkRainSent: STATE.junkRainSent,
          junkRainReceived: STATE.junkRainReceived,

          drainUsed: STATE.drainUsed,
          chargeDrained: STATE.chargeDrained,
          chargeLostToDrain: STATE.chargeLostToDrain,

          counterTriggered: STATE.counterTriggered,
          counterDamageDealt: STATE.counterDamageDealt,
          counterDamageTaken: STATE.counterDamageTaken,

          finisherUsed: STATE.finisherUsed,
          finisherBonusDamage: STATE.finisherBonusDamage,
          bestAttackCombo: STATE.bestAttackCombo,

          rageTriggered: STATE.rageTriggered,
          rageAttackBonusDamage: STATE.rageAttackBonusDamage,
          rageFinisherUsed: STATE.rageFinisherUsed,
          rageFinisherBonusDamage: STATE.rageFinisherBonusDamage,

          leadChanges: STATE.leadChanges,
          comebackCount: STATE.comebackCount,
          biggestLead: STATE.biggestLead,
          biggestDeficit: STATE.biggestDeficit,

          koByAttack: STATE.koByAttack,
          koTaken: STATE.koTaken,
          endedByKo: STATE.endedByKo
        },
        players: activePlayers()
      }
    };
  }

  function emitLiveEvents(){
    updateGlobals();
    emit('hha:score', { score: STATE.score, miss: STATE.miss, bestStreak: STATE.bestStreak });
    emit('quest:update', {
      score: STATE.score,
      hp: STATE.hp,
      charge: STATE.attackCharge,
      opponents: opponentPlayers().length
    });
  }

  /* ---------------- state transitions ---------------- */

  function startGameIfReady(){
    if (STATE.finished) return;
    if (roomStatus() !== 'playing') return;

    const startedAt = currentStartedAt();
    const endsAt = currentRoomEndsAt();
    if (!startedAt || !endsAt) return;

    if (STATE.started && STATE.lastRoundStartedAt === startedAt) return;

    STATE.started = true;
    STATE.finished = false;
    STATE.localKo = false;
    STATE.lastRoundStartedAt = startedAt;

    clearBannerAutoHide();
    clearHudAutoHide();
    clearActionAutoHide();
    clearAnnouncer();

    STATE.hudPeekUntil = 0;
    STATE.actionPeekUntil = 0;
    STATE.opponentPeekUntil = 0;

    STATE.lastFrameTs = 0;
    STATE.lastSpawnAt = now();
    STATE.targets = [];
    STATE.seq = 0;
    STATE.seenAttackIds = Object.create(null);
    STATE.seenJunkRainIds = Object.create(null);
    STATE.seenDrainIds = Object.create(null);
    STATE.seenCounterIds = Object.create(null);

    STATE.guardActive = false;
    STATE.guardUntil = 0;
    STATE.guardCooldownUntil = 0;
    STATE.guardsUsed = 0;
    STATE.perfectGuardCount = 0;
    STATE.blockedDamage = 0;
    STATE.counterBonusUsed = 0;

    STATE.junkRainUntil = 0;
    STATE.junkRainSent = 0;
    STATE.junkRainReceived = 0;
    STATE.lastJunkRainId = '';
    STATE.lastJunkRainAt = 0;
    STATE.lastJunkRainTarget = '';
    STATE.lastJunkRainDuration = 0;

    STATE.drainUsed = 0;
    STATE.chargeDrained = 0;
    STATE.chargeLostToDrain = 0;
    STATE.lastDrainId = '';
    STATE.lastDrainAt = 0;
    STATE.lastDrainTarget = '';
    STATE.lastDrainAmount = 0;

    STATE.counterTriggered = 0;
    STATE.counterDamageDealt = 0;
    STATE.counterDamageTaken = 0;
    STATE.lastCounterId = '';
    STATE.lastCounterAt = 0;
    STATE.lastCounterTarget = '';
    STATE.lastCounterDamage = 0;

    STATE.finisherUsed = 0;
    STATE.finisherBonusDamage = 0;
    STATE.bestAttackCombo = 0;

    STATE.rageTriggered = false;
    STATE.rageStartedAt = 0;
    STATE.rageAttackBonusDamage = 0;
    STATE.rageFinisherUsed = 0;
    STATE.rageFinisherBonusDamage = 0;

    STATE.opponentAttackReadyMap = Object.create(null);
    STATE.telegraphUntil = 0;
    clearTelegraphVisual();

    STATE.lastCountdownCall = 999;

    STATE.leadSide = 'none';
    STATE.leadAnnounceLockUntil = 0;
    STATE.closeFinishCalled = false;
    STATE.leadChanges = 0;
    STATE.comebackCount = 0;
    STATE.biggestLead = 0;
    STATE.biggestDeficit = 0;

    STATE.koAnnounced = false;
    STATE.koFlashUntil = 0;
    STATE.koByAttack = 0;
    STATE.koTaken = 0;
    STATE.endedByKo = false;

    const me = selfPlayer();
    STATE.score = me ? num(me.score, 0) : 0;
    STATE.miss = me ? num(me.miss, 0) : 0;
    STATE.streak = 0;
    STATE.bestStreak = me ? num(me.bestStreak, 0) : 0;
    STATE.hp = me ? clamp(me.hp, 0, 100) : 100;
    STATE.maxHp = me ? Math.max(1, num(me.maxHp, 100)) : 100;
    STATE.attackCharge = me ? clamp(me.attackCharge, 0, 100) : 0;
    STATE.maxAttackCharge = me ? Math.max(1, num(me.maxAttackCharge, 100)) : 100;
    STATE.attackReady = !!(me && me.attackReady);
    STATE.attacksUsed = me ? num(me.attacksUsed, 0) : 0;
    STATE.damageDealt = me ? num(me.damageDealt, 0) : 0;
    STATE.damageTaken = me ? num(me.damageTaken, 0) : 0;
    STATE.koCount = me ? num(me.koCount, 0) : 0;
    STATE.goodHit = 0;
    STATE.junkHit = 0;
    STATE.lastAttackId = '';
    STATE.lastAttackAt = 0;
    STATE.lastAttackDamage = 0;
    STATE.lastAttackTarget = '';

    const roundToken = cleanText(STATE.room.state?.roundToken || String(startedAt), 120);
    STATE.roundToken = roundToken;
    STATE.cfg = getCfg();

    const seedHash = xmur3(`${STATE.seed}|${STATE.roomId}|${STATE.roundToken}|${STATE.pid}|${startedAt}`)();
    STATE.rng = mulberry32(seedHash);

    showTransientBanner('เริ่มแล้ว! แตะอาหารดี ชาร์จพลัง แล้วใช้ ATTACK ให้ถูกจังหวะ', 1300, 1300);
    showAnnouncer('BATTLE START!', 'skill', 900);
    peekHud(1700);
    peekActionDock(1800);

    renderHud();
    scheduleSync(true);
  }

  function renderWaitingStates(){
    UI.statusBanner?.classList.remove('is-hidden');
    showHudSoft();
    clearHudAutoHide();
    showActionDockSoft();
    clearActionAutoHide();
    clearTelegraphVisual();

    if (roomStatus() !== 'playing'){
      clearAnnouncer();
    }

    UI.statusBanner?.classList.remove('is-rage');
    UI.field?.classList.remove('is-rage');
    UI.statusBanner?.classList.remove('is-ko');
    UI.field?.classList.remove('is-ko-flash');

    STATE.leadAnnounceLockUntil = 0;

    const status = roomStatus();

    if (status === 'countdown'){
      const left = Math.max(0, Math.ceil((currentCountdownEndsAt() - now()) / 1000));
      if (left > 0) setBanner(`พร้อมแล้ว เริ่มเกมใน ${left}...`);
      else setBanner('กำลังเริ่มเกม...');
      maybeHostPromoteCountdown();
      return;
    }

    if (status === 'playing'){
      startGameIfReady();
      return;
    }

    if (status === 'waiting'){
      const actives = activePlayers().length;
      setBanner(actives >= 2 ? 'รอหัวหน้าห้องกด Start จาก Lobby…' : `รอผู้เล่นเพิ่มอีก ${Math.max(0, 2 - actives)} คน`);
      return;
    }

    if (status === 'ended' || status === 'finished'){
      if (!STATE.finished) finishGame('room-ended');
      return;
    }

    setBanner('กำลังรอสถานะห้อง Battle…');
  }

  function finishGame(reason){
    if (STATE.finished) return;

    clearBannerAutoHide();
    clearHudAutoHide();
    clearActionAutoHide();
    clearAnnouncer();
    showHudSoft();
    showActionDockSoft();

    STATE.telegraphUntil = 0;
    clearTelegraphVisual();

    UI.statusBanner?.classList.remove('is-rage');
    UI.field?.classList.remove('is-rage');
    UI.statusBanner?.classList.remove('is-ko');
    UI.field?.classList.remove('is-ko-flash');

    STATE.leadAnnounceLockUntil = 0;

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

  function loop(){
    if (!STATE.started || STATE.finished){
      STATE.loopId = raf(loop);
      return;
    }

    const tNow = now();
    if (!STATE.lastFrameTs) STATE.lastFrameTs = tNow;
    const dt = Math.min(.05, (tNow - STATE.lastFrameTs) / 1000);
    STATE.lastFrameTs = tNow;

    const bounds = playBounds();

    if (!STATE.localKo && tNow - STATE.lastSpawnAt >= currentSpawnEvery()){
      STATE.lastSpawnAt = tNow;
      spawnTarget();
    }

    for (let i = STATE.targets.length - 1; i >= 0; i--){
      const t = STATE.targets[i];
      if (!t || t.dead){
        STATE.targets.splice(i, 1);
        continue;
      }

      t.y += t.speed * dt;
      t.x += Math.sin((tNow - t.bornAt) / 240) * t.sway * dt;
      t.x = Math.max(bounds.left, Math.min(bounds.right - t.size, t.x));

      t.el.style.left = `${t.x.toFixed(1)}px`;
      t.el.style.top = `${t.y.toFixed(1)}px`;

      const expired = (tNow - t.bornAt > t.ttl) || (t.y > bounds.bottom + 8);
      if (expired){
        STATE.targets.splice(i, 1);
        expireTarget(t);
      }
    }

    maybeAnnounceFinalCountdown();
    renderHud();

    if (timeLeftSec() <= 0){
      maybeHostEndRound();
    }

    STATE.loopId = raf(loop);
  }

  /* ---------------- boot ---------------- */

  async function boot(){
    buildDom();
    renderHud();
    setBanner('กำลังเชื่อม Battle Room…');

    await ensureFirebase();
    await bindRoom();

    STATE.heartbeatId = setInterval(() => {
      heartbeat();
      renderWaitingStates();
    }, HEARTBEAT_MS);

    renderWaitingStates();
    STATE.loopId = raf(loop);
  }

  W.addEventListener('beforeunload', () => {
    clearBannerAutoHide();
    clearHudAutoHide();
    clearActionAutoHide();
    clearAnnouncer();
    clearTelegraphVisual();

    clearInterval(STATE.heartbeatId);
    clearTimeout(STATE.syncTimer);
    caf(STATE.loopId);

    try{
      if (STATE.refs.self){
        STATE.refs.self.update({
          connected: false,
          status: STATE.finished ? 'finished' : 'left',
          updatedAt: now(),
          lastSeen: now()
        }).catch(() => {});
      }
    }catch{}
  });

  boot().catch((err) => {
    console.error('[BattleEngine] boot failed:', err);
    if (!UI.mount){
      const el = D.createElement('div');
      el.style.cssText = 'padding:16px;background:#fff1e7;border:2px solid #f2dccb;border-radius:16px;color:#b45309;font-weight:700;margin:12px;';
      el.textContent = `Battle โหลดไม่สำเร็จ: ${err && err.message ? err.message : err}`;
      D.body.appendChild(el);
    } else {
      UI.mount.innerHTML = `
        <div style="padding:16px;background:#fff1e7;border:2px solid #f2dccb;border-radius:16px;color:#b45309;font-weight:700;">
          Battle โหลดไม่สำเร็จ: ${esc(err && err.message ? err.message : err)}
        </div>
      `;
    }
  });
})();