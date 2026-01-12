// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — PACK K
// ------------------------------------------------
// ✅ PACK K: 5 หมู่จริง + show missing groups + timed mini quest "เติมหมู่ที่ขาด 12s"
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){ return Date.now(); }

/* ---------------- PACK K: 5 หมู่จริง ---------------- */
const GROUPS = [
  { id:1, name:'ข้าว-แป้ง',       emoji:'🍚', color:'rgba(245,158,11,.22)' },
  { id:2, name:'ผัก',             emoji:'🥦', color:'rgba(34,197,94,.22)'  },
  { id:3, name:'ผลไม้',           emoji:'🍎', color:'rgba(236,72,153,.18)' },
  { id:4, name:'เนื้อสัตว์-ถั่ว', emoji:'🍗', color:'rgba(59,130,246,.18)' },
  { id:5, name:'นม',              emoji:'🥛', color:'rgba(34,211,238,.18)' },
];

function groupLabel(i){
  const g = GROUPS[i] || GROUPS[0];
  return `${g.emoji}${g.id}`;
}
function missingGroups(){
  const miss = [];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) miss.push(GROUPS[i].emoji);
  }
  return miss;
}
function missingText(){
  const miss = missingGroups();
  if(!miss.length) return 'ครบแล้วทุกหมู่ ✅';
  return `ยังขาด: ${miss.join(' ')}`;
}

/* ---------------- Engine state ---------------- */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  g:[0,0,0,0,0],

  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'ยังขาด: 🍚 🥦 🍎 🍗 🥛',
    cur:0,
    target:5,
    done:false
  },

  // PACK K: timed mini quest
  mini:{
    name:'เติมหมู่ที่ขาด (12 วิ)',
    sub:'เก็บ “หมู่ที่ยังขาด” ให้ครบก่อนหมดเวลา',
    cur:0,
    target:0,
    done:false,
    active:false,
    timeLeft:0,
    needMask:0,      // bitmask ของหมู่ที่ต้องเก็บ
    gotMask:0,       // bitmask ที่เก็บได้แล้ว
    t0:0,
    interval:null
  },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  spawner:null,
  shootBound:false,
  lastLockEl:null,

  missFxAt:0,
  judgeFxAt:0,

  dynSpawnRate:null,
  dynExpireMs:null,
  lastAdaptAt:0,

  base:null,
};

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function emitQuest(){
  emit('quest:update', {
    goal:{
      name:STATE.goal.name,
      sub:STATE.goal.sub,
      cur:STATE.goal.cur,
      target:STATE.goal.target
    },
    mini:{
      name:STATE.mini.name,
      sub:STATE.mini.sub,
      cur:STATE.mini.cur,
      target:STATE.mini.target,
      done:STATE.mini.done
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function coach(msg, tag='Coach'){ emit('hha:coach', { msg, tag }); }

function emitScore(){
  emit('hha:score', { score:STATE.score, combo:STATE.combo, comboMax:STATE.comboMax });
}

function addScore(v){ STATE.score += Number(v)||0; emitScore(); }
function addCombo(){ STATE.combo++; STATE.comboMax = Math.max(STATE.comboMax, STATE.combo); emitScore(); }
function resetCombo(){ STATE.combo = 0; emitScore(); }

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);
  stopMiniTimer();
  try{ STATE.spawner?.stop?.(); }catch(_){}

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

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4]
  });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });
  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ---------------- Judge + Particles + SFX ---------------- */
function judge(kind, x, y, extra={}){
  const t = nowMs();
  if(t - STATE.judgeFxAt < 35) return;
  STATE.judgeFxAt = t;

  emit('hha:judge', { kind, x, y, ...extra });

  try{
    const P = WIN.Particles;
    if(P && typeof P.popText === 'function'){
      if(kind === 'perfect') P.popText(x, y, 'PERFECT!', 'fx-perfectText');
      else if(kind === 'good') P.popText(x, y, 'GOOD!', 'fx-goodText');
      else if(kind === 'bad') P.popText(x, y, 'OOPS!', 'fx-badText');
      else if(kind === 'miss') P.popText(x, y, 'MISS', 'fx-missText');
      else if(kind === 'mini') P.popText(x, y, 'BONUS!', 'fx-goodText');
    }
    if(kind === 'perfect' && P && typeof P.celebrate === 'function') P.celebrate();
    if(kind === 'good' && P && typeof P.burst === 'function') P.burst(x, y);
    if(kind === 'mini' && P && typeof P.celebrate === 'function') P.celebrate();
  }catch(_){}
}

