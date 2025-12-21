// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — Play Mode (DOM targets)
// - Water gauge zones (BLUE/ GREEN / RED) + correct zone timing
// - Storm Wave: spawn ถี่ขึ้น + postFX speedlines/wobble/chroma แรงขึ้น
// - PERFECT ring: bonus + heavy star burst + chroma flash
// - HUD: score/combo/miss/grade + quest progress
//
// Requires:
//   /herohealth/vr/mode-factory.js
//   /herohealth/vr/ui-water.js
//   /herohealth/vr/particles.js (IIFE)
//   /herohealth/vr/postfx-canvas.js (IIFE)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

function $(id){ return DOC ? DOC.getElementById(id) : null; }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function zoneLabel(zoneCode){
  // UI label ที่ผู้เล่นเห็น
  if (zoneCode === 'LOW') return 'BLUE';
  if (zoneCode === 'HIGH') return 'RED';
  return 'GREEN';
}
function zoneColor(zoneCode){
  if (zoneCode === 'LOW') return '#38bdf8';
  if (zoneCode === 'HIGH') return '#ef4444';
  return '#22c55e';
}

function pickDiff(d){
  d = String(d||'easy').toLowerCase();
  if (d === 'hard') return {
    goalGreenSec: 34,
    maxBadSec: 18,
    miniCombo: 10,
    miniPerfect: 6,
    miniNoJunkSec: 14,
    scorePerfect: 28,
    scoreGood: 16,
    penBad: -35,
    waterGood: +3.2,
    waterBad: -10.0,
    stormEverySec: 22,
    stormLenSec: 7
  };
  if (d === 'normal') return {
    goalGreenSec: 32,
    maxBadSec: 22,
    miniCombo: 9,
    miniPerfect: 5,
    miniNoJunkSec: 12,
    scorePerfect: 26,
    scoreGood: 14,
    penBad: -30,
    waterGood: +3.0,
    waterBad: -9.0,
    stormEverySec: 24,
    stormLenSec: 6
  };
  return {
    goalGreenSec: 28,
    maxBadSec: 26,
    miniCombo: 8,
    miniPerfect: 4,
    miniNoJunkSec: 10,
    scorePerfect: 24,
    scoreGood: 12,
    penBad: -26,
    waterGood: +2.7,
    waterBad: -8.0,
    stormEverySec: 26,
    stormLenSec: 6
  };
}

function gradeFromScore(score){
  score = Number(score)||0;
  if (score >= 2300) return 'SSS';
  if (score >= 1750) return 'SS';
  if (score >= 1350) return 'S';
  if (score >= 950)  return 'A';
  if (score >= 650)  return 'B';
  return 'C';
}
function gradeProgress(score){
  score = Number(score)||0;
  const tiers = [
    { g:'C',  min:0,    max:650 },
    { g:'B',  min:650,  max:950 },
    { g:'A',  min:950,  max:1350 },
    { g:'S',  min:1350, max:1750 },
    { g:'SS', min:1750, max:2300 },
    { g:'SSS',min:2300, max:2600 }
  ];
  let cur = tiers[0];
  for (const t of tiers){
    if (score >= t.min) cur = t;
  }
  const span = Math.max(1, cur.max - cur.min);
  const pct = clamp((score - cur.min) / span, 0, 1);
  return { grade: gradeFromScore(score), pct, next: (cur.g==='SSS'?'MAX':cur.max) };
}

function blink(type){
  const el = $('hvr-screen-blink');
  if (!el) return;
  el.className = '';
  el.classList.add(type || 'good');
  el.classList.add('on');
  ROOT.setTimeout(()=>{ try{ el.classList.remove('on'); }catch{} }, 110);
}

function setWaterFillStyle(zoneCode){
  const fill = $('hha-water-fill');
  if (!fill) return;
  // ทำสีให้ชัด: BLUE / GREEN / RED
  if (zoneCode === 'LOW') {
    fill.style.background = 'linear-gradient(90deg, rgba(56,189,248,.95), rgba(96,165,250,.85))';
  } else if (zoneCode === 'HIGH') {
    fill.style.background = 'linear-gradient(90deg, rgba(239,68,68,.95), rgba(245,158,11,.85))';
  } else {
    fill.style.background = 'linear-gradient(90deg, rgba(34,197,94,.95), rgba(96,165,250,.80))';
  }
}

