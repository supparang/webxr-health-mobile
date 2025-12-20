// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// ✅ FIX ROOT CAUSE: sync GREEN time into Quest.stats.greenTick so GOAL can pass
// ✅ ADD 1-7: Arcade fun pack (Green Streak/Jackpot + Panic + Storm+ + Decoy + SurpriseMini + PerfectStreak + MiniBoss)
// ✅ Heavy Celebration hooks (Particles.celebrate/ toast) + shake/flash/beep/vibrate
// ✅ PATCH 2025-12-20(C): Mini quest chain ต่อเนื่อง (ARCADE) + HUD show minisDone(all) but keep miniTotal=3 for grade

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

// --------------------- Arcade mode ---------------------
// ✅ เปิดเพื่อให้ mini quest ต่อเนื่องไม่จำกัด
const ARCADE = true;

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
  { scorePop(){}, burstAt(){}, celebrate(){}, toast(){}, objPop(){} };

function getFeverUI(){
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
}

// --------------------- “HEAVY FX” ---------------------
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
  } else if (kind === 'panic'){
    flash('block', 70);
    shake(1, 120);
    beep(880, 0.04, 0.03, 'square');
  } else if (kind === 'boss'){
    flash('bad', 160);
    shake(3, 650);
    vibrate([30,60,30]);
    beep(140, 0.12, 0.08, 'sawtooth');
  }
}

