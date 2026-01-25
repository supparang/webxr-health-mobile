// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION + Boss/Storm variants + AI meter)
// HHA Standard

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, emojiForGroup } from '../vr/food5-th.js';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};
const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (seed >>> 0) || (Date.now()>>>0);
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function emit(name, detail){ WIN.dispatchEvent(new CustomEvent(name, { detail })); }

function shortGroupLabel(groupId){
  const g = FOOD5[groupId];
  if(!g) return 'หมู่ ?';
  const t = String(g.labelTH || '');
  return t.replace(/^หมู่\s*\d+\s*/,'').trim() || t;
}

/* ------------------------------------------------
 * STATE
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  g:[0,0,0,0,0],  // 5 groups

  goal:{ name:'เติมจานให้ครบ 5 หมู่', sub:'เก็บอาหารให้ครบทุกหมู่', cur:0, target:5, done:false },
  mini:{ name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80%', cur:0, target:80, done:false },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  spawner:null,

  // AI predictor
  aiTimer:null,
  missInWindow:0,
  lastEmitAiAt:0,

  // phases
  nextStormAt:0,
  nextBossAt:0,
  bossAlive:false,
  stormActive:false,
  stormFlip:0,
  bossFlip:0,
};

function coach(msg, tag='Coach'){ emit('hha:coach', { msg, tag }); }

function emitQuest(){
  emit('quest:update', {
    goal:{ name: STATE.goal.name, sub: STATE.goal.sub, cur: STATE.goal.cur, target: STATE.goal.target },
    mini:{ name: STATE.mini.name, sub: STATE.mini.sub, cur: STATE.mini.cur, target: STATE.mini.target, done: STATE.mini.done },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
}
function addScore(v){ STATE.score += v; emitScore(); }
function addCombo(){ STATE.combo++; STATE.comboMax = Math.max(STATE.comboMax, STATE.combo); }
function resetCombo(){ STATE.combo = 0; }

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function registerMiss(){
  STATE.miss++;
  STATE.missInWindow = Math.min(6, STATE.missInWindow + 1.25);
}

/* ------------------------------------------------
 * HIT/EXPIRE
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  registerMiss();
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  registerMiss();
  resetCombo();
}

/* ------------------------------------------------
 * TIMER + END
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearInterval(STATE.aiTimer);

  try{ STATE.spawner && STATE.spawner.stop && STATE.spawner.stop(); }catch{}
  STATE.spawner = null;

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct(accuracy() * 100),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.cfg && STATE.cfg.ai && STATE.cfg.runMode === 'play'){
      tickPhases();
    }

    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * AI Prediction (lightweight)
 * ------------------------------------------------ */
function startAiLoop(){
  clearInterval(STATE.aiTimer);
  if(!STATE.cfg.ai) return;

  STATE.lastEmitAiAt = 0;
  STATE.aiTimer = setInterval(()=>{
    if(!STATE.running) return;

    // decay
    STATE.missInWindow = Math.max(0, STATE.missInWindow - 0.18);

    const stats = STATE.spawner && STATE.spawner.getStats ? STATE.spawner.getStats() : { activeCount:0 };
    const active = Number(stats.activeCount||0);

    const acc = accuracy();
    const missFactor = clamp(STATE.missInWindow / 4.0, 0, 1);
    const crowdFactor = clamp((active - 2) / 7.0, 0, 1);
    const lowAcc = clamp((0.92 - acc) / 0.35, 0, 1);
    const phaseBoost = (STATE.stormActive ? 0.22 : 0) + (STATE.bossAlive ? 0.18 : 0);

    let pMissSoon = 0.10
      + 0.40*missFactor
      + 0.25*crowdFactor
      + 0.20*lowAcc
      + phaseBoost;

    pMissSoon = clamp(pMissSoon, 0, 0.98);

    const t = now();
    if(t - STATE.lastEmitAiAt >= 250){
      STATE.lastEmitAiAt = t;
      emit('hha:ai', {
        pMissSoon,
        activeTargets: active,
        accPct: Math.round(acc*100),
        phase: STATE.stormActive ? 'storm' : (STATE.bossAlive ? 'boss' : 'normal')
      });
    }
  }, 60);
}

