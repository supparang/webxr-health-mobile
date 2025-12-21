// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR (PLAY MODE) — PRODUCTION SAFE
// ✅ FIX: นับ GREEN time ถูกต้อง (อ้าง zoneFrom(waterPct) เท่านั้น)
// ✅ FX: parallax 2 ชั้น + เป้าลอย/ส่าย (storm ส่ายแรง/เร็วขึ้น)
// ✅ PERFECT ring: ดาวแตกกระจายหนัก ๆ 💥✨ + ding + chroma split เล็ก ๆ
// ✅ Storm Wave: speed lines + wobble ต่อเนื่อง + spawn ถี่ขึ้น + sway แรงขึ้น
// ✅ Drag look / swipe เลื่อนมุมมอง (เป้าเลื่อนตาม) + tap ยิง crosshair
// ✅ HUD bind ตาม hydration-vr.html (#hha-* ids)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// ---- globals (optional modules) ----
const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

// ------------------------------------------------------------
// utils
// ------------------------------------------------------------
const $id = (id)=> DOC ? DOC.getElementById(id) : null;

function clamp(v,min,max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function setText(id, txt){
  const el = $id(id);
  if (el) el.textContent = String(txt);
}

// ------------------------------------------------------------
// FX styles & layers
// ------------------------------------------------------------
function ensureHydrationFXStyle(){
  if (!DOC || DOC.getElementById('hvr-hydration-fx-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-hydration-fx-style';
  s.textContent = `
  /* ===== parallax layers ===== */
  #hvr-playfield{ position:absolute; inset:0; overflow:hidden; }
  .hvr-parallax{
    position:absolute; inset:-8%;
    pointer-events:none;
    will-change:transform;
    transform:translate3d(0,0,0);
  }
  .hvr-parallax.back{
    background:
      radial-gradient(900px 700px at 25% 30%, rgba(96,165,250,.11), transparent 60%),
      radial-gradient(900px 900px at 75% 35%, rgba(34,197,94,.10), transparent 62%),
      repeating-radial-gradient(circle at 40% 60%, rgba(148,163,184,.09), rgba(148,163,184,.09) 1px, transparent 1px, transparent 18px);
    filter: blur(0.3px);
    opacity:.85;
  }
  .hvr-parallax.front{
    background:
      radial-gradient(600px 480px at 18% 72%, rgba(34,197,94,.08), transparent 60%),
      radial-gradient(520px 520px at 78% 64%, rgba(245,158,11,.07), transparent 60%),
      repeating-linear-gradient(90deg, rgba(148,163,184,.045) 0 1px, transparent 1px 26px);
    opacity:.72;
    mix-blend-mode: screen;
  }

  /* ===== target look: ลอย/ส่าย ===== */
  .hvr-target{
    will-change: transform, filter;
    animation: hvrFloat 2.8s ease-in-out infinite;
  }
  @keyframes hvrFloat{
    0%   { transform: translate(-50%,-50%) scale(1) translate3d(0,0,0) rotate(-0.4deg); }
    25%  { transform: translate(-50%,-50%) scale(1) translate3d(0,-6px,0) rotate(0.2deg); }
    50%  { transform: translate(-50%,-50%) scale(1) translate3d(0,0,0) rotate(0.4deg); }
    75%  { transform: translate(-50%,-50%) scale(1) translate3d(0,5px,0) rotate(-0.2deg); }
    100% { transform: translate(-50%,-50%) scale(1) translate3d(0,0,0) rotate(-0.4deg); }
  }
  /* storm: ส่ายแรง/เร็วขึ้น */
  .hvr-storm-on .hvr-target{
    animation-duration: 1.15s;
    filter: saturate(1.08) contrast(1.08);
  }
  .hvr-storm-on .hvr-target[data-item-type="bad"]{
    filter: saturate(1.12) contrast(1.10) brightness(1.03);
  }

  /* ===== screen wobble (เบา ๆ ต่อเนื่อง) ===== */
  #hvr-wrap.hvr-wobble{
    animation: hvrWobble 2.4s ease-in-out infinite;
  }
  @keyframes hvrWobble{
    0%{ transform: translate3d(0,0,0) rotate(0deg); }
    25%{ transform: translate3d(.6px,-.4px,0) rotate(.10deg); }
    50%{ transform: translate3d(0,.5px,0) rotate(0deg); }
    75%{ transform: translate3d(-.6px,.2px,0) rotate(-.10deg); }
    100%{ transform: translate3d(0,0,0) rotate(0deg); }
  }

  /* ===== chroma split (เล็ก ๆ) ===== */
  #hvr-chroma{
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index:99979;
    opacity:0;
    transition: opacity 90ms ease;
    mix-blend-mode: screen;
    filter: blur(.2px);
  }
  #hvr-chroma.on{ opacity:1; }
  #hvr-chroma::before{
    content:"";
    position:absolute; inset:-2%;
    background:
      linear-gradient(90deg,
        rgba(255, 0, 120, .12),
        transparent 42%,
        transparent 58%,
        rgba(0, 255, 255, .10));
    transform: translate3d(-4px,0,0);
    animation: hvrChromaMove .18s ease-in-out infinite alternate;
  }
  @keyframes hvrChromaMove{
    from{ transform: translate3d(-4px,0,0); }
    to  { transform: translate3d(4px,0,0); }
  }

  /* ===== storm speed lines ===== */
  #hvr-speedlines{
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index:99978;
    opacity:0;
    transition: opacity 160ms ease;
    mix-blend-mode: screen;
  }
  #hvr-speedlines.on{ opacity:1; }
  #hvr-speedlines::before{
    content:"";
    position:absolute; inset:-8%;
    background:
      repeating-linear-gradient(115deg,
        rgba(255,255,255,.0) 0 10px,
        rgba(255,255,255,.07) 10px 12px,
        rgba(255,255,255,.0) 12px 26px);
    filter: blur(.35px);
    animation: hvrLines 0.35s linear infinite;
  }
  @keyframes hvrLines{
    from{ transform: translate3d(-26px,-18px,0); }
    to  { transform: translate3d(26px,18px,0); }
  }

  /* ===== crosshair ===== */
  #hvr-crosshair{
    position:fixed;
    left:50%;
    top:56%;
    transform:translate(-50%,-50%);
    width:18px; height:18px;
    border-radius:999px;
    border:2px solid rgba(219,234,254,.55);
    box-shadow: 0 0 0 2px rgba(15,23,42,.6), 0 0 14px rgba(96,165,250,.28);
    pointer-events:none;
    z-index:60;
  }
  #hvr-crosshair::after{
    content:"";
    position:absolute;
    left:50%; top:50%;
    transform:translate(-50%,-50%);
    width:4px; height:4px;
    border-radius:999px;
    background:rgba(219,234,254,.7);
    box-shadow:0 0 10px rgba(96,165,250,.35);
  }

  /* ===== PERFECT heavy sparkles ===== */
  .hvr-starburst{
    position:fixed;
    left:0; top:0;
    pointer-events:none;
    z-index:99990;
    font-size:22px;
    filter: drop-shadow(0 6px 8px rgba(2,6,23,.9));
    will-change: transform, opacity;
  }
  `;
  DOC.head.appendChild(s);
}

function ensureFXNodes(){
  if (!DOC) return;
  if (!$id('hvr-chroma')){
    const c = DOC.createElement('div');
    c.id = 'hvr-chroma';
    DOC.body.appendChild(c);
  }
  if (!$id('hvr-speedlines')){
    const sl = DOC.createElement('div');
    sl.id = 'hvr-speedlines';
    DOC.body.appendChild(sl);
  }
  if (!$id('hvr-crosshair')){
    const ch = DOC.createElement('div');
    ch.id = 'hvr-crosshair';
    DOC.body.appendChild(ch);
  }
}

function flashBlink(kind){
  const el = $id('hvr-screen-blink');
  if (!el) return;
  el.className = '';
  el.classList.add('on');
  if (kind) el.classList.add(kind);
  ROOT.setTimeout(()=>{ try{ el.classList.remove('on'); }catch{} }, 110);
}

function chromaOn(){
  const el = $id('hvr-chroma');
  if (!el) return;
  el.classList.add('on');
  ROOT.setTimeout(()=>{ try{ el.classList.remove('on'); }catch{} }, 220);
}

function setStormLines(on){
  const el = $id('hvr-speedlines');
  if (!el) return;
  if (on) el.classList.add('on');
  else el.classList.remove('on');
}

function starBurstHeavy(x,y){
  if (!DOC) return;
  // สาดดาวหลายดวงหนัก ๆ
  const glyphs = ['✨','💥','⭐','🌟','✨','💥','⭐','✨'];
  const n = 14;
  for (let i=0;i<n;i++){
    const g = glyphs[i % glyphs.length];
    const d = DOC.createElement('div');
    d.className = 'hvr-starburst';
    d.textContent = g;
    const ang = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random()*64;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist;
    const s  = 0.85 + Math.random()*0.9;

    d.style.left = `${x}px`;
    d.style.top  = `${y}px`;
    d.style.opacity = '1';
    d.style.transform = `translate3d(-50%,-50%,0) translate3d(0,0,0) scale(${s})`;

    DOC.body.appendChild(d);

    ROOT.requestAnimationFrame(()=>{
      d.style.transition = 'transform 520ms cubic-bezier(.2,.9,.2,1), opacity 520ms ease';
      d.style.transform  = `translate3d(-50%,-50%,0) translate3d(${dx}px,${dy}px,0) scale(${s*0.92})`;
      d.style.opacity    = '0';
    });

    ROOT.setTimeout(()=>{ try{ d.remove(); }catch{} }, 560);
  }
}

// ------------------------------------------------------------
// audio (tiny)
// ------------------------------------------------------------
let _ac = null;
function getAC(){
  try{
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return null;
    if (!_ac) _ac = new AC();
    if (_ac.state === 'suspended') _ac.resume().catch(()=>{});
    return _ac;
  }catch{ return null; }
}
function playDing(){
  const ac = getAC();
  if (!ac) return;
  try{
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ac.currentTime + 0.09);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.10, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.12);
    o.connect(g); g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.13);
  }catch{}
}
function playStormTick(){
  const ac = getAC();
  if (!ac) return;
  try{
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1600, ac.currentTime);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.05);
    o.connect(g); g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.055);
  }catch{}
}

