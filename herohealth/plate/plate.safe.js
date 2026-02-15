// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+) — v5.2
// HHA Standard + Storm + Boss + AI prediction hooks + flush-hardened
//
// ✅ Play: adaptive ON (heuristic) + AI tips
// ✅ Study/Research: deterministic seed + adaptive OFF
// ✅ Fix: spawn bias toward missing groups early game (ทั้ง spawned + collected)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Storm + Boss have REAL spawn impact (reboot spawner with different weights/rates)
// ✅ End summary direct on hha:end (matches cloud logger expectation)
// ✅ Storage: HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ Flush-hardened: uses ROOT.HHA_LOGGER.flush(reason) if exists
//
// Depends:
//   ../vr/mode-factory.js
//   ../vr/food5-th.js

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

const ROOT = window;

// ---------------- Utilities ----------------
const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function gradeFrom(score, accPct){
  // เกรดใช้ทั้งคะแนน + ความแม่น (กันฟลุ๊ค)
  score = Number(score)||0;
  accPct = Number(accPct)||0;

  if(score >= 2200 && accPct >= 88) return 'S';
  if(score >= 1700 && accPct >= 82) return 'A';
  if(score >= 1200 && accPct >= 75) return 'B';
  if(score >= 700  && accPct >= 68) return 'C';
  return 'D';
}

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}

function qs(id){ return document.getElementById(id); }
function setText(id, v){ const el=qs(id); if(el) el.textContent = String(v); }

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

function loadJson(key, fallback){
  try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }
  catch{ return fallback; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
}

async function flushHardened(reason){
  try{
    const L = ROOT.HHA_LOGGER || ROOT.HHACloudLogger || ROOT.HHA_CloudLogger || null;
    if(L && typeof L.flush === 'function'){
      await Promise.race([ Promise.resolve(L.flush(reason||'manual')), new Promise(res=>setTimeout(res, 650)) ]);
    }else if(L && typeof L.flushNow === 'function'){
      await Promise.race([ Promise.resolve(L.flushNow({reason})), new Promise(res=>setTimeout(res, 650)) ]);
    }
  }catch{}
}

// ---------------- State ----------------
const STATE = {
  running:false,
  ended:false,
  paused:false,

  // score
  score:0,
  combo:0,
  comboMax:0,

  // HHA canonical miss = good expired + junk hit
  miss:0,

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,
  shotMiss:0, // optional stream from mode-factory (if it emits judge shot_miss)

  // groups counts index 0..4 => groupId 1..5
  g:[0,0,0,0,0],
  spawnSeen:[false,false,false,false,false], // spawned at least once (fix “ไม่ออกครบ 5 หมู่”)
  collectedSeen:[false,false,false,false,false],

  // cfg
  cfg:null,
  rng:Math.random,

  // engine
  engine:null,
  mountEl:null,

  // timer
  timeLeft:0,
  timePlannedSec:0,
  tStartIso:'',

  // quests (goal + mini)
  goal:{ title:'เติมจานให้ครบ 5 หมู่', cur:0, target:5, done:false },
  mini:{ title:'ความแม่นยำ', cur:0, target:80, done:false },
  miniTotal: 1,
  miniCleared: 0,

  // Storm mini
  storm:{
    active:false,
    startedAt:0,
    durationSec:7,
    needGood:9,
    hitGood:0,
    forbidJunk:false,
    cycleIndex:0,
    cyclesPlanned:0,
    lastRebootAt:0
  },

  // Boss mini
  boss:{
    active:false,
    startedAt:0,
    durationSec:10,
    needGood:8,
    hitGood:0,
    forbidJunk:true,
    done:false,
    lastRebootAt:0,
    triggered:false
  },

  // AI
  AI:{
    enabled:true,
    lastTipAt:0,
    tipCooldownMs:6500,
  }
};

// ---------------- Accuracy / Quest ----------------
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}
function updateMiniFromAccuracy(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = clamp(Math.round(accPct), 0, 100);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'happy');
  }
}
function recomputeGoal(){
  const distinct = STATE.g.filter(v=>v>0).length;
  STATE.goal.cur = distinct;
  if(!STATE.goal.done && distinct >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'happy');
  }
}

