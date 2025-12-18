// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — FUN PATCH 1–8 (Kids Grade 5)
// - spawn targets in #hvr-playfield (scroll-follow)
// - crosshair shooting supported via custom events (hha:shot / hha:airshot)
// - combo + perfect + powerups + sugar-rush wave + grade realtime
//
// requires:
//   ../vr/mode-factory.js
//   ../vr/ui-water.js
//   ./hydration.quest.js
// optional globals (safe fallback):
//   window.GAME_MODULES.Particles or window.Particles
//   window.GAME_MODULES.FeverUI or window.FeverUI

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a : (v>b?b:v); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }

function pickDiff(d){
  d = String(d || 'normal').toLowerCase();
  if (d !== 'easy' && d !== 'hard') d = 'normal';
  return d;
}

function safeParticles(){
  const P =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    {};
  return {
    floatScore: (P.floatScore || function(){}),
    burstAt:    (P.burstAt || function(){}),
    scorePop:   (P.scorePop || function(){}),
    celebrate:  (P.celebrate || P.celebrateQuest || function(){})
  };
}

function safeFeverUI(){
  const F =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    {};
  return {
    ensureFeverBar: (F.ensureFeverBar || function(){}),
    setFever:       (F.setFever || function(){}),
    setFeverActive: (F.setFeverActive || function(){}),
    setShield:      (F.setShield || function(){}),
    getValue:       (F.getValue || function(){ return 0; }),
    isActive:       (F.isActive || function(){ return false; }),
    getShield:      (F.getShield || function(){ return 0; })
  };
}

// ---------- Grade realtime ----------
function calcGrade({ score, miss, goalsCleared, minisCleared, timeLeft, totalTime }){
  const t = Math.max(1, totalTime|0);
  const speed = 1 - (Math.max(0, Math.min(t, timeLeft|0)) / t); // 0..1
  const perf = score - miss*60 + (goalsCleared*350) + (minisCleared*160);
  const bonus = Math.round(speed * 120); // เล่นไว้นิดนึง
  const s = perf + bonus;

  if (s >= 2600 && miss <= 3 && goalsCleared >= 2) return 'SSS';
  if (s >= 2100 && miss <= 5 && goalsCleared >= 2) return 'SS';
  if (s >= 1600 && miss <= 8) return 'S';
  if (s >= 1200) return 'A';
  if (s >= 800)  return 'B';
  return 'C';
}

function setGradeBadge(g){
  const el = DOC && DOC.getElementById('hha-grade-badge');
  if (el) el.textContent = g;
}

function setScoreHUD({ score, comboMax, miss, zone, waterPct, shield, grade, goalsCleared, minisCleared }){
  const s = DOC && DOC.getElementById('hha-score-main');
  if (s) s.textContent = String(score|0);

  const cm = DOC && DOC.getElementById('hha-combo-max');
  if (cm) cm.textContent = String(comboMax|0);

  const ms = DOC && DOC.getElementById('hha-miss');
  if (ms) ms.textContent = String(miss|0);

  const zt = DOC && DOC.getElementById('hha-water-zone-text');
  if (zt) zt.textContent = String(zone || 'GREEN');

  setGradeBadge(grade);

  // ส่ง event ให้ HUD กลาง (hha-hud.js) ฟัง
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:score', {
      detail:{
        score: score|0,
        comboMax: comboMax|0,
        miss: miss|0,
        zone: zone || 'GREEN',
        waterPct: Math.round(waterPct||0),
        shield: shield|0,
        grade,
        goalsCleared: goalsCleared|0,
        minisCleared: minisCleared|0
      }
    }));
  }catch{}
}