// Inject CSS for shake + storm banner
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

  // extra arcade
  scoreStormBonusMul: 1.30,
  stormExtraJunkPenalty: 10,

  feverGainGood:  9,
  feverGainPower: 14,
  feverLoseJunk:  18,
  feverAutoDecay: 1.2,

  feverTriggerAt: 100,
  feverDurationSec: 6,

  shieldOnFeverStart: 2,
  shieldMax: 6,

  missOnGoodExpire: true,

  rewardGoalScore:  160,
  rewardMiniScore:  100,
  rewardGoalShield: 1,
  rewardMiniTime:   2,
  rewardGoalStormSec: 5,
  rewardMiniFever:  18,

  // (1) green streak
  greenStreakEverySec: 5,
  greenStreakScore: 25,
  greenStreakFever: 6,
  greenJackpotEverySec: 15,
  greenJackpotScore: 120,

  // (5) surprise mini
  surpriseWindowSec: 8,
  surpriseNeedHits: 4,
  surpriseRewardScore: 220,
  surpriseRewardTime: 3,
  surpriseRewardStorm: 4,
  surpriseRewardFever: 22,
  surprisePenaltyFail: 0,

  // (6) perfect streak
  perfectStreakTarget: 3,
  perfectRewardScore: 80,
  perfectRewardShield: 1,
  perfectRewardStorm: 2,

  // (7) boss
  bossTimeWindow: 15,
  bossJunkPenalty: 60,
  bossRewardIfBlocked: 60
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
    duration,
    timeLeft: duration,

    score: 0,
    combo: 0,
    comboBest: 0,
    miss: 0,

    waterPct: 50,
    zone: 'GREEN',
    greenTick: 0,

    greenStreak: 0,

    fever: 0,
    feverActive: false,
    feverLeft: 0,
    shield: 0,

    stormLeft: 0,
    stormIntervalMul: 0.65,

    surprise: {
      active: false,
      cleared: false,
      failed: false,
      left: 0,
      need: TUNE.surpriseNeedHits,
      got: 0,
      noJunkOk: true,
      triggerAt: Math.max(25, Math.floor(duration * 0.55))
    },

    perfectStreak: 0,

    boss: {
      active: false,
      spawned: false,
      hitOrBlocked: false
    },

    rewards: { goalsCleared: 0, minisCleared: 0, bonuses: [], surCleared: 0, bossSurvived: 0 }
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

  function normalizeZone(z){
    const Z = String(z || '').toUpperCase();
    if (Z === 'GREEN' || Z === 'YELLOW' || Z === 'RED') return Z;
    if (Z === 'LOW') return 'YELLOW';
    if (Z === 'HIGH') return 'RED';
    return 'GREEN';
  }

  function syncQuestZone(){
    try{
      if (Q && Q.stats){
        Q.stats.zone = state.zone;
        if (!Number.isFinite(Q.stats.greenTick)) Q.stats.greenTick = 0;
      }
    }catch{}
  }

  function updateWaterHud(){
    let out = null;
    try{ out = setWaterGauge(state.waterPct); }catch{}
    const computed = normalizeZone(out?.zone || zoneFrom(state.waterPct));
    state.zone = computed;

    const fillEl = $id('hha-water-fill');
    if (fillEl) fillEl.style.width = clamp(state.waterPct,0,100).toFixed(1) + '%';

    const statusEl = $id('hha-water-status');
    if (statusEl) statusEl.textContent = `${state.zone} ${Math.round(state.waterPct)}%`;

    const ztxt = $id('hha-water-zone-text');
    if (ztxt) ztxt.textContent = state.zone;

    syncQuestZone();
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
      comboMax: state.comboBest|0,
      miss: state.miss|0,
      misses: state.miss|0,

      zone: state.zone,
      water: Math.round(state.waterPct),
      fever: Math.round(state.fever),
      feverActive: !!state.feverActive,
      shield: state.shield|0,

      label: label || '',
      grade,
      progPct,
      stormLeft: state.stormLeft|0,

      greenStreak: state.greenStreak|0,
      surpriseActive: !!state.surprise.active,
      surpriseLeft: state.surprise.left|0,
      bossActive: !!state.boss.active
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

    state.stormLeft = clamp(state.stormLeft + TUNE.rewardGoalStormSec, 0, 25);
    updateStormUI();

    state.rewards.bonuses.push(`🎯 GOAL +${scoreAdd} / 🛡️+${TUNE.rewardGoalShield} / 🌊Storm +${TUNE.rewardGoalStormSec}s`);

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

  function startSurpriseMini(){
    if (state.surprise.cleared || state.surprise.failed || state.surprise.active) return;
    state.surprise.active = true;
    state.surprise.left = TUNE.surpriseWindowSec;
    state.surprise.got = 0;
    state.surprise.noJunkOk = true;

    try{ Particles.toast && Particles.toast(`⚡ SURPRISE! เก็บน้ำดี ${state.surprise.need} ภายใน ${TUNE.surpriseWindowSec}s และห้ามโดนขยะ!`); }catch{}
    dispatch('hha:coach', { text:`⚡ SURPRISE MINI! เก็บน้ำดี ${state.surprise.need} ภายใน ${TUNE.surpriseWindowSec} วิ และห้ามโดนขยะ!`, mood:'happy' });
    megaCelebrate('mini');
  }

  function clearSurpriseMini(){
    state.surprise.active = false;
    state.surprise.cleared = true;
    state.rewards.surCleared = (state.rewards.surCleared|0) + 1;

    state.score = Math.max(0, (state.score + TUNE.surpriseRewardScore) | 0);
    state.timeLeft = clamp(state.timeLeft + TUNE.surpriseRewardTime, 0, 180);
    state.stormLeft = clamp(state.stormLeft + TUNE.surpriseRewardStorm, 0, 25);
    updateStormUI();

    if (!state.feverActive) state.fever = clamp(state.fever + TUNE.surpriseRewardFever, 0, 100);

    state.rewards.bonuses.push(`⚡ SURPRISE CLEAR +${TUNE.surpriseRewardScore} / ⏱️+${TUNE.surpriseRewardTime}s / 🌊+${TUNE.surpriseRewardStorm}s / 🔥+${TUNE.surpriseRewardFever}`);

    megaCelebrate('goal');
    try{ Particles.toast && Particles.toast('💥 SURPRISE CLEAR!! รางวัลจัดหนัก!!'); }catch{}
    dispatch('hha:coach', { text:'💥 สุดยอด! SURPRISE MINI ผ่านแล้ว! โบนัสจัดหนัก!!', mood:'happy' });
  }

  function failSurpriseMini(){
    if (!state.surprise.active) return;
    state.surprise.active = false;
    state.surprise.failed = true;

    if (TUNE.surprisePenaltyFail){
      state.score = Math.max(0, (state.score - TUNE.surprisePenaltyFail) | 0);
    }

    megaCelebrate('panic');
    try{ Particles.toast && Particles.toast('💥 SURPRISE FAIL! ลองใหม่รอบหน้า!'); }catch{}
    dispatch('hha:coach', { text:'💥 ไม่เป็นไร! SURPRISE MINI พลาดได้ ลองทำ Green ต่อ!', mood:'neutral' });
  }

  function updateQuestHud(){
    const goals = Q.getProgress('goals');
    const minis = Q.getProgress('mini');

    const allGoals = Q.goals || [];
    const allMinis = Q.minis || [];
    const goalsDone = allGoals.filter(g => g._done || g.done).length;

    // ✅ IMPORTANT: minisDone “จริงทั้งหมด” ใช้ Q.stats.minisDone (รองรับ chain)
    const minisDoneAll = (Q && Q.stats && Number.isFinite(Q.stats.minisDone)) ? (Q.stats.minisDone|0) : allMinis.filter(m => m._done || m.done).length;

    // ---- reward goal change ----
    if (goalsDone > lastGoalsDone) {
      for (let i = lastGoalsDone; i < goalsDone; i++) rewardGoal();
      lastGoalsDone = goalsDone;
    }

    // ---- reward mini change + ✅ ARCADE chain ----
    if (minisDoneAll > lastMinisDone) {
      for (let i = lastMinisDone; i < minisDoneAll; i++) {
        rewardMini();
        // ✅ ต่อ mini ใหม่ทันที
        if (ARCADE && Q && typeof Q.nextMini === 'function') {
          try { Q.nextMini({ harder:true }); } catch {}
        }
      }
      lastMinisDone = minisDoneAll;
    }

    const gd = $id('hha-goal-done'); if (gd) gd.textContent = String(goalsDone);
    const gt = $id('hha-goal-total'); if (gt) gt.textContent = String(allGoals.length || 2);

    // ✅ HUD: โชว์ minisDone เป็น “จำนวนที่ผ่านจริงทั้งหมด”
    const md = $id('hha-mini-done');  if (md) md.textContent = String(minisDoneAll);

    // ⚠️ คง miniTotal = 3 เพื่อให้ calcProg()/grade ไม่เพี้ยน
    const mt = $id('hha-mini-total'); if (mt) mt.textContent = '3';

    const curGoal = (goals && goals[0]) ? goals[0].id : (allGoals[0]?.id || '');
    const curMini = (minis && minis[0]) ? minis[0].id : (allMinis[0]?.id || '');

    const gInfo = Q.getGoalProgressInfo ? Q.getGoalProgressInfo(curGoal) : null;
    const mInfo = Q.getMiniProgressInfo ? Q.getMiniProgressInfo(curMini) : null;

    const goalEl = $id('hha-quest-goal');
    const miniEl = $id('hha-quest-mini');

    if (goalEl) goalEl.textContent = gInfo?.text ? `Goal: ${gInfo.text}` : `Goal: ทำภารกิจให้ครบ`;

    if (miniEl){
      if (state.surprise.active){
        miniEl.textContent = `Mini: ⚡ SURPRISE ${state.surprise.got}/${state.surprise.need} ใน ${state.surprise.left}s (ห้ามโดนขยะ!)`;
      } else {
        miniEl.textContent = mInfo?.text ? `Mini: ${mInfo.text}` : `Mini: ทำมินิเควส`;
      }
    }

    const goalTitle = (goalEl?.textContent || 'Goal').replace(/^Goal:\s*/i,'').trim();
    const miniTitle = (miniEl?.textContent || 'Mini').replace(/^Mini:\s*/i,'').trim();

    dispatch('quest:update', {
      goalDone: goalsDone,
      goalTotal: allGoals.length || 2,
      miniDone: minisDoneAll,
      miniTotal: 3,

      goalText: goalEl ? goalEl.textContent : '',
      miniText: miniEl ? miniEl.textContent : '',

      goal: {
        title: goalTitle,
        cur: goalsDone,
        max: (allGoals.length || 2),
        pct: (allGoals.length ? (goalsDone / allGoals.length) : (goalsDone / 2)),
        state: (goalsDone >= (allGoals.length || 2)) ? 'clear' : 'run'
      },
      mini: {
        title: miniTitle,
        cur: minisDoneAll,
        max: 3,
        pct: clamp(minisDoneAll / 3, 0, 1),
        state: (minisDoneAll >= 3) ? 'clear' : 'run'
      },
      meta: {
        diff: state.diff,
        goalsDone,
        minisDone: minisDoneAll,
        surpriseActive: !!state.surprise.active,
        arcade: !!ARCADE
      }
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
    let isGood = !!ctx.isGood;
    let isPower = !!ctx.isPower;
    let isFake = false;

    if (!isPower && ch === '🌀'){
      isFake = true;
      const roll = Math.random();
      isGood = (roll < 0.40);
    }

    const bossWindow = (state.timeLeft <= TUNE.bossTimeWindow && state.timeLeft > 0);
    const isBoss = (!isPower && ch === '👑' && bossWindow);

    let scoreDelta = 0;
    let label = '[GOOD] GOOD';

    const mult = state.feverActive ? 2 : 1;
    const stormMul = (state.stormLeft > 0) ? TUNE.scoreStormBonusMul : 1;

    if (isPower){
      scoreDelta = TUNE.scorePower * mult;
      label = '[POWER] POWER';
    } else if (isGood){
      scoreDelta = TUNE.scoreGood * mult;
      label = isFake ? '[FAKE] LUCKY!' : '[GOOD] GOOD';
    } else {
      if (state.shield > 0){
        state.shield -= 1;

        if (isBoss && !state.boss.hitOrBlocked){
          state.boss.hitOrBlocked = true;
          state.rewards.bossSurvived = (state.rewards.bossSurvived|0) + 1;
          state.score = Math.max(0, (state.score + TUNE.bossRewardIfBlocked) | 0);
          state.rewards.bonuses.push(`👑 BOSS BLOCK +${TUNE.bossRewardIfBlocked}`);
          megaCelebrate('goal');
          try{ Particles.toast && Particles.toast(`👑 บล็อกบอสสำเร็จ! +${TUNE.bossRewardIfBlocked}`); }catch{}
        }

        scoreDelta = 0;
        label = '[BLOCK] BLOCK';
        flash('block', 90);
        vibrate(10);
        beep(240, 0.06, 0.05, 'square');
        dispatch('hha:judge', { label:'BLOCK' });
        feverRender();
        updateScoreHud('BLOCK');
        return { scoreDelta, label, good:false, blocked:true };
      }

      if (isBoss){
        scoreDelta = -(TUNE.bossJunkPenalty);
        label = '[BOSS] BOSS!';
        megaCelebrate('boss');
        try{ Particles.toast && Particles.toast('👑 BOSS HIT!! โดนหนักมาก!'); }catch{}
      } else {
        scoreDelta = TUNE.scoreJunk;
        label = isFake ? '[FAKE] TRAP!' : '[JUNK] JUNK';
        flash('bad', 110);
        shake(2, 360);
        vibrate([16,26,16]);
        beep(160, 0.08, 0.06, 'sawtooth');
        if (state.stormLeft > 0) scoreDelta -= TUNE.stormExtraJunkPenalty;
      }
    }

    if ((isGood || isPower) && ctx.hitPerfect) scoreDelta += TUNE.scorePerfectBonus;
    if ((isGood || isPower) && state.feverActive) scoreDelta += TUNE.scoreFeverBonus;

    if (scoreDelta > 0) scoreDelta = Math.round(scoreDelta * stormMul);

    if (isGood || isPower){
      state.combo += 1;
      if (state.combo > state.comboBest) state.comboBest = state.combo;

      flash('good', 85);
      vibrate(8);

      if (ctx.hitPerfect){
        state.perfectStreak += 1;
        if (state.perfectStreak >= TUNE.perfectStreakTarget){
          state.perfectStreak = 0;
          state.score = Math.max(0, (state.score + TUNE.perfectRewardScore) | 0);
          state.shield = clamp(state.shield + TUNE.perfectRewardShield, 0, TUNE.shieldMax);
          state.stormLeft = clamp(state.stormLeft + TUNE.perfectRewardStorm, 0, 25);
          updateStormUI();
          state.rewards.bonuses.push(`🎯 PERFECT x${TUNE.perfectStreakTarget} +${TUNE.perfectRewardScore} / 🛡️+${TUNE.perfectRewardShield} / 🌊+${TUNE.perfectRewardStorm}s`);
          megaCelebrate('mini');
          try{ Particles.toast && Particles.toast(`🎯 PERFECT x${TUNE.perfectStreakTarget}! โบนัสมาแล้ว!`); }catch{}
        }
      } else {
        state.perfectStreak = 0;
      }

    } else {
      state.combo = 0;
      state.miss += 1;
      state.perfectStreak = 0;

      if (state.surprise.active){
        state.surprise.noJunkOk = false;
        failSurpriseMini();
      }
    }

    state.score = Math.max(0, (state.score + scoreDelta) | 0);

    if (isPower || isGood){
      state.waterPct = clamp(state.waterPct + TUNE.goodWaterPush, 0, 100);
      feverAdd(isPower ? TUNE.feverGainPower : TUNE.feverGainGood);
      Q.onGood();

      if (state.surprise.active){
        state.surprise.got += 1;
        if (state.surprise.got >= state.surprise.need && state.surprise.noJunkOk){
          clearSurpriseMini();
        }
      }

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

      if (Particles.objPop && (isGood || isPower)){
        Particles.objPop(ctx.clientX || 0, ctx.clientY || 0, '✨', { side:'left', size:22 });
        Particles.objPop(ctx.clientX || 0, ctx.clientY || 0, '💧', { side:'right', size:22 });
      }
    }catch{}

    dispatch('hha:judge', { label: String(label).replace(/\[[^\]]+\]\s*/g,'').trim() });
    updateQuestHud();
    return { scoreDelta, label, good: (isGood || isPower) };
  }

  // --------------------- Expire ---------------------
  function onExpire(info){
    if (info && info.isGood && !info.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;
      state.perfectStreak = 0;
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

    if (String(state.zone).toUpperCase() === 'GREEN'){
      state.greenTick += 1;

      try{
        if (Q && Q.stats){
          Q.stats.greenTick = (Q.stats.greenTick|0) + 1;
        }
      }catch{}

      state.greenStreak += 1;

      if (state.greenStreak % TUNE.greenStreakEverySec === 0){
        state.score = Math.max(0, (state.score + TUNE.greenStreakScore) | 0);
        if (!state.feverActive) state.fever = clamp(state.fever + TUNE.greenStreakFever, 0, 100);
        try{ Particles.toast && Particles.toast(`💧 GREEN STREAK +${TUNE.greenStreakScore}`); }catch{}
        beep(740, 0.04, 0.03, 'triangle');
      }
      if (state.greenStreak % TUNE.greenJackpotEverySec === 0){
        state.score = Math.max(0, (state.score + TUNE.greenJackpotScore) | 0);
        megaCelebrate('mini');
        try{ Particles.toast && Particles.toast(`🎰 GREEN JACKPOT +${TUNE.greenJackpotScore}`); }catch{}
      }

    } else {
      state.greenStreak = 0;
    }

    Q.second();

    if (!state.surprise.cleared && !state.surprise.failed && !state.surprise.active){
      if (state.timeLeft === state.surprise.triggerAt){
        startSurpriseMini();
      }
    }
    if (state.surprise.active){
      state.surprise.left = Math.max(0, state.surprise.left - 1);
      if (state.surprise.left <= 0){
        if (!state.surprise.cleared) failSurpriseMini();
      }
    }

    if (state.stormLeft > 0) {
      state.stormLeft -= 1;
      updateStormUI();

      stormBeepEvery++;
      if (stormBeepEvery % 2 === 0) beep(420, 0.05, 0.03, 'square');
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

    if (state.timeLeft <= 10 && state.timeLeft > 0){
      megaCelebrate('panic');
      if (state.timeLeft <= 5){
        beep(980, 0.045, 0.035, 'square');
      }
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
      bad:  ['🥤','🧋','🍟','🍔','🌀','👑']
    },

    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

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
        state.stormLeft = clamp(state.stormLeft + 3, 0, 25);
        updateStormUI();
        megaCelebrate('storm');
        try{ Particles.toast && Particles.toast('⭐ SUPER STAR! STORM +3s'); }catch{}
        state.rewards.bonuses.push('⭐ STAR STORM +3s');
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

    const minisDone = (Q && Q.stats && Number.isFinite(Q.stats.minisDone))
      ? (Q.stats.minisDone|0)
      : (Number($id('hha-mini-done')?.textContent || 0) || 0);

    const minisTotal = 3;

    const progPct = Math.round(calcProg() * 100);
    const grade = gradeFromProg(progPct);

    megaCelebrate('end');
    try{ Particles.toast && Particles.toast(`🏁 จบเกม! เกรด ${grade} • Goal ${goalsDone}/${goalsTotal} • Mini ${minisDone}/${minisTotal}`); }catch{}

    dispatch('hha:end', {
      score: state.score|0,

      miss: state.miss|0,
      misses: state.miss|0,
      comboBest: state.comboBest|0,
      comboMax: state.comboBest|0,

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
