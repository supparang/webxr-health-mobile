// === /webxr-health-mobile/herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (SOLO: 3-stage + storm + boss + AI prediction hooks)
// ✅ ESM export boot(cfg)
// ✅ Deterministic seed RNG (research-ready)
// ✅ HUD-safe spawn rect (never spawn under HUD)
// ✅ Supports hha:shoot (VR crosshair) + click/tap
// ✅ MISS definition: good expired + junk hit (shield-guarded junk does NOT count miss)
// ✅ Emits telemetry events: hha:score, hha:game-ended, hha:ai
// FULL v20260302-GOODJUNK-SAFE-SOLO-EXTREME
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------------- utils ----------------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();

  const VIEW = String(cfg.view || qs('view','mobile')).toLowerCase();
  const RUN  = String(cfg.run  || qs('run','play')).toLowerCase();
  const DIFF = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const PID  = String(cfg.pid  || qs('pid','anon')).trim() || 'anon';
  const SEED = String(cfg.seed || qs('seed', String(Date.now())));
  const TIME_ALL = clamp(cfg.time ?? qs('time','80'), 20, 300);

  const AI = cfg.ai || null;          // createGoodJunkAI(...) from ai-goodjunk.js
  const LOGGER = cfg.logger || null;  // optional (not required here; RUN wires events)

  const debug = (qs('debug','0') === '1') || !!cfg.debug;

  function $(id){ return DOC.getElementById(id); }
  function setText(id, v){ const el=$(id); if(el) el.textContent = String(v); }
  function setAttr(id, k, v){ const el=$(id); if(el) el.setAttribute(k, String(v)); }
  function show(el, on){
    if(!el) return;
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
  }

  // ---------------- deterministic RNG ----------------
  // xmur3 + sfc32 (fast, deterministic)
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
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
  const seedFn = xmur3(`${SEED}::${PID}::goodjunk::${DIFF}::${RUN}`);
  const rand = sfc32(seedFn(), seedFn(), seedFn(), seedFn());
  const r01 = ()=> rand();
  const rInt = (a,b)=> Math.floor(a + r01()*(b-a+1));
  const pick = (arr)=> arr[Math.floor(r01()*arr.length)];
  const chance = (p)=> r01() < p;

  // ---------------- DOM refs ----------------
  const hud = $('hud');
  const stage = $('stage');
  const layer = $('gj-layer') || $('gj-layer') || $('gj-layer');
  const endOverlay = $('endOverlay');
  const lowTimeOverlay = $('lowTimeOverlay');

  // HUD ids (must match your RUN html)
  const elScore = $('hud-score');
  const elTime  = $('hud-time');
  const elMiss  = $('hud-miss');
  const elGrade = $('hud-grade');
  const elGoal  = $('hud-goal');
  const elGoalCur = $('hud-goal-cur');
  const elGoalTarget = $('hud-goal-target');
  const elGoalDesc = $('goalDesc');

  const elMini = $('hud-mini');
  const elMiniTimer = $('miniTimer');

  const elFeverText = $('feverText');
  const elFeverFill = $('feverFill');
  const elShieldPills = $('shieldPills');

  const bossBar = $('bossBar');
  const elBossFill = $('bossFill');
  const elBossHint = $('bossHint');

  const elProgressFill = $('gjProgressFill');

  // AI HUD
  const elAiRisk = $('aiRisk');
  const elAiHint = $('aiHint');

  // End panel ids
  const elEndTitle = $('endTitle');
  const elEndSub   = $('endSub');
  const elEndGrade = $('endGrade');
  const elEndScore = $('endScore');
  const elEndMiss  = $('endMiss');
  const elEndTime  = $('endTime');

  if(!layer){
    // hard fail-safe: do nothing but avoid crash
    console.warn('[GoodJunkSAFE] missing #gj-layer');
    return;
  }

  // ---------------- difficulty tuning ----------------
  const DIFF_CFG = (()=>{
    // spawnRate: targets per second baseline
    // junkBias: chance of junk
    // ttl: lifetime ms
    // speed: px per sec for drift
    // storm: special bursts
    if(DIFF === 'easy'){
      return { spawnRate: 0.95, junkBias: 0.22, ttlMs:[1700,2400], speed:[10,55], stormEvery:[18,26], bossAt: 22 };
    }
    if(DIFF === 'hard'){
      return { spawnRate: 1.55, junkBias: 0.36, ttlMs:[1000,1700], speed:[35,120], stormEvery:[12,18], bossAt: 30 };
    }
    return { spawnRate: 1.20, junkBias: 0.30, ttlMs:[1200,2100], speed:[20,85], stormEvery:[14,22], bossAt: 26 };
  })();

  // ---------------- gameplay state ----------------
  const S = {
    startedAtMs: nowMs(),
    tLeft: TIME_ALL,
    running: true,
    ended: false,

    // scoring / performance
    score: 0,
    shots: 0,
    hitsGood: 0,
    hitsJunk: 0,
    hits: 0,
    miss: 0,              // miss = goodExpired + junkHit (guarded junk excluded)
    goodExpired: 0,
    junkHit: 0,
    junkHitGuard: 0,
    combo: 0,
    comboMax: 0,

    // reaction time
    goodRts: [],          // store last N RTs
    lastSpawnGoodAt: 0,   // for RT estimate (rough)
    lastGoodSpawnId: '',

    // fever / shield
    fever: 0,             // 0..100
    shield: 0,            // 0..3 pills

    // mission + progress
    stage: 1,             // 1..3
    goalTarget: 20,
    goalCur: 0,

    // mini (storm/boss)
    mini: '',
    miniT: 0,

    // boss
    bossOn: false,
    bossHp: 0,
    bossHpMax: 0,
    bossHitsNeeded: 0,
    bossHits: 0,

    // AI
    aiLastRisk: 0,
    aiLastHint: '',
    aiLastAt: 0,
  };

  // ---------------- safe spawn rect (avoid HUD) ----------------
  function getSafeRect(){
    const r = layer.getBoundingClientRect();
    const hudH = hud ? hud.getBoundingClientRect().height : 0;

    // Because layer is inside stage, HUD is outside.
    // Still, we keep spawns away from top area inside layer (kid-friendly).
    const pad = 18;
    const topSafePad = Math.min(80, Math.max(34, Math.round(hudH * 0.12)));

    return {
      left: pad,
      top: pad + topSafePad,
      right: Math.max(pad, r.width - pad),
      bottom: Math.max(pad, r.height - pad),
      w: r.width,
      h: r.height
    };
  }

  // ---------------- target system ----------------
  const targets = new Map(); // id -> target object
  let tidSeq = 0;

  const EMOJI_GOOD = ['🥦','🍎','🥕','🍌','🥛','🥚','🐟','🍇','🥬'];
  const EMOJI_JUNK = ['🍟','🍔','🍩','🍭','🥤','🍫','🧁','🍿'];
  const EMOJI_STAR = ['⭐','✨'];
  const EMOJI_DIAM = ['💎'];
  const EMOJI_SHLD = ['🛡️'];

  function makeTarget(type, opts={}){
    const id = `t_${Date.now()}_${(++tidSeq)}`;
    const rect = getSafeRect();

    const x = clamp(opts.x ?? rInt(rect.left, rect.right), rect.left, rect.right);
    const y = clamp(opts.y ?? rInt(rect.top, rect.bottom), rect.top, rect.bottom);

    const ttl = opts.ttlMs ?? rInt(DIFF_CFG.ttlMs[0], DIFF_CFG.ttlMs[1]);
    const speed = opts.speed ?? (r01()*(DIFF_CFG.speed[1]-DIFF_CFG.speed[0]) + DIFF_CFG.speed[0]);

    const angle = r01() * Math.PI * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    let emoji = '❔';
    let className = 't';
    if(type==='good'){ emoji = pick(EMOJI_GOOD); className += ' good'; }
    if(type==='junk'){ emoji = pick(EMOJI_JUNK); className += ' junk'; }
    if(type==='star'){ emoji = pick(EMOJI_STAR); className += ' good'; }
    if(type==='diamond'){ emoji = pick(EMOJI_DIAM); className += ' good'; }
    if(type==='shield'){ emoji = pick(EMOJI_SHLD); className += ' good'; }

    const el = DOC.createElement('div');
    el.className = className;
    el.textContent = emoji;
    el.setAttribute('data-id', id);
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    layer.appendChild(el);

    const t = {
      id, type,
      emoji,
      el,
      bornAt: nowMs(),
      ttlMs: ttl,
      x, y, vx, vy,
      alive: true
    };

    targets.set(id, t);

    // RT tracking for good
    if(type==='good' || type==='star' || type==='diamond' || type==='shield'){
      S.lastSpawnGoodAt = nowMs();
      S.lastGoodSpawnId = id;
    }

    return t;
  }

  function killTarget(id, reason='kill'){
    const t = targets.get(id);
    if(!t) return;
    targets.delete(id);
    t.alive = false;
    try{ t.el.style.opacity = '0'; t.el.style.transform = 'translate(-50%,-50%) scale(0.75)'; }catch(e){}
    try{ setTimeout(()=>{ try{ t.el.remove(); }catch(_){} }, 40); }catch(e){}
    return t;
  }

  // ---------------- scoring + grades ----------------
  function gradeFrom(score, miss){
    // kid-friendly grade; punishes miss strongly (as you asked)
    const s = Number(score)||0;
    const m = Number(miss)||0;
    const x = s - m*18;
    if(x >= 520) return 'S';
    if(x >= 420) return 'A';
    if(x >= 320) return 'B';
    if(x >= 220) return 'C';
    if(x >= 140) return 'D';
    return 'E';
  }

  function addScore(delta){
    S.score = Math.max(0, Math.round(S.score + (Number(delta)||0)));
  }

  function feverAdd(p){
    S.fever = clamp(S.fever + (Number(p)||0), 0, 100);
  }
  function feverUseTick(dt){
    // fever drains when active (higher combo drains slower)
    if(S.fever <= 0) return;
    const drain = 7.2 * dt; // % per sec
    S.fever = clamp(S.fever - drain, 0, 100);
  }

  function shieldAdd(n=1){
    S.shield = clamp(S.shield + n, 0, 3);
  }
  function shieldUse(){
    if(S.shield > 0){
      S.shield -= 1;
      return true;
    }
    return false;
  }

  // ---------------- AI update ----------------
  function updateAI(){
    if(!AI) return;
    // telemetry snapshot
    const snap = {
      diff: DIFF,
      view: VIEW,
      timeLeftSec: S.tLeft,
      timeAllSec: TIME_ALL,
      shots: S.shots,
      miss: S.miss,
      hitJunk: S.hitsJunk,
      hitGood: S.hitsGood,
      combo: S.combo,
      medianRtGoodMs: median(S.goodRts),
      avgRtGoodMs: avg(S.goodRts),
      feverPct: S.fever
    };

    const out = AI.maybeHint ? AI.maybeHint(snap) : (AI.predict ? AI.predict(snap) : null);
    if(!out) return;

    const risk = clamp(out.risk ?? 0, 0, 1);
    const hint = String(out.hint || '');

    // update HUD
    if(elAiRisk) elAiRisk.textContent = `${Math.round(risk*100)}%`;
    if(elAiHint) elAiHint.textContent = hint ? hint : '—';

    // emit AI event (logger can capture if desired)
    emit('hha:ai', {
      ts: nowIso(),
      risk,
      hint,
      top: out.top || [],
      snap
    });
  }

  // ---------------- telemetry emitters ----------------
  let scoreEmitT = 0;
  function emitScoreTick(){
    const t = nowMs();
    if(t - scoreEmitT < 350) return; // throttle
    scoreEmitT = t;

    const acc = (S.shots > 0) ? (S.hitsGood * 100 / S.shots) : 0;
    emit('hha:score', {
      ts: nowIso(),
      score: S.score,
      combo: S.combo,
      comboMax: S.comboMax,
      miss: S.miss,
      hits: S.hits,
      hitsGood: S.hitsGood,
      hitsJunk: S.hitsJunk,
      shots: S.shots,
      accPct: Math.round(acc*100)/100,
      medianRtGoodMs: median(S.goodRts),
      avgRtGoodMs: avg(S.goodRts),
      feverPct: S.fever,
      shield: S.shield,
      stage: S.stage,
      goalCur: S.goalCur,
      goalTarget: S.goalTarget,
      bossOn: S.bossOn,
      bossHp: S.bossHp,
      bossHpMax: S.bossHpMax
    });
  }

  // ---------------- hit logic ----------------
  function onHit(id, input='tap'){
    if(S.ended || !S.running) return;
    const t = targets.get(id);
    if(!t || !t.alive) return;

    S.shots += 1;

    // Compute RT (rough): only for last good spawned
    let rt = '';
    if(t.id === S.lastGoodSpawnId){
      rt = Math.max(0, Math.round(nowMs() - S.lastSpawnGoodAt));
      if(Number.isFinite(rt) && rt > 0){
        S.goodRts.push(rt);
        if(S.goodRts.length > 60) S.goodRts.shift();
      }
    }

    if(t.type === 'junk'){
      // Shield can guard junk hit
      if(shieldUse()){
        S.junkHitGuard += 1;
        // No miss
        killTarget(id, 'junk_guard');
        S.combo = 0;

        // tiny reward to feel good
        addScore(2);
      }else{
        S.junkHit += 1;
        S.miss += 1; // junk hit counts miss
        S.combo = 0;

        addScore(-14);
        feverAdd(-12);
        killTarget(id, 'junk_hit');
      }

      S.hitsJunk += 1;
      S.hits += 1;

    }else{
      // GOOD / STAR / DIAMOND / SHIELD
      S.hitsGood += 1;
      S.hits += 1;

      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);

      // fever multiplier (when fever high, reward bigger)
      const feverBoost = (S.fever >= 65) ? 1.5 : (S.fever >= 35 ? 1.2 : 1.0);
      const comboBoost = Math.min(2.0, 1.0 + S.combo*0.03);

      let base = 10;
      if(t.type === 'star') base = 18;
      if(t.type === 'diamond') base = 26;
      if(t.type === 'shield') base = 9;

      const pts = Math.round(base * feverBoost * comboBoost);
      addScore(pts);

      // progress / goals
      if(t.type === 'shield'){
        shieldAdd(1);
      }else{
        S.goalCur += 1;
      }

      // fever grows with streaks
      feverAdd( (t.type === 'diamond') ? 14 : (t.type === 'star') ? 10 : 6 );

      // boss damage: only good/star/diamond count
      if(S.bossOn && (t.type==='good' || t.type==='star' || t.type==='diamond')){
        S.bossHits += 1;
        S.bossHp = clamp(S.bossHp - 1, 0, S.bossHpMax);
      }

      killTarget(id, 'good_hit');
    }

    // update UI & events
    updateHUD();
    emitScoreTick();
    updateAI();

    // stage transitions
    checkProgress();

    // If boss cleared
    if(S.bossOn && S.bossHp <= 0){
      endBoss(true);
    }
  }

  // ---------------- input wiring ----------------
  function resolveTargetFromEvent(ev){
    // if clicked on target
    const el = ev && ev.target ? ev.target : null;
    if(!el) return null;
    if(el.classList && el.classList.contains('t')){
      return el.getAttribute('data-id');
    }
    return null;
  }

  // tap/click
  layer.addEventListener('pointerdown', (ev)=>{
    if(S.ended) return;
    const id = resolveTargetFromEvent(ev);
    if(id) onHit(id, 'pointer');
  }, { passive:true });

  // VR crosshair shoot event (from vr-ui.js): { hitEl?, x?, y? }
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(S.ended) return;
    const d = ev && ev.detail ? ev.detail : {};
    // If a target element is provided, use it
    if(d.hitEl && d.hitEl.getAttribute){
      const id = d.hitEl.getAttribute('data-id');
      if(id) return onHit(id, 'shoot');
    }
    // else: pick nearest target to center
    const rect = layer.getBoundingClientRect();
    const cx = rect.width/2, cy = rect.height/2;
    let best = null, bestDist = 1e9;
    for(const t of targets.values()){
      const dx = (t.x - cx), dy = (t.y - cy);
      const dd = dx*dx + dy*dy;
      if(dd < bestDist){ bestDist = dd; best = t; }
    }
    if(best) onHit(best.id, 'shoot_center');
  });

  // ---------------- missions / progression ----------------
  function setGoal(stageNo){
    // stage 1: accuracy / avoid junk
    // stage 2: storm survival
    // stage 3: boss fight
    if(stageNo === 1){
      S.stage = 1;
      S.goalTarget = DIFF==='hard' ? 24 : DIFF==='easy' ? 16 : 20;
      S.goalCur = 0;
      S.mini = '';
      S.miniT = 0;

      if(elGoal) elGoal.textContent = 'Daily';
      if(elGoalTarget) elGoalTarget.textContent = String(S.goalTarget);
      if(elGoalDesc) elGoalDesc.textContent = 'Hit GOOD ให้ครบ';
      if(elMini) elMini.textContent = '—';
      if(elMiniTimer) elMiniTimer.textContent = '—';

    }else if(stageNo === 2){
      S.stage = 2;
      S.mini = 'STORM';
      S.miniT = rInt(9, 12);
      S.goalCur = 0;
      S.goalTarget = 1;

      if(elGoal) elGoal.textContent = 'Mission';
      if(elGoalTarget) elGoalTarget.textContent = '—';
      if(elGoalDesc) elGoalDesc.textContent = 'เอาชีวิตรอด STORM';
      if(elMini) elMini.textContent = 'STORM';
      if(elMiniTimer) elMiniTimer.textContent = `${S.miniT}s`;

    }else{
      S.stage = 3;
      S.mini = 'BOSS';
      S.miniT = 0;
      S.goalCur = 0;
      S.goalTarget = 1;

      if(elGoal) elGoal.textContent = 'Boss';
      if(elGoalTarget) elGoalTarget.textContent = '—';
      if(elGoalDesc) elGoalDesc.textContent = 'เก็บ GOOD รัว ๆ ใส่บอส!';
      if(elMini) elMini.textContent = 'BOSS';
      if(elMiniTimer) elMiniTimer.textContent = '—';
    }
  }

  function startBoss(){
    S.bossOn = true;
    S.bossHpMax = DIFF==='hard' ? 18 : DIFF==='easy' ? 10 : 14;
    S.bossHp = S.bossHpMax;
    S.bossHitsNeeded = S.bossHpMax;
    S.bossHits = 0;
    if(bossBar) bossBar.setAttribute('aria-hidden','false');
    if(elBossHint) elBossHint.textContent = 'Hit GOOD to damage';
    updateBossBar();
  }

  function endBoss(cleared){
    S.bossOn = false;
    if(bossBar) bossBar.setAttribute('aria-hidden','true');

    if(cleared){
      // big finish reward
      addScore(120);
      feverAdd(25);
      updateHUD();
      emitScoreTick();
      // end game immediately
      endGame('boss_cleared');
    }else{
      endGame('boss_failed');
    }
  }

  function checkProgress(){
    if(S.stage === 1){
      if(S.goalCur >= S.goalTarget){
        // stage clear
        addScore(60);
        shieldAdd(1);
        setGoal(2);
      }
    }else if(S.stage === 2){
      // storm ends via timer tick -> goes to boss
    }else if(S.stage === 3){
      // boss handled by hp
    }
  }

  // ---------------- spawning director (solo extreme) ----------------
  let spawnAcc = 0;
  let nextStormAt = rInt(DIFF_CFG.stormEvery[0], DIFF_CFG.stormEvery[1]);
  let stormOn = false;
  let stormBurstT = 0;

  function spawnTick(dt){
    if(S.ended) return;

    // stage-based spawn multiplier
    let rate = DIFF_CFG.spawnRate;
    if(S.stage === 2) rate *= 1.55;
    if(S.stage === 3) rate *= 1.25;

    // fever pushes difficulty (fun!)
    if(S.fever >= 70) rate *= 1.18;

    // accumulate spawn
    spawnAcc += rate * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
    }

    // schedule storm for stage 1 only
    if(S.stage === 1){
      const tSpent = TIME_ALL - S.tLeft;
      if(tSpent >= nextStormAt){
        stormOn = true;
        stormBurstT = rInt(6, 9);
        nextStormAt += rInt(DIFF_CFG.stormEvery[0], DIFF_CFG.stormEvery[1]);
      }
    }

    if(stormOn){
      // rapid bursts
      if(chance(0.38)){
        spawnBurst(2 + rInt(0,2));
      }
      stormBurstT -= dt;
      if(stormBurstT <= 0){
        stormOn = false;
      }
    }

    // stage 2: storm survival countdown
    if(S.stage === 2){
      S.miniT = Math.max(0, S.miniT - dt);
      if(elMiniTimer) elMiniTimer.textContent = `${Math.ceil(S.miniT)}s`;
      if(S.miniT <= 0){
        // go boss
        setGoal(3);
        startBoss();
      }
    }
  }

  function spawnBurst(n){
    for(let i=0;i<n;i++){
      // during storm, more junk
      const junkBias = clamp(DIFF_CFG.junkBias + 0.18, 0, 0.75);
      const t = chance(junkBias) ? 'junk' : 'good';
      makeTarget(t, { ttlMs: rInt(900, 1400), speed: rInt(40, 140) });
    }
  }

  function spawnOne(){
    const rect = getSafeRect();

    // Rare specials
    if(!S.bossOn && chance(0.06)){
      // star or diamond
      makeTarget(chance(0.75) ? 'star' : 'diamond', { ttlMs:rInt(900,1500), speed:rInt(30,120) });
      return;
    }
    if(chance(0.05) && S.shield < 3){
      makeTarget('shield', { ttlMs:rInt(900,1600), speed:rInt(25,110) });
      return;
    }

    // main: good vs junk
    let junkBias = DIFF_CFG.junkBias;

    // adaptive fairness: if miss spikes, reduce junk a bit (still tough)
    if(S.shots >= 12){
      const missRate = S.miss / Math.max(1, S.shots);
      if(missRate > 0.35) junkBias = Math.max(0.18, junkBias - 0.06);
    }

    // boss: more good so kid can win
    if(S.bossOn) junkBias = Math.max(0.18, junkBias - 0.10);

    const isJunk = chance(junkBias);
    makeTarget(isJunk ? 'junk' : 'good', { ttlMs: rInt(DIFF_CFG.ttlMs[0], DIFF_CFG.ttlMs[1]) });
  }

  // ---------------- physics / expiry ----------------
  function targetsTick(dt){
    const rect = getSafeRect();

    for(const t of targets.values()){
      const age = nowMs() - t.bornAt;

      // expiry
      if(age >= t.ttlMs){
        // expire good -> MISS++
        if(t.type !== 'junk'){
          S.goodExpired += 1;
          S.miss += 1; // miss = goodExpired + junkHit
          S.combo = 0;
          addScore(-10);
          feverAdd(-8);
        }
        killTarget(t.id, 'expired');
        continue;
      }

      // drift + bounce inside layer
      t.x += t.vx * dt;
      t.y += t.vy * dt;

      if(t.x < rect.left){ t.x = rect.left; t.vx *= -1; }
      if(t.x > rect.right){ t.x = rect.right; t.vx *= -1; }
      if(t.y < rect.top){ t.y = rect.top; t.vy *= -1; }
      if(t.y > rect.bottom){ t.y = rect.bottom; t.vy *= -1; }

      // apply
      try{
        t.el.style.left = `${t.x}px`;
        t.el.style.top  = `${t.y}px`;
      }catch(e){}
    }
  }

  // ---------------- UI updates ----------------
  function updateBossBar(){
    if(!S.bossOn) return;
    if(elBossFill){
      const pct = (S.bossHpMax > 0) ? (S.bossHp * 100 / S.bossHpMax) : 0;
      elBossFill.style.width = `${clamp(pct,0,100)}%`;
    }
  }

  function updateHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.tLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);

    const g = gradeFrom(S.score, S.miss);
    if(elGrade) elGrade.textContent = g;

    if(elGoalCur) elGoalCur.textContent = String(S.goalCur);
    if(elGoalTarget) elGoalTarget.textContent = String(S.goalTarget);

    // fever
    if(elFeverText) elFeverText.textContent = `${Math.round(S.fever)}%`;
    if(elFeverFill) elFeverFill.style.width = `${clamp(S.fever,0,100)}%`;

    // shield pills
    if(elShieldPills){
      elShieldPills.textContent = S.shield<=0 ? '—' : '🛡️'.repeat(S.shield);
    }

    // progress bar (stage 1 goal)
    if(elProgressFill){
      let pct = 0;
      if(S.stage === 1 && S.goalTarget > 0) pct = (S.goalCur*100/S.goalTarget);
      if(S.stage === 2) pct = clamp((1 - (S.miniT/12))*100, 0, 100);
      if(S.stage === 3 && S.bossOn && S.bossHpMax > 0) pct = (100 - (S.bossHp*100/S.bossHpMax));
      elProgressFill.style.width = `${clamp(pct,0,100)}%`;
    }

    updateBossBar();
  }

  function updateLowTimeOverlay(){
    if(!lowTimeOverlay) return;
    const on = (S.tLeft <= 6 && S.tLeft > 0 && !S.ended);
    show(lowTimeOverlay, on);
    if(on){
      const num = $('gj-lowtime-num');
      if(num) num.textContent = String(Math.ceil(S.tLeft));
    }
  }

  // ---------------- end game ----------------
  function endGame(reason='time_up'){
    if(S.ended) return;
    S.ended = true;
    S.running = false;

    // stop remaining targets
    for(const id of Array.from(targets.keys())) killTarget(id, 'end');
    targets.clear();

    const grade = gradeFrom(S.score, S.miss);

    if(elEndTitle) elEndTitle.textContent = (reason==='boss_cleared') ? 'ชนะบอส! 🏆' : 'จบเกม';
    if(elEndSub) elEndSub.textContent =
      (reason==='time_up') ? 'หมดเวลาแล้ว ⏱️' :
      (reason==='boss_cleared') ? 'สุดยอด! ผ่านด่านบอสได้!' :
      (reason==='boss_failed') ? 'บอสยังไม่ล้ม ลองใหม่ได้!' :
      String(reason||'');

    if(elEndGrade) elEndGrade.textContent = grade;
    if(elEndScore) elEndScore.textContent = String(S.score);
    if(elEndMiss)  elEndMiss.textContent  = String(S.miss);
    if(elEndTime)  elEndTime.textContent  = String(TIME_ALL - Math.max(0, Math.ceil(S.tLeft)));

    if(endOverlay) show(endOverlay, true);

    // emit final summary for logger (RUN listens hha:game-ended)
    const acc = (S.shots > 0) ? (S.hitsGood*100/S.shots) : 0;

    const summary = {
      ts: nowIso(),
      reason,
      pid: PID,
      seed: SEED,
      run: RUN,
      diff: DIFF,
      view: VIEW,

      scoreFinal: S.score,
      comboMax: S.comboMax,
      shots: S.shots,
      hits: S.hits,
      hitsGood: S.hitsGood,
      hitsJunk: S.hitsJunk,

      missTotal: S.miss,
      goodExpired: S.goodExpired,
      junkHit: S.junkHit,
      junkHitGuard: S.junkHitGuard,

      accPct: Math.round(acc*100)/100,
      medianRtGoodMs: median(S.goodRts),
      avgRtGoodMs: avg(S.goodRts),

      feverEndPct: Math.round(S.fever),
      shieldEnd: S.shield,

      stageReached: S.stage,
      bossCleared: (reason==='boss_cleared') ? 1 : 0
    };

    emit('hha:game-ended', summary);
  }

  // ---------------- stats helpers ----------------
  function avg(arr){
    if(!arr || !arr.length) return '';
    let s=0; for(const x of arr) s += Number(x)||0;
    return Math.round((s/arr.length)*100)/100;
  }
  function median(arr){
    if(!arr || !arr.length) return '';
    const a = arr.slice().map(x=>Number(x)||0).sort((x,y)=>x-y);
    const mid = Math.floor(a.length/2);
    const m = (a.length%2) ? a[mid] : (a[mid-1]+a[mid])/2;
    return Math.round(m);
  }

  // ---------------- main loop ----------------
  let lastT = nowMs();

  function tick(){
    if(S.ended) return;

    const t = nowMs();
    let dt = (t - lastT) / 1000;
    lastT = t;
    dt = clamp(dt, 0, 0.05);

    // timer
    S.tLeft = Math.max(0, S.tLeft - dt);

    // fever drain
    feverUseTick(dt);

    // stage 2 countdown handled in spawnTick
    spawnTick(dt);
    targetsTick(dt);

    // boss UI
    if(S.bossOn) updateBossBar();

    updateHUD();
    updateLowTimeOverlay();

    // time up (unless boss cleared earlier)
    if(S.tLeft <= 0){
      endGame('time_up');
      return;
    }

    requestAnimationFrame(tick);
  }

  // ---------------- start ----------------
  // init UI
  setText('uiView', VIEW);
  setText('uiRun', RUN);
  setText('uiDiff', DIFF);
  setGoal(1);
  updateHUD();
  updateAI();

  // start
  requestAnimationFrame(tick);

  // if user navigates away, best-effort flush is handled by your logger client (pagehide/beforeunload)
  if(debug){
    console.log('[GoodJunkSAFE] boot', { VIEW, RUN, DIFF, PID, SEED, TIME_ALL, hasAI:!!AI, hasLogger:!!LOGGER });
  }
}