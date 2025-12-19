// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// ✅ PATCH: celebrate+reward per goal/mini + end summary payload
// ✅ PATCH: “HEAVY CELEBRATION” (flash+shake+beep+multi celebrate)
// ✅ PATCH: Storm Wave ทำให้ spawn ถี่ขึ้นจริง ผ่าน mode-factory spawnIntervalMul

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

// --------------------- “HEAVY FX” (flash + shake + beep) ---------------------
function flash(kind='good', ms=110){
  const el = $id('hvr-screen-blink');
  if (!el) return;
  el.classList.remove('good','bad','block','on');
  el.classList.add(kind);
  void el.offsetWidth;
  el.classList.add('on');
  ROOT.setTimeout(()=> el.classList.remove('on'), ms);
}
function shake(level=2, ms=420){
  const wrap = $id('hvr-wrap');
  if (!wrap) return;
  const cls = level >= 3 ? 'hvr-shake-3' : (level === 2 ? 'hvr-shake-2' : 'hvr-shake-1');
  wrap.classList.remove('hvr-shake-1','hvr-shake-2','hvr-shake-3');
  wrap.classList.add(cls);
  ROOT.setTimeout(()=> wrap.classList.remove(cls), ms);
}
function vibrate(pattern){
  try{ if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(pattern); }catch{}
}
let _ac = null;
function beep(freq=880, dur=0.08, gain=0.07, type='sine'){
  try{
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return;
    _ac = _ac || new AC();
    const t0 = _ac.currentTime;
    const o = _ac.createOscillator();
    const g = _ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(_ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.01);
  }catch{}
}
function megaCelebrate(kind='goal'){
  // เรียก celebrate ซ้ำ + flash+shake+vibrate+beep เป็นชั้น ๆ
  try{ Particles.celebrate && Particles.celebrate(kind); }catch{}
  try{ Particles.celebrate && Particles.celebrate(kind); }catch{}
  try{ Particles.celebrate && Particles.celebrate(kind); }catch{}
  if (kind === 'goal'){
    flash('good', 140);
    shake(3, 520);
    vibrate([40,60,40,60,40]);
    beep(1046, 0.09, 0.09, 'triangle');
    ROOT.setTimeout(()=>beep(1318, 0.10, 0.085, 'triangle'), 90);
    ROOT.setTimeout(()=>beep(1568, 0.12, 0.08, 'triangle'), 190);
  } else if (kind === 'mini'){
    flash('good', 110);
    shake(2, 420);
    vibrate([25,45,25]);
    beep(988, 0.08, 0.08, 'square');
    ROOT.setTimeout(()=>beep(1318, 0.10, 0.07, 'square'), 90);
  } else if (kind === 'end'){
    flash('good', 160);
    shake(3, 650);
    vibrate([60,70,60,70,60]);
    beep(784, 0.10, 0.085, 'sine');
    ROOT.setTimeout(()=>beep(988, 0.10, 0.085, 'sine'), 120);
    ROOT.setTimeout(()=>beep(1175, 0.12, 0.085, 'sine'), 240);
    ROOT.setTimeout(()=>beep(1568, 0.16, 0.085, 'sine'), 380);
  } else if (kind === 'storm'){
    flash('block', 90);
    shake(2, 340);
    vibrate(20);
    beep(330, 0.08, 0.06, 'sawtooth');
  } else if (kind === 'fever'){
    flash('good', 120);
    shake(2, 420);
    vibrate([30,40,30,40,30]);
    beep(880, 0.08, 0.07, 'sawtooth');
    ROOT.setTimeout(()=>beep(1320, 0.10, 0.06, 'sawtooth'), 90);
  }
}

