// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — ULTIMATE ALL-IN PACK (SFX + BOSS + STORM)
// ✅ SFX: tick (10s), perfect ping, junk buzzer, stamp thump, boss warn
// ✅ BOSS: appears periodically, 3 HP, telegraph -> open window, perfect hit = extra dmg
// ✅ STORM: when fever>=60% or time<=12, screen shake + vignette pulse + spawn faster
// ✅ FULL-SPREAD spawn (แก้ “เป้าที่เดิม”): spawnAroundCrosshair:false + spawnStrategy:'grid9'
// ✅ Targets move with screen (VR-feel): drag + subtle gyro + storm jitter
// ✅ Water Gauge + Fever/Shield + HUD number ticker
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
    mute: (p.get('mute') === '1'),
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

/* =========================
   SFX (WebAudio) — no extra file
========================= */
function makeSFX(mute=false){
  let ctx = null;
  let master = null;
  let unlocked = false;

  function ensure(){
    if (mute) return null;
    if (ctx) return ctx;
    try{
      const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.14;
      master.connect(ctx.destination);
    }catch(_){ ctx = null; }
    return ctx;
  }

  async function unlock(){
    if (mute) return;
    const c = ensure();
    if (!c) return;
    try{
      if (c.state === 'suspended') await c.resume();
      unlocked = true;
    }catch(_){}
  }

  function tone(freq=440, dur=0.08, type='sine', vol=1.0){
    const c = ensure();
    if (!c || !master) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12 * vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur=0.10, vol=1.0){
    const c = ensure();
    if (!c || !master) return;
    const t0 = c.currentTime;

    const bufSize = Math.max(256, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0;i<bufSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufSize);

    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = 0.10 * vol;

    src.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  return {
    unlock,
    tick(){ tone(850, 0.05, 'square', 0.9); },
    tickHigh(){ tone(1020, 0.05, 'square', 1.0); },
    perfect(){ tone(1240, 0.06, 'triangle', 1.0); tone(1560, 0.07, 'triangle', 0.8); },
    good(){ tone(720, 0.05, 'triangle', 0.9); },
    power(){ tone(980, 0.06, 'sine', 1.0); tone(1310, 0.06, 'sine', 0.8); },
    buzzer(){ noiseBurst(0.10, 1.0); tone(180, 0.10, 'sawtooth', 0.7); },
    thump(){ tone(90, 0.08, 'sine', 1.1); tone(140, 0.06, 'sine', 0.7); },
    bossWarn(){ tone(420, 0.10, 'square', 1.0); tone(300, 0.12, 'square', 0.9); },
    bossHit(){ tone(560, 0.05, 'sawtooth', 0.9); },
    bossDown(){ tone(620, 0.10, 'triangle', 1.0); tone(820, 0.12, 'triangle', 0.9); tone(1040, 0.12, 'triangle', 0.8); },
  };
}

/* =========================
   Inject CSS: Boss + Storm
========================= */
function attachHydrationFxCss(){
  if (!DOC) return;
  if (DOC.getElementById('hvr-fx-css')) return;

  const st = DOC.createElement('style');
  st.id = 'hvr-fx-css';
  st.textContent = `
  /* Boss target */
  .hvr-boss{
    position:absolute;
    width: 92px;
    height: 92px;
    border-radius: 999px;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size: 40px;
    font-weight: 1000;
    transform: translate(-50%,-50%);
    background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.22), rgba(15,23,42,.55) 55%, rgba(2,6,23,.55));
    border: 2px solid rgba(226,232,240,.22);
    box-shadow: 0 18px 40px rgba(0,0,0,.45), inset 0 0 30px rgba(56,189,248,.12);
    pointer-events:auto;
    user-select:none;
    touch-action:none;
    z-index: 30;
  }
  .hvr-boss .hp{
    position:absolute;
    left:50%;
    top:-10px;
    transform:translate(-50%,-50%);
    padding:6px 10px;
    border-radius:999px;
    background: rgba(2,6,23,.55);
    border: 1px solid rgba(148,163,184,.22);
    font-size: 12px;
    font-weight: 1000;
    letter-spacing:.2px;
    color: rgba(226,232,240,.92);
    box-shadow: 0 14px 26px rgba(0,0,0,.35);
  }
  .hvr-boss.tele{
    border-color: rgba(244,63,94,.55);
    box-shadow: 0 18px 50px rgba(244,63,94,.14), 0 18px 40px rgba(0,0,0,.45), inset 0 0 34px rgba(244,63,94,.12);
    animation: bossPulse .55s ease-in-out infinite;
  }
  @keyframes bossPulse{
    0%{ transform: translate(-50%,-50%) scale(1.00); }
    50%{ transform: translate(-50%,-50%) scale(1.06); }
    100%{ transform: translate(-50%,-50%) scale(1.00); }
  }
  .hvr-boss.open{
    border-color: rgba(56,189,248,.55);
    box-shadow: 0 20px 55px rgba(56,189,248,.12), 0 18px 40px rgba(0,0,0,.45), inset 0 0 36px rgba(56,189,248,.14);
  }

  /* Storm */
  #hvr-bounds.hvr-storm{
    animation: stormShake .20s linear infinite;
  }
  @keyframes stormShake{
    0%{ transform: translate3d(0,0,0); }
    25%{ transform: translate3d(0.6px,-0.8px,0); }
    50%{ transform: translate3d(-0.7px,0.6px,0); }
    75%{ transform: translate3d(0.8px,0.4px,0); }
    100%{ transform: translate3d(0,0,0); }
  }
  /* pulse vignette stronger in storm */
  .danger-vignette.stormPulse{
    animation: vigPulse .55s ease-in-out infinite;
  }
  @keyframes vigPulse{
    0%{ box-shadow: inset 0 0 0 999px rgba(244,63,94,.03), inset 0 0 110px rgba(244,63,94,.12); }
    50%{ box-shadow: inset 0 0 0 999px rgba(244,63,94,.06), inset 0 0 150px rgba(244,63,94,.18); }
    100%{ box-shadow: inset 0 0 0 999px rgba(244,63,94,.03), inset 0 0 110px rgba(244,63,94,.12); }
  }
  `;
  DOC.head.appendChild(st);
}

/* =========================
   Playfield controller (drag + gyro + storm jitter)
========================= */
function makePlayfieldController(layerEl, boundsEl){
  const state = {
    x:0, y:0,
    dragging:false,
    lastX:0, lastY:0,
    gyroX:0, gyroY:0,
    enabled:true,
    storm:false,
    jitterX:0, jitterY:0,
    lastJitAt:0
  };

  const maxShift = () => {
    const w = boundsEl ? boundsEl.clientWidth : (ROOT.innerWidth||1);
    const h = boundsEl ? boundsEl.clientHeight: (ROOT.innerHeight||1);
    return { mx: Math.max(18, w*0.10), my: Math.max(18, h*0.12) };
  };

  function apply(){
    if (!layerEl) return;
    const { mx, my } = maxShift();

    // storm jitter
    if (state.storm){
      const t = now();
      if (!state.lastJitAt) state.lastJitAt = t;
      if ((t - state.lastJitAt) > 70){
        state.lastJitAt = t;
        state.jitterX = (Math.random()*2-1) * mx * 0.025;
        state.jitterY = (Math.random()*2-1) * my * 0.030;
      }
    } else {
      state.jitterX = 0;
      state.jitterY = 0;
    }

    const tx = clamp(state.x + state.gyroX + state.jitterX, -mx, mx);
    const ty = clamp(state.y + state.gyroY + state.jitterY, -my, my);
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
  function onUp(){ state.dragging = false; }

  function onOri(ev){
    if (!state.enabled) return;
    const g = Number(ev.gamma)||0;
    const b = Number(ev.beta)||0;
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
    setStorm(v){ state.storm = !!v; apply(); },
    set(x,y){ state.x=x||0; state.y=y||0; apply(); }
  };
}

/* =========================
   Boss spawner (independent DOM target)
========================= */
function rectIntersectsPoint(r, x, y, pad=0){
  return (x >= (r.left-pad) && x <= (r.right+pad) && y >= (r.top-pad) && y <= (r.bottom+pad));
}
function buildExclusionRects(boundsEl, selectors){
  const out = [];
  if (!DOC || !boundsEl) return out;
  const b = boundsEl.getBoundingClientRect();
  for (const sel of selectors || []){
    const el = DOC.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    // only consider if overlaps bounds
    if (r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom) continue;
    out.push(r);
  }
  return out;
}
function pickSafePoint(boundsEl, layerEl, excludeRects, size=92, tries=28){
  if (!boundsEl) return { x: (ROOT.innerWidth*0.5), y:(ROOT.innerHeight*0.52) };
  const b = boundsEl.getBoundingClientRect();
  const pad = 10;

  // safe band inside bounds
  const minX = b.left + pad + size*0.55;
  const maxX = b.right - pad - size*0.55;
  const minY = b.top  + pad + size*0.65;
  const maxY = b.bottom - pad - size*0.70;

  let best = null;
  let bestScore = -1;

  for (let i=0;i<tries;i++){
    const x = minX + Math.random()*(maxX-minX);
    const y = minY + Math.random()*(maxY-minY);

    // avoid excluded rects
    let bad = false;
    for (const r of excludeRects){
      if (rectIntersectsPoint(r, x, y, 20)){ bad = true; break; }
    }
    if (bad) continue;

    // prefer near center-ish but not too center (more fun)
    const cx = (b.left+b.right)*0.5;
    const cy = (b.top+b.bottom)*0.52;
    const dx = (x - cx) / (b.width||1);
    const dy = (y - cy) / (b.height||1);
    const score = 1.0 - (dx*dx + dy*dy); // higher better
    if (score > bestScore){
      bestScore = score;
      best = { x, y };
    }
  }

  if (!best) best = { x:(b.left+b.right)*0.5, y:(b.top+b.bottom)*0.52 };

  // convert viewport -> layer local
  // (layer is full-size inside bounds, so local = viewport - bounds.top-left)
  const localX = best.x - b.left;
  const localY = best.y - b.top;
  return { x: localX, y: localY };
}

/* =========================
   Main
========================= */
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

  attachHydrationFxCss();

  // ensure UI
  try{ WaterUI.ensure && WaterUI.ensure(); }catch{}
  try{ FeverUI.ensure && FeverUI.ensure(); }catch{}

  const sfx = makeSFX(url.mute || false);

  // unlock audio on first user gesture inside bounds
  const unlockOnce = ()=>{
    sfx.unlock && sfx.unlock();
    bounds.removeEventListener('pointerdown', unlockOnce);
    bounds.removeEventListener('touchstart', unlockOnce);
    bounds.removeEventListener('mousedown', unlockOnce);
  };
  bounds.addEventListener('pointerdown', unlockOnce, { passive:true });
  bounds.addEventListener('touchstart', unlockOnce, { passive:true });
  bounds.addEventListener('mousedown', unlockOnce, { passive:true });

  // playfield controller
  const playfield = makePlayfieldController(layer, bounds);

  // state
  const sessionId = safeStr(url.sessionId || makeSessionId());
  const seed = safeStr(opts.seed || url.seed || '');

  let stopped = false;

  let score = 0;
  let combo = 0;
  let comboMax = 0;

  let misses = 0;

  let water = 0.50; // 0..1
  let fever = 0;    // 0..1
  let shieldOn = false;
  let shieldUntil = 0;

  let lastSecLeft = duration;
  let lastTickSec = null;

  // storm
  let stormOn = false;

  function setStorm(on){
    on = !!on;
    if (stormOn === on) return;
    stormOn = on;

    bounds.classList.toggle('hvr-storm', stormOn);
    const vig = $('hvr-vignette');
    if (vig) vig.classList.toggle('stormPulse', stormOn);

    playfield.setStorm && playfield.setStorm(stormOn);

    if (stormOn){
      sfx.thump && sfx.thump();
      Particles.stamp && Particles.stamp('STORM!');
      setCoach('STORM! Fever สูง/ใกล้หมดเวลา — มือไวเข้า! 🌪️', 'fever');
      emit('hha:log_event', { sessionId, game:'hydration', type:'storm_on', data:{} });
    } else {
      emit('hha:log_event', { sessionId, game:'hydration', type:'storm_off', data:{} });
    }
  }

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
      sfx.power && sfx.power();
      sfx.thump && sfx.thump();
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
    return zone;
  }

  function updateCombo(isGood){
    if (isGood) {
      combo++;
      comboMax = Math.max(comboMax, combo);
      addFever(0.03 + Math.min(0.05, combo * 0.002));
    } else {
      combo = 0;
      fever = clamp01(fever - 0.10);
      FeverUI.set && FeverUI.set(fever);
      emit('hha:fever', { pct: Math.round(fever*100), shield: shieldOn });
    }
  }

  function scoreForHit(ctx){
    const perfect = !!ctx.hitPerfect;
    const kind = safeStr(ctx.itemType || '');

    if (kind === 'boss'){
      return perfect ? 320 : 220;
    }
    if (kind === 'power') {
      if (ctx.ch === '⭐') return perfect ? 220 : 160;
      if (ctx.ch === '💎') return perfect ? 260 : 190;
      if (ctx.ch === '🛡️') return perfect ? 180 : 130;
      return perfect ? 200 : 150;
    }
    if (kind === 'bad') return perfect ? -140 : -120;
    if (kind === 'fakeGood') return perfect ? 60 : 45;
    return perfect ? 120 : 85;
  }

  function addMiss(reason='miss'){
    misses++;
    emit('hha:log_event', { sessionId, game:'hydration', type:reason, data:{} });
    emit('hha:score', { score, combo, comboMax, misses, waterPct: Math.round(water*100), feverPct: Math.round(fever*100), shield: shieldOn });
  }

  // QUEST
  const quest = createHydrationQuest({
    duration,
    onCoach: (text, mood) => setCoach(text, mood),
    onCelebrate: (kind, label) => {
      Particles.celebrate && Particles.celebrate(kind, label);
      Particles.stamp && Particles.stamp(label || 'CLEAR!');
      sfx.thump && sfx.thump();
    }
  });

  quest.bind({
    onQuestUpdate: (d) => emit('quest:update', d),
    onGoalClear: (d) => Particles.celebrate && Particles.celebrate('GOAL', d && d.title ? d.title : 'GOAL!'),
    onMiniClear: (d) => Particles.celebrate && Particles.celebrate('MINI', d && d.title ? d.title : 'MINI!'),
    onAllClear:  ()  => Particles.celebrate && Particles.celebrate('ALL', 'ALL CLEAR!')
  });

  // logger: start
  emit('hha:log_session', {
    t: 'start',
    sessionId,
    game: 'hydration',
    mode: runMode,
    diff: difficulty,
    seed
  });

  // HUD init
  emit('hha:score', { score, combo, comboMax, misses, waterPct: Math.round(water*100), feverPct: Math.round(fever*100), shield: shieldOn });
  emit('hha:time', { sec: lastSecLeft });
  setCoach('พร้อมลุย! เก็บน้ำให้สมดุล 💧', 'neutral');

  /* ===== Boss system ===== */
  const boss = {
    el: null,
    hp: 0,
    phase: 'none', // none|tele|open
    teleAt: 0,
    openAt: 0,
    openUntil: 0,
    nextAt: 0,
    lastSpawnAt: 0
  };

  const excludeSelectorsForBoss = [
    '.hha-hud',
    '#hha-score-card',
    '#hha-water-header',
    '#hha-fever-card',
    '#hha-quest',
    '#hha-coach',
    '#hvr-end',
    '#hvr-crosshair'
  ];

  function bossRemove(){
    if (boss.el){
      try{ boss.el.remove(); }catch{}
    }
    boss.el = null;
    boss.hp = 0;
    boss.phase = 'none';
    boss.teleAt = boss.openAt = boss.openUntil = 0;
  }

  function bossSetHP(n){
    boss.hp = Math.max(0, n|0);
    if (!boss.el) return;
    const hpEl = boss.el.querySelector('.hp');
    if (hpEl) hpEl.textContent = `BOSS HP ${boss.hp}`;
  }

  function shouldSpawnBoss(){
    if (stopped) return false;
    if (lastSecLeft <= 8) return false;
    if (boss.el) return false;

    const t = now();
    if (!boss.nextAt) boss.nextAt = t + 10500;

    if (t >= boss.nextAt) return true;
    return false;
  }

  function scheduleNextBoss(){
    const t = now();
    // base every ~12s, storm/fever makes it faster in play mode
    const feverFast = (runMode === 'research') ? 1 : (1 - Math.min(0.35, fever * 0.35));
    const stormFast = stormOn ? 0.78 : 1.0;
    const base = 12000;
    boss.nextAt = t + base * feverFast * stormFast + (Math.random()*1600 - 800);
  }

  function bossSpawn(){
    if (boss.el) return;

    const rects = buildExclusionRects(bounds, excludeSelectorsForBoss);
    const pt = pickSafePoint(bounds, layer, rects, 92, 28);

    const el = DOC.createElement('div');
    el.className = 'hvr-boss tele';
    el.style.left = pt.x + 'px';
    el.style.top  = pt.y + 'px';

    el.innerHTML = `
      <div class="hp">BOSS HP 3</div>
      <div class="face">🥤👑</div>
    `;

    // click handler
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if (stopped) return;
      if (!boss.el) return;

      // shield timeout
      if (shieldOn && now() > shieldUntil) setShield(false);

      // only hittable in open
      if (boss.phase !== 'open'){
        sfx.buzzer && sfx.buzzer();
        Particles.scorePop && Particles.scorePop(ev.clientX, ev.clientY, 'TOO EARLY', 'BOSS');
        return;
      }

      const t = now();
      const r = boss.el.getBoundingClientRect();
      const cx = (r.left + r.right)*0.5;
      const cy = (r.top + r.bottom)*0.5;
      const dx = (ev.clientX - cx);
      const dy = (ev.clientY - cy);
      const dist = Math.sqrt(dx*dx + dy*dy);

      // PERFECT window: first 240ms after open OR close to center
      const perfect = ((t - boss.openAt) <= 240) || (dist <= 16);

      // damage
      const dmg = perfect ? 2 : 1;
      bossSetHP(boss.hp - dmg);

      // score + feedback
      const sd = scoreForHit({ itemType:'boss', hitPerfect: perfect });
      score += sd;
      updateCombo(true);
      emit('hha:score', { score, combo, comboMax, misses, waterPct: Math.round(water*100), feverPct: Math.round(fever*100), shield: shieldOn });

      sfx.bossHit && sfx.bossHit();
      if (perfect) sfx.perfect && sfx.perfect();

      Particles.burstAt && Particles.burstAt(ev.clientX, ev.clientY, perfect ? 'PERFECT' : 'HIT');
      Particles.scorePop && Particles.scorePop(ev.clientX, ev.clientY, `+${sd}`, perfect ? 'BOSS PERFECT' : 'BOSS');

      emit('hha:log_event', { sessionId, game:'hydration', type:'boss_hit', data:{ perfect, dmg, hp: boss.hp } });

      if (boss.hp <= 0){
        // boss down: reward
        sfx.bossDown && sfx.bossDown();
        Particles.celebrate && Particles.celebrate('BOSS', 'BOSS DOWN!');
        Particles.stamp && Particles.stamp('BOSS DOWN!');
        sfx.thump && sfx.thump();

        // reward: stabilize water toward balanced + fever bonus
        const target = 0.5;
        setWater(water + (target - water) * 0.45);
        addFever(0.20);

        setCoach('บอสล้ม! เก่งมาก 💥🥤👑', 'happy');
        emit('hha:log_event', { sessionId, game:'hydration', type:'boss_down', data:{} });

        bossRemove();
        scheduleNextBoss();
      } else {
        // shake boss a bit
        try{
          boss.el.animate([
            { transform:'translate(-50%,-50%) scale(1.00)' },
            { transform:'translate(-50%,-50%) scale(1.06)' },
            { transform:'translate(-50%,-50%) scale(1.00)' }
          ], { duration: 180, easing:'ease-out' });
        }catch{}
      }
    }, { passive:false });

    layer.appendChild(el);

    boss.el = el;
    bossSetHP(3);
    boss.phase = 'tele';
    boss.teleAt = now();
    boss.lastSpawnAt = boss.teleAt;

    // telegraph -> open
    setCoach('⚠️ บอสเครื่องดื่มหวานมาแล้ว! รอจังหวะแล้วกด!', 'sad');
    sfx.bossWarn && sfx.bossWarn();
    Particles.stamp && Particles.stamp('BOSS!');
    sfx.thump && sfx.thump();

    emit('hha:log_event', { sessionId, game:'hydration', type:'boss_spawn', data:{} });

    ROOT.setTimeout(()=>{
      if (!boss.el || stopped) return;
      boss.phase = 'open';
      boss.openAt = now();
      boss.openUntil = boss.openAt + 3600; // open window
      boss.el.classList.remove('tele');
      boss.el.classList.add('open');

      setCoach('ยิงบอสตอนนี้! (PERFECT = แรงขึ้น) 🎯', 'neutral');
      sfx.tickHigh && sfx.tickHigh();
    }, 620);
  }

  function bossUpdate(){
    if (!boss.el) return;

    // timeout / punish
    if (boss.phase === 'open' && now() >= boss.openUntil){
      // shield can block one boss punish
      if (shieldOn){
        setCoach('โล่ช่วยกันโทษบอสไว้! 🛡️', 'happy');
        setShield(false);
        Particles.scorePop && Particles.scorePop(null, null, 'BLOCK', 'BOSS');
        emit('hha:log_event', { sessionId, game:'hydration', type:'boss_fail_blocked', data:{} });
      } else {
        addMiss('boss_fail');
        updateCombo(false);
        setWater(water - 0.12);
        sfx.buzzer && sfx.buzzer();
        Particles.stamp && Particles.stamp('BOSS FAIL!');
        setCoach('โดนบอสลงโทษ! ระวังน้ำตก 💥', 'sad');
        emit('hha:log_event', { sessionId, game:'hydration', type:'boss_fail', data:{} });
      }

      bossRemove();
      scheduleNextBoss();
    }
  }

  /* ===== Core judge / expire ===== */
  function onExpire(info){
    if (!info) return;
    if (info.isGood && (info.itemType === 'good' || info.itemType === 'fakeGood')) {
      addMiss('miss_expire');
      updateCombo(false);
      setCoach('ช้าไปนิด! ระวังน้ำหมด 💧', 'sad');
      setWater(water - 0.06);
      Particles.scorePop && Particles.scorePop(null, null, '-1', 'MISS');
      sfx.buzzer && sfx.buzzer();
      quest.onMiss && quest.onMiss({ type:'expire', item: info });
    }
  }

  function judge(ch, ctx){
    if (stopped) return { scoreDelta:0, good:true };

    if (shieldOn && now() > shieldUntil) setShield(false);

    const itemType = safeStr(ctx.itemType || 'good');
    const isBad = (itemType === 'bad');
    const isPower = (itemType === 'power');

    // powerups
    if (isPower) {
      if (ch === '🛡️') {
        setShield(true, 5200);
        setCoach('รับโล่แล้ว! กันพลาดได้ชั่วคราว 🛡️', 'happy');
        Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'SHIELD');
        emit('hha:log_event', { sessionId, game:'hydration', type:'hit', data:{ kind:'shield', perfect:!!ctx.hitPerfect } });

        const sd = scoreForHit({ ...ctx, ch });
        score += sd;
        updateCombo(true);
        Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, `+${sd}`, 'POWER');
        hitFlash(true); setTimeout(()=>hitFlash(false), 90);
        sfx.power && sfx.power();

        quest.onHit && quest.onHit({ kind:'shield', perfect:!!ctx.hitPerfect, comboMax });
        return { scoreDelta: sd, good:true };
      }

      if (ch === '⭐') {
        const sd = scoreForHit({ ...ctx, ch });
        score += sd;
        updateCombo(true);
        setWater(water + 0.08);
        Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'STAR');
        Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, `+${sd}`, 'STAR');
        setCoach('สุดยอด! โบนัสพลัง ⭐', 'happy');
        emit('hha:log_event', { sessionId, game:'hydration', type:'hit', data:{ kind:'gold', perfect:!!ctx.hitPerfect } });
        sfx.power && sfx.power();
        hitFlash(true); setTimeout(()=>hitFlash(false), 90);

        quest.onHit && quest.onHit({ kind:'star', perfect:!!ctx.hitPerfect, comboMax });
        return { scoreDelta: sd, good:true };
      }

      if (ch === '💎') {
        const sd = scoreForHit({ ...ctx, ch });
        score += sd;
        updateCombo(true);
        const target = 0.5;
        setWater(water + (target - water) * 0.35);
        Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'DIAMOND');
        Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, `+${sd}`, 'DIAMOND');
        setCoach('เพชร! ดึงน้ำกลับสู่สมดุล 💎', 'happy');
        emit('hha:log_event', { sessionId, game:'hydration', type:'hit', data:{ kind:'diamond', perfect:!!ctx.hitPerfect } });
        sfx.power && sfx.power();
        hitFlash(true); setTimeout(()=>hitFlash(false), 90);

        quest.onHit && quest.onHit({ kind:'diamond', perfect:!!ctx.hitPerfect, comboMax });
        return { scoreDelta: sd, good:true };
      }
    }

    // junk
    if (isBad) {
      if (shieldOn) {
        Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, 'BLOCK', 'SHIELD');
        Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'BLOCK');
        emit('hha:log_event', { sessionId, game:'hydration', type:'shield_block', data:{ kind:'junk' } });
        setCoach('โล่กันไว้! ดีมาก 🛡️', 'happy');
        fever = clamp01(fever - 0.04);
        FeverUI.set && FeverUI.set(fever);
        hitFlash(true); setTimeout(()=>hitFlash(false), 80);
        sfx.good && sfx.good();

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
      sfx.buzzer && sfx.buzzer();

      quest.onHit && quest.onHit({ kind:'junk', perfect:!!ctx.hitPerfect, comboMax });
      quest.onMiss && quest.onMiss({ type:'junk' });
      return { scoreDelta: sd, good:false };
    }

    // good / fakeGood
    const sd = scoreForHit({ ...ctx, ch });
    score += sd;
    updateCombo(true);

    const beforeZone = zoneFromPct(Math.round(water*100));
    let zone = 'BALANCED';

    if (itemType === 'fakeGood') zone = setWater(water + 0.03);
    else zone = setWater(water + 0.06);

    if (zone === 'HIGH') setCoach('น้ำเริ่มสูงไปนะ! ปรับให้สมดุล 💧⚖️', 'neutral');
    else if (zone === 'LOW') setCoach('น้ำใกล้หมด! รีบเก็บน้ำดี 💧', 'sad');
    else setCoach('ดีมาก! รักษาสมดุลไว้ 💧✨', 'happy');

    Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, ctx.hitPerfect ? 'PERFECT' : 'HIT');
    Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, `+${sd}`, ctx.hitPerfect ? 'PERFECT' : 'GOOD');
    emit('hha:log_event', { sessionId, game:'hydration', type:'hit', data:{ kind:(itemType==='fakeGood'?'fakeGood':'good'), perfect:!!ctx.hitPerfect } });

    hitFlash(true); setTimeout(()=>hitFlash(false), 90);

    // SFX
    if (ctx.hitPerfect) sfx.perfect && sfx.perfect();
    else sfx.good && sfx.good();

    // Quest signals:
    // - g1: count when hit makes you BALANCED
    // - g2: track comboMax
    const zoneBalanced = (zone === 'BALANCED');
    quest.onHit && quest.onHit({
      kind:(itemType==='fakeGood'?'fakeGood':'good'),
      perfect:!!ctx.hitPerfect,
      zoneBalanced,
      comboMax
    });

    // tiny reward for returning to balanced from low/high (extra hype)
    if (zoneBalanced && beforeZone !== 'BALANCED'){
      Particles.stamp && Particles.stamp('BALANCED!');
      sfx.thump && sfx.thump();
    }

    return { scoreDelta: sd, good:true };
  }

  function decorateTarget(el, parts, data){
    const kind =
      (data.itemType === 'bad') ? 'junk' :
      (data.itemType === 'power' && data.ch === '⭐') ? 'gold' :
      (data.itemType === 'power' && data.ch === '💎') ? 'diamond' :
      (data.itemType === 'power' && data.ch === '🛡️') ? 'shield' :
      (data.itemType === 'fakeGood') ? 'fakeGood' : 'good';

    emit('hha:log_event', { sessionId, game:'hydration', type:'spawn', data:{ kind } });

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

  // spawn speed multiplier (storm makes faster)
  function spawnMul(){
    if (runMode === 'research') return 1;
    const feverMul = 1 - (fever * 0.22);
    const comboMul = 1 - Math.min(0.18, combo * 0.004);
    const stormMul = stormOn ? 0.78 : 1.0;
    return clamp(feverMul * comboMul * stormMul, 0.50, 1.25);
  }

  const engine = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,
    allowAdaptive: (runMode !== 'research'),
    seed,

    spawnHost: layer,
    boundsHost: bounds,

    excludeSelectors: excludeSelectorsForBoss,

    pools: {
      good: ['💧','🫧','💦','🥛','🍉'],
      bad:  ['🥤','🧋','🍟','🍩','🧃'],
      trick:['💧','💦']
    },

    goodRate: 0.68,
    powerups: ['⭐','💎','🛡️'],
    powerRate: 0.16,
    powerEvery: 6,
    trickRate: 0.08,

    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',
    minSeparation: 1.06,
    maxSpawnTries: 16,
    spawnRadiusX: 0.92,
    spawnRadiusY: 0.92,

    spawnIntervalMul: spawnMul,

    judge,
    onExpire,
    decorateTarget
  });

  /* ===== Time + Storm + Tick SFX ===== */
  const onTime = (e)=>{
    if (stopped) return;
    const sec = (e && e.detail && typeof e.detail.sec === 'number') ? e.detail.sec : null;
    if (sec == null) return;

    lastSecLeft = sec;
    emit('hha:time', { sec });

    // danger vignette
    dangerVignette(sec <= 10);

    // tick sound (once per second)
    if (sec <= 10){
      if (lastTickSec !== sec){
        lastTickSec = sec;
        if (sec <= 3) sfx.tickHigh && sfx.tickHigh();
        else sfx.tick && sfx.tick();
      }
    } else {
      lastTickSec = null;
    }

    // STORM on: fever>=60% OR time<=12 (play only)
    if (runMode !== 'research'){
      const wantStorm = (fever >= 0.60) || (sec <= 12);
      setStorm(wantStorm);
    } else {
      setStorm(false);
    }

    if (sec === 10){
      setCoach('ใกล้หมดเวลา! เร่งมืออีกนิด ⏱️', 'neutral');
      Particles.stamp && Particles.stamp('10s!');
      sfx.thump && sfx.thump();
    }
  };
  ROOT.addEventListener('hha:time', onTime);

  /* ===== Main RAF loop: warnings + quest timer + boss update/spawn ===== */
  let lastWarnAt = 0;
  const rafLoop = ()=>{
    if (stopped) return;

    // shield timeout
    if (shieldOn && now() > shieldUntil) setShield(false);

    // water warning cadence
    const t = now();
    if (water <= 0.18 && (t - lastWarnAt) > 1800){
      lastWarnAt = t;
      Particles.stamp && Particles.stamp('LOW!');
      setCoach('น้ำต่ำ! รีบเก็บน้ำดี 💧', 'sad');
      sfx.buzzer && sfx.buzzer();
    }

    // quest update (for time-based minis)
    try{ quest.update && quest.update(t); }catch{}

    // boss lifecycle
    bossUpdate();
    if (shouldSpawnBoss()){
      bossSpawn();
      scheduleNextBoss();
    }

    ROOT.requestAnimationFrame(rafLoop);
  };
  ROOT.requestAnimationFrame(rafLoop);

  function endGame(reason='timeout'){
    if (stopped) return;
    stopped = true;

    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
    try{ engine && engine.stop && engine.stop(); }catch{}
    try{ bossRemove(); }catch{}

    setStorm(false);

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

      waterEndPct: Math.round(water*100),
      feverEndPct: Math.round(fever*100),

      rank,
      reason
    };

    emit('hha:end', summary);

    showEndSummary(summary);

    Particles.celebrate && Particles.celebrate('END', `RANK ${rank}`);
    Particles.stamp && Particles.stamp(`RANK ${rank}`);
    sfx.thump && sfx.thump();

    return summary;
  }

  // If mode-factory emits time 0 => end
  const endWatcher = (e)=>{
    const sec = e && e.detail ? e.detail.sec : null;
    if (sec === 0) {
      ROOT.removeEventListener('hha:time', endWatcher);
      endGame('timeout');
    }
  };
  ROOT.addEventListener('hha:time', endWatcher);

  // crosshair shoot (optional)
  bounds.addEventListener('click', (ev)=>{
    if (stopped) return;
    // boss consumes pointerdown; this click is for empty-space shoot
    if (engine && engine.shootCrosshair && engine.shootCrosshair()){
      hitFlash(true); setTimeout(()=>hitFlash(false), 60);
    }
  }, { passive:true });

  // make sure next boss is scheduled
  scheduleNextBoss();

  return {
    stop(){
      endGame('manual_stop');
    }
  };
}

export default { bootHydration };