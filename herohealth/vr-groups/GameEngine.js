// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (bright emoji targets)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ---------- Helpers ----------

const GROUPS = {
  1: ['🍚','🍙','🍞','🥯','🥐'],
  2: ['🥩','🍗','🍖','🥚','🧀','🐟','🫘'],
  3: ['🥦','🥕','🥬','🌽','🥗','🍅'],
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],
  5: ['🥛','🧈','🧀','🍨','🍦']
};
const GOOD_EMOJIS = Object.values(GROUPS).flat();
const JUNK_EMOJIS = ['🍔','🍟','🍕','🍩','🍪','🧋','🥤','🍫','🍬','🥓'];

function foodGroup(emo) {
  for (const [g, arr] of Object.entries(GROUPS)) {
    if (arr.includes(emo)) return +g;
  }
  return 0;
}
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(v,min,max){ if(v<min)return min; if(v>max)return max; return v; }

// world → screen (สำหรับ effect คะแนน)
function worldToScreen(el){
  try{
    const A = ROOT.AFRAME;
    const sceneEl = document.querySelector('a-scene');
    if(!A || !sceneEl || !sceneEl.object3D){
      return {x: window.innerWidth/2, y: window.innerHeight/2};
    }
    const camera = sceneEl.camera;
    const renderer = sceneEl.renderer;
    if(!camera || !renderer){
      return {x: window.innerWidth/2, y: window.innerHeight/2};
    }
    const THREE = A.THREE;
    const v = new THREE.Vector3();
    el.object3D.getWorldPosition(v);
    v.project(camera);
    const x = (v.x*0.5+0.5)*renderer.domElement.width;
    const y = (-v.y*0.5+0.5)*renderer.domElement.height;
    return {x,y};
  }catch{
    return {x: window.innerWidth/2, y: window.innerHeight/2};
  }
}

// ---------- Global modules ----------

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles || { burstAt(){}, scorePop(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI || {
    ensureFeverBar(){},
    setFever(){},
    setFeverActive(){}
  };

const { ensureFeverBar, setFever, setFeverActive } = FeverUI;

// difficulty.foodgroups.js
function pickDifficulty(key){
  const HH = ROOT.HeroHealth || {};
  if(HH.foodGroupsDifficulty && HH.foodGroupsDifficulty.get){
    return HH.foodGroupsDifficulty.get(key);
  }
  const table = {
    easy:   { spawnInterval:1300,lifetime:2800,maxActive:3,scale:1.25,feverGainHit:8,feverLossMiss:12 },
    normal: { spawnInterval:1000,lifetime:2200,maxActive:4,scale:1.0, feerGainHit:7,feverLossMiss:16 },
    hard:   { spawnInterval: 800,lifetime:1900,maxActive:5,scale:0.9, feverGainHit:6,feverLossMiss:22 }
  };
  key = String(key||'normal').toLowerCase();
  return table[key] || table.normal;
}

// quest-manager.js
const QuestManagerCtor =
  ROOT.GAME_MODULES && ROOT.GAME_MODULES.GroupsQuestManager
    ? ROOT.GAME_MODULES.GroupsQuestManager
    : null;

// ---------- State ----------

const FEVER_MAX = 100;
const GOOD_RATE = 0.75;

const state = {
  running:false,
  ended:false,
  diffKey:'normal',
  cfg:null,
  sceneEl:null,
  spawnTimer:null,
  timeListener:null,
  targets:new Set(),
  score:0,
  combo:0,
  comboMax:0,
  misses:0,
  fever:0,
  feverActive:false,
  questMgr:null,
  allQuestsFinished:false
};

// ---------- Fever / HUD ----------

function emitScoreAndJudge(label){
  try{
    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{score:state.score,combo:state.combo,misses:state.misses}
    }));
    if(label){
      window.dispatchEvent(new CustomEvent('hha:judge',{detail:{label}}));
    }
  }catch{}
}
function emitMiss(){
  try{ window.dispatchEvent(new CustomEvent('hha:miss',{detail:{}})); }catch{}
}
function emitFeverEvent(kind){
  try{ window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:kind}})); }catch{}
}
function updateFever(delta){
  const prev = state.fever;
  state.fever = clamp(prev+delta,0,FEVER_MAX);
  setFever(state.fever);
  if(!state.feverActive && state.fever>=FEVER_MAX){
    state.feverActive = true;
    setFeverActive(true);
    emitFeverEvent('start');
  }else if(state.feverActive && state.fever<=0){
    state.feverActive = false;
    setFeverActive(false);
    emitFeverEvent('end');
  }
}
function mult(){ return state.feverActive ? 2 : 1; }

// ---------- Quest / Stat ----------