// Inject small CSS for shake + storm banner (safe)
(function ensureFxCSS(){
  const id = 'hvr-heavyfx-style';
  if (!ROOT.document || ROOT.document.getElementById(id)) return;
  const s = ROOT.document.createElement('style');
  s.id = id;
  s.textContent = `
    .hvr-shake-1{ animation:hvrShake1 .35s ease-in-out 1; }
    .hvr-shake-2{ animation:hvrShake2 .42s ease-in-out 1; }
    .hvr-shake-3{ animation:hvrShake3 .55s ease-in-out 1; }
    @keyframes hvrShake1{
      0%{ transform:translate3d(0,0,0) }
      25%{ transform:translate3d(2px,-2px,0) }
      50%{ transform:translate3d(-2px,1px,0) }
      75%{ transform:translate3d(1px,2px,0) }
      100%{ transform:translate3d(0,0,0) }
    }
    @keyframes hvrShake2{
      0%{ transform:translate3d(0,0,0) }
      20%{ transform:translate3d(4px,-3px,0) }
      40%{ transform:translate3d(-4px,2px,0) }
      60%{ transform:translate3d(3px,4px,0) }
      80%{ transform:translate3d(-3px,-2px,0) }
      100%{ transform:translate3d(0,0,0) }
    }
    @keyframes hvrShake3{
      0%{ transform:translate3d(0,0,0) }
      15%{ transform:translate3d(6px,-5px,0) }
      30%{ transform:translate3d(-6px,4px,0) }
      45%{ transform:translate3d(5px,6px,0) }
      60%{ transform:translate3d(-5px,-4px,0) }
      75%{ transform:translate3d(4px,5px,0) }
      100%{ transform:translate3d(0,0,0) }
    }
    #hvr-storm-banner{
      position:fixed;
      left:50%;
      top:10px;
      transform:translateX(-50%);
      z-index:99990;
      display:none;
      padding:7px 12px;
      border-radius:999px;
      border:1px solid rgba(96,165,250,.55);
      background:rgba(2,6,23,.75);
      color:#e0f2fe;
      box-shadow:0 16px 38px rgba(0,0,0,.55);
      font-weight:900;
      letter-spacing:.06em;
      user-select:none;
      backdrop-filter:blur(10px);
    }
    #hvr-storm-banner.on{ display:block; }
    #hvr-storm-banner .dot{
      display:inline-block;
      width:8px;height:8px;border-radius:99px;
      background:rgba(96,165,250,.95);
      box-shadow:0 0 18px rgba(96,165,250,.95);
      margin:0 8px 0 2px;
      animation:stormDot .55s ease-in-out infinite;
    }
    @keyframes stormDot{
      0%{ transform:scale(1); opacity:.7 }
      50%{ transform:scale(1.35); opacity:1 }
      100%{ transform:scale(1); opacity:.7 }
    }
  `;
  ROOT.document.head.appendChild(s);

  const b = ROOT.document.createElement('div');
  b.id = 'hvr-storm-banner';
  b.innerHTML = `<span class="dot"></span>STORM WAVE <span id="hvr-storm-left">0</span>s`;
  ROOT.document.body.appendChild(b);
})();