let __HHA_AC = null;
function tone(freq=520, ms=55, gain=0.04, type='sine'){
  try{
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return;
    __HHA_AC = __HHA_AC || new AC();
    const ctx = __HHA_AC;

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;

    o.connect(g); g.connect(ctx.destination);

    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);

    o.start(t0); o.stop(t0 + ms/1000);
  }catch(_){}
}
const sfxPerfect = ()=>tone(860, 55, 0.05, 'triangle');
const sfxGood    = ()=>tone(650, 45, 0.045,'sine');
const sfxBad     = ()=>tone(210, 65, 0.05, 'square');
const sfxMiss    = ()=>tone(460, 60, 0.045,'sine');
const sfxMini    = ()=>tone(980, 60, 0.045,'triangle');

function flashPerfect(){
  DOC.body.classList.add('fx-perfect');
  clearTimeout(WIN.__HHA_PLATE_PERF_TO__);
  WIN.__HHA_PLATE_PERF_TO__ = setTimeout(()=>{
    DOC.body.classList.remove('fx-perfect');
  }, 90);
}

function flashMiss(){
  const t = nowMs();
  if(t - STATE.missFxAt < 140) return;
  STATE.missFxAt = t;

  DOC.body.classList.add('fx-miss');
  clearTimeout(WIN.__HHA_PLATE_MISS_TO__);
  WIN.__HHA_PLATE_MISS_TO__ = setTimeout(()=>{
    DOC.body.classList.remove('fx-miss');
  }, 120);

  sfxMiss();
}

function glowLock(el){
  if(!el) return;
  if(STATE.lastLockEl && STATE.lastLockEl !== el){
    try{ STATE.lastLockEl.classList.remove('aim-lock'); }catch(_){}
  }
  STATE.lastLockEl = el;

  el.classList.add('aim-lock');
  clearTimeout(el.__aimLockTO__);
  el.__aimLockTO__ = setTimeout(()=>{
    try{ el.classList.remove('aim-lock'); }catch(_){}
  }, 120);
}

/* ---------------- Adaptive-lite (play only) ---------------- */
function canAdapt(){
  const rm = (STATE.cfg?.runMode || 'play').toLowerCase();
  return !(rm === 'research' || rm === 'study');
}
function adaptMaybe(){
  if(!canAdapt()) return;
  const t = nowMs();
  if(t - STATE.lastAdaptAt < 1200) return;
  STATE.lastAdaptAt = t;

  const acc = accuracy();
  const miss = STATE.miss;

  let k = 0;
  if(acc > 0.86 && STATE.combo >= 6) k = +1;
  if(acc < 0.72 || miss >= 6) k = -1;
  if(k === 0) return;

  const sr = STATE.dynSpawnRate ?? STATE.base.spawnRate;
  const ex = STATE.dynExpireMs  ?? STATE.base.expireMs;

  const nextSr = clamp(sr + (k>0 ? -40 : +55), STATE.base.spawnRateMin, STATE.base.spawnRateMax);
  const nextEx = clamp(ex + (k>0 ? -60 : +90), STATE.base.expireMin, STATE.base.expireMax);

  STATE.dynSpawnRate = nextSr;
  STATE.dynExpireMs  = nextEx;

  try{ STATE.spawner?.setConfig?.({ spawnRate: nextSr, expireMs: nextEx }); }catch(_){}
}

/* ---------------- PACK K: Timed mini quest ---------------- */
function stopMiniTimer(){
  clearInterval(STATE.mini.interval);
  STATE.mini.interval = null;
}
function startMiniQuest(){
  // เริ่มเมื่อยังมีหมู่ที่ขาดอย่างน้อย 2 หมู่ (จะได้สนุกกว่า)
  const miss = missingGroups();
  if(miss.length < 2) return;

  // สุ่มเลือกหมู่ที่ต้องเก็บ "2 หมู่" จากหมู่ที่ขาด
  const missingIdx = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missingIdx.push(i);

  // shuffle แบบ rng
  for(let i=missingIdx.length-1;i>0;i--){
    const j = Math.floor(STATE.rng() * (i+1));
    [missingIdx[i], missingIdx[j]] = [missingIdx[j], missingIdx[i]];
  }

  const needCount = Math.min(2, missingIdx.length);
  let needMask = 0;
  for(let k=0;k<needCount;k++){
    needMask |= (1 << missingIdx[k]);
  }

  STATE.mini.active = true;
  STATE.mini.done = false;
  STATE.mini.gotMask = 0;
  STATE.mini.needMask = needMask;
  STATE.mini.t0 = nowMs();
  STATE.mini.timeLeft = 12;
  STATE.mini.target = needCount; // ต้องเก็บ 2 หมู่
  STATE.mini.cur = 0;

  const needEm = [];
  for(let i=0;i<5;i++) if(needMask & (1<<i)) needEm.push(GROUPS[i].emoji);

  STATE.mini.sub = `เก็บ ${needEm.join(' ')} ให้ครบใน 12 วิ`;
  emitQuest();

  stopMiniTimer();
  STATE.mini.interval = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;
    if(!STATE.mini.active) return;
    STATE.mini.timeLeft--;
    if(STATE.mini.timeLeft <= 0){
      // fail softly: รีสตาร์ท mini ใหม่
      STATE.mini.active = false;
      stopMiniTimer();
      STATE.mini.sub = 'พลาดได้ ไม่เป็นไร! ลองใหม่รอบหน้า 🙂';
      emitQuest();
      return;
    }
    // อัปเดตแถบ mini เป็น countdown (cur = เก็บได้แล้ว, target = ต้องเก็บ)
    // UI bar จะยังโชว์ progress จาก cur/target; countdown เราแปะใน sub
    STATE.mini.sub = STATE.mini.sub.replace(/• เหลือ \d+ วิ$/, '');
    STATE.mini.sub = `${STATE.mini.sub} • เหลือ ${STATE.mini.timeLeft} วิ`;
    emitQuest();
  }, 1000);
}