function emitQuest(){
  const goalDone = STATE.goal.done;
  const miniDone = STATE.mini.done;

  emit('quest:update', {
    game:'plate',
    goal:{ title: STATE.goal.title, cur: STATE.goal.cur, target: STATE.goal.target, done: goalDone },
    mini:{ title: currentMiniTitle(), cur: currentMiniCur(), target: currentMiniTarget(), done: currentMiniDone() },
    allDone: goalDone && miniDone
  });

  // UI text
  setText('uiGoalTitle', STATE.goal.title);
  setText('uiGoalCount', `${STATE.goal.cur}/${STATE.goal.target}`);
  const gf = qs('uiGoalFill'); if(gf) gf.style.width = `${STATE.goal.target ? (STATE.goal.cur/STATE.goal.target*100) : 0}%`;

  setText('uiMiniTitle', currentMiniTitle());
  setText('uiMiniTime', currentMiniTimeText());
  setText('uiMiniCount', `${STATE.miniCleared}/${STATE.miniTotal}`);
  const mf = qs('uiMiniFill'); if(mf) mf.style.width = `${currentMiniFillPct()}%`;
}

// ---------------- Coach / AI signals ----------------
function coach(msg, mood='neutral'){
  emit('hha:coach', { game:'plate', msg, mood });
}
function aiEmit(type, data){
  emit('hha:ai', { game:'plate', type, ...(data||{}) });
}
function maybeTip(key, msg, mood){
  if(!STATE.AI.enabled) return;
  const t = now();
  if(t - STATE.AI.lastTipAt < STATE.AI.tipCooldownMs) return;
  STATE.AI.lastTipAt = t;
  coach(msg, mood||'neutral');
  aiEmit('coach-tip', { key, msg, mood:mood||'neutral' });
}

// ---------------- HUD ----------------
function updateHUD(){
  const accPct = accuracy()*100;
  const grade = gradeFrom(STATE.score, accPct);

  emit('hha:score', {
    game:'plate',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    timeLeftSec: STATE.timeLeft,
    score: STATE.score|0,
    combo: STATE.combo|0,
    comboMax: STATE.comboMax|0,
    miss: STATE.miss|0,
    accuracyPct: Math.round(accPct*10)/10,
    grade,
    gCount: [...STATE.g]
  });

  setText('uiScore', STATE.score|0);
  setText('uiCombo', STATE.combo|0);
  setText('uiComboMax', STATE.comboMax|0);
  setText('uiMiss', STATE.miss|0);
  setText('uiPlateHave', STATE.g.filter(v=>v>0).length);
  setText('uiAcc', `${Math.round(accPct)}%`);
  setText('uiGrade', grade);
  setText('uiTime', STATE.timeLeft|0);

  setText('uiG1', STATE.g[0]);
  setText('uiG2', STATE.g[1]);
  setText('uiG3', STATE.g[2]);
  setText('uiG4', STATE.g[3]);
  setText('uiG5', STATE.g[4]);
}

// ---------------- Crosshair shoot -> nearest target ----------------
function bindShootOnce(){
  if(ROOT.__PLATE_SHOOT_BOUND__) return;
  ROOT.__PLATE_SHOOT_BOUND__ = true;

  ROOT.addEventListener('hha:shoot', (ev)=>{
    // mode-factory ปกติจะจับยิงเองใน mount; แต่สำหรับ cVR เราช่วย “คลิกเป้าที่ใกล้สุด”
    // ถ้า mode-factory ของคุณ already handles it, อันนี้ไม่พัง (จะ fail silently ถ้าไม่มี .plateTarget)
    if(!STATE.running || STATE.paused || STATE.ended) return;

    const d = ev?.detail || {};
    const x = Number(d.x) || (innerWidth/2);
    const y = Number(d.y) || (innerHeight/2);
    const lockPx = Math.max(8, Number(d.lockPx||28)||28);

    const els = document.querySelectorAll('#plate-layer .plateTarget');
    let best = null, bestD2 = Infinity;

    for(const el of els){
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = x - cx, dy = y - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD2){ bestD2 = d2; best = el; }
    }

    if(best && bestD2 <= lockPx*lockPx){
      try{ best.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true })); }catch{}
      try{ best.click(); }catch{}
    }
  }, { passive:true });
}

// ---------------- Miss-shot stream (optional) ----------------
function wireShotMiss(){
  if(STATE.__shotMissWired) return;
  STATE.__shotMissWired = true;

  ROOT.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    if(String(d.kind||'').toLowerCase() === 'shot_miss'){
      STATE.shotMiss++;
      // ตามมาตรฐานของคุณ: miss = expireGood + hitJunk (ไม่รวม shotMiss)
    }
  }, { passive:true });
}

