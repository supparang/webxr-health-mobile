// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PLAY MODE (bubble targets + heavy PERFECT shards)
// ✅ FIX: zone counting uses zoneFrom(pct) single source of truth
// ✅ Parallax 2 layers + drag "VR look"
// ✅ Storm: faster spawn + stronger sway + speedlines + chroma + wobble boost
// ✅ PERFECT: heavy star burst (shard + particle) + ring flash + sound
// ✅ Core minis 3 + Surprise mini once + Chain minis continues (fail only on JUNK hit)

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// Particles (optional): /vr/particles.js IIFE
const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, setShardMode(){} };

// ---------------- helpers ----------------
const $ = (id)=>document.getElementById(id);
function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr, fb){ return (Array.isArray(arr)&&arr.length)?arr[(Math.random()*arr.length)|0]:fb; }

function now(){
  return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
}

function setText(id, txt){
  const el = $(id);
  if (el) el.textContent = String(txt);
}

function flashBlink(type, ms=120){
  const el = $('hvr-screen-blink');
  if (!el) return;
  el.className = '';
  el.classList.add(type);
  el.classList.add('on');
  setTimeout(()=>{ el.classList.remove('on'); }, ms);
}

function setStormUI(on){
  const wind = $('hvr-wind');
  const wrap = $('hvr-wrap');
  if (wind) wind.classList.toggle('on', !!on);
  if (wrap) {
    wrap.classList.toggle('hvr-storm-chroma', !!on);
  }
}

// ---------------- sound (tiny webaudio) ----------------
let _ac = null;
function ac(){
  if (_ac) return _ac;
  const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
  if (!AC) return null;
  _ac = new AC();
  return _ac;
}
function beep(freq=880, dur=0.08, type='sine', gain=0.055){
  const A = ac();
  if (!A) return;
  try{
    const t0 = A.currentTime;
    const o = A.createOscillator();
    const g = A.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(A.destination);
    o.start(t0);
    o.stop(t0+dur+0.02);
  }catch{}
}
function thud(){
  // low “hit” thud
  beep(140, 0.09, 'triangle', 0.08);
  setTimeout(()=>beep(90, 0.06, 'sine', 0.06), 18);
}
function dingPerfect(){
  beep(1320, 0.08, 'sine', 0.06);
  setTimeout(()=>beep(1760, 0.06, 'sine', 0.045), 55);
}

// ---------------- grade ----------------
function gradeFromScore(score){
  // เป้า: SSS/SS/S/A/B/C
  const s = Number(score)||0;
  if (s >= 2600) return 'SSS';
  if (s >= 1900) return 'SS';
  if (s >= 1300) return 'S';
  if (s >= 800)  return 'A';
  if (s >= 420)  return 'B';
  return 'C';
}
function progressToS(score){
  // Progress bar: 0..100% ไปถึง S (1300)
  const t = 1300;
  return clamp((score/t)*100, 0, 100);
}