function miniMarkGot(groupIndex){
  if(!STATE.mini.active || STATE.mini.done) return;
  const bit = (1 << groupIndex);
  if(!(STATE.mini.needMask & bit)) return; // ไม่ใช่หมู่เป้าหมาย
  if(STATE.mini.gotMask & bit) return;     // ได้แล้ว

  STATE.mini.gotMask |= bit;

  // cur = จำนวนหมู่ที่ได้แล้วใน mini
  let c = 0;
  for(let i=0;i<5;i++){
    if((STATE.mini.needMask & (1<<i)) && (STATE.mini.gotMask & (1<<i))) c++;
  }
  STATE.mini.cur = c;

  // สำเร็จ
  if(STATE.mini.cur >= STATE.mini.target){
    STATE.mini.done = true;
    STATE.mini.active = false;
    stopMiniTimer();

    addScore(220);
    sfxMini();
    coach('บิงโก! เติมหมู่ที่ขาดครบในเวลาที่กำหนด 🏁', 'Mini');
    judge('mini', innerWidth*0.5, innerHeight*0.34, { bonus:220 });

    STATE.mini.sub = 'สำเร็จ! โบนัส +220 ✅';
    emitQuest();

    // เปิด mini รอบใหม่ภายหลังนิดนึง (ถ้ายังมีหมู่ขาด)
    setTimeout(()=>{ if(!STATE.ended) startMiniQuest(); }, 900);
  }else{
    emitQuest();
  }
}

/* ---------------- Hit handlers ---------------- */
function onHitGood(groupIndex, hitMeta={}, tEl=null){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  if(hitMeta.perfect){
    addCombo();
    addScore(140 + STATE.combo * 7);
    sfxPerfect();
    flashPerfect();
  }else{
    addCombo();
    addScore(100 + STATE.combo * 5);
    sfxGood();
  }

  // PACK K: goal sub บอกหมู่ที่ยังขาด
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    STATE.goal.sub = missingText();
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      STATE.goal.sub = 'ครบแล้วทุกหมู่ ✅';
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // PACK K: mini quest progress (ถ้า hit ตรงหมู่ที่ต้องการ)
  miniMarkGot(groupIndex);

  emitQuest();
  adaptMaybe();

  // ใส่สีพื้น target นิดให้เห็นหมู่ (optional)
  try{
    if(tEl){
      const g = GROUPS[groupIndex];
      tEl.style.setProperty('--gTint', g.color);
    }
  }catch(_){}
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  sfxBad();
  adaptMaybe();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  adaptMaybe();
}

/* ---------------- Shoot (perfect window) ---------------- */
function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

function pickTargetNearPoint(px, py, lockPx){
  const layer = DOC.getElementById('plate-layer');
  if(!layer) return null;
  const els = layer.querySelectorAll('.plateTarget');
  if(!els || !els.length) return null;

  const rLock = (Number(lockPx)||28);
  const lock2 = rLock * rLock;

  let bestEl = null;
  let bestD2 = Infinity;

  for(const el of els){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const d2 = dist2(px, py, cx, cy);
    if(d2 < bestD2){
      bestD2 = d2;
      bestEl = el;
    }
  }
  if(bestEl && bestD2 <= lock2){
    return { el: bestEl, bestD2 };
  }
  return null;
}

