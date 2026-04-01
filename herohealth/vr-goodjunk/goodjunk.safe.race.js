'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.race.js
 * GoodJunk Race Core Game
 * FULL PATCH v20260401-race-core-final
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_RACE_CORE_INSTALLED__) return;
  W.__GJ_RACE_CORE_INSTALLED__ = true;

  const ctx = W.__GJ_RUN_CTX__ || W.__GJ_MULTI_RUN_CTX__ || {};
  const mount = D.getElementById('gameMount') || D.body;

  const GOOD_ITEMS = [
    { emoji:'🍎', name:'Apple' },
    { emoji:'🍌', name:'Banana' },
    { emoji:'🥕', name:'Carrot' },
    { emoji:'🥦', name:'Broccoli' },
    { emoji:'🍉', name:'Watermelon' },
    { emoji:'🐟', name:'Fish' },
    { emoji:'🥛', name:'Milk' },
    { emoji:'🥗', name:'Salad' }
  ];

  const JUNK_ITEMS = [
    { emoji:'🍔', name:'Burger' },
    { emoji:'🍟', name:'Fries' },
    { emoji:'🍕', name:'Pizza' },
    { emoji:'🍩', name:'Donut' },
    { emoji:'🍫', name:'Chocolate' },
    { emoji:'🍭', name:'Candy' },
    { emoji:'🥤', name:'Soda' },
    { emoji:'🧁', name:'Cupcake' }
  ];

  const CFG = {
    easy: {
      spawnMs: 960,
      lifeMs: 2300,
      goodChance: 0.78,
      sizeMin: 66,
      sizeMax: 96,
      fallMin: 70,
      fallMax: 105,
      goodScore: 12,
      junkPenalty: 8
    },
    normal: {
      spawnMs: 760,
      lifeMs: 1950,
      goodChance: 0.72,
      sizeMin: 60,
      sizeMax: 88,
      fallMin: 88,
      fallMax: 128,
      goodScore: 12,
      junkPenalty: 10
    },
    hard: {
      spawnMs: 580,
      lifeMs: 1650,
      goodChance: 0.66,
      sizeMin: 56,
      sizeMax: 80,
      fallMin: 105,
      fallMax: 150,
      goodScore: 14,
      junkPenalty: 12
    }
  };

  const diffKey = String(ctx.diff || 'normal');
  const conf = CFG[diffKey] || CFG.normal;
  const totalSec = Math.max(30, Number(ctx.time || 90));

  function hashSeed(str){
    let h = 2166136261 >>> 0;
    const s = String(str || '0');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(hashSeed(`${ctx.seed || Date.now()}|${ctx.roomId || ''}|${ctx.pid || ''}|race`));
  const rand = () => rng();
  const rint = (a,b) => Math.floor(a + rand() * (b - a + 1));
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

  const state = {
    ready: false,
    started: false,
    paused: true,
    ended: false,

    score: 0,
    shots: 0,
    hits: 0,
    miss: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,
    streak: 0,
    bestStreak: 0,

    startAtMs: Number(ctx.startAt || 0) || 0,
    runStartedAt: 0,
    deadlineMs: 0,

    raf: 0,
    spawnTimer: 0,
    hudTimer: 0,
    lastFrameAt: 0,

    seq: 0,
    targets: [],
    mounted: false,

    debugLines: []
  };

  const ui = {};

  function debugPush(line){
    state.debugLines.push(String(line));
    if (state.debugLines.length > 24) state.debugLines.shift();
  }

  function safeDispatch(name, detail){
    try {
      W.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function emitSummary(reason){
    const duration = Math.max(0, Math.round((Date.now() - state.runStartedAt) / 1000));
    const summary = {
      mode: 'race',
      roomId: ctx.roomId || '',
      pid: ctx.pid || '',
      name: ctx.name || ctx.nick || '',
      diff: diffKey,
      duration,
      reason: String(reason || 'finish'),
      score: state.score,
      shots: state.shots,
      hits: state.hits,
      miss: state.miss,
      goodHit: state.goodHit,
      junkHit: state.junkHit,
      goodMiss: state.goodMiss,
      bestStreak: state.bestStreak,
      result: 'จบรอบแล้ว',
      players: 2
    };

    safeDispatch('gj:race-summary', summary);
    safeDispatch('gj:summary', summary);
    safeDispatch('hha:summary', summary);
    return summary;
  }

  function createStyleOnce(){
    if (D.getElementById('gj-race-core-style')) return;
    const style = D.createElement('style');
    style.id = 'gj-race-core-style';
    style.textContent = `
      .gjr-root{
        position:absolute; inset:0; overflow:hidden;
        user-select:none; -webkit-user-select:none;
      }
      .gjr-stage{
        position:absolute; inset:0;
        overflow:hidden;
        background:
          radial-gradient(circle at 16% 12%, rgba(255,255,255,.88), transparent 18%),
          radial-gradient(circle at 84% 12%, rgba(255,255,255,.78), transparent 16%),
          linear-gradient(180deg,#b9ebff 0%, #dff7ff 54%, #fff4cc 100%);
      }
      .gjr-cloud{
        position:absolute; background:#fff; border-radius:999px;
        box-shadow:0 8px 18px rgba(0,0,0,.06); opacity:.85; pointer-events:none;
      }
      .gjr-cloud.c1{ width:128px;height:42px;left:4%;top:8%; }
      .gjr-cloud.c2{ width:96px;height:34px;left:76%;top:12%; }
      .gjr-cloud.c3{ width:110px;height:36px;left:38%;top:18%; }
      .gjr-ground{
        position:absolute; left:0; right:0; bottom:0; height:118px;
        background:
          radial-gradient(circle at 20% 40%, rgba(126,217,87,.34), transparent 18%),
          radial-gradient(circle at 72% 44%, rgba(126,217,87,.28), transparent 18%),
          linear-gradient(180deg,#b3f28f,#88d96b);
        border-top:1px solid rgba(88,195,63,.26);
        pointer-events:none;
      }
      .gjr-lane{
        position:absolute; left:0; right:0; bottom:102px; height:2px;
        background:linear-gradient(90deg, transparent, rgba(255,255,255,.34), transparent);
        pointer-events:none;
      }
      .gjr-target{
        position:absolute;
        display:grid; place-items:center;
        border-radius:22px;
        border:2px solid #fff;
        box-shadow:0 10px 22px rgba(0,0,0,.14);
        cursor:pointer;
        user-select:none;
        touch-action:manipulation;
        transform:translateZ(0);
      }
      .gjr-target.good{
        background:linear-gradient(180deg,#ffffff,#f1fff1);
      }
      .gjr-target.junk{
        background:linear-gradient(180deg,#fff3f3,#ffe2e2);
      }
      .gjr-target .emoji{
        font-size:clamp(24px, 4vw, 38px);
        line-height:1;
        pointer-events:none;
      }
      .gjr-fx{
        position:absolute;
        font-size:18px; font-weight:1100;
        text-shadow:0 2px 0 rgba(255,255,255,.95);
        pointer-events:none;
        animation: gjr-fx-rise .65s ease-out forwards;
      }
      .gjr-fx.good{ color:#1a7f37; }
      .gjr-fx.bad{ color:#c2410c; }
      @keyframes gjr-fx-rise{
        0%{ transform:translateY(0) scale(.94); opacity:0; }
        20%{ opacity:1; }
        100%{ transform:translateY(-34px) scale(1.04); opacity:0; }
      }
      .gjr-center-note{
        position:absolute; inset:0;
        display:none; align-items:center; justify-content:center;
        background:rgba(255,255,255,.28);
        backdrop-filter:blur(6px);
        z-index:8;
      }
      .gjr-center-note.show{ display:flex; }
      .gjr-center-card{
        width:min(420px, calc(100% - 24px));
        border-radius:24px;
        border:1px solid rgba(191,227,242,.95);
        background:#fffdf8f0;
        box-shadow:0 18px 50px rgba(0,0,0,.14);
        padding:18px;
        text-align:center;
      }
      .gjr-center-kicker{
        display:inline-flex; min-height:34px; align-items:center; justify-content:center;
        padding:6px 14px; border-radius:999px; background:#fff2f8; border:1px solid #ffd6ea;
        color:#a33268; font-weight:1100; font-size:12px;
      }
      .gjr-center-num{
        margin-top:10px; font-size:70px; line-height:1; font-weight:1100; color:#7a2558;
        text-shadow:0 4px 0 #fff;
      }
      .gjr-center-sub{
        margin-top:10px; color:#6b7280; font-size:14px; line-height:1.6; font-weight:1000;
      }
    `;
    D.head.appendChild(style);
  }

  function buildDom(){
    if (state.mounted) return;
    createStyleOnce();

    const root = D.createElement('div');
    root.className = 'gjr-root';

    const stage = D.createElement('div');
    stage.className = 'gjr-stage';

    const c1 = D.createElement('div'); c1.className = 'gjr-cloud c1';
    const c2 = D.createElement('div'); c2.className = 'gjr-cloud c2';
    const c3 = D.createElement('div'); c3.className = 'gjr-cloud c3';
    const lane = D.createElement('div'); lane.className = 'gjr-lane';
    const ground = D.createElement('div'); ground.className = 'gjr-ground';

    const note = D.createElement('div');
    note.className = 'gjr-center-note';
    note.innerHTML = `
      <div class="gjr-center-card">
        <div class="gjr-center-kicker">RACE READY</div>
        <div class="gjr-center-num" id="gjrCenterNum">3</div>
        <div class="gjr-center-sub" id="gjrCenterSub">เตรียมตัวเก็บอาหารดีให้ไวที่สุด</div>
      </div>
    `;

    stage.appendChild(c1);
    stage.appendChild(c2);
    stage.appendChild(c3);
    stage.appendChild(lane);
    stage.appendChild(ground);
    stage.appendChild(note);

    root.appendChild(stage);
    mount.innerHTML = '';
    mount.appendChild(root);

    ui.root = root;
    ui.stage = stage;
    ui.note = note;
    ui.noteNum = note.querySelector('#gjrCenterNum');
    ui.noteSub = note.querySelector('#gjrCenterSub');

    state.mounted = true;
    debugPush('dom mounted');
  }

  function stageRect(){
    const r = ui.stage.getBoundingClientRect();
    return {
      w: Math.max(280, Math.floor(r.width)),
      h: Math.max(520, Math.floor(r.height))
    };
  }

  function setCenter(show, numText, subText){
    if (!ui.note) return;
    ui.note.classList.toggle('show', !!show);
    if (ui.noteNum) ui.noteNum.textContent = String(numText || '');
    if (ui.noteSub) ui.noteSub.textContent = String(subText || '');
  }

  function showFx(x, y, text, kind){
    const fx = D.createElement('div');
    fx.className = `gjr-fx ${kind || 'good'}`;
    fx.textContent = text;
    fx.style.left = `${x}px`;
    fx.style.top = `${y}px`;
    ui.stage.appendChild(fx);
    setTimeout(() => { try { fx.remove(); } catch(_) {} }, 760);
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try { t.el.remove(); } catch(_) {}
  }

  function updateHudBridge(){
    try {
      if (W.GJRaceSafe && typeof W.GJRaceSafe.setScore === 'function') {
        W.GJRaceSafe.setScore(state.score);
      }
      if (W.GJRaceSafe && typeof W.GJRaceSafe.updateHud === 'function') {
        W.GJRaceSafe.updateHud({
          score: state.score,
          miss: state.miss,
          bestStreak: state.bestStreak,
          goodHit: state.goodHit,
          junkHit: state.junkHit,
          goodMiss: state.goodMiss,
          remainSec: Math.max(0, Math.ceil((state.deadlineMs - Date.now()) / 1000))
        });
      }
    } catch(_) {}
  }

  function setPaused(v){
    state.paused = !!v;
    debugPush(`paused=${state.paused}`);
  }

  function hitTarget(t){
    if (!t || t.dead || state.ended || state.paused || !state.started) return;

    removeTarget(t);
    state.targets = state.targets.filter(x => x !== t);
    state.shots += 1;

    if (t.good) {
      state.score += conf.goodScore;
      state.hits += 1;
      state.goodHit += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      showFx(t.x + 8, t.y, `+${conf.goodScore}`, 'good');
    } else {
      state.score = Math.max(0, state.score - conf.junkPenalty);
      state.junkHit += 1;
      state.miss += 1;
      state.streak = 0;
      showFx(t.x + 8, t.y, `-${conf.junkPenalty}`, 'bad');
    }

    updateHudBridge();
  }

  function missGood(t){
    if (!t || t.dead) return;
    removeTarget(t);
    state.targets = state.targets.filter(x => x !== t);

    if (t.good) {
      state.goodMiss += 1;
      state.miss += 1;
      state.streak = 0;
      showFx(t.x + 8, t.y, 'MISS', 'bad');
      updateHudBridge();
    }
  }

  function spawnTarget(){
    if (state.ended || state.paused || !state.started) return;
    if (!ui.stage) return;

    const rect = stageRect();
    const good = rand() < conf.goodChance;
    const source = good
      ? GOOD_ITEMS[rint(0, GOOD_ITEMS.length - 1)]
      : JUNK_ITEMS[rint(0, JUNK_ITEMS.length - 1)];

    const size = rint(conf.sizeMin, conf.sizeMax);
    const pad = 12;
    const x = rint(pad, Math.max(pad, rect.w - size - pad));
    const y = rint(18, Math.max(20, rect.h - 220 - size));
    const drift = (rand() * 2 - 1) * 22;
    const speed = rint(conf.fallMin, conf.fallMax);
    const dieAt = Date.now() + conf.lifeMs + rint(-180, 160);

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `gjr-target ${good ? 'good' : 'junk'}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = `<div class="emoji">${source.emoji}</div>`;

    const t = {
      id: ++state.seq,
      good,
      item: source,
      el,
      x,
      y,
      drift,
      speed,
      bornAt: Date.now(),
      dieAt,
      dead: false
    };

    const onTap = (ev) => {
      ev.preventDefault();
      hitTarget(t);
    };
    el.addEventListener('click', onTap, { passive:false });
    el.addEventListener('touchstart', onTap, { passive:false });

    ui.stage.appendChild(el);
    state.targets.push(t);
  }

  function loop(nowTs){
    if (state.ended) return;
    state.raf = requestAnimationFrame(loop);

    if (!state.started || state.paused) return;

    if (!state.lastFrameAt) state.lastFrameAt = nowTs;
    const dt = Math.min(0.05, (nowTs - state.lastFrameAt) / 1000);
    state.lastFrameAt = nowTs;

    const rect = stageRect();

    state.targets.slice().forEach((t) => {
      if (t.dead) return;

      t.x += t.drift * dt;
      t.y += t.speed * dt;

      if (t.x < 6) {
        t.x = 6;
        t.drift *= -1;
      }
      if (t.x > rect.w - t.el.offsetWidth - 6) {
        t.x = rect.w - t.el.offsetWidth - 6;
        t.drift *= -1;
      }

      t.el.style.left = `${t.x}px`;
      t.el.style.top = `${t.y}px`;

      if (Date.now() >= t.dieAt || t.y > rect.h - 96) {
        missGood(t);
      }
    });

    if (Date.now() >= state.deadlineMs) {
      endGame('timeup');
    }
  }

  function startGame(){
    if (state.started || state.ended) return;
    state.started = true;
    state.paused = false;
    state.runStartedAt = Date.now();
    state.deadlineMs = state.runStartedAt + totalSec * 1000;
    state.lastFrameAt = 0;

    setCenter(false, '', '');
    clearInterval(state.spawnTimer);
    state.spawnTimer = setInterval(spawnTarget, conf.spawnMs);
    debugPush('game started');

    updateHudBridge();
  }

  function endGame(reason){
    if (state.ended) return;
    state.ended = true;
    state.paused = true;

    cancelAnimationFrame(state.raf);
    clearInterval(state.spawnTimer);
    clearInterval(state.hudTimer);
    state.raf = 0;
    state.spawnTimer = 0;
    state.hudTimer = 0;

    state.targets.forEach(removeTarget);
    state.targets = [];
    debugPush(`game ended: ${reason}`);

    emitSummary(reason || 'finish');
  }

  function countdownAndStart(){
    const targetAt = Number(ctx.startAt || 0) > 0 ? Number(ctx.startAt) : (Date.now() + 1200);

    setCenter(true, '3', 'เตรียมตัวเก็บอาหารดีให้ไวที่สุด');

    const tick = () => {
      const remainMs = targetAt - Date.now();
      const sec = Math.max(0, Math.ceil(remainMs / 1000));
      if (ui.noteNum) ui.noteNum.textContent = sec > 0 ? String(sec) : 'GO!';
      if (ui.noteSub) ui.noteSub.textContent = sec > 0
        ? 'เตรียมตัวเก็บอาหารดีให้ไวที่สุด'
        : 'เริ่มแข่งได้เลย!';
      if (remainMs <= 0) {
        clearInterval(timer);
        startGame();
      }
    };

    tick();
    const timer = setInterval(tick, 100);
  }

  function boot(){
    buildDom();
    W.__GJ_RACE_ENGINE_READY__ = true;

    W.__GJ_SET_PAUSED__ = function(v){
      setPaused(v);
    };
    W.__GJ_START_NOW__ = function(){
      debugPush('__GJ_START_NOW__ called');
      countdownAndStart();
    };
    W.__GJ_GET_SCORE__ = function(){ return state.score; };
    W.__GJ_GET_SHOTS__ = function(){ return state.shots; };
    W.__GJ_GET_HITS__ = function(){ return state.hits; };
    W.__GJ_GET_MISS__ = function(){ return state.miss; };
    W.__GJ_GET_HITS_GOOD__ = function(){ return state.goodHit; };
    W.__GJ_GET_HITS_JUNK__ = function(){ return state.junkHit; };
    W.__GJ_GET_GOOD_MISS__ = function(){ return state.goodMiss; };
    W.__GJ_GET_BEST_STREAK__ = function(){ return state.bestStreak; };
    W.__GJ_GET_FINISH_MS__ = function(){
      if (!state.runStartedAt) return 0;
      return (state.ended ? Date.now() : Math.min(Date.now(), state.deadlineMs)) - state.runStartedAt;
    };
    W.__GJ_BOOT__ = function(){
      if (!state.started && !state.ended) countdownAndStart();
    };

    if (typeof W.GJRaceShellReady === 'function') {
      try { W.GJRaceShellReady({ ok:true, core:'goodjunk.safe.race.js' }); } catch(_) {}
    }

    state.hudTimer = setInterval(updateHudBridge, 250);
    state.raf = requestAnimationFrame(loop);

    if (!ctx.wait && !ctx.startAt) {
      countdownAndStart();
    } else if (ctx.startAt) {
      setCenter(true, '3', 'กำลังรอเริ่มพร้อมกัน');
    } else {
      setCenter(true, '…', 'กำลังรอสัญญาณเริ่มจากห้อง');
    }

    debugPush('boot ok');
  }

  W.addEventListener('pagehide', () => {
    if (!state.ended && state.started) endGame('pagehide');
  });

  safeDispatch('gj:core-installed', { mode:'race', file:'goodjunk.safe.race.js' });
  boot();
})();