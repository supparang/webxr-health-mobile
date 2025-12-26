
// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — LATEST PRODUCTION PACK
// ✅ FULL-SPREAD spawn (แก้ “เป้าที่เดิม”): spawnAroundCrosshair:false + spawnStrategy:'grid9'
// ✅ Targets move with screen (VR-feel): drag + subtle gyro
// ✅ Water Gauge (LOW/BALANCED/HIGH) + Fever/Shield
// ✅ Score/Combo/Miss + hit flash + danger vignette at low time
// ✅ Quest: Goals sequential + Mini chain (hydration.quest.js)
// ✅ Logger: emits hha:log_session / hha:log_event / hha:end
//
// Depends:
// - ../vr/mode-factory.js
// - ../vr/ui-water.js (IIFE global WaterUI)
// - ../vr/ui-fever.js (IIFE global FeverUI)
// - ../vr/particles.js (IIFE global Particles)
// - ../vr/hha-hud.js (IIFE global HUD binder)
// - ./hydration.quest.js
// - ./hydration.state.js

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { createHydrationQuest } from './hydration.quest.js';
import { clamp01, rankFromScore, makeSessionId, zoneFromPct } from './hydration.state.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function $(id){ return DOC ? DOC.getElementById(id) : null; }
function now(){ return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v,min,max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }
function safeStr(v){ return (v==null) ? '' : String(v); }

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles || { scorePop(){}, burstAt(){}, celebrate(){}, stamp(){} };

const WaterUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.WaterUI) ||
  ROOT.WaterUI || { ensure(){}, set(){}, zoneFrom(){ return 'BALANCED'; } };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI || { ensure(){}, set(){}, setShield(){} };

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function parseUrlCtx(){
  const u = new URL(ROOT.location.href);
  const p = u.searchParams;
  return {
    diff: (p.get('diff') || 'normal').toLowerCase(),
    time: Number(p.get('time') || '60') || 60,
    run : (p.get('run')  || 'play').toLowerCase(),
    seed: p.get('seed') || p.get('ts') || '',
    sessionId: p.get('sessionId') || '',
  };
}

function setCoach(text, mood='neutral'){
  emit('hha:coach', { text, mood });
}

function hitFlash(on){
  const el = $('hvr-hitflash');
  if (!el) return;
  el.classList.toggle('on', !!on);
}
function dangerVignette(on){
  const el = $('hvr-vignette');
  if (!el) return;
  el.classList.toggle('on', !!on);
}

function showEndSummary(summary){
  const end = $('hvr-end');
  if (!end) return;
  const sScore = $('hvr-end-score');
  const sCombo = $('hvr-end-combo');
  const sMiss  = $('hvr-end-miss');
  const sQuest = $('hvr-end-quest');
  const sRank  = $('hvr-rank');

  if (sScore) sScore.textContent = String(summary.scoreFinal || 0);
  if (sCombo) sCombo.textContent = String(summary.comboMax || 0);
  if (sMiss)  sMiss.textContent  = String(summary.misses || 0);
  if (sQuest) sQuest.textContent = `${summary.goalsCleared||0}/${summary.goalsTotal||0} • ${summary.miniCleared||0}/${summary.miniTotal||0}`;
  if (sRank)  sRank.textContent  = `RANK: ${summary.rank || 'A'}`;

  end.style.display = 'flex';
}