// ---------------- Spawn Director (Fix “ไม่ออกครบ 5 หมู่”) ----------------
function pickGroupIndexForGood(t){
  const rng = (t && typeof t.rng === 'function') ? t.rng : STATE.rng;

  // A) ensure every group spawned at least once early
  const missingSpawn = [];
  for(let i=0;i<5;i++) if(!STATE.spawnSeen[i]) missingSpawn.push(i);
  if(missingSpawn.length && rng() < 0.88){
    return missingSpawn[Math.floor(rng()*missingSpawn.length)];
  }

  // B) bias toward missing collected groups until complete
  const missingCollect = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missingCollect.push(i);
  if(missingCollect.length && rng() < 0.78){
    return missingCollect[Math.floor(rng()*missingCollect.length)];
  }

  // C) play mode adaptive: feed weaker groups
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const adaptiveOn = (runMode === 'play');
  if(adaptiveOn){
    const counts = STATE.g.map((c,i)=>({i,c})).sort((a,b)=>a.c-b.c);
    const pool = counts.slice(0,2).map(x=>x.i);
    if(rng() < 0.70) return pool[Math.floor(rng()*pool.length)];
  }

  return Math.floor(rng()*5);
}

function decorateTarget(el, t){
  el.classList.add('plateTarget');

  if(t.kind === 'good'){
    const gi = pickGroupIndexForGood(t); // 0..4
    t.groupIndex = gi;
    STATE.spawnSeen[gi] = true;

    const groupId = gi + 1;
    const emoji = emojiForGroup(t.rng, groupId);

    el.dataset.kind = 'good';
    el.dataset.group = String(groupId);
    el.textContent = emoji;

    try{ el.setAttribute('aria-label', labelForGroup(groupId)); }catch{}
  }else{
    const emoji = pickEmoji(t.rng, JUNK.emojis);
    el.dataset.kind = 'junk';
    el.dataset.group = 'junk';
    el.textContent = emoji;

    try{ el.setAttribute('aria-label', JUNK.labelTH); }catch{}
  }
}

// ---------------- Storm + Boss UI helpers ----------------
function stormTimeLeft(){
  if(!STATE.storm.active) return 0;
  const el = (now() - STATE.storm.startedAt)/1000;
  return Math.max(0, STATE.storm.durationSec - el);
}
function bossTimeLeft(){
  if(!STATE.boss.active) return 0;
  const el = (now() - STATE.boss.startedAt)/1000;
  return Math.max(0, STATE.boss.durationSec - el);
}

function updateStormHud(){
  const hud = qs('stormHud');
  const title = qs('stormTitle');
  const hint  = qs('stormHint');
  const prog  = qs('stormProg');
  const fx    = qs('stormFx');

  if(!hud) return;

  if(STATE.storm.active){
    hud.style.display = 'block';
    if(fx){ fx.classList.add('storm-on'); fx.style.display='block'; }
    if(title) title.textContent = `🌪️ STORM ${STATE.storm.cycleIndex+1}/${STATE.storm.cyclesPlanned}`;
    const tl = stormTimeLeft();
    if(hint){
      const a = STATE.storm.forbidJunk ? ' (ห้ามโดนขยะ!)' : '';
      hint.textContent = `เก็บ GOOD ${STATE.storm.needGood} ชิ้นใน ${STATE.storm.durationSec}s${a}`;
    }
    if(prog) prog.textContent = `${Math.ceil(tl)}s • GOOD ${STATE.storm.hitGood}/${STATE.storm.needGood}`;
    if(fx){
      if(tl <= 2.5) fx.classList.add('storm-panic'); else fx.classList.remove('storm-panic');
    }
  }else{
    hud.style.display = 'none';
    if(fx){ fx.classList.remove('storm-on','storm-panic'); fx.style.display='none'; }
  }
}

function updateBossHud(){
  const hud = qs('bossHud');
  const title = qs('bossTitle');
  const hint  = qs('bossHint');
  const prog  = qs('bossProg');
  const fx    = qs('bossFx');

  if(!hud) return;

  if(STATE.boss.active){
    hud.style.display = 'block';
    if(fx){ fx.classList.add('boss-on'); fx.style.display='block'; }
    if(title) title.textContent = '👹 BOSS';
    const tl = bossTimeLeft();
    if(hint){
      hint.textContent = STATE.boss.forbidJunk
        ? `เก็บ GOOD ${STATE.boss.needGood} ชิ้นใน ${STATE.boss.durationSec}s (ห้ามโดนขยะ!)`
        : `เก็บ GOOD ${STATE.boss.needGood} ชิ้นใน ${STATE.boss.durationSec}s`;
    }
    if(prog) prog.textContent = `${Math.ceil(tl)}s • GOOD ${STATE.boss.hitGood}/${STATE.boss.needGood}`;
    if(fx){
      if(tl <= 3) fx.classList.add('boss-panic'); else fx.classList.remove('boss-panic');
    }
  }else{
    hud.style.display = 'none';
    if(fx){ fx.classList.remove('boss-on','boss-panic'); fx.style.display='none'; }
  }
}