// --------------------- Tuning ---------------------
const TUNE = {
  goodWaterPush:  +6,
  junkWaterPush:  -9,
  waterDriftPerSec: -0.8,

  scoreGood:   18,
  scorePower:  28,
  scoreJunk:  -25,
  scorePerfectBonus: 10,
  scoreFeverBonus: 6,

  feverGainGood:  9,
  feverGainPower: 14,
  feverLoseJunk:  18,
  feverAutoDecay: 1.2,

  feverTriggerAt: 100,
  feverDurationSec: 6,

  shieldOnFeverStart: 2,
  shieldMax: 6,

  missOnGoodExpire: true,

  // ✅ Rewards (จัดหนักขึ้นนิด)
  rewardGoalScore:  160,
  rewardMiniScore:  100,
  rewardGoalShield: 1,
  rewardMiniTime:   2,
  rewardGoalStormSec: 5,
  rewardMiniFever:  18,
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
  }

  const state = {
    diff: difficulty,
    timeLeft: duration,

    score: 0,
    combo: 0,
    comboBest: 0,
    miss: 0,

    waterPct: 50,
    zone: 'GREEN',
    greenTick: 0,

    fever: 0,
    feverActive: false,
    feverLeft: 0,
    shield: 0,

    // ✅ Storm/Rush
    stormLeft: 0,
    stormIntervalMul: 0.65, // ยิ่งต่ำยิ่งถี่ (คูณ interval)
    rewards: { goalsCleared: 0, minisCleared: 0, bonuses: [] }
  };

  const Q = createHydrationQuest(difficulty);
  const playfield = $id('hvr-playfield') || null;

  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} }
  };

  function updateStormUI(){
    const left = state.stormLeft|0;
    const b = $id('hvr-storm-banner');
    const t = $id('hvr-storm-left');
    if (t) t.textContent = String(left);
    if (b){
      if (left > 0) b.classList.add('on');
      else b.classList.remove('on');
    }
  }

  function updateWaterHud(){
    const out = setWaterGauge(state.waterPct);
    state.zone = out.zone;
    const ztxt = $id('hha-water-zone-text');
    if (ztxt) ztxt.textContent = state.zone;
  }

  function calcProg(){
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

    const scoreAdd = TUNE.rewardGoalScore;
    state.score = Math.max(0, (state.score + scoreAdd) | 0);
    state.shield = clamp(state.shield + TUNE.rewardGoalShield, 0, TUNE.shieldMax);

    // ✅ เปิด Storm
    state.stormLeft = clamp(state.stormLeft + TUNE.rewardGoalStormSec, 0, 25);
    updateStormUI();

    state.rewards.bonuses.push(`🎯 GOAL +${scoreAdd} / 🛡️+${TUNE.rewardGoalShield} / 🌊Storm +${TUNE.rewardGoalStormSec}s`);

    // ✅ HEAVY CELEBRATION
    megaCelebrate('goal');
    try{ Particles.toast && Particles.toast('🎉 GOAL CLEARED! โบนัสแต้ม+เกราะ+Storm Wave!'); }catch{}
    dispatch('hha:coach', { text:'🎉 ผ่าน GOAL แล้ว! ได้แต้ม + เกราะ 🛡️ และ STORM WAVE 🌊!', mood:'happy' });
    dispatch('hha:judge', { label:'GOAL+' });
  }

  function rewardMini(){
    state.rewards.minisCleared += 1;

    const scoreAdd = TUNE.rewardMiniScore;
    state.score = Math.max(0, (state.score + scoreAdd) | 0);

    state.timeLeft = clamp(state.timeLeft + TUNE.rewardMiniTime, 0, 180);
    if (!state.feverActive){
      state.fever = clamp(state.fever + TUNE.rewardMiniFever, 0, 100);
    }
    state.rewards.bonuses.push(`✨ MINI +${scoreAdd} / ⏱️+${TUNE.rewardMiniTime}s / 🔥+${TUNE.rewardMiniFever}`);

    megaCelebrate('mini');
    try{ Particles.toast && Particles.toast('✨ MINI CLEARED! โบนัสแต้ม+เวลาเพิ่ม!'); }catch{}
    dispatch('hha:coach', { text:`✨ ผ่าน MINI แล้ว! +${TUNE.rewardMiniTime}s ⏱️ +แต้มโบนัส!`, mood:'happy' });
    dispatch('hha:time', { sec: state.timeLeft });
    dispatch('hha:judge', { label:'MINI+' });
  }

  function updateQuestHud(){
    const goals = Q.getProgress('goals');
    const minis = Q.getProgress('mini');

    const allGoals = Q.goals || [];
    const allMinis = Q.minis || [];
    const goalsDone = allGoals.filter(g => g._done || g.done).length;
    const minisDone = allMinis.filter(m => m._done || m.done).length;

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
    megaCelebrate('fever');
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

  // --------------------- Judge ---------------------
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
        flash('block', 90);
        vibrate(10);
        beep(240, 0.06, 0.05, 'square');
        dispatch('hha:judge', { label:'BLOCK' });
        feverRender();
        updateScoreHud('BLOCK');
        return { scoreDelta, label, good:false, blocked:true };
      }
      scoreDelta = TUNE.scoreJunk;
      label = 'JUNK';
      flash('bad', 110);
      shake(2, 360);
      vibrate([16,26,16]);
      beep(160, 0.08, 0.06, 'sawtooth');
    }

    if ((isGood || isPower) && ctx.hitPerfect) scoreDelta += TUNE.scorePerfectBonus;
    if ((isGood || isPower) && state.feverActive) scoreDelta += TUNE.scoreFeverBonus;

    if (isGood || isPower){
      state.combo += 1;
      if (state.combo > state.comboBest) state.comboBest = state.combo;
      flash('good', 85);
      vibrate(8);
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

  // --------------------- Expire ---------------------
  function onExpire(info){
    if (info && info.isGood && !info.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;
      state.waterPct = clamp(state.waterPct - 3, 0, 100);
      dispatch('hha:judge', { label:'MISS' });
      flash('bad', 80);
      vibrate(10);
      updateWaterHud();
      updateScoreHud('MISS');
    }
  }

  // --------------------- Clock tick ---------------------
  let timer = null;
  let stormBeepEvery = 0;

  function secondTick(){
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time', { sec: state.timeLeft });

    state.waterPct = clamp(state.waterPct + TUNE.waterDriftPerSec, 0, 100);
    updateWaterHud();

    if (zoneFrom(state.waterPct) === 'GREEN') state.greenTick += 1;

    Q.second();

    // ✅ Storm tick + UI + sound tick
    if (state.stormLeft > 0) {
      state.stormLeft -= 1;
      updateStormUI();

      stormBeepEvery++;
      if (stormBeepEvery % 2 === 0) beep(420, 0.05, 0.03, 'square'); // tick ๆ
      if (state.stormLeft === 0) {
        try{ Particles.toast && Particles.toast('🌊 Storm Wave จบแล้ว!'); }catch{}
      }
    } else {
      stormBeepEvery = 0;
      updateStormUI();
    }

    if (state.feverActive){
      state.feverLeft -= 1;
      if (state.feverLeft <= 0) feverEnd();
      else { state.fever = 100; feverRender(); }
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

    pools: { good: ['💧','🥛','🍉','🥥','🍊'], bad: ['🥤','🧋','🍟','🍔'] },
    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    // ✅ ทำให้ spawn ถี่ขึ้น “จริง” (mode-factory รองรับแล้ว)
    spawnIntervalMul: () => (state.stormLeft > 0 ? state.stormIntervalMul : 1),

    judge: (ch, ctx) => {
      if (ctx.isPower && ch === '🛡️'){
        state.shield = clamp(state.shield + 1, 0, TUNE.shieldMax);
        feverRender();
        dispatch('hha:judge', { label:'SHIELD+' });
        flash('block', 85);
        beep(520, 0.06, 0.05, 'triangle');
        updateScoreHud('SHIELD+');
      }
      if (ctx.isPower && ch === '⏱️'){
        state.timeLeft = clamp(state.timeLeft + 3, 0, 180);
        dispatch('hha:time', { sec: state.timeLeft });
        dispatch('hha:judge', { label:'TIME+' });
        flash('good', 85);
        beep(660, 0.06, 0.05, 'triangle');
      }
      if (ctx.isPower && ch === '⭐'){
        // ⭐ ให้ “แรง” เพิ่มนิด
        megaCelebrate('storm');
        try{ Particles.toast && Particles.toast('⭐ SUPER STAR! สายฟ้าแห่งแต้ม!'); }catch{}
      }
      return judge(ch, ctx);
    },

    onExpire
  });

  updateStormUI();
  updateWaterHud();
  updateQuestHud();
  updateScoreHud();
  feverRender();

  timer = ROOT.setInterval(secondTick, 1000);

  const onStop = () => stop();
  ROOT.addEventListener('hha:stop', onStop);

  function stop(){
    try{ if (timer) ROOT.clearInterval(timer); }catch{}
    timer = null;

    try{ spawner && spawner.stop && spawner.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}

    const goalsDone = Number($id('hha-goal-done')?.textContent || 0) || 0;
    const goalsTotal = Number($id('hha-goal-total')?.textContent || 2) || 2;
    const minisDone = Number($id('hha-mini-done')?.textContent || 0) || 0;
    const minisTotal = Number($id('hha-mini-total')?.textContent || 3) || 3;

    const progPct = Math.round(calcProg() * 100);
    const grade = gradeFromProg(progPct);

    megaCelebrate('end');
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

      goalsDone, goalsTotal,
      minisDone, minisTotal,
      grade, progPct,

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