function makePlayfieldController(layerEl, boundsEl){
  // VR-feel: drag to translate playfield + subtle gyro
  const state = {
    x:0, y:0,
    vx:0, vy:0,
    dragging:false,
    lastX:0, lastY:0,
    gyroX:0, gyroY:0,
    enabled:true,
  };

  const maxShift = () => {
    const w = boundsEl ? boundsEl.clientWidth : (ROOT.innerWidth||1);
    const h = boundsEl ? boundsEl.clientHeight: (ROOT.innerHeight||1);
    return { mx: Math.max(18, w*0.10), my: Math.max(18, h*0.12) };
  };

  function apply(){
    if (!layerEl) return;
    const { mx, my } = maxShift();
    const tx = clamp(state.x + state.gyroX, -mx, mx);
    const ty = clamp(state.y + state.gyroY, -my, my);
    layerEl.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  }

  function onDown(e){
    if (!state.enabled) return;
    state.dragging = true;
    state.lastX = e.clientX || 0;
    state.lastY = e.clientY || 0;
  }
  function onMove(e){
    if (!state.enabled || !state.dragging) return;
    const x = e.clientX || 0;
    const y = e.clientY || 0;
    const dx = x - state.lastX;
    const dy = y - state.lastY;
    state.lastX = x; state.lastY = y;

    state.x += dx * 0.62;
    state.y += dy * 0.62;
    apply();
  }
  function onUp(){
    state.dragging = false;
  }

  // subtle gyro
  function onOri(ev){
    if (!state.enabled) return;
    const g = Number(ev.gamma)||0; // left-right
    const b = Number(ev.beta)||0;  // front-back
    // normalize & clamp
    const gx = clamp(g / 25, -1, 1);
    const gy = clamp((b - 10) / 30, -1, 1);
    const { mx, my } = maxShift();
    state.gyroX = gx * mx * 0.18;
    state.gyroY = gy * my * 0.18;
    apply();
  }

  boundsEl && boundsEl.addEventListener('pointerdown', onDown, { passive:true });
  boundsEl && boundsEl.addEventListener('pointermove', onMove, { passive:true });
  boundsEl && boundsEl.addEventListener('pointerup', onUp, { passive:true });
  boundsEl && boundsEl.addEventListener('pointercancel', onUp, { passive:true });
  boundsEl && boundsEl.addEventListener('pointerleave', onUp, { passive:true });

  try{ ROOT.addEventListener('deviceorientation', onOri, { passive:true }); }catch{}

  apply();

  return {
    setEnabled(v){ state.enabled = !!v; if (!v){ state.gyroX=state.gyroY=0; } apply(); },
    set(x,y){ state.x=x||0; state.y=y||0; apply(); }
  };
}

