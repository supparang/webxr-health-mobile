'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.duet.js
 * GoodJunk Duet Run
 * FULL PATCH v20260406-duet-run-runtime-dualmode
 * - supports old direct Firebase room schema
 * - supports new room-engine + herohealth-logger + duet-play-bridge
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_DUET_RUN_LOADED__) return;
  W.__GJ_DUET_RUN_LOADED__ = true;

  const SYNC_MIN_MS = 120;
  const HEARTBEAT_MS = 2500;
  const ACTIVE_TTL_MS = 15000;
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

  function emit(name, detail){
    try { W.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }
    catch {}
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

  const GOOD = [
    { emoji:'🍎', name:'Apple' },
    { emoji:'🍌', name:'Banana' },
    { emoji:'🍉', name:'Watermelon' },
    { emoji:'🥕', name:'Carrot' },
    { emoji:'🥦', name:'Broccoli' },
    { emoji:'🍓', name:'Strawberry' },
    { emoji:'🍇', name:'Grapes' },
    { emoji:'🥛', name:'Milk' }
  ];

  const JUNK = [
    { emoji:'🍩', name:'Donut' },
    { emoji:'🍟', name:'Fries' },
    { emoji:'🍭', name:'Lollipop' },
    { emoji:'🍬', name:'Candy' },
    { emoji:'🧃', name:'Sweet Drink' },
    { emoji:'🧁', name:'Cupcake' },
    { emoji:'🍪', name:'Cookie' }
  ];

  const DIFF = {
    easy:   { spawnEvery: 840, maxTargets: 5, ttl: 3000, speed: 118, goodRatio: 0.79 },
    normal: { spawnEvery: 690, maxTargets: 6, ttl: 2500, speed: 148, goodRatio: 0.72 },
    hard:   { spawnEvery: 550, maxTargets: 7, ttl: 2100, speed: 182, goodRatio: 0.66 }
  };

  const ctx = {
    game: 'goodjunk',
    zone: 'nutrition',
    mode: 'duet',
    roomId: cleanRoom(qs('roomId', qs('room', ''))),
    roomKind: clean(qs('roomKind', ''), 40),
    pid: cleanPid(qs('pid', 'anon')),
    uid: cleanPid(qs('uid', '')),
    name: clean(qs('name', qs('nick', 'Player')), 80),
    role: clean(qs('role', 'player'), 24),
    diff: clean(qs('diff', 'normal'), 24).toLowerCase(),
    time: clamp(qs('time', '90'), 30, 300),
    seed: clean(qs('seed', String(now())), 80),
    startAt: num(qs('startAt', '0'), 0),
    roomRoundId: clean(qs('roundId', ''), 80),
    hub: clean(qs('hub', '../hub.html'), 400),
    view: clean(qs('view', 'mobile'), 24),
    host: clean(qs('host', '0'), 8),
    run: clean(qs('run', 'play'), 24)
  };

  const UI = {
    roomPill: byId('duetRoomPill'),
    score: byId('duetScoreValue'),
    time: byId('duetTimeValue'),
    miss: byId('duetMissValue'),
    streak: byId('duetStreakValue'),

    itemIcon: byId('duetItemIcon'),
    itemEmoji: byId('duetItemEmoji'),
    itemTitle: byId('duetItemTitle'),
    itemSub: byId('duetItemSub'),

    goodHit: byId('duetGoodHitValue'),
    junkHit: byId('duetJunkHitValue'),
    goodMiss: byId('duetGoodMissValue'),

    tip: byId('duetTipText'),
    pairGoalValue: byId('duetPairGoalValue'),
    pairGoalFill: byId('duetPairGoalFill'),
    pairGoalSubFill: byId('duetPairGoalSubFill'),

    stage: byId('duetGameStage'),
    countdownOverlay: byId('duetCountdownOverlay'),
    countdownNum: byId('duetCountdownNum'),
    countdownText: byId('duetCountdownText'),

    resultMount: byId('duetResultMount')
  };

  const G = {
    db: null,
    auth: null,
    uid: '',
    roomKind: clean(ctx.roomKind, 40),
    refs: null,

    meta: {},
    state: {},
    match: {},
    players: {},
    results: {},
    progress: {},

    started: false,
    finished: false,
    summaryShown: false,
    resultSubmitted: false,
    finalSummarySent: false,

    cfg: DIFF.normal,
    rng: null,

    loopId: 0,
    heartbeatId: 0,
    syncTimer: 0,
    lastSyncTs: 0,
    fallbackTimer: 0,
    engineUnwatch: null,

    lastFrameTs: 0,
    lastSpawnAt: 0,
    roundStartAt: 0,
    roundEndAt: 0,

    seq: 0,
    targets: [],

    score: 0,
    miss: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,
    streak: 0,
    bestStreak: 0,

    localSummary: null
  };

  let RT = null;

  function initRuntime(){
    if (!(W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function')) {
      RT = null;
      return null;
    }

    RT = W.HHARuntimeContract.create({
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'duet',
      getCtx: () => ({
        roomId: ctx.roomId || '',
        roomKind: G.roomKind || ctx.roomKind || '',
        pid: ctx.pid || '',
        uid: G.uid || ctx.uid || '',
        name: ctx.name || '',
        role: ctx.role || '',
        diff: ctx.diff || '',
        time: Number(ctx.time || 0),
        seed: String(ctx.seed || ''),
        view: ctx.view || '',
        host: String(ctx.host || '0')
      })
    });

    return RT;
  }

  async function ensureRuntimeContract(){
    if (W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function') return true;
    try { await loadScript('../js/hha-cloud-logger-bridge.js'); } catch (_) {}
    try { await loadScript('../js/hha-runtime-contract.js'); } catch (_) {}
    return !!(W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function');
  }

  function hasDuetBridge(){
    return !!(W.HHA_DUET_BRIDGE && W.HHA_DUET_BRIDGE.ready);
  }

  async function waitForDuetBridge(timeoutMs = 4000){
    const started = now();
    while ((now() - started) < timeoutMs) {
      if (hasDuetBridge()) return true;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return false;
  }

  function currentGoal(){
    const base = Math.max(260, ctx.time * 8);
    if (ctx.diff === 'easy') return Math.round(base * 0.85);
    if (ctx.diff === 'hard') return Math.round(base * 1.12);
    return Math.round(base);
  }

  function partnerPlayer(){
    const arr = Object.values(G.players || {});
    return arr.find((p) => String(p.pid || '') !== String(ctx.pid || '')) || null;
  }

  function progressOfPlayer(p){
    if (!p) return null;

    if (p.uid && G.progress && G.progress[p.uid]) return G.progress[p.uid];

    const found = Object.keys(G.progress || {}).find((key) => {
      const row = G.progress[key] || {};
      return String(row.pid || '') === String(p.pid || '');
    });

    return found ? G.progress[found] : null;
  }

  function partnerLiveScore(){
    const p = partnerPlayer();
    const pr = progressOfPlayer(p);
    if (pr) return num(pr.score, 0);
    return num(p && p.score, 0);
  }

  function teamLiveScore(){
    return num(G.score, 0) + partnerLiveScore();
  }

  function currentBridgeState(){
    return {
      score: Math.max(0, Math.round(G.score)),
      miss: Math.max(0, G.miss),
      bestStreak: Math.max(0, G.bestStreak),
      progress: Math.max(0, Math.min(1, ctx.time > 0
        ? ((ctx.time - timeLeftSec()) / Math.max(1, ctx.time))
        : 0)),
      hp: '',
      lives: ''
    };
  }

  function pushBridgeState(){
    if (!hasDuetBridge()) return;

    const state = currentBridgeState();

    try {
      if (typeof W.HHA_DUET_PUSH_STATE === 'function') {
        W.HHA_DUET_PUSH_STATE(state);
        return;
      }
    } catch (_) {}

    try {
      if (W.HHA_DUET_BRIDGE && typeof W.HHA_DUET_BRIDGE.tick === 'function') {
        W.HHA_DUET_BRIDGE.tick(state);
      }
    } catch (_) {}
  }

  function pushBridgeEvent(type, detail){
    if (!hasDuetBridge()) return;

    try {
      if (typeof W.HHA_DUET_PUSH_EVENT === 'function') {
        W.HHA_DUET_PUSH_EVENT(type, detail || {});
        return;
      }
    } catch (_) {}

    try {
      if (W.HHA_DUET_BRIDGE && typeof W.HHA_DUET_BRIDGE.event === 'function') {
        W.HHA_DUET_BRIDGE.event(type, detail || {});
      }
    } catch (_) {}
  }

  function renderHud(){
    if (UI.roomPill) UI.roomPill.textContent = ctx.roomId ? `ห้อง ${ctx.roomId}` : 'Duet';
    if (UI.score) UI.score.textContent = String(Math.max(0, Math.round(G.score)));
    if (UI.time) UI.time.textContent = formatClock(timeLeftSec());
    if (UI.miss) UI.miss.textContent = String(G.miss);
    if (UI.streak) UI.streak.textContent = String(G.bestStreak);

    if (UI.goodHit) UI.goodHit.textContent = String(G.goodHit);
    if (UI.junkHit) UI.junkHit.textContent = String(G.junkHit);
    if (UI.goodMiss) UI.goodMiss.textContent = String(G.goodMiss);

    if (UI.itemEmoji) UI.itemEmoji.textContent = G.started ? '🥗' : '🍉';
    if (UI.itemTitle) UI.itemTitle.textContent = 'อาหารดี';
    if (UI.itemSub) {
      UI.itemSub.textContent = G.started
        ? 'ช่วยกันเก็บอาหารดีทั้งคู่เพื่อเร่งคะแนนรวม'
        : 'รอเริ่มพร้อมกันทั้งสองฝั่ง';
    }

    const goal = currentGoal();
    const meScore = Math.max(0, Math.round(G.score));
    const partnerScore = Math.max(0, Math.round(partnerLiveScore()));
    const teamScore = meScore + partnerScore;

    if (UI.pairGoalValue) UI.pairGoalValue.textContent = String(goal);
    if (UI.pairGoalFill) {
      UI.pairGoalFill.style.width = `${Math.max(0, Math.min(100, (teamScore / Math.max(1, goal)) * 100)).toFixed(1)}%`;
    }
    if (UI.pairGoalSubFill) {
      UI.pairGoalSubFill.style.width = `${Math.max(0, Math.min(100, (meScore / Math.max(1, goal)) * 100)).toFixed(1)}%`;
    }

    if (UI.tip) {
      if (!G.started) {
        UI.tip.textContent = ctx.startAt > now()
          ? 'รอเริ่มพร้อมกันทั้งคู่'
          : 'แตะอาหารดีให้ไวที่สุด แล้วช่วยกันทำคะแนนรวม';
      } else if (teamScore >= goal) {
        UI.tip.textContent = 'ยอดเยี่ยม! ทีมของคุณแตะถึงเป้าหมายแล้ว';
      } else if (G.miss >= 6) {
        UI.tip.textContent = 'ระวังอาหารดีหลุดจอมากเกินไป จะเสียโอกาสทำคะแนนทีม';
      } else {
        UI.tip.textContent = `คะแนนเรา ${meScore} • คะแนนเพื่อน ${partnerScore} • รวมทีม ${teamScore}`;
      }
    }

    emit('gj:duet-live', {
      score: G.score,
      teamScore: teamLiveScore(),
      miss: G.miss,
      goodHit: G.goodHit,
      junkHit: G.junkHit,
      goodMiss: G.goodMiss,
      streak: G.streak,
      bestStreak: G.bestStreak,
      timeLeftSec: timeLeftSec()
    });

    emit('hha:score', {
      game: 'goodjunk',
      mode: 'duet',
      score: G.score,
      teamScore: teamLiveScore()
    });
  }

  function updateCountdownUi(){
    if (!UI.countdownOverlay) return;

    const effectiveStart = effectiveStartAt();
    const left = Math.max(0, Math.ceil((effectiveStart - now()) / 1000));

    if (!G.started && !G.finished && effectiveStart > now()){
      UI.countdownOverlay.classList.add('show');
      if (UI.countdownNum) UI.countdownNum.textContent = String(left || 0);
      if (UI.countdownText) UI.countdownText.textContent = 'เตรียมตัวเล่นพร้อมกับเพื่อน';
    } else {
      UI.countdownOverlay.classList.remove('show');
    }
  }

  function installStyles(){
    if (D.getElementById('gjDuetCoreStyles')) return;

    const style = D.createElement('style');
    style.id = 'gjDuetCoreStyles';
    style.textContent = `
      #duetGameStage{
        position:relative;
        overflow:hidden;
      }
      .gjd-target{
        position:absolute;
        display:grid;
        place-items:center;
        border-radius:20px;
        border:2px solid #fff;
        box-shadow:0 12px 24px rgba(0,0,0,.12);
        cursor:pointer;
        user-select:none;
        transform:translateZ(0);
        min-width:56px;
        min-height:56px;
        touch-action:manipulation;
      }
      .gjd-target.good{ background:linear-gradient(180deg,#ffffff,#f1fff1); }
      .gjd-target.junk{ background:linear-gradient(180deg,#fff3f3,#ffe1e1); }
      .gjd-target .emoji{
        font-size:clamp(24px,4vw,38px);
        line-height:1;
      }
      .gjd-fx{
        position:absolute;
        pointer-events:none;
        z-index:40;
        font-size:20px;
        line-height:1;
        font-weight:1000;
        text-shadow:0 1px 0 #fff;
        animation:gjd-float .48s ease-out forwards;
      }
      .gjd-fx.good{ color:#15803d; }
      .gjd-fx.bad{ color:#b91c1c; }
      @keyframes gjd-float{
        0%{ opacity:0; transform:translateY(8px) scale(.9); }
        15%{ opacity:1; }
        100%{ opacity:0; transform:translateY(-28px) scale(1.04); }
      }
      .gjd-result-shell{
        width:min(1100px,100%);
        max-height:min(92vh,1020px);
        overflow:auto;
        border-radius:28px;
        border:1px solid #bfe3f2;
        background:#fffdf8;
        box-shadow:0 28px 80px rgba(0,0,0,.22);
        padding:18px;
        display:grid;
        gap:14px;
      }
      .gjd-result-top{
        display:grid;
        gap:8px;
      }
      .gjd-kicker{
        display:inline-flex;
        align-items:center;
        min-height:32px;
        padding:6px 12px;
        border-radius:999px;
        border:1px solid #bfe3f2;
        background:#f4fbff;
        color:#658cb1;
        font-size:12px;
        font-weight:1100;
      }
      .gjd-title{
        font-size:28px;
        line-height:1.15;
        font-weight:1100;
        color:#7a2558;
      }
      .gjd-sub{
        color:#6b7280;
        font-size:14px;
        line-height:1.6;
        font-weight:900;
      }
      .gjd-teamcard{
        margin:0 auto 10px;
        width:min(720px,100%);
        border-radius:24px;
        border:3px solid #e9d7b3;
        background:#fff;
        box-shadow:0 10px 22px rgba(86,155,194,.10);
        padding:16px 14px;
        text-align:center;
      }
      .gjd-teamlabel{
        color:#c48a23;
        font-size:14px;
        font-weight:1000;
        margin-bottom:6px;
      }
      .gjd-teamscore{
        color:#4d4a42;
        font-size:clamp(40px,6vw,60px);
        line-height:1;
        font-weight:1000;
      }
      .gjd-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
      }
      .gjd-box{
        border-radius:18px;
        border:2px solid #cde7f4;
        background:#fff;
        padding:14px;
        text-align:center;
      }
      .gjd-box-label{
        font-size:12px;
        color:#79aeca;
        font-weight:1000;
        margin-bottom:6px;
      }
      .gjd-box-name{
        font-size:14px;
        line-height:1.5;
        color:#6d6b63;
        font-weight:1000;
        margin-bottom:8px;
        word-break:break-word;
      }
      .gjd-box-score{
        font-size:34px;
        line-height:1;
        color:#4d4a42;
        font-weight:1000;
      }
      .gjd-statgrid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
      }
      .gjd-stat{
        border-radius:18px;
        border:1px solid #bfe3f2;
        background:#ffffffcc;
        padding:14px;
        text-align:center;
      }
      .gjd-stat-k{
        font-size:12px;
        color:#6b7280;
        font-weight:1000;
        margin-bottom:6px;
      }
      .gjd-stat-v{
        font-size:26px;
        line-height:1;
        color:#244f6d;
        font-weight:1100;
      }
      .gjd-standings{
        display:grid;
        gap:10px;
      }
      .gjd-row{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
        padding:12px;
        border-radius:16px;
        border:2px solid #cde7f4;
        background:#fff;
        flex-wrap:wrap;
      }
      .gjd-row-left{
        display:grid;
        gap:4px;
      }
      .gjd-row-name{
        font-weight:1000;
        color:#4d4a42;
      }
      .gjd-row-mini{
        font-size:12px;
        color:#79aeca;
        font-weight:1000;
      }
      .gjd-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        position:sticky;
        bottom:0;
        padding-top:10px;
        background:linear-gradient(180deg, rgba(255,253,248,0), rgba(255,253,248,.92) 22%, rgba(255,253,248,1));
        z-index:30;
      }
      .gjd-actions .btn{
        flex:1 1 180px;
        min-height:50px;
      }
      .gjd-debug{
        border-radius:16px;
        background:#fff;
        border:1px dashed #bfe3f2;
        padding:12px;
        color:#6b7280;
        font-size:12px;
        line-height:1.6;
        white-space:pre-wrap;
        word-break:break-word;
      }
      @media (max-width:820px){
        .gjd-statgrid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
      @media (max-width:760px){
        .gjd-grid{ grid-template-columns:1fr; }
        .gjd-actions{ display:grid; grid-template-columns:1fr; }
      }
    `;
    D.head.appendChild(style);
  }

  function stageRect(){
    const r = UI.stage.getBoundingClientRect();
    return {
      w: Math.max(320, Math.round(r.width || 960)),
      h: Math.max(420, Math.round(r.height || 580))
    };
  }

  function playInsets(){
    const mobile = W.innerWidth <= 640;
    return {
      top: mobile ? 56 : 86,
      right: mobile ? 10 : 18,
      bottom: mobile ? 96 : 96,
      left: mobile ? 10 : 18
    };
  }

  function playBounds(){
    const rect = stageRect();
    const inset = playInsets();
    return {
      w: rect.w,
      h: rect.h,
      left: inset.left,
      right: Math.max(inset.left + 150, rect.w - inset.right),
      top: inset.top,
      bottom: Math.max(inset.top + 220, rect.h - inset.bottom)
    };
  }

  function effectiveStartAt(){
    const stateStart = num((G.state && (G.state.startAt || G.state.countdownEndsAt)) || 0, 0);
    return stateStart || num(ctx.startAt, 0) || now();
  }

  function timeLeftSec(){
    if (!G.started) {
      const s = effectiveStartAt();
      if (s > now()) return Math.max(0, Math.ceil((s - now()) / 1000));
      return ctx.time;
    }
    return Math.max(0, Math.ceil((G.roundEndAt - now()) / 1000));
  }

  function isActivePlayer(p, t=now()){
    if (!p) return false;
    if (p.connected === false) return false;
    const lastSeen = num(p.lastSeen || p.updatedAt || p.joinedAt, 0);
    if (!lastSeen) return true;
    return (t - lastSeen) <= ACTIVE_TTL_MS;
  }

  function activePlayers(){
    const t = now();
    return Object.values(G.players || {})
      .filter((p) => isActivePlayer(p, t))
      .sort((a, b) => num(a.joinedAt, 0) - num(b.joinedAt, 0));
  }

  function partnerInfo(){
    const arr = activePlayers();
    return arr.find((p) => String(p.pid || '') !== String(ctx.pid || '')) || null;
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try { t.el.remove(); } catch (_) {}
  }

  function clearTargets(){
    G.targets.forEach(removeTarget);
    G.targets = [];
  }

  function flash(x, y, text, kind){
    if (!UI.stage) return;
    const el = D.createElement('div');
    el.className = `gjd-fx ${kind || ''}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    UI.stage.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 520);
  }

  function makeTarget(kind){
    const bounds = playBounds();
    const mobile = W.innerWidth <= 640;
    const size = Math.round((mobile ? 48 : 60) + G.rng() * (mobile ? 14 : 24));
    const usableW = Math.max(150, bounds.right - bounds.left);
    const x = bounds.left + Math.round((usableW - size) * G.rng());
    const y = bounds.top - size - Math.round(G.rng() * 16);
    const speed = G.cfg.speed * (0.92 + G.rng() * 0.4);
    const ttl = Math.round(G.cfg.ttl * (0.96 + G.rng() * 0.1));
    const sway = (G.rng() - 0.5) * 34;
    const bank = kind === 'good' ? GOOD : JUNK;
    const item = bank[Math.floor(G.rng() * bank.length)];

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `gjd-target ${kind}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = `<span class="emoji">${item.emoji}</span>`;
    el.setAttribute('aria-label', item.name);

    const t = {
      id: `t-${++G.seq}`,
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

    UI.stage.appendChild(el);
    G.targets.push(t);
  }

  function spawnTarget(){
    if (!G.started || G.finished) return;
    if (G.targets.length >= G.cfg.maxTargets) return;
    const kind = G.rng() < G.cfg.goodRatio ? 'good' : 'junk';
    makeTarget(kind);
  }

  function scheduleSync(force=false){
    if (hasDuetBridge()) {
      if (force) {
        pushBridgeState();
        return;
      }
      if (G.syncTimer) return;
      G.syncTimer = setTimeout(() => {
        G.syncTimer = 0;
        pushBridgeState();
      }, 60);
      return;
    }

    if (!G.refs || !G.refs.players || !G.uid) return;
    if (force) {
      syncSelfNow(true);
      return;
    }
    if (G.syncTimer) return;
    G.syncTimer = setTimeout(() => {
      G.syncTimer = 0;
      syncSelfNow(false);
    }, 60);
  }

  async function syncSelfNow(force){
    if (hasDuetBridge()) {
      pushBridgeState();
      return;
    }

    if (!G.refs || !G.refs.players || !G.uid) return;
    const t = now();
    if (!force && (t - G.lastSyncTs < SYNC_MIN_MS)) return;
    G.lastSyncTs = t;

    try {
      await G.refs.players.child(ctx.pid).update({
        pid: ctx.pid,
        nick: ctx.name,
        connected: true,
        ready: true,
        phase: G.finished ? 'summary' : (G.started ? 'run' : 'lobby'),
        score: Math.max(0, Math.round(G.score)),
        miss: Math.max(0, G.miss),
        streak: Math.max(0, G.bestStreak),
        bestStreak: Math.max(0, G.bestStreak),
        updatedAt: t,
        lastSeen: t
      });
    } catch (err) {
      console.warn('[gj-duet] syncSelfNow failed', err);
    }
  }

  function hitTarget(t){
    if (!t || t.dead || !G.started || G.finished) return;
    removeTarget(t);

    if (t.kind === 'good') {
      G.streak += 1;
      G.bestStreak = Math.max(G.bestStreak, G.streak);
      G.goodHit += 1;

      const bonus = Math.min(12, Math.floor(G.streak / 3) * 2);
      G.score += 10 + bonus;

      flash(t.x, t.y, `+${10 + bonus}`, 'good');

      renderHud();
      scheduleSync(false);

      pushBridgeEvent('target_hit', {
        phase: 'run',
        result: 'correct',
        score_delta: 10 + bonus,
        score_total: G.score,
        streak: G.bestStreak,
        miss_total: G.miss,
        progress: Math.max(0, Math.min(1, ((ctx.time - timeLeftSec()) / Math.max(1, ctx.time))))
      });

      if (RT) {
        RT.scoreUpdated({
          score: G.score,
          teamScore: teamLiveScore(),
          miss: G.miss,
          goodHit: G.goodHit,
          junkHit: G.junkHit,
          bestStreak: G.bestStreak
        }).catch(() => {});
      }
    } else {
      G.junkHit += 1;
      G.miss += 1;
      G.streak = 0;
      G.score = Math.max(0, G.score - 8);

      flash(t.x, t.y, '-8', 'bad');

      renderHud();
      scheduleSync(false);

      pushBridgeEvent('target_hit', {
        phase: 'run',
        result: 'wrong',
        score_delta: -8,
        score_total: G.score,
        streak: G.bestStreak,
        miss_total: G.miss,
        progress: Math.max(0, Math.min(1, ((ctx.time - timeLeftSec()) / Math.max(1, ctx.time))))
      });

      if (RT) {
        RT.scoreUpdated({
          score: G.score,
          teamScore: teamLiveScore(),
          miss: G.miss,
          goodHit: G.goodHit,
          junkHit: G.junkHit,
          bestStreak: G.bestStreak
        }).catch(() => {});
      }
    }
  }

  function expireTarget(t){
    removeTarget(t);

    if (t.kind === 'good'){
      G.goodMiss += 1;
      G.miss += 1;
      G.streak = 0;
      flash(t.x, t.y, 'MISS', 'bad');

      renderHud();
      scheduleSync(false);

      pushBridgeEvent('target_miss', {
        phase: 'run',
        result: 'miss',
        score_delta: 0,
        score_total: G.score,
        streak: G.bestStreak,
        miss_total: G.miss,
        progress: Math.max(0, Math.min(1, ((ctx.time - timeLeftSec()) / Math.max(1, ctx.time))))
      });

      if (RT) {
        RT.scoreUpdated({
          score: G.score,
          teamScore: teamLiveScore(),
          miss: G.miss,
          goodHit: G.goodHit,
          junkHit: G.junkHit,
          goodMiss: G.goodMiss,
          bestStreak: G.bestStreak
        }).catch(() => {});
      }
    }
  }

  function beginPlayNow(){
    if (G.started || G.finished) return;

    G.started = true;
    G.roundStartAt = now();
    G.roundEndAt = G.roundStartAt + ctx.time * 1000;
    G.lastFrameTs = 0;
    G.lastSpawnAt = now();

    if (RT) {
      RT.roundStarted({
        roundId: String((G.state && G.state.roundId) || ctx.roomRoundId || ''),
        startAt: G.roundStartAt,
        endAt: G.roundEndAt,
        participantIds: activePlayers().map((p) => p.pid || '')
      }).catch(() => {});
    }

    renderHud();
    scheduleSync(true);
  }

  function normalizeStandings(resultsObj){
    const rows = Object.keys(resultsObj || {}).map((key) => {
      const r = resultsObj[key] || {};
      const p =
        (G.players && G.players[key]) ||
        Object.values(G.players || {}).find((pl) =>
          String(pl.uid || '') === String(key) ||
          String(pl.pid || '') === String(r.pid || key)
        ) ||
        {};

      const pr =
        (G.progress && G.progress[key]) ||
        (p.uid && G.progress && G.progress[p.uid]) ||
        Object.values(G.progress || {}).find((row) =>
          String(row.pid || '') === String(r.pid || p.pid || key)
        ) ||
        {};

      const pid = clean(r.pid || p.pid || key, 80) || 'player';
      const nick = clean(r.nick || r.name || p.name || p.nick || pid, 80) || 'player';

      return {
        pid,
        nick,
        rank: 0,
        score: num(r.score, num(pr.score, 0)),
        miss: num(r.miss, num(pr.miss, 0)),
        goodHit: num(r.goodHit, 0),
        junkHit: num(r.junkHit, 0),
        bestStreak: num(r.bestStreak, num(pr.bestStreak, 0)),
        duration: num(r.duration, ctx.time),
        contribution: num(r.contribution, num(r.score, num(pr.score, 0)))
      };
    });

    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.miss !== b.miss) return a.miss - b.miss;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return String(a.pid).localeCompare(String(b.pid));
    });

    rows.forEach((r, i) => {
      r.rank = i + 1;
    });

    return rows;
  }

  function buildFinalSummaryFromResults(reason){
    const standings = normalizeStandings(G.results || {});
    let me = standings.find((r) => String(r.pid) === String(ctx.pid)) || null;
    let partner = standings.find((r) => String(r.pid) !== String(ctx.pid)) || null;

    if (!me && G.localSummary) {
      me = {
        pid: ctx.pid,
        nick: ctx.name,
        rank: 0,
        score: num(G.localSummary.score, 0),
        miss: num(G.localSummary.miss, 0),
        goodHit: num(G.localSummary.goodHit, 0),
        junkHit: num(G.localSummary.junkHit, 0),
        bestStreak: num(G.localSummary.bestStreak, 0),
        duration: num(G.localSummary.duration, 0),
        contribution: num(G.localSummary.score, 0)
      };
    }

    const myScore = num(me && me.score, 0);
    const partnerScore = num(partner && partner.score, 0);
    const teamScore = myScore + partnerScore;
    const goal = currentGoal();

    return {
      controllerFinal: standings.length >= 2,
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'duet',
      roomId: ctx.roomId,
      roomKind: G.roomKind || ctx.roomKind || '',
      pid: ctx.pid,
      uid: G.uid || ctx.uid || '',
      name: ctx.name,
      role: ctx.role,
      rank: me ? me.rank : 0,
      score: myScore,
      players: standings.length || 1,
      miss: num(me && me.miss, 0),
      goodHit: num(me && me.goodHit, 0),
      junkHit: num(me && me.junkHit, 0),
      bestStreak: num(me && me.bestStreak, 0),
      duration: num(me && me.duration, ctx.time),
      reason: clean(reason || 'finished', 80),
      result: teamScore >= goal ? 'pair-goal-met' : 'pair-finished',
      teamScore: teamScore,
      contribution: myScore,
      standings: standings,
      compare: {
        me: me,
        partner: partner,
        delta: myScore - partnerScore
      },
      raw: {
        goal,
        partnerScore,
        endedAt: now()
      }
    };
  }

  async function submitOwnResult(summary){
    if (!G.refs || !summary) return;

    G.localSummary = summary;

    await G.refs.results.child(ctx.pid).set({
      pid: ctx.pid,
      nick: ctx.name,
      score: num(summary.score, 0),
      miss: num(summary.miss, 0),
      goodHit: num(summary.goodHit, 0),
      junkHit: num(summary.junkHit, 0),
      bestStreak: num(summary.bestStreak, 0),
      duration: num(summary.duration, 0),
      reason: clean(summary.reason || 'finished', 80),
      submittedAt: now(),
      updatedAt: now()
    });

    await G.refs.players.child(ctx.pid).update({
      phase: 'summary',
      finished: true,
      finalScore: num(summary.score, 0),
      score: num(summary.score, 0),
      miss: num(summary.miss, 0),
      streak: num(summary.bestStreak, 0),
      updatedAt: now(),
      lastSeen: now()
    }).catch(() => {});

    G.resultSubmitted = true;
  }

  function maybeClearFallbackTimer(){
    if (G.fallbackTimer) {
      clearTimeout(G.fallbackTimer);
      G.fallbackTimer = 0;
    }
  }

  function scheduleFallbackSummary(){
    maybeClearFallbackTimer();
    if (!G.localSummary || G.finalSummarySent) return;

    G.fallbackTimer = setTimeout(() => {
      if (G.finalSummarySent) return;

      const summary = buildFinalSummaryFromResults('fallback-local');
      G.finalSummarySent = true;
      showResultSummary(summary);

      if (!hasDuetBridge()) {
        if (RT) {
          RT.summary(summary).catch(() => {});
        } else {
          emit('gj:summary', summary);
          emit('hha:summary', summary);
          emit('hha:session-summary', summary);
        }
      }
    }, 6500);
  }

  function buildLocalSummary(reason){
    return {
      controllerFinal: false,
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'duet',
      roomId: ctx.roomId,
      roomKind: G.roomKind || ctx.roomKind || '',
      pid: ctx.pid,
      uid: G.uid || ctx.uid || '',
      name: ctx.name,
      role: ctx.role,
      rank: 0,
      score: Math.max(0, Math.round(G.score)),
      players: 1,
      miss: G.miss,
      goodHit: G.goodHit,
      junkHit: G.junkHit,
      bestStreak: G.bestStreak,
      duration: ctx.time,
      reason: clean(reason || 'timeup', 80),
      result: 'finished',
      teamScore: Math.max(0, Math.round(G.score)),
      contribution: Math.max(0, Math.round(G.score)),
      standings: [],
      compare: null,
      raw: {
        goodMiss: G.goodMiss,
        goal: currentGoal(),
        endedAt: now()
      }
    };
  }

  function showResultSummary(summary){
    if (!UI.resultMount || G.summaryShown) return;
    G.summaryShown = true;

    const me = summary.compare && summary.compare.me ? summary.compare.me : null;
    const partner = summary.compare && summary.compare.partner ? summary.compare.partner : null;
    const goal = num(summary.raw && summary.raw.goal, currentGoal());
    const metGoal = num(summary.teamScore, 0) >= goal;

    const title = metGoal
      ? 'เยี่ยมเลย! ทีมของคุณถึงเป้าหมายแล้ว'
      : 'จบรอบแล้ว มาดูคะแนนรวมของทีมกัน';
    const sub = partner
      ? `คะแนนเรา ${num(me && me.score, 0)} • คะแนนเพื่อน ${num(partner && partner.score, 0)} • รวมทีม ${num(summary.teamScore, 0)}`
      : 'ส่งผลของคุณแล้ว ระบบกำลังสรุปคะแนนจากทั้งคู่';

    UI.resultMount.hidden = false;
    UI.resultMount.innerHTML = `
      <div class="gjd-result-shell">
        <div class="gjd-result-top">
          <div class="gjd-kicker">DUET SUMMARY</div>
          <div class="gjd-title">${escapeHtml(title)}</div>
          <div class="gjd-sub">${escapeHtml(sub)}</div>
        </div>

        <div class="gjd-teamcard">
          <div class="gjd-teamlabel">คะแนนรวมของทีม / เป้าหมาย</div>
          <div class="gjd-teamscore">${num(summary.teamScore, 0)} / ${goal}</div>
        </div>

        <div class="gjd-grid">
          <div class="gjd-box">
            <div class="gjd-box-label">เรา</div>
            <div class="gjd-box-name">${escapeHtml((me && me.nick) || ctx.name || 'เรา')}</div>
            <div class="gjd-box-score">${num((me && me.score) || summary.score, 0)}</div>
          </div>

          <div class="gjd-box">
            <div class="gjd-box-label">ส่วนต่างคะแนน</div>
            <div class="gjd-box-name">${partner ? (num(summary.compare && summary.compare.delta, 0) > 0 ? 'เรานำอยู่' : num(summary.compare && summary.compare.delta, 0) < 0 ? 'เพื่อนนำอยู่' : 'คะแนนเท่ากัน') : 'รอเพื่อนส่งผล'}</div>
            <div class="gjd-box-score">${partner ? Math.abs(num(summary.compare && summary.compare.delta, 0)) : '-'}</div>
          </div>

          <div class="gjd-box">
            <div class="gjd-box-label">เพื่อน</div>
            <div class="gjd-box-name">${escapeHtml((partner && partner.nick) || 'ยังไม่พบผลของเพื่อน')}</div>
            <div class="gjd-box-score">${partner ? num(partner.score, 0) : '-'}</div>
          </div>
        </div>

        <div class="gjd-statgrid">
          <div class="gjd-stat">
            <div class="gjd-stat-k">Good hit</div>
            <div class="gjd-stat-v">${num(summary.goodHit, 0)}</div>
          </div>
          <div class="gjd-stat">
            <div class="gjd-stat-k">Junk hit</div>
            <div class="gjd-stat-v">${num(summary.junkHit, 0)}</div>
          </div>
          <div class="gjd-stat">
            <div class="gjd-stat-k">Miss</div>
            <div class="gjd-stat-v">${num(summary.miss, 0)}</div>
          </div>
          <div class="gjd-stat">
            <div class="gjd-stat-k">Best Streak</div>
            <div class="gjd-stat-v">${num(summary.bestStreak, 0)}</div>
          </div>
        </div>

        <div class="gjd-standings">
          ${
            Array.isArray(summary.standings) && summary.standings.length
              ? summary.standings.map((r, i) => `
                <div class="gjd-row">
                  <div class="gjd-row-left">
                    <div class="gjd-row-name">#${i + 1} ${escapeHtml(r.nick || r.pid || 'player')}</div>
                    <div class="gjd-row-mini">Score ${num(r.score, 0)} • Miss ${num(r.miss, 0)} • Streak ${num(r.bestStreak, 0)}</div>
                  </div>
                  <div class="gjd-row-mini">${String(r.pid || '') === String(ctx.pid || '') ? 'YOU' : 'PARTNER'}</div>
                </div>
              `).join('')
              : `
                <div class="gjd-row">
                  <div class="gjd-row-left">
                    <div class="gjd-row-name">กำลังรอผลอีกฝั่ง</div>
                    <div class="gjd-row-mini">ถ้าอีกเครื่องส่งผลช้ากว่า ระบบจะแสดง fallback summary ชั่วคราว</div>
                  </div>
                  <div class="gjd-row-mini">WAIT</div>
                </div>
              `
          }
        </div>

        <div class="gjd-debug">teamScore=${num(summary.teamScore, 0)}
goal=${goal}
controllerFinal=${summary.controllerFinal ? 'true' : 'false'}
roomId=${escapeHtml(ctx.roomId)}
roomKind=${escapeHtml(G.roomKind || ctx.roomKind || '-')}
reason=${escapeHtml(summary.reason || '-')}</div>

        <div class="gjd-actions">
          <a class="btn ghost" href="./goodjunk-duet-lobby.html?roomId=${encodeURIComponent(ctx.roomId || '')}&room=${encodeURIComponent(ctx.roomId || '')}&roomKind=${encodeURIComponent(G.roomKind || ctx.roomKind || '')}&autojoin=1&hub=${encodeURIComponent(ctx.hub || '../hub.html')}">← กลับ Lobby</a>
          <a class="btn primary" href="${escapeHtml(ctx.hub || '../hub.html')}">🏠 กลับ Hub</a>
          <button class="btn good" id="duetRematchBtn" type="button">🔁 เล่นอีกครั้ง</button>
        </div>
      </div>
    `;

    const rematchBtn = byId('duetRematchBtn');
    if (rematchBtn) {
      rematchBtn.addEventListener('click', () => {
        const url = new URL('./goodjunk-duet-lobby.html', location.href);
        const src = new URL(location.href);

        src.searchParams.forEach((value, key) => {
          if (key === 'autostart') return;
          url.searchParams.set(key, value);
        });

        if (ctx.roomId) {
          url.searchParams.set('roomId', ctx.roomId);
          url.searchParams.set('room', ctx.roomId);
        }
        if (G.roomKind || ctx.roomKind) {
          url.searchParams.set('roomKind', G.roomKind || ctx.roomKind);
        }
        url.searchParams.set('autojoin', '1');
        url.searchParams.set('rematch', '1');

        location.href = url.toString();
      });
    }
  }

  async function finalizeSummary(reason){
    if (G.finished) return;

    G.finished = true;
    G.started = false;
    caf(G.loopId);
    clearTargets();

    const summary = buildLocalSummary(reason || 'finished');
    G.localSummary = summary;

    if (hasDuetBridge()) {
      try {
        if (typeof W.HHA_DUET_FINISH === 'function') {
          await W.HHA_DUET_FINISH({
            score: Math.max(0, Math.round(G.score)),
            miss: G.miss,
            best_streak: G.bestStreak,
            accuracy: 0,
            contribution: Math.max(0, Math.round(G.score)),
            progress: 1,
            stars: 0,
            medal: '',
            outcome: 'clear',
            finished: true,
            correct: G.goodHit,
            wrong: G.junkHit,
            goodHit: G.goodHit,
            junkHit: G.junkHit,
            team_score: teamLiveScore()
          });
        } else if (W.HHA_DUET_BRIDGE && typeof W.HHA_DUET_BRIDGE.finish === 'function') {
          await W.HHA_DUET_BRIDGE.finish({
            score: Math.max(0, Math.round(G.score)),
            miss: G.miss,
            best_streak: G.bestStreak,
            accuracy: 0,
            contribution: Math.max(0, Math.round(G.score)),
            progress: 1,
            stars: 0,
            medal: '',
            outcome: 'clear',
            finished: true,
            correct: G.goodHit,
            wrong: G.junkHit,
            goodHit: G.goodHit,
            junkHit: G.junkHit,
            team_score: teamLiveScore()
          });
        }
        G.resultSubmitted = true;
      } catch (err) {
        console.error('[gj-duet] bridge finish failed', err);
      }

      if (UI.resultMount) UI.resultMount.hidden = true;
      scheduleFallbackSummary();
      return;
    }

    await submitOwnResult(summary).catch((err) => {
      console.error('[gj-duet] submitOwnResult failed', err);
    });

    scheduleFallbackSummary();
  }

  async function maybePromoteCountdown(){
    if (String(ctx.host || '0') !== '1') return;
    if (!G.refs || !G.refs.state) return;
    if (String((G.state && G.state.status) || '') !== 'countdown') return;

    const countdownEndsAt = num((G.state && (G.state.startAt || G.state.countdownEndsAt)) || 0, 0);
    if (!countdownEndsAt || now() < countdownEndsAt) return;

    try {
      await G.refs.state.transaction((cur) => {
        cur = cur || {};
        if (String(cur.status || '') !== 'countdown') return cur;

        const plannedSec = clamp(cur.plannedSec || ctx.time, 30, 300);
        const startedAt = now();

        cur.status = 'playing';
        cur.startedAt = startedAt;
        cur.endsAt = startedAt + plannedSec * 1000;
        cur.countdownEndsAt = 0;
        cur.updatedAt = startedAt;
        return cur;
      });
    } catch (err) {
      console.warn('[gj-duet] maybePromoteCountdown failed', err);
    }
  }

  async function maybeEndRoom(){
    if (String(ctx.host || '0') !== '1') return;
    if (!G.refs || !G.refs.state) return;
    if (String((G.state && G.state.status) || '') !== 'playing') return;

    const endsAt = num((G.state && G.state.endsAt) || 0, 0);
    const actives = activePlayers();
    const finishedCount = actives.filter((p) => !!p.finished).length;
    const everyoneFinished = actives.length >= 2 && finishedCount >= 2;
    const timeUp = endsAt > 0 && now() >= endsAt;

    if (!everyoneFinished && !timeUp) return;

    try {
      await G.refs.state.transaction((cur) => {
        cur = cur || {};
        if (String(cur.status || '') !== 'playing') return cur;
        cur.status = 'ended';
        cur.endedAt = now();
        cur.updatedAt = now();
        return cur;
      });
    } catch (err) {
      console.warn('[gj-duet] maybeEndRoom failed', err);
    }
  }

  function bindResultsWatcher(){
    if (!G.refs || !G.refs.results) return;

    G.refs.results.on('value', async (snap) => {
      G.results = snap.val() || {};
      const count = Object.keys(G.results || {}).length;

      if (count >= 2 && !G.finalSummarySent) {
        maybeClearFallbackTimer();
        const summary = buildFinalSummaryFromResults('pair-finished');
        G.finalSummarySent = true;
        showResultSummary(summary);

        if (!hasDuetBridge()) {
          if (RT) {
            await RT.summary(summary).catch(() => {});
          } else {
            emit('gj:summary', summary);
            emit('hha:summary', summary);
            emit('hha:session-summary', summary);
          }
        }
      }
    });
  }

  function bindEngineRoomWatchers(){
    if (!W.HHA_ROOM || !ctx.roomId) return;

    if (typeof G.engineUnwatch === 'function') {
      try { G.engineUnwatch(); } catch (_) {}
    }

    G.engineUnwatch = W.HHA_ROOM.watchRoom({
      game: 'goodjunk',
      mode: 'duet',
      roomId: ctx.roomId,
      onValue: async (room) => {
        room = room || {};

        const meta = room.meta || {};
        const players = room.players || {};
        const results = room.results || {};
        const progress = room.progress || {};

        G.meta = meta;
        G.players = players;
        G.results = results;
        G.progress = progress;

        G.state = {
          status: String(meta.state || 'waiting'),
          plannedSec: num(meta.timeSec, ctx.time),
          seed: String(meta.seed || ctx.seed),
          roundId: '',
          participantIds: Object.values(players).map((p) => p.pid || '').filter(Boolean),
          countdownEndsAt: num(meta.countdownAt, 0),
          startAt: num(meta.countdownAt, 0),
          startedAt: num(meta.startedAt, 0),
          endsAt: num(meta.startedAt, 0) ? (num(meta.startedAt, 0) + num(meta.timeSec, ctx.time) * 1000) : 0,
          updatedAt: num(meta.updatedAt, 0)
        };

        if (num(meta.countdownAt, 0) > 0) {
          ctx.startAt = num(meta.countdownAt, 0);
        }

        updateCountdownUi();
        renderHud();

        const status = String(G.state.status || '');

        if (status === 'running' && !G.started) {
          beginPlayNow();
        } else if ((status === 'ended' || status === 'aborted') && !G.finished) {
          await finalizeSummary(status === 'aborted' ? 'room-aborted' : 'room-ended');
        }

        const resultCount = Object.keys(G.results || {}).length;
        if (resultCount >= 2 && !G.finalSummarySent) {
          maybeClearFallbackTimer();
          const summary = buildFinalSummaryFromResults('pair-finished');
          G.finalSummarySent = true;
          showResultSummary(summary);
        }
      }
    });
  }

  function bindRoomWatchers(){
    if (hasDuetBridge()) {
      bindEngineRoomWatchers();
      return;
    }

    if (!G.refs) return;

    G.refs.meta.on('value', (snap) => {
      G.meta = snap.val() || {};
      renderHud();
    });

    G.refs.state.on('value', async (snap) => {
      G.state = snap.val() || {};
      updateCountdownUi();

      const status = String((G.state && G.state.status) || '');
      if (status === 'countdown') {
        await maybePromoteCountdown();
      } else if (status === 'playing') {
        if (!G.started) beginPlayNow();
      } else if ((status === 'ended' || status === 'finished') && !G.finished) {
        await finalizeSummary('room-ended');
      }
    });

    G.refs.players.on('value', async (snap) => {
      G.players = snap.val() || {};
      renderHud();
      await maybeEndRoom();
    });

    bindResultsWatcher();
  }

  async function ensureFirebaseReady(){
    if (!(W.firebase && W.firebase.apps && W.firebase.database && W.firebase.auth)) {
      await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
      await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js');
      await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js');
    }

    if (!W.HHA_FIREBASE_CONFIG && !W.firebaseConfig && !W.__firebaseConfig && !W.FIREBASE_CONFIG) {
      try { await loadScript('../firebase-config.js'); } catch (_) {}
    }

    const cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.firebaseConfig ||
      W.__firebaseConfig ||
      W.FIREBASE_CONFIG ||
      null;

    if (!cfg) throw new Error('missing firebase config');

    if (!W.firebase.apps || !W.firebase.apps.length) {
      W.firebase.initializeApp(cfg);
    }

    G.db = W.firebase.database();
    G.auth = W.firebase.auth();

    if (G.auth.currentUser && G.auth.currentUser.uid) {
      G.uid = cleanPid(G.auth.currentUser.uid);
      return true;
    }

    await G.auth.signInAnonymously();

    await new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('firebase auth timeout'));
      }, FIREBASE_WAIT_MS);

      const off = G.auth.onAuthStateChanged((user) => {
        if (done) return;
        if (user && user.uid) {
          done = true;
          clearTimeout(timer);
          try { off(); } catch (_) {}
          G.uid = cleanPid(user.uid);
          resolve(true);
        }
      }, (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { off(); } catch (_) {}
        reject(err || new Error('firebase auth failed'));
      });
    });

    return true;
  }

  async function detectRoomKind(){
    const preferred = clean(ctx.roomKind, 40);
    const order = preferred ? [preferred, 'duetRooms', 'rooms'] : ['duetRooms', 'rooms'];
    const seen = {};

    for (let i = 0; i < order.length; i++) {
      const kind = order[i];
      if (!kind || seen[kind]) continue;
      seen[kind] = true;

      try {
        const snap = await G.db.ref(`hha-battle/goodjunk/${kind}/${ctx.roomId}`).child('meta').once('value');
        if (snap.exists()) {
          G.roomKind = kind;
          return kind;
        }
      } catch (_) {}
    }

    G.roomKind = preferred || 'rooms';
    return G.roomKind;
  }

  function buildRefs(){
    const root = G.db.ref(`hha-battle/goodjunk/${G.roomKind}/${ctx.roomId}`);
    G.refs = {
      root,
      meta: root.child('meta'),
      state: root.child('state'),
      match: root.child('match'),
      players: root.child('players'),
      results: root.child('results')
    };
  }

  async function ensureSelfPlayer(){
    if (!G.refs || !G.refs.players) return;

    await G.refs.players.child(ctx.pid).update({
      pid: ctx.pid,
      nick: ctx.name,
      connected: true,
      ready: true,
      phase: 'run',
      score: num(G.score, 0),
      miss: num(G.miss, 0),
      streak: num(G.bestStreak, 0),
      bestStreak: num(G.bestStreak, 0),
      updatedAt: now(),
      lastSeen: now()
    }).catch(() => {});

    try {
      G.refs.players.child(ctx.pid).onDisconnect().update({
        connected: false,
        updatedAt: W.firebase.database.ServerValue.TIMESTAMP,
        lastSeen: W.firebase.database.ServerValue.TIMESTAMP
      });
    } catch (_) {}
  }

  function startHeartbeat(){
    clearInterval(G.heartbeatId);
    G.heartbeatId = setInterval(() => {
      if (!G.refs || !G.refs.players) return;

      G.refs.players.child(ctx.pid).update({
        pid: ctx.pid,
        nick: ctx.name,
        connected: true,
        ready: true,
        phase: G.finished ? 'summary' : (G.started ? 'run' : 'lobby'),
        score: num(G.score, 0),
        miss: num(G.miss, 0),
        streak: num(G.bestStreak, 0),
        bestStreak: num(G.bestStreak, 0),
        updatedAt: now(),
        lastSeen: now()
      }).catch(() => {});

      maybePromoteCountdown();
      maybeEndRoom();
    }, HEARTBEAT_MS);
  }

  function loop(frameTs){
    updateCountdownUi();

    if (!G.started && !G.finished) {
      const startAt = effectiveStartAt();
      if (startAt > now()) {
        renderHud();
        G.loopId = raf(loop);
        return;
      }

      beginPlayNow();
    }

    if (G.finished) {
      renderHud();
      return;
    }

    const ts = Number(frameTs || performance.now());
    if (!G.lastFrameTs) G.lastFrameTs = ts;
    const dt = Math.min(40, ts - G.lastFrameTs) / 1000;
    G.lastFrameTs = ts;

    const tNow = now();

    if (tNow - G.lastSpawnAt >= G.cfg.spawnEvery) {
      G.lastSpawnAt = tNow;
      spawnTarget();
    }

    const bounds = playBounds();

    for (let i = G.targets.length - 1; i >= 0; i--){
      const t = G.targets[i];
      if (!t || t.dead) {
        G.targets.splice(i, 1);
        continue;
      }

      t.y += t.speed * dt;
      t.x += Math.sin((tNow - t.bornAt) / 240) * t.sway * dt;
      t.x = Math.max(bounds.left, Math.min(bounds.right - t.size, t.x));

      t.el.style.left = `${t.x.toFixed(1)}px`;
      t.el.style.top = `${t.y.toFixed(1)}px`;

      const expired = (tNow - t.bornAt > t.ttl) || (t.y > bounds.bottom + 8);
      if (expired) {
        G.targets.splice(i, 1);
        expireTarget(t);
      }
    }

    if (G.roundEndAt && tNow >= G.roundEndAt) {
      finalizeSummary('timeup');
      return;
    }

    renderHud();
    G.loopId = raf(loop);
  }

  function tryCenterShoot(){
    if (!UI.stage || !G.targets.length || !G.started || G.finished) return;

    const bounds = playBounds();
    const cx = bounds.w * 0.5;
    const cy = bounds.h * 0.48;

    let best = null;
    let bestDist = Infinity;

    for (let i = 0; i < G.targets.length; i++){
      const t = G.targets[i];
      if (!t || t.dead) continue;
      const tx = t.x + t.size * 0.5;
      const ty = t.y + t.size * 0.5;
      const dx = tx - cx;
      const dy = ty - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }

    if (best && bestDist <= 120) {
      hitTarget(best);
    }
  }

  function bindEvents(){
    W.addEventListener('hha:shoot', () => {
      tryCenterShoot();
    });

    W.addEventListener('keydown', (ev) => {
      if ((ev.code === 'Space' || ev.key === ' ') && !ev.repeat) {
        ev.preventDefault();
        tryCenterShoot();
      }
    });

    W.addEventListener('beforeunload', () => {
      maybeClearFallbackTimer();
      clearInterval(G.heartbeatId);
      clearTimeout(G.syncTimer);
      caf(G.loopId);
      if (typeof G.engineUnwatch === 'function') {
        try { G.engineUnwatch(); } catch (_) {}
      }
    });
  }

  async function boot(){
    if (!UI.stage) throw new Error('#duetGameStage not found');

    installStyles();
    await ensureRuntimeContract();
    initRuntime();

    G.cfg = DIFF[ctx.diff] || DIFF.normal;
    G.rng = mulberry32(xmur3(`${ctx.seed}|${ctx.roomId}|${ctx.pid}|${ctx.startAt}|duet`)());

    const bridgeReady = await waitForDuetBridge(4000);

    if (bridgeReady) {
      const bctx = W.HHA_DUET_BRIDGE && W.HHA_DUET_BRIDGE.ctx ? W.HHA_DUET_BRIDGE.ctx : null;

      if (bctx) {
        G.uid = cleanPid(bctx.uid || ctx.uid || ctx.pid);
        ctx.uid = G.uid;
        ctx.pid = cleanPid(bctx.pid || ctx.pid);
        ctx.name = clean(bctx.display_name || bctx.name || ctx.name, 80);
        ctx.roomId = cleanRoom(bctx.room_id || ctx.roomId);
        ctx.startAt = num(bctx.start_at || ctx.startAt, 0);
        ctx.diff = clean(bctx.diff || ctx.diff, 24).toLowerCase();
        ctx.time = clamp(bctx.time_sec || ctx.time, 30, 300);
        ctx.seed = clean(bctx.seed || ctx.seed, 80);
        ctx.view = clean(bctx.view || ctx.view, 24);
        ctx.hub = clean(bctx.hub || ctx.hub, 400);
        ctx.role = clean(bctx.role || ctx.role, 24);
      }

      bindRoomWatchers();
      bindEvents();
      renderHud();
      G.loopId = raf(loop);

      if (RT) {
        await RT.flush().catch(() => {});
        await RT.engineReady({}).catch(() => {});
      }

      return;
    }

    await ensureFirebaseReady();

    if (RT) {
      await RT.flush().catch(() => {});
      await RT.engineReady({}).catch(() => {});
    }

    await detectRoomKind();
    buildRefs();
    await ensureSelfPlayer();
    bindRoomWatchers();
    startHeartbeat();
    bindEvents();

    renderHud();
    G.loopId = raf(loop);
  }

  boot().catch((err) => {
    console.error('[gj-duet] boot failed', err);

    if (UI.countdownOverlay) {
      UI.countdownOverlay.classList.add('show');
    }
    if (UI.countdownNum) {
      UI.countdownNum.textContent = '!';
    }
    if (UI.countdownText) {
      UI.countdownText.textContent = String(err && err.message ? err.message : err);
    }
  });

  W.__GJ_DUET_RUN__ = {
    ctx,
    state: G,
    finalizeSummary,
    tryCenterShoot
  };
})();