/* ------------------------------------------------
 * DECORATE TARGET (emoji/label/boss hearts)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  const kind = String(target.kind || 'good');
  const gid = (target.groupIndex|0) + 1;

  if(kind === 'junk'){
    const em = pickEmoji(target.rng, JUNK.emojis);
    el.innerHTML = `<div class="fg-emoji">${em}</div><div class="fg-label">JUNK</div>`;
    return;
  }

  if(kind === 'boss'){
    const hp = Math.max(1, target.hp|0);
    const hearts = '❤'.repeat(Math.min(3, hp));
    el.innerHTML = `<div class="fg-emoji">🍽️</div><div class="fg-label">BOSS ${hearts}</div>`;
    return;
  }

  const em = emojiForGroup(target.rng, gid);
  const lbl = shortGroupLabel(gid);
  el.innerHTML = `<div class="fg-emoji">${em}</div><div class="fg-label">${lbl}</div>`;
}
/* ------------------------------------------------
 * BOSS (2 variants)
 *  - Variant A: boss-float (HP=3)
 *  - Variant B: boss + 1 decoy junk (boss-decoy class)
 * ------------------------------------------------ */
function spawnBoss(){
  if(STATE.bossAlive) return;
  if(!STATE.spawner || !STATE.spawner.computeSpawnRect) return;

  const rect = STATE.spawner.computeSpawnRect();
  if(rect.w < 120 || rect.h < 120) return;

  STATE.bossAlive = true;
  emit('hha:boss', { on:true });
  coach('บอสมาแล้ว! ยิง 🍽️ ให้ครบ 3 ครั้ง! 🔥', 'Boss');

  const cx = rect.left + rect.w * (0.50 + (STATE.rng()-0.5)*0.10);
  const cy = rect.top  + rect.h * (0.45 + (STATE.rng()-0.5)*0.10);

  const variant = (STATE.bossFlip++ % 2 === 0) ? 'float' : 'decoy';
  const bossClass = (variant === 'float') ? 'boss boss-float' : 'boss';

  STATE.spawner.spawnCustom({
    x: cx, y: cy,
    kind:'boss',
    className: bossClass,
    size: Math.round(86 + STATE.rng()*12),
    ttlMs: 2600,
    groupIndex: Math.floor(STATE.rng()*5),
    hp: 3
  });

  if(variant === 'decoy'){
    const dx = cx + (STATE.rng() < 0.5 ? -1 : 1) * (rect.w*0.16);
    const dy = cy + (STATE.rng() < 0.5 ? -1 : 1) * (rect.h*0.12);

    STATE.spawner.spawnCustom({
      x: dx, y: dy,
      kind:'junk',
      className: 'boss-decoy',
      size: 72,
      ttlMs: 1900,
      groupIndex: Math.floor(STATE.rng()*5),
      hp: 1
    });

    coach('มี “บอสหลอก” ด้วยนะ! ระวัง! 😈', 'Boss');
  }

  setTimeout(()=>{
    STATE.bossAlive = false;
    emit('hha:boss', { on:false });
  }, 3000);
}

/* ------------------------------------------------
 * STORM (2 patterns)
 *  - Pattern A: CROSS
 *  - Pattern B: DOUBLE RING
 * ------------------------------------------------ */
function stormCross(rect, ms){
  const cx = rect.left + rect.w*0.50;
  const cy = rect.top  + rect.h*0.52;

  STATE.spawner.spawnCustom({ x:cx, y:cy, kind:'junk', className:'storm-tag', size:56, ttlMs:ms, groupIndex:0, hp:1 });

  const arms = [
    { x: cx, y: cy - rect.h*0.22 },
    { x: cx, y: cy + rect.h*0.22 },
    { x: cx - rect.w*0.22, y: cy },
    { x: cx + rect.w*0.22, y: cy },
  ];

  for(const p of arms){
    STATE.spawner.spawnCustom({ x:p.x, y:p.y, kind:'junk', className:'storm-tag', size:52, ttlMs:ms, hp:1 });
  }

  for(let k=0;k<5;k++){
    const t = k/4;
    STATE.spawner.spawnCustom({
      x: rect.left + rect.w*(0.24 + 0.52*t),
      y: rect.top  + rect.h*(0.52),
      kind:'good',
      className:'storm-tag',
      size:56,
      ttlMs: ms+220,
      groupIndex: k%5,
      hp:1
    });
  }
}