// ---------------- Mini model: Storm counts as mini + Boss counts as mini ----------------
function computeMinisPlanned(){
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const isStudy = (runMode === 'study' || runMode === 'research');

  STATE.storm.cyclesPlanned = isStudy ? 2 : 3;
  const bossCount = isStudy ? 0 : 1;

  STATE.miniTotal = STATE.storm.cyclesPlanned + bossCount; // storm cycles + boss
}

function currentMiniTitle(){
  if(STATE.boss.active) return `BOSS (GOOD ${STATE.boss.hitGood}/${STATE.boss.needGood})`;
  if(STATE.storm.active) return `STORM ${STATE.storm.cycleIndex+1}/${STATE.storm.cyclesPlanned}`;
  return STATE.mini.title; // accuracy
}
function currentMiniCur(){
  if(STATE.boss.active) return STATE.boss.hitGood;
  if(STATE.storm.active) return STATE.storm.hitGood;
  return STATE.mini.cur;
}
function currentMiniTarget(){
  if(STATE.boss.active) return STATE.boss.needGood;
  if(STATE.storm.active) return STATE.storm.needGood;
  return STATE.mini.target;
}
function currentMiniDone(){
  if(STATE.boss.active) return false;
  if(STATE.storm.active) return false;
  return STATE.mini.done;
}
function currentMiniTimeText(){
  if(STATE.boss.active) return `${Math.ceil(bossTimeLeft())}s`;
  if(STATE.storm.active) return `${Math.ceil(stormTimeLeft())}s`;
  return '--';
}
function currentMiniFillPct(){
  if(STATE.boss.active) return clamp(STATE.boss.needGood ? (STATE.boss.hitGood/STATE.boss.needGood*100) : 0, 0, 100);
  if(STATE.storm.active) return clamp(STATE.storm.needGood ? (STATE.storm.hitGood/STATE.storm.needGood*100) : 0, 0, 100);
  return clamp(STATE.mini.target ? (STATE.mini.cur/STATE.mini.target*100) : 0, 0, 100);
}

// ---------------- Spawner make + reboot for storm/boss ----------------
function stopSpawner(){
  if(STATE.engine && typeof STATE.engine.stop === 'function'){
    try{ STATE.engine.stop(); }catch{}
  }
  STATE.engine = null;
}

function restartSpawner(){
  const t = now();
  const last = Math.max(STATE.storm.lastRebootAt||0, STATE.boss.lastRebootAt||0);
  if(t - last < 250) return;

  STATE.storm.lastRebootAt = t;
  STATE.boss.lastRebootAt = t;

  stopSpawner();
  if(!STATE.mountEl) return;
  STATE.engine = makeSpawner(STATE.mountEl);
}

function makeSpawner(mount){
  const diff = String(STATE.cfg?.diff || 'normal').toLowerCase();
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const isStudy = (runMode === 'study' || runMode === 'research');
  const adaptiveOn = (runMode === 'play');

  // base spawnRate
  let spawnRate = 900;
  if(diff === 'hard') spawnRate = 720;
  else if(diff === 'easy') spawnRate = 1020;

  // adaptive (play only)
  if(adaptiveOn){
    const acc = accuracy();
    const cmb = STATE.comboMax;
    if(acc > 0.88 && cmb >= 10) spawnRate = Math.max(620, spawnRate - 120);
    if(acc < 0.70) spawnRate = Math.min(1100, spawnRate + 120);
  }

  // STORM/BOSS REAL impact
  const stormOn = !!STATE.storm.active;
  const bossOn  = !!STATE.boss.active;

  if(stormOn) spawnRate = Math.max(520, Math.floor(spawnRate * 0.70));
  if(bossOn)  spawnRate = Math.max(480, Math.floor(spawnRate * 0.62));

  let wGood = 0.72;
  if(stormOn) wGood = 0.64; // storm = junk มากขึ้นนิด
  if(bossOn)  wGood = 0.76; // boss = good มากขึ้นเพื่อ “ชนะได้จริง”
  const wJunk = 1 - wGood;

  const sizeRange =
    bossOn  ? [40,58] :
    stormOn ? [40,60] :
              (diff === 'hard' ? [40,60] : [44,64]);

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange,
    kinds:[
      { kind:'good', weight:wGood },
      { kind:'junk', weight:wJunk }
    ],
    decorateTarget,

    onHit:(hit)=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;

      if(hit.kind === 'good'){
        onHitGood(hit.groupIndex ?? 0);
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      if(t.kind === 'good'){
        onExpireGood(t.groupIndex ?? 0);
      }
    },

    // ถ้า mode-factory ยิงพลาดเองได้ จะ emit judge kind=shot_miss (optional)
  });
}

