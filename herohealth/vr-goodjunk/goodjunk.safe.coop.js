'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.coop.js
 * GoodJunk Coop Core
 * FULL PATCH v20260405-coop-core-runtime-full
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_COOP_CORE_LOADED__) return;
  W.__GJ_COOP_CORE_LOADED__ = true;

  const HEARTBEAT_MS = 2500;
  const ACTIVE_TTL_MS = 15000;
  const SYNC_MIN_MS = 120;
  const FIREBASE_WAIT_MS = 10000;
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 4;

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
    easy:   { spawnEvery: 860, maxTargets: 5, ttl: 3200, speed: 112, goodRatio: 0.80 },
    normal: { spawnEvery: 710, maxTargets: 6, ttl: 2750, speed: 145, goodRatio: 0.74 },
    hard:   { spawnEvery: 560, maxTargets: 7, ttl: 2300, speed: 178, goodRatio: 0.68 }
  };

  const ctx = {
    roomId: cleanRoom(qs('roomId', qs('room', ''))),
    roomKind: clean(qs('roomKind', ''), 40),
    pid: cleanPid(qs('pid', 'anon')) || 'anon',
    uid: cleanPid(qs('uid', '')),
    name: clean(qs('name', qs('nick', 'Player')), 40),
    role: clean(qs('role', 'player'), 20),
    diff: (() => {
      const v = String(qs('diff', 'normal')).toLowerCase();
      return (v === 'easy' || v === 'hard') ? v : 'normal';
    })(),
    timeSec: clamp(qs('time', '90'), 30, 300),
    seed: clean(qs('seed', String(Date.now())), 80),
    roundId: clean(qs('roundId', ''), 80),
    hub: clean(qs('hub', '../hub.html'), 500),
    view: clean(qs('view', 'mobile'), 24),
    host: clean(qs('host', '0'), 8),
    spectate: qs('spectate', '0') === '1'
  };

  const UI = {
    mount: byId('gameMount'),

    roomPill: byId('coopRoomPill'),
    teamScore: byId('coopTeamScoreValue'),
    time: byId('coopTimeValue'),
    miss: byId('coopMissValue'),
    contribution: byId('coopContributionValue'),

    itemEmoji: byId('coopItemEmoji'),
    itemTitle: byId('coopItemTitle'),
    itemSub: byId('coopItemSub'),

    goodHit: byId('coopGoodHitValue'),
    junkHit: byId('coopJunkHitValue'),
    goodMiss: byId('coopGoodMissValue'),

    tip: byId('coopTipText'),
    goalValue: byId('coopGoalValue'),
    goalFill: byId('coopGoalFill'),
    goalSubFill: byId('coopGoalSubFill'),

    playerCount: byId('coopPlayerCountValue'),
    readyCount: byId('coopReadyCountValue'),
    rankValue: byId('coopRankValue'),

    resultMount: byId('coopResultMount')
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
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,
    contribution: 0,

    teamScore: 0,
    teamGoal: 360,

    hostEndingBusy: false,
    hostPromoteBusy: false,
    hostTeamSyncBusy: false,
    bannerLockUntil: 0
  };

  const ENGINE = {
    root: null,
    field: null,
    banner: null,
    teamStrip: null
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
      mode: 'coop',
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

  function currentParticipantIds(){
    const ids =
      Array.isArray((S.room.state || {}).participantIds) ? (S.room.state || {}).participantIds :
      Array.isArray((S.room.match || {}).participantIds) ? (S.room.match || {}).participantIds :
      [];
    return ids.filter(Boolean);
  }

  function getSelfKey(){
    return ctx.pid || S.uid || '';
  }

  function selfInParticipants(){
    if (!getSelfKey()) return false;
    return currentParticipantIds().includes(getSelfKey());
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

  function activeParticipants(){
    const ids = new Set(currentParticipantIds());
    return activePlayers().filter((p) => ids.has(p.pid || p.key));
  }

  function selfPlayer(){
    const key = getSelfKey();
    const players = normalizeRoomPlayersMap(S.room.players);
    return players[key] || null;
  }

  function isHost(){
    const host = cleanPid((S.room.meta || {}).hostPid || '');
    return !!host && host === getSelfKey();
  }

  function currentGoal(){
    const participantCount = Math.max(MIN_PLAYERS, activeParticipants().length || currentParticipantIds().length || MIN_PLAYERS);
    const base = participantCount * ctx.timeSec * 3.4;
    if (ctx.diff === 'easy') return Math.round(base * 0.9);
    if (ctx.diff === 'hard') return Math.round(base * 1.12);
    return Math.round(base);
  }

  function currentTeamScoreFromPlayers(){
    return activeParticipants().reduce((sum, p) => sum + num(p.score, 0), 0);
  }

  function currentReadyCount(){
    return activePlayers().filter((p) => !!p.ready).length;
  }

  function updateGlobals(){
    W.coopRoom = S.room;
    W.__COOP_ROOM__ = S.room;
    W.state = Object.assign({}, W.state || {}, {
      room: S.room,
      roomId: ctx.roomId,
      pid: ctx.pid,
      uid: S.uid,
      playerId: ctx.pid,
      score: S.score,
      teamScore: S.teamScore,
      teamGoal: S.teamGoal,
      contribution: S.contribution,
      miss: S.miss,
      bestStreak: S.bestStreak,
      timeLeftSec: timeLeftSec(),
      started: S.started,
      finished: S.finished,
      isEnded: S.finished,
      endsAtMs: currentRoomEndsAt()
    });
    W.gameState = W.state;
  }

  function injectStyles(){
    if (D.getElementById('gjCoopCoreStyles')) return;

    const style = D.createElement('style');
    style.id = 'gjCoopCoreStyles';
    style.textContent = `
      #coopEngineRoot{
        position:absolute; inset:0; z-index:1; overflow:hidden;
        background:
          radial-gradient(circle at 12% 10%, rgba(255,255,255,.9), transparent 18%),
          radial-gradient(circle at 86% 14%, rgba(255,255,255,.76), transparent 16%),
          linear-gradient(180deg,#dff4ff,#bfe8ff 54%, #fff7d8);
      }
      #coopEngineStage{
        position:absolute; inset:0; overflow:hidden;
      }
      #coopField{
        position:absolute; inset:0; overflow:hidden;
      }
      #coopField::before{
        content:"";
        position:absolute; left:0; right:0; bottom:0; height:140px;
        background:
          radial-gradient(circle at 20% 40%, rgba(126,217,87,.34), transparent 18%),
          radial-gradient(circle at 72% 44%, rgba(126,217,87,.28), transparent 18%),
          linear-gradient(180deg,#b3f28f,#88d96b);
        border-top:1px solid rgba(88,195,63,.26);
        pointer-events:none;
      }
      #coopBanner{
        position:absolute; left:50%; top:18px; transform:translateX(-50%);
        z-index:7; min-width:min(92vw,560px); max-width:min(92vw,660px);
        border-radius:22px; padding:12px 16px;
        border:2px solid #bfe3f2;
        background:rgba(255,255,255,.95);
        box-shadow:0 14px 24px rgba(86,155,194,.16);
        color:#4d4a42; text-align:center; font-size:14px; line-height:1.6; font-weight:1000;
      }
      #coopTeamStrip{
        position:absolute;
        left:14px;
        right:14px;
        bottom:14px;
        z-index:6;
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      .gjc-teammate-card{
        min-width:190px;
        padding:12px 14px;
        color:#4d4a42;
        background:rgba(255,255,255,.92);
        border:2px solid #bfe3f2;
        border-radius:18px;
        box-shadow:0 10px 20px rgba(86,155,194,.12);
      }
      .gjc-teammate-top{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:center;
      }
      .gjc-teammate-name{
        font-size:15px;
        font-weight:1000;
      }
      .gjc-teammate-mini{
        margin-top:7px;
        font-size:12px;
        color:#7b7a72;
        font-weight:1000;
      }
      .gjc-target{
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
      .gjc-target.good{ background:linear-gradient(180deg,#ffffff,#f1fff1); }
      .gjc-target.junk{ background:linear-gradient(180deg,#fff3f3,#ffe1e1); }
      .gjc-target .emoji{
        font-size:clamp(24px, 3.8vw, 38px);
        line-height:1;
      }
      .gjc-hitfx{
        position:absolute;
        pointer-events:none;
        z-index:9;
        font-size:20px;
        font-weight:1000;
        color:#244260;
        text-shadow:0 1px 0 #fff;
        animation:gjc-float .48s ease-out forwards;
      }
      .gjc-hitfx.good{ color:#15803d; }
      .gjc-hitfx.bad{ color:#b91c1c; }
      @keyframes gjc-float{
        0%{ opacity:0; transform:translateY(8px) scale(.9); }
        15%{ opacity:1; }
        100%{ opacity:0; transform:translateY(-28px) scale(1.04); }
      }
      @media (max-width:640px){
        #coopBanner{
          top:8px;
          min-width:min(94vw,360px);
          padding:8px 10px;
          font-size:11px;
          border-radius:12px;
        }
        #coopTeamStrip{
          left:6px;
          right:6px;
          bottom:6px;
          gap:4px;
        }
        .gjc-teammate-card{
          width:100%;
          min-width:0;
          padding:6px 8px;
          border-radius:10px;
        }
        .gjc-teammate-name{
          font-size:11px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .gjc-teammate-mini{
          margin-top:3px;
          font-size:9px;
          line-height:1.3;
        }
        .gjc-target{
          min-width:48px;
          min-height:48px;
          border-radius:16px;
        }
        .gjc-target .emoji{
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
      <div id="coopEngineRoot">
        <div id="coopEngineStage">
          <div id="coopBanner">กำลังเชื่อม GoodJunk Coop…</div>
          <div id="coopField"></div>
          <div id="coopTeamStrip"></div>
        </div>
      </div>
    `;

    ENGINE.root = byId('coopEngineRoot');
    ENGINE.field = byId('coopField');
    ENGINE.banner = byId('coopBanner');
    ENGINE.teamStrip = byId('coopTeamStrip');
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
    el.className = `gjc-hitfx ${kind || ''}`;
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
      right: mobile ? 10 : 18,
      bottom: mobile ? 78 : 92,
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
      right: Math.max(inset.left + 180, rect.w - inset.right),
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

  function renderTeamStrip(){
    if (!ENGINE.teamStrip) return;
    const participants = activeParticipants();

    if (!participants.length){
      ENGINE.teamStrip.innerHTML = `
        <div class="gjc-teammate-card">
          <div class="gjc-teammate-top">
            <div class="gjc-teammate-name">รอเพื่อนร่วมทีม</div>
            <div>⌛</div>
          </div>
          <div class="gjc-teammate-mini">เมื่อเพื่อนเข้าร่วม จะเห็นคะแนนแต่ละคนที่นี่</div>
        </div>
      `;
      return;
    }

    ENGINE.teamStrip.innerHTML = participants.map((p) => {
      const me = String(p.pid || '') === String(getSelfKey());
      return `
        <div class="gjc-teammate-card">
          <div class="gjc-teammate-top">
            <div class="gjc-teammate-name">${escapeHtml(p.name || p.nick || 'Player')}${me ? ' • YOU' : ''}</div>
            <div>${me ? '⭐' : '🤝'}</div>
          </div>
          <div class="gjc-teammate-mini">
            Score ${num(p.score, 0)} • Miss ${num(p.miss, 0)} • Contribution ${num(p.contribution, num(p.score, 0))}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHud(){
    S.teamScore = currentTeamScoreFromPlayers();
    S.teamGoal = currentGoal();

    const participants = activeParticipants();
    const readyCount = currentReadyCount();
    const myRank = (() => {
      const rows = participants.map((p) => ({
        pid: p.pid,
        score: num(p.score, 0),
        miss: num(p.miss, 0),
        bestStreak: num(p.bestStreak || p.streak, 0)
      })).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.miss !== b.miss) return a.miss - b.miss;
        return b.bestStreak - a.bestStreak;
      });
      const idx = rows.findIndex((r) => String(r.pid || '') === String(getSelfKey()));
      return idx >= 0 ? idx + 1 : 0;
    })();

    if (UI.roomPill) UI.roomPill.textContent = ctx.roomId ? `ห้อง ${ctx.roomId}` : 'Coop';
    if (UI.teamScore) UI.teamScore.textContent = String(Math.max(0, Math.round(S.teamScore)));
    if (UI.time) UI.time.textContent = formatClock(timeLeftSec());
    if (UI.miss) UI.miss.textContent = String(S.miss);
    if (UI.contribution) UI.contribution.textContent = String(Math.max(0, Math.round(S.contribution)));

    if (UI.goodHit) UI.goodHit.textContent = String(S.goodHit);
    if (UI.junkHit) UI.junkHit.textContent = String(S.junkHit);
    if (UI.goodMiss) UI.goodMiss.textContent = String(S.goodMiss);

    if (UI.itemEmoji) UI.itemEmoji.textContent = '🤝';
    if (UI.itemTitle) UI.itemTitle.textContent = 'เป้าหมายของทีม';
    if (UI.itemSub) {
      UI.itemSub.textContent = S.started
        ? `ตอนนี้ทีมมี ${participants.length} คน • ช่วยกันเก็บอาหารดีให้ถึงเป้าหมาย`
        : 'ช่วยกันเก็บอาหารดีให้มากที่สุด แล้วทำคะแนนรวมของทีมให้สูง';
    }

    if (UI.goalValue) UI.goalValue.textContent = String(S.teamGoal);
    if (UI.goalFill) {
      const pct = Math.max(0, Math.min(100, (S.teamScore / Math.max(1, S.teamGoal)) * 100));
      UI.goalFill.style.width = pct.toFixed(1) + '%';
    }
    if (UI.goalSubFill) {
      const subPct = Math.max(0, Math.min(100, (S.contribution / Math.max(1, S.teamGoal)) * 100));
      UI.goalSubFill.style.width = subPct.toFixed(1) + '%';
    }

    if (UI.playerCount) UI.playerCount.textContent = String(participants.length || currentParticipantIds().length || 0);
    if (UI.readyCount) UI.readyCount.textContent = String(readyCount);
    if (UI.rankValue) UI.rankValue.textContent = myRank ? `#${myRank}` : '-';

    if (UI.tip) {
      if (ctx.spectate) {
        UI.tip.textContent = 'โหมดดูรอบนี้แบบ spectate';
      } else if (!S.started && roomStatus() === 'countdown') {
        UI.tip.textContent = 'กำลังนับถอยหลัง เริ่มพร้อมกันทั้งทีม';
      } else if (!S.started) {
        UI.tip.textContent = 'รอให้ห้อง Coop เริ่มรอบนี้';
      } else if (S.teamScore >= S.teamGoal) {
        UI.tip.textContent = 'คะแนนรวมของทีมถึงเป้าหมายแล้ว รักษาระดับไว้ให้จบรอบ';
      } else {
        UI.tip.textContent = `คะแนนรวมทีม ${S.teamScore}/${S.teamGoal} • contribution ของเรา ${S.contribution}`;
      }
    }

    renderTeamStrip();
    updateGlobals();

    emit('coop:update', {
      roomId: ctx.roomId,
      pid: ctx.pid,
      uid: S.uid,
      score: S.score,
      teamScore: S.teamScore,
      teamGoal: S.teamGoal,
      contribution: S.contribution,
      miss: S.miss,
      bestStreak: S.bestStreak,
      players: normalizeRoomPlayersMap(S.room.players),
      room: S.room,
      timeLeftSec: timeLeftSec()
    });

    emit('hha:score', {
      game: 'goodjunk',
      mode: 'coop',
      score: S.score,
      teamScore: S.teamScore
    });
  }

  function makeTarget(kind){
    const bounds = playBounds();
    const mobile = W.innerWidth <= 640;

    const size = Math.round((mobile ? 48 : 60) + S.rng() * (mobile ? 14 : 24));
    const usableW = Math.max(160, bounds.right - bounds.left);
    const x = bounds.left + Math.round((usableW - size) * S.rng());
    const y = bounds.top - size - Math.round(S.rng() * 18);
    const speed = S.cfg.speed * (0.94 + S.rng() * 0.44);
    const ttl = Math.round(S.cfg.ttl * (0.98 + S.rng() * 0.12));
    const sway = (S.rng() - 0.5) * 34;
    const bank = kind === 'good' ? GOOD_ITEMS : JUNK_ITEMS;
    const pick = bank[Math.floor(S.rng() * bank.length)];

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `gjc-target ${kind}`;
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
    if (!S.started || S.finished || ctx.spectate) return;
    if (S.targets.length >= S.cfg.maxTargets) return;
    const kind = S.rng() < S.cfg.goodRatio ? 'good' : 'junk';
    makeTarget(kind);
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try { t.el.remove(); } catch (_) {}
  }

  function hitTarget(t){
    if (!t || t.dead || !S.started || S.finished || ctx.spectate) return;
    removeTarget(t);

    if (t.kind === 'good'){
      S.streak += 1;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      S.goodHit += 1;

      const bonus = Math.min(10, Math.floor(S.streak / 4) * 2);
      const gain = 10 + bonus;
      S.score += gain;
      S.contribution += gain;

      flashText(t.x, t.y, `+${gain}`, 'good');
      setBanner('ดีมาก! ช่วยทีมเก็บของดีต่อเนื่อง', 800);
    } else {
      S.junkHit += 1;
      S.miss += 1;
      S.streak = 0;
      S.score = Math.max(0, S.score - 6);
      S.contribution = Math.max(0, S.contribution - 4);

      flashText(t.x, t.y, '-6', 'bad');
      setBanner('โดน junk แล้ว ระวังเป้าต่อไป', 800);
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
      S.contribution = Math.max(0, S.contribution - 1);
      flashText(t.x, t.y, 'MISS', 'bad');
      setBanner('อาหารดีหลุดไปแล้ว ช่วยกันเก็บให้ไวขึ้น', 800);
      renderHud();
      scheduleSync(false);
    }
  }

  function scheduleSync(force=false){
    if (!S.refs || !S.refs.players || !getSelfKey() || ctx.spectate) return;
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
    if (!S.refs || !S.refs.players || !getSelfKey() || ctx.spectate) return;
    const t = now();
    if (!force && (t - S.lastSyncTs < SYNC_MIN_MS)) return;
    S.lastSyncTs = t;

    const payload = {
      pid: getSelfKey(),
      uid: S.uid,
      playerId: getSelfKey(),
      name: ctx.name,
      nick: ctx.name,
      connected: true,
      ready: true,
      status: S.finished ? 'finished' : (S.started ? 'playing' : 'waiting'),
      phase: S.finished ? 'summary' : (S.started ? 'run' : 'lobby'),
      score: Math.max(0, Math.round(S.score)),
      contribution: Math.max(0, Math.round(S.contribution)),
      miss: Math.max(0, S.miss),
      streak: Math.max(0, S.bestStreak),
      bestStreak: Math.max(0, S.bestStreak),
      updatedAt: t,
      lastSeen: t
    };

    try {
      await S.refs.players.child(getSelfKey()).update(payload);
    } catch (err){
      console.warn('[gj-coop] syncSelfNow failed:', err);
    }
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
        cur.teamScore = 0;

        return cur;
      });
    } catch (err){
      console.warn('[gj-coop] host promote countdown failed:', err);
    } finally {
      S.hostPromoteBusy = false;
    }
  }

  async function maybeHostSyncTeamScore(){
    if (!isHost() || !S.refs || !S.refs.state || S.hostTeamSyncBusy) return;
    if (roomStatus() !== 'playing') return;

    S.hostTeamSyncBusy = true;
    try{
      const teamScore = currentTeamScoreFromPlayers();
      await S.refs.state.update({
        teamScore,
        updatedAt: now()
      }).catch(() => {});
    } finally {
      S.hostTeamSyncBusy = false;
    }
  }

  async function maybeHostEndRound(){
    if (!isHost() || !S.refs || !S.refs.state || S.hostEndingBusy) return;
    const status = roomStatus();
    if (status !== 'playing') return;

    const endsAt = currentRoomEndsAt();
    const timeUp = endsAt > 0 && now() >= endsAt;

    const participantCount = currentParticipantIds().length || activeParticipants().length;
    const resultCount = Object.keys(S.room.results || {}).length;
    const enoughResults = participantCount >= MIN_PLAYERS && resultCount >= participantCount;

    if (!timeUp && !enoughResults) return;

    S.hostEndingBusy = true;
    try{
      await S.refs.state.transaction((cur) => {
        cur = cur || {};
        if (String(cur.status || '') !== 'playing') return cur;
        cur.status = 'ended';
        cur.endedAt = now();
        cur.updatedAt = now();
        cur.teamScore = currentTeamScoreFromPlayers();
        return cur;
      });
    } catch (err){
      console.warn('[gj-coop] host end round failed:', err);
    } finally {
      S.hostEndingBusy = false;
    }
  }

  function startGameIfReady(){
    if (S.finished) return;
    if (roomStatus() !== 'playing') return;
    if (!ctx.spectate && !selfInParticipants()) return;

    const startedAt = currentStartedAt();
    const endsAt = currentRoomEndsAt();
    if (!startedAt || !endsAt) return;

    if (S.started && currentStartedAt() === startedAt) return;

    S.started = true;
    S.finished = false;

    S.lastFrameTs = 0;
    S.lastSpawnAt = now();
    S.targets = [];
    S.seq = 0;

    const me = selfPlayer();
    S.score = me ? num(me.score, 0) : 0;
    S.miss = me ? num(me.miss, 0) : 0;
    S.streak = 0;
    S.bestStreak = me ? num(me.bestStreak || me.streak, 0) : 0;
    S.goodHit = 0;
    S.junkHit = 0;
    S.goodMiss = 0;
    S.contribution = me ? num(me.contribution, num(me.score, 0)) : 0;
    S.teamScore = currentTeamScoreFromPlayers();
    S.teamGoal = currentGoal();

    S.cfg = DIFF_CFG[ctx.diff] || DIFF_CFG.normal;

    const seedHash = xmur3(`${ctx.seed}|${ctx.roomId}|${ctx.pid}|${startedAt}|coop`)();
    S.rng = mulberry32(seedHash);

    setBanner(ctx.spectate ? 'เริ่มดูรอบ Coop แล้ว' : 'เริ่มแล้ว! ช่วยทีมเก็บอาหารดีให้ถึงเป้าหมาย', 1300);
    renderHud();
    scheduleSync(true);

    if (RT) {
      RT.roundStarted({
        roundId: String((S.room.state && S.room.state.roundId) || ctx.roundId || ''),
        startAt: startedAt,
        endAt: endsAt,
        participantIds: currentParticipantIds()
      }).catch(() => {});
    }
  }

  function clearTargets(){
    S.targets.forEach(removeTarget);
    S.targets = [];
  }

  function computeStandings(resultsObj){
    const rows = Object.keys(resultsObj || {}).map((pid) => {
      const r = resultsObj[pid] || {};
      return {
        pid: cleanPid(r.pid || pid),
        nick: clean(r.nick || r.name || pid || 'player', 80),
        score: num(r.score, 0),
        contribution: num(r.contribution, num(r.score, 0)),
        miss: num(r.miss, 0),
        goodHit: num(r.goodHit, 0),
        junkHit: num(r.junkHit, 0),
        bestStreak: num(r.bestStreak, 0),
        duration: num(r.duration, ctx.timeSec)
      };
    });

    rows.sort((a, b) => {
      if (b.contribution !== a.contribution) return b.contribution - a.contribution;
      if (b.score !== a.score) return b.score - a.score;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
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
      mode: 'coop',
      roomId: ctx.roomId,
      roomKind: S.roomKind || ctx.roomKind || '',
      pid: getSelfKey(),
      uid: S.uid || ctx.uid || '',
      name: ctx.name,
      role: ctx.role,
      rank: 0,
      score: Math.max(0, Math.round(S.score)),
      teamScore: Math.max(0, Math.round(S.teamScore)),
      contribution: Math.max(0, Math.round(S.contribution)),
      goal: Math.max(0, Math.round(S.teamGoal)),
      players: Math.max(1, currentParticipantIds().length || activeParticipants().length || 1),
      miss: S.miss,
      goodHit: S.goodHit,
      junkHit: S.junkHit,
      bestStreak: S.bestStreak,
      duration: ctx.timeSec,
      result: S.teamScore >= S.teamGoal ? 'goal-reached' : 'finished',
      reason: clean(reason || 'timeup', 80),
      standings: []
    };
  }

  function buildFinalSummaryFromResults(reason){
    const standings = computeStandings(S.room.results || {});
    const me = standings.find((r) => String(r.pid || '') === String(getSelfKey())) || null;
    const teamScore = standings.reduce((sum, r) => sum + num(r.score, 0), 0);

    return {
      controllerFinal: standings.length >= Math.max(MIN_PLAYERS, currentParticipantIds().length || MIN_PLAYERS),
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'coop',
      roomId: ctx.roomId,
      roomKind: S.roomKind || ctx.roomKind || '',
      pid: getSelfKey(),
      uid: S.uid || ctx.uid || '',
      name: ctx.name,
      role: ctx.role,
      rank: me ? num(me.rank, 0) : 0,
      score: me ? num(me.score, 0) : Math.max(0, Math.round(S.score)),
      teamScore,
      contribution: me ? num(me.contribution, 0) : Math.max(0, Math.round(S.contribution)),
      goal: Math.max(0, Math.round(S.teamGoal)),
      players: standings.length || 1,
      miss: me ? num(me.miss, 0) : S.miss,
      goodHit: me ? num(me.goodHit, 0) : S.goodHit,
      junkHit: me ? num(me.junkHit, 0) : S.junkHit,
      bestStreak: me ? num(me.bestStreak, 0) : S.bestStreak,
      duration: me ? num(me.duration, ctx.timeSec) : ctx.timeSec,
      result: teamScore >= S.teamGoal ? 'goal-reached' : 'finished',
      reason: clean(reason || 'finished', 80),
      standings,
      raw: {
        goal: S.teamGoal,
        teamScore
      }
    };
  }

  async function submitOwnResult(summary){
    if (!S.refs || !summary || ctx.spectate) return;

    S.localSummary = summary;

    await S.refs.results.child(getSelfKey()).set({
      pid: getSelfKey(),
      nick: ctx.name,
      score: num(summary.score, 0),
      contribution: num(summary.contribution, num(summary.score, 0)),
      miss: num(summary.miss, 0),
      goodHit: num(summary.goodHit, 0),
      junkHit: num(summary.junkHit, 0),
      bestStreak: num(summary.bestStreak, 0),
      duration: num(summary.duration, 0),
      reason: clean(summary.reason || 'finished', 80),
      submittedAt: now(),
      updatedAt: now()
    });

    await S.refs.players.child(getSelfKey()).update({
      phase: 'summary',
      finished: true,
      finalScore: num(summary.score, 0),
      score: num(summary.score, 0),
      contribution: num(summary.contribution, num(summary.score, 0)),
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
    UI.resultMount.hidden = false;
    emitSummary(summary);
  }

  function scheduleFallbackSummary(){
    maybeClearFallbackTimer();
    if (!S.localSummary || S.finalSummarySent) return;

    S.fallbackTimer = setTimeout(() => {
      if (S.finalSummarySent) return;
      const summary = buildFinalSummaryFromResults('fallback-local');
      S.finalSummarySent = true;
      showResultSummary(summary);
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
      console.error('[gj-coop] submitOwnResult failed', err);
    });

    showResultSummary(summary);
    scheduleFallbackSummary();
  }

  function renderWaitingStates(){
    const status = roomStatus();

    if (status === 'countdown'){
      const left = Math.max(0, Math.ceil((currentCountdownEndsAt() - now()) / 1000));
      if (left > 0) {
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
      setBanner(actives >= MIN_PLAYERS
        ? 'รอหัวหน้าห้องกด Start จาก Lobby…'
        : `รอผู้เล่นเพิ่มอีก ${Math.max(0, MIN_PLAYERS - actives)} คน`);
      return;
    }

    if (status === 'ended' || status === 'finished'){
      if (!S.finished && !ctx.spectate) finalizeSummary('room-ended');
      return;
    }

    setBanner('กำลังรอสถานะห้อง Coop…');
  }

  function loop(frameTs){
    if (S.finished && !ctx.spectate) return;

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

    if (!ctx.spectate && tNow - S.lastSpawnAt >= S.cfg.spawnEvery){
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

    if (isHost()) {
      maybeHostSyncTeamScore();
      maybeHostEndRound();
    }

    if (currentRoomEndsAt() && now() >= currentRoomEndsAt()){
      if (isHost()){
        maybeHostSyncTeamScore();
        maybeHostEndRound();
      } else if (roomStatus() === 'playing'){
        setBanner('หมดเวลาแล้ว รอหัวหน้าห้องปิดรอบ…', 1200);
      }
    }

    renderHud();
    S.loopId = raf(loop);
  }

  function tryCenterShoot(){
    if (!ENGINE.field || !S.targets.length || !S.started || S.finished || ctx.spectate) return;

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
    const order = preferred ? [preferred, 'coopRooms', 'rooms'] : ['coopRooms', 'rooms'];
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
        mode: 'coop',
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
        participantIds: [],
        teamScore: 0,
        updatedAt: t
      },
      match: {
        participantIds: [],
        lockedAt: null,
        status: 'idle',
        coop: {
          finishedAt: 0,
          teamScore: 0
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
    if (ctx.spectate) return;

    const t = now();
    const existing = (S.room.players || {})[getSelfKey()] || null;

    const base = {
      pid: getSelfKey(),
      uid: S.uid,
      playerId: getSelfKey(),
      name: ctx.name,
      nick: ctx.name,
      connected: true,
      ready: true,
      status: roomStatus() === 'playing' ? 'playing' : (roomStatus() === 'countdown' ? 'countdown' : 'waiting'),
      phase: roomStatus() === 'playing' ? 'run' : 'lobby',
      score: existing ? num(existing.score, 0) : 0,
      contribution: existing ? num(existing.contribution, num(existing.score, 0)) : 0,
      miss: existing ? num(existing.miss, 0) : 0,
      combo: 0,
      streak: existing ? num(existing.streak || existing.bestStreak, 0) : 0,
      bestStreak: existing ? num(existing.bestStreak || existing.streak, 0) : 0,
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
    } catch (_) {}
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
      } else if ((status === 'ended' || status === 'finished') && !S.finished && !ctx.spectate){
        finalizeSummary('room-state-ended');
      } else if (status === 'waiting' && !S.started && !S.finished){
        setBanner('รอหัวหน้าห้องเริ่มรอบ Coop…');
      }
    });

    S.refs.match.on('value', (snap) => {
      S.room.match = snap.val() || {};
      renderHud();
      updateGlobals();
    });

    S.refs.players.on('value', (snap) => {
      S.room.players = normalizeRoomPlayersMap(snap.val() || {});
      updateGlobals();

      const me = selfPlayer();
      if (me && !S.started && !S.finished){
        S.score = num(me.score, 0);
        S.contribution = num(me.contribution, num(me.score, 0));
        S.miss = num(me.miss, 0);
        S.bestStreak = num(me.bestStreak || me.streak, 0);
      }

      if (isHost()) {
        maybeHostSyncTeamScore();
        maybeHostEndRound();
      }

      renderHud();
    });

    S.refs.results.on('value', async (snap) => {
      S.room.results = snap.val() || {};
      updateGlobals();

      const participantCount = currentParticipantIds().length || activeParticipants().length || MIN_PLAYERS;
      const count = Object.keys(S.room.results || {}).length;

      if (count >= participantCount && !S.finalSummarySent){
        maybeClearFallbackTimer();
        const summary = buildFinalSummaryFromResults('compare-ready');
        S.finalSummarySent = true;
        showResultSummary(summary);

        if (isHost()) {
          const teamScore = summary.teamScore || 0;

          await S.refs.match.update({
            status: 'finished',
            finishedAt: now(),
            teamScore
          }).catch(() => {});

          await S.refs.state.update({
            status: 'ended',
            endedAt: now(),
            updatedAt: now(),
            teamScore
          }).catch(() => {});
        }
      }
    });
  }

  function startHeartbeat(){
    clearInterval(S.heartbeatId);
    S.heartbeatId = setInterval(() => {
      if (!S.refs) return;

      if (!ctx.spectate && S.refs.players) {
        S.refs.players.child(getSelfKey()).update({
          connected: true,
          status: S.finished ? 'finished' : (S.started ? 'playing' : roomStatus() || 'waiting'),
          phase: S.finished ? 'summary' : (S.started ? 'run' : 'lobby'),
          updatedAt: now(),
          lastSeen: now()
        }).catch(() => {});
      }

      if (isHost()) {
        maybeHostSyncTeamScore();
        maybeHostPromoteCountdown();
        maybeHostEndRound();
      }
    }, HEARTBEAT_MS);
  }

  function bindEvents(){
    W.addEventListener('hha:shoot', () => {
      tryCenterShoot();
    });

    W.addEventListener('beforeunload', () => {
      clearInterval(S.heartbeatId);
      clearTimeout(S.syncTimer);
      maybeClearFallbackTimer();
      caf(S.loopId);

      try{
        if (!ctx.spectate && S.refs && S.refs.players){
          S.refs.players.child(getSelfKey()).update({
            connected: false,
            status: S.finished ? 'finished' : 'left',
            updatedAt: now(),
            lastSeen: now()
          }).catch(() => {});
        }
      } catch (_) {}
    });
  }

  async function boot(){
    buildDom();

    setBanner('กำลังเชื่อม GoodJunk Coop…');
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
      const seedHash = xmur3(`${ctx.seed}|${ctx.roomId}|${ctx.pid}|coop`)();
      S.rng = mulberry32(seedHash);
    }

    const status = roomStatus();
    if (status === 'playing'){
      startGameIfReady();
    } else if (status === 'countdown'){
      setBanner('กำลังนับถอยหลังก่อนเริ่ม Coop…');
      if (isHost()) maybeHostPromoteCountdown();
    } else {
      setBanner(ctx.spectate ? 'เชื่อมห้องสำเร็จ • spectate mode' : 'เชื่อมห้องสำเร็จ รอสถานะเล่นจาก Lobby…');
    }

    renderHud();
    updateGlobals();

    caf(S.loopId);
    S.loopId = raf(loop);
  }

  boot().catch((err) => {
    console.error('[gj-coop-core] boot failed:', err);
    try {
      buildDom();
      setBanner('เข้า GoodJunk Coop ไม่สำเร็จ');
      if (ENGINE.teamStrip){
        ENGINE.teamStrip.innerHTML = `
          <div class="gjc-teammate-card" style="min-width:320px;">
            <div class="gjc-teammate-top">
              <div class="gjc-teammate-name">เกิดปัญหาระหว่างเชื่อมเกม</div>
              <div>⚠️</div>
            </div>
            <div class="gjc-teammate-mini">${escapeHtml(String(err && err.message ? err.message : err))}</div>
            <div class="gjc-teammate-mini" style="margin-top:10px;">
              ลองกลับไปที่ Lobby แล้วเข้ารอบใหม่อีกครั้ง
            </div>
          </div>
        `;
      }
      renderHud();
    } catch (_) {}
  });

  W.__GJ_COOP_CORE__ = {
    ctx,
    state: S,
    finalizeSummary,
    tryCenterShoot
  };
})();