// ------------------------------------------------------------
// grade
// ------------------------------------------------------------
function gradeFromProg(p){
  p = clamp(p,0,100);
  if (p >= 95) return 'SSS';
  if (p >= 85) return 'SS';
  if (p >= 75) return 'S';
  if (p >= 60) return 'A';
  if (p >= 45) return 'B';
  return 'C';
}

// ------------------------------------------------------------
// main boot
// ------------------------------------------------------------
export async function boot(opts = {}){
  if (!DOC) return { stop(){} };

  ensureHydrationFXStyle();
  ensureFXNodes();

  const wrap = $id('hvr-wrap');
  if (wrap) wrap.classList.add('hvr-wobble');

  const playfield = $id('hvr-playfield') || DOC.body;

  // parallax layers
  let back = playfield.querySelector('.hvr-parallax.back');
  let front = playfield.querySelector('.hvr-parallax.front');
  if (!back){
    back = DOC.createElement('div');
    back.className = 'hvr-parallax back';
    playfield.appendChild(back);
  }
  if (!front){
    front = DOC.createElement('div');
    front.className = 'hvr-parallax front';
    playfield.appendChild(front);
  }

  // base config
  const diffKey  = String(opts.difficulty || opts.diff || 'easy').toLowerCase();
  const duration = clamp(opts.duration || opts.time || 90, 20, 180);

  // state
  const state = {
    diffKey,
    duration,
    timeLeft: duration,

    // water
    waterPct: 50,
    zone: 'GREEN',
    greenTick: 0,
    badTick: 0,

    // score
    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    // storm
    stormOn: false,
    stormLeft: 0,

    // quests
    goalsTotal: 2,
    goalsDone: 0,
    minisTotal: 3,
    minisDone: 0,

    // chain minis
    chainCleared: 0,
    chainFailed: 0,

    // perfect tracking
    perfectChain: 0,
    perfectBest: 0,

    // view drag
    viewX: 0,
    viewY: 0
  };

  // tuning
  const TUNE = {
    // water
    driftPerSec: 0.0,
    goodWaterGain: 3.0,
    badWaterLoss:  6.0,
    powerWaterGain: 7.0,

    // score
    goodScore:  40,
    badPenalty: -60,
    perfectBonus: 40,
    comboBonusMul: 0.08, // ต่อคอมโบ

    // storm
    stormEverySec: (diffKey === 'hard' ? 16 : diffKey === 'normal' ? 18 : 20),
    stormDuration: (diffKey === 'hard' ? 7 : 6),
    stormMul:      (diffKey === 'hard' ? 0.52 : diffKey === 'normal' ? 0.62 : 0.70), // spawnIntervalMul (<1 = ถี่ขึ้น)
    stormSwayBoost: 1.0,

    // goals
    goalGreenNeed: (diffKey === 'hard' ? 22 : diffKey === 'normal' ? 18 : 16), // วินาทีใน GREEN
    goalBadMax:    (diffKey === 'hard' ? 12 : diffKey === 'normal' ? 15 : 18), // วินาทีที่ไม่อยู่ GREEN
    // minis
    miniComboNeed: (diffKey === 'hard' ? 10 : diffKey === 'normal' ? 9 : 8),
    miniNoJunkSec: (diffKey === 'hard' ? 12 : diffKey === 'normal' ? 10 : 8),
    miniPerfectNeed:(diffKey === 'hard' ? 7 : diffKey === 'normal' ? 6 : 5),

    // grade target
    targetScoreSSS: (diffKey === 'hard' ? 5200 : diffKey === 'normal' ? 4700 : 4200)
  };

  // UI bind (water)
  ensureWaterGauge();

  // ---- quest UI helpers ----
  function updateQuestUI(){
    // Goal line: "8/18 วินาที (โซน GREEN)" + bad time
    const goalLine =
      `Goal: ${state.greenTick}/${TUNE.goalGreenNeed} วินาที (โซน GREEN) • Bad ${state.badTick}/${TUNE.goalBadMax}s`;
    const miniLine =
      `Mini: 🎯 Combo ${Math.min(state.comboMax, TUNE.miniComboNeed)}/${TUNE.miniComboNeed} • ` +
      `⛔ No-JUNK ${Math.min(noJunkSec, TUNE.miniNoJunkSec)}/${TUNE.miniNoJunkSec}s • ` +
      `🎯 Perfect ${Math.min(state.perfectBest, TUNE.miniPerfectNeed)}/${TUNE.miniPerfectNeed}`;

    setText('hha-quest-goal', goalLine);
    setText('hha-quest-mini', miniLine);

    setText('hha-goal-total', state.goalsTotal);
    setText('hha-goal-done', state.goalsDone);
    setText('hha-mini-total', state.minisTotal);
    setText('hha-mini-done', state.minisDone);
  }

  function updateScoreUI(){
    setText('hha-score-main', state.score|0);
    setText('hha-combo-max', state.comboMax|0);
    setText('hha-miss', state.miss|0);

    const prog = clamp((state.score / TUNE.targetScoreSSS) * 100, 0, 100);
    const grade = gradeFromProg(prog);
    setText('hha-grade-badge', grade);

    const fill = $id('hha-grade-progress-fill');
    if (fill) fill.style.width = prog.toFixed(1) + '%';

    const nextText = $id('hha-grade-progress-text');
    if (nextText){
      nextText.textContent = `Progress to S (30%): ${Math.round(prog)}%`;
    }
  }

  function updateWaterUI(){
    // ✅ truth: zoneFrom(waterPct) only
    state.zone = String(zoneFrom(state.waterPct)).toUpperCase();
    setWaterGauge(state.waterPct);

    // UI water % in left card already updated by ui-water.js
    // but we keep a status string too if needed
    const st = $id('hha-water-status');
    if (st) st.textContent = `${state.zone} ${Math.round(state.waterPct)}%`;
  }

  // ------------------------------------------------------------
  // view drag (เลื่อนมุมมอง)
  // ------------------------------------------------------------
  let dragging = false;
  let startX = 0, startY = 0;
  let baseVX = 0, baseVY = 0;

  function applyView(){
    // จำกัดการเลื่อน (กันหลุดมาก)
    const maxX = 260, maxY = 220;
    state.viewX = clamp(state.viewX, -maxX, maxX);
    state.viewY = clamp(state.viewY, -maxY, maxY);

    // ขยับ playfield -> เป้าเลื่อนตาม
    playfield.style.transform = `translate3d(${state.viewX}px, ${state.viewY}px, 0)`;

    // parallax 2 ชั้น (ต่างสปีด)
    const px = state.viewX, py = state.viewY;
    if (back)  back.style.transform  = `translate3d(${px * 0.12}px, ${py * 0.10}px, 0)`;
    if (front) front.style.transform = `translate3d(${px * 0.22}px, ${py * 0.18}px, 0)`;
  }

  function onPointerDown(e){
    // ไม่ให้ลากบน HUD
    if (e && e.target && e.target.closest && e.target.closest('.hud')) return;

    dragging = true;
    startX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    startY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    baseVX = state.viewX;
    baseVY = state.viewY;
  }
  function onPointerMove(e){
    if (!dragging) return;
    const x = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const y = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const dx = x - startX;
    const dy = y - startY;
    state.viewX = baseVX + dx;
    state.viewY = baseVY + dy;
    applyView();
  }
  function onPointerUp(){ dragging = false; }

  // ยิง crosshair: tap ที่พื้นที่ว่าง
  let engineInst = null;
  function onTapShoot(e){
    // ถ้ากดเป้า -> mode-factory จัดการแล้ว
    const t = e.target;
    if (t && t.classList && t.classList.contains('hvr-target')) return;

    // ถ้ากดปุ่ม HUD -> ไม่ยิง
    if (t && t.closest && t.closest('.hud')) return;

    if (engineInst && typeof engineInst.shootCrosshair === 'function'){
      const ok = engineInst.shootCrosshair();
      if (ok){
        // feedback เบา ๆ
        flashBlink('block');
      }
    }
  }

  playfield.addEventListener('pointerdown', onPointerDown, { passive:true });
  playfield.addEventListener('pointermove', onPointerMove, { passive:true });
  playfield.addEventListener('pointerup', onPointerUp, { passive:true });
  playfield.addEventListener('pointercancel', onPointerUp, { passive:true });
  playfield.addEventListener('click', onTapShoot, { passive:true });

  applyView();

  // ------------------------------------------------------------
  // storm control
  // ------------------------------------------------------------
  let stormCooldown = TUNE.stormEverySec;
  function setStorm(on){
    state.stormOn = !!on;
    if (on){
      state.stormLeft = TUNE.stormDuration;
      setStormLines(true);
      try{ playfield.classList.add('hvr-storm-on'); }catch{}
    } else {
      state.stormLeft = 0;
      setStormLines(false);
      try{ playfield.classList.remove('hvr-storm-on'); }catch{}
    }
  }

  // ------------------------------------------------------------
  // mini tracking
  // ------------------------------------------------------------
  let noJunkSec = 0;

  function checkGoalsAndMinis(){
    // goals
    const g1 = (state.greenTick >= TUNE.goalGreenNeed);
    const g2 = (state.badTick <= TUNE.goalBadMax);

    let goalsDone = 0;
    if (g1) goalsDone++;
    if (g2) goalsDone++;
    state.goalsDone = goalsDone;

    // minis
    const m1 = (state.comboMax >= TUNE.miniComboNeed);
    const m2 = (noJunkSec >= TUNE.miniNoJunkSec);
    const m3 = (state.perfectBest >= TUNE.miniPerfectNeed);
    let minisDone = 0;
    if (m1) minisDone++;
    if (m2) minisDone++;
    if (m3) minisDone++;
    state.minisDone = minisDone;

    updateQuestUI();
  }

  // ------------------------------------------------------------
  // judge callback (from mode-factory)
  // ------------------------------------------------------------
  function judge(ch, ctx){
    // ctx: {clientX, clientY, isGood, isPower, itemType, hitPerfect, hitDistNorm, targetRect}
    const x = ctx?.clientX ?? 0;
    const y = ctx?.clientY ?? 0;

    let scoreDelta = 0;

    // perfect ring
    const isPerfect = !!ctx?.hitPerfect;

    if (ctx.itemType === 'bad' || ctx.isGood === false){
      // JUNK hit
      state.miss += 1;
      state.combo = 0;
      noJunkSec = 0;

      // chain fail นับเฉพาะ junk hit
      state.chainFailed += 1;

      state.waterPct = clamp(state.waterPct - TUNE.badWaterLoss, 0, 100);
      scoreDelta = TUNE.badPenalty;

      flashBlink('bad');

      // FX
      try{ Particles.burstAt(x,y,'bad'); }catch{}
      try{ Particles.scorePop(x,y, String(scoreDelta)); }catch{}

      // storm tick feel
      if (state.stormOn) playStormTick();

      updateWaterUI();
      updateScoreUI();
      checkGoalsAndMinis();
      return { scoreDelta, good:false };
    }

    // GOOD / POWER / fakeGood treated as good for hydration
    state.combo += 1;
    state.comboMax = Math.max(state.comboMax, state.combo);
    noJunkSec += 0; // เพิ่มใน tick รายวินาที

    let base = TUNE.goodScore;

    if (ctx.itemType === 'power' || ctx.isPower){
      base += 30;
      state.waterPct = clamp(state.waterPct + TUNE.powerWaterGain, 0, 100);
      flashBlink('block');
      try{ Particles.burstAt(x,y,'power'); }catch{}
    } else {
      state.waterPct = clamp(state.waterPct + TUNE.goodWaterGain, 0, 100);
      flashBlink('good');
      try{ Particles.burstAt(x,y,'good'); }catch{}
    }

    // PERFECT bonus
    if (isPerfect){
      base += TUNE.perfectBonus;
      state.perfectChain += 1;
      state.perfectBest = Math.max(state.perfectBest, state.perfectChain);

      // HEAVY perfect FX
      chromaOn();
      playDing();
      starBurstHeavy(x,y);
      try{ Particles.burstAt(x,y,'perfect'); }catch{}

      // chain cleared (ถือว่า perfect เป็น chain step สำเร็จ)
      if (state.perfectChain > 0 && (state.perfectChain % 3 === 0)){
        state.chainCleared += 1;
        try{ Particles.celebrate && Particles.celebrate('mini'); }catch{}
      }
    } else {
      // ถ้าไม่ perfect ให้รีเซ็ต perfect chain (ตามที่คุณบอก “ไม่ perfect รีเซ็ต”)
      state.perfectChain = 0;
    }

    // combo bonus
    const comboMul = 1 + (clamp(state.combo,0,30) * TUNE.comboBonusMul);
    scoreDelta = Math.round(base * comboMul);
    state.score += scoreDelta;

    // score pop
    try{ Particles.scorePop(x,y, `+${scoreDelta}`); }catch{}

    updateWaterUI();
    updateScoreUI();
    checkGoalsAndMinis();

    return { scoreDelta, good:true, perfect:isPerfect };
  }

  // ------------------------------------------------------------
  // engine (mode-factory) start
  // ------------------------------------------------------------
  const pools = {
    good: ['💧','🫧','🥛','🍉','🧊','🥒'],
    bad:  ['🥤','🧋','🍟','🍩','🍔','🍿'],
    trick: ['💧','🫧'] // fake good (optional)
  };
  const powerups = ['⭐','⚡','🛡️'];

  // spawn multiplier driven by storm
  const spawnIntervalMul = () => state.stormOn ? TUNE.stormMul : 1;

  engineInst = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diffKey,
    duration: duration,

    spawnHost: '#hvr-playfield',
    spawnStyle: 'pop',

    pools,
    goodRate: (diffKey === 'hard' ? 0.55 : diffKey === 'normal' ? 0.60 : 0.65),

    powerups,
    powerRate: 0.12,
    powerEvery: 6,

    allowAdaptive: true,
    rhythm: { enabled:false, bpm:110 },
    trickRate: (diffKey === 'hard' ? 0.10 : 0.08),

    spawnIntervalMul,

    // ✅ กันทับ HUD โดยให้ mode-factory auto-exclude + เพิ่ม selector HUD ของหน้า hydration-vr.html
    excludeSelectors: ['.hud', '#hvr-start', '#hvr-end'],

    judge,

    onExpire: (info)=>{
      // expire ไม่ถือว่า miss (ตามเกมคุณ) — ถ้าอยากโหดขึ้นค่อยเพิ่ม
    }
  });

  // ------------------------------------------------------------
  // main tick loop (sec)
  // ------------------------------------------------------------
  let stopped = false;
  let secTimer = null;

  function hardSyncZoneCounters(){
    // ✅ คิดโซนจาก waterPct ด้วย zoneFrom เท่านั้น
    state.zone = String(zoneFrom(state.waterPct)).toUpperCase();

    if (state.zone === 'GREEN'){
      state.greenTick += 1;
    } else {
      state.badTick += 1;
    }
  }

  function tick(){
    if (stopped) return;

    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time', { sec: state.timeLeft });

    // storm countdown & trigger
    if (state.stormOn){
      state.stormLeft = Math.max(0, state.stormLeft - 1);
      // tick sound เบา ๆ ตอนใกล้หมด
      if (state.stormLeft <= 3) playStormTick();
      if (state.stormLeft <= 0){
        setStorm(false);
        stormCooldown = TUNE.stormEverySec;
      }
    } else {
      stormCooldown -= 1;
      if (stormCooldown <= 0){
        setStorm(true);
      }
    }

    // drift
    state.waterPct = clamp(state.waterPct + TUNE.driftPerSec, 0, 100);

    // ✅ update HUD + zone
    updateWaterUI();

    // ✅ นับ GREEN/Bad หลังอัปเดต zone แล้ว
    hardSyncZoneCounters();

    // no-junk seconds
    noJunkSec += 1;

    // update quest
    checkGoalsAndMinis();

    // end?
    if (state.timeLeft <= 0){
      finish();
    }
  }

  function finish(){
    if (stopped) return;
    stopped = true;

    try{ engineInst && engineInst.stop && engineInst.stop(); }catch{}
    try{ clearInterval(secTimer); }catch{}

    const progPct = clamp((state.score / TUNE.targetScoreSSS) * 100, 0, 100);
    const grade = gradeFromProg(progPct);

    // final HUD sync
    updateWaterUI();
    updateScoreUI();
    updateQuestUI();

    dispatch('hha:end', {
      grade,
      score: state.score|0,

      goalsDone: state.goalsDone|0,
      goalsTotal: state.goalsTotal|0,
      minisDone: state.minisDone|0,
      minisTotal: state.minisTotal|0,

      chainCleared: state.chainCleared|0,
      chainFailed: state.chainFailed|0,

      comboBest: state.comboMax|0,
      miss: state.miss|0,

      water: Math.round(state.waterPct),
      zone: state.zone,
      greenTick: state.greenTick|0,

      fever: 0,
      shield: 0,

      progPct: Math.round(progPct)
    });
  }

  // initial UI
  updateWaterUI();
  updateScoreUI();
  updateQuestUI();

  secTimer = setInterval(tick, 1000);

  // allow stop by event
  const onStop = ()=> finish();
  ROOT.addEventListener('hha:stop', onStop);

  return {
    stop(){
      ROOT.removeEventListener('hha:stop', onStop);
      finish();
    }
  };
}

export default { boot };