function ensureQuestManager(){
  if(!QuestManagerCtor){ state.questMgr=null; return; }
  const qm = new QuestManagerCtor();
  qm.start(state.diffKey,{quest:{goalsPick:2,minisPick:3}});
  state.questMgr = qm;
  state.allQuestsFinished = false;
}
function getQuestSummary(){
  if(!state.questMgr || !state.questMgr.getSummary){
    return {cleared:0,total:0,clearedGoals:0,clearedMinis:0,totalGoals:0,totalMinis:0};
  }
  return state.questMgr.getSummary() || {cleared:0,total:0,clearedGoals:0,clearedMinis:0,totalGoals:0,totalMinis:0};
}
function emitStat(extra={}){
  const s = getQuestSummary();
  try{
    window.dispatchEvent(new CustomEvent('hha:stat',{
      detail:{
        mode:'Food Groups',
        difficulty:state.diffKey,
        score:state.score,
        combo:state.combo,
        misses:state.misses,
        fever:state.fever,
        feverActive:state.feverActive,
        goalsCleared:s.clearedGoals,
        goalsTotal:s.totalGoals,
        miniCleared:s.clearedMinis,
        miniTotal:s.totalMinis,
        ...extra
      }
    }));
  }catch{}
}
function maybeCheckAllQuestsDone(){
  if(!state.questMgr || state.allQuestsFinished) return;
  const s = getQuestSummary();
  if(s.total>0 && s.cleared>=s.total){
    state.allQuestsFinished = true;
    try{
      window.dispatchEvent(new CustomEvent('quest:all-complete',{
        detail:{goalsTotal:s.totalGoals,minisTotal:s.totalMinis}
      }));
    }catch{}
  }
}

// ---------- Targets ----------

function createTarget(){
  if(!state.sceneEl || !state.cfg) return;
  if(state.targets.size >= state.cfg.maxActive) return;

  const isGood = Math.random() < GOOD_RATE;
  const emoji = isGood ? pick(GOOD_EMOJIS) : pick(JUNK_EMOJIS);
  const gId   = isGood ? foodGroup(emoji) : 0;

  const el = document.createElement('a-entity');

  // ★ เป้า: แผ่นสี่เหลี่ยมใหญ่ สีเขียวสว่าง เห็นชัดมาก
  const scale = state.cfg.scale || 1.0;
  const size  = 0.9 * scale;

  el.setAttribute('geometry', `primitive: plane; width: ${size}; height: ${size}`);
  el.setAttribute('material',
    'color: #22c55e; shader: flat; opacity: 0.96; side: double');
  // หันเข้าหากล้องแน่ ๆ
  el.setAttribute('rotation', '0 0 0');

  // วางหน้า platform กลางจอ
  const x = (Math.random()*2.4) - 1.2;   // -1.2 .. 1.2
  const y = 1.4 + Math.random()*0.6;     // 1.4 .. 2.0
  const z = -2.6;                        // หน้า platform
  el.setAttribute('position', `${x} ${y} ${z}`);

  // ★ ลูก emoji ข้างบน
  const emojiText = document.createElement('a-text');
  emojiText.setAttribute('value', emoji);
  emojiText.setAttribute('align','center');
  emojiText.setAttribute('color','#ffffff');
  emojiText.setAttribute('width','1.8');
  emojiText.setAttribute('anchor','center');
  emojiText.setAttribute('position','0 0 0.02');
  el.appendChild(emojiText);

  el.setAttribute('data-hha-tgt','1');

  el.setAttribute('animation__pop',
    'property: scale; from: 0.01 0.01 0.01; to: 1 1 1; dur: 160; easing: easeOutBack');

  const targetObj = {
    el,
    emoji,
    isGood,
    groupId:gId,
    hit:false,
    timeoutId:null,
    _onClick:null
  };

  const onClick = (evt)=>handleHit(targetObj,evt);
  targetObj._onClick = onClick;
  el.addEventListener('click', onClick);

  const timeoutId = setTimeout(()=>removeTarget(targetObj), state.cfg.lifetime);
  targetObj.timeoutId = timeoutId;

  state.targets.add(targetObj);
  state.sceneEl.appendChild(el);

  try{
    console.log('[GroupsVR] spawn target', {emoji,isGood,gId,pos:{x,y,z}});
  }catch{}
}

function removeTarget(t){
  if(!t || !state.targets.has(t)) return;
  const { el, timeoutId, _onClick } = t;
  if(timeoutId) clearTimeout(timeoutId);
  if(el && el.parentNode){
    try{ el.removeEventListener('click', _onClick); }catch{}
    el.parentNode.removeChild(el);
  }
  state.targets.delete(t);
}

// ---------- Judge ----------