// ---------------- Hit handlers ----------------
function addScore(v){
  STATE.score += (Number(v)||0);
}
function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){ STATE.combo = 0; }

function onHitGood(groupIndex){
  STATE.hitGood++;

  const gi = clamp(groupIndex,0,4);
  STATE.g[gi]++;
  STATE.collectedSeen[gi] = true;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // boss progress
  if(STATE.boss.active && !STATE.boss.done){
    STATE.boss.hitGood++;
    updateBossHud();
    if(STATE.boss.hitGood >= STATE.boss.needGood){
      finishBoss(true, 'need_met');
      return;
    }
  }

  // storm progress
  if(STATE.storm.active){
    STATE.storm.hitGood++;
    updateStormHud();
    if(STATE.storm.hitGood >= STATE.storm.needGood){
      finishStorm(true, 'need_met');
      return;
    }
  }

  recomputeGoal();
  updateMiniFromAccuracy();
  emit('hha:judge', { kind:'good', groupId: gi+1, score: STATE.score|0, combo: STATE.combo|0 });

  // AI micro tips
  const accPct = accuracy()*100;
  if(accPct >= 92 && STATE.combo >= 10) maybeTip('combo', 'คอมโบกำลังสวย! รักษาจังหวะนี้ไว้ 🚀', 'happy');
  else if(accPct < 75 && STATE.miss >= 4) maybeTip('stabilize', 'ลองช้าลงนิดนึง จิ้มให้ชัวร์ก่อน คอมโบจะกลับมาเอง 💪', 'neutral');

  updateHUD();
  emitQuest();
}

function onHitJunk(){
  // boss forbid junk => fail instantly (เร้าใจ!)
  if(STATE.boss.active && STATE.boss.forbidJunk){
    STATE.hitJunk++;
    STATE.miss++;
    resetCombo();
    addScore(-80);
    emit('hha:judge', { kind:'junk', score: STATE.score|0, combo: STATE.combo|0 });
    coach('❌ โดนขยะตอนบอส! แพ้บอสทันที!', 'sad');
    finishBoss(false, 'hit_junk');
    return;
  }

  // storm forbid junk => fail storm
  if(STATE.storm.active && STATE.storm.forbidJunk){
    STATE.hitJunk++;
    STATE.miss++;
    resetCombo();
    addScore(-70);
    emit('hha:judge', { kind:'junk', score: STATE.score|0, combo: STATE.combo|0 });
    coach('❌ STORM ห้ามโดนขยะ! พลาดแล้ว!', 'sad');
    finishStorm(false, 'hit_junk');
    return;
  }

  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  emit('hha:judge', { kind:'junk', score: STATE.score|0, combo: STATE.combo|0 });
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'neutral');

  updateMiniFromAccuracy();
  updateHUD();
  emitQuest();
}

function onExpireGood(groupIndex){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  const gi = clamp(groupIndex,0,4);
  emit('hha:judge', { kind:'expire_good', groupId: gi+1, score: STATE.score|0, combo: STATE.combo|0 });

  // AI tip for expire pattern
  if(STATE.expireGood >= 3) maybeTip('expire', 'ของดีหมดอายุบ่อย—ลอง “โฟกัสเป้าใกล้หมดเวลา” ก่อนนะ 👀', 'neutral');

  updateMiniFromAccuracy();
  updateHUD();
  emitQuest();
}

// ---------------- Storm / Boss control ----------------
function startStorm(){
  if(STATE.storm.active) return;
  STATE.storm.active = true;
  STATE.storm.startedAt = now();
  STATE.storm.hitGood = 0;

  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  const isStudy = (runMode === 'study' || runMode === 'research');

  const accPct = accuracy()*100;
  STATE.storm.durationSec = isStudy ? 6 : 7;
  STATE.storm.needGood = clamp(Math.round(8 + accPct/25), 8, 12);
  STATE.storm.forbidJunk = !isStudy && (accPct >= 82); // เล่นเก่ง = ห้ามโดนขยะ (ท้าทาย)

  coach('🌪️ พายุมาแล้ว! เก็บ GOOD ให้ทัน!', (STATE.storm.forbidJunk?'fever':'neutral'));
  aiEmit('pattern', { mode:'storm', cycle: STATE.storm.cycleIndex+1, seed: STATE.cfg?.seed, plan:{ needGood:STATE.storm.needGood, duration:STATE.storm.durationSec, forbidJunk:STATE.storm.forbidJunk } });

  updateStormHud();
  restartSpawner(); // ✅ real impact
  emitQuest();
}