function setQuestHUD(goalDone, goalTotal, miniDone, miniTotal, goalText, miniText){
  const gd = DOC && DOC.getElementById('hha-goal-done');
  const gt = DOC && DOC.getElementById('hha-goal-total');
  const md = DOC && DOC.getElementById('hha-mini-done');
  const mt = DOC && DOC.getElementById('hha-mini-total');
  if (gd) gd.textContent = String(goalDone|0);
  if (gt) gt.textContent = String(goalTotal|0);
  if (md) md.textContent = String(miniDone|0);
  if (mt) mt.textContent = String(miniTotal|0);

  const gtxt = DOC && DOC.getElementById('hha-quest-goal');
  const mtxt = DOC && DOC.getElementById('hha-quest-mini');
  if (gtxt && goalText) gtxt.textContent = goalText;
  if (mtxt && miniText) mtxt.textContent = miniText;

  try{
    ROOT.dispatchEvent(new CustomEvent('quest:update', {
      detail:{
        goalDone: goalDone|0, goalTotal: goalTotal|0,
        miniDone: miniDone|0, miniTotal: miniTotal|0,
        goalText: goalText || '', miniText: miniText || ''
      }
    }));
  }catch{}
}

function coachSay(text, mood='neutral'){
  const el = DOC && DOC.getElementById('hha-coach-text');
  if (el) el.textContent = text;

  try{
    ROOT.dispatchEvent(new CustomEvent('hha:coach', {
      detail:{ text, mood }
    }));
  }catch{}
}

function judgeLabel(label, extra={}){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:judge', { detail:{ label, ...extra } }));
  }catch{}
}

function ensureBlinkOverlay(){
  if (!DOC) return;
  if (DOC.getElementById('hvr-screen-blink')) return;

  const div = DOC.createElement('div');
  div.id = 'hvr-screen-blink';
  div.setAttribute('aria-hidden','true');
  DOC.body.appendChild(div);

  const s = DOC.createElement('style');
  s.textContent = `
    #hvr-screen-blink{position:fixed;inset:0;pointer-events:none;opacity:0;z-index:60}
    #hvr-screen-blink.good{background:rgba(34,197,94,0.18)}
    #hvr-screen-blink.bad{background:rgba(249,115,22,0.22)}
    #hvr-screen-blink.block{background:rgba(96,165,250,0.18)}
    #hvr-screen-blink.on{animation:hvrBlink 90ms ease-out 1}
    @keyframes hvrBlink{0%{opacity:0}40%{opacity:1}100%{opacity:0}}
    .hvr-crosshair.ping{animation:hvrPing 90ms ease-out 1}
    @keyframes hvrPing{0%{transform:translate(-50%,-50%) scale(1)}40%{transform:translate(-50%,-50%) scale(.90)}100%{transform:translate(-50%,-50%) scale(1)}}
    .hvr-shake{animation:hvrShake 160ms ease-in-out 1}
    @keyframes hvrShake{
      0%{transform:translate3d(0,0,0)}
      25%{transform:translate3d(-6px,2px,0)}
      50%{transform:translate3d(6px,-2px,0)}
      75%{transform:translate3d(-4px,1px,0)}
      100%{transform:translate3d(0,0,0)}
    }
    .hvr-magnet .hvr-target:not(.bad){ filter: drop-shadow(0 0 18px rgba(59,130,246,.55)); }
  `;
  DOC.head.appendChild(s);
}

function blink(kind){
  const el = DOC && DOC.getElementById('hvr-screen-blink');
  if (!el) return;
  el.classList.remove('good','bad','block','on');
  el.classList.add(kind || 'good');
  void el.offsetWidth;
  el.classList.add('on');
  ROOT.setTimeout(()=> el.classList.remove('on'), 110);
}

