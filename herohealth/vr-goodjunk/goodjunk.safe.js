// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR Core — PRODUCTION (deterministic + cVR shoot + end summary event)
// FULL v20260224b-goodjunk-safe-core
// ✅ export boot({ view, run, diff, time, seed, studyId, phase, conditionGroup })
// ✅ deterministic RNG by seed
// ✅ MISS definition: good expired + junk hit; shield blocks junk hit => NOT miss
// ✅ DOM targets (#gj-layer) + optional cVR shoot via event "hha:shoot"
// ✅ updates HUD ids used by goodjunk-vr.html
// ✅ dispatch window event "hha:game-ended" with summary (for run.html to route next)

'use strict';

export function boot(cfg){
  const DOC = document;
  const WIN = window;

  const $ = (id)=>DOC.getElementById(id);

  const layer = $('gj-layer');
  const layerR = $('gj-layer-r'); // optional right-eye layer (unused by default)
  if(!layer) throw new Error('Missing #gj-layer');

  // HUD refs
  const hudScore = $('hud-score');
  const hudTime  = $('hud-time');
  const hudMiss  = $('hud-miss');
  const hudGrade = $('hud-grade');

  const hudGoal = $('hud-goal');
  const hudGoalCur = $('hud-goal-cur');
  const hudGoalTarget = $('hud-goal-target');
  const goalDesc = $('goalDesc');

  const feverFill = $('feverFill');
  const feverText = $('feverText');
  const shieldPills = $('shieldPills');

  const bossBar = $('bossBar');
  const bossFill = $('bossFill');
  const bossHint = $('bossHint');

  const progressFill = $('gjProgressFill');

  const lowTimeOverlay = $('lowTimeOverlay');
  const lowNum = $('gj-lowtime-num');

  const endOverlay = $('endOverlay');
  const endTitle = $('endTitle');
  const endSub = $('endSub');
  const endGrade = $('endGrade');
  const endScore = $('endScore');
  const endMiss = $('endMiss');
  const endTime = $('endTime');

  // Config
  const C = normalizeCfg(cfg);

  // Deterministic RNG
  const rng = makeRng(C.seedStr);

  // State
  const S = {
    t0: performance.now(),
    t: 0,
    timeLeft: C.timeSec,
    running: true,

    score: 0,
    miss: 0,
    hitsGood: 0,
    hitsJunk: 0,
    goodExpired: 0,
    streak: 0,

    fever: 0,          // 0..100
    shield: 0,         // pills count
    bossOn: false,
    bossHp: 0,         // 0..100

    goalKey: 'HIT_GOOD',
    goalTarget: C.goalTarget,
    goalCur: 0,

    targets: new Map(), // id -> { el, x, y, good, born, ttl, dying }
    nextId: 1,
    spawnAcc: 0,

    lastShotTs: 0
  };

  // Expose tiny debug state
  WIN.__GJ_STATE__ = S;

  // Init HUD
  setText(hudGoal, 'GOAL');
  setText(goalDesc, C.run === 'research' ? 'Research (deterministic)' : 'Play (randomish)');
  setText(hudGoalTarget, String(S.goalTarget));
  setText(hudGoalCur, String(S.goalCur));
  setShieldHUD();
  setBossHUD();
  setFeverHUD();
  setHUD();

  // Input: click/tap on target
  layer.addEventListener('pointerdown', onPointerDown, { passive:true });

  // Input: cVR shoot (from vr-ui.js) — hit nearest target to center
  WIN.addEventListener('hha:shoot', onShoot);

  // Main loop
  let raf = requestAnimationFrame(tick);

  function tick(ts){
    if(!S.running) return;

    const dt = Math.min(0.05, (ts - (S._lastTs || ts)) / 1000);
    S._lastTs = ts;

    S.t += dt;
    S.timeLeft = Math.max(0, C.timeSec - S.t);

    // progress
    if(progressFill){
      const p = clamp01(S.t / Math.max(1, C.timeSec));
      progressFill.style.width = `${Math.round(p*1000)/10}%`;
    }

    // low time overlay
    const lt = Math.ceil(S.timeLeft);
    if(lowTimeOverlay && lowNum){
      if(lt <= 5 && lt >= 1){
        lowTimeOverlay.setAttribute('aria-hidden','false');
        lowNum.textContent = String(lt);
      }else{
        lowTimeOverlay.setAttribute('aria-hidden','true');
      }
    }

    // spawn
    S.spawnAcc += dt;
    const spawnEvery = S.bossOn ? C.spawnEveryBoss : C.spawnEvery;
    while(S.spawnAcc >= spawnEvery){
      S.spawnAcc -= spawnEvery;
      spawnOne();
    }

    // update targets (expire)
    updateTargets(dt);

    // boss logic
    updateBoss(dt);

    // HUD time
    setHUD();

    if(S.timeLeft <= 0){
      endGame('TIME UP');
      return;
    }

    raf = requestAnimationFrame(tick);
  }

  function spawnOne(){
    // keep cap
    if(S.targets.size >= C.maxTargets) return;

    const r = layer.getBoundingClientRect();
    const W = Math.max(1, r.width);
    const H = Math.max(1, r.height);

    // safe spawn region (avoid HUD top)
    const pad = 36;
    const topSafe = 150;
    const x = pad + rng()*Math.max(1, W - pad*2);
    const y = topSafe + rng()*Math.max(1, H - topSafe - pad);

    const good = (rng() < C.pGood); // good target ratio
    const emo = good ? pickOne(C.goodEmo, rng) : pickOne(C.junkEmo, rng);

    const el = DOC.createElement('div');
    el.className = 'gj-target';
    el.textContent = emo;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
    el.dataset.kind = good ? 'good' : 'junk';

    // vary size a bit
    const s = good ? (0.92 + rng()*0.24) : (0.90 + rng()*0.28);
    el.style.fontSize = `${Math.round(46 * s)}px`;

    // attach
    layer.appendChild(el);

    const id = S.nextId++;
    const ttl = good ? C.ttlGood : C.ttlJunk;
    S.targets.set(id, { id, el, x, y, good, born: S.t, ttl, dying:false });
    el.dataset.id = String(id);
  }

  function updateTargets(){
    // expire logic
    for(const [id, t] of S.targets){
      if(t.dying) continue;
      const age = S.t - t.born;
      if(age >= t.ttl){
        // expire
        t.dying = true;
        // good expired => MISS (per spec)
        if(t.good){
          S.goodExpired++;
          S.miss++;
          S.streak = 0;
        }
        killTarget(t, 'expire');
      }else{
        // subtle fade near end
        const remain = t.ttl - age;
        if(remain < 0.6){
          const a = clamp01(remain / 0.6);
          t.el.style.opacity = String(0.35 + a*0.65);
          t.el.style.transform = `translate(-50%,-50%) scale(${0.92 + a*0.08})`;
        }
      }
    }
  }

  function onPointerDown(e){
    // only count if they tapped a target
    const el = e.target && e.target.closest ? e.target.closest('.gj-target') : null;
    if(!el) return;
    const id = Number(el.dataset.id || 0);
    const t = S.targets.get(id);
    if(!t || t.dying) return;

    hitTarget(t, { mode:'tap', x: e.clientX, y: e.clientY });
  }

  function onShoot(ev){
    // cVR: we hit nearest target to screen center
    // rate-limit a bit
    const now = performance.now();
    if(now - S.lastShotTs < 60) return;
    S.lastShotTs = now;

    const r = layer.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;

    let best = null;
    let bestD = Infinity;

    for(const [, t] of S.targets){
      if(t.dying) continue;
      const bx = r.left + t.x;
      const by = r.top + t.y;
      const d = (bx-cx)*(bx-cx) + (by-cy)*(by-cy);
      if(d < bestD){
        bestD = d;
        best = t;
      }
    }

    if(best && bestD <= C.shootLockPx*C.shootLockPx){
      hitTarget(best, { mode:'shoot', x: cx, y: cy, detail: ev?.detail || null });
    }
  }

  function hitTarget(t, meta){
    if(!S.running || t.dying) return;

    t.dying = true;

    if(t.good){
      S.score += C.scoreGood;
      S.hitsGood++;
      S.goalCur++;
      S.streak++;

      addFever(C.feverGood + Math.min(2, S.streak*0.1));
      maybeGiveShield();

      // boss damage if active
      if(S.bossOn){
        S.bossHp = Math.max(0, S.bossHp - C.bossDmgPerGood);
      }
    }else{
      // junk touched => if shield active, consume shield but NOT miss
      if(S.shield > 0){
        S.shield = Math.max(0, S.shield - 1);
        S.score += C.scoreBlockJunk;
        // do not count miss
      }else{
        S.hitsJunk++;
        S.miss++;
        S.streak = 0;
        S.score = Math.max(0, S.score - C.penaltyJunk);
        addFever(-C.feverJunkHit);
      }
    }

    // remove
    killTarget(t, meta?.mode || 'hit');

    // goal completed?
    if(S.goalCur >= S.goalTarget){
      // bonus
      S.score += C.goalBonus;
      // new goal
      S.goalCur = 0;
      S.goalTarget = nextGoalTarget();
      setText(hudGoalTarget, String(S.goalTarget));
    }

    setShieldHUD();
    setFeverHUD();
    setBossHUD();
    setHUD();
  }

  function killTarget(t, why){
    try{
      t.el.style.transition = 'transform 140ms ease, opacity 140ms ease';
      t.el.style.opacity = '0';
      t.el.style.transform = 'translate(-50%,-50%) scale(0.70)';
    }catch(_){}

    const id = t.id;
    setTimeout(()=>{
      const cur = S.targets.get(id);
      // remove only if same el
      if(cur && cur.el === t.el){
        S.targets.delete(id);
      }
      try{ t.el.remove(); }catch(_){}
    }, 160);
  }

  function addFever(v){
    S.fever = clamp(S.fever + v, 0, 100);
  }

  function maybeGiveShield(){
    // simple deterministic-ish: streak milestones
    if(S.streak > 0 && (S.streak % C.shieldEveryStreak) === 0){
      S.shield = Math.min(C.shieldMax, S.shield + 1);
    }
  }

  function updateBoss(){
    // boss appears when fever high enough
    if(!S.bossOn && S.fever >= C.bossFeverOn){
      S.bossOn = true;
      S.bossHp = 100;
      setText(bossHint, 'แตะ GOOD รัว ๆ เพื่อล้มบอส!');
    }
    if(S.bossOn){
      // slight decay to keep pressure
      S.bossHp = Math.max(0, S.bossHp - C.bossHpDecayPerSec*(1/60));
      if(S.bossHp <= 0){
        // boss defeated -> big bonus + calm fever
        S.score += C.bossBonus;
        S.bossOn = false;
        S.bossHp = 0;
        addFever(-C.bossFeverDrop);
        setText(bossHint, 'ชนะบอส! +BONUS');
      }
    }
  }

  function nextGoalTarget(){
    // deterministic step
    const base = C.goalTargetBase;
    const span = C.goalTargetSpan;
    return base + Math.floor(rng() * (span+1));
  }

  function setHUD(){
    if(hudScore) setText(hudScore, String(S.score));
    if(hudMiss)  setText(hudMiss,  String(S.miss));
    if(hudTime)  setText(hudTime,  String(Math.ceil(S.timeLeft)));

    if(hudGoalCur) setText(hudGoalCur, String(S.goalCur));

    const g = gradeOf(S.score, S.miss, C.timeSec);
    if(hudGrade) setText(hudGrade, g);
  }

  function setFeverHUD(){
    if(feverFill) feverFill.style.width = `${Math.round(S.fever)}%`;
    if(feverText) setText(feverText, `${Math.round(S.fever)}%`);
  }

  function setShieldHUD(){
    if(!shieldPills) return;
    if(S.shield <= 0) { setText(shieldPills, '—'); return; }
    setText(shieldPills, '🛡️'.repeat(Math.min(5, S.shield)) + (S.shield>5 ? `+${S.shield-5}` : ''));
  }

  function setBossHUD(){
    if(!bossBar || !bossFill) return;
    if(!S.bossOn){
      bossBar.setAttribute('aria-hidden','true');
      bossFill.style.width = '0%';
      return;
    }
    bossBar.setAttribute('aria-hidden','false');
    bossFill.style.width = `${Math.round(S.bossHp)}%`;
  }

  function endGame(reason){
    S.running = false;
    try{ cancelAnimationFrame(raf); }catch(_){}
    raf = 0;

    // clear remaining targets (visual)
    for(const [, t] of S.targets){
      try{ t.el.remove(); }catch(_){}
    }
    S.targets.clear();

    const g = gradeOf(S.score, S.miss, C.timeSec);

    const summary = {
      game: 'goodjunk',
      run: C.run,
      diff: C.diff,
      time: C.timeSec,
      seed: C.seedStr,
      score: S.score,
      miss: S.miss,
      grade: g,
      hitsGood: S.hitsGood,
      hitsJunk: S.hitsJunk,
      goodExpired: S.goodExpired,
      fever: Math.round(S.fever),
      shieldLeft: S.shield,
      goalTarget: S.goalTarget,
      goalDone: S.goalCur,
      bossDefeated: C.bossBonus ? (S.bossOn ? 0 : 1) : 0,
      reason: String(reason || 'end')
    };

    // populate end overlay
    try{
      if(endTitle) setText(endTitle, 'GoodJunk — Completed');
      if(endSub) setText(endSub, `seed=${C.seedStr} • run=${C.run} • diff=${C.diff}`);
      if(endGrade) setText(endGrade, g);
      if(endScore) setText(endScore, String(S.score));
      if(endMiss)  setText(endMiss,  String(S.miss));
      if(endTime)  setText(endTime,  String(C.timeSec));
      if(endOverlay) endOverlay.setAttribute('aria-hidden','false');
    }catch(_){}

    // dispatch summary event for run.html
    try{
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary }));
    }catch(_){}
  }

  // if tab hidden, end cleanly (prevents stuck sessions)
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && S.running){
      endGame('hidden');
    }
  }, { passive:true });

  // -------- utilities --------

  function normalizeCfg(cfg0){
    const c = Object.assign({
      view: 'mobile',
      run: 'play',
      diff: 'normal',
      time: 80,
      seed: null,
      studyId: null,
      phase: null,
      conditionGroup: null
    }, cfg0 || {});

    const timeSec = clamp(Number(c.time || 80), 20, 300);

    const seedStr =
      (c.seed != null && String(c.seed).trim() !== '')
        ? String(c.seed).trim()
        : String(Date.now());

    // difficulty tuning
    const diff = String(c.diff || 'normal').toLowerCase();
    const D = {
      easy:   { spawnEvery:0.78, ttlGood:1.7, ttlJunk:1.85, pGood:0.70, maxTargets:9 },
      normal: { spawnEvery:0.68, ttlGood:1.55, ttlJunk:1.70, pGood:0.66, maxTargets:10 },
      hard:   { spawnEvery:0.58, ttlGood:1.40, ttlJunk:1.55, pGood:0.62, maxTargets:11 },
    }[diff] || { spawnEvery:0.68, ttlGood:1.55, ttlJunk:1.70, pGood:0.66, maxTargets:10 };

    return {
      view: String(c.view || 'mobile'),
      run:  String(c.run || 'play'),
      diff,
      timeSec,
      seedStr,
      studyId: (c.studyId != null ? String(c.studyId) : ''),
      phase: (c.phase != null ? String(c.phase) : ''),
      conditionGroup: (c.conditionGroup != null ? String(c.conditionGroup) : ''),

      // tuning
      spawnEvery: D.spawnEvery,
      spawnEveryBoss: Math.max(0.42, D.spawnEvery * 0.72),
      ttlGood: D.ttlGood,
      ttlJunk: D.ttlJunk,
      pGood: D.pGood,
      maxTargets: D.maxTargets,

      scoreGood: 10,
      penaltyJunk: 8,
      scoreBlockJunk: 2,

      feverGood: 2.2,
      feverJunkHit: 5.0,

      shieldEveryStreak: 6,
      shieldMax: 5,

      bossFeverOn: 72,
      bossDmgPerGood: 6.5,
      bossHpDecayPerSec: 0.0,
      bossBonus: 80,
      bossFeverDrop: 28,

      goalTargetBase: 6,
      goalTargetSpan: 6,
      goalTarget: 8,
      goalBonus: 30,

      goodEmo: ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑'],
      junkEmo: ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭'],

      shootLockPx: 90
    };
  }

  function makeRng(seedStr){
    // xfnv1a + sfc32
    let h = 2166136261 >>> 0;
    const s = String(seedStr || '');
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let a = (h ^ 0x9e3779b9) >>> 0;
    let b = (h ^ 0x243f6a88) >>> 0;
    let c = (h ^ 0xb7e15162) >>> 0;
    let d = (h ^ 0xdeadbeef) >>> 0;

    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function pickOne(arr, rng){
    if(!arr || !arr.length) return '•';
    const i = (rng() * arr.length) | 0;
    return arr[i];
  }

  function setText(el, txt){
    if(!el) return;
    el.textContent = String(txt ?? '');
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function clamp01(v){ return clamp(v,0,1); }

  function gradeOf(score, miss, timeSec){
    // simple, stable grading
    const s = Number(score)||0;
    const m = Number(miss)||0;
    const t = Math.max(1, Number(timeSec)||60);
    const pace = s / t;                 // points/sec
    const penalty = m * 2.0;
    const v = pace*10 - penalty;

    if(v >= 7.2) return 'S';
    if(v >= 5.6) return 'A';
    if(v >= 4.2) return 'B';
    if(v >= 3.0) return 'C';
    return 'D';
  }
}