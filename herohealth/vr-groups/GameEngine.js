// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (วงกลม + emoji + Fever + Quest)
// ใช้ emoji-image เดียวกับ GoodJunk VR
// 2025-12-12 fix: เป้าโผล่แน่ ๆ + emoji

'use strict';

import { emojiImage } from '../vr/vr-goodjunk/emoji-image.js';

const A = window.AFRAME;
if (!A) {
  console.error('[GroupsVR] AFRAME not found');
}

const GM = window.GAME_MODULES || {};
const GroupsFx = GM.foodGroupsFx || null;

const FeverGlobal = (window.HHA_FeverUI || window.FEVER_UI || {});
const _ensureFeverBar = FeverGlobal.ensureFeverBar || window.ensureFeverBar || (()=>{});
const _setFever       = FeverGlobal.setFever       || window.setFever       || (()=>{});
const _setFeverActive = FeverGlobal.setFeverActive || window.setFeverActive || (()=>{});
const _setShield      = FeverGlobal.setShield      || window.setShield      || (()=>{});

const Particles = window.Particles || (GM.Particles || null);
const FEVER_MAX = 100;

// ---------- Utils ----------
function clamp(v, min, max){
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
function randRange(min, max){
  return min + Math.random() * (max - min);
}

// ---------- Difficulty ----------
function pickDifficulty(diffKey){
  diffKey = String(diffKey || 'normal').toLowerCase();

  if (GM.foodGroupsDifficulty && typeof GM.foodGroupsDifficulty.get === 'function'){
    return GM.foodGroupsDifficulty.get(diffKey);
  }

  if (diffKey === 'easy'){
    return {
      spawnInterval: 1400,
      lifeTime:      4600,
      scale:         1.35,
      maxActive:     4,
      goodRatio:     0.8
    };
  }
  if (diffKey === 'hard'){
    return {
      spawnInterval: 900,
      lifeTime:      2800,
      scale:         0.90,
      maxActive:     6,
      goodRatio:     0.65
    };
  }
  return {
    spawnInterval: 1150,
    lifeTime:      3600,
    scale:         1.05,
    maxActive:     5,
    goodRatio:     0.7
  };
}

// ---------- Data: foods ----------
const FOODS = [
  { emoji:'🍚', group:'grain',   good:true },
  { emoji:'🍞', group:'grain',   good:true },
  { emoji:'🥦', group:'veg',     good:true },
  { emoji:'🥕', group:'veg',     good:true },
  { emoji:'🍎', group:'fruit',   good:true },
  { emoji:'🍌', group:'fruit',   good:true },
  { emoji:'🍇', group:'fruit',   good:true },
  { emoji:'🥛', group:'milk',    good:true },
  { emoji:'🧀', group:'milk',    good:true },
  { emoji:'🍗', group:'protein', good:true },
  { emoji:'🥚', group:'protein', good:true },

  { emoji:'🍩', group:'junk',    good:false },
  { emoji:'🍰', group:'junk',    good:false },
  { emoji:'🥤', group:'junk',    good:false },
  { emoji:'🍟', group:'junk',    good:false },
  { emoji:'🍕', group:'junk',    good:false }
];

function randomFood(diff){
  const ratio = typeof diff.goodRatio === 'number' ? diff.goodRatio : 0.7;
  const wantGood = Math.random() < ratio;
  const pool = FOODS.filter(f => f.good === wantGood);
  if (!pool.length) return FOODS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- Quest ----------
function createQuestState(){
  const goals = [
    { label:'เลือกอาหารให้ครบทั้ง 5 หมู่', target:15, prog:0, done:false },
    { label:'รักษาคอมโบยาว ๆ ให้ได้',       target:25, prog:0, done:false }
  ];
  const minis = [
    { label:'ผัก 5 ครั้ง',    target:5, prog:0, done:false, group:'veg' },
    { label:'ผลไม้ 5 ครั้ง',  target:5, prog:0, done:false, group:'fruit' },
    { label:'โปรตีน 5 ครั้ง', target:5, prog:0, done:false, group:'protein' }
  ];
  return { goals, minis };
}

function fireQuestUpdate(qState){
  if (!qState) return;
  const goals = qState.goals || [];
  const minis = qState.minis || [];

  const activeGoal = goals.find(g => !g.done) || null;
  const activeMini = minis.find(m => !m.done) || null;

  window.dispatchEvent(new CustomEvent('quest:update', {
    detail:{
      goal: activeGoal ? {
        label: activeGoal.label,
        prog:  activeGoal.prog,
        target:activeGoal.target
      } : null,
      mini: activeMini ? {
        label:  activeMini.label,
        prog:   activeMini.prog,
        target: activeMini.target
      } : null,
      goalsAll: goals.map(g=>({ done:g.done })),
      minisAll: minis.map(m=>({ done:m.done })),
      hint: activeGoal
        ? 'ทำภารกิจตามด้านบนให้ครบ 15 แล้วจะมีฉลองพิเศษให้เลย 🎁'
        : ''
    }
  }));
}

function checkQuestProgress(qState, ctx){
  if (!qState || !ctx) return;
  const { food, isGood, combo } = ctx;
  const goals = qState.goals || [];
  const minis = qState.minis || [];

  if (isGood){
    if (goals[0] && !goals[0].done){
      goals[0].prog += 1;
      if (goals[0].prog >= goals[0].target){
        goals[0].done = true;
        window.dispatchEvent(new CustomEvent('quest:celebrate', {
          detail:{ kind:'goal', index:1, total:goals.length }
        }));
      }
    }
    if (goals[1] && !goals[1].done && combo >= 5){
      goals[1].prog = Math.min(goals[1].target, goals[1].prog + 1);
      if (goals[1].prog >= goals[1].target){
        goals[1].done = true;
        window.dispatchEvent(new CustomEvent('quest:celebrate', {
          detail:{ kind:'goal', index:2, total:goals.length }
        }));
      }
    }
  }

  if (isGood && food && food.group){
    minis.forEach((m, idx)=>{
      if (!m.done && m.group === food.group){
        m.prog += 1;
        if (m.prog >= m.target){
          m.done = true;
          window.dispatchEvent(new CustomEvent('quest:celebrate', {
            detail:{ kind:'mini', index:idx+1, total:minis.length }
          }));
        }
      }
    });
  }

  const allGoalsDone = goals.length>0 && goals.every(g=>g.done);
  const allMinisDone = minis.length>0 && minis.every(m=>m.done);

  if (allGoalsDone && allMinisDone && !qState._allDoneFired){
    qState._allDoneFired = true;
    window.dispatchEvent(new CustomEvent('quest:all-complete', {
      detail:{ goalsTotal:goals.length, minisTotal:minis.length }
    }));
  }

  fireQuestUpdate(qState);
}

// ---------- FX UI (ใช้ layer กลางจอจาก /vr/particles.js) ----------
function fireHitUi(scoreDelta, judgment, good){
  const x = window.innerWidth / 2;
  const y = window.innerHeight / 2;

  window.dispatchEvent(new CustomEvent('hha:hit-ui', {
    detail:{ x, y, scoreDelta, judgment, good:!!good }
  }));

  if (Particles && typeof Particles.burstAt === 'function'){
    Particles.burstAt(x, y, { good });
  }
  if (Particles && typeof Particles.scorePop === 'function'){
    Particles.scorePop(x, y, scoreDelta, { judgment, good });
  }
}
function fireMissUi(judgment){
  const x = window.innerWidth / 2;
  const y = window.innerHeight / 2;

  window.dispatchEvent(new CustomEvent('hha:miss-ui', {
    detail:{ x, y, judgment: judgment || '' }
  }));
  if (Particles && typeof Particles.burstAt === 'function'){
    Particles.burstAt(x, y, { good:false });
  }
}

// ---------- Engine ----------
class GroupsGameEngine {
  constructor(){
    this.scene   = null;
    this.diffKey = 'normal';
    this.diff    = pickDifficulty('normal');

    this.running = false;

    this.score  = 0;
    this.combo  = 0;
    this.misses = 0;
    this.bestCombo = 0;

    this.fever = 0;
    this.feverActive = false;

    this.spawnTimer = null;
    this.targets    = [];

    this.questState = createQuestState();
  }

  start(diffKey){
    this.scene = document.querySelector('a-scene');
    if (!this.scene){
      console.error('[GroupsVR] scene not found');
      return;
    }

    this.diffKey = String(diffKey || 'normal').toLowerCase();
    this.diff    = pickDifficulty(this.diffKey);

    this.running = true;
    this.score   = 0;
    this.combo   = 0;
    this.misses  = 0;
    this.bestCombo = 0;
    this.fever   = 0;
    this.feverActive = false;
    this.questState  = createQuestState();

    fireQuestUpdate(this.questState);

    _ensureFeverBar();
    _setFever(0);
    _setFeverActive(false);
    _setShield(0);

    window.dispatchEvent(new CustomEvent('hha:score', {
      detail:{ score:this.score, combo:this.combo, misses:this.misses }
    }));
    window.dispatchEvent(new CustomEvent('hha:judge', {
      detail:{ label:'' }
    }));

    this._startSpawnLoop();
  }

  stop(reason){
    if (!this.running) return;
    this.running = false;

    if (this.spawnTimer){
      clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }
    this._clearTargets();

    const goals = this.questState?.goals || [];
    const minis = this.questState?.minis || [];
    const goalsCleared = goals.filter(g=>g.done).length;
    const goalsTotal   = goals.length;
    const miniCleared  = minis.filter(m=>m.done).length;
    const miniTotal    = minis.length;

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail:{
        reason: reason || 'manual',
        scoreFinal: this.score,
        comboMax: this.bestCombo,
        misses: this.misses,
        goalsCleared,
        goalsTotal,
        miniCleared,
        miniTotal
      }
    }));
  }

  _startSpawnLoop(){
    const interval   = this.diff.spawnInterval || 1200;
    const firstDelay = 600;

    setTimeout(()=>{
      if (!this.running) return;
      this._spawnOne();
    }, firstDelay);

    this.spawnTimer = setInterval(()=>{
      if (!this.running) return;
      this._spawnOne();
    }, interval);
  }

  _clearTargets(){
    this.targets.forEach(t=>{
      if (t.timeoutId) clear