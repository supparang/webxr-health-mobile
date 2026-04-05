'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.battle.js
 * GoodJunk Battle Core
 * FULL PATCH v20260405-battle-core-runtime-full
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_BATTLE_CORE_LOADED__) return;
  W.__GJ_BATTLE_CORE_LOADED__ = true;

  const HEARTBEAT_MS = 2500;
  const ACTIVE_TTL_MS = 15000;
  const SYNC_MIN_MS = 120;
  const FIREBASE_WAIT_MS = 10000;

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
    const s = String(v == null ? '' : v).replace(/[.#$[\]/]/g, '-').trim();
    return s.slice(0, 80);
  }

  function cleanRoom(v){
    return String(v == null ? '' : v)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 24);
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

  function formatClock(sec){
    sec = Math.max(0, Math.ceil(num(sec, 0)));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function raf(fn){
    return (W.requestAnimationFrame || function(cb){ return setTimeout(() => cb(performance.now()), 16); })(fn);
  }

  function caf(id){
    return (W.cancelAnimationFrame || clearTimeout)(id);
  }

  function byId(id){
    return D.getElementById(id);
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const full = new URL(src, location.href).toString();
      const existing = Array.from(D.scripts || []).find((s) => s.src === full);

      if (existing) {
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

  const ctx = {
    roomId: cleanRoom(qs('roomId', qs('room', ''))),
    roomKind: clean(qs('roomKind', ''), 40),
    pid: cleanPid(qs('pid', '')) || 'anon',
    uid: cleanPid(qs('uid', '')),
    name: clean(qs('name', qs('nick', 'Player')), 40),
    role: clean(qs('role', 'player'), 20),
    diff: (() => {
      const v = String(qs('diff', 'normal')).toLowerCase();
      return (v === 'easy' || v === 'hard') ? v : 'normal';
    })(),
    timeSec: clamp(qs('time', '150'), 30, 300),
    seed: clean(qs('seed', String(Date.now())), 80),
    roundId: clean(qs('roundId', ''), 80),
    startAtQuery: num(qs('startAt', '0'), 0),
    hub: clean(qs('hub', '../hub.html'), 400),
    view: clean(qs('view', 'mobile'), 20),
    host: clean(qs('host', '0'), 8)
  };

  const UI = {
    mount: byId('gameMount'),

    roomPill: byId('battleRoomPill'),
    score: byId('battleScoreValue'),
    time: byId('battleTimeValue'),
    miss: byId('battleMissValue'),
    streak: byId('battleStreakValue'),

    itemEmoji: byId('battleItemEmoji'),
    itemTitle: byId('battleItemTitle'),
    itemSub: byId('battleItemSub'),

    goodHit: byId('battleGoodHitValue'),
    junkHit: byId('battleJunkHitValue'),
    goodMiss: byId('battleGoodMissValue'),

    tip: byId('battleTipText'),
    goalValue: byId('battlePairGoalValue'),
    goalFill: byId('battlePairGoalFill'),
    goalSubFill: byId('battlePairGoalSubFill'),

    resultMount: byId('battleResultMount')
  };

  const S = {
    db: null,
    auth: null,
    uid: '',
    roomKind: clean(ctx.roomKind, 40),

    refs: null,
    room: {
      meta: {},
      state: {},
      match: {},
      players: {},
      results: {}
    },

    started: false,
    finished: false,
    summaryShown: false,
    localSummary: null,
    resultSubmitted: false,
    finalSummarySent: false,

    cfg: DIFF_CFG.normal,
    rng: null,

    targets: [],
    seq: 0,
    seenAttackIds: Object.create(null),

    lastFrameTs: 0,
    lastSpawnAt: 0,
    loopId: 0,
    heartbeatId: 0,
    syncTimer: 0,
    lastSyncTs: 0,
    fallbackTimer: 0,

    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    hp: 100,
    maxHp: 100,
    attackCharge: 0,
    maxAttackCharge: 100,
    attackReady: false,
    attacksUsed: 0,
    damageDealt: 0,
    damageTaken: 0,
    koCount: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,

    lastAttackId: '',
    lastAttackAt: 0,
    lastAttackDamage: 0,
    lastAttackTarget: '',

    lastRoundStartedAt: 0,
    hostEndingBusy: false,
    hostPromoteBusy: false,
    bannerLockUntil: 0
  };

  const ENGINE = {
    root: null,
    field: null,
    banner: null,
    attackBtn: null,
    attackBadge: null,
    opponentStrip: null,
    hpValue: null,
    hpFill: null,
    chargeValue: null,
    chargeFill: null
  };

  let RT = null;

  function runtimeCtx(){
    return {
      roomId: ctx.roomId || '',
      roomKind: S.roomKind || ctx.roomKind || '',
      pid: ctx.pid || '',
      uid: S.uid || ctx.uid || '',
      name: ctx.name || '',
      role: ctx.role || '',
      diff: ctx.diff || '',
      time: Number(ctx.timeSec || 0),
      seed: String(ctx.seed || ''),
      view: ctx.view || '',
      host: String(ctx.host || '0')
    };
  }

  function initRuntime(){
    if (!(W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function')) {
      RT = null;
      return null;
    }

    RT = W.HHARuntimeContract.create({
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'battle',
      getCtx: runtimeCtx
    });

    return RT;
  }

  async function ensureRuntimeContract(){
    if (W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function') return true;
    try { await loadScript('../js/hha-cloud-logger-bridge.js'); } catch (_) {}
    try { await loadScript('../js/hha-runtime-contract.js'); } catch (_) {}
    return !!(W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function');
  }

  function roomPath(kind, roomId) {
    return `hha-battle/goodjunk/${kind}/${roomId}`;
  }

  function roomStatus(){
    return String(((S.room || {}).state || {}).status || '');
  }

  function currentRoomEndsAt(){
    return num((S.room.state || {}).endsAt, 0);
  }

  function currentCountdownEndsAt(){
    return num((S.room.state || {}).countdownEndsAt, 0);
  }

  function currentStartedAt(){
    return num((S.room.state || {}).startedAt, 0);
  }

  function getSelfKey(){
    return ctx.pid || S.uid || '';
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
        name: clean(p.name || p.nick || 'Player', 40)
      });
    });
    return out;
  }

  function roomPlayersArray(){
    return Object.entries(normalizeRoomPlayersMap(S.room.players)).map(([key, p]) => Object.assign({ key }, p));
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
    const players = normalizeRoomPlayersMap(S.room.players);
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
    const host = cleanPid((S.room.meta || {}).hostPid || '');
    return !!host && host === getSelfKey();
  }

  function currentGoal(){
    const base = Math.max(180, ctx.timeSec * 4);
    if (ctx.diff === 'easy') return Math.round(base * 0.88);
    if (ctx.diff === 'hard') return Math.round(base * 1.15);
    return Math.round(base);
  }

  function updateGlobals(){
    W.battleRoom = S.room;
    W.__BATTLE_ROOM__ = S.room;
    W.state = Object.assign({}, W.state || {}, {
      room: S.room,
      roomId: ctx.roomId,
      pid: ctx.pid,
      uid: S.uid,
      playerId: ctx.pid,
      score: S.score,
      miss: S.miss,
      bestStreak: S.bestStreak,
      hp: S.hp,
      maxHp: S.maxHp,
      attackCharge: S.attackCharge,
      maxAttackCharge: S.maxAttackCharge,
      attackReady: S.attackReady,
      attacksUsed: S.attacksUsed,
      damageDealt: S.damageDealt,
      damageTaken: S.damageTaken,
      koCount: S.koCount,
      timeLeftSec: timeLeftSec(),
      started: S.started,
      finished: S.finished,
      isEnded: S.finished,
      endsAtMs: currentRoomEndsAt()
    });
    W.gameState = W.state;
  }

  function injectStyles(){
    if (D.getElementById('gjBattleCoreStyles')) return;

    const style = D.createElement('style');
    style.id = 'gjBattleCoreStyles';
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
      #battleBanner{
        position:absolute; left:50%; top:18px; transform:translateX(-50%);
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
      #battleOverlayHud{
        position:absolute;
        left:14px;
        right:14px;
        top:76px;
        z-index:6;
        display:grid;
        gap:10px;
        pointer-events:none;
      }
      .gjb-gaugerow{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        align-items:center;
      }
      .gjb-gauge{
        background:rgba(255,255,255,.92);
        border:2px solid #bfe3f2;
        border-radius:18px;
        box-shadow:0 10px 20px rgba(86,155,194,.12);
        padding:10px 12px;
        min-width:180px;
      }
      .gjb-gauge-head{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:center;
        font-size:12px;
        color:#6d6a62;
        font-weight:1000;
      }
      .gjb-gauge-bar{
        position:relative;
        height:12px;
        margin-top:7px;
        overflow:hidden;
        border-radius:999px;
        background:#e8f6ff;
      }
      .gjb-gauge-fill{
        position:absolute;
        left:0; top:0; bottom:0;
        width:0%;
        border-radius:999px;
        transition:width .14s linear;
      }
      #battleHpFill{ background:linear-gradient(90deg,#7ed957,#58c33f); }
      #battleChargeFill{ background:linear-gradient(90deg,#7fcfff,#58b7f5); }
      #battleOpponentStrip{
        position:absolute;
        left:14px;
        right:120px;
        bottom:14px;
        z-index:5;
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      .gjb-opponent-card{
        min-width:220px;
        padding:12px 14px;
        color:#4d4a42;
        background:rgba(255,255,255,.92);
        border:2px solid #bfe3f2;
        border-radius:18px;
        box-shadow:0 10px 20px rgba(86,155,194,.12);
      }
      .gjb-opponent-top{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:center;
      }
      .gjb-opponent-name{
        font-size:15px;
        font-weight:1000;
      }
      .gjb-opponent-mini{
        margin-top:7px;
        font-size:12px;
        color:#7b7a72;
        font-weight:1000;
      }
      .gjb-target{
        position:absolute;
        display:grid;
        place-items:center;
        border-radius:22px;
        border:2px solid #fff;
        box-shadow:0 12px 24px rgba(0,0,0,.14);
        cursor:pointer;
        user-select:none;
        transform:translateZ(0);
        min-width:56px;
        min-height:56px;
        touch-action:manipulation;
      }
      .gjb-target.good{ background:linear-gradient(180deg,#ffffff,#f1fff1); }
      .gjb-target.junk{ background:linear-gradient(180deg,#fff3f3,#ffe1e1); }
      .gjb-target .emoji{
        font-size:clamp(24px, 3.8vw, 38px);
        line-height:1;
      }
      .gjb-hitfx{
        position:absolute;
        pointer-events:none;
        z-index:9;
        font-size:20px;
        font-weight:1000;
        color:#244260;
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
      @media (max-width:640px){
        #battleBanner{
          top:8px;
          min-width:min(94vw,360px);
          padding:8px 10px;
          font-size:11px;
          border-radius:12px;
        }
        #battleOverlayHud{
          top:60px;
          left:6px;
          right:6px;
          gap:6px;
        }
        .gjb-gauge{
          min-width:0;
          width:100%;
          padding:8px 10px;
          border-radius:12px;
        }
        .gjb-gauge-head{
          font-size:10px;
        }
        .gjb-gauge-bar{
          height:10px;
        }
        #battleActionDock{
          right:6px;
          bottom:6px;
          gap:5px;
        }
        #battleAttackBtn{
          min-width:88px;
          min-height:34px;
          padding:5px 6px;
          font-size:11px;
          border-radius:10px;
        }
        #attackReadyBadge{
          min-height:22px;
          padding:3px 6px;
          font-size:8px;
          border-radius:999px;
        }
        #battleOpponentStrip{
          left:6px;
          right:98px;
          bottom:6px;
          gap:4px;
        }
        .gjb-opponent-card{
          width:100%;
          min-width:0;
          padding:6px 8px;
          border-radius:10px;
        }
        .gjb-opponent-name{
          font-size:11px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .gjb-opponent-mini{
          margin-top:3px;
          font-size:9px;
          line-height:1.3;
        }
        .gjb-target{
          min-width:48px;
          min-height:48px;
          border-radius:16px;
        }
        .gjb-target .emoji{
          font-size:clamp(22px, 7vw, 30px);
        }
      }
    `;
    D.head.appendChild(style);
  }

  function buildDom(){
    injectStyles();

    if (!UI.mount) throw new Error('#gameMount not found');

    UI.mount.innerHTML = `
      <div id="battleEngineRoot">
        <div id="battleEngineStage">
          <div id="battleBanner">กำลังเชื่อม GoodJunk Battle…</div>

          <div id="battleOverlayHud">
            <div class="gjb-gaugerow">
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

          <div id="battleField"></div>

          <div id="battleActionDock">
            <div id="attackReadyBadge">CHARGING</div>
            <button id="battleAttackBtn" type="button" disabled>⚡ ATTACK</button>
          </div>

          <div id="battleOpponentStrip"></div>
        </div>
      </div>
    `;

    ENGINE.root = byId('battleEngineRoot');
    ENGINE.field = byId('battleField');
    ENGINE.banner = byId('battleBanner');
    ENGINE.attackBtn = byId('battleAttackBtn');
    ENGINE.attackBadge = byId('attackReadyBadge');
    ENGINE.opponentStrip = byId('battleOpponentStrip');
    ENGINE.hpValue = byId('battleHpValue');
    ENGINE.hpFill = byId('battleHpFill');
    ENGINE.chargeValue = byId('battleChargeValue');
    ENGINE.chargeFill = byId('battleChargeFill');

    ENGINE.attackBtn.addEventListener('click', useAttack);
  }

  function setBanner(text, lockMs=0){
    if (!ENGINE.banner) return;
    const t = now();
    if (t < S.bannerLockUntil && lockMs === 0) return;
    ENGINE.banner.textContent = text;
    if (lockMs > 0) S.bannerLockUntil = t + lockMs;
  }

  function flashText(x, y, text, kind){
    if (!ENGINE.field) return;
    const el = D.createElement('div');
    el.className = `gjb-hitfx ${kind || ''}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    ENGINE.field.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  function fieldRect(){
    const r = ENGINE.field.getBoundingClientRect();
    return {
      w: Math.max(320, Math.round(r.width || 960)),
      h: Math.max(400, Math.round(r.height || 580))
    };
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

  function timeLeftSec(){
    const status = roomStatus();
    if (status === 'countdown'){
      return Math.max(0, (currentCountdownEndsAt() - now()) / 1000);
    }
    if (status === 'playing'){
      const endsAt = currentRoomEndsAt();
      return endsAt ? Math.max(0, (endsAt - now()) / 1000) : ctx.timeSec;
    }
    return S.started ? 0 : ctx.timeSec;
  }

  function renderHud(){
    if (UI.roomPill) UI.roomPill.textContent = ctx.roomId ? `ห้อง ${ctx.roomId}` : 'Battle';
    if (UI.score) UI.score.textContent = String(Math.max(0, Math.round(S.score)));
    if (UI.time) UI.time.textContent = formatClock(timeLeftSec());
    if (UI.miss) UI.miss.textContent = String(S.miss);
    if (UI.streak) UI.streak.textContent = String(S.bestStreak);

    if (UI.goodHit) UI.goodHit.textContent = String(S.goodHit);
    if (UI.junkHit) UI.junkHit.textContent = String(S.junkHit);
    if (UI.goodMiss) UI.goodMiss.textContent = String(S.goodMiss);

    if (UI.itemEmoji) UI.itemEmoji.textContent = S.attackReady ? '⚡' : '🥗';
    if (UI.itemTitle) UI.itemTitle.textContent = S.attackReady ? 'พลังโจมตีพร้อมแล้ว' : 'เป้าหมายของรอบนี้';
    if (UI.itemSub) {
      UI.itemSub.textContent = S.attackReady
        ? 'กด ATTACK ตอนนี้เพื่อโจมตีคู่แข่ง'
        : 'แตะอาหารดี หลีกเลี่ยง junk และทำคะแนนให้สูงกว่าอีกฝั่ง';
    }

    if (ENGINE.hpValue) ENGINE.hpValue.textContent = `${S.hp}/${S.maxHp}`;
    if (ENGINE.hpFill) ENGINE.hpFill.style.width = `${((S.hp / Math.max(1, S.maxHp)) * 100).toFixed(1)}%`;

    if (ENGINE.chargeValue) ENGINE.chargeValue.textContent = `${S.attackCharge}/${S.maxAttackCharge}`;
    if (ENGINE.chargeFill) ENGINE.chargeFill.style.width = `${((S.attackCharge / Math.max(1, S.maxAttackCharge)) * 100).toFixed(1)}%`;

    if (ENGINE.attackBadge) {
      ENGINE.attackBadge.textContent = S.attackReady ? 'ATTACK READY' : 'CHARGING';
      ENGINE.attackBadge.style.color = S.attackReady ? '#2563eb' : '#7b7a72';
      ENGINE.attackBadge.style.borderColor = S.attackReady ? '#7fcfff' : '#bfe3f2';
    }

    if (ENGINE.attackBtn) {
      ENGINE.attackBtn.disabled = !(S.started && !S.finished && S.attackReady && !!topOpponent());
      ENGINE.attackBtn.textContent = S.attackReady ? '⚡ ATTACK' : '⚡ CHARGING';
    }

    const goal = currentGoal();
    const pct = Math.max(0, Math.min(100, (S.score / Math.max(1, goal)) * 100));
    const hpPct = Math.max(0, Math.min(100, (S.hp / Math.max(1, S.maxHp)) * 100));

    if (UI.goalValue) UI.goalValue.textContent = String(goal);
    if (UI.goalFill) UI.goalFill.style.width = pct.toFixed(1) + '%';
    if (UI.goalSubFill) UI.goalSubFill.style.width = hpPct.toFixed(1) + '%';

    if (UI.tip) {
      const opp = topOpponent();
      if (!S.started && roomStatus() === 'countdown') {
        UI.tip.textContent = 'กำลังนับถอยหลัง เริ่มพร้อมกันทั้งสองฝั่ง';
      } else if (!S.started) {
        UI.tip.textContent = 'รอให้ห้อง Battle เริ่มรอบนี้';
      } else if (!opp) {
        UI.tip.textContent = 'รอข้อมูลคู่แข่ง';
      } else if (S.attackReady) {
        UI.tip.textContent = `พร้อมโจมตีแล้ว • คู่แข่ง ${opp.name || 'Opponent'} • HP ${num(opp.hp, 100)}/${num(opp.maxHp, 100)}`;
      } else {
        UI.tip.textContent = `คู่แข่ง ${opp.name || 'Opponent'} • Score ${num(opp.score, 0)} • HP ${num(opp.hp, 100)}/${num(opp.maxHp, 100)}`;
      }
    }

    renderOpponents();
    updateGlobals();

    emit('battle:update', {
      roomId: ctx.roomId,
      pid: ctx.pid,
      uid: S.uid,
      score: S.score,
      miss: S.miss,
      bestStreak: S.bestStreak,
      hp: S.hp,
      maxHp: S.maxHp,
      attackCharge: S.attackCharge,
      maxAttackCharge: S.maxAttackCharge,
      attackReady: S.attackReady,
      attacksUsed: S.attacksUsed,
      damageDealt: S.damageDealt,
      damageTaken: S.damageTaken,
      koCount: S.koCount,
      timeLeftSec: timeLeftSec(),
      players: normalizeRoomPlayersMap(S.room.players),
      room: S.room
    });

    emit('hha:score', {
      game: 'goodjunk',
      mode: 'battle',
      score: S.score
    });
  }

  function renderOpponents(){
    if (!ENGINE.opponentStrip) return;
    const opponents = opponentPlayers();

    if (!opponents.length){
      ENGINE.opponentStrip.innerHTML = `
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

    ENGINE.opponentStrip.innerHTML = opponents.map((p) => {
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

  function makeTarget(kind){
    const bounds = playBounds();
    const mobile = W.innerWidth <= 640;

    const size = Math.round((mobile ? 48 : 60) + S.rng() * (mobile ? 14 : 24));
    const usableW = Math.max(150, bounds.right - bounds.left);
    const x = bounds.left + Math.round((usableW - size) * S.rng());
    const y = bounds.top - size - Math.round(S.rng() * 18);
    const speed = S.cfg.speed * (0.94 + S.rng() * 0.44);
    const ttl = Math.round(S.cfg.ttl * (0.98 + S.rng() * 0.12));
    const sway = (S.rng() - 0.5) * 34;
    const bank = kind === 'good' ? GOOD_ITEMS : JUNK_ITEMS;
    const pick = bank[Math.floor(S.rng() * bank.length)];

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
      id: `t-${++S.seq}`,
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

    ENGINE.field.appendChild(el);
    S.targets.push(t);
  }

  function spawnTarget(){
    if (!S.started || S.finished) return;
    if (S.targets.length >= S.cfg.maxTargets) return;
    const kind = S.rng() < S.cfg.goodRatio ? 'good' : 'junk';
    makeTarget(kind);
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try { t.el.remove(); } catch {}
  }

  function addCharge(delta){
    S.attackCharge = clamp(S.attackCharge + delta, 0, S.maxAttackCharge);
    S.attackReady = S.attackCharge >= S.maxAttackCharge;
  }

  function hitTarget(t){
    if (!t || t.dead || !S.started || S.finished) return;
    removeTarget(t);

    if (t.kind === 'good'){
      S.streak += 1;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      S.goodHit += 1;

      const bonus = Math.min(12, Math.floor(S.streak / 3) * 2);
      S.score += 10 + bonus;
      addCharge(20);

      flashText(t.x, t.y, `+${10 + bonus}`, 'good');
      setBanner('เก็บอาหารดีต่อเนื่อง ชาร์จพลังโจมตีได้เร็วขึ้น', 900);
    } else {
      S.junkHit += 1;
      S.miss += 1;
      S.streak = 0;
      S.score = Math.max(0, S.score - 8);
      S.hp = Math.max(0, S.hp - 8);
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
      S.goodMiss += 1;
      S.miss += 1;
      S.streak = 0;
      S.hp = Math.max(0, S.hp - 2);
      flashText(t.x, t.y, 'MISS', 'bad');
      setBanner('อาหารดีหลุดไปแล้ว ระวังให้มากขึ้นอีกนิด', 800);
      applyLocalDamageCheck();
      renderHud();
      scheduleSync(false);
    }
  }

  function applyLocalDamageCheck(){
    if (S.hp <= 0){
      S.hp = 0;
      S.attackCharge = 0;
      S.attackReady = false;
      setBanner('HP หมดแล้ว รอสรุปรอบนี้…', 1600);
      renderHud();
      scheduleSync(true);
      maybeHostEndRound();
    }
  }

  function useAttack(){
    if (!S.started || S.finished || !S.attackReady) return;
    const opp = topOpponent();
    if (!opp) return;

    const dmg = S.cfg.atkDamage || 18;
    const attackId = `atk-${ctx.pid}-${now()}-${Math.random().toString(36).slice(2,6)}`;

    S.attacksUsed += 1;
    S.attackCharge = 0;
    S.attackReady = false;
    S.damageDealt += dmg;
    S.lastAttackId = attackId;
    S.lastAttackAt = now();
    S.lastAttackDamage = dmg;
    S.lastAttackTarget = opp.pid || opp.uid || opp.key || '';

    flashText(fieldRect().w * 0.52, fieldRect().h * 0.42, `⚡-${dmg}`, 'atk');
    setBanner(`ปล่อย ATTACK ใส่ ${opp.name || 'คู่ต่อสู้'} แล้ว`, 1000);

    renderHud();
    scheduleSync(true);
  }

  function processRemoteAttacks(playersMap){
    const selfKey = getSelfKey();
    const players = normalizeRoomPlayersMap(playersMap);

    Object.keys(players).forEach((key) => {
      if (key === selfKey) return;

      const p = players[key] || {};
      const attackId = clean(p.lastAttackId || '', 120);
      if (!attackId) return;
      if (S.seenAttackIds[key] === attackId) return;

      const target = cleanPid(p.lastAttackTarget || '');
      const selfCandidates = new Set([selfKey, ctx.pid, S.uid].filter(Boolean));
      if (target && !selfCandidates.has(target)){
        S.seenAttackIds[key] = attackId;
        return;
      }

      const attackAt = num(p.lastAttackAt, 0);
      const roundStart = currentStartedAt();
      if (roundStart && attackAt && attackAt < roundStart - 500){
        S.seenAttackIds[key] = attackId;
        return;
      }

      const dmg = clamp(num(p.lastAttackDamage, 0), 0, 100);
      if (dmg <= 0){
        S.seenAttackIds[key] = attackId;
        return;
      }

      S.seenAttackIds[key] = attackId;
      if (!S.started || S.finished) return;

      S.damageTaken += dmg;
      S.hp = Math.max(0, S.hp - dmg);
      flashText(fieldRect().w * 0.34, fieldRect().h * 0.28, `-${dmg} HP`, 'bad');
      setBanner(`${p.name || 'คู่ต่อสู้'} ใช้ ATTACK ใส่คุณ`, 1000);
      applyLocalDamageCheck();
      renderHud();
      scheduleSync(true);
    });
  }

  function maybeAwardKoFromOpponentState(){
    const opp = topOpponent();
    if (!opp) return;
    if (num(opp.hp, 100) <= 0 && S.hp > 0){
      S.koCount = Math.max(S.koCount, 1);
    }
  }

  function updatePlayersFromRoom(playersValue){
    S.room.players = normalizeRoomPlayersMap(playersValue);
    maybeAwardKoFromOpponentState();
    processRemoteAttacks(S.room.players);
    renderHud();
  }

  async function maybeHostPromoteCountdown(){
    if (!isHost() || !S.refs || !S.refs.state || S.hostPromoteBusy) return;
    if (roomStatus() !== 'countdown') return;

    const countdownEndsAt = currentCountdownEndsAt();
    if (!countdownEndsAt || now() < countdownEndsAt) return;

    S.hostPromoteBusy = true;
    try{
      await S.refs.state.transaction((cur) => {
        cur = cur || {};
        if (String(cur.status || '') !== 'countdown') return cur;

        const plannedSec = clamp(cur.plannedSec || ctx.timeSec, 30, 300);
        const startedAt = now();

        cur.status = 'playing';
        cur.startedAt = startedAt;
        cur.endsAt = startedAt + plannedSec * 1000;
        cur.countdownEndsAt = 0;
        cur.updatedAt = startedAt;

        return cur;
      });
    } catch (err){
      console.warn('[gj-battle] host promote countdown failed:', err);
    } finally {
      S.hostPromoteBusy = false;
    }
  }

  async function maybeHostEndRound(){
    if (!isHost() || !S.refs || !S.refs.state || S.hostEndingBusy) return;
    const status = roomStatus();
    if (status !== 'playing') return;

    const endsAt = currentRoomEndsAt();
    const actives = activePlayers();
    const anyKo = actives.some((p) => num(p.hp, 100) <= 0);
    const timeUp = endsAt > 0 && now() >= endsAt;
    const resultsCount = Object.keys(S.room.results || {}).length;
    const enoughResults = resultsCount >= 2;

    if (!timeUp && !anyKo && !enoughResults) return;

    S.hostEndingBusy = true;
    try{
      await S.refs.state.transaction((cur) => {
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
      S.hostEndingBusy = false;
    }
  }

  function startGameIfReady(){
    if (S.finished) return;
    if (roomStatus() !== 'playing') return;

    const startedAt = currentStartedAt();
    const endsAt = currentRoomEndsAt();
    if (!startedAt || !endsAt) return;

    if (S.started && S.lastRoundStartedAt === startedAt) return;

    S.started = true;
    S.finished = false;
    S.lastRoundStartedAt = startedAt;

    S.lastFrameTs = 0;
    S.lastSpawnAt = now();
    S.targets = [];
    S.seq = 0;
    S.seenAttackIds = Object.create(null);

    const me = selfPlayer();
    S.score = me ? num(me.score, 0) : 0;
    S.miss = me ? num(me.miss, 0) : 0;
    S.streak = 0;
    S.bestStreak = me ? num(me.bestStreak || me.streak, 0) : 0;
    S.hp = me ? clamp(me.hp, 0, 100) : 100;
    S.maxHp = me ? Math.max(1, num(me.maxHp, 100)) : 100;
    S.attackCharge = me ? clamp(me.attackCharge, 0, 100) : 0;
    S.maxAttackCharge = me ? Math.max(1, num(me.maxAttackCharge, 100)) : 100;
    S.attackReady = !!(me && me.attackReady);
    S.attacksUsed = me ? num(me.attacksUsed, 0) : 0;
    S.damageDealt = me ? num(me.damageDealt, 0) : 0;
    S.damageTaken = me ? num(me.damageTaken, 0) : 0;
    S.koCount = me ? num(me.koCount, 0) : 0;
    S.goodHit = 0;
    S.junkHit = 0;
    S.goodMiss = 0;
    S.lastAttackId = '';
    S.lastAttackAt = 0;
    S.lastAttackDamage = 0;
    S.lastAttackTarget = '';

    S.cfg = DIFF_CFG[ctx.diff] || DIFF_CFG.normal;

    const seedHash = xmur3(`${ctx.seed}|${ctx.roomId}|${ctx.pid}|${startedAt}|battle`)();
    S.rng = mulberry32(seedHash);

    setBanner('เริ่มแล้ว! แตะอาหารดี ชาร์จพลัง แล้วใช้ ATTACK ให้ถูกจังหวะ', 1300);
    renderHud();
    scheduleSync(true);

    if (RT) {
      RT.roundStarted({
        roundId: String((S.room.state && S.room.state.roundId) || ctx.roundId || ''),
        startAt: startedAt,
        endAt: endsAt,
        participantIds: activePlayers().map((p) => p.pid || '')
      }).catch(() => {});
    }
  }

  function scheduleSync(force=false){
    if (!S.refs || !S.refs.players || !ctx.pid) return;
    if (force){
      syncSelfNow(true);
      return;
    }
    if (S.syncTimer) return;
    S.syncTimer = setTimeout(() => {
      S.syncTimer = 0;
      syncSelfNow(false);
    }, 60);
  }

  async function syncSelfNow(force){
    if (!S.refs || !S.refs.players || !ctx.pid) return;
    const t = now();
    if (!force && (t - S.lastSyncTs < SYNC_MIN_MS)) return;
    S.lastSyncTs = t;

    const status = S.finished ? 'finished' : (S.started ? 'playing' : 'waiting');

    const payload = {
      pid: ctx.pid,
      uid: S.uid,
      playerId: ctx.pid,
      name: ctx.name,
      nick: ctx.name,
      connected: true,
      ready: true,
      status,
      phase: S.finished ? 'summary' : (S.started ? 'run' : 'lobby'),
      score: Math.max(0, Math.round(S.score)),
      miss: Math.max(0, S.miss),
      combo: Math.max(0, S.streak),
      bestStreak: Math.max(0, S.bestStreak),
      hp: Math.max(0, S.hp),
      maxHp: Math.max(1, S.maxHp),
      attackCharge: Math.max(0, S.attackCharge),
      maxAttackCharge: Math.max(1, S.maxAttackCharge),
      attackReady: !!S.attackReady,
      attacksUsed: Math.max(0, S.attacksUsed),
      damageDealt: Math.max(0, S.damageDealt),
      damageTaken: Math.max(0, S.damageTaken),
      koCount: Math.max(0, S.koCount),
      updatedAt: t,
      lastSeen: t
    };

    if (S.lastAttackId){
      payload.lastAttackId = S.lastAttackId;
      payload.lastAttackAt = S.lastAttackAt;
      payload.lastAttackDamage = S.lastAttackDamage;
      payload.lastAttackTarget = S.lastAttackTarget;
    }

    try {
      await S.refs.players.child(ctx.pid).update(payload);
    } catch (err){
      console.warn('[gj-battle] syncSelfNow failed:', err);
    }
  }

  function computeStandings(resultsObj){
    const rows = Object.keys(resultsObj || {}).map((pid) => {
      const r = resultsObj[pid] || {};
      const hp = num(r.hp, 100);
      return {
        pid: cleanPid(r.pid || pid),
        nick: clean(r.nick || r.name || pid || 'player', 80),
        score: num(r.score, 0),
        miss: num(r.miss, 0),
        goodHit: num(r.goodHit, 0),
        junkHit: num(r.junkHit, 0),
        bestStreak: num(r.bestStreak, 0),
        duration: num(r.duration, 0),
        hp,
        maxHp: num(r.maxHp, 100),
        attacksUsed: num(r.attacksUsed, 0),
        damageDealt: num(r.damageDealt, 0),
        damageTaken: num(r.damageTaken, 0),
        koCount: num(r.koCount, 0),
        alive: hp > 0,
        reason: clean(r.reason || '', 80)
      };
    });

    rows.sort((a, b) => {
      if (Number(b.alive) !== Number(a.alive)) return Number(b.alive) - Number(a.alive);
      if (b.score !== a.score) return b.score - a.score;
      if (b.hp !== a.hp) return b.hp - a.hp;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      if (b.koCount !== a.koCount) return b.koCount - a.koCount;
      return String(a.pid || '').localeCompare(String(b.pid || ''));
    });

    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  function buildLocalSummary(reason){
    return {
      controllerFinal: false,
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'battle',
      roomId: ctx.roomId,
      roomKind: S.roomKind || ctx.roomKind || '',
      pid: ctx.pid,
      uid: S.uid || ctx.uid || '',
      name: ctx.name,
      role: ctx.role,
      rank: 0,
      score: Math.max(0, Math.round(S.score)),
      players: 1,
      miss: S.miss,
      goodHit: S.goodHit,
      junkHit: S.junkHit,
      bestStreak: S.bestStreak,
      duration: ctx.timeSec,
      result: 'finished',
      reason: clean(reason || 'timeup', 80),
      standings: [],
      compare: null,
      hp: S.hp,
      maxHp: S.maxHp,
      attacksUsed: S.attacksUsed,
      damageDealt: S.damageDealt,
      damageTaken: S.damageTaken,
      koCount: S.koCount
    };
  }

  function buildFinalSummaryFromResults(reason){
    const standings = computeStandings(S.room.results || {});
    let me = standings.find((r) => String(r.pid) === String(ctx.pid)) || null;
    let opponent = standings.find((r) => String(r.pid) !== String(ctx.pid)) || null;

    if (!me && S.localSummary) {
      me = Object.assign({}, S.localSummary, { rank: 0 });
    }

    return {
      controllerFinal: standings.length >= 2,
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'battle',
      roomId: ctx.roomId,
      roomKind: S.roomKind || ctx.roomKind || '',
      pid: ctx.pid,
      uid: S.uid || ctx.uid || '',
      name: ctx.name,
      role: ctx.role,
      rank: me ? num(me.rank, 0) : 0,
      score: me ? num(me.score, 0) : Math.max(0, Math.round(S.score)),
      players: standings.length || 1,
      miss: me ? num(me.miss, 0) : S.miss,
      goodHit: me ? num(me.goodHit, 0) : S.goodHit,
      junkHit: me ? num(me.junkHit, 0) : S.junkHit,
      bestStreak: me ? num(me.bestStreak, 0) : S.bestStreak,
      duration: me ? num(me.duration, ctx.timeSec) : ctx.timeSec,
      result: me && me.rank === 1 ? 'win' : (me && me.rank === 2 ? 'lose' : 'finished'),
      reason: clean(reason || 'finished', 80),
      standings,
      compare: {
        me,
        opponent,
        delta: num((me && me.score) || 0) - num((opponent && opponent.score) || 0)
      },
      hp: me ? num(me.hp, 0) : S.hp,
      maxHp: me ? num(me.maxHp, 100) : S.maxHp,
      attacksUsed: me ? num(me.attacksUsed, 0) : S.attacksUsed,
      damageDealt: me ? num(me.damageDealt, 0) : S.damageDealt,
      damageTaken: me ? num(me.damageTaken, 0) : S.damageTaken,
      koCount: me ? num(me.koCount, 0) : S.koCount
    };
  }

  async function submitOwnResult(summary){
    if (!S.refs || !summary) return;

    S.localSummary = summary;

    await S.refs.results.child(ctx.pid).set({
      pid: ctx.pid,
      nick: ctx.name,
      score: num(summary.score, 0),
      miss: num(summary.miss, 0),
      goodHit: num(summary.goodHit, 0),
      junkHit: num(summary.junkHit, 0),
      bestStreak: num(summary.bestStreak, 0),
      duration: num(summary.duration, 0),
      reason: clean(summary.reason || 'finished', 80),
      hp: num(summary.hp, 0),
      maxHp: num(summary.maxHp, 100),
      attacksUsed: num(summary.attacksUsed, 0),
      damageDealt: num(summary.damageDealt, 0),
      damageTaken: num(summary.damageTaken, 0),
      koCount: num(summary.koCount, 0),
      submittedAt: now(),
      updatedAt: now()
    });

    await S.refs.players.child(ctx.pid).update({
      phase: 'summary',
      finished: true,
      finalScore: num(summary.score, 0),
      score: num(summary.score, 0),
      miss: num(summary.miss, 0),
      streak: num(summary.bestStreak, 0),
      updatedAt: now(),
      lastSeen: now()
    }).catch(() => {});

    S.resultSubmitted = true;
  }

  function maybeClearFallbackTimer(){
    if (S.fallbackTimer) {
      clearTimeout(S.fallbackTimer);
      S.fallbackTimer = 0;
    }
  }

  function emitSummary(summary){
    if (RT) {
      RT.summary(summary).catch(() => {});
    } else {
      emit('gj:summary', summary);
      emit('hha:summary', summary);
      emit('hha:session-summary', summary);
    }
  }

  function showResultSummary(summary){
    if (!UI.resultMount) return;

    const standings = Array.isArray(summary.standings) ? summary.standings : [];
    const me = summary.compare && summary.compare.me ? summary.compare.me : null;
    const opponent = summary.compare && summary.compare.opponent ? summary.compare.opponent : null;
    const delta = summary.compare ? num(summary.compare.delta, 0) : 0;

    const title =
      summary.rank === 1 ? 'ชนะแล้ว! คุณเป็นผู้ชนะรอบนี้' :
      summary.rank === 2 ? 'จบรอบแล้ว ได้อันดับ 2' :
      (summary.result === 'win' ? 'ชนะแล้ว!' : summary.result === 'lose' ? 'แพ้รอบนี้' : 'จบรอบแล้ว');

    const sub =
      opponent
        ? `เรา ${num((me && me.score) || summary.score, 0)} คะแนน • คู่แข่ง ${num(opponent.score, 0)} คะแนน`
        : 'ระบบสรุปผลรอบนี้เรียบร้อยแล้ว';

    UI.resultMount.hidden = false;
    UI.resultMount.innerHTML = `
      <div style="width:min(1100px,100%);max-height:min(92vh,1020px);overflow:auto;border-radius:28px;border:1px solid #bfe3f2;background:#fffdf8;box-shadow:0 28px 80px rgba(0,0,0,.22);padding:18px;display:grid;gap:14px;">
        <div style="display:grid;gap:8px;">
          <div style="display:inline-flex;align-items:center;min-height:32px;padding:6px 12px;border-radius:999px;border:1px solid #bfe3f2;background:#f4fbff;color:#658cb1;font-size:12px;font-weight:1100;">BATTLE SUMMARY</div>
          <div style="font-size:28px;line-height:1.15;font-weight:1100;color:#7a2558;">${escapeHtml(title)}</div>
          <div style="color:#6b7280;font-size:14px;line-height:1.6;font-weight:900;">${escapeHtml(sub)}</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
          <div style="border-radius:18px;border:2px solid #cde7f4;background:#fff;padding:14px;text-align:center;">
            <div style="font-size:12px;color:#79aeca;font-weight:1000;margin-bottom:6px;">เรา</div>
            <div style="font-size:14px;line-height:1.5;color:#6d6b63;font-weight:1000;margin-bottom:8px;word-break:break-word;">${escapeHtml((me && me.nick) || ctx.name || 'เรา')}</div>
            <div style="font-size:34px;line-height:1;color:#4d4a42;font-weight:1000;">${num((me && me.score) || summary.score, 0)}</div>
          </div>

          <div style="border-radius:18px;border:2px solid #cde7f4;background:#fff;padding:14px;text-align:center;">
            <div style="font-size:12px;color:#79aeca;font-weight:1000;margin-bottom:6px;">ส่วนต่างคะแนน</div>
            <div style="font-size:14px;line-height:1.5;color:#6d6b63;font-weight:1000;margin-bottom:8px;word-break:break-word;">
              ${opponent ? (delta > 0 ? 'เรานำอยู่' : delta < 0 ? 'คู่แข่งนำอยู่' : 'คะแนนเท่ากัน') : 'รอผลอีกฝั่ง'}
            </div>
            <div style="font-size:34px;line-height:1;color:#4d4a42;font-weight:1000;">${opponent ? Math.abs(delta) : '-'}</div>
          </div>

          <div style="border-radius:18px;border:2px solid #cde7f4;background:#fff;padding:14px;text-align:center;">
            <div style="font-size:12px;color:#79aeca;font-weight:1000;margin-bottom:6px;">คู่แข่ง</div>
            <div style="font-size:14px;line-height:1.5;color:#6d6b63;font-weight:1000;margin-bottom:8px;word-break:break-word;">${escapeHtml((opponent && opponent.nick) || 'ยังไม่พบผลของอีกฝั่ง')}</div>
            <div style="font-size:34px;line-height:1;color:#4d4a42;font-weight:1000;">${opponent ? num(opponent.score, 0) : '-'}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;">
          <div style="border-radius:18px;border:1px solid #bfe3f2;background:#ffffffcc;padding:14px;text-align:center;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;margin-bottom:6px;">Rank</div>
            <div style="font-size:26px;line-height:1;color:#244f6d;font-weight:1100;">${summary.rank || '-'}</div>
          </div>
          <div style="border-radius:18px;border:1px solid #bfe3f2;background:#ffffffcc;padding:14px;text-align:center;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;margin-bottom:6px;">HP</div>
            <div style="font-size:26px;line-height:1;color:#244f6d;font-weight:1100;">${num(summary.hp, 0)}/${num(summary.maxHp, 100)}</div>
          </div>
          <div style="border-radius:18px;border:1px solid #bfe3f2;background:#ffffffcc;padding:14px;text-align:center;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;margin-bottom:6px;">Miss</div>
            <div style="font-size:26px;line-height:1;color:#244f6d;font-weight:1100;">${num(summary.miss, 0)}</div>
          </div>
          <div style="border-radius:18px;border:1px solid #bfe3f2;background:#ffffffcc;padding:14px;text-align:center;">
            <div style="font-size:12px;color:#6b7280;font-weight:1000;margin-bottom:6px;">Best Streak</div>
            <div style="font-size:26px;line-height:1;color:#244f6d;font-weight:1100;">${num(summary.bestStreak, 0)}</div>
          </div>
        </div>

        <div style="display:grid;gap:10px;">
          ${
            standings.length
              ? standings.map((r, i) => `
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px;border-radius:16px;border:2px solid #cde7f4;background:#fff;flex-wrap:wrap;">
                  <div style="display:grid;gap:4px;">
                    <div style="font-weight:1000;color:#4d4a42;">#${i + 1} ${escapeHtml(r.nick || r.pid || 'player')}</div>
                    <div style="font-size:12px;color:#79aeca;font-weight:1000;">Score ${num(r.score, 0)} • HP ${num(r.hp, 0)} • Miss ${num(r.miss, 0)} • Streak ${num(r.bestStreak, 0)}</div>
                  </div>
                  <div style="font-size:12px;color:#79aeca;font-weight:1000;">${String(r.pid || '') === String(ctx.pid || '') ? 'YOU' : 'OPPONENT'}</div>
                </div>
              `).join('')
              : `
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px;border-radius:16px;border:2px solid #cde7f4;background:#fff;flex-wrap:wrap;">
                  <div style="display:grid;gap:4px;">
                    <div style="font-weight:1000;color:#4d4a42;">กำลังรอผลอีกฝั่ง</div>
                    <div style="font-size:12px;color:#79aeca;font-weight:1000;">ถ้าอีกเครื่องส่งผลช้ากว่า ระบบจะแสดง fallback summary ชั่วคราว</div>
                  </div>
                  <div style="font-size:12px;color:#79aeca;font-weight:1000;">WAIT</div>
                </div>
              `
          }
        </div>

        <div style="border-radius:16px;background:#fff;border:1px dashed #bfe3f2;padding:12px;color:#6b7280;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;">controllerFinal=${summary.controllerFinal ? 'true' : 'false'}
roomId=${escapeHtml(ctx.roomId || '-')}
roomKind=${escapeHtml(S.roomKind || ctx.roomKind || '-')}
reason=${escapeHtml(summary.reason || '-')}</div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;position:sticky;bottom:0;padding-top:10px;background:linear-gradient(180deg, rgba(255,253,248,0), rgba(255,253,248,.92) 22%, rgba(255,253,248,1));z-index:30;">
          <a class="btn ghost" href="./goodjunk-battle-lobby.html?roomId=${encodeURIComponent(ctx.roomId || '')}&room=${encodeURIComponent(ctx.roomId || '')}&roomKind=${encodeURIComponent(S.roomKind || ctx.roomKind || '')}&autojoin=1&hub=${encodeURIComponent(ctx.hub || '../hub.html')}">← กลับ Lobby</a>
          <a class="btn primary" href="${escapeHtml(ctx.hub || '../hub.html')}">🏠 กลับ Hub</a>
          <button class="btn good" id="battleCoreRematchBtn" type="button">🔁 เล่นอีกครั้ง</button>
        </div>
      </div>
    `;

    const rematchBtn = byId('battleCoreRematchBtn');
    if (rematchBtn) {
      rematchBtn.addEventListener('click', () => {
        const url = new URL('./goodjunk-battle-lobby.html', location.href);
        const src = new URL(location.href);

        src.searchParams.forEach((value, key) => {
          if (key === 'autostart') return;
          url.searchParams.set(key, value);
        });

        if (ctx.roomId) {
          url.searchParams.set('roomId', ctx.roomId);
          url.searchParams.set('room', ctx.roomId);
        }
        if (S.roomKind || ctx.roomKind) {
          url.searchParams.set('roomKind', S.roomKind || ctx.roomKind);
        }
        url.searchParams.set('autojoin', '1');
        url.searchParams.set('rematch', '1');

        location.href = url.toString();
      });
    }
  }

  function scheduleFallbackSummary(){
    maybeClearFallbackTimer();
    if (!S.localSummary || S.finalSummarySent) return;

    S.fallbackTimer = setTimeout(() => {
      if (S.finalSummarySent) return;
      const summary = buildFinalSummaryFromResults('fallback-local');
      S.finalSummarySent = true;
      showResultSummary(summary);
      emitSummary(summary);
    }, 6500);
  }

  async function finalizeSummary(reason){
    if (S.finished) return;

    S.finished = true;
    S.started = false;
    caf(S.loopId);
    clearTargets();

    const summary = buildLocalSummary(reason || 'finished');
    await submitOwnResult(summary).catch((err) => {
      console.error('[gj-battle] submitOwnResult failed', err);
    });

    showResultSummary(summary);
    emitSummary(summary);
    scheduleFallbackSummary();
  }

  function renderWaitingStates(){
    const status = roomStatus();

    if (status === 'countdown'){
      const left = Math.max(0, Math.ceil((currentCountdownEndsAt() - now()) / 1000));
      if (left > 0){
        setBanner(`พร้อมแล้ว เริ่มเกมใน ${left}...`);
      } else {
        setBanner('กำลังเริ่มเกม...');
      }
      if (isHost()) maybeHostPromoteCountdown();
      return;
    }

    if (status === 'playing'){
      startGameIfReady();
      return;
    }

    if (status === 'waiting'){
      const actives = activePlayers().length;
      setBanner(actives >= 2
        ? 'รอหัวหน้าห้องกด Start จาก Lobby…'
        : `รอผู้เล่นเพิ่มอีก ${Math.max(0, 2 - actives)} คน`);
      return;
    }

    if (status === 'ended' || status === 'finished'){
      if (!S.finished) finalizeSummary('room-ended');
      return;
    }

    setBanner('กำลังรอสถานะห้อง Battle…');
  }

  function loop(frameTs){
    if (S.finished) return;

    renderWaitingStates();

    if (!S.started){
      renderHud();
      S.loopId = raf(loop);
      return;
    }

    const ts = Number(frameTs || performance.now());
    if (!S.lastFrameTs) S.lastFrameTs = ts;
    const dt = Math.min(40, ts - S.lastFrameTs) / 1000;
    S.lastFrameTs = ts;

    const tNow = now();

    if (tNow - S.lastSpawnAt >= S.cfg.spawnEvery){
      S.lastSpawnAt = tNow;
      spawnTarget();
    }

    const bounds = playBounds();

    for (let i = S.targets.length - 1; i >= 0; i--){
      const t = S.targets[i];
      if (!t || t.dead){
        S.targets.splice(i, 1);
        continue;
      }

      t.y += t.speed * dt;
      t.x += Math.sin((tNow - t.bornAt) / 240) * t.sway * dt;
      t.x = Math.max(bounds.left, Math.min(bounds.right - t.size, t.x));

      t.el.style.left = `${t.x.toFixed(1)}px`;
      t.el.style.top = `${t.y.toFixed(1)}px`;

      const expired = (tNow - t.bornAt > t.ttl) || (t.y > bounds.bottom + 8);
      if (expired){
        S.targets.splice(i, 1);
        expireTarget(t);
      }
    }

    if (isHost()) maybeHostEndRound();

    if (currentRoomEndsAt() && now() >= currentRoomEndsAt()){
      if (isHost()){
        maybeHostEndRound();
      } else if (roomStatus() === 'playing'){
        setBanner('หมดเวลาแล้ว รอหัวหน้าห้องปิดรอบ…', 1200);
      }
    }

    renderHud();
    S.loopId = raf(loop);
  }

  function tryCenterShoot(){
    if (!ENGINE.field || !S.targets.length || !S.started || S.finished) return;

    const bounds = playBounds();
    const cx = bounds.w * 0.5;
    const cy = bounds.h * 0.48;

    let best = null;
    let bestDist = Infinity;

    for (let i = 0; i < S.targets.length; i++){
      const t = S.targets[i];
      if (!t || t.dead) continue;
      const tx = t.x + t.size * 0.5;
      const ty = t.y + t.size * 0.5;
      const dx = tx - cx;
      const dy = ty - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist){
        bestDist = dist;
        best = t;
      }
    }

    if (best && bestDist <= 120){
      hitTarget(best);
    }
  }

  function buildRefs(root){
    return {
      root,
      meta: root.child('meta'),
      state: root.child('state'),
      match: root.child('match'),
      players: root.child('players'),
      results: root.child('results')
    };
  }

  function hasFirebaseCompat() {
    return !!(
      W.firebase &&
      typeof W.firebase.initializeApp === 'function' &&
      typeof W.firebase.app === 'function' &&
      typeof W.firebase.database === 'function' &&
      typeof W.firebase.auth === 'function'
    );
  }

  async function waitForFirebaseReady(){
    const startedAt = now();

    while (now() - startedAt < FIREBASE_WAIT_MS) {
      try {
        if (W.HHA_FIREBASE_DB && hasFirebaseCompat()) {
          return true;
        }

        if (typeof W.HHA_ENSURE_FIREBASE_DB === 'function') {
          const db = W.HHA_ENSURE_FIREBASE_DB();
          if (db && hasFirebaseCompat()) {
            W.HHA_FIREBASE_DB = db;
            return true;
          }
        }

        if (hasFirebaseCompat()) {
          if ((!W.firebase.apps || !W.firebase.apps.length) && W.HHA_FIREBASE_CONFIG) {
            W.firebase.initializeApp(W.HHA_FIREBASE_CONFIG);
          }
          if (W.firebase.apps && W.firebase.apps.length) {
            W.HHA_FIREBASE_DB = W.firebase.database();
            return true;
          }
        }
      } catch (_) {}

      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    throw new Error('Firebase ยังไม่พร้อม');
  }

  async function ensureFirebaseReady(){
    if (!(W.firebase && W.firebase.apps && W.firebase.database && W.firebase.auth)){
      await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
      await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js');
      await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js');
    }

    if (!W.HHA_FIREBASE_CONFIG && !W.firebaseConfig && !W.__firebaseConfig && !W.FIREBASE_CONFIG) {
      try { await loadScript('../firebase-config.js'); } catch (_) {}
    }

    await waitForFirebaseReady();

    const cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.firebaseConfig ||
      W.__firebaseConfig ||
      W.FIREBASE_CONFIG ||
      null;

    if (W.firebase.apps && !W.firebase.apps.length){
      if (!cfg) throw new Error('Firebase config not found');
      W.firebase.initializeApp(cfg);
    }

    if (!W.firebase.apps || !W.firebase.apps.length){
      throw new Error('Firebase app init failed');
    }

    S.db = W.firebase.database();
    S.auth = W.firebase.auth();

    if (!S.auth.currentUser){
      await S.auth.signInAnonymously();
    }

    if (!S.auth.currentUser){
      throw new Error('Anonymous auth failed');
    }

    S.uid = cleanPid(S.auth.currentUser.uid);
  }

  async function detectRoomKind(){
    const preferred = clean(ctx.roomKind, 40);
    const order = preferred ? [preferred, 'battleRooms', 'rooms'] : ['battleRooms', 'rooms'];
    const seen = new Set();

    for (const kind of order){
      if (!kind || seen.has(kind)) continue;
      seen.add(kind);
      try {
        const snap = await S.db.ref(roomPath(kind, ctx.roomId)).child('meta').once('value');
        if (snap.exists()) {
          S.roomKind = kind;
          return kind;
        }
      } catch (_) {}
    }

    S.roomKind = preferred || 'rooms';
    return S.roomKind;
  }

  async function ensureRoomExists(){
    const root = S.db.ref(roomPath(S.roomKind, ctx.roomId));
    const snap = await root.once('value');

    if (snap.exists()){
      const room = snap.val() || {};
      S.room.meta = room.meta || {};
      S.room.state = room.state || {};
      S.room.match = room.match || {};
      S.room.players = normalizeRoomPlayersMap(room.players || {});
      S.room.results = room.results || {};
      return root;
    }

    const t = now();
    const bootstrap = {
      meta: {
        roomId: ctx.roomId,
        game: 'goodjunk',
        mode: 'battle',
        diff: ctx.diff,
        hostPid: getSelfKey(),
        createdAt: t,
        updatedAt: t
      },
      state: {
        status: 'waiting',
        plannedSec: ctx.timeSec,
        countdownEndsAt: 0,
        startedAt: 0,
        endsAt: 0,
        updatedAt: t
      },
      match: {
        participantIds: [],
        lockedAt: null,
        status: 'idle',
        battle: {
          winnerId: '',
          loserId: '',
          finishedAt: 0
        }
      },
      players: {},
      results: {}
    };

    await root.set(bootstrap);
    S.room = bootstrap;
    return root;
  }

  async function ensureSelfPlayerInRoom(){
    const t = now();
    const existing = (S.room.players || {})[getSelfKey()] || null;

    const base = {
      pid: ctx.pid,
      uid: S.uid,
      playerId: ctx.pid,
      name: ctx.name,
      nick: ctx.name,
      connected: true,
      ready: true,
      status: roomStatus() === 'playing' ? 'playing' : (roomStatus() === 'countdown' ? 'countdown' : 'waiting'),
      phase: roomStatus() === 'playing' ? 'run' : 'lobby',
      score: existing ? num(existing.score, 0) : 0,
      miss: existing ? num(existing.miss, 0) : 0,
      combo: 0,
      bestStreak: existing ? num(existing.bestStreak || existing.streak, 0) : 0,
      hp: existing ? clamp(existing.hp, 0, 100) : 100,
      maxHp: 100,
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

    await S.refs.players.child(getSelfKey()).update(base);

    try{
      S.refs.players.child(getSelfKey()).onDisconnect().update({
        connected: false,
        status: 'left',
        updatedAt: W.firebase.database.ServerValue.TIMESTAMP,
        lastSeen: W.firebase.database.ServerValue.TIMESTAMP
      });
    } catch {}
  }

  function attachRoomListeners(){
    S.refs.meta.on('value', (snap) => {
      S.room.meta = snap.val() || {};
      renderHud();
      updateGlobals();
    });

    S.refs.state.on('value', (snap) => {
      S.room.state = snap.val() || {};
      renderHud();
      updateGlobals();

      const status = roomStatus();
      if (status === 'countdown'){
        if (isHost()) maybeHostPromoteCountdown();
      } else if (status === 'playing'){
        startGameIfReady();
      } else if ((status === 'ended' || status === 'finished') && !S.finished){
        finalizeSummary('room-state-ended');
      } else if (status === 'waiting' && !S.started && !S.finished){
        setBanner('รอหัวหน้าห้องเริ่มรอบ Battle…');
      }
    });

    S.refs.match.on('value', (snap) => {
      S.room.match = snap.val() || {};
      renderHud();
      updateGlobals();
    });

    S.refs.players.on('value', (snap) => {
      updatePlayersFromRoom(snap.val() || {});
      updateGlobals();

      const me = selfPlayer();
      if (me && !S.started && !S.finished){
        S.score = num(me.score, 0);
        S.miss = num(me.miss, 0);
        S.bestStreak = num(me.bestStreak || me.streak, 0);
        S.hp = clamp(me.hp, 0, 100);
        S.maxHp = Math.max(1, num(me.maxHp, 100));
        S.attackCharge = clamp(me.attackCharge, 0, 100);
        S.maxAttackCharge = Math.max(1, num(me.maxAttackCharge, 100));
        S.attackReady = !!me.attackReady;
        S.attacksUsed = num(me.attacksUsed, 0);
        S.damageDealt = num(me.damageDealt, 0);
        S.damageTaken = num(me.damageTaken, 0);
        S.koCount = num(me.koCount, 0);
      }

      if (isHost()) {
        maybeHostPromoteCountdown();
        maybeHostEndRound();
      }
    });

    S.refs.results.on('value', async (snap) => {
      S.room.results = snap.val() || {};
      updateGlobals();

      const count = Object.keys(S.room.results || {}).length;
      if (count >= 2 && !S.finalSummarySent){
        maybeClearFallbackTimer();
        const summary = buildFinalSummaryFromResults('compare-ready');
        S.finalSummarySent = true;
        showResultSummary(summary);
        emitSummary(summary);

        if (isHost()) {
          const standings = computeStandings(S.room.results || {});
          const winner = standings[0] || null;
          const loser = standings[1] || null;

          await S.refs.match.update({
            status: 'finished',
            finishedAt: now(),
            winnerId: winner ? winner.pid : '',
            loserId: loser ? loser.pid : ''
          }).catch(() => {});

          await S.refs.state.update({
            status: 'ended',
            endedAt: now(),
            updatedAt: now(),
            winnerId: winner ? winner.pid : '',
            loserId: loser ? loser.pid : ''
          }).catch(() => {});
        }
      }
    });
  }

  function startHeartbeat(){
    clearInterval(S.heartbeatId);
    S.heartbeatId = setInterval(() => {
      if (!S.refs || !S.refs.players) return;

      S.refs.players.child(getSelfKey()).update({
        connected: true,
        status: S.finished ? 'finished' : (S.started ? 'playing' : roomStatus() || 'waiting'),
        phase: S.finished ? 'summary' : (S.started ? 'run' : 'lobby'),
        updatedAt: now(),
        lastSeen: now()
      }).catch(() => {});

      if (isHost()) {
        maybeHostPromoteCountdown();
        maybeHostEndRound();
      }
    }, HEARTBEAT_MS);
  }

  function bindEvents(){
    if (ENGINE.attackBtn) {
      ENGINE.attackBtn.addEventListener('click', useAttack);
    }

    W.addEventListener('keydown', (ev) => {
      if ((ev.code === 'Space' || ev.key === ' ') && !ev.repeat){
        ev.preventDefault();
        useAttack();
      }
    });

    W.addEventListener('hha:shoot', () => {
      tryCenterShoot();
    });

    W.addEventListener('beforeunload', () => {
      clearInterval(S.heartbeatId);
      clearTimeout(S.syncTimer);
      maybeClearFallbackTimer();
      caf(S.loopId);

      try{
        if (S.refs && S.refs.players){
          S.refs.players.child(getSelfKey()).update({
            connected: false,
            status: S.finished ? 'finished' : 'left',
            updatedAt: now(),
            lastSeen: now()
          }).catch(() => {});
        }
      } catch {}
    });
  }

  async function boot(){
    buildDom();

    setBanner('กำลังเชื่อม GoodJunk Battle…');
    renderHud();

    await ensureRuntimeContract();
    initRuntime();

    if (RT) {
      await RT.flush().catch(() => {});
      await RT.engineReady({}).catch(() => {});
    }

    await ensureFirebaseReady();
    await detectRoomKind();

    const root = await ensureRoomExists();
    S.refs = buildRefs(root);

    await ensureSelfPlayerInRoom();
    attachRoomListeners();
    startHeartbeat();
    bindEvents();

    S.cfg = DIFF_CFG[ctx.diff] || DIFF_CFG.normal;
    if (!S.rng){
      const seedHash = xmur3(`${ctx.seed}|${ctx.roomId}|${ctx.pid}|battle`)();
      S.rng = mulberry32(seedHash);
    }

    const status = roomStatus();
    if (status === 'playing'){
      startGameIfReady();
    } else if (status === 'countdown'){
      setBanner('กำลังนับถอยหลังก่อนเริ่ม Battle…');
      if (isHost()) maybeHostPromoteCountdown();
    } else {
      setBanner('เชื่อมห้องสำเร็จ รอสถานะเล่นจาก Lobby…');
    }

    renderHud();
    updateGlobals();

    caf(S.loopId);
    S.loopId = raf(loop);
  }

  boot().catch((err) => {
    console.error('[gj-battle-core] boot failed:', err);
    try {
      buildDom();
      setBanner('เข้า GoodJunk Battle ไม่สำเร็จ');
      if (ENGINE.opponentStrip){
        ENGINE.opponentStrip.innerHTML = `
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
    } catch (_) {}
  });

  W.__GJ_BATTLE_CORE__ = {
    ctx,
    state: S,
    finalizeSummary,
    tryCenterShoot
  };
})();