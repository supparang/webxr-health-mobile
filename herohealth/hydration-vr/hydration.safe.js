// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// - spawn targets via mode-factory (DOM)
// - water gauge (GREEN/LOW/HIGH)
// - fever gauge + shield (via global FeverUI from ./vr/ui-fever.js)
// - quest goal + mini quest (hydration.quest.js)
// - HUD events: hha:score / hha:judge / quest:update / hha:coach / hha:time
// ✅ PATCH: celebrate+reward per goal/mini + end summary modal-friendly payload

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
  goodWaterPush:  +6,
  junkWaterPush:  -9,
  waterDriftPerSec: -0.8,

  // scoring
  scoreGood:   18,
  scorePower:  28,
  scoreJunk:  -25,
  scorePerfectBonus: 10,      // ✅ ให้รู้สึก “ยิงตรงวงใน” ได้จริง
  scoreFeverBonus: 6,         // ✅ แตะระหว่าง FEVER เพิ่มอีกนิด

  // fever
  feverGainGood:  9,
  feverGainPower: 14,
  feverLoseJunk:  18,
  feverAutoDecay: 1.2,

  feverTriggerAt: 100,
  feverDurationSec: 6,

  // shield
  shieldOnFeverStart: 2,
  shieldMax: 6,

  // miss policy
  missOnGoodExpire: true,

  // ✅ Rewards (ฉลอง + รางวัล)
  rewardGoalScore:  120,      // ผ่าน GOAL ได้แต้มโบนัส
  rewardMiniScore:   80,      // ผ่าน MINI ได้แต้มโบนัส
  rewardGoalShield:   1,      // ผ่าน GOAL เพิ่มเกราะ
  rewardMiniTime:     2,      // ผ่าน MINI เพิ่มเวลาเล็กน้อย
  rewardGoalStormSec: 4,      // ผ่าน GOAL เปิด “storm/rush” เพิ่มความเร้าใจ
  rewardMiniFever:   15,      // ผ่าน MINI เติม fever นิดนึง (ไม่ให้ถึง 100 ทันที)
};

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

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
    waterPct: 50,
    zone: 'GREEN',
    greenTick: 0,

    // fever
    fever: 0,
    feverActive: false,
    feverLeft: 0,
    shield: 0,

    // ✅ Storm/Rush
    stormLeft: 0,            // วินาทีที่ storm ยังทำงาน
    stormIntervalMul: 0.70,  // คูณ spawn interval ให้ถี่ขึ้นจริง
    rewards: {
      goalsCleared: 0,
      minisCleared: 0,
      bonuses: []            // เก็บข้อความรางวัลไว้สรุปตอนจบ
    }
  };

  // --- Quest deck ---
  const Q = createHydrationQuest(difficulty);

  // --- host / playfield ---
  const playfield = $id('hvr-playfield') || null;

  // expose instance (debug/stop)
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

  function calcProg(){
    // ProgressToS = score+quests (ตามที่ทำไว้เดิม)
    const goalsDone = Number($id('hha-goal-done')?.textContent || 0) || 0;
    const miniDone  = Number($id('hha-mini-done')?.textContent || 0) || 0;
    const prog = clamp((state.score / 1200) * 0.7 + (goalsDone/2) * 0.2 + (miniDone/3) * 0.1, 0, 1);
    return prog;
  }

  function gradeFromProg(progPct){
    let grade = 'C';
    if (progPct >= 95) grade = 'SSS';
    else if (progPct >= 85) grade = 'SS';
    else if (progPct >= 70) grade = 'S';
    else if (progPct >= 50) grade = 'A';
    else if (progPct >= 30) grade = 'B';
    return grade;
  }

  function updateScoreHud(label){
    const prog = calcProg();
    const progPct = Math.round(prog * 100);

    const fill = $id('hha-grade-progress-fill');
    const txt  = $id('hha-grade-progress-text');
    if (fill) fill.style.width = progPct + '%';
    if (txt) txt.textContent = `Progress to S (30%): ${progPct}%`;

    const grade = gradeFromProg(progPct);
    const gb = $id('hha-grade-badge');
    if (gb) gb.textContent = grade;

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
      label: label || '',
      grade,
      progPct,
      stormLeft: state.stormLeft|0
    });
  }

  // ✅ track completion changes → celebrate+reward
  let lastGoalsDone = 0;
  let lastMinisDone = 0;

  function rewardGoal(){
    state.rewards.goalsCleared += 1;

    // bonuses
    const scoreAdd = TUNE.rewardGoalScore;
    state.score = Math.max(0, (state.score + scoreAdd) | 0);
    state.shield = clamp(state.shield + TUNE.rewardGoalShield, 0, TUNE.shieldMax);

    // storm boost
    state.stormLeft = clamp(state.stormLeft + TUNE.rewardGoalStormSec, 0, 20);

    state.rewards.bonuses.push(`🎯 GOAL +${scoreAdd} แต้ม / 🛡️+${TUNE.rewardGoalShield} / 🌊Storm +${TUNE.rewardGoalStormSec}s`);

    // celebrate
    try{ Particles.celebrate && Particles.celebrate('goal'); }catch{}
    try{ Particles.toast && Particles.toast('🎉 GOAL CLEARED! ได้แต้ม+เกราะ+Storm Wave!'); }catch{}
    dispatch('hha:coach', { text:'🎉 ผ่าน GOAL แล้ว! ได้แต้ม + เกราะ 🛡️ และ Storm Wave 🌊!', mood:'happy' });

    // tiny blink
    try{ dispatch('hha:judge', { label:'GOAL+' }); }catch{}
  }

  function rewardMini(){
    state.rewards.minisCleared += 1;

    const scoreAdd = TUNE.rewardMiniScore;
    state.score = Math.max(0, (state.score + scoreAdd) | 0);

    // time + fever boost
    state.timeLeft = clamp(state.timeLeft + TUNE.rewardMiniTime, 0, 180);
    if (!state.feverActive){
      state.fever = clamp(state.fever + TUNE.rewardMiniFever, 0, 100);
    }
    state.rewards.bonuses.push(`✨ MINI +${scoreAdd} แต้ม / ⏱️+${TUNE.rewardMiniTime}s / 🔥+${TUNE.rewardMiniFever}`);

    try{ Particles.celebrate && Particles.celebrate('mini'); }catch{}
    try{ Particles.toast && Particles.toast('✨ MINI CLEARED! ได้แต้ม+เวลาเพิ่ม!'); }catch{}
    dispatch('hha:coach', { text:`✨ ผ่าน MINI แล้ว! +${TUNE.rewardMiniTime}s ⏱️ +แต้มโบนัส!`, mood:'happy' });
    dispatch('hha:time', { sec: state.timeLeft });

    try{ dispatch('hha:judge', { label:'MINI+' }); }catch{}
  }

  function updateQuestHud(){
    // ใช้ progressInfo จาก hydration.quest.js
    const goals = Q.getProgress('goals');
    const minis = Q.getProgress('mini');

    const allGoals = Q.goals || [];
    const allMinis = Q.minis || [];
    const goalsDone = allGoals.filter(g => g._done || g.done).length;
    const minisDone = allMinis.filter(m => m._done || m.done).length;

    // ✅ celebrate + reward เมื่อจำนวนเพิ่ม
    if (goalsDone > lastGoalsDone) {
      for (let i = lastGoalsDone; i < goalsDone; i++) rewardGoal();
      lastGoalsDone = goalsDone;
    }
    if (minisDone > lastMinisDone) {
      for (let i = lastMinisDone; i < minisDone; i++) rewardMini();
      lastMinisDone = minisDone;
    }

    const gd = $id('hha-goal-done'); if (gd) gd.textContent = String(goalsDone);
    const gt = $id('hha-goal-total'); if (gt) gt.textContent = String(allGoals.length || 2);
    const md = $id('hha-mini-done'); if (md) md.textContent = String(minisDone);
    const mt = $id('hha-mini-total'); if (mt) mt.textContent = String(allMinis.length || 3);

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

    updateScoreHud();
  }

  // --------------------- Fever logic ---------------------
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

    state.shield = clamp(state.shield + TUNE.shieldOnFeverStart, 0, TUNE.shieldMax);

    feverRender();
    dispatch('hha:fever', { state:'start', value: state.fever, active:true, shield: state.shield });

    dispatch('hha:coach', { text:'🔥 FEVER! แตะให้ไว คะแนนคูณ! +ได้เกราะด้วย 🛡️', mood:'happy' });
    try{ Particles.celebrate && Particles.celebrate('fever'); }catch{}
  }

  function feverEnd(){
    state.feverActive = false;
    state.feverLeft = 0;
    state.fever = clamp(state.fever * 0.35, 0, 100);
    feverRender();
    dispatch('hha:fever', { state:'end', value: state.fever, active:false, shield: state.shield });
    dispatch('hha:coach', { text:'ดีมาก! FEVER จบแล้ว กลับไปรักษา GREEN ต่อ 💧', mood:'neutral' });
  }

  function feverAdd(v){
    if (state.feverActive) return;
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
    const isGood = !!ctx.isGood;
    const isPower = !!ctx.isPower;

    let scoreDelta = 0;
    let label = 'GOOD';

    const mult = state.feverActive ? 2 : 1;

    if (isPower){
      scoreDelta = TUNE.scorePower * mult;
      label = 'POWER';
    } else if (isGood){
      scoreDelta = TUNE.scoreGood * mult;
      label = 'GOOD';
    } else {
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

    // ✅ perfect / fever bonus
    if ((isGood || isPower) && ctx.hitPerfect) scoreDelta += TUNE.scorePerfectBonus;
    if ((isGood || isPower) && state.feverActive) scoreDelta += TUNE.scoreFeverBonus;

    // combo rules
    if (isGood || isPower){
      state.combo += 1;
      if (state.combo > state.comboBest) state.comboBest = state.combo;
    } else {
      state.combo = 0;
      state.miss += 1;
    }

    state.score = Math.max(0, (state.score + scoreDelta) | 0);

    if (isPower || isGood){
      state.waterPct = clamp(state.waterPct + TUNE.goodWaterPush, 0, 100);
      feverAdd(isPower ? TUNE.feverGainPower : TUNE.feverGainGood);
      Q.onGood();
    } else {
      state.waterPct = clamp(state.waterPct + TUNE.junkWaterPush, 0, 100);
      feverLose(TUNE.feverLoseJunk);
      Q.onJunk();
    }

    Q.updateScore(state.score);
    Q.updateCombo(state.combo);

    updateWaterHud();

    try{
      Particles.burstAt && Particles.burstAt(ctx.clientX || 0, ctx.clientY || 0, label);
      Particles.scorePop && Particles.scorePop(ctx.clientX || 0, ctx.clientY || 0, scoreDelta, label);
    }catch{}

    dispatch('hha:judge', { label });
    updateQuestHud();
    return { scoreDelta, label, good: (isGood || isPower) };
  }

  // --------------------- Expire (ของหลุด) ---------------------
  function onExpire(info){
    if (info && info.isGood && !info.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;
      state.waterPct = clamp(state.waterPct - 3, 0, 100);
      dispatch('hha:judge', { label:'MISS' });
      updateWaterHud();
      updateScoreHud('MISS');
    }
  }

  // --------------------- Clock tick ---------------------
  let timer = null;

  function secondTick(){
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time', { sec: state.timeLeft });

    // water drift
    state.waterPct = clamp(state.waterPct + TUNE.waterDriftPerSec, 0, 100);
    updateWaterHud();

    // ✅ GREEN tick (นับให้แน่นอน)
    const z = zoneFrom(state.waterPct);
    if (z === 'GREEN') state.greenTick += 1;

    // quest internal tick
    Q.second();

    // ✅ Storm tick
    if (state.stormLeft > 0) state.stormLeft -= 1;

    // fever tick / decay
    if (state.feverActive){
      state.feverLeft -= 1;
      if (state.feverLeft <= 0) feverEnd();
      else {
        state.fever = 100;
        feverRender();
      }
    } else {
      state.fever = clamp(state.fever - TUNE.feverAutoDecay, 0, 100);
      feverRender();
    }

    updateQuestHud();
  }

  // --------------------- Start spawner ---------------------
  const spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,
    spawnHost: playfield ? '#hvr-playfield' : null,

    pools: {
      good: ['💧','🥛','🍉','🥥','🍊'],
      bad:  ['🥤','🧋','🍟','🍔']
    },
    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    // ✅ สำคัญ: Storm Wave ทำให้ spawn ถี่ขึ้น “จริง”
    spawnIntervalMul: () => (state.stormLeft > 0 ? state.stormIntervalMul : 1),

    judge: (ch, ctx) => {
      if (ctx.isPower && ch === '🛡️'){
        state.shield = clamp(state.shield + 1, 0, TUNE.shieldMax);
        feverRender();
        dispatch('hha:judge', { label:'SHIELD+' });
        updateScoreHud('SHIELD+');
      }
      if (ctx.isPower && ch === '⏱️'){
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

  // timer
  timer = ROOT.setInterval(secondTick, 1000);

  // stop cleanup
  const onStop = () => stop();
  ROOT.addEventListener('hha:stop', onStop);

  function stop(){
    try{ if (timer) ROOT.clearInterval(timer); }catch{}
    timer = null;

    try{ spawner && spawner.stop && spawner.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}

    // ✅ finalize progress snapshot
    const goalsDone = Number($id('hha-goal-done')?.textContent || 0) || 0;
    const goalsTotal = Number($id('hha-goal-total')?.textContent || 2) || 2;
    const minisDone = Number($id('hha-mini-done')?.textContent || 0) || 0;
    const minisTotal = Number($id('hha-mini-total')?.textContent || 3) || 3;

    const progPct = Math.round(calcProg() * 100);
    const grade = gradeFromProg(progPct);

    // ✅ end celebration
    try{ Particles.celebrate && Particles.celebrate('end'); }catch{}
    try{ Particles.toast && Particles.toast(`🏁 จบเกม! เกรด ${grade} • Goal ${goalsDone}/${goalsTotal} • Mini ${minisDone}/${minisTotal}`); }catch{}

    dispatch('hha:end', {
      score: state.score|0,
      miss: state.miss|0,
      comboBest: state.comboBest|0,
      water: Math.round(state.waterPct),
      zone: state.zone,
      greenTick: state.greenTick|0,
      fever: Math.round(state.fever),
      shield: state.shield|0,

      // ✅ quest summary
      goalsDone, goalsTotal,
      minisDone, minisTotal,
      grade, progPct,

      // ✅ rewards summary
      rewards: state.rewards,
    });
  }

  ROOT.addEventListener('hha:time', (e)=>{
    const sec = Number(e?.detail?.sec);
    if (Number.isFinite(sec) && sec <= 0) stop();
  }, { passive:true });

  return { stop };
}

export default { boot };