function hudSet(id, v){
  const el = $(id);
  if (el) el.textContent = String(v);
}

function hudQuest(goalText, miniText){
  const g = $('hha-quest-goal');
  const m = $('hha-quest-mini');
  if (g) g.textContent = goalText || 'Goal: —';
  if (m) m.textContent = miniText || 'Mini: —';
}

export async function boot(opts = {}) {
  const diffKey = String(opts.difficulty || 'easy').toLowerCase();
  const duration = clamp(opts.duration ?? 90, 20, 180);
  const D = pickDiff(diffKey);

  // bind water HUD (existing)
  ensureWaterGauge();

  // PostFX Canvas (IIFE)
  const PostFX = ROOT.PostFXCanvas || null;
  try{
    PostFX && PostFX.init({
      zIndex: 46,                 // <= HUD (50), > targets (35)
      blendMode: 'screen',
      opacity: 1,
      // ✅ base tuned for Hydration style (water glow + chroma edges)
      strength: 1.05,
      chroma: 1.25,
      wobble: 0.85,
      scan: 0.55,
      vignette: 0.85,
      speedlines: 0.70,
      tiltEnabled: true
    });
  }catch{}

  // state
  const state = {
    startedAt: now(),
    timeLeft: duration,

    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    water: 50,
    zoneCode: 'GREEN',     // 'LOW'|'GREEN'|'HIGH'
    greenTick: 0,
    redTick: 0,
    blueTick: 0,

    // mini trackers
    perfectCount: 0,
    lastJunkHitAt: now(),
    noJunkSec: 0,

    // quest done
    goalsDone: 0,
    minisDone: 0,

    // storm
    stormOn: false,
    nextStormAt: D.stormEverySec,
    stormLeft: 0,

    stopped: false
  };

  // HUD init
  hudSet('hha-goal-total', 2);
  hudSet('hha-mini-total', 3);
  hudSet('hha-goal-done', 0);
  hudSet('hha-mini-done', 0);
  hudSet('hha-score-main', 0);
  hudSet('hha-combo-max', 0);
  hudSet('hha-miss', 0);
  hudSet('hha-grade-badge', 'C');
  const gp = $('hha-grade-progress-fill');
  const gpt = $('hha-grade-progress-text');
  if (gp) gp.style.width = '0%';
  if (gpt) gpt.textContent = 'Progress to S: 0%';

  // helpers
  function updateGrade(){
    const g = gradeProgress(state.score);
    const badge = $('hha-grade-badge');
    if (badge) badge.textContent = g.grade;
    if (gp) gp.style.width = Math.round(g.pct*100) + '%';
    if (gpt) {
      const nextLabel = (g.grade==='SSS') ? 'MAX' : `Next @ ${g.next}`;
      gpt.textContent = `Progress (${g.grade}) → ${nextLabel}: ${Math.round(g.pct*100)}%`;
    }
  }

  function setWater(v){
    state.water = clamp(v, 0, 100);
    const zc = zoneFrom(state.water);      // LOW/GREEN/HIGH
    state.zoneCode = zc;

    // bind UI-water (updates fill width + status text)
    const out = setWaterGauge(state.water);

    // overwrite UI label to BLUE/GREEN/RED (ผู้เล่นเข้าใจ)
    const label = zoneLabel(zc);
    const statusEl = $('hha-water-status');
    if (statusEl) statusEl.textContent = `${label} ${Math.round(out.pct)}%`;
    const zoneText = $('hha-water-zone-text');
    if (zoneText) zoneText.textContent = label;

    setWaterFillStyle(zc);
  }

  function addScore(delta, x, y){
    delta = Number(delta)||0;
    state.score = Math.max(0, Math.round(state.score + delta));
    hudSet('hha-score-main', state.score);
    updateGrade();

    if (Number.isFinite(x) && Number.isFinite(y)) {
      // score pop (particles.js)
      try{
        Particles.scorePop && Particles.scorePop(`+${delta}`, x, y);
      }catch{}
    }
  }

  function setCombo(v){
    state.combo = Math.max(0, v|0);
    state.comboMax = Math.max(state.comboMax, state.combo);
    hudSet('hha-combo-max', state.comboMax);
  }

  function addMiss(){
    state.miss++;
    hudSet('hha-miss', state.miss);
  }

  // quests
  const goals = [
    {
      id: 'g1',
      label: `อยู่ GREEN ให้ครบ ${D.goalGreenSec}s`,
      done: false,
      check: ()=> state.greenTick >= D.goalGreenSec
    },
    {
      id: 'g2',
      label: `อยู่ BLUE/RED รวมไม่เกิน ${D.maxBadSec}s`,
      done: false,
      check: ()=> (state.redTick + state.blueTick) <= D.maxBadSec && state.timeLeft<=0
    }
  ];

  const minis = [
    {
      id:'m1',
      label:`ทำ Combo ให้ถึง ${D.miniCombo}`,
      done:false,
      check:()=> state.comboMax >= D.miniCombo
    },
    {
      id:'m2',
      label:`Perfect ให้ครบ ${D.miniPerfect} ครั้ง`,
      done:false,
      check:()=> state.perfectCount >= D.miniPerfect
    },
    {
      id:'m3',
      label:`ห้ามโดน JUNK ${D.miniNoJunkSec}s`,
      done:false,
      check:()=> state.noJunkSec >= D.miniNoJunkSec
    }
  ];

  function updateQuestHud(){
    const g1 = goals[0], g2 = goals[1];
    const m1 = minis[0], m2 = minis[1], m3 = minis[2];

    // goal text (show most relevant)
    let goalLine = `Goal: ${g1.done ? '✅' : '⏳'} ${g1.label} (${state.greenTick}/${D.goalGreenSec})`;
    if (g1.done && !g2.done) {
      goalLine = `Goal: ⏳ ${g2.label} (bad ${state.redTick+state.blueTick}/${D.maxBadSec})`;
    }
    if (g1.done && g2.done) goalLine = `Goal: ✅ ผ่านครบ 2/2`;

    // mini text rotates priority
    let miniLine = `Mini: ${m1.done?'✅':'⏳'} Combo ${state.comboMax}/${D.miniCombo} • ${m2.done?'✅':'⏳'} Perfect ${state.perfectCount}/${D.miniPerfect}`;
    if (!m3.done) miniLine += ` • NoJunk ${state.noJunkSec}/${D.miniNoJunkSec}s`;
    else miniLine += ` • ✅ NoJunk`;

    hudQuest(goalLine, miniLine);

    const doneGoals = goals.filter(g=>g.done).length;
    const doneMinis = minis.filter(m=>m.done).length;
    hudSet('hha-goal-done', doneGoals);
    hudSet('hha-mini-done', doneMinis);

    // optional emit
    try{
      ROOT.dispatchEvent(new CustomEvent('quest:update', {
        detail: {
          goal: goalLine,
          mini: miniLine,
          goalsDone: doneGoals,
          goalsTotal: 2,
          minisDone: doneMinis,
          minisTotal: 3
        }
      }));
    }catch{}
  }

  function celebratePerfect(x,y){
    // heavy stars
    try{
      Particles.burstAt && Particles.burstAt(x, y, { kind:'STAR', power: 1.6 });
    }catch{}
    try{
      Particles.scorePop && Particles.scorePop('PERFECT ✨', x, y);
    }catch{}
  }

  // storm control
  function setStorm(on){
    on = !!on;
    if (state.stormOn === on) return;
    state.stormOn = on;
    if (on) {
      state.stormLeft = D.stormLenSec;
      try{ PostFX && PostFX.setStorm(true); }catch{}
      // storm = แรงขึ้น (ชัดขึ้น) ตามที่ขอ
      try{ PostFX && PostFX.setParams({ chroma: 1.55, wobble: 1.15, speedlines: 1.25, scan: 0.62, vignette: 0.92 }); }catch{}
    } else {
      try{ PostFX && PostFX.setStorm(false); }catch{}
      // back to base
      try{ PostFX && PostFX.setParams({ chroma: 1.25, wobble: 0.85, speedlines: 0.70, scan: 0.55, vignette: 0.85 }); }catch{}
    }
  }

  // spawn mul from storm
  function spawnIntervalMul(){
    // storm -> 0.55 = ถี่ขึ้นมาก
    if (state.stormOn) return 0.55;
    return 1.0;
  }

  // pools
  const pools = {
    good: ['💧','💦','🫧','🚰','🧊','🥒','🍉','🫐'],
    bad:  ['🥤','🧃','🍟','🍔','🍩','🍰','🧋','🍬'],
    trick:['💧','🫧'] // fakeGood: โผล่มาเหมือนดี แต่ให้แต้มต่ำ/ลดน้ำเล็กน้อย (เกมจะตัดสินใน judge)
  };

  // judge from mode-factory (called on hit)
  function judge(ch, ctx){
    const x = Number(ctx?.clientX ?? 0);
    const y = Number(ctx?.clientY ?? 0);

    const isPower = !!ctx.isPower;
    const itemType = String(ctx?.itemType || (ctx?.isGood ? 'good' : 'bad'));
    const perfect = !!ctx?.hitPerfect;

    // ---- power (optional) ----
    if (isPower || itemType === 'power') {
      blink('block');
      try{ PostFX && PostFX.flash('block'); }catch{}
      addScore(55, x, y);
      setCombo(state.combo + 1);
      setWater(state.water + 6.0);
      return { good:true, scoreDelta: 55 };
    }

    // ---- fakeGood ----
    if (itemType === 'fakeGood') {
      // หลอก: ได้แต้มต่ำ + water +1 แต่ทำให้คอมโบไม่โตมาก
      blink('good');
      addScore(perfect ? 10 : 6, x, y);
      setCombo(state.combo + (perfect ? 1 : 0));
      setWater(state.water + 1.0);
      if (perfect) {
        state.perfectCount++;
        celebratePerfect(x,y);
        try{ PostFX && PostFX.flash('good'); }catch{}
      }
      return { good:true, scoreDelta: perfect ? 10 : 6 };
    }

    // ---- bad (junk) ----
    if (itemType === 'bad' || ctx?.isGood === false) {
      blink('bad');
      try{ PostFX && PostFX.flash('bad'); }catch{}
      addMiss();
      setCombo(0);
      state.lastJunkHitAt = now();
      state.noJunkSec = 0;
      addScore(D.penBad, x, y);
      setWater(state.water + D.waterBad);
      return { good:false, scoreDelta: D.penBad };
    }

    // ---- good ----
    blink('good');
    const base = D.scoreGood;
    const perfBonus = perfect ? D.scorePerfect : 0;
    const comboBonus = Math.min(24, Math.floor(state.combo * 0.7));
    const delta = base + perfBonus + comboBonus;

    addScore(delta, x, y);
    setCombo(state.combo + 1);
    setWater(state.water + D.waterGood);

    if (perfect) {
      state.perfectCount++;
      celebratePerfect(x,y);
      // ✅ PERFECT: chromatic split กระแทกขึ้น (flash + tilt shimmer)
      try{ PostFX && PostFX.flash('good'); }catch{}
      try{ PostFX && PostFX.setParams({ chroma: 1.75, wobble: state.stormOn ? 1.35 : 1.05, speedlines: state.stormOn ? 1.45 : 0.95 }); }catch{}
      ROOT.setTimeout(()=>{
        // กลับค่าตาม storm/base
        try{
          if (state.stormOn) PostFX && PostFX.setParams({ chroma: 1.55, wobble: 1.15, speedlines: 1.25 });
          else PostFX && PostFX.setParams({ chroma: 1.25, wobble: 0.85, speedlines: 0.70 });
        }catch{}
      }, 220);
    }
    return { good:true, scoreDelta: delta };
  }

  function onExpire(info){
    // เป้าหมดอายุ: ไม่ถือ miss (ตามแนวเกม hydration เดิม)
    // แต่ถ้าปล่อย bad หลุด = ลดน้ำเล็กน้อยเพื่อให้กดดัน
    const itemType = String(info?.itemType || '');
    if (itemType === 'bad') {
      setWater(state.water - 2.0);
    }
  }

  // boot factory spawner
  const hostEl = $('hvr-playfield') || DOC.body;

  const inst = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diffKey,
    duration: duration,
    spawnHost: hostEl,
    pools,
    goodRate: 0.68,
    powerups: ['⭐','🛡️'],
    powerRate: 0.10,
    powerEvery: 7,
    trickRate: 0.09,
    allowAdaptive: true,
    rhythm: null,
    spawnIntervalMul,             // ✅ storm affects spawn interval จริง
    excludeSelectors: ['.hud', '#hvr-start', '#hvr-end'],
    judge,
    onExpire
  });

  // controls: tap empty area -> shoot crosshair (center)
  function onPlayfieldTap(e){
    if (state.stopped) return;
    // ถ้ากดโดน target จริง mode-factory จะกิน event ไปแล้ว
    // ที่นี่คือ “พื้นที่ว่าง” -> ยิงกลางจอ
    try{
      if (inst && typeof inst.shootCrosshair === 'function') {
        const ok = inst.shootCrosshair();
        if (ok) {
          // ยิงโดนแล้ว ให้มี feedback เบา ๆ
          // (อย่าแรงไปซ้อนกับ blink)
        }
      }
    }catch{}
  }
  try{
    hostEl.addEventListener('pointerdown', onPlayfieldTap, { passive:true });
  }catch{}

  // keyboard (PC): Space = shoot
  function onKey(e){
    if (state.stopped) return;
    if (e.code === 'Space') {
      e.preventDefault();
      try{ inst && inst.shootCrosshair && inst.shootCrosshair(); }catch{}
    }
  }
  try{ DOC.addEventListener('keydown', onKey, { passive:false }); }catch{}

  // time tick from factory
  function onTime(ev){
    const sec = Number(ev?.detail?.sec ?? 0);
    state.timeLeft = sec;

    // zone tick (✅ FIX: นับถูกตาม zoneCode เท่านั้น)
    const zc = state.zoneCode;
    if (sec > 0) {
      if (zc === 'GREEN') state.greenTick++;
      else if (zc === 'HIGH') state.redTick++;
      else if (zc === 'LOW') state.blueTick++;

      // no junk time
      const elapsedNoJunk = Math.floor((now() - state.lastJunkHitAt)/1000);
      state.noJunkSec = clamp(elapsedNoJunk, 0, 999);
    }

    // storm scheduling
    const elapsed = duration - sec;
    if (!state.stormOn && elapsed >= state.nextStormAt && sec > 0) {
      setStorm(true);
      state.nextStormAt += D.stormEverySec;
    }
    if (state.stormOn) {
      if (state.stormLeft > 0) state.stormLeft--;
      if (state.stormLeft <= 0) setStorm(false);
    }

    // goal checks (goal1 live, goal2 finalize at end)
    if (!goals[0].done && goals[0].check()) {
      goals[0].done = true;
      state.goalsDone++;
      try{ Particles.celebrate && Particles.celebrate('GOAL'); }catch{}
      try{ PostFX && PostFX.flash('good'); }catch{}
    }

    // mini checks live
    minis.forEach(m=>{
      if (!m.done && m.check()){
        m.done = true;
        state.minisDone++;
        try{ Particles.celebrate && Particles.celebrate('MINI'); }catch{}
        try{ PostFX && PostFX.flash('block'); }catch{}
      }
    });

    updateQuestHud();

    // end
    if (sec <= 0 && !state.stopped) {
      // finalize goal2 at end
      if (!goals[1].done && goals[1].check()) {
        goals[1].done = true;
        state.goalsDone++;
      }
      updateQuestHud();
      endGame();
    }
  }

  ROOT.addEventListener('hha:time', onTime, { passive:true });

  // init water
  setWater(50);
  updateQuestHud();
  updateGrade();

  function endGame(){
    state.stopped = true;
    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
    try{ DOC.removeEventListener('keydown', onKey); }catch{}
    try{ hostEl.removeEventListener('pointerdown', onPlayfieldTap); }catch{}

    try{ inst && inst.stop && inst.stop(); }catch{}
    try{ PostFX && PostFX.destroy(); }catch{}

    const grade = gradeFromScore(state.score);
    const zoneOut = zoneLabel(state.zoneCode);

    // emit end
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:end', { detail: {
        score: state.score,
        grade,
        comboBest: state.comboMax,
        miss: state.miss,
        water: Math.round(state.water),
        zone: zoneOut,
        greenTick: state.greenTick,
        redTick: state.redTick,
        blueTick: state.blueTick,
        fever: 0,
        shield: 0,
        goalsDone: goals.filter(g=>g.done).length,
        goalsTotal: 2,
        minisDone: minis.filter(m=>m.done).length,
        minisTotal: 3
      }}));
    }catch{}
  }

  // return controller
  return {
    stop(){
      if (state.stopped) return;
      state.timeLeft = 0;
      endGame();
    }
  };
}

export default { boot };