function bindShootOnce(){
  if(STATE.shootBound) return;
  STATE.shootBound = true;

  WIN.addEventListener('hha:shoot', (e)=>{
    if(!STATE.running || STATE.ended) return;

    const d = e.detail || {};
    const lockPx = Number(d.lockPx ?? 28) || 28;

    let aimX = Number(d.x);
    let aimY = Number(d.y);

    if(STATE.cfg?.view === 'cvr' || DOC.body.classList.contains('view-cvr')){
      aimX = innerWidth * 0.5;
      aimY = innerHeight * 0.5;
    }else{
      if(!isFinite(aimX)) aimX = innerWidth * 0.5;
      if(!isFinite(aimY)) aimY = innerHeight * 0.5;
    }

    const pick = pickTargetNearPoint(aimX, aimY, lockPx);
    if(pick){
      const { el, bestD2 } = pick;
      glowLock(el);

      const perfectR = Math.max(6, lockPx * 0.45);
      const perfect = bestD2 <= (perfectR * perfectR);

      el.__hitMeta__ = { perfect, aimX, aimY, lockPx };
      try{ el.click(); }catch(_){}

      judge(perfect ? 'perfect' : 'good', aimX, aimY, { perfect });
    }else{
      flashMiss();
      judge('miss', aimX, aimY);
    }
  }, { passive:true });
}

/* ---------------- Difficulty tuning ---------------- */
function diffProfile(diff='normal'){
  diff = (diff||'normal').toLowerCase();
  if(diff === 'easy'){
    return { spawnRate: 980, expireMs: 2050, sizeRange:[52,72], goodW: 0.78, junkW: 0.22 };
  }
  if(diff === 'hard'){
    return { spawnRate: 650, expireMs: 1550, sizeRange:[40,60], goodW: 0.68, junkW: 0.32 };
  }
  return { spawnRate: 830, expireMs: 1750, sizeRange:[46,66], goodW: 0.72, junkW: 0.28 };
}

/* ---------------- Spawner ---------------- */
function makeSpawner(mount){
  const p = diffProfile(STATE.cfg.diff);

  STATE.base = {
    spawnRate: p.spawnRate,
    expireMs: p.expireMs,
    spawnRateMin: 560,
    spawnRateMax: 1100,
    expireMin: 1450,
    expireMax: 2300
  };
  STATE.dynSpawnRate = p.spawnRate;
  STATE.dynExpireMs  = p.expireMs;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    spawnRate: p.spawnRate,
    expireMs:  p.expireMs,

    targetClass: 'plateTarget',
    sizeRange: p.sizeRange,

    kinds:[
      { kind:'good', weight:p.goodW },
      { kind:'junk', weight:p.junkW }
    ],

    safeSelectors: ['#hud', '#endOverlay', '.hha-vr-ui', '.vr-ui', '#vrui'],

    assignGroupIndex: ({ kind, rng })=>{
      if(kind !== 'good') return null;
      const rr = (typeof rng === 'function') ? rng() : Math.random();
      return Math.floor(rr * 5);
    },

    decorateTarget: ({ el, kind, groupIndex })=>{
      if(!el) return;
      if(kind === 'good'){
        const g = GROUPS[groupIndex] || GROUPS[0];
        el.textContent = `${g.emoji}${g.id}`;
        el.style.setProperty('--gTint', g.color);
        el.setAttribute('data-group', String(groupIndex+1));
      }else{
        el.textContent = '🍩';
      }
    },

    onHit:(t)=>{
      const hitMeta = t.el?.__hitMeta__ || {};
      if(t.kind === 'good'){
        const gi = clamp((t.groupIndex ?? 0), 0, 4);
        onHitGood(gi, hitMeta, t.el);
      }else{
        onHitJunk();
        try{
          const r = t.el?.getBoundingClientRect?.();
          if(r) judge('bad', r.left + r.width/2, r.top + r.height/2);
        }catch(_){}
      }
      try{ if(t.el) t.el.__hitMeta__ = null; }catch(_){}
    },

    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ---------------- Main boot ---------------- */
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

  // goal
  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.goal.sub = missingText();

  // mini
  stopMiniTimer();
  STATE.mini.done = false;
  STATE.mini.active = false;
  STATE.mini.cur = 0;
  STATE.mini.target = 0;
  STATE.mini.sub = 'เก็บ “หมู่ที่ยังขาด” ให้ครบก่อนหมดเวลา';

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng((Number(cfg.seed) || Date.now()) >>> 0);
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  bindShootOnce();

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! ดูหมู่ที่ยังขาด แล้วเติมให้ครบ 🍽️');

  // start mini shortly (ถ้าเหมาะ)
  setTimeout(()=>{ if(!STATE.ended) startMiniQuest(); }, 900);
}