function handleHit(targetObj){
  if(!state.running || !targetObj || targetObj.hit) return;
  targetObj.hit = true;

  const el = targetObj.el;
  const pos2d = worldToScreen(el);

  removeTarget(targetObj);

  const isGood = !!targetObj.isGood;
  const emoji  = targetObj.emoji;
  const gId    = targetObj.groupId || 0;

  if(state.questMgr && state.questMgr.onHit){
    state.questMgr.onHit({emoji,isGood,groupId:gId});
  }

  let judgment = '';
  let delta = 0;

  if(isGood){
    state.combo += 1;
    state.comboMax = Math.max(state.comboMax, state.combo);
    const base = 18;
    delta = Math.round((base + state.combo*2) * mult());
    state.score += delta;

    updateFever(state.cfg.feverGainHit || 7);

    if(state.combo >= 12)      judgment = 'PERFECT';
    else if(state.combo >= 6)  judgment = 'GREAT';
    else                       judgment = 'GOOD';

    try{
      Particles.scorePop(pos2d.x,pos2d.y,'+'+delta,{good:true,judgment});
      Particles.burstAt(pos2d.x,pos2d.y,{good:true,color:'#22c55e'});
    }catch{}

    emitScoreAndJudge(judgment);
    emitStat({ lastHitGood:true, lastGroup:gId });
  }else{
    state.misses += 1;
    state.combo = 0;
    delta = -14;
    state.score = Math.max(0, state.score + delta);

    updateFever(-(state.cfg.feverLossMiss || 16));
    judgment = 'MISS';

    try{
      Particles.scorePop(pos2d.x,pos2d.y,String(delta),{good:false,judgment});
      Particles.burstAt(pos2d.x,pos2d.y,{good:false,color:'#f97316'});
    }catch{}

    emitMiss();
    emitScoreAndJudge(judgment);
    emitStat({ lastHitGood:false });
  }

  maybeCheckAllQuestsDone();
}

// ---------- Time tick ----------

function onTimeTick(e){
  if(!state.running) return;
  const sec = e && e.detail && typeof e.detail.sec === 'number'
    ? (e.detail.sec | 0) : 0;
  if(sec <= 0) return;

  if(state.combo <= 0 && state.fever > 0){
    updateFever(-2);
    emitStat();
  }
}

// ---------- Start / Stop ----------

async function startEngine(diffKey='normal'){
  const sceneEl = document.querySelector('a-scene');
  if(!sceneEl){
    console.error('[GroupsVR] <a-scene> not found');
    return;
  }
  if(!sceneEl.hasLoaded){
    await new Promise(res=>sceneEl.addEventListener('loaded',res,{once:true}));
  }

  if(state.running) stopEngine('restart');

  state.running = true;
  state.ended = false;
  state.diffKey = String(diffKey||'normal').toLowerCase();
  state.cfg = pickDifficulty(state.diffKey);
  state.sceneEl = sceneEl;

  state.targets.forEach(t=>removeTarget(t));
  state.targets.clear();

  state.score = 0;
  state.combo = 0;
  state.comboMax = 0;
  state.misses = 0;
  state.fever = 0;
  state.feverActive = false;
  state.allQuestsFinished = false;

  ensureFeverBar();
  setFever(0);
  setFeverActive(false);

  ensureQuestManager();
  emitStat();

  state.timeListener = onTimeTick;
  window.addEventListener('hha:time', state.timeListener);

  state.spawnTimer = setInterval(()=>{
    if(!state.running) return;
    createTarget();
  }, state.cfg.spawnInterval || 1000);

  // spawn ทันที 1 ลูก
  createTarget();
}

function stopEngine(reason='manual'){
  if(!state.running && state.ended) return;

  state.running = false;

  if(state.spawnTimer){
    clearInterval(state.spawnTimer);
    state.spawnTimer = null;
  }
  if(state.timeListener){
    window.removeEventListener('hha:time', state.timeListener);
    state.timeListener = null;
  }
  state.targets.forEach(t=>removeTarget(t));
  state.targets.clear();

  if(!state.ended){
    state.ended = true;
    const s = getQuestSummary();
    try{
      window.dispatchEvent(new CustomEvent('hha:end',{
        detail:{
          mode:'Food Groups',
          difficulty:state.diffKey,
          reason,
          scoreFinal:state.score,
          comboMax:state.comboMax,
          misses:state.misses,
          goalsCleared:s.clearedGoals,
          goalsTotal:s.totalGoals,
          miniCleared:s.clearedMinis,
          miniTotal:s.totalMinis
        }
      }));
    }catch{}
  }
}

// ---------- Export ----------

export const GameEngine = { start:startEngine, stop:stopEngine };
export default GameEngine;
