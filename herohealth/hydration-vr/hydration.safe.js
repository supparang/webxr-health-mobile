// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — ULTIMATE ALL-IN (A+B)
// ✅ A) Boss LASER (ต้องลากจอหลบ) — telegraph -> fire -> hit test at crosshair
// ✅ B) Boss Phase2 Split (HP เหลือ 1 => แยกร่าง 2 ตัว วิ่งเร็วขึ้น)
// ✅ FIX: ไม่ emit 'hha:time' ซ้ำใน listener (กัน recursion)
// ✅ FULL-SPREAD spawn (แก้ “เป้าที่เดิม”): spawnAroundCrosshair:false + spawnStrategy:'grid9'
// ✅ Storm: fever>=60% หรือ time<=12 => shake + vignette pulse + spawn faster + laser faster
// ✅ SFX: tick 10s, perfect ping, buzzer, stamp thump, boss warn
// ✅ Quest + Logger + HUD (ตามชุดไฟล์ล่าสุดของคุณ)

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
   SFX (WebAudio)
========================= */
function makeSFX(mute=false){
  let ctx = null;
  let master = null;

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
    laserWarn(){ tone(740, 0.06, 'square', 0.85); tone(920, 0.06, 'square', 0.85); },
    laserZap(){ noiseBurst(0.06, 0.9); tone(260, 0.08, 'sawtooth', 0.75); }
  };
}