export async function bootHydration(opts = {}){
  const url = parseUrlCtx();

  const runMode = (opts.runMode || url.run || 'play').toLowerCase(); // play | research
  const difficulty = (opts.difficulty || url.diff || 'normal').toLowerCase();
  const duration = clamp((opts.duration ?? url.time ?? 60), 20, 180);

  const bounds = $('hvr-bounds');
  const layer  = $('hvr-layer');

  if (!bounds || !layer) {
    console.error('[Hydration] missing bounds/layer');
    return { stop(){} };
  }

  // ensure UI
  try{ WaterUI.ensure && WaterUI.ensure(); }catch{}
  try{ FeverUI.ensure && FeverUI.ensure(); }catch{}

  // playfield controller
  const playfield = makePlayfieldController(layer, bounds);

  // game state
  const sessionId = safeStr(url.sessionId || makeSessionId());
  const seed = safeStr(opts.seed || url.seed || '');

  let stopped = false;

  let score = 0;
  let combo = 0;
  let comboMax = 0;

  let misses = 0;

  // Hydration meter 0..1 (0=LOW, 0.5=BALANCED, 1=HIGH)
  let water = 0.50;

  // fever 0..1, shield on when fever=1 and active for some seconds
  let fever = 0;
  let shieldOn = false;
  let shieldUntil = 0;

  // timers
  let lastSecLeft = duration;
  let lastHitTs = 0;

  // mode policy
  const allowAdaptive = (runMode !== 'research'); // research strict
  const spreadUniform = true; // always want spread

  // pools
  const POOLS = {
    good: ['💧','🫧','💦','🥛','🍉'],
    bad:  ['🥤','🧋','🍟','🍩','🧃'],
    trick:['💧','💦'] // fake good skin (optional)
  };

  // powerups for hydration
  const POWERUPS = ['⭐','💎','🛡️'];

  // quest system
  const quest = createHydrationQuest({
    duration,
    onCoach: (text, mood) => setCoach(text, mood),
    onCelebrate: (kind, label) => {
      Particles.celebrate && Particles.celebrate(kind, label);
      Particles.stamp && Particles.stamp(label || 'CLEAR!');
    }
  });

  // logger: start marker
  emit('hha:log_session', {
    t: 'start',
    sessionId,
    game: 'hydration',
    mode: runMode,
    diff: difficulty,
    seed
  });

  // HUD initial
  emit('hha:score', { score, combo, comboMax, misses, waterPct: Math.round(water*100), feverPct: Math.round(fever*100), shield: shieldOn });
  emit('hha:time', { sec: lastSecLeft });
  setCoach('พร้อมลุย! เก็บน้ำให้สมดุล 💧', 'neutral');

  function setShield(on, ms=5200){
    shieldOn = !!on;
    if (shieldOn) {
      shieldUntil = now() + ms;
      emit('hha:log_event', { sessionId, game:'hydration', type:'shield_on', data:{ ms } });
    } else {
      emit('hha:log_event', { sessionId, game:'hydration', type:'shield_off', data:{} });
    }
    FeverUI.setShield && FeverUI.setShield(shieldOn);
    emit('hha:score', { score, combo, comboMax, misses, waterPct: Math.round(water*100), feverPct: Math.round(fever*100), shield: shieldOn });
  }

  function addFever(delta){
    fever = clamp01(fever + delta);
    if (fever >= 1 && !shieldOn) {
      setShield(true, 5200);
      setCoach('FEVER เต็ม! เปิดโล่ 5 วิ 🛡️🔥', 'fever');
      Particles.celebrate && Particles.celebrate('FEVER', 'FEVER!');
    }
    FeverUI.set && FeverUI.set(fever);
    emit('hha:fever', { pct: Math.round(fever*100), shield: shieldOn });
  }

  function setWater(next){
    water = clamp01(next);
    const pct = Math.round(water * 100);
    const zone = zoneFromPct(pct);
    WaterUI.set && WaterUI.set(pct, zone);
    emit('hha:score', { score, combo, comboMax, misses, waterPct: pct, waterZone: zone, feverPct: Math.round(fever*100), shield: shieldOn });
  }

  // grading / scoring flavor
  function scoreForHit(ctx){
    // perfect gets more
    const perfect = !!ctx.hitPerfect;
    const kind = safeStr(ctx.itemType || '');

    if (kind === 'power') {
      // map by emoji
      if (ctx.ch === '⭐') return perfect ? 220 : 160;
      if (ctx.ch === '💎') return perfect ? 260 : 190;
      if (ctx.ch === '🛡️') return perfect ? 180 : 130;
      return perfect ? 200 : 150;
    }

    if (kind === 'bad') return perfect ? -140 : -120;
    if (kind === 'fakeGood') return perfect ? 60 : 45;
    // good
    return perfect ? 120 : 85;
  }

  function updateCombo(isGood){
    if (isGood) {
      combo++;
      comboMax = Math.max(comboMax, combo);
      // fever grows faster at high combo
      addFever(0.03 + Math.min(0.05, combo * 0.002));
    } else {
      combo = 0;
      // small fever drop
      fever = clamp01(fever - 0.10);
      FeverUI.set && FeverUI.set(fever);
      emit('hha:fever', { pct: Math.round(fever*100), shield: shieldOn });
    }
  }

  function addMiss(reason='miss'){
    misses++;
    emit('hha:log_event', { sessionId, game:'hydration', type:reason, data:{} });
    emit('hha:score', { score, combo, comboMax, misses, waterPct: Math.round(water*100), feverPct: Math.round(fever*100), shield: shieldOn });
  }

  function onExpire(info){
    // expire good counts as miss; bad expire = ignore
    if (!info) return;
    if (info.isGood && (info.itemType === 'good' || info.itemType === 'fakeGood')) {
      addMiss('miss_expire');
      updateCombo(false);
      setCoach('ช้าไปนิด! ระวังน้ำหมด 💧', 'sad');
      setWater(water - 0.06);
      Particles.scorePop && Particles.scorePop(null, null, '-1', 'MISS');
      quest.onMiss && quest.onMiss({ type:'expire', item: info });
    }
  }

  function judge(ch, ctx){
    if (stopped) return { scoreDelta:0, good:true };
    lastHitTs = now();

    // shield timeout
    if (shieldOn && now() > shieldUntil) setShield(false);

    // classify
    const itemType = safeStr(ctx.itemType || 'good');
    const isBad = (itemType === 'bad');
    const isPower = (itemType === 'power');

    // handle power special
    if (isPower) {
      if (ch === '🛡️') {
        setShield(true, 5200);
        setCoach('รับโล่แล้ว! กันพลาดได้ชั่วคราว 🛡️', 'happy');
        Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'SHIELD');
        emit('hha:log_event', { sessionId, game:'hydration', type:'hit', data:{ kind:'shield', perfect:!!ctx.hitPerfect } });
        // score
        const sd = scoreForHit({ ...ctx, ch });
        score += sd;
        updateCombo(true);
        Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, `+${sd}`, 'POWER');
        hitFlash(true); setTimeout(()=>hitFlash(false), 90);
        quest.onHit && quest.onHit({ kind:'shield', perfect:!!ctx.hitPerfect });
        return { scoreDelta: sd, good:true };
      }

      if (ch === '⭐') {
        // score burst
        const sd = scoreForHit({ ...ctx, ch });
        score += sd;
        updateCombo(true);
        setWater(water + 0.08);
        Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'STAR');
        Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, `+${sd}`, 'STAR');
        setCoach('สุดยอด! โบนัสพลัง ⭐', 'happy');
        emit('hha:log_event', { sessionId, game:'hydration', type:'hit', data:{ kind:'gold', perfect:!!ctx.hitPerfect } });
        quest.onHit && quest.onHit({ kind:'star', perfect:!!ctx.hitPerfect });
        hitFlash(true); setTimeout(()=>hitFlash(false), 90);
        return { scoreDelta: sd, good:true };
      }

      if (ch === '💎') {
        // diamond = big score + water stabilize
        const sd = scoreForHit({ ...ctx, ch });
        score += sd;
        updateCombo(true);
        // pull water towards balanced
        const target = 0.5;
        setWater(water + (target - water) * 0.35);
        Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'DIAMOND');
        Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, `+${sd}`, 'DIAMOND');
        setCoach('เพชร! ดึงน้ำกลับสู่สมดุล 💎', 'happy');
        emit('hha:log_event', { sessionId, game:'hydration', type:'hit', data:{ kind:'diamond', perfect:!!ctx.hitPerfect } });
        quest.onHit && quest.onHit({ kind:'diamond', perfect:!!ctx.hitPerfect });
        hitFlash(true); setTimeout(()=>hitFlash(false), 90);
        return { scoreDelta: sd, good:true };
      }
    }

    // bad hit
    if (isBad) {
      if (shieldOn) {
        // blocked: no miss
        Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, 'BLOCK', 'SHIELD');
        Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'BLOCK');
        emit('hha:log_event', { sessionId, game:'hydration', type:'shield_block', data:{ kind:'junk' } });
        setCoach('โล่กันไว้! ดีมาก 🛡️', 'happy');
        // tiny fever drop only
        fever = clamp01(fever - 0.04);
        FeverUI.set && FeverUI.set(fever);
        hitFlash(true); setTimeout(()=>hitFlash(false), 80);
        quest.onBlock && quest.onBlock({ kind:'junk' });
        return { scoreDelta: 0, good:true };
      }

      const sd = scoreForHit(ctx);
      score += sd;
      updateCombo(false);
      addMiss('miss_junk');
      setWater(water - 0.10);
      setCoach('โอ๊ะ! เครื่องดื่มหวาน/ขยะ 😵‍💫', 'sad');
      Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'JUNK');
      Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, String(sd), 'JUNK');
      emit('hha:log_event', { sessionId, game:'hydration', type:'hit', data:{ kind:'junk', perfect:!!ctx.hitPerfect } });
      hitFlash(true); setTimeout(()=>hitFlash(false), 110);
      quest.onHit && quest.onHit({ kind:'junk', perfect:!!ctx.hitPerfect });
      return { scoreDelta: sd, good:false };
    }

    // good/fakeGood hit
    const sd = scoreForHit({ ...ctx, ch });
    score += sd;
    updateCombo(true);

    // water changes:
    // good raises, fakeGood smaller, and if too high -> warn
    if (itemType === 'fakeGood') setWater(water + 0.03);
    else setWater(water + 0.06);

    const pct = Math.round(water*100);
    const zone = zoneFromPct(pct);

    if (zone === 'HIGH') setCoach('น้ำเริ่มสูงไปนะ! ปรับให้สมดุล 💧⚖️', 'neutral');
    else if (zone === 'LOW') setCoach('น้ำใกล้หมด! รีบเก็บน้ำดี 💧', 'sad');
    else setCoach('ดีมาก! รักษาสมดุลไว้ 💧✨', 'happy');

    Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, ctx.hitPerfect ? 'PERFECT' : 'HIT');
    Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, `+${sd}`, ctx.hitPerfect ? 'PERFECT' : 'GOOD');

    emit('hha:log_event', { sessionId, game:'hydration', type:'hit', data:{ kind:(itemType==='fakeGood'?'fakeGood':'good'), perfect:!!ctx.hitPerfect } });

    hitFlash(true); setTimeout(()=>hitFlash(false), 90);

    quest.onHit && quest.onHit({ kind:(itemType==='fakeGood'?'fakeGood':'good'), perfect:!!ctx.hitPerfect });

    return { scoreDelta: sd, good:true };
  }

  // decorate target: add hover/float + emit spawn log + extra stamp ring
  function decorateTarget(el, parts, data){
    const kind =
      (data.itemType === 'bad') ? 'junk' :
      (data.itemType === 'power' && data.ch === '⭐') ? 'gold' :
      (data.itemType === 'power' && data.ch === '💎') ? 'diamond' :
      (data.itemType === 'power' && data.ch === '🛡️') ? 'shield' :
      (data.itemType === 'fakeGood') ? 'fakeGood' : 'good';

    emit('hha:log_event', { sessionId, game:'hydration', type:'spawn', data:{ kind } });

    // micro-float
    try{
      el.animate([
        { transform: 'translate(-50%, -50%) scale(1) translateY(0px)' },
        { transform: 'translate(-50%, -50%) scale(1.03) translateY(-6px)' },
        { transform: 'translate(-50%, -50%) scale(1) translateY(0px)' }
      ], {
        duration: 1100 + Math.random()*900,
        iterations: Infinity,
        easing: 'ease-in-out'
      });
    }catch{}
  }

  // difficulty knobs for hydration
  const diffTable = {
    easy:   { spawnInterval: 860, maxActive: 4, life: 2100, scale: 1.18 },
    normal: { spawnInterval: 780, maxActive: 5, life: 1900, scale: 1.00 },
    hard:   { spawnInterval: 650, maxActive: 6, life: 1700, scale: 0.92 },
  };

  // storm scaling by fever/combo (play only)
  function spawnMul(){
    if (runMode === 'research') return 1;
    const feverMul = 1 - (fever * 0.22);            // fever makes faster
    const comboMul = 1 - Math.min(0.18, combo * 0.004); // high combo => slightly faster
    return clamp(feverMul * comboMul, 0.55, 1.25);
  }

  // start spawner
  const engine = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,
    allowAdaptive,
    seed,

    // hosts
    spawnHost: layer,
    boundsHost: bounds,

    // EXCLUSION: HUD + end screen + crosshair already auto-collected in mode-factory,
    // but we keep it explicit for safety if you add new panels later.
    excludeSelectors: [
      '.hha-hud',
      '#hha-score-card',
      '#hha-water-header',
      '#hha-fever-card',
      '#hha-quest',
      '#hha-coach',
      '#hvr-end',
      '#hvr-crosshair'
    ],

    // pools
    pools: POOLS,
    goodRate: 0.68,
    powerups: POWERUPS,
    powerRate: 0.16,
    powerEvery: 6,

    // trick (fake good)
    trickRate: 0.08,

    // spread (แก้เป้าที่เดิม)
    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',
    minSeparation: 1.06,
    maxSpawnTries: 16,
    spawnRadiusX: 0.92,
    spawnRadiusY: 0.92,

    // life adapt by storm
    spawnIntervalMul: spawnMul,

    judge,
    onExpire,
    decorateTarget
  });

  // QUEST bind
  quest.bind({
    onQuestUpdate: (d) => emit('quest:update', d),
    onGoalClear: (d) => Particles.celebrate && Particles.celebrate('GOAL', d && d.title ? d.title : 'GOAL!'),
    onMiniClear: (d) => Particles.celebrate && Particles.celebrate('MINI', d && d.title ? d.title : 'MINI!'),
    onAllClear:  (d) => Particles.celebrate && Particles.celebrate('ALL', 'ALL CLEAR!')
  });

  // listen time ticks (from mode-factory)
  const onTime = (e)=>{
    if (stopped) return;
    const sec = (e && e.detail && typeof e.detail.sec === 'number') ? e.detail.sec : null;
    if (sec == null) return;
    lastSecLeft = sec;
    emit('hha:time', { sec });

    // danger cues
    if (sec <= 10) dangerVignette(true);
    else dangerVignette(false);

    if (sec === 10) {
      setCoach('ใกล้หมดเวลา! เร่งมืออีกนิด ⏱️', 'neutral');
      Particles.stamp && Particles.stamp('10s!');
    }
  };
  ROOT.addEventListener('hha:time', onTime);

  // low water warning cadence
  let lastWarnTs = 0;
  const warnLoop = ()=>{
    if (stopped) return;
    if (water <= 0.18 && now() - lastWarnTs > 1800){
      lastWarnTs = now();
      Particles.stamp && Particles.stamp('LOW!');
      setCoach('น้ำต่ำ! รีบเก็บน้ำดี 💧', 'sad');
    }
    ROOT.requestAnimationFrame(warnLoop);
  };
  ROOT.requestAnimationFrame(warnLoop);

  function endGame(reason='timeout'){
    if (stopped) return;
    stopped = true;

    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}

    try{ engine && engine.stop && engine.stop(); }catch{}
    try{ emit('hha:stop', { reason }); }catch{}

    const goals = quest.getGoalsState();
    const minis = quest.getMiniState();

    const rank = rankFromScore(score, misses, comboMax);

    const summary = {
      sessionId,
      game: 'hydration',
      mode: runMode,
      diff: difficulty,
      seed,

      scoreFinal: Math.round(score),
      comboMax: Math.round(comboMax),
      misses: Math.round(misses),

      goalsCleared: goals.cleared,
      goalsTotal: goals.total,
      miniCleared: minis.cleared,
      miniTotal: minis.total,

      // optional metrics
      waterEndPct: Math.round(water*100),
      feverEndPct: Math.round(fever*100),

      rank,
      reason
    };

    // emit end for HUD + logger
    emit('hha:end', summary);

    // show end overlay
    showEndSummary(summary);

    // final celebration
    Particles.celebrate && Particles.celebrate('END', `RANK ${rank}`);
    Particles.stamp && Particles.stamp(`RANK ${rank}`);

    return summary;
  }

  // If mode-factory stops by itself at time=0, we call end too.
  // We rely on our onTime handler (sec -> 0) to stop everything:
  const endWatcher = (e)=>{
    const sec = e && e.detail ? e.detail.sec : null;
    if (sec === 0) {
      ROOT.removeEventListener('hha:time', endWatcher);
      endGame('timeout');
    }
  };
  ROOT.addEventListener('hha:time', endWatcher);

  // Crosshair shoot on single tap (optional)
  bounds.addEventListener('click', (ev)=>{
    // if user clicks a target directly, target handler already consumes
    // this is for "tap-shoot" feeling at crosshair
    if (stopped) return;
    if (engine && engine.shootCrosshair && engine.shootCrosshair()){
      // tiny feedback
      hitFlash(true); setTimeout(()=>hitFlash(false), 60);
    }
  }, { passive:true });

  // expose API
  return {
    stop(){
      endGame('manual_stop');
    }
  };
}

export default { bootHydration };