function stormDoubleRing(rect, ms){
  const cx = rect.left + rect.w*0.50;
  const cy = rect.top  + rect.h*0.52;

  const r1 = Math.min(rect.w, rect.h) * 0.18;
  const r2 = Math.min(rect.w, rect.h) * 0.30;

  function ring(r, n){
    for(let i=0;i<n;i++){
      const a = (Math.PI*2)*(i/n);
      const x = cx + Math.cos(a)*r;
      const y = cy + Math.sin(a)*r;
      const isOuter = (r === r2);
      const kind = isOuter ? 'junk' : (i%2===0 ? 'good' : 'junk');

      STATE.spawner.spawnCustom({
        x, y,
        kind,
        className:'storm-tag',
        size: 52,
        ttlMs: ms,
        groupIndex: i%5,
        hp: 1
      });
    }
  }

  ring(r2, 10);
  ring(r1, 8);

  for(let k=0;k<3;k++){
    STATE.spawner.spawnCustom({
      x: cx + (k-1)*rect.w*0.08,
      y: cy + rect.h*0.12,
      kind:'good',
      className:'storm-tag',
      size:58,
      ttlMs: ms+260,
      groupIndex: (k+2)%5,
      hp:1
    });
  }
}

function spawnStorm(){
  if(STATE.stormActive) return;
  if(!STATE.spawner || !STATE.spawner.computeSpawnRect) return;

  const rect = STATE.spawner.computeSpawnRect();
  if(rect.w < 160 || rect.h < 160) return;

  STATE.stormActive = true;
  const ms = 1400;

  emit('hha:storm', { on:true, ms });
  coach('STORM! จับตาให้ดี! 🌪️', 'Storm');

  const pattern = (STATE.stormFlip++ % 2 === 0) ? 'cross' : 'double';
  if(pattern === 'cross') stormCross(rect, ms);
  else stormDoubleRing(rect, ms);

  setTimeout(()=>{
    STATE.stormActive = false;
    emit('hha:storm', { on:false });
  }, ms + 140);
}

/* ------------------------------------------------
 * SCHEDULER
 * ------------------------------------------------ */
function tickPhases(){
  const t = now();

  if(t >= STATE.nextStormAt && !STATE.bossAlive){
    spawnStorm();
    STATE.nextStormAt = t + (12000 + STATE.rng()*6000);
  }

  if(t >= STATE.nextBossAt && !STATE.stormActive){
    spawnBoss();
    STATE.nextBossAt = t + (18000 + STATE.rng()*8000);
  }
}
/* ------------------------------------------------
 * MAIN BOOT
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg;
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.g = [0,0,0,0,0];
  STATE.goal.cur = 0; STATE.goal.done = false;
  STATE.mini.cur = 0; STATE.mini.done = false;

  STATE.missInWindow = 0;

  STATE.bossAlive = false;
  STATE.stormActive = false;

  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  const phasesOn = (cfg.runMode === 'play') && !!cfg.ai;

  const t0 = now();
  STATE.nextStormAt = t0 + (6500 + STATE.rng()*3500);
  STATE.nextBossAt  = t0 + (9800 + STATE.rng()*4500);

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    ai: cfg.ai ? 'on' : 'off'
  });

  emitQuest();
  startTimer();

  const spawnRate =
    (cfg.diff === 'hard') ? 740 :
    (cfg.diff === 'easy') ? 980 :
    860;

  const sizeRange =
    (cfg.diff === 'hard') ? [44,64] :
    (cfg.diff === 'easy') ? [48,74] :
    [46,70];

  const kinds = [
    { kind:'good', weight:0.70, ttlMs: (cfg.diff==='hard'? 1850 : 2150), hp: 1 },
    { kind:'junk', weight:0.30, ttlMs: (cfg.diff==='hard'? 1500 : 1750), hp: 1 },
  ];

  STATE.spawner = spawnBoot({
    mount,
    seed: cfg.seed,
    spawnRate,
    sizeRange,
    kinds,
    decorateTarget,

    onHit:(t)=>{
      if(t.kind === 'boss'){
        if(t.partial){
          addScore(20);
          coach(`บอสยังไม่แตก! เหลืออีก ${t.hpLeft} ครั้ง!`, 'Boss');
          return;
        }

        STATE.bossAlive = false;
        emit('hha:boss', { on:false });

        addCombo();
        addScore(380 + STATE.combo*10);

        const gi = (t.groupIndex != null) ? (t.groupIndex|0) : Math.floor(STATE.rng()*5);
        onHitGood(clamp(gi,0,4));
        coach('บอสแตกแล้ว! สุดยอด! 💥', 'Boss');
        return;
      }

      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? (t.groupIndex|0) : Math.floor(STATE.rng()*5);
        onHitGood(clamp(gi,0,4));
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(t.kind === 'boss'){
        STATE.bossAlive = false;
        emit('hha:boss', { on:false });
        onExpireGood();
        coach('บอสหนีไปแล้ว! 🫣', 'Boss');
        return;
      }
      if(t.kind === 'good') onExpireGood();
    }
  });

  startAiLoop();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');

  if(phasesOn){
    // timer tick will schedule phases
  }
}