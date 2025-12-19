// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// - spawn targets via mode-factory (DOM)
// - water gauge (GREEN/LOW/HIGH)
// - fever gauge + shield (via global FeverUI from ./vr/ui-fever.js)
// - quest goal + mini quest (hydration.quest.js)
// - HUD events: hha:score / hha:judge / quest:update / hha:coach / hha:time

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

// --------------------- Globals / helpers ---------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, min, max){
  v = Number(v) || 0;
  return v < min ? min : (v > max ? max : v);
}

function $id(id){ return document.getElementById(id); }

function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

// FX layer (particles.js IIFE)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, toast(){}, };

function getFeverUI(){
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
}

// --------------------- Tuning (เด็ก ป.5) ---------------------
const TUNE = {
  // water balance move
  goodWaterPush:  +6,    // เก็บน้ำดี → น้ำเพิ่ม
  junkWaterPush:  -9,    // โดนน้ำหวาน → น้ำลด
  waterDriftPerSec: -0.8,// น้ำค่อย ๆ ลดเอง (กันค้าง GREEN ฟรี)

  // scoring
  scoreGood:   18,
  scorePower:  28,
  scoreJunk:  -25,
  scorePerfectBonus: 8,  // ถ้ายิง/แตะใน FEVER หรือคอมโบสูง

  // fever
  feverGainGood:  9,     // เก็บน้ำดี → เพิ่ม FEVER
  feverGainPower: 14,
  feverLoseJunk:  18,    // โดนน้ำหวาน → ลด FEVER
  feverAutoDecay: 1.2,   // ลด FEVER ต่อวินาทีเล็กน้อย (ไม่ให้ค้าง)

  // fever trigger
  feverTriggerAt: 100,
  feverDurationSec: 6,

  // shield
  shieldOnFeverStart: 2, // เข้า FEVER → ได้เกราะ 2
  shieldMax: 6,

  // miss policy (concept):
  // - ปล่อย "น้ำดี" หลุด = miss (เพื่อให้ท้าทาย)
  // - ปล่อย "น้ำหวาน" หลุด = ไม่ miss (ถือว่าดี)
  missOnGoodExpire: true
};

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  // --- bind HUD widgets ---
  ensureWaterGauge();

  const FeverUI = getFeverUI();
  if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') {
    FeverUI.ensureFeverBar();
    FeverUI.setFever(0);
    FeverUI.setFeverActive(false);
    FeverUI.setShield(0);
  } else {
    console.warn('[HydrationVR] FeverUI not found or missing functions. Check: ./vr/ui-fever.js loaded before module.');
  }

  // --- runtime state ---
  const state = {
    diff: difficulty,
    timeLeft: duration,

    score: 0,
    combo: 0,
    comboBest: 0,
    miss: 0,

    // water gauge
    waterPct: 50,     // 0..100
    zone: 'GREEN',
    greenTick: 0,     // seconds in GREEN

    // fever
    fever: 0,
    feverActive: false,
    feverLeft: 0,     // seconds remaining in FEVER
    shield: 0
  };

  // --- Quest deck ---
  const Q = createHydrationQuest(difficulty);

  // --- host / playfield ---
  const playfield = $id('hvr-playfield') || null;

  // expose instance (เผื่อ debug)
  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} }
  };

  // --------------------- HUD update helpers ---------------------
  function updateWaterHud(){
    const out = setWaterGauge(state.waterPct);
    state.zone = out.zone;

    const ztxt = $id('hha-water-zone-text');
    if (ztxt) ztxt.textContent = state.zone;
  }

  function updateScoreHud(label){
    // grade / progress to S (30%) : ใช้เกณฑ์ง่าย ๆ = score+quests
    // ProgressToS = clamp( (score / 1200)*0.7 + (goalsDone/2)*0.2 + (miniDone/3)*0.1, 0..1)
    const goalsDone = Number($id('hha-goal-done')?.textContent || 0) || 0;
    const miniDone  = Number($id('hha-mini-done')?.textContent || 0) || 0;
    const prog = clamp((state.score / 1200) * 0.7 + (goalsDone/2) * 0.2 + (miniDone/3) * 0.1, 0, 1);
    const progPct = Math.round(prog * 100);

    const fill = $id('hha-grade-progress-fill');
    const txt  = $id('hha-grade-progress-text');
    if (fill) fill.style.width = progPct + '%';
    if (txt) txt.textContent = `Progress to S (30%): ${progPct}%`;

    // badge แบบง่าย ๆ
    let grade = 'C';
    if (progPct >= 95) grade = 'SSS';
    else if (progPct >= 85) grade = 'SS';
    else if (progPct >= 70) grade = 'S';
    else if (progPct >= 50) grade = 'A';
    else if (progPct >= 30) grade = 'B';

    const gb = $id('hha-grade-badge');
    if (gb) gb.textContent = grade;

    // basic score HUD
    const sc = $id('hha-score-main'); if (sc) sc.textContent = String(state.score|0);
    const cb = $id('hha-combo-max');  if (cb) cb.textContent = String(state.comboBest|0);
    const ms = $id('hha-miss');       if (ms) ms.textContent = String(state.miss|0);

    dispatch('hha:score', {
      score: state.score|0,
      combo: state.combo|0,
      comboBest: state.comboBest|0,
      miss: state.miss|0,
      zone: state.zone,
      water: Math.round(state.waterPct),
      fever: Math.round(state.fever),
      feverActive: !!state.feverActive,
      shield: state.shield|0,
      label: label || ''
    });
  }

  function updateQuestHud(){
    // ใช้ progressInfo จาก hydration.quest.js
    const goals = Q.getProgress('goals');
    const minis = Q.getProgress('mini');

    // counts (done)
    const allGoals = Q.goals || [];
    const allMinis = Q.minis || [];
    const goalsDone = allGoals.filter(g => g._done || g.done).length;
    const minisDone = allMinis.filter(m => m._done || m.done).length;

    const gd = $id('hha-goal-done'); if (gd) gd.textContent = String(goalsDone);
    const gt = $id('hha-goal-total'); if (gt) gt.textContent = String(allGoals.length || 2);
    const md = $id('hha-mini-done'); if (md) md.textContent = String(minisDone);
    const mt = $id('hha-mini-total'); if (mt) mt.textContent = String(allMinis.length || 3);

    // show current goal/mini line
    const curGoal = (goals && goals[0]) ? goals[0].id : (allGoals[0]?.id || '');
    const curMini = (minis && minis[0]) ? minis[0].id : (allMinis[0]?.id || '');

    const gInfo = Q.getGoalProgressInfo ? Q.getGoalProgressInfo(curGoal) : null;
    const mInfo = Q.getMiniProgressInfo ? Q.getMiniProgressInfo(curMini) : null;

    const goalEl = $id('hha-quest-goal');
    const miniEl = $id('hha-quest-mini');

    if (goalEl) goalEl.textContent = gInfo?.text ? `Goal: ${gInfo.text}` : `Goal: ทำภารกิจให้ครบ`;
    if (miniEl) miniEl.textContent = mInfo?.text ? `Mini: ${mInfo.text}` : `Mini: ทำมินิเควส`;

    dispatch('quest:update', {
      goalDone: goalsDone,
      goalTotal: allGoals.length || 2,
      miniDone: minisDone,
      miniTotal: allMinis.length || 3,
      goalText: goalEl ? goalEl.textContent : '',
      miniText: miniEl ? miniEl.textContent : ''
    });

    // ให้คะแนน/เกรดอัปเดตตาม progress
    updateScoreHud();
  }

  // --------------------- Fever logic (สำคัญ) ---------------------
  function feverRender(){
    const F = getFeverUI();
    if (!F) return;
    if (typeof F.setFever === 'function') F.setFever(state.fever);
    if (typeof F.setFeverActive === 'function') F.setFeverActive(state.feverActive);
    if (typeof F.setShield === 'function') F.setShield(state.shield);
  }

  function feverStart(){
    state.feverActive = true;
    state.feverLeft = TUNE.feverDurationSec;
    state.fever = TUNE.feverTriggerAt;

    // give shield
    state.shield = clamp(state.shield + TUNE.shieldOnFeverStart, 0, TUNE.shieldMax);

    feverRender();
    dispatch('hha:fever', { state:'start', value: state.fever, active:true, shield: state.shield });

    // coach + FX
    dispatch('hha:coach', { text:'🔥 FEVER! แตะให้ไว คะแนนคูณ! +ได้เกราะด้วย 🛡️', mood:'happy' });
    try{ Particles.celebrate && Particles.celebrate('fever'); }catch{}
  }

  function feverEnd(){
    state.feverActive = false;
    state.feverLeft = 0;
    // ไม่รีเซ็ต fever เป็น 0 ทันที ให้คงค่าลดต่อได้ (ดูสวย)
    state.fever = clamp(state.fever * 0.35, 0, 100);
    feverRender();
    dispatch('hha:fever', { state:'end', value: state.fever, active:false, shield: state.shield });
    dispatch('hha:coach', { text:'ดีมาก! FEVER จบแล้ว กลับไปรักษา GREEN ต่อ 💧', mood:'neutral' });
  }

  function feverAdd(v){
    if (state.feverActive) return; // ระหว่าง FEVER ไม่สะสมเพิ่ม
    state.fever = clamp(state.fever + (Number(v)||0), 0, 100);
    if (state.fever >= TUNE.feverTriggerAt) feverStart();
    else feverRender();
  }

  function feverLose(v){
    if (state.feverActive) return;
    state.fever = clamp(state.fever - (Number(v)||0), 0, 100);
    feverRender();
  }

  // --------------------- Judge (hit logic) ---------------------
  function judge(ch, ctx){
    // ctx: { isGood, isPower, clientX, clientY }
    const isGood = !!ctx.isGood;
    const isPower = !!ctx.isPower;

    let scoreDelta = 0;
    let label = 'GOOD';

    // FEVER multiplier
    const mult = state.feverActive ? 2 : 1;

    if (isPower){
      scoreDelta = TUNE.scorePower * mult;
      label = 'POWER';
    } else if (isGood){
      scoreDelta = TUNE.scoreGood * mult;
      label = 'GOOD';
    } else {
      // junk hit: shield block?
      if (state.shield > 0){
        state.shield -= 1;
        scoreDelta = 0;
        label = 'BLOCK';
        dispatch('hha:judge', { label:'BLOCK' });
        feverRender();
        updateScoreHud('BLOCK');
        return { scoreDelta, label, good:false, blocked:true };
      }
      scoreDelta = TUNE.scoreJunk;
      label = 'JUNK';
    }

    // combo rules
    if (isGood || isPower){
      state.combo += 1;
      if (state.combo > state.comboBest) state.comboBest = state.combo;
    } else {
      state.combo = 0;
      state.miss += 1; // โดน junk = miss ตาม concept
    }

    // score
    state.score = Math.max(0, (state.score + scoreDelta) | 0);

    // water move
    if (isPower || isGood){
      state.waterPct = clamp(state.waterPct + TUNE.goodWaterPush, 0, 100);
      // fever gain
      feverAdd(isPower ? TUNE.feverGainPower : TUNE.feverGainGood);
      Q.onGood();
    } else {
      state.waterPct = clamp(state.waterPct + TUNE.junkWaterPush, 0, 100);
      feverLose(TUNE.feverLoseJunk);
      Q.onJunk();
    }

    // quest stats
    Q.updateScore(state.score);
    Q.updateCombo(state.combo);

    updateWaterHud();

    // FX
    try{
      Particles.burstAt && Particles.burstAt(ctx.clientX || 0, ctx.clientY || 0, label);
      Particles.scorePop && Particles.scorePop(ctx.clientX || 0, ctx.clientY || 0, scoreDelta, label);
    }catch{}

    dispatch('hha:judge', { label });

    updateQuestHud(); // รวมถึง updateScoreHud ในนี้แล้ว
    return { scoreDelta, label, good: (isGood || isPower) };
  }

  // --------------------- Expire (ของหลุด) ---------------------
  function onExpire(info){
    // info: { ch,isGood,isPower }
    if (info && info.isGood && !info.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;

      // น้ำดีหลุด = น้ำลดนิดหน่อย (concept: ไม่ดูดน้ำ)
      state.waterPct = clamp(state.waterPct - 3, 0, 100);

      // quest: ถือว่า “พลาด”
      dispatch('hha:judge', { label:'MISS' });
      updateWaterHud();
      updateScoreHud('MISS');
    }
    // ปล่อย junk หลุด = ถือว่าดี ไม่ miss
  }

  // --------------------- Clock tick (สำคัญต่อ GREEN tick) ---------------------
  let timer = null;

  function secondTick(){
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time', { sec: state.timeLeft });

    // water drift
    state.waterPct = clamp(state.waterPct + TUNE.waterDriftPerSec, 0, 100);
    updateWaterHud();

    // GREEN tick counting (แก้ปัญหา "อยู่ GREEN แต่ไม่นับ")
    // ✅ ต้องนับจาก zoneFrom(waterPct) ทุกวินาที
    const z = zoneFrom(state.waterPct);
    if (z === 'GREEN'){
      state.greenTick += 1;
    }
    // sync to quest internal timer
    // ให้ quest.second() เดินตลอดเพื่อคำนวณ badZone/green
    Q.second();

    // fever tick / decay
    if (state.feverActive){
      state.feverLeft -= 1;
      if (state.feverLeft <= 0) feverEnd();
      else {
        // ระหว่าง FEVER ให้โชว์ 100% คงที่
        state.fever = 100;
        feverRender();
      }
    } else {
      // decay เล็กน้อย
      state.fever = clamp(state.fever - TUNE.feverAutoDecay, 0, 100);
      feverRender();
    }

    // update quest hud (ให้ goal/minis ขยับ)
    updateQuestHud();
  }

  // --------------------- Start spawner ---------------------
  const spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    // ✅ ไม่ต้อง scroll — spawn บน playfield fullscreen (absolute)
    spawnHost: playfield ? '#hvr-playfield' : null,

    pools: {
      good: ['💧','🥛','🍉','🥥','🍊'],
      bad:  ['🥤','🧋','🍟','🍔']
    },
    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    judge: (ch, ctx) => {
      // power types:
      if (ctx.isPower && ch === '🛡️'){
        state.shield = clamp(state.shield + 1, 0, TUNE.shieldMax);
        feverRender();
        dispatch('hha:judge', { label:'SHIELD+' });
        updateScoreHud('SHIELD+');
      }
      if (ctx.isPower && ch === '⏱️'){
        // เพิ่มเวลาเล็กน้อย (เด็กชอบ)
        state.timeLeft = clamp(state.timeLeft + 3, 0, 180);
        dispatch('hha:time', { sec: state.timeLeft });
        dispatch('hha:judge', { label:'TIME+' });
      }
      return judge(ch, ctx);
    },

    onExpire
  });

  // init HUD
  updateWaterHud();
  updateQuestHud();
  updateScoreHud();
  feverRender();

  // start timer
  timer = ROOT.setInterval(secondTick, 1000);

  // stop cleanup
  const onStop = () => stop();
  ROOT.addEventListener('hha:stop', onStop);

  function stop(){
    try{ if (timer) ROOT.clearInterval(timer); }catch{}
    timer = null;

    try{ spawner && spawner.stop && spawner.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}

    dispatch('hha:end', {
      score: state.score|0,
      miss: state.miss|0,
      comboBest: state.comboBest|0,
      water: Math.round(state.waterPct),
      zone: state.zone,
      greenTick: state.greenTick|0
    });
  }

  // ถ้าหมดเวลาใน mode-factory จะยิง hha:time(0) แล้ว stop() เองอยู่แล้ว
  // แต่เรากันซ้ำไว้:
  ROOT.addEventListener('hha:time', (e)=>{
    const sec = Number(e?.detail?.sec);
    if (Number.isFinite(sec) && sec <= 0) stop();
  }, { passive:true });

  return { stop };
}

export default { boot };