function pingCrosshair(mult=1){
  const c = DOC && DOC.getElementById('hvr-crosshair');
  if (!c) return;
  c.classList.remove('ping');
  void c.offsetWidth;
  c.classList.add('ping');

  // ขยายตาม combo เบา ๆ
  const scale = 1 + Math.min(0.16, (mult-1)*0.06);
  c.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(3)})`;
  ROOT.setTimeout(()=>{ c.style.transform = 'translate(-50%,-50%) scale(1)'; }, 140);
}

function vibrate(pat){
  try{ if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(pat); }catch{}
}

let audioCtx = null;
function beep(freq=880, dur=0.06){
  try{
    audioCtx = audioCtx || new (ROOT.AudioContext || ROOT.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.04;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  }catch{}
}

// ======================================================
// Export: boot()
// ======================================================
export async function boot(opts = {}) {
  if (!DOC) return { stop(){} };

  const Particles = safeParticles();
  const FeverUI   = safeFeverUI();

  ensureBlinkOverlay();
  ensureWaterGauge();
  FeverUI.ensureFeverBar();

  const difficulty = pickDiff(opts.difficulty || 'normal');
  const duration   = clamp(opts.duration ?? 80, 20, 180);

  const hostSel = opts.spawnHost || '#hvr-playfield';
  const host = DOC.querySelector(hostSel);
  if (!host) {
    console.warn('[HydrationVR] spawnHost not found -> fallback overlay');
  }

  // ---------- Core state ----------
  let stopped = false;

  let totalTime = duration|0;
  let timeLeft  = duration|0;

  let score = 0;
  let miss  = 0;

  let comboNow = 0;
  let comboMax = 0;

  // water model: 0..100 (GREEN 35..65)
  let waterPct = 50;

  // shield from FeverUI
  let shield = 0;

  // multipliers
  function multiplier(){
    // 0-4 => x1, 5-9 => x1.5, 10-14 => x2, 15+ => x2.5 max x3
    const tier = Math.floor((comboNow||0) / 5);
    return clamp(1 + tier*0.5, 1, 3);
  }

  // PERFECT rule: hit streak speed (time between hits)
  let lastHitAt = 0;

  // Fever mode (temporary “super”)
  let feverActiveUntil = 0;

  // Magnet mode (pull good targets closer to crosshair feel)
  let magnetUntil = 0;

  // Double score mode
  let doubleUntil = 0;

  // Freeze time/spawn
  let freezeUntil = 0;

  // slow-mo wave override
  let slowUntil = 0;

  // Sugar Rush wave
  let rushUntil = 0;
  let nextRushAt = 20; // seconds elapsed to trigger

  const quest = createHydrationQuest(difficulty);

  // ---------- pools (emoji) ----------
  const pools = {
    good: ['💧','🥛','🍉','🍊','🍎','🥝'],
    bad:  ['🥤','🍟','🍩','🍭','🧋','🍰']
  };

  const powerups = ['🛡️','❄️','✨','🧲','⚡','⏳'];

  // ---------- spawner instance ----------
  let spawner = null;

  async function startSpawner(overrides = {}) {
    if (spawner && typeof spawner.stop === 'function') {
      try{ spawner.stop(); }catch{}
    }

    const inRush = now() < rushUntil;
    const inSlow = now() < slowUntil;
    const inFreeze = now() < freezeUntil;

    const goodRate =
      inRush ? 0.40 :
      (difficulty === 'easy' ? 0.66 : (difficulty === 'hard' ? 0.56 : 0.60));

    const powerRate =
      (difficulty === 'easy') ? 0.14 :
      (difficulty === 'hard') ? 0.10 : 0.12;

    const spawnInterval =
      inFreeze ? 999999 : (inRush ? 520 : (inSlow ? 980 : undefined));

    // ใช้ HHA_DIFF_TABLE ได้ (mode-factory จะ pick ให้เอง) แต่เรายัด spawnInterval override ได้
    spawner = await factoryBoot({
      modeKey: 'hydration',
      difficulty,
      duration: totalTime,

      spawnHost: hostSel, // ✅ ทำให้เป้าอยู่ใน playfield และเลื่อนตาม scroll

      pools,
      goodRate,
      powerups,
      powerRate,
      powerEvery: 6,

      // override spawn behavior
      ...(spawnInterval ? { _spawnIntervalOverride: spawnInterval } : {}),
      ...overrides,

      // judge = core gameplay
      judge: (ch, ctx) => onJudge(ch, ctx),

      // expire = miss only when good expires
      onExpire: ({ ch, isGood, isPower }) => {
        if (stopped) return;

        // powerup/ junk expire ไม่คิด miss (เบาลงให้สนุก)
        if (!isGood || isPower) return;

        // good expired = MISS
        applyMiss('MISS', { reason:'expire', ch });
      }
    });

    // ✅ NOTE: mode-factory ของคุณยังไม่อ่าน _spawnIntervalOverride
    // ถ้าคุณอยากให้ override มีผลจริง ให้บอก เดี๋ยวผม patch mode-factory เพิ่มให้
  }

  // ---------- visuals helper ----------
  function shake(){
    const wrap = DOC.getElementById('hvr-wrap') || DOC.body;
    if (!wrap) return;
    wrap.classList.remove('hvr-shake');
    void wrap.offsetWidth;
    wrap.classList.add('hvr-shake');
    ROOT.setTimeout(()=> wrap.classList.remove('hvr-shake'), 220);
  }

  function setMagnet(on){
    const wrap = DOC.getElementById('hvr-wrap');
    if (!wrap) return;
    if (on) wrap.classList.add('hvr-magnet');
    else wrap.classList.remove('hvr-magnet');
  }

  // “magnet feel” = ขยับเป้าดีให้เข้าใกล้ crosshair เล็กน้อยทุก frame ช่วงสั้น ๆ
  let magnetRaf = null;
  function magnetLoop(){
    if (stopped) return;
    const t = now();
    if (t >= magnetUntil) {
      setMagnet(false);
      magnetRaf = null;
      return;
    }
    setMagnet(true);

    const c = DOC.getElementById('hvr-crosshair');
    const pf = DOC.getElementById('hvr-playfield');
    if (c && pf) {
      const cr = c.getBoundingClientRect();
      const cx = cr.left + cr.width/2;
      const cy = cr.top  + cr.height/2;

      const tgts = pf.querySelectorAll('.hvr-target:not(.bad)');
      tgts.forEach(el=>{
        const r = el.getBoundingClientRect();
        const x = r.left + r.width/2;
        const y = r.top  + r.height/2;

        // ดึงเข้าหาศูนย์กลาง 10%
        const nx = x + (cx - x) * 0.10;
        const ny = y + (cy - y) * 0.10;

        // แปลงเป็นตำแหน่ง local ของ playfield
        const pr = pf.getBoundingClientRect();
        const lx = nx - pr.left;
        const ly = ny - pr.top;

        el.style.left = lx + 'px';
        el.style.top  = ly + 'px';
      });
    }

    magnetRaf = ROOT.requestAnimationFrame(magnetLoop);
  }

  function startMagnet(ms=2800){
    magnetUntil = now() + ms;
    if (!magnetRaf) magnetRaf = ROOT.requestAnimationFrame(magnetLoop);
  }

  // ---------- scoring / miss ----------
  function applyMiss(label='MISS', extra={}){
    miss += 1;
    comboNow = 0;

    // น้ำเสียลง
    waterPct = clamp(waterPct - 6, 0, 100);
    const w = setWaterGauge(waterPct);
    quest.onJunk();

    // fever ลดนิด
    const fv = clamp(FeverUI.getValue() - 10, 0, 100);
    FeverUI.setFever(fv);

    blink('bad');
    shake();
    vibrate([18, 28, 18]);
    beep(420, 0.06);

    judgeLabel(label, extra);

    // FX
    try{ Particles.floatScore('MISS', (extra.clientX||0), (extra.clientY||0), { type:'miss' }); }catch{}
    pushHUD();
  }

  function awardScore(delta, label='GOOD', x=0, y=0){
    score += (delta|0);
    if (score < 0) score = 0;

    judgeLabel(label, { scoreDelta: delta|0, clientX:x, clientY:y });

    // FX
    try{ Particles.burstAt(x, y, { kind: label.toLowerCase() }); }catch{}
    try{ Particles.floatScore((delta>=0?'+':'') + String(delta|0), x, y, { type:label.toLowerCase() }); }catch{}
  }

  // ---------- powerups ----------
  function powerup(ch){
    const t = now();

    if (ch === '🛡️') {
      shield = clamp((shield|0) + 1, 0, 9);
      FeverUI.setShield(shield);
      coachSay('ได้เกราะแล้ว! โดนของหวานจะ “BLOCK” 🛡️', 'happy');
      blink('block'); beep(740,0.06); vibrate(12);
      return;
    }

    if (ch === '❄️') {
      freezeUntil = t + 2200;
      coachSay('FREEZE! เป้าช้าลง 2 วิ ❄️', 'happy');
      blink('good'); beep(660,0.06); vibrate([12,18,12]);
      return;
    }

    if (ch === '✨') {
      doubleUntil = t + 4200;
      coachSay('DOUBLE SCORE! คะแนนคูณ 2 ✨', 'happy');
      blink('good'); beep(980,0.06); vibrate(16);
      return;
    }

    if (ch === '🧲') {
      startMagnet(3200);
      coachSay('MAGNET! เป้าดีเข้าหาวงเล็ง 🧲', 'happy');
      blink('good'); beep(880,0.06); vibrate(16);
      return;
    }

    if (ch === '⚡') {
      // เติม fever
      const fv = clamp(FeverUI.getValue() + 28, 0, 100);
      FeverUI.setFever(fv);
      coachSay('พลังมา! FEVER เพิ่ม ⚡', 'happy');
      blink('good'); beep(920,0.06); vibrate(18);
      return;
    }

    if (ch === '⏳') {
      slowUntil = t + 4200;
      coachSay('SLOW-MO! เป้าโผล่ช้าลง ⏳', 'neutral');
      blink('good'); beep(600,0.06); vibrate(14);
      return;
    }
  }

  // ---------- FEVER mode trigger ----------
  function tryStartFeverMode(){
    const t = now();
    const fv = FeverUI.getValue();
    if (fv >= 100 && t >= feverActiveUntil) {
      feverActiveUntil = t + 6000;
      FeverUI.setFeverActive(true);
      coachSay('FEVER MODE! เก็บแต้มรัว ๆ 🔥', 'happy');
      blink('good'); vibrate([20,30,20]); beep(1040,0.08);
    }
  }

  function updateFeverMode(){
    const t = now();
    if (t < feverActiveUntil) return;

    // หมด fever
    if (FeverUI.isActive && FeverUI.isActive()) {
      FeverUI.setFeverActive(false);
      FeverUI.setFever(0);
      coachSay('หมด FEVER แล้ว สู้ต่อ! 💪', 'neutral');
    }
  }

  // ---------- sugar rush wave (mini-boss) ----------
  function maybeStartRush(elapsedSec){
    if (elapsedSec < nextRushAt) return;
    nextRushAt += 20;

    rushUntil = now() + 6000;

    coachSay('SUGAR RUSH! ของหวานบุก 6 วิ 😱 หลบให้ได้!', 'sad');
    blink('bad'); shake(); vibrate([20,40,20]); beep(520,0.08);

    // (optional) ให้รางวัลถ้ารอด: เราจะให้โบนัสตอน wave จบ (ใน tick)
  }

  let rushRewarded = false;
  function maybeEndRush(){
    const t = now();
    if (t < rushUntil) { rushRewarded = false; return; }
    if (rushUntil === 0) return;
    if (rushRewarded) return;

    // รอด wave → โบนัส
    rushRewarded = true;
    rushUntil = 0;

    const bonus = 180;
    awardScore(bonus, 'BONUS', ROOT.innerWidth/2, ROOT.innerHeight*0.55);
    coachSay('เก่งมาก! รอด SUGAR RUSH ได้ +BONUS 🎉', 'happy');
    blink('good'); vibrate([12,20,12]); beep(980,0.07);

    try{ Particles.celebrate(); }catch{}
  }

  // ---------- judge core ----------
  function onJudge(ch, ctx = {}){
    if (stopped) return { good:true, scoreDelta:0 };

    const t = now();

    // freeze? ช่วยให้ “กดแล้วได้แต้ม” แต่ไม่เพิ่มความยาก
    updateFeverMode();
    tryStartFeverMode();

    const isPower = !!ctx.isPower;
    const isGood  = !!ctx.isGood;

    // pos for fx
    const x = Number(ctx.clientX ?? ctx.cx ?? (ROOT.innerWidth/2)) || (ROOT.innerWidth/2);
    const y = Number(ctx.clientY ?? ctx.cy ?? (ROOT.innerHeight/2)) || (ROOT.innerHeight/2);

    // ===== POWERUP =====
    if (isPower) {
      comboNow += 1;
      comboMax = Math.max(comboMax, comboNow);
      quest.onGood();
      quest.updateCombo(comboNow);
      powerup(ch);

      const base = 60;
      const mult = multiplier();
      const dbl  = (t < doubleUntil) ? 2 : 1;
      const delta = Math.round(base * mult * dbl);

      awardScore(delta, 'POWER', x, y);
      blink('good'); vibrate(12); beep(900,0.06);
      pushHUD();

      return { good:true, scoreDelta: delta };
    }

    // ===== JUNK / BAD =====
    if (!isGood) {
      // shield block?
      if ((shield|0) > 0) {
        shield -= 1;
        FeverUI.setShield(shield);

        comboNow = Math.max(0, comboNow - 1); // ไม่รีเซ็ตหมด ให้ยังลุ้น
        blink('block'); beep(700,0.06); vibrate(12);

        awardScore(10, 'BLOCK', x, y);
        judgeLabel('BLOCK', { ch, clientX:x, clientY:y });

        pushHUD();
        return { good:true, scoreDelta: 10 };
      }

      // ไม่มีเกราะ = MISS หนัก
      applyMiss('MISS', { reason:'junk', ch, clientX:x, clientY:y });
      return { good:false, scoreDelta: -80 };
    }

    // ===== GOOD =====
    const dt = (lastHitAt ? (t - lastHitAt) : 99999);
    lastHitAt = t;

    comboNow += 1;
    comboMax = Math.max(comboMax, comboNow);

    const mult = multiplier();
    const dbl  = (t < doubleUntil) ? 2 : 1;

    // PERFECT: ยิงติดเร็ว (เด็กจะชอบ)
    const perfect = (dt <= 420);
    const base = perfect ? 120 : 80;

    // FEVER: ถ้าอยู่ใน fever mode ให้โบนัสเพิ่ม
    const feverBonus = (t < feverActiveUntil) ? 1.25 : 1.0;

    const delta = Math.round(base * mult * dbl * feverBonus);

    // น้ำดีขึ้น
    waterPct = clamp(waterPct + (perfect ? 5 : 4), 0, 100);
    const w = setWaterGauge(waterPct);
    quest.onGood();

    // fever เพิ่ม
    FeverUI.setFever(clamp(FeverUI.getValue() + (perfect ? 8 : 6), 0, 100));

    quest.updateCombo(comboNow);
    quest.updateScore(score);

    // feedback
    if (perfect) {
      awardScore(delta, 'PERFECT', x, y);
      blink('good'); pingCrosshair(mult);
      vibrate([12,18,12]);
      beep(980,0.06);
    } else {
      awardScore(delta, 'GOOD', x, y);
      blink('good'); pingCrosshair(mult);
      vibrate(12);
      beep(860,0.05);
    }

    pushHUD();
    return { good:true, scoreDelta: delta };
  }

  // ---------- listen to crosshair shooter events ----------
  function onAirshot(ev){
    if (stopped) return;
    // ยิงพลาด = miss เบา ๆ (ไม่เท่าโดน junk)
    const x = ev?.detail?.x ?? (ROOT.innerWidth/2);
    const y = ev?.detail?.y ?? (ROOT.innerHeight*0.58);

    // เบากว่า miss ปกติ
    miss += 1;
    comboNow = 0;
    waterPct = clamp(waterPct - 3, 0, 100);
    setWaterGauge(waterPct);

    blink('bad'); vibrate(10); beep(220,0.05);
    judgeLabel('MISS', { reason:'airshot', clientX:x, clientY:y });

    try{ Particles.floatScore('AIR!', x, y, { type:'miss' }); }catch{}
    pushHUD();
  }

  // ---------- push HUD / quest ----------
  function pushHUD(){
    const zone = zoneFrom(waterPct);

    // quest view
    const goals = quest.getProgress('goals');
    const minis = quest.getProgress('mini');

    const goalDone = (quest.goals || []).filter(x=>x._done).length;
    const goalTotal = (quest.goals || []).length || 2;

    const miniDone = (quest.minis || []).filter(x=>x._done).length;
    const miniTotal = (quest.minis || []).length || 3;

    // quest text ให้ลุ้น
    const gInfo = quest.getGoalProgressInfo ? quest.getGoalProgressInfo('goal-green-time') : null;
    const mInfo = quest.getMiniProgressInfo ? quest.getMiniProgressInfo('mini-no-junk') : null;

    const goalText = gInfo ? `Goal: โซน GREEN ${gInfo.text}` : 'Goal: รักษาโซนน้ำสีเขียว';
    const miniText = mInfo ? `Mini: ${mInfo.text}` : 'Mini: เก็บน้ำดีต่อเนื่อง';

    setQuestHUD(goalDone, goalTotal, miniDone, miniTotal, goalText, miniText);

    // grade
    const grade = calcGrade({
      score, miss,
      goalsCleared: goalDone,
      minisCleared: miniDone,
      timeLeft, totalTime
    });

    setScoreHUD({
      score, comboMax, miss,
      zone, waterPct,
      shield,
      grade,
      goalsCleared: goalDone,
      minisCleared: miniDone
    });
  }

  // ---------- time sync (listen from mode-factory) ----------
  let startTs = now();
  let lastSecLeft = totalTime;

  function onTime(ev){
    if (stopped) return;
    const sec = Number(ev?.detail?.sec);
    if (!Number.isFinite(sec)) return;

    timeLeft = sec|0;

    // เมื่อ sec เปลี่ยน → tick quest.second()
    if (timeLeft !== lastSecLeft) {
      const elapsed = totalTime - timeLeft;

      quest.second();
      // โซน GREEN tick
      const z = zoneFrom(waterPct);
      quest.stats.zone = z;
      if (z === 'GREEN') quest.stats.greenTick += 1;

      // sugar rush trigger
      maybeStartRush(elapsed);

      // wave end reward check
      if (now() > rushUntil) maybeEndRush();

      // fever mode lifecycle
      updateFeverMode();
      tryStartFeverMode();

      // freeze/slow feedback (coach hint นาน ๆ ที)
      if (now() < freezeUntil && (elapsed % 2 === 0)) coachSay('FREEZE อยู่! รีบเก็บแต้ม ❄️', 'happy');
      if (now() < doubleUntil && (elapsed % 3 === 0)) coachSay('DOUBLE SCORE! ยิงให้ไว ✨', 'happy');

      lastSecLeft = timeLeft;
      pushHUD();

      // end
      if (timeLeft <= 0) finish();
    }
  }

  function finish(){
    if (stopped) return;
    stopped = true;

    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
    try{ ROOT.removeEventListener('hha:airshot', onAirshot); }catch{}
    try{ if (spawner && spawner.stop) spawner.stop(); }catch{}

    // final grade
    const goalDone = (quest.goals || []).filter(x=>x._done).length;
    const miniDone = (quest.minis || []).filter(x=>x._done).length;
    const grade = calcGrade({
      score, miss,
      goalsCleared: goalDone,
      minisCleared: miniDone,
      timeLeft: 0, totalTime
    });

    setGradeBadge(grade);

    coachSay(`จบเกม! ได้เกรด ${grade} 🎉 คะแนน ${score} พลาด ${miss}`, 'happy');
    blink('good'); vibrate([20,30,20]); beep(980,0.08);

    try{ Particles.celebrate(); }catch{}

    try{
      ROOT.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          mode:'hydration',
          score, miss,
          comboMax,
          grade,
          goalsCleared: goalDone,
          minisCleared: miniDone
        }
      }));
    }catch{}
  }

  // ---------- init ----------
  coachSay('ภารกิจ: รักษาน้ำให้อยู่โซน GREEN 💧 ยิงน้ำดี เลี่ยงน้ำหวาน!', 'neutral');
  setWaterGauge(waterPct);
  FeverUI.setShield(shield);
  pushHUD();

  ROOT.addEventListener('hha:time', onTime);
  ROOT.addEventListener('hha:airshot', onAirshot);

  // start spawner
  await startSpawner();

  return {
    stop(){ finish(); }
  };
}

export default { boot };
