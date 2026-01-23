// === /herohealth/vr-groups/groups.safe.js ===
// Food Groups VR — SAFE ENGINE (PRODUCTION)
// ✅ Uses mode-factory spawn (tap + hha:shoot)
// ✅ decorateTarget => emoji by Thai 5 food groups
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end, hha:predict
// ✅ Play: phases ON (storm/boss vibe)
// ✅ Research: deterministic seed + phases OFF

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
const pct2 = (n)=> Math.round((Number(n)||0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function pick(arr, rng){ return arr[Math.floor((rng() * arr.length))]; }

// ไทย 5 หมู่ (ตามที่ “ห้ามแปลผัน”)
const GROUP_EMOJI = [
  ['🥩','🍗','🐟','🥚','🥛','🫘'], // 1 โปรตีน
  ['🍚','🍞','🍜','🥔','🍠','🥖'], // 2 คาร์บ
  ['🥦','🥬','🥕','🥒','🌽','🍆'], // 3 ผัก
  ['🍎','🍌','🍊','🍉','🍇','🥭'], // 4 ผลไม้
  ['🥑','🥜','🧈','🧀','🫒','🌰'], // 5 ไขมัน
];

const STATE = {
  running:false,
  ended:false,

  score:0,
  hitGood:0,
  hitWrong:0,
  timeLeft:0,
  timer:null,

  // “ภารกิจ” สไตล์ Groups: เก็บให้ครบ 5 หมู่ (เหมือน Plate)
  g:[0,0,0,0,0],
  goal:{ name:'จำแนกอาหารให้ครบ 5 หมู่', sub:'เก็บให้ครบทุกหมู่', cur:0, target:5, done:false },

  cfg:null,
  rng:Math.random,
  engine:null,

  __predTick:0,
};

function coach(msg, tag='Coach'){ emit('hha:coach', { msg, tag }); }

function emitQuest(){
  emit('quest:update', {
    goal:{ ...STATE.goal },
    mini:null,
    allDone: !!STATE.goal.done
  });
}

function emitScore(){
  emit('hha:score', { score:STATE.score, hitGood:STATE.hitGood, hitWrong:STATE.hitWrong });
}

function accuracy(){
  const total = STATE.hitGood + STATE.hitWrong;
  if(total<=0) return 1;
  return STATE.hitGood / total;
}

function decorateTarget(el, t){
  // Groups: ทุกเป้าเป็น “หมู่ใดหมู่หนึ่ง” (good) เพื่อให้เด็กจำ
  const gi = clamp(t.groupIndex ?? 0, 0, 4);
  el.textContent = pick(GROUP_EMOJI[gi], t.rng || STATE.rng);
  el.dataset.group = String(gi+1);
  el.setAttribute('aria-label', `หมู่ ${gi+1}`);
}

function onHitGroup(gi){
  STATE.hitGood++;
  STATE.score += 100;
  STATE.g[gi]++;

  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('สุดยอด! ครบ 5 หมู่แล้ว 🎉');
    }
  }
  emitScore();
  emitQuest();
  if(STATE.goal.done) endGame('win');
}

function onExpire(){
  // เพื่อให้ไม่โหดเกิน: ไม่เพิ่ม miss แต่ลดคะแนนนิด ๆ
  STATE.score = Math.max(0, STATE.score - 10);
  emitScore();
}

function predictWinProb(){
  const acc = accuracy();
  const time = Math.max(0, STATE.timeLeft);
  const missing = 5 - STATE.g.filter(v=>v>0).length;

  let p = 0.20;
  p += (acc - 0.6) * 0.8;
  p += (time/90) * 0.25;
  p -= missing * 0.12;
  p = clamp(p, 0, 1);

  return { p, accPct: Math.round(acc*100), missing, timeLeft: time };
}

function stopSpawner(){ try{ STATE.engine?.stop?.(); }catch{} STATE.engine=null; }

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);
  stopSpawner();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    accuracyPct: pct2(accuracy()*100),
    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    g1:STATE.g[0], g2:STATE.g[1], g3:STATE.g[2], g4:STATE.g[3], g5:STATE.g[4],
  });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });
  STATE.__predTick = 0;

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    STATE.__predTick++;
    if(STATE.__predTick % 5 === 0){
      const pr = predictWinProb();
      emit('hha:predict', { pWin:pct2(pr.p), accPct:pr.accPct, missingGroups:pr.missing, timeLeft:pr.timeLeft });
    }

    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

function makeSpawner(mount){
  const isResearch = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    safeVarPrefix:'groups',           // ✅ ใช้ vars ของ groups-vr.css
    spawnRate: isResearch ? 900 : 820,
    sizeRange:[44,64],
    kinds:[ { kind:'good', weight:1 } ], // Groups มีแต่ “หมู่” ล้วน
    decorateTarget,
    onHit:(t)=>{
      // hit = ได้หมู่ของเป้านั้นเลย
      const gi = clamp(t.groupIndex ?? 0, 0, 4);
      onHitGroup(gi);
    },
    onExpire:()=> onExpire()
  });
}

export function boot({ mount, cfg }){
  if(!mount) throw new Error('GroupsVR: mount missing');

  STATE.cfg = cfg;
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.hitGood = 0;
  STATE.hitWrong = 0;
  STATE.g = [0,0,0,0,0];
  STATE.goal.cur = 0;
  STATE.goal.done = false;

  const isResearch = (cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.rng = isResearch ? seededRng(cfg.seed || Date.now()) : Math.random;

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'groups',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  stopSpawner();
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เก็บอาหารให้ครบ 5 หมู่ 🧠🍽️');
}