function finishStorm(ok, reason){
  if(!STATE.storm.active) return;
  STATE.storm.active = false;

  if(ok){
    STATE.miniCleared++;
    addScore(160);
    coach('ผ่านพายุแล้ว! +160 คะแนน 🔥', 'happy');
    emit('hha:judge', { kind:'storm_clear', reason });
  }else{
    coach('พายุแรงไปนิด! เดี๋ยวเอาใหม่ 💪', 'sad');
    emit('hha:judge', { kind:'storm_fail', reason });
  }

  updateStormHud();
  STATE.storm.cycleIndex++;
  restartSpawner(); // back to normal
  updateHUD();
  emitQuest();
}

function startBoss(){
  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  const isStudy = (runMode === 'study' || runMode === 'research');
  if(isStudy) return; // study/research ปิดบอส
  if(STATE.boss.active || STATE.boss.done) return;

  STATE.boss.active = true;
  STATE.boss.startedAt = now();
  STATE.boss.hitGood = 0;
  STATE.boss.triggered = true;

  const accPct = accuracy()*100;
  STATE.boss.needGood = clamp(Math.round(7 + accPct/25), 7, 11);
  STATE.boss.durationSec = 10;
  STATE.boss.forbidJunk = true;

  coach('👹 บอสมาแล้ว! โฟกัสเก็บ GOOD ให้ครบก่อนหมดเวลา!', 'neutral');
  aiEmit('pattern', { mode:'boss', seed: STATE.cfg?.seed, plan:{ needGood:STATE.boss.needGood, duration:STATE.boss.durationSec, forbidJunk:true } });

  updateBossHud();
  restartSpawner(); // ✅ real impact
  emitQuest();
}

function finishBoss(ok, reason){
  if(!STATE.boss.active) return;
  STATE.boss.active = false;
  STATE.boss.done = true;

  if(ok){
    STATE.miniCleared++;
    addScore(220);
    coach('ชนะบอส! +220 คะแนน 🔥', 'happy');
    emit('hha:judge', { kind:'boss_win', reason });
  }else{
    coach('บอสโหด! รอบหน้าเอาใหม่ 💪', 'sad');
    emit('hha:judge', { kind:'boss_lose', reason });
  }

  updateBossHud();
  restartSpawner();
  updateHUD();
  emitQuest();
}

// ---------------- Timer / loop (scheduler) ----------------
let _tickTimer = null;

function setPaused(p){
  STATE.paused = !!p;
  const hudPaused = qs('hudPaused');
  if(hudPaused) hudPaused.style.display = STATE.paused ? 'grid' : 'none';
}