/* =========================
   Inject CSS: Boss + Storm + Laser
========================= */
function attachHydrationFxCss(){
  if (!DOC) return;
  if (DOC.getElementById('hvr-fx-css')) return;

  const st = DOC.createElement('style');
  st.id = 'hvr-fx-css';
  st.textContent = `
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
  .hvr-boss.move{
    transition: left .22s ease-out, top .22s ease-out;
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
    pointer-events:none;
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

  /* Laser */
  .hvr-beam{
    position:absolute;
    left:0; top:0;
    transform-origin: center center;
    pointer-events:none;
    z-index: 28;
    filter: drop-shadow(0 10px 20px rgba(0,0,0,.35));
  }
  .hvr-beam .core{
    width:100%;
    height:100%;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(244,63,94,.05), rgba(244,63,94,.22), rgba(244,63,94,.05));
  }
  .hvr-beam.tele{
    opacity:.55;
    outline: 2px dashed rgba(244,63,94,.40);
    outline-offset: 6px;
  }
  .hvr-beam.fire{
    opacity:.95;
    box-shadow: 0 0 0 2px rgba(244,63,94,.18), 0 0 32px rgba(244,63,94,.18);
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
   + expose current offset for laser hit-test
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
    lastJitAt:0,
    appliedX:0, appliedY:0
  };

  const maxShift = () => {
    const w = boundsEl ? boundsEl.clientWidth : (ROOT.innerWidth||1);
    const h = boundsEl ? boundsEl.clientHeight: (ROOT.innerHeight||1);
    return { mx: Math.max(18, w*0.10), my: Math.max(18, h*0.12) };
  };

  function apply(){
    if (!layerEl) return;
    const { mx, my } = maxShift();

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
    state.appliedX = tx;
    state.appliedY = ty;

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
    set(x,y){ state.x=x||0; state.y=y||0; apply(); },
    getOffset(){ return { x: state.appliedX || 0, y: state.appliedY || 0 }; }
  };
}

/* =========================
   Boss helpers
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
    if (r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom) continue;
    out.push(r);
  }
  return out;
}
function pickSafePoint(boundsEl, excludeRects, size=92, tries=28){
  if (!boundsEl) return { x: (ROOT.innerWidth*0.5), y:(ROOT.innerHeight*0.52) };
  const b = boundsEl.getBoundingClientRect();
  const pad = 10;

  const minX = b.left + pad + size*0.55;
  const maxX = b.right - pad - size*0.55;
  const minY = b.top  + pad + size*0.65;
  const maxY = b.bottom - pad - size*0.70;

  let best = null;
  let bestScore = -1;

  for (let i=0;i<tries;i++){
    const x = minX + Math.random()*(maxX-minX);
    const y = minY + Math.random()*(maxY-minY);

    let bad = false;
    for (const r of excludeRects){
      if (rectIntersectsPoint(r, x, y, 22)){ bad = true; break; }
    }
    if (bad) continue;

    const cx = (b.left+b.right)*0.5;
    const cy = (b.top+b.bottom)*0.52;
    const dx = (x - cx) / (b.width||1);
    const dy = (y - cy) / (b.height||1);
    const score = 1.0 - (dx*dx + dy*dy);
    if (score > bestScore){
      bestScore = score;
      best = { x, y };
    }
  }

  if (!best) best = { x:(b.left+b.right)*0.5, y:(b.top+b.bottom)*0.52 };

  // convert viewport -> bounds local
  const localX = best.x - b.left;
  const localY = best.y - b.top;
  return { x: localX, y: localY };
}

function rotatePoint(px, py, ang){
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: px*c - py*s, y: px*s + py*c };
}

/* =========================
   Main
========================= */
export async function bootHydration(opts = {}){
  const url = parseUrlCtx();

  const runMode = (opts.runMode || url.run || 'play').toLowerCase();
  const difficulty = (opts.difficulty || url.diff || 'normal').toLowerCase();
  const duration = clamp((opts.duration ?? url.time ?? 60), 20, 180);

  const bounds = $('hvr-bounds');
  const layer  = $('hvr-layer');

  if (!bounds || !layer) {
    console.error('[Hydration] missing bounds/layer');
    return { stop(){} };
  }

  attachHydrationFxCss();

  try{ WaterUI.ensure && WaterUI.ensure(); }catch{}
  try{ FeverUI.ensure && FeverUI.ensure(); }catch{}

  const sfx = makeSFX(url.mute || false);

  // unlock audio on first user gesture
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

  // ===== state =====
  const sessionId = safeStr(url.sessionId || makeSessionId());
  const seed = safeStr(opts.seed || url.seed || '');

  let stopped = false;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  let water = 0.50;
  let fever = 0;
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
      setCoach('STORM! Fever สูง/ใกล้หมดเวลา — มือไว+ลากหนีลำแสง! 🌪️', 'fever');
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

  // ===== QUEST =====
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

  // ===== Logger: start =====
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
  // NOTE: emit time once BEFORE listener to avoid recursion risk
  emit('hha:time', { sec: lastSecLeft });

  setCoach('พร้อมลุย! เก็บน้ำให้สมดุล 💧', 'neutral');

  /* =========================
     Crosshair local point (for laser hit-test)
  ========================= */
  function getCrosshairBoundsLocal(){
    const w = bounds.clientWidth || (ROOT.innerWidth||1);
    const h = bounds.clientHeight || (ROOT.innerHeight||1);
    return { x: w * 0.50, y: h * 0.52 };
  }
  function getCrosshairLayerLocal(){
    const p = getCrosshairBoundsLocal();
    const off = playfield.getOffset ? playfield.getOffset() : { x:0, y:0 };
    // layer moved by translate(off.x, off.y), so invert to compare with layer-local objects
    return { x: p.x - off.x, y: p.y - off.y };
  }

  /* =========================
     Boss system (Phase 1 + Phase 2 split)
  ========================= */
  const excludeSelectorsForBoss = [
    '.hha-hud', '#hha-score-card', '#hha-water-header', '#hha-fever-card',
    '#hha-quest', '#hha-coach', '#hvr-end', '#hvr-crosshair'
  ];

  const boss = {
    mode: 'none',   // none | single | split
    el: null,
    hp: 0,
    phase: 'none',  // none|tele|open
    teleAt: 0,
    openAt: 0,
    openUntil: 0,

    minis: [],      // [{el,hp,openUntil,alive:true,kind:'mini1'}...]
    lastMoveAt: 0,

    nextAt: 0
  };

  function bossHasAny(){
    if (boss.mode === 'single') return !!boss.el;
    if (boss.mode === 'split') return boss.minis.some(m=>m && m.alive && m.el);
    return false;
  }

  function bossRemoveAll(){
    if (boss.el){ try{ boss.el.remove(); }catch{} }
    boss.el = null;
    boss.hp = 0;
    boss.phase = 'none';
    boss.teleAt = boss.openAt = boss.openUntil = 0;

    boss.minis.forEach(m=>{ if (m && m.el) { try{ m.el.remove(); }catch{} } });
    boss.minis = [];
    boss.mode = 'none';
  }

  function bossSetHP(n){
    boss.hp = Math.max(0, n|0);
    if (!boss.el) return;
    const hpEl = boss.el.querySelector('.hp');
    if (hpEl) hpEl.textContent = `BOSS HP ${boss.hp}`;
  }

  function scheduleNextBoss(){
    const t = now();
    const base = 12000;
    const feverFast = (runMode === 'research') ? 1 : (1 - Math.min(0.35, fever * 0.35));
    const stormFast = stormOn ? 0.78 : 1.0;
    boss.nextAt = t + base * feverFast * stormFast + (Math.random()*1600 - 800);
  }

  function shouldSpawnBoss(){
    if (stopped) return false;
    if (lastSecLeft <= 8) return false;
    if (bossHasAny()) return false;
    const t = now();
    if (!boss.nextAt) boss.nextAt = t + 10500;
    return (t >= boss.nextAt);
  }

  function makeBossEl(emoji='🥤👑', hpText='BOSS HP 3'){
    const el = DOC.createElement('div');
    el.className = 'hvr-boss tele';
    el.innerHTML = `
      <div class="hp">${hpText}</div>
      <div class="face">${emoji}</div>
    `;
    return el;
  }

  function bossSpawnSingle(){
    const rects = buildExclusionRects(bounds, excludeSelectorsForBoss);
    const pt = pickSafePoint(bounds, rects, 92, 28);

    const el = makeBossEl('🥤👑', 'BOSS HP 3');
    el.style.left = pt.x + 'px';
    el.style.top  = pt.y + 'px';

    layer.appendChild(el);

    boss.mode = 'single';
    boss.el = el;
    bossSetHP(3);
    boss.phase = 'tele';
    boss.teleAt = now();

    setCoach('⚠️ บอสมา! รอจังหวะเปิดแล้วกด! (อย่าลืมหลบลำแสง) ⚡', 'sad');
    sfx.bossWarn && sfx.bossWarn();
    Particles.stamp && Particles.stamp('BOSS!');
    sfx.thump && sfx.thump();
    emit('hha:log_event', { sessionId, game:'hydration', type:'boss_spawn', data:{ mode:'single' } });

    ROOT.setTimeout(()=>{
      if (!boss.el || stopped) return;
      boss.phase = 'open';
      boss.openAt = now();
      boss.openUntil = boss.openAt + 3600;
      boss.el.classList.remove('tele');
      boss.el.classList.add('open');

      setCoach('ยิงบอสตอนนี้! (PERFECT = แรงขึ้น) 🎯', 'neutral');
      sfx.tickHigh && sfx.tickHigh();
    }, 620);

    // click handler
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if (stopped) return;
      if (!boss.el) return;

      if (shieldOn && now() > shieldUntil) setShield(false);

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
      const perfect = ((t - boss.openAt) <= 240) || (dist <= 16);

      const dmg = perfect ? 2 : 1;
      bossSetHP(boss.hp - dmg);

      const sd = scoreForHit({ itemType:'boss', hitPerfect: perfect });
      score += sd;
      updateCombo(true);
      emit('hha:score', { score, combo, comboMax, misses, waterPct: Math.round(water*100), feverPct: Math.round(fever*100), shield: shieldOn });

      sfx.bossHit && sfx.bossHit();
      if (perfect) sfx.perfect && sfx.perfect();

      Particles.burstAt && Particles.burstAt(ev.clientX, ev.clientY, perfect ? 'PERFECT' : 'HIT');
      Particles.scorePop && Particles.scorePop(ev.clientX, ev.clientY, `+${sd}`, perfect ? 'BOSS PERFECT' : 'BOSS');
      emit('hha:log_event', { sessionId, game:'hydration', type:'boss_hit', data:{ perfect, dmg, hp: boss.hp } });

      // ✅ B) Phase 2 split at HP == 1
      if (boss.hp === 1){
        bossSplitPhase2();
        return;
      }

      if (boss.hp <= 0){
        bossDownReward('single');
      } else {
        try{
          boss.el.animate([
            { transform:'translate(-50%,-50%) scale(1.00)' },
            { transform:'translate(-50%,-50%) scale(1.06)' },
            { transform:'translate(-50%,-50%) scale(1.00)' }
          ], { duration: 180, easing:'ease-out' });
        }catch{}
      }
    }, { passive:false });
  }

  function bossSplitPhase2(){
    if (boss.mode !== 'single' || !boss.el) return;

    // remove single boss
    try{ boss.el.remove(); }catch{}
    boss.el = null;

    boss.mode = 'split';
    boss.phase = 'open';
    boss.openAt = now();
    boss.openUntil = boss.openAt + 3200;

    // create two minis (HP 1 each)
    const rects = buildExclusionRects(bounds, excludeSelectorsForBoss);
    const p1 = pickSafePoint(bounds, rects, 84, 24);
    const p2 = pickSafePoint(bounds, rects, 84, 24);

    function makeMini(kind, emoji){
      const el = makeBossEl(emoji, 'HP 1');
      el.classList.remove('tele');
      el.classList.add('open','move');
      el.style.width = '84px';
      el.style.height = '84px';
      el.style.fontSize = '36px';
      el.style.left = (kind==='m1'?p1.x:p2.x) + 'px';
      el.style.top  = (kind==='m1'?p1.y:p2.y) + 'px';
      layer.appendChild(el);

      const mini = { kind, el, hp:1, alive:true, openUntil: boss.openUntil };

      el.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        if (stopped) return;
        if (!mini.alive) return;

        if (shieldOn && now() > shieldUntil) setShield(false);

        // perfect by center distance
        const r = el.getBoundingClientRect();
        const cx = (r.left + r.right)*0.5;
        const cy = (r.top + r.bottom)*0.5;
        const dist = Math.hypot((ev.clientX-cx),(ev.clientY-cy));
        const perfect = dist <= 14;

        const sd = scoreForHit({ itemType:'boss', hitPerfect: perfect });
        score += sd;
        updateCombo(true);
        emit('hha:score', { score, combo, comboMax, misses, waterPct: Math.round(water*100), feverPct: Math.round(fever*100), shield: shieldOn });

        sfx.bossHit && sfx.bossHit();
        if (perfect) sfx.perfect && sfx.perfect();

        Particles.burstAt && Particles.burstAt(ev.clientX, ev.clientY, perfect ? 'PERFECT' : 'HIT');
        Particles.scorePop && Particles.scorePop(ev.clientX, ev.clientY, `+${sd}`, perfect ? 'PHASE2 PERFECT' : 'PHASE2');
        emit('hha:log_event', { sessionId, game:'hydration', type:'boss_phase2_hit', data:{ kind, perfect } });

        // kill mini
        mini.hp = 0;
        mini.alive = false;
        try{ el.remove(); }catch{}

        // check all down
        if (!boss.minis.some(m=>m && m.alive)){
          bossDownReward('split');
        }
      }, { passive:false });

      return mini;
    }

    boss.minis = [
      makeMini('m1','🥤'),
      makeMini('m2','🧋')
    ];

    // hype
    setCoach('🔥 PHASE 2! แยกร่าง 2 ตัว — วิ่งเร็ว + ยิงลำแสงถี่! ลากจอหลบ! 🔥', 'fever');
    Particles.celebrate && Particles.celebrate('BOSS', 'PHASE 2!');
    Particles.stamp && Particles.stamp('PHASE 2!');
    sfx.thump && sfx.thump();
    emit('hha:log_event', { sessionId, game:'hydration', type:'boss_split', data:{} });

    // new schedule for next boss after this ends
    scheduleNextBoss();
  }

  function bossDownReward(mode){
    sfx.bossDown && sfx.bossDown();
    Particles.celebrate && Particles.celebrate('BOSS', 'BOSS DOWN!');
    Particles.stamp && Particles.stamp('BOSS DOWN!');
    sfx.thump && sfx.thump();

    const target = 0.5;
    setWater(water + (target - water) * 0.45);
    addFever(0.20);

    setCoach('บอสล้ม! โคตรโหด! 💥👑', 'happy');
    emit('hha:log_event', { sessionId, game:'hydration', type:'boss_down', data:{ mode } });

    bossRemoveAll();
    scheduleNextBoss();
  }

  function bossUpdateTimers(){
    if (!bossHasAny()) return;

    // timeout punish if still alive
    if (boss.mode === 'single'){
      if (boss.phase === 'open' && now() >= boss.openUntil && boss.el){
        if (shieldOn){
          setCoach('โล่กันโทษบอสไว้! 🛡️', 'happy');
          setShield(false);
          Particles.scorePop && Particles.scorePop(null, null, 'BLOCK', 'BOSS');
          emit('hha:log_event', { sessionId, game:'hydration', type:'boss_fail_blocked', data:{} });
        } else {
          addMiss('boss_fail');
          updateCombo(false);
          setWater(water - 0.12);
          sfx.buzzer && sfx.buzzer();
          Particles.stamp && Particles.stamp('BOSS FAIL!');
          setCoach('โดนบอสลงโทษ! 💥', 'sad');
          emit('hha:log_event', { sessionId, game:'hydration', type:'boss_fail', data:{} });
        }
        bossRemoveAll();
        scheduleNextBoss();
      }
    } else if (boss.mode === 'split'){
      const t = now();
      const anyAlive = boss.minis.some(m=>m && m.alive);
      if (anyAlive && t >= boss.openUntil){
        if (shieldOn){
          setCoach('โล่กันโทษ Phase2 ไว้! 🛡️', 'happy');
          setShield(false);
          Particles.scorePop && Particles.scorePop(null, null, 'BLOCK', 'PHASE2');
          emit('hha:log_event', { sessionId, game:'hydration', type:'boss_phase2_fail_blocked', data:{} });
        } else {
          addMiss('boss_phase2_fail');
          updateCombo(false);
          setWater(water - 0.14);
          sfx.buzzer && sfx.buzzer();
          Particles.stamp && Particles.stamp('PHASE2 FAIL!');
          setCoach('Phase2 โหดจัด! โดนลงโทษ 💥', 'sad');
          emit('hha:log_event', { sessionId, game:'hydration', type:'boss_phase2_fail', data:{} });
        }
        bossRemoveAll();
        scheduleNextBoss();
      }
    }
  }

  function bossMovePhase2(){
    if (boss.mode !== 'split') return;
    const t = now();
    if (t - boss.lastMoveAt < 320) return;
    boss.lastMoveAt = t;

    const rects = buildExclusionRects(bounds, excludeSelectorsForBoss);

    // move each alive mini to new safe point (fast)
    boss.minis.forEach(m=>{
      if (!m || !m.alive || !m.el) return;
      const pt = pickSafePoint(bounds, rects, 84, 18);
      m.el.style.left = pt.x + 'px';
      m.el.style.top  = pt.y + 'px';
    });
  }

  /* =========================
     A) Laser system (telegraph -> fire -> must drag to dodge)
  ========================= */
  const laser = {
    el: null,
    phase: 'none',     // none|tele|fire
    center: { x:0, y:0 },
    angle: 0,
    length: 0,
    thick: 0,
    teleUntil: 0,
    fireUntil: 0,
    nextAt: 0,
    hitDone: false
  };

  function laserRemove(){
    if (laser.el){ try{ laser.el.remove(); }catch{} }
    laser.el = null;
    laser.phase = 'none';
    laser.hitDone = false;
    laser.teleUntil = laser.fireUntil = 0;
  }

  function laserScheduleNext(){
    const t = now();
    // faster in Phase2 + storm + fever
    const base = (boss.mode === 'split') ? 1100 : 1600;
    const stormFast = stormOn ? 0.70 : 1.0;
    const feverFast = (runMode === 'research') ? 1.0 : (1 - Math.min(0.28, fever*0.28));
    laser.nextAt = t + base * stormFast * feverFast + (Math.random()*260 - 130);
  }

  function laserSpawn(){
    if (laser.el) return;
    if (!bossHasAny()) return;

    const w = bounds.clientWidth || (ROOT.innerWidth||1);
    const h = bounds.clientHeight || (ROOT.innerHeight||1);
    const diag = Math.hypot(w,h);
    const len = diag * 1.35;

    const rects = buildExclusionRects(bounds, excludeSelectorsForBoss);
    const pt = pickSafePoint(bounds, rects, 60, 22);

    // pick angle and try to avoid directly through crosshair in telegraph to force dodge but not unfair:
    let ang = Math.random() * Math.PI; // 0..pi
    const cross = getCrosshairLayerLocal();
    // shift center a bit away from crosshair to reduce instant hit
    const dx = pt.x - cross.x;
    const dy = pt.y - cross.y;
    if (Math.hypot(dx,dy) < 90){
      pt.x = clamp(pt.x + (Math.random()*2-1)*120, 40, w-40);
      pt.y = clamp(pt.y + (Math.random()*2-1)*120, 50, h-50);
    }

    const el = DOC.createElement('div');
    el.className = 'hvr-beam tele';
    el.innerHTML = `<div class="core"></div>`;
    el.style.width = `${len}px`;
    el.style.height = `14px`;
    el.style.left = `${pt.x}px`;
    el.style.top  = `${pt.y}px`;
    el.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
    layer.appendChild(el);

    laser.el = el;
    laser.phase = 'tele';
    laser.center = { x: pt.x, y: pt.y };
    laser.angle = ang;
    laser.length = len;
    laser.thick = 14;
    laser.hitDone = false;

    const t = now();
    laser.teleUntil = t + 560;
    laser.fireUntil = t + 560 + 920;

    sfx.laserWarn && sfx.laserWarn();
    Particles.stamp && Particles.stamp('LASER!');
    emit('hha:log_event', { sessionId, game:'hydration', type:'boss_laser_tele', data:{ mode: boss.mode } });
  }

  function laserToFire(){
    if (!laser.el) return;
    laser.phase = 'fire';
    laser.el.classList.remove('tele');
    laser.el.classList.add('fire');
    laser.thick = 52;
    laser.el.style.height = `${laser.thick}px`;

    sfx.laserZap && sfx.laserZap();
    emit('hha:log_event', { sessionId, game:'hydration', type:'boss_laser_fire', data:{} });
  }

  function laserHitTest(){
    if (!laser.el) return false;
    if (laser.phase !== 'fire') return false;
    if (laser.hitDone) return false;

    const p = getCrosshairLayerLocal();
    const cx = laser.center.x;
    const cy = laser.center.y;

    // transform to beam local (rotate -angle)
    const dx = p.x - cx;
    const dy = p.y - cy;
    const rp = rotatePoint(dx, dy, -laser.angle);

    const halfL = laser.length * 0.5;
    const halfT = laser.thick  * 0.5;

    const hit = (Math.abs(rp.x) <= halfL) && (Math.abs(rp.y) <= halfT);
    return hit;
  }

  function laserPunish(){
    laser.hitDone = true;

    if (shieldOn){
      setCoach('โล่กันลำแสงไว้! 🛡️⚡', 'happy');
      setShield(false);
      Particles.scorePop && Particles.scorePop(null, null, 'BLOCK', 'LASER');
      emit('hha:log_event', { sessionId, game:'hydration', type:'boss_laser_hit_blocked', data:{} });
      // still remove laser
      laserRemove();
      return;
    }

    addMiss('boss_laser');
    updateCombo(false);
    setWater(water - 0.10);

    sfx.buzzer && sfx.buzzer();
    Particles.stamp && Particles.stamp('ZAP!');
    setCoach('โดนลำแสง! ลากจอหลบให้ทัน ⚡😵', 'sad');
    emit('hha:log_event', { sessionId, game:'hydration', type:'boss_laser_hit', data:{} });

    // quick flash
    hitFlash(true); setTimeout(()=>hitFlash(false), 160);

    laserRemove();
  }

  function laserUpdate(){
    if (!bossHasAny()) { laserRemove(); return; }
    if (runMode === 'research') return; // โหมดวิจัย ลดความสุ่ม/ความโหดจากลำแสง (ตามแนวคิดเดิม)

    const t = now();

    // spawn cycle
    if (!laser.nextAt) laserScheduleNext();
    if (!laser.el && t >= laser.nextAt){
      laserSpawn();
      laserScheduleNext();
    }

    // phase change
    if (laser.el && laser.phase === 'tele' && t >= laser.teleUntil){
      laserToFire();
    }

    // fire end
    if (laser.el && t >= laser.fireUntil){
      laserRemove();
      return;
    }

    // hit test
    if (laser.el && laserHitTest()){
      laserPunish();
    }
  }

  /* =========================
     Core judge / expire
  ========================= */
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
      setCoach('โอ๊ะ! ขยะ/หวาน 😵‍💫', 'sad');
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

    if (ctx.hitPerfect) sfx.perfect && sfx.perfect();
    else sfx.good && sfx.good();

    const zoneBalanced = (zone === 'BALANCED');
    quest.onHit && quest.onHit({
      kind:(itemType==='fakeGood'?'fakeGood':'good'),
      perfect:!!ctx.hitPerfect,
      zoneBalanced,
      comboMax
    });

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

    // danger vignette
    dangerVignette(sec <= 10);

    // tick sound
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
      setCoach('ใกล้หมดเวลา! เร่งมือ + ระวังลำแสง ⏱️⚡', 'neutral');
      Particles.stamp && Particles.stamp('10s!');
      sfx.thump && sfx.thump();
    }
  };
  ROOT.addEventListener('hha:time', onTime);

  /* ===== Main RAF loop: warnings + quest + boss + laser ===== */
  let lastWarnAt = 0;

  function endGame(reason='timeout'){
    if (stopped) return;
    stopped = true;

    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
    try{ engine && engine.stop && engine.stop(); }catch{}
    try{ bossRemoveAll(); }catch{}
    try{ laserRemove(); }catch{}

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

  const endWatcher = (e)=>{
    const sec = e && e.detail ? e.detail.sec : null;
    if (sec === 0) {
      ROOT.removeEventListener('hha:time', endWatcher);
      endGame('timeout');
    }
  };
  ROOT.addEventListener('hha:time', endWatcher);

  // crosshair click shoot (empty-space)
  bounds.addEventListener('click', ()=>{
    if (stopped) return;
    if (engine && engine.shootCrosshair && engine.shootCrosshair()){
      hitFlash(true); setTimeout(()=>hitFlash(false), 60);
    }
  }, { passive:true });

  // schedule boss
  scheduleNextBoss();

  const rafLoop = ()=>{
    if (stopped) return;

    if (shieldOn && now() > shieldUntil) setShield(false);

    // water warning
    const t = now();
    if (water <= 0.18 && (t - lastWarnAt) > 1800){
      lastWarnAt = t;
      Particles.stamp && Particles.stamp('LOW!');
      setCoach('น้ำต่ำ! รีบเก็บน้ำ 💧', 'sad');
      sfx.buzzer && sfx.buzzer();
    }

    // quest tick
    try{ quest.update && quest.update(t); }catch{}

    // boss spawn
    if (shouldSpawnBoss()){
      bossSpawnSingle();
      scheduleNextBoss();
      // also start laser cadence fresh
      laser.nextAt = 0;
      laserScheduleNext();
    }

    // boss timers + phase2 movement
    bossUpdateTimers();
    bossMovePhase2();

    // A) laser update
    laserUpdate();

    ROOT.requestAnimationFrame(rafLoop);
  };
  ROOT.requestAnimationFrame(rafLoop);

  return {
    stop(){ endGame('manual_stop'); }
  };
}

export default { bootHydration };