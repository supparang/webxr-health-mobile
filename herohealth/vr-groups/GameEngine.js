// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (วงกลม + emoji + Fever + Quest)
// 2025-12-12: ตัด import emoji-image.js ออก ใช้ a-text แทน
// เป้าโผล่แน่ ๆ + เป็น emoji + ผูกคะแนน/quest เหมือน GoodJunk

'use strict';

const A = window.AFRAME;
if (!A) {
  console.error('[GroupsVR] AFRAME not found');
}

const GM = window.GAME_MODULES || (window.GAME_MODULES = {});
const GroupsFx = GM.foodGroupsFx || null;

// Fever UI (ใช้ของกลาง HeroHealth)
const FeverGlobal = (window.HHA_FeverUI || window.FEVER_UI || {});
const _ensureFeverBar = FeverGlobal.ensureFeverBar || window.ensureFeverBar || (()=>{});
const _setFever       = FeverGlobal.setFever       || window.setFever       || (()=>{});
const _setFeverActive = FeverGlobal.setFeverActive || window.setFeverActive || (()=>{});
const _setShield      = FeverGlobal.setShield      || window.setShield      || (()=>{});

// FX layer กลางจอ (Particles DOM)
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
      scale:         0.9,
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

// ---------- FX UI (DOM) ----------
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
    // รอจนกว่าจะมี a-scene (กันเคสเรียกเร็วไป)
    const tryStart = () => {
      this.scene = document.querySelector('a-scene');
      if (!this.scene){
        console.warn('[GroupsVR] scene not ready, retry...');
        setTimeout(tryStart, 200);
        return;
      }

      this._reallyStart(diffKey);
    };
    tryStart();
  }

  _reallyStart(diffKey){
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
      if (t.timeoutId) clearTimeout(t.timeoutId);
      if (t.el && t.el.parentNode){
        t.el.parentNode.removeChild(t.el);
      }
    });
    this.targets.length = 0;
  }

  // ===== spawn เป้า: วงกลม + emoji (a-text) =====
  _spawnOne(){
    if (!this.scene || !this.running) return;

    const maxActive = this.diff.maxActive || 5;
    if (this.targets.length >= maxActive) return;

    const food   = randomFood(this.diff);
    const isGood = !!food.good;

    // โผล่ในมุมมองตรง ๆ
    const x = randRange(-1.6, 1.6);
    const y = randRange(1.2, 2.0);
    const z = -4.0;

    const scale  = this.diff.scale || 1.0;
    const radius = 0.5 * scale;

    const wrap = document.createElement('a-entity');
    wrap.setAttribute('class', 'fg-target');
    wrap.setAttribute('data-hha-tgt', '1');
    wrap.setAttribute('position', `${x} ${y} ${z}`);
    wrap.setAttribute('rotation', '0 0 0');
    wrap.setAttribute('visible', 'true');

    // วงกลมพื้นหลัง
    const bg = document.createElement('a-circle');
    bg.setAttribute('radius', radius.toString());
    bg.setAttribute(
      'material',
      `shader: flat; side: double; color: ${isGood ? '#22c55e' : '#f97316'}; opacity: 0.92; transparent: true`
    );
    bg.setAttribute('rotation', '0 0 0');
    bg.setAttribute('data-hha-tgt', '1');
    bg.setAttribute('visible', 'true');
    wrap.appendChild(bg);

    // emoji ด้วย a-text (ไม่ต้อง import รูป)
    const label = document.createElement('a-entity');
    label.setAttribute(
      'text',
      `value: ${food.emoji}; align: center; color: #ffffff; width: ${radius*2.4};`
    );
    label.setAttribute('position', '0 0 0.02');
    label.setAttribute('data-hha-tgt', '1');
    label.setAttribute('visible', 'true');
    wrap.appendChild(label);

    const onHit = (evt)=> {
      if (!this.running) return;
      this._onTargetHit(wrap, food, isGood, evt);
    };
    wrap.addEventListener('click', onHit);
    bg.addEventListener('click', onHit);
    label.addEventListener('click', onHit);

    // pop ตอนเกิด
    wrap.setAttribute(
      'animation__pop',
      'property: scale; from: 0.4 0.4 0.4; to: 1 1 1; dur: 260; easing: easeOutBack'
    );

    this.scene.appendChild(wrap);

    const life = this.diff.lifeTime || 3600;
    const timeoutId = setTimeout(()=>{
      this._onTargetTimeout(wrap, food, isGood);
    }, life);

    this.targets.push({ el: wrap, food, good:isGood, timeoutId });
  }

  _removeTarget(el){
    const idx = this.targets.findIndex(t => t.el === el);
    if (idx >= 0){
      const t = this.targets[idx];
      if (t.timeoutId) clearTimeout(t.timeoutId);
      this.targets.splice(idx, 1);
    }
    if (el && el.parentNode){
      el.parentNode.removeChild(el);
    }
  }

  _applyFever(onGood){
    const delta = onGood ? 12 : -18;
    this.fever = clamp(this.fever + delta, 0, FEVER_MAX);
    _setFever(this.fever / FEVER_MAX);

    if (!this.feverActive && this.fever >= FEVER_MAX){
      this.feverActive = true;
      this.fever = FEVER_MAX;
      _setFeverActive(true);
      window.dispatchEvent(new CustomEvent('hha:fever', {
        detail:{ state:'start' }
      }));
    } else if (this.feverActive && this.fever <= 0){
      this.feverActive = false;
      _setFeverActive(false);
      window.dispatchEvent(new CustomEvent('hha:fever', {
        detail:{ state:'end' }
      }));
    }
  }

  _judgeLabel(isGood, actuallyGood){
    if (isGood && actuallyGood) return 'PERFECT';
    if (isGood && !actuallyGood) return 'MISS';
    if (!isGood && actuallyGood) return 'MISS';
    return 'GOOD';
  }

  _onTargetHit(el, food, isGood, evt){
    this._removeTarget(el);

    const actuallyGood = isGood;
    const correct = actuallyGood;

    try {
      if (GroupsFx && typeof GroupsFx.burst === 'function'){
        let worldPos = null;
        if (evt && evt.detail && evt.detail.intersection && evt.detail.intersection.point){
          worldPos = evt.detail.intersection.point;
        } else if (el.object3D && el.object3D.getWorldPosition){
          const v = new A.THREE.Vector3();
          el.object3D.getWorldPosition(v);
          worldPos = v;
        }
        if (worldPos){
          GroupsFx.burst(worldPos);
        }
      }
    } catch(err){
      console.warn('[GroupsVR] burst error:', err);
    }

    let scoreDelta = 0;
    let judgment = '';

    if (correct){
      this.combo += 1;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;

      scoreDelta = 50 + Math.floor(this.combo * 2);
      if (this.feverActive){
        scoreDelta = Math.floor(scoreDelta * 1.5);
      }
      this.score += scoreDelta;
      judgment = this._judgeLabel(true, actuallyGood);

      this._applyFever(true);

      checkQuestProgress(this.questState, {
        food,
        isGood:true,
        combo:this.combo
      });

      fireHitUi('+'+scoreDelta, judgment, true);
      window.dispatchEvent(new CustomEvent('hha:judge', {
        detail:{ label: judgment }
      }));
    } else {
      this.combo = 0;
      this.misses += 1;
      judgment = 'MISS';

      this._applyFever(false);
      fireMissUi(judgment);

      window.dispatchEvent(new CustomEvent('hha:judge', {
        detail:{ label:'MISS' }
      }));
      window.dispatchEvent(new CustomEvent('hha:miss', { detail:{} }));
    }

    window.dispatchEvent(new CustomEvent('hha:score', {
      detail:{ score:this.score, combo:this.combo, misses:this.misses }
    }));
  }

  _onTargetTimeout(el, food, isGood){
    this._removeTarget(el);

    if (isGood && this.running){
      this.combo = 0;
      this.misses += 1;

      this._applyFever(false);
      fireMissUi('MISS');

      window.dispatchEvent(new CustomEvent('hha:judge', {
        detail:{ label:'MISS' }
      }));
      window.dispatchEvent(new CustomEvent('hha:miss', { detail:{} }));
      window.dispatchEvent(new CustomEvent('hha:score', {
        detail:{ score:this.score, combo:this.combo, misses:this.misses }
      }));
    }
  }
}

// ---------- export ----------
export const GameEngine = {
  _inst: null,
  start(diffKey){
    if (!this._inst){
      this._inst = new GroupsGameEngine();
    }
    this._inst.start(diffKey || 'normal');
  },
  stop(reason){
    if (this._inst){
      this._inst.stop(reason);
    }
  }
};

GM.GroupsGameEngine = GameEngine;
window.GAME_MODULES = GM;