function startLoop(){
  if(_tickTimer) clearInterval(_tickTimer);

  _tickTimer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    // pause: don't decrement time
    if(STATE.paused) return;

    STATE.timeLeft--;
    emit('hha:time', { game:'plate', timeLeftSec: STATE.timeLeft });

    // scheduler: STORM at marks
    const played = (STATE.timePlannedSec - STATE.timeLeft);
    const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
    const isStudy = (runMode === 'study' || runMode === 'research');
    const marks = isStudy ? [18, 42] : [20, 45, 70];

    if(!STATE.storm.active && STATE.storm.cycleIndex < marks.length && played >= marks[STATE.storm.cycleIndex]){
      startStorm();
    }

    if(STATE.storm.active){
      updateStormHud();
      if(stormTimeLeft() <= 0){
        finishStorm(false, 'timeout');
      }
    }

    // scheduler: BOSS near end
    if(!STATE.boss.triggered && !STATE.boss.done && !STATE.boss.active){
      const startAt = Math.max(20, Math.floor(STATE.timePlannedSec * 0.55));
      const mustHaveTimeLeft = Math.min(35, Math.floor(STATE.timePlannedSec * 0.45));
      if(played >= startAt && STATE.timeLeft <= mustHaveTimeLeft){
        startBoss();
      }
    }

    if(STATE.boss.active){
      updateBossHud();
      if(bossTimeLeft() <= 0){
        finishBoss(false, 'timeout');
      }
    }

    // AI difficulty signals (prediction hooks for ML/DL)
    if(String(STATE.cfg?.runMode||'play').toLowerCase() === 'play'){
      const accPct = Math.round(accuracy()*1000)/10;
      aiEmit('difficulty-signal', {
        accPct, miss: STATE.miss|0,
        storm: STATE.storm.active,
        boss: STATE.boss.active,
        g: [...STATE.g]
      });

      // simple explainable tips
      if(STATE.miss >= 6 && accPct < 75) maybeTip('miss-high', 'พลาดเยอะ—เลือกเก็บ “ของดี” ก่อน แล้วค่อยเลี่ยงขยะนะ 💡', 'neutral');
    }

    updateHUD();
    emitQuest();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

// ---------------- End summary + storage ----------------
function endGame(reason='end'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(_tickTimer); }catch{}
  _tickTimer = null;

  stopSpawner();

  const accPct = Math.round(accuracy()*1000)/10;
  const grade = gradeFrom(STATE.score, accPct);

  // minis: storm cycles cleared + boss cleared are counted via miniCleared
  // plus “accuracy mini” (optional) → ถ้าต้องการให้นับด้วย ก็เปิดได้
  // ตอนนี้ใช้: miniCleared/miniTotal (storm+boss) ตามเกมเร้าใจ

  const endTimeIso = new Date().toISOString();

  const summary = {
    timestampIso: endTimeIso,
    projectTag: 'HHA',
    sessionId: `PLATE_${Date.now()}_${Math.random().toString(16).slice(2,8)}`,
    game: 'plate',
    gameMode: 'plate',
    runMode: (STATE.cfg?.runMode || 'play'),
    diff: (STATE.cfg?.diff || 'normal'),
    seed: (STATE.cfg?.seed || 0),

    timePlannedSec: Number(STATE.timePlannedSec || 0) || 0,
    durationPlannedSec: Number(STATE.timePlannedSec || 0) || 0, // legacy
    durationPlayedSec: Number(STATE.timePlannedSec || 0) || 0,   // simple

    scoreFinal: STATE.score|0,
    comboMax: STATE.comboMax|0,

    // canonical miss
    miss: STATE.miss|0,
    misses: STATE.miss|0, // legacy
    missJunk: STATE.hitJunk|0,
    missExpire: STATE.expireGood|0,
    shotMiss: STATE.shotMiss|0,

    accuracyPct: accPct,
    accuracyGoodPct: accPct, // legacy
    grade,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,

    miniCleared: STATE.miniCleared|0,
    miniTotal: STATE.miniTotal|0,

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],

    storm: {
      enabled: true,
      cyclesPlanned: STATE.storm.cyclesPlanned|0,
      cyclesDone: STATE.storm.cycleIndex|0
    },
    boss: {
      enabled: String(STATE.cfg?.runMode||'play').toLowerCase()==='play',
      needGood: STATE.boss.needGood|0,
      durationSec: STATE.boss.durationSec|0
    },

    reason
  };

  // store summaries
  saveJson(LS_LAST, summary);
  const hist = loadJson(LS_HIST, []);
  const next = Array.isArray(hist) ? hist : [];
  next.unshift(summary);
  while(next.length > 50) next.pop();
  saveJson(LS_HIST, next);

  // emit end summary direct
  emit('hha:end', summary);

  coach('จบเกมแล้ว! ดูสรุปผลได้เลย 🏁', (grade==='D'?'sad':'happy'));

  // flush-hardened
  flushHardened(reason);
}

// ---------------- Boot + wiring UI buttons ----------------
function parseCfgFromUrl(){
  const U = new URL(location.href);
  const runRaw = (U.searchParams.get('run') || U.searchParams.get('runMode') || 'play').toLowerCase();
  const diff   = (U.searchParams.get('diff') || 'normal').toLowerCase();
  const view   = (U.searchParams.get('view') || 'mobile').toLowerCase();
  const time   = clamp(U.searchParams.get('time') || 90, 20, 9999);
  const seedP  = U.searchParams.get('seed');

  const isStudy = (runRaw === 'study' || runRaw === 'research');
  const seed = isStudy ? (Number(seedP)||13579) : (seedP!=null ? (Number(seedP)||13579) : ((Date.now() ^ (Math.random()*1e9))|0));

  return {
    runMode: isStudy ? runRaw : 'play',
    diff: ['easy','normal','hard'].includes(diff)?diff:'normal',
    view,
    seed,
    durationPlannedSec: time
  };
}

