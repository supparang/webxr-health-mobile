'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.race.js
 * GoodJunk Race Core
 * FULL PATCH v20260404-race-core-runtime-full
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_RACE_CORE_LOADED__) return;
  W.__GJ_RACE_CORE_LOADED__ = true;

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

  function byIds(){
    for (let i = 0; i < arguments.length; i++){
      const el = D.getElementById(arguments[i]);
      if (el) return el;
    }
    return null;
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

  function raf(fn){
    return (W.requestAnimationFrame || function(cb){ return setTimeout(() => cb(performance.now()), 16); })(fn);
  }

  function caf(id){
    return (W.cancelAnimationFrame || clearTimeout)(id);
  }

  const ctx = {
    game: 'goodjunk',
    zone: 'nutrition',
    mode: 'race',
    pid: clean(qs('pid', 'anon'), 80),
    uid: clean(qs('uid', ''), 80),
    name: clean(qs('name', qs('nick', 'Player')), 80),
    roomId: clean(qs('roomId', qs('room', '')), 40),
    roomKind: clean(qs('roomKind', ''), 40),
    role: clean(qs('role', 'player'), 24),
    diff: clean(qs('diff', 'normal'), 24).toLowerCase(),
    time: clamp(qs('time', '90'), 30, 300),
    seed: clean(qs('seed', String(now())), 80),
    startAt: num(qs('startAt', '0'), 0),
    hub: clean(qs('hub', '../hub.html'), 400),
    view: clean(qs('view', 'mobile'), 24),
    host: clean(qs('host', '0'), 8),
    run: clean(qs('run', 'play'), 24)
  };

  const DIFF = {
    easy:   { spawnEvery: 820, maxTargets: 5, ttl: 2800, speed: 120, goodRatio: 0.80 },
    normal: { spawnEvery: 670, maxTargets: 6, ttl: 2350, speed: 150, goodRatio: 0.73 },
    hard:   { spawnEvery: 540, maxTargets: 7, ttl: 2000, speed: 185, goodRatio: 0.66 }
  };

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

  const UI = {
    stageWrap: null,
    stage: null,
    score: null,
    time: null,
    miss: null,
    streak: null,
    goodHit: null,
    junkHit: null,
    goodMiss: null,
    roomPill: null,
    tip: null,
    goalValue: null,
    goalFill: null,
    goalSubFill: null,
    countdownOverlay: null,
    countdownNum: null,
    countdownText: null
  };

  const G = {
    booted: false,
    started: false,
    finished: false,
    countdownDone: false,
    cfg: DIFF.normal,
    rng: null,

    loopId: 0,
    lastFrameTs: 0,
    lastSpawnAt: 0,

    seq: 0,
    targets: [],

    score: 0,
    miss: 0,
    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,
    streak: 0,
    bestStreak: 0,

    roundStartAt: 0,
    roundEndAt: 0,
    summarySent: false
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
      mode: 'race',
      getCtx: () => ({
        roomId: ctx.roomId || '',
        roomKind: ctx.roomKind || '',
        pid: ctx.pid || '',
        uid: ctx.uid || '',
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

  function installStyles(){
    if (D.getElementById('gjRaceCoreStyles')) return;

    const style = D.createElement('style');
    style.id = 'gjRaceCoreStyles';
    style.textContent = `
      #gjRaceField{
        position:absolute;
        inset:0;
        overflow:hidden;
      }
      .gjr-target{
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
      .gjr-target.good{ background:linear-gradient(180deg,#ffffff,#f1fff1); }
      .gjr-target.junk{ background:linear-gradient(180deg,#fff3f3,#ffe1e1); }
      .gjr-target .emoji{
        font-size:clamp(24px,4vw,38px);
        line-height:1;
      }
      .gjr-fx{
        position:absolute;
        pointer-events:none;
        z-index:40;
        font-size:20px;
        line-height:1;
        font-weight:1000;
        text-shadow:0 1px 0 #fff;
        animation:gjr-float .48s ease-out forwards;
      }
      .gjr-fx.good{ color:#15803d; }
      .gjr-fx.bad{ color:#b91c1c; }
      @keyframes gjr-float{
        0%{ opacity:0; transform:translateY(8px) scale(.9); }
        15%{ opacity:1; }
        100%{ opacity:0; transform:translateY(-28px) scale(1.04); }
      }
      @media (max-width:640px){
        .gjr-target{
          min-width:48px;
          min-height:48px;
          border-radius:16px;
        }
        .gjr-target .emoji{
          font-size:clamp(22px,7vw,30px);
        }
      }
    `;
    D.head.appendChild(style);
  }

  function ensureStage(){
    installStyles();

    UI.stageWrap = byIds('raceGameStage', 'gameStage', 'gameMount', 'playField');
    if (!UI.stageWrap) throw new Error('race stage not found');

    let field = byIds('gjRaceField');
    if (!field){
      field = D.createElement('div');
      field.id = 'gjRaceField';
      UI.stageWrap.appendChild(field);
    }
    UI.stage = field;

    UI.score = byIds('raceScoreValue', 'goodjunkScoreValue', 'gameScoreValue');
    UI.time = byIds('raceTimeValue', 'goodjunkTimeValue', 'gameTimeValue');
    UI.miss = byIds('raceMissValue', 'goodjunkMissValue', 'gameMissValue');
    UI.streak = byIds('raceStreakValue', 'goodjunkStreakValue', 'gameStreakValue');
    UI.goodHit = byIds('raceGoodHitValue', 'goodHitValue');
    UI.junkHit = byIds('raceJunkHitValue', 'junkHitValue');
    UI.goodMiss = byIds('raceGoodMissValue', 'goodMissValue');
    UI.roomPill = byIds('raceRoomPill', 'goodjunkRoomPill');
    UI.tip = byIds('raceTipText', 'goodjunkTipText');
    UI.goalValue = byIds('racePairGoalValue', 'raceGoalValue', 'goalValue');
    UI.goalFill = byIds('racePairGoalFill', 'raceGoalFill', 'goalFill');
    UI.goalSubFill = byIds('racePairGoalSubFill', 'raceGoalSubFill', 'goalSubFill');
    UI.countdownOverlay = byIds('raceCountdownOverlay', 'goodjunkCountdownOverlay');
    UI.countdownNum = byIds('raceCountdownNum', 'goodjunkCountdownNum');
    UI.countdownText = byIds('raceCountdownText', 'goodjunkCountdownText');

    if (UI.roomPill) UI.roomPill.textContent = ctx.roomId ? `ห้อง ${ctx.roomId}` : 'โหมด Race';
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

  function timeLeftSec(){
    if (!G.started) {
      if (ctx.startAt > now()) return Math.max(0, Math.ceil((ctx.startAt - now()) / 1000));
      return ctx.time;
    }
    return Math.max(0, Math.ceil((G.roundEndAt - now()) / 1000));
  }

  function currentGoal(){
    const base = Math.max(180, ctx.time * 4);
    if (ctx.diff === 'easy') return Math.round(base * 0.85);
    if (ctx.diff === 'hard') return Math.round(base * 1.15);
    return Math.round(base);
  }

  function renderHud(){
    if (UI.score) UI.score.textContent = String(Math.max(0, Math.round(G.score)));
    if (UI.time) UI.time.textContent = formatClock(timeLeftSec());
    if (UI.miss) UI.miss.textContent = String(G.miss);
    if (UI.streak) UI.streak.textContent = String(G.bestStreak);
    if (UI.goodHit) UI.goodHit.textContent = String(G.goodHit);
    if (UI.junkHit) UI.junkHit.textContent = String(G.junkHit);
    if (UI.goodMiss) UI.goodMiss.textContent = String(G.goodMiss);

    const goal = currentGoal();
    const pct = Math.max(0, Math.min(100, (G.score / Math.max(1, goal)) * 100));
    const pct2 = Math.max(0, Math.min(100, ((G.goodHit * 10) / Math.max(1, goal)) * 100));

    if (UI.goalValue) UI.goalValue.textContent = String(goal);
    if (UI.goalFill) UI.goalFill.style.width = pct.toFixed(1) + '%';
    if (UI.goalSubFill) UI.goalSubFill.style.width = pct2.toFixed(1) + '%';

    if (UI.tip) {
      if (!G.started) {
        UI.tip.textContent = ctx.startAt > now()
          ? 'กำลังรอเริ่มพร้อมกัน'
          : 'แตะอาหารดีให้ไวที่สุด';
      } else if (G.streak >= 8) {
        UI.tip.textContent = 'สุดยอด! คุณกำลังเร่งสปีดได้ดีมาก';
      } else if (G.miss >= 6) {
        UI.tip.textContent = 'ระวังอาหารดีหลุดออกจอมากเกินไป';
      } else {
        UI.tip.textContent = 'แตะอาหารดี หลีกเลี่ยง junk และเร่งคะแนนให้สูงสุด';
      }
    }

    emit('gj:race-live', {
      score: G.score,
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
      mode: 'race',
      score: G.score
    });
  }

  function formatClock(sec){
    sec = Math.max(0, Math.ceil(num(sec, 0)));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function flash(x, y, text, kind){
    if (!UI.stage) return;
    const el = D.createElement('div');
    el.className = `gjr-fx ${kind || ''}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    UI.stage.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch {}
    }, 520);
  }

  function removeTarget(t){
    if (!t || t.dead) return;
    t.dead = true;
    try { t.el.remove(); } catch {}
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
    el.className = `gjr-target ${kind}`;
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

  function hitTarget(t){
    if (!t || t.dead || !G.started || G.finished) return;

    removeTarget(t);

    if (t.kind === 'good'){
      G.streak += 1;
      G.bestStreak = Math.max(G.bestStreak, G.streak);
      G.goodHit += 1;

      const bonus = Math.min(12, Math.floor(G.streak / 3) * 2);
      G.score += 10 + bonus;

      flash(t.x, t.y, `+${10 + bonus}`, 'good');
    } else {
      G.junkHit += 1;
      G.miss += 1;
      G.streak = 0;
      G.score = Math.max(0, G.score - 8);

      flash(t.x, t.y, '-8', 'bad');
    }

    renderHud();

    if (RT) {
      RT.scoreUpdated({
        score: G.score,
        miss: G.miss,
        goodHit: G.goodHit,
        junkHit: G.junkHit,
        bestStreak: G.bestStreak
      }).catch(() => {});
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

      if (RT) {
        RT.scoreUpdated({
          score: G.score,
          miss: G.miss,
          goodHit: G.goodHit,
          junkHit: G.junkHit,
          goodMiss: G.goodMiss,
          bestStreak: G.bestStreak
        }).catch(() => {});
      }
    }
  }

  function updateCountdownUi(){
    if (!UI.countdownOverlay) return;

    const left = Math.max(0, Math.ceil((ctx.startAt - now()) / 1000));

    if (!G.countdownDone && ctx.startAt > now()){
      UI.countdownOverlay.classList.add('show');
      if (UI.countdownNum) UI.countdownNum.textContent = String(left || 0);
      if (UI.countdownText) UI.countdownText.textContent = 'เตรียมตัวแข่ง Race พร้อมกัน';
    } else {
      UI.countdownOverlay.classList.remove('show');
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
        startAt: G.roundStartAt,
        endAt: G.roundEndAt
      }).catch(() => {});
    }

    renderHud();
  }

  function finalizeSummary(reason){
    if (G.summarySent) return;
    G.summarySent = true;
    G.finished = true;
    G.started = false;

    caf(G.loopId);
    clearTargets();

    const summary = {
      controllerFinal: false,
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'race',
      roomId: ctx.roomId,
      roomKind: ctx.roomKind,
      pid: ctx.pid,
      uid: ctx.uid,
      name: ctx.name,
      role: ctx.role,
      result: 'finished',
      rank: 0,
      score: Math.max(0, Math.round(G.score)),
      players: 1,
      miss: G.miss,
      goodHit: G.goodHit,
      junkHit: G.junkHit,
      bestStreak: G.bestStreak,
      duration: ctx.time,
      reason: clean(reason || 'timeup', 80),
      standings: [],
      compare: null,
      raw: {
        goodMiss: G.goodMiss,
        endedAt: now(),
        goal: currentGoal()
      }
    };

    try {
      localStorage.setItem('GJ_RACE_LAST_SUMMARY', JSON.stringify(summary));
    } catch (_) {}

    if (RT) {
      RT.summary(summary).catch(() => {});
    } else {
      emit('gj:summary', summary);
      emit('hha:summary', summary);
      emit('hha:session-summary', summary);
    }
  }

  function clearTargets(){
    G.targets.forEach(removeTarget);
    G.targets = [];
  }

  function loop(frameTs){
    updateCountdownUi();

    if (!G.started && !G.finished){
      if (ctx.startAt > 0 && now() < ctx.startAt){
        renderHud();
        G.loopId = raf(loop);
        return;
      }

      G.countdownDone = true;
      beginPlayNow();
    }

    if (G.finished){
      renderHud();
      return;
    }

    const ts = Number(frameTs || performance.now());
    if (!G.lastFrameTs) G.lastFrameTs = ts;
    const dt = Math.min(40, ts - G.lastFrameTs) / 1000;
    G.lastFrameTs = ts;

    const tNow = now();

    if (tNow - G.lastSpawnAt >= G.cfg.spawnEvery){
      G.lastSpawnAt = tNow;
      spawnTarget();
    }

    const bounds = playBounds();

    for (let i = G.targets.length - 1; i >= 0; i--){
      const t = G.targets[i];
      if (!t || t.dead){
        G.targets.splice(i, 1);
        continue;
      }

      t.y += t.speed * dt;
      t.x += Math.sin((tNow - t.bornAt) / 240) * t.sway * dt;
      t.x = Math.max(bounds.left, Math.min(bounds.right - t.size, t.x));

      t.el.style.left = `${t.x.toFixed(1)}px`;
      t.el.style.top = `${t.y.toFixed(1)}px`;

      const expired = (tNow - t.bornAt > t.ttl) || (t.y > bounds.bottom + 8);
      if (expired){
        G.targets.splice(i, 1);
        expireTarget(t);
      }
    }

    if (tNow >= G.roundEndAt){
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
      if (dist < bestDist){
        bestDist = dist;
        best = t;
      }
    }

    if (best && bestDist <= 120){
      hitTarget(best);
    }
  }

  function bindEvents(){
    W.addEventListener('hha:shoot', function(){
      tryCenterShoot();
    });

    W.addEventListener('keydown', function(ev){
      if ((ev.code === 'Space' || ev.key === ' ') && !ev.repeat){
        ev.preventDefault();
        tryCenterShoot();
      }
    });

    D.addEventListener('visibilitychange', function(){
      if (D.hidden && G.started && !G.finished){
        renderHud();
      }
    });

    W.addEventListener('beforeunload', function(){
      caf(G.loopId);
    });
  }

  async function boot(){
    ensureStage();
    initRuntime();

    G.cfg = DIFF[ctx.diff] || DIFF.normal;
    G.rng = mulberry32(xmur3(`${ctx.seed}|${ctx.roomId}|${ctx.pid}|${ctx.startAt}`)());

    bindEvents();
    renderHud();

    if (RT) {
      await RT.engineReady({}).catch(() => {});
    }

    G.booted = true;
    G.loopId = raf(loop);
  }

  boot().catch(function(err){
    console.error('[gj-race-core] boot failed', err);
    try {
      ensureStage();
      if (UI.tip) UI.tip.textContent = 'เข้าเกมไม่สำเร็จ';
      if (UI.countdownText) UI.countdownText.textContent = String(err && err.message ? err.message : err);
      if (UI.countdownOverlay) UI.countdownOverlay.classList.add('show');
    } catch (_) {}
  });

  W.__GJ_RACE_CORE__ = {
    ctx,
    state: G,
    finalizeSummary,
    tryCenterShoot
  };
})();