// ---------------- parallax + drag view ----------------
function bindParallaxAndDrag(state){
  const wrap = $('hvr-wrap');
  const pf   = $('hvr-playfield');
  const bg1  = $('hvr-bg1');
  const bg2  = $('hvr-bg2');
  if (!wrap || !pf) return ()=>{};

  const drag = {
    down:false,
    pid:null,
    sx:0, sy:0,
    ox:0, oy:0,
    x:0, y:0,
    vx:0, vy:0,
    last:0
  };

  const MAX = 110; // clamp view shift
  const K_PF = 1.00;
  const K_BG1 = 0.18;
  const K_BG2 = 0.34;

  function apply(){
    // smooth
    drag.vx += (drag.x - drag.vx) * 0.18;
    drag.vy += (drag.y - drag.vy) * 0.18;

    const tx = drag.vx, ty = drag.vy;
    pf.style.transform = `translate3d(${tx*K_PF}px, ${ty*K_PF}px, 0)`;
    if (bg1) bg1.style.transform = `translate3d(${tx*K_BG1}px, ${ty*K_BG1}px, 0) scale(1.04)`;
    if (bg2) bg2.style.transform = `translate3d(${tx*K_BG2}px, ${ty*K_BG2}px, 0) scale(1.04)`;
  }

  // auto drift when not dragging
  let driftT = 0;
  let raf = null;
  function tick(ts){
    if (!drag.down){
      driftT += 0.010 + (state.stormOn ? 0.018 : 0.0);
      const ax = Math.sin(driftT*0.9) * (state.stormOn ? 14 : 7);
      const ay = Math.cos(driftT*0.7) * (state.stormOn ? 10 : 5);
      drag.x += (ax - drag.x) * 0.02;
      drag.y += (ay - drag.y) * 0.02;
    }
    apply();
    raf = ROOT.requestAnimationFrame(tick);
  }
  raf = ROOT.requestAnimationFrame(tick);

  function onDown(e){
    // ignore if clicking target itself (direct hit)
    const t = e.target;
    if (t && t.closest && t.closest('[data-hha-tgt="1"]')) return;

    drag.down = true;
    drag.pid = e.pointerId;
    drag.sx = e.clientX; drag.sy = e.clientY;
    drag.ox = drag.x;   drag.oy = drag.y;
    drag.last = now();
    try{ wrap.setPointerCapture(e.pointerId); }catch{}
  }
  function onMove(e){
    if (!drag.down) return;
    if (drag.pid != null && e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;

    // feel like “looking around”
    drag.x = clamp(drag.ox + dx * 0.55, -MAX, MAX);
    drag.y = clamp(drag.oy + dy * 0.55, -MAX, MAX);

    // storm makes it “more loose”
    if (state.stormOn){
      drag.x = clamp(drag.x * 1.12, -MAX, MAX);
      drag.y = clamp(drag.y * 1.12, -MAX, MAX);
    }
  }
  function onUp(e){
    if (!drag.down) return;
    if (drag.pid != null && e.pointerId !== drag.pid) return;
    drag.down = false;
    drag.pid = null;
  }

  wrap.addEventListener('pointerdown', onDown, { passive:true });
  wrap.addEventListener('pointermove', onMove, { passive:true });
  wrap.addEventListener('pointerup', onUp, { passive:true });
  wrap.addEventListener('pointercancel', onUp, { passive:true });

  // Tap-anywhere “shoot from center” (VR-like)
  function onTapShoot(e){
    const t = e.target;
    if (t && t.closest && t.closest('[data-hha-tgt="1"]')) return; // let direct hit
    if (!state.inst || typeof state.inst.shootCrosshair !== 'function') return;
    // only when playing
    if (!state.started || state.ended) return;
    const ok = state.inst.shootCrosshair();
    if (ok){
      // little micro blink to feel responsive
      flashBlink('good', 70);
    }
  }
  wrap.addEventListener('click', onTapShoot, { passive:true });

  return ()=>{
    try{ ROOT.cancelAnimationFrame(raf); }catch{}
    wrap.removeEventListener('pointerdown', onDown);
    wrap.removeEventListener('pointermove', onMove);
    wrap.removeEventListener('pointerup', onUp);
    wrap.removeEventListener('pointercancel', onUp);
    wrap.removeEventListener('click', onTapShoot);
  };
}

// ---------------- quests ----------------
function makeQuestPack(diffKey){
  const diff = String(diffKey||'easy').toLowerCase();

  const greenTarget = (diff==='hard') ? 22 : (diff==='normal' ? 18 : 14);
  const badLimit    = (diff==='hard') ? 10 : (diff==='normal' ? 12 : 15);

  const goals = [
    { id:'gGreen', label:`อยู่ใน GREEN ให้ครบ ${greenTarget}s`, target:greenTarget, type:'greenTime' },
    { id:'gBad',   label:`อยู่ LOW/HIGH รวมไม่เกิน ${badLimit}s`, target:badLimit, type:'badLimit' }
  ];

  const minis = [
    { id:'mCombo', label:'ทำคอมโบให้ถึง 10', target:(diff==='hard'?12:(diff==='normal'?10:8)), type:'combo' },
    { id:'mGood',  label:'เก็บน้ำดีให้ครบ 18', target:(diff==='hard'?22:(diff==='normal'?18:14)), type:'goodHits' },
    { id:'mNoJ',   label:'ห้ามโดน JUNK 10s', target:(diff==='hard'?12:(diff==='normal'?10:8)), type:'noJunk' },
  ];

  // Surprise mini once (random)
  const surprise = pick([
    { id:'sPerfect', label:'Surprise: PERFECT 3 ครั้งติด', target:3, type:'perfectStreak' },
    { id:'sClean',   label:'Surprise: เก็บ GOOD 8 ใน 8s', target:8, type:'rushGood', window:8 }
  ]);

  const chainDefs = pick([
    [
      { id:'cCleanse', label:'Chain: Junk Cleanse 8s (ห้ามโดน JUNK)', target:8, type:'chainNoJunk', window:8 },
      { id:'cPerfect', label:'Chain: PERFECT 2 ครั้งใน 6s', target:2, type:'chainPerfect', window:6 }
    ],
    [
      { id:'cPerfect', label:'Chain: PERFECT 3 ครั้งใน 8s', target:3, type:'chainPerfect', window:8 },
      { id:'cCleanse', label:'Chain: Clean Zone 10s (อยู่ GREEN)', target:10, type:'chainGreen', window:10 }
    ]
  ]);

  return { goals, minis, surprise, chainDefs };
}

function advanceMiniLabel(state, txt){
  const el = $('hha-quest-mini');
  if (el) el.textContent = `Mini: ${txt}`;
}
function advanceGoalLabel(state, txt){
  const el = $('hha-quest-goal');
  if (el) el.textContent = `Goal: ${txt}`;
}

// ---------------- main boot ----------------
export async function boot(opts = {}){
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration || 90, 30, 180);

  // Ensure water HUD binding
  ensureWaterGauge();

  const state = {
    started:false,
    ended:false,
    inst:null,

    // stats
    score:0,
    combo:0,
    comboBest:0,
    miss:0,

    // water
    water:50,
    zone:'GREEN',
    greenTick:0,
    badTick:0, // LOW/HIGH total seconds

    // hits
    goodHits:0,
    junkHits:0,
    perfectHits:0,
    lastJunkAt: -9999,

    // time
    secLeft: duration,

    // storm
    stormOn:false,
    stormT:0,
    stormUntil:0,
    stormIntensity:0,

    // quest pack
    pack: makeQuestPack(difficulty),
    goalsDone:0,
    goalsTotal:2,
    minisDone:0,
    minisTotal:3,
    surpriseDone:false,

    activeChain:null,
    chainIndex:0,
    chainCleared:0,
    chainFailed:0,

    // internal counters
    noJunkSec:0,
    perfectStreak:0,
    rushGoodCount:0,
    rushGoodUntil:0,

    // handlers cleanup
    cleanup: []
  };

  // UI totals
  setText('hha-goal-total', state.goalsTotal);
  setText('hha-mini-total', state.minisTotal);

  // Pools
  const pools = {
    good: ['💧','🫧','🥒','🍉'],
    bad:  ['🧋','🥤','🍟','🍩'],
    trick:['💧','🫧'] // fakeGood lookalike
  };
  const powerups = ['⭐','🛡️','⏱️']; // optional

  // initial quest labels
  advanceGoalLabel(state, state.pack.goals[0].label);
  advanceMiniLabel(state, state.pack.minis[0].label);

  // bind parallax/drag
  const unbind = bindParallaxAndDrag(state);
  state.cleanup.push(unbind);

  // Water set (single source of truth)
  function applyWater(pct){
    state.water = clamp(pct, 0, 100);
    const z = zoneFrom(state.water);     // ✅ THE ONLY zone computation
    state.zone = z;
    setWaterGauge(state.water);
    // also keep explicit zone text in HUD
    setText('hha-water-zone-text', z);
    return z;
  }
  applyWater(50);

  function uiScore(){
    setText('hha-score-main', state.score|0);
    setText('hha-combo-max', state.comboBest|0);
    setText('hha-miss', state.miss|0);

    const g = gradeFromScore(state.score);
    setText('hha-grade-badge', g);

    const pct = progressToS(state.score);
    const fill = $('hha-grade-progress-fill');
    if (fill) fill.style.width = `${pct.toFixed(0)}%`;
    setText('hha-grade-progress-text', `Progress to S (100%): ${pct.toFixed(0)}%`);
  }
  uiScore();

  // ----- Storm scheduling -----
  let nextStormAt = rand(16, 22); // seconds from start
  function maybeStartStorm(elapsed){
    if (state.stormOn) return;
    if (elapsed < nextStormAt) return;
    state.stormOn = true;
    state.stormT = 0;
    const len = rand(6.5, 9.5);
    state.stormUntil = elapsed + len;
    state.stormIntensity = 0.0;
    setStormUI(true);

    // boost wrap wobble a bit
    const wrap = $('hvr-wrap');
    if (wrap) wrap.style.animationDuration = '2.2s';
  }
  function stopStorm(){
    state.stormOn = false;
    state.stormT = 0;
    state.stormIntensity = 0;
    setStormUI(false);

    const wrap = $('hvr-wrap');
    if (wrap) wrap.style.animationDuration = '3.4s';

    // schedule next
    nextStormAt += rand(16, 24);
  }

  // spawnIntervalMul (storm makes faster)
  function spawnMul(){
    if (!state.stormOn) return 1;
    // stronger / faster (หนักกว่าเดิม)
    return 0.48;
  }

  // ---- PERFECT FX (heavy) ----
  function perfectFX(x, y){
    flashBlink('perfect', 120);
    dingPerfect();

    // heavy shards + particles + stars
    try{ Particles.setShardMode && Particles.setShardMode('stars'); }catch{}
    try{
      Particles.burstAt(x, y, { kind:'perfect', power:1.25, stars:true, shards:true });
    }catch{
      try{ Particles.burstAt(x, y); }catch{}
    }
    try{ Particles.scorePop(x, y, 'PERFECT! +', { big:true }); }catch{}
  }

  // ---- Good / Junk FX ----
  function goodFX(x,y, delta){
    flashBlink('good', 85);
    beep(720, 0.05, 'sine', 0.04);
    try{ Particles.burstAt(x,y, { kind:'good', power:0.85 }); }catch{}
    try{ Particles.scorePop(x,y, `+${delta}`, { good:true }); }catch{}
  }
  function junkFX(x,y, delta){
    flashBlink('bad', 95);
    thud();

    // screen wobble kick (a bit)
    const wrap = $('hvr-wrap');
    if (wrap){
      wrap.animate([
        { transform:'translate3d(0,0,0) rotate(0deg)' },
        { transform:'translate3d(-2px,1px,0) rotate(-0.08deg)' },
        { transform:'translate3d(2px,-1px,0) rotate(0.08deg)' },
        { transform:'translate3d(0,0,0) rotate(0deg)' }
      ], { duration: 180, easing:'cubic-bezier(.2,.8,.2,1)' });
    }

    try{ Particles.burstAt(x,y, { kind:'bad', power:1.0 }); }catch{}
    try{ Particles.scorePop(x,y, `${delta}`, { bad:true }); }catch{}
  }

  // ----- judge callback from mode-factory -----
  function judge(ch, ctx){
    // ctx.hitPerfect, ctx.itemType = good/bad/power/fakeGood
    const x = Number(ctx.clientX)||0;
    const y = Number(ctx.clientY)||0;

    const isBad = (ctx.itemType === 'bad');
    const isFake = (ctx.itemType === 'fakeGood');
    const isPower = (ctx.itemType === 'power');
    const isGood = !isBad;

    // "fakeGood" = นับเหมือน GOOD แต่ให้โทษเล็ก ๆ / ลดแต้มถ้าไม่ PERFECT
    let scoreDelta = 0;

    if (isBad){
      state.miss++;
      state.junkHits++;
      state.combo = 0;
      state.perfectStreak = 0;
      state.lastJunkAt = now();

      // water drop
      applyWater(state.water - (state.stormOn ? 14 : 12));

      scoreDelta = - (state.stormOn ? 35 : 28);
      state.score = Math.max(0, state.score + scoreDelta);

      junkFX(x,y, scoreDelta);
    } else {
      // good / power / fakeGood
      state.goodHits++;
      state.combo++;
      state.comboBest = Math.max(state.comboBest, state.combo);

      const perfect = !!ctx.hitPerfect;
      if (perfect){
        state.perfectHits++;
        state.perfectStreak++;
      } else {
        state.perfectStreak = 0;
      }

      // water increase
      const wAdd = isPower ? 10 : (perfect ? 8 : 6);
      applyWater(state.water + wAdd);

      // base score
      const base = isPower ? 34 : (perfect ? 30 : 18);
      const comboBonus = Math.min(22, state.combo * 1.15);
      scoreDelta = Math.round(base + comboBonus);

      if (isFake && !perfect){
        scoreDelta = Math.max(6, Math.round(scoreDelta * 0.55));
      }

      state.score += scoreDelta;

      if (perfect){
        perfectFX(x,y);
      } else {
        goodFX(x,y, scoreDelta);
      }
    }

    // update UI
    setText('hha-miss', state.miss);
    setText('hha-combo-max', state.comboBest);
    uiScore();

    // quest progress updates
    updateQuestsOnHit(ctx);

    return { scoreDelta, good: isGood, perfect: !!ctx.hitPerfect, itemType: ctx.itemType };
  }

  // ----- expire handler (optional) -----
  function onExpire(info){
    // expire ไม่ถือเป็น miss ใน hydration (ยุติธรรม)
    // แต่ลด combo เล็กน้อยถ้าปล่อยหลุดเยอะ ๆ
    if (!info) return;
    if (info.isGood) {
      // tiny decay
      state.combo = Math.max(0, state.combo - 1);
    }
  }

  // ----- spawn system boot -----
  const inst = await spawnBoot({
    modeKey:'hydration',
    difficulty,
    duration,
    spawnHost:'#hvr-playfield',
    pools,
    powerups,
    powerRate: 0.12,
    powerEvery: 7,
    goodRate: 0.62,
    allowAdaptive: true,
    trickRate: 0.10,

    // rhythm off by default
    rhythm: { enabled:false, bpm:110 },

    // storm affects interval + sway in mode-factory via CSS vars
    spawnIntervalMul: ()=>spawnMul(),

    // safe zone (avoid HUD)
    excludeSelectors: ['.hud', '#hvr-start', '#hvr-end'],

    judge,
    onExpire
  });

  state.inst = inst;
  state.started = true;

  // Make mode-factory know storm intensity (CSS vars)
  const pf = $('hvr-playfield');
  function setStormVars(){
    if (!pf) return;
    const i = clamp(state.stormIntensity, 0, 1);
    pf.style.setProperty('--hvr-storm', String(i));
  }

  // ----- time tick from mode-factory -----
  function onTime(e){
    const sec = Number(e?.detail?.sec);
    if (!Number.isFinite(sec)) return;
    state.secLeft = sec;

    // water auto drift toward 50 each second
    const drift = (state.water > 50) ? -1 : (state.water < 50 ? 1 : 0);
    if (drift !== 0){
      applyWater(state.water + drift);
    } else {
      // still refresh zone from current pct (prevent stale)
      applyWater(state.water);
    }

    // ✅ COUNT TICKS using computed zone (fixed bug)
    const z = zoneFrom(state.water);
    state.zone = z;

    if (z === 'GREEN') state.greenTick++;
    else state.badTick++;

    // no-junk timer
    const sinceJunk = (now() - state.lastJunkAt) / 1000;
    state.noJunkSec = Math.max(0, Math.floor(sinceJunk));

    // storm progress
    const elapsed = duration - sec;
    maybeStartStorm(elapsed);

    if (state.stormOn){
      // intensity ramp up/down
      const remain = Math.max(0, state.stormUntil - elapsed);
      const total = Math.max(0.1, state.stormUntil - nextStormAt);
      const t = clamp(1 - (remain/Math.max(0.1, total)), 0, 1);
      // ramp: up then down
      const ramp = (t < 0.5) ? (t*2) : (1 - (t-0.5)*2);
      state.stormIntensity = clamp(ramp*1.1, 0, 1);
      setStormVars();

      // stop storm when over
      if (elapsed >= state.stormUntil) stopStorm();
    } else {
      state.stormIntensity = 0;
      setStormVars();
    }

    // goals check each second
    updateGoalsPerSecond();

    // end
    if (sec <= 0) finishGame();
  }

  ROOT.addEventListener('hha:time', onTime, { passive:true });
  state.cleanup.push(()=>ROOT.removeEventListener('hha:time', onTime));

  // start tick refresh UI
  function updateQuestHUD(){
    setText('hha-goal-done', state.goalsDone);
    setText('hha-mini-done', state.minisDone);
  }
  updateQuestHUD();

  // ----- Quest logic -----
  function goal1DoneTarget(){
    return state.pack.goals[0].target;
  }
  function goal2BadLimit(){
    return state.pack.goals[1].target;
  }

  function updateGoalsPerSecond(){
    // Goal #1: green time
    const g1Target = goal1DoneTarget();
    const g2Limit  = goal2BadLimit();

    const g1Done = (state.greenTick >= g1Target);
    const g2Done = (state.badTick <= g2Limit);

    // update goal line with live progress
    const gLine = `อยู่ใน GREEN: ${state.greenTick}/${g1Target}s • BAD: ${state.badTick}/${g2Limit}s`;
    advanceGoalLabel(state, gLine);

    // mark done when both conditions satisfied at least once near end
    let doneCount = 0;
    if (g1Done) doneCount++;
    if (g2Done) doneCount++;

    // This game treats 2 goals as:
    // Goal1 pass when greenTick >= target (counts as goal)
    // Goal2 pass when badTick <= limit at end (counts as goal)
    // We'll set goal #1 when reached, goal #2 only when finished.
    let gd = 0;
    if (g1Done) gd++;
    // g2 determined at finish
    state.goalsDone = gd;
    updateQuestHUD();
  }

  function isCoreMiniDone(){
    return state.minisDone >= state.minisTotal;
  }

  // active core mini index = minisDone (0..2)
  function currentCoreMini(){
    return state.pack.minis[Math.min(state.minisDone, state.pack.minis.length-1)];
  }

  // chain minis: start after core minis done
  function startChain(){
    state.chainIndex = 0;
    state.activeChain = null;
    nextChainMini();
  }

  function nextChainMini(){
    const def = state.pack.chainDefs[state.chainIndex % state.pack.chainDefs.length];
    state.activeChain = {
      def,
      endsAt: now() + (def.window*1000),
      count: 0,
      failed: false
    };
    state.chainIndex++;
    // update mini line
    advanceMiniLabel(state, `${def.label} • เหลือ ${def.window}s (แพ้เฉพาะ JUNK hit)`);
  }

  function failChain(){
    if (!state.activeChain) return;
    state.chainFailed++;
    state.activeChain.failed = true;
    // immediately roll next chain mini (keeps pressure)
    nextChainMini();
  }

  function clearChain(){
    state.chainCleared++;
    // bonus
    state.score += 120 + Math.round(state.comboBest*2);
    uiScore();
    // next
    nextChainMini();
  }

  function updateQuestsOnHit(ctx){
    // Surprise once: trigger when 30% time passed and not done
    const elapsed = duration - state.secLeft;
    if (!state.surpriseDone && elapsed >= Math.max(8, duration*0.30)){
      // start surprise silently (it is “one-time mini”)
      state.surpriseDone = true;
      state.rushGoodCount = 0;
      state.rushGoodUntil = now() + ((state.pack.surprise.window||8)*1000);
      // show
      advanceMiniLabel(state, `${state.pack.surprise.label} (ครั้งเดียว)`);
    }

    // If chain is active, process chain logic first
    if (isCoreMiniDone()){
      if (!state.activeChain) startChain();

      const ch = state.activeChain;
      if (!ch) return;

      // fail only on junk hit
      if (ctx.itemType === 'bad'){
        failChain();
        return;
      }

      // update by type
      if (ch.def.type === 'chainNoJunk'){
        // just survive; check by time in per-second loop below
      } else if (ch.def.type === 'chainPerfect'){
        if (ctx.hitPerfect && ctx.itemType !== 'bad'){
          ch.count++;
        }
      } else if (ch.def.type === 'chainGreen'){
        // handled per-second loop below
      }

      return;
    }

    // Core minis progress
    const m = currentCoreMini();
    if (!m) return;

    let pass = false;
    let label = '';

    if (m.type === 'combo'){
      label = `คอมโบ: ${Math.min(state.comboBest, m.target)}/${m.target}`;
      if (state.comboBest >= m.target) pass = true;
    } else if (m.type === 'goodHits'){
      label = `GOOD: ${Math.min(state.goodHits, m.target)}/${m.target}`;
      if (state.goodHits >= m.target) pass = true;
    } else if (m.type === 'noJunk'){
      label = `No JUNK: ${Math.min(state.noJunkSec, m.target)}/${m.target}s`;
      if (state.noJunkSec >= m.target) pass = true;
    }

    advanceMiniLabel(state, `${m.label} • ${label}`);

    if (pass){
      state.minisDone++;
      // bonus + celebrate
      state.score += 140 + Math.round(state.comboBest*1.6);
      uiScore();
      try{ Particles.celebrate && Particles.celebrate({ kind:'mini' }); }catch{}

      updateQuestHUD();

      if (state.minisDone < state.minisTotal){
        const nm = currentCoreMini();
        advanceMiniLabel(state, nm.label);
      } else {
        advanceMiniLabel(state, 'Core Minis ครบแล้ว! 🔁 เริ่ม Chain Minis…');
      }
    }

    // Surprise evaluation (only once)
    if (state.surpriseDone && state.pack.surprise){
      const sdef = state.pack.surprise;
      if (sdef.type === 'perfectStreak'){
        // success if streak >= target anytime before end
        if (state.perfectStreak >= sdef.target){
          // one-time bonus
          state.score += 180;
          uiScore();
          try{ Particles.celebrate && Particles.celebrate({ kind:'surprise' }); }catch{}
          // disable so it doesn't repeat
          state.pack.surprise = null;
          advanceMiniLabel(state, 'Surprise เคลียร์! ✨');
        } else {
          advanceMiniLabel(state, `${sdef.label} • ${Math.min(state.perfectStreak, sdef.target)}/${sdef.target}`);
        }
      } else if (sdef.type === 'rushGood'){
        if (ctx.itemType !== 'bad'){
          // count good hits within window
          if (now() <= state.rushGoodUntil){
            state.rushGoodCount++;
          }
          if (state.rushGoodCount >= sdef.target){
            state.score += 160;
            uiScore();
            try{ Particles.celebrate && Particles.celebrate({ kind:'surprise' }); }catch{}
            state.pack.surprise = null;
            advanceMiniLabel(state, 'Surprise เคลียร์! ⚡');
          } else {
            const remain = Math.max(0, Math.round((state.rushGoodUntil - now())/1000));
            advanceMiniLabel(state, `${sdef.label} • ${Math.min(state.rushGoodCount,sdef.target)}/${sdef.target} • เหลือ ${remain}s`);
          }
        }
      }
    }
  }

  // Chain per-second checks
  function chainPerSecond(){
    if (!state.activeChain) return;

    const ch = state.activeChain;
    const remain = Math.max(0, Math.ceil((ch.endsAt - now())/1000));

    if (ch.def.type === 'chainNoJunk'){
      advanceMiniLabel(state, `${ch.def.label} • เหลือ ${remain}s (แพ้เฉพาะ JUNK hit)`);
      if (remain <= 0) clearChain();
      return;
    }

    if (ch.def.type === 'chainPerfect'){
      advanceMiniLabel(state, `${ch.def.label} • ${Math.min(ch.count,ch.def.target)}/${ch.def.target} • เหลือ ${remain}s`);
      if (ch.count >= ch.def.target) clearChain();
      else if (remain <= 0) { state.chainFailed++; nextChainMini(); }
      return;
    }

    if (ch.def.type === 'chainGreen'){
      // need to be in green for window
      const inGreen = (zoneFrom(state.water) === 'GREEN'); // ✅ consistent
      advanceMiniLabel(state, `${ch.def.label} • ${inGreen?'🟢 อยู่ GREEN':'🔶 ออกโซน'} • เหลือ ${remain}s`);
      if (remain <= 0){
        if (inGreen) clearChain();
        else { state.chainFailed++; nextChainMini(); }
      }
    }
  }

  // run chain check every second using our own interval (since hha:time may stop at end)
  const chainTimer = setInterval(()=>{
    if (!state.started || state.ended) return;
    if (isCoreMiniDone()) chainPerSecond();
  }, 250);
  state.cleanup.push(()=>clearInterval(chainTimer));

  // Finish
  function finishGame(){
    if (state.ended) return;
    state.ended = true;

    // finalize goals: goal #2 (bad limit) decided now
    const g1Target = goal1DoneTarget();
    const g2Limit  = goal2BadLimit();
    let goalsDone = 0;
    if (state.greenTick >= g1Target) goalsDone++;
    if (state.badTick <= g2Limit) goalsDone++;
    state.goalsDone = goalsDone;

    // bonus for goals
    state.score += (goalsDone * 220);
    uiScore();

    // stop spawner
    try{ state.inst && state.inst.stop && state.inst.stop(); }catch{}

    const finalZone = zoneFrom(state.water); // ✅ consistent
    state.zone = finalZone;

    const grade = gradeFromScore(state.score);
    const progPct = progressToS(state.score);

    try{
      ROOT.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          grade,
          score: state.score|0,
          goalsDone: state.goalsDone|0,
          goalsTotal: state.goalsTotal|0,
          minisDone: state.minisDone|0,
          minisTotal: state.minisTotal|0,
          chainCleared: state.chainCleared|0,
          chainFailed: state.chainFailed|0,
          comboBest: state.comboBest|0,
          miss: state.miss|0,
          water: state.water|0,
          zone: finalZone,
          greenTick: state.greenTick|0,
          fever: 0,
          shield: 0,
          progPct: progPct|0
        }
      }));
    }catch{}
  }

  // Safety stop listener
  function onStop(){
    if (state.ended) return;
    finishGame();
  }
  ROOT.addEventListener('hha:stop', onStop, { passive:true });
  state.cleanup.push(()=>ROOT.removeEventListener('hha:stop', onStop));

  return {
    stop(){
      try{ finishGame(); }catch{}
      // cleanup
      state.cleanup.forEach(fn=>{ try{ fn(); }catch{} });
      state.cleanup.length = 0;
    }
  };
}

export default { boot };