function wireButtons(){
  const btnStart = qs('btnStart');
  const btnStartMain = qs('btnStartMain');
  const startOverlay = qs('startOverlay');

  const btnPause = qs('btnPause');
  const btnRestart = qs('btnRestart');
  const btnEnterVR = qs('btnEnterVR');
  const btnBackHub = qs('btnBackHub');

  // start (hidden button used by overlay)
  btnStart?.addEventListener('click', ()=>{
    if(STATE.running) return;
    if(startOverlay) startOverlay.style.display = 'none';
    startGame();
  }, {passive:true});

  // overlay main start
  btnStartMain?.addEventListener('click', ()=> btnStart?.click(), {passive:true});

  // pause
  btnPause?.addEventListener('click', ()=>{
    if(!STATE.running || STATE.ended) return;
    setPaused(!STATE.paused);
  }, {passive:true});

  // restart
  btnRestart?.addEventListener('click', async ()=>{
    await flushHardened('restart');
    location.reload();
  }, {passive:true});

  // enter vr fallback
  btnEnterVR?.addEventListener('click', ()=>{
    try{ document.querySelector('a-scene')?.enterVR?.(); }catch{}
  }, {passive:true});

  // back hub (flush first)
  btnBackHub?.addEventListener('click', async ()=>{
    await flushHardened('back-hub');
    const U = new URL(location.href);
    const hub = U.searchParams.get('hub') || '';
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }, {passive:true});

  // before unload flush
  window.addEventListener('beforeunload', ()=>{ try{ flushHardened('beforeunload'); }catch{} });
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) try{ flushHardened('hidden'); }catch{} }, {passive:true});
}

function startGame(){
  // reset state
  STATE.running = true;
  STATE.ended = false;
  STATE.paused = false;

  STATE.score=0; STATE.combo=0; STATE.comboMax=0;
  STATE.miss=0; STATE.hitGood=0; STATE.hitJunk=0; STATE.expireGood=0; STATE.shotMiss=0;

  STATE.g=[0,0,0,0,0];
  STATE.spawnSeen=[false,false,false,false,false];
  STATE.collectedSeen=[false,false,false,false,false];

  STATE.goal.done=false; STATE.goal.cur=0;
  STATE.mini.done=false; STATE.mini.cur=0;
  STATE.miniCleared = 0;

  STATE.storm.active=false; STATE.storm.hitGood=0; STATE.storm.cycleIndex=0;
  STATE.boss.active=false; STATE.boss.done=false; STATE.boss.triggered=false; STATE.boss.hitGood=0;

  computeMinisPlanned();

  // RNG policy
  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  STATE.rng = (runMode === 'study' || runMode === 'research') ? seededRng(STATE.cfg.seed) : Math.random;

  // time
  STATE.timePlannedSec = Number(STATE.cfg?.durationPlannedSec || 90) || 90;
  STATE.timeLeft = STATE.timePlannedSec;

  STATE.tStartIso = new Date().toISOString();

  // AI enabled in play
  STATE.AI.enabled = (runMode === 'play');

  // start event
  emit('hha:start', {
    projectTag:'HHA',
    game:'plate',
    gameMode:'plate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    timePlannedSec: STATE.timePlannedSec,
    durationPlannedSec: STATE.timePlannedSec, // legacy
    startTimeIso: STATE.tStartIso
  });

  // hints
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'neutral');
  setText('uiHint', 'เติมครบ 5 หมู่ แล้วรักษาความแม่นยำ!');

  // spawn
  stopSpawner();
  STATE.engine = makeSpawner(STATE.mountEl);

  // start loop
  emit('hha:time', { game:'plate', timeLeftSec: STATE.timeLeft });
  updateStormHud();
  updateBossHud();
  emitQuest();
  updateHUD();
  startLoop();
}

// ---------------- Init ----------------
(function init(){
  const cfg = parseCfgFromUrl();
  STATE.cfg = cfg;

  // mount
  const mount = qs('plate-layer');
  STATE.mountEl = mount;

  if(!mount){
    console.error('[PlateVR] missing #plate-layer');
    return;
  }

  // show overlay by default
  const startOverlay = qs('startOverlay');
  if(startOverlay) startOverlay.style.display = 'grid';

  // wire
  wireButtons();
  wireShotMiss();
  bindShootOnce();

  // allow pause overlay initially hidden
  const hudPaused = qs('hudPaused'); if(hudPaused) hudPaused.style.display = 'none';

  // set preview texts (run html already sets too, but safe)
  setText('uiDiffPreview', cfg.diff);
  setText('uiRunPreview', cfg.runMode);

  // Start button visible only as bridge
  const btnStart = qs('btnStart'); if(btnStart) btnStart.style.display = 'none';

  // In study/research: deterministic minis planned + disable boss
  computeMinisPlanned();

  // initial HUD
  emitQuest();
  updateHUD();
})();