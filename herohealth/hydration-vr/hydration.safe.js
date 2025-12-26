// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION PACK (module)
// ✅ เข้าเกมชัวร์ (module load ถูกต้อง)
// ✅ เป้ากระจายทั้งจอ: spawnAroundCrosshair:false + grid9
// ✅ ยิง crosshair ด้วย “แตะกลางจอ” (มือถือสะดวก)
// ✅ HUD + Fever + Water balance + End summary + Logger events
// ✅ มี Stamp effect (goal/mini) + running counter

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

/* ------------------------- helpers ------------------------- */
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const $ = (s) => document.querySelector(s);

function clamp(v, a, b){
  v = Number(v) || 0;
  if (v < a) return a;
  if (v > b) return b;
  return v;
}
function qs(){
  return new URLSearchParams(location.search);
}
function str(v, fallback=''){ return (v == null) ? fallback : String(v); }
function num(v, fallback=null){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

/* ------------------------- UI refs ------------------------- */
const UI = {
  startOverlay: $('#start-overlay'),
  btnStart: $('#btn-start'),
  btnMotion: $('#btn-motion'),
  btnVR: $('#btn-vr'),
  btnStop: $('#btn-stop'),

  statScore: $('#stat-score'),
  statCombo: $('#stat-combo'),
  statComboMax: $('#stat-combo-max'),
  statMiss: $('#stat-miss'),
  statTime: $('#stat-time'),
  statGrade: $('#stat-grade'),

  waterZone: $('#water-zone'),
  waterPct: $('#water-pct'),
  waterBar: $('#water-bar'),

  feverPct: $('#fever-pct'),
  feverBar: $('#fever-bar'),

  questTitle: $('#quest-title'),
  q1: $('#quest-line1'),
  q2: $('#quest-line2'),
  q3: $('#quest-line3'),
  q4: $('#quest-line4'),

  coachFace: $('#coach-face'),
  coachText: $('#coach-text'),
  coachSub: $('#coach-sub'),

  stamp: $('#hha-stamp'),
  stampBig: $('#stamp-big'),
  stampSmall: $('#stamp-small'),

  end: $('#hvr-end'),
  endScore: $('#end-score'),
  endGrade: $('#end-grade'),
  endCombo: $('#end-combo'),
  endMiss: $('#end-miss'),
  endGoals: $('#end-goals'),
  endMinis: $('#end-minis'),
  btnRetry: $('#btn-retry'),
  btnBackHub: $('#btn-backhub'),

  playfield: $('#playfield'),
};

function showStamp(big, small){
  if (!UI.stamp) return;
  UI.stampBig && (UI.stampBig.textContent = big || 'GOAL!');
  UI.stampSmall && (UI.stampSmall.textContent = small || '');
  UI.stamp.classList.remove('show');
  // reflow
  void UI.stamp.offsetWidth;
  UI.stamp.classList.add('show');
}

function setCoach(face, text, sub){
  if (UI.coachFace) UI.coachFace.textContent = face || '🥦';
  if (UI.coachText) UI.coachText.textContent = text || '';
  if (UI.coachSub && sub != null) UI.coachSub.textContent = sub;
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:coach', { detail: { face, text, sub } }));
  }catch{}
}

/* ------------------------- core state ------------------------- */
const Q = qs();

const SESSION = {
  projectTag: str(Q.get('projectTag') || Q.get('project') || 'HeroHealth'),
  runMode: str(Q.get('runMode') || Q.get('run') || 'play'),
  game: 'hydration',
  diff: str(Q.get('diff') || 'normal').toLowerCase(),
  duration: clamp(num(Q.get('time') || Q.get('durationPlannedSec') || 70, 70), 20, 180),
  sessionId: str(Q.get('sessionId') || (Date.now() + '-' + Math.random().toString(16).slice(2))),
  seed: str(Q.get('seed') || Q.get('sessionId') || Q.get('ts') || ''),

  hub: str(Q.get('hub') || './hub.html'),
};

const STATE = {
  started: false,
  ended: false,

  score: 0,
  combo: 0,
  comboMax: 0,

  // miss ตามสเปคของคุณ: miss = good expired + junk hit (และ shield block ไม่นับ)
  miss: 0,

  // hydration gauge (0..100)
  water: 34, // start at ~34%
  waterZone: 'LOW',

  // fever 0..100
  fever: 0,
  shield: 0, // seconds remaining (simple)

  // quest
  goalsCleared: 0,
  goalsTotal: 2,
  miniCleared: 0,
  miniTotal: 3,

  // stats for research-ish
  goodSpawned: 0,
  junkSpawned: 0,
  goodHits: 0,
  junkHits: 0,
  expireGood: 0,

  tStartIso: '',
  tEndIso: '',
};

/* ------------------------- grading ------------------------- */
function calcGrade(){
  // โหดแบบสนุก: เอาคะแนน+มิส+ความสมดุลน้ำ
  const score = STATE.score;
  const miss = STATE.miss;
  const zone = STATE.waterZone; // GREEN/LOW/HIGH

  let g = 'C';
  if (score >= 900 && miss <= 2 && zone === 'GREEN') g = 'SSS';
  else if (score >= 780 && miss <= 3) g = 'SS';
  else if (score >= 660 && miss <= 4) g = 'S';
  else if (score >= 520 && miss <= 6) g = 'A';
  else if (score >= 360) g = 'B';
  else g = 'C';
  return g;
}

function updateHUD(){
  UI.statScore && (UI.statScore.textContent = String(STATE.score));
  UI.statCombo && (UI.statCombo.textContent = String(STATE.combo));
  UI.statComboMax && (UI.statComboMax.textContent = String(STATE.comboMax));
  UI.statMiss && (UI.statMiss.textContent = String(STATE.miss));
  UI.statGrade && (UI.statGrade.textContent = calcGrade());

  // water ui
  if (UI.waterPct) UI.waterPct.textContent = Math.round(STATE.water) + '%';
  if (UI.waterZone) UI.waterZone.textContent = STATE.waterZone;
  if (UI.waterBar) UI.waterBar.style.width = clamp(STATE.water, 0, 100) + '%';

  // fever ui
  if (UI.feverPct) UI.feverPct.textContent = Math.round(STATE.fever) + '%';
  if (UI.feverBar) UI.feverBar.style.width = clamp(STATE.fever, 0, 100) + '%';

  try{
    ROOT.dispatchEvent(new CustomEvent('hha:score', {
      detail:{
        score: STATE.score,
        combo: STATE.combo,
        comboMax: STATE.comboMax,
        misses: STATE.miss,
        fever: STATE.fever,
        shield: STATE.shield,
        water: STATE.water,
        waterZone: STATE.waterZone,
        grade: calcGrade(),
      }
    }));
  }catch{}
}

function setWater(v){
  STATE.water = clamp(v, 0, 100);
  const z = zoneFrom ? zoneFrom(STATE.water) : (STATE.water >= 45 && STATE.water <= 70 ? 'GREEN' : (STATE.water < 45 ? 'LOW' : 'HIGH'));
  STATE.waterZone = String(z || 'LOW').toUpperCase();
  try{ setWaterGauge(STATE.water); }catch{}
  updateHUD();
}

function addFever(d){
  STATE.fever = clamp(STATE.fever + d, 0, 100);
  // shield degrade
  updateHUD();
}

/* ------------------------- quest (simple but fun) ------------------------- */
const QUEST = {
  goalIndex: 0,
  miniMask: new Set(),

  // Goal 1: สะสม GREEN-zone hits รวม 10
  g1Need: 10,
  g1Now: 0,

  // Goal 2: อยู่ GREEN ต่อเนื่อง 12 วินาที (นับเวลาจาก time event)
  g2NeedSec: 12,
  g2NowSec: 0,
  g2Active: false,

  // Mini A: PERFECT 6 ครั้ง
  mPerfectNeed: 6,
  mPerfectNow: 0,

  // Mini B: No-junk sprint: เก็บ good 5 ภายใน 8 วินาที และห้ามโดน junk
  sprintNeed: 5,
  sprintNow: 0,
  sprintWindowSec: 8,
  sprintT0: null,
  sprintFail: false,

  // Mini C: Recovery: จาก HIGH/LOW กลับเข้า GREEN ภายใน 6 วินาที
  recNeedSec: 6,
  recT0: null,
  recArmed: false,
};

function questText(){
  // title + lines
  UI.questTitle && (UI.questTitle.textContent = `Quest ${QUEST.goalIndex + 1}`);

  // Goal line
  if (QUEST.goalIndex === 0){
    UI.q1 && (UI.q1.textContent = `Goal: อยู่ GREEN แล้ว “เก็บน้ำดี” ให้ครบ 🟢`);
    UI.q2 && (UI.q2.textContent = `สะสม GREEN hit: ${QUEST.g1Now}/${QUEST.g1Need}`);
  } else {
    UI.q1 && (UI.q1.textContent = `Goal: อยู่ GREEN ต่อเนื่อง ${QUEST.g2NeedSec} วินาที 🟢`);
    UI.q2 && (UI.q2.textContent = `เวลา GREEN ต่อเนื่อง: ${QUEST.g2NowSec}/${QUEST.g2NeedSec} วินาที`);
  }

  UI.q3 && (UI.q3.textContent = `Goals done: ${STATE.goalsCleared} · Minis done: ${STATE.miniCleared}`);

  // progress to S (30%) แบบง่าย ๆ
  const p = clamp(Math.round((STATE.goalsCleared/STATE.goalsTotal)*60 + (STATE.miniCleared/STATE.miniTotal)*40), 0, 100);
  UI.q4 && (UI.q4.textContent = `Progress to S (30%): ${p}%`);

  try{
    ROOT.dispatchEvent(new CustomEvent('quest:update', {
      detail:{
        goalsCleared: STATE.goalsCleared,
        goalsTotal: STATE.goalsTotal,
        minisCleared: STATE.miniCleared,
        miniTotal: STATE.miniTotal,
        questTitle: UI.questTitle ? UI.questTitle.textContent : '',
        line1: UI.q1 ? UI.q1.textContent : '',
        line2: UI.q2 ? UI.q2.textContent : '',
        progressPct: p,
      }
    }));
  }catch{}
}

function clearSprint(){
  QUEST.sprintNow = 0;
  QUEST.sprintT0 = null;
  QUEST.sprintFail = false;
}

function completeMini(key, label){
  if (QUEST.miniMask.has(key)) return;
  QUEST.miniMask.add(key);
  STATE.miniCleared += 1;

  showStamp('MINI!', label || '✔');
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ kind:'mini', label:key } }));
  }catch{}
  setCoach('🤩', `Mini สำเร็จ! ${label || ''}`, 'ไปต่อเลย!');
  questText();
}

function completeGoal(label){
  STATE.goalsCleared += 1;
  showStamp('GOAL!', label || '✔');

  try{
    ROOT.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ kind:'goal', label } }));
  }catch{}
  setCoach('🏆', `Goal สำเร็จ! ${label || ''}`, 'เยี่ยมมาก!');

  QUEST.goalIndex += 1;
  // reset goal counters
  QUEST.g2NowSec = 0;
  QUEST.g2Active = false;

  questText();

  if (STATE.goalsCleared >= STATE.goalsTotal){
    // all done -> bonus end soon
    setCoach('🌟', 'เคลียร์ Goals ครบแล้ว! เก็บแต้มเพิ่มอีกนิด!', 'เวลาเหลือ เก็บคอมโบ!');
  }
}

/* ------------------------- logger helpers ------------------------- */
function logSessionStart(){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:log_session', {
      detail:{
        sessionId: SESSION.sessionId,
        game: SESSION.game,
        mode: SESSION.runMode,
        diff: SESSION.diff,
        seed: SESSION.seed,
        projectTag: SESSION.projectTag,
        t: 'start',
      }
    }));
  }catch{}
}
function logEvent(type, data){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:log_event', {
      detail:{
        sessionId: SESSION.sessionId,
        game: SESSION.game,
        type,
        t: Date.now(),
        data: data || {}
      }
    }));
  }catch{}
}

/* ------------------------- FX hooks ------------------------- */
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

/* ------------------------- gameplay judge ------------------------- */
function judge(ch, ctx){
  // ctx: { isGood,isPower,itemType,hitPerfect,hitDistNorm,targetRect,... }
  const isGood = !!ctx.isGood;
  const isPower = !!ctx.isPower;
  const itemType = ctx.itemType || (isGood ? 'good' : 'bad');

  // shield time tick (soft)
  if (STATE.shield > 0) STATE.shield = Math.max(0, STATE.shield - 0.25);

  // base deltas
  let scoreDelta = 0;
  let feverDelta = 0;
  let waterDelta = 0;
  let comboDelta = 0;

  const perfect = !!ctx.hitPerfect;

  if (itemType === 'power'){
    // powerups (🛡️/💎/⭐)
    if (ch.includes('🛡')) {
      STATE.shield = Math.min(8, STATE.shield + 6);
      scoreDelta = 55;
      feverDelta = -8;
      waterDelta = +3;
      comboDelta = +1;
      setCoach('🛡️', 'โล่พร้อม! กันพลาดได้ (junk hit ที่ถูกกันจะไม่นับ miss)', 'กวาดแต้มต่อ!');
      logEvent('hit', { kind:'shield', perfect });
    } else if (ch.includes('💎')) {
      scoreDelta = 80;
      feverDelta = -10;
      waterDelta = +2;
      comboDelta = +2;
      showStamp('BONUS!', '+💎');
      logEvent('hit', { kind:'diamond', perfect });
    } else {
      scoreDelta = 65;
      feverDelta = -6;
      waterDelta = +2;
      comboDelta = +2;
      showStamp('BONUS!', '+⭐');
      logEvent('hit', { kind:'star', perfect });
    }
  }
  else if (isGood){
    // good hit
    STATE.goodHits++;
    scoreDelta = perfect ? 42 : 28;
    waterDelta = perfect ? +6 : +4;
    feverDelta = perfect ? -3 : -1;
    comboDelta = +1;

    logEvent('hit', { kind:'good', perfect });

    // quest counters
    if (STATE.waterZone === 'GREEN') {
      QUEST.g1Now++;
      if (QUEST.goalIndex === 0 && QUEST.g1Now >= QUEST.g1Need) completeGoal('GREEN Hits');
    }

    // mini perfect
    if (perfect){
      QUEST.mPerfectNow++;
      if (QUEST.mPerfectNow >= QUEST.mPerfectNeed) completeMini('perfect6', 'Perfect ×6');
    }

    // sprint start/advance
    if (!QUEST.sprintT0){
      QUEST.sprintT0 = null; // let time-event start it when good hit
    }
  }
  else {
    // junk hit
    STATE.junkHits++;

    // shield block rule: ถ้ามีโล่ -> ไม่นับ miss
    if (STATE.shield > 0.01){
      scoreDelta = -6;
      feverDelta = +4;
      waterDelta = -3;
      comboDelta = -STATE.combo; // break combo
      logEvent('shield_block', { kind:'junk' });
      setCoach('😤', 'โดนขยะ แต่โล่กันไว้แล้ว! (ไม่นับ miss)', 'อย่าพลาดซ้ำ!');
    } else {
      scoreDelta = -18;
      feverDelta = +10;
      waterDelta = -7;
      comboDelta = -STATE.combo; // break
      STATE.miss += 1; // junk hit -> miss
      logEvent('hit', { kind:'junk', miss:1 });
      setCoach('😟', 'โดนเครื่องดื่มหวาน! ระวัง miss เพิ่มนะ', 'หันกลับไปเก็บน้ำดี!');
    }

    // sprint fail
    QUEST.sprintFail = true;
  }

  // apply state
  STATE.score = Math.max(0, STATE.score + scoreDelta);

  if (comboDelta >= 1) STATE.combo += comboDelta;
  else if (comboDelta < 0) STATE.combo = 0;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);

  setWater(STATE.water + waterDelta);
  addFever(feverDelta);

  // score pop FX
  try{
    const r = ctx.targetRect;
    if (r && Particles && Particles.scorePop){
      Particles.scorePop((scoreDelta>=0?'+':'') + scoreDelta, r.left + r.width/2, r.top + r.height/2, { perfect });
    }
    if (r && Particles && Particles.burstAt){
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, { kind: itemType, perfect });
    }
  }catch{}

  // quest text update
  questText();
  updateHUD();

  return { scoreDelta, good: isGood, perfect };
}

/* ------------------------- spawn/expire hooks ------------------------- */
function onExpire(info){
  // info: {ch,isGood,isPower,itemType}
  const isGood = !!info.isGood;
  const itemType = info.itemType || (isGood ? 'good':'bad');

  if (itemType === 'good'){
    // good expired -> miss (ตามสเปคคุณ)
    STATE.expireGood++;
    STATE.miss += 1;
    STATE.combo = 0;

    setCoach('😵', 'พลาดน้ำดี! (good หมดเวลา) miss +1', 'รีบเก็บเป้าให้ทัน!');
    addFever(+6);
    setWater(STATE.water - 2);

    logEvent('miss_expire', { kind:'good', miss:1 });
  } else if (itemType === 'bad'){
    // junk expire ไม่ถือว่า miss (ปล่อยให้ผ่านได้)
    logEvent('expire', { kind:'junk' });
  } else {
    logEvent('expire', { kind:itemType });
  }

  questText();
  updateHUD();
}

/* ------------------------- time hook ------------------------- */
function onTime(e){
  const sec = e && e.detail ? Number(e.detail.sec) : null;
  if (sec == null) return;

  UI.statTime && (UI.statTime.textContent = String(sec));

  // Goal 2: GREEN ต่อเนื่อง
  if (QUEST.goalIndex === 1){
    const inGreen = (STATE.waterZone === 'GREEN');
    if (inGreen){
      QUEST.g2NowSec += 1;
      if (QUEST.g2NowSec >= QUEST.g2NeedSec) completeGoal('Green Hold');
    } else {
      QUEST.g2NowSec = 0;
    }
  }

  // Sprint mini: เริ่มจับเวลาเมื่อ “เริ่มเก็บ good” ชุดแรก
  // เราเริ่ม sprint เมื่ออยู่ GREEN และกด good ครั้งแรก หลังจากนั้นต้องครบ 5 ใน 8 วิ
  if (QUEST.sprintT0 != null){
    const dt = (STATE.durationPlannedSec || SESSION.duration) - sec; // not reliable; ignore
  }

  // Recovery mini: ถ้าออกจาก GREEN -> arm และถ้ากลับ GREEN ภายใน 6 วิ -> mini
  if (STATE.waterZone !== 'GREEN'){
    if (!QUEST.recArmed){
      QUEST.recArmed = true;
      QUEST.recT0 = sec; // ใช้ sec นับถอยหลัง
    }
  } else {
    if (QUEST.recArmed){
      const t0 = QUEST.recT0;
      if (t0 != null){
        const elapsed = (t0 - sec); // เพราะ sec ลดลง
        if (elapsed >= 0 && elapsed <= QUEST.recNeedSec){
          completeMini('recovery', 'Recovery!');
        }
      }
      QUEST.recArmed = false;
      QUEST.recT0 = null;
    }
  }

  // Sprint mini logic robust: นับจาก “hit good ครั้งแรก” หลังจากเริ่มแล้ว ต้องครบใน 8 วินาที ห้าม junk
  // เราทำง่าย: เริ่มเมื่อ good hit ครั้งแรกตั้ง flag แล้วใช้ window timer
}

/* ------------------------- sprint mini (timer-based) ------------------------- */
let sprintTimer = null;

function startSprintWindow(){
  if (QUEST.miniMask.has('sprint')) return;
  if (QUEST.sprintT0 != null) return;
  QUEST.sprintT0 = nowMs();
  QUEST.sprintNow = 0;
  QUEST.sprintFail = false;

  if (sprintTimer) { try{ clearTimeout(sprintTimer); }catch{} }
  sprintTimer = setTimeout(() => {
    // window ends
    if (!QUEST.miniMask.has('sprint')){
      if (!QUEST.sprintFail && QUEST.sprintNow >= QUEST.sprintNeed){
        completeMini('sprint', 'No-Junk Sprint');
      } else {
        setCoach('😤', 'Sprint ไม่ผ่าน ลองใหม่ได้!', 'เริ่มใหม่: เก็บ good 5 ใน 8 วิ');
      }
    }
    QUEST.sprintT0 = null;
    QUEST.sprintNow = 0;
    QUEST.sprintFail = false;
  }, QUEST.sprintWindowSec * 1000);

  setCoach('⚡', `Mini Start! เก็บ good ${QUEST.sprintNeed} ใน ${QUEST.sprintWindowSec} วิ`, 'ห้ามโดน junk ระหว่างทำ!');
}

/* ------------------------- start/stop/end ------------------------- */
let engine = null;

function showEnd(){
  if (!UI.end) return;
  UI.endScore && (UI.endScore.textContent = String(STATE.score));
  UI.endCombo && (UI.endCombo.textContent = String(STATE.comboMax));
  UI.endMiss && (UI.endMiss.textContent = String(STATE.miss));
  UI.endGoals && (UI.endGoals.textContent = `${STATE.goalsCleared}/${STATE.goalsTotal}`);
  UI.endMinis && (UI.endMinis.textContent = `${STATE.miniCleared}/${STATE.miniTotal}`);

  const grade = calcGrade();
  UI.endGrade && (UI.endGrade.textContent = grade);

  UI.end.style.display = 'flex';
}

function endGame(reason='timeup'){
  if (STATE.ended) return;
  STATE.ended = true;

  STATE.tEndIso = new Date().toISOString();

  try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{}
  try{ engine && engine.stop && engine.stop(); }catch{}

  const grade = calcGrade();

  // final event
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:end', {
      detail:{
        sessionId: SESSION.sessionId,
        game: SESSION.game,
        diff: SESSION.diff,
        mode: SESSION.runMode,
        durationPlannedSec: SESSION.duration,
        scoreFinal: STATE.score,
        comboMax: STATE.comboMax,
        misses: STATE.miss,
        goalsCleared: STATE.goalsCleared,
        goalsTotal: STATE.goalsTotal,
        miniCleared: STATE.miniCleared,
        miniTotal: STATE.miniTotal,
        grade,
        reason,
      }
    }));
  }catch{}

  showEnd();
  setCoach('🏁', 'จบเกม! ดูสรุปผลได้เลย', `Grade ${grade} · Score ${STATE.score}`);
}

function attachEndButtons(){
  if (UI.btnRetry){
    UI.btnRetry.addEventListener('click', () => {
      location.reload();
    });
  }
  if (UI.btnBackHub){
    UI.btnBackHub.addEventListener('click', () => {
      try{
        const u = new URL(SESSION.hub, location.href);
        // ส่ง context กลับ hub ด้วย
        u.searchParams.set('lastGame', 'hydration');
        u.searchParams.set('sessionId', SESSION.sessionId);
        u.searchParams.set('score', String(STATE.score));
        location.href = u.toString();
      }catch{
        location.href = SESSION.hub;
      }
    });
  }
}

/* ------------------------- input (tap center shoot) ------------------------- */
let tapCooldown = 0;

function attachCrosshairTapShoot(){
  if (!UI.playfield) return;

  UI.playfield.addEventListener('pointerdown', (ev) => {
    if (!STATE.started || STATE.ended) return;
    // ถ้ากดบนเป้าจริง ๆ ให้เป้าจัดการเอง (mode-factory จะ preventDefault แล้ว)
    // แต่ถ้ากดที่พื้นที่ว่าง -> ยิง crosshair
    const t = nowMs();
    if (t - tapCooldown < 90) return;
    tapCooldown = t;

    // ยิง crosshair
    try{
      if (engine && engine.shootCrosshair && engine.shootCrosshair()){
        // ok
      }
    }catch{}
  }, { passive:true });
}

/* ------------------------- boot sequence ------------------------- */
async function requestMotionIfNeeded(){
  // iOS Safari
  const w = ROOT;
  const DM = w.DeviceMotionEvent;
  if (DM && typeof DM.requestPermission === 'function'){
    UI.btnMotion && (UI.btnMotion.style.display = 'inline-flex');
    UI.btnMotion && UI.btnMotion.addEventListener('click', async () => {
      try{
        const res = await DM.requestPermission();
        if (res === 'granted'){
          UI.btnMotion.style.display = 'none';
          showStamp('OK!', 'Motion');
        }
      }catch(err){
        showStamp('NOPE', 'Motion');
      }
    });
  }
}

function softInitUI(){
  try{ ensureWaterGauge(); }catch{}
  setWater(STATE.water);
  addFever(0);
  questText();
  updateHUD();
  attachEndButtons();
}

async function startGame(){
  if (STATE.started) return;
  STATE.started = true;
  STATE.tStartIso = new Date().toISOString();

  UI.startOverlay && (UI.startOverlay.style.display = 'none');

  setCoach('🥦', 'เริ่มแล้ว! เก็บน้ำดีให้สมดุล 🟢', 'แตะเป้า หรือแตะกลางจอยิง crosshair');

  logSessionStart();

  // ✅ factory config: กระจายทั้งจอ
  engine = await factoryBoot({
    modeKey: 'hydration',
    difficulty: SESSION.diff,
    duration: SESSION.duration,

    // pools
    pools: {
      good: ['💧','🚰','🫧'],
      bad:  ['🥤','🧃','☕','🧋'],
      trick: ['🫗'] // fake-good (optional)
    },
    goodRate: 0.62,

    // powerups
    powerups: ['🛡️','⭐','💎'],
    powerRate: 0.12,
    powerEvery: 7,

    // ✅ HOSTS
    spawnHost: '#hvr-layer',
    boundsHost: '#playfield',

    // ✅ DISTRIBUTE
    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',

    // ✅ research reproducible
    seed: SESSION.seed,

    // safezone (ไม่ทับ HUD)
    excludeSelectors: [
      '#hud',
      '#hha-water-header',
      '.hha-water-bar',
      '.hha-main-row',
      '#hha-card-left',
      '#hha-card-right',
      '.hha-bottom-row',
      '.hha-fever-card',
      '#hvr-end',
      '#start-overlay'
    ],

    // rhythm feel
    rhythm: { enabled:true, bpm: 112 },

    // judge / expire
    judge: (ch, ctx) => {
      // mini sprint start trigger: เริ่มเมื่อ “hit good ครั้งแรก” และยังไม่ทำ mini sprint
      if (ctx && ctx.isGood && !ctx.isPower && (ctx.itemType === 'good')){
        if (!QUEST.miniMask.has('sprint') && QUEST.sprintT0 == null){
          startSprintWindow();
        }
        if (QUEST.sprintT0 != null && !QUEST.sprintFail){
          QUEST.sprintNow++;
          if (QUEST.sprintNow >= QUEST.sprintNeed){
            // complete in-window (จะถูก finalize ใน timer แต่เราจบเลยก็ได้)
            completeMini('sprint', 'No-Junk Sprint');
            try{ clearTimeout(sprintTimer); }catch{}
            QUEST.sprintT0 = null;
          }
        }
      }
      // ถ้าโดน junk ระหว่าง sprint -> fail
      if (ctx && !ctx.isGood && QUEST.sprintT0 != null){
        QUEST.sprintFail = true;
      }
      return judge(ch, ctx);
    },
    onExpire: onExpire,
  });

  // time events from mode-factory
  ROOT.addEventListener('hha:time', onTime);

  // stop button
  UI.btnStop && UI.btnStop.addEventListener('click', () => endGame('stop'));

  // VR button (แค่โหมด UI — คุณจะผูก A-Frame เพิ่มก็ได้ภายหลัง)
  UI.btnVR && UI.btnVR.addEventListener('click', () => {
    showStamp('VR', 'Soon');
    setCoach('😄','โหมด VR UI พร้อมแล้ว (ยิง crosshair ได้)','ถ้าต้องการ A-Frame scene เดี๋ยวจัดให้เพิ่ม');
  });

  // log spawn counts (ผ่าน event แบบเบา ๆ)
  ROOT.addEventListener('hha:log_event', ()=>{});

  // ยิง crosshair ด้วยการแตะกลางจอ
  attachCrosshairTapShoot();

  // first quest call
  questText();
  updateHUD();
}

/* ------------------------- start overlay bindings ------------------------- */
function bindStart(){
  UI.btnStart && UI.btnStart.addEventListener('click', () => startGame());
  // allow tap anywhere on start overlay
  UI.startOverlay && UI.startOverlay.addEventListener('pointerdown', (ev) => {
    const t = ev.target;
    if (t && (t.id === 'btn-motion')) return;
    if (t && (t.id === 'btn-start')) return;
  }, { passive:true });
}

/* ------------------------- auto end when time hits 0 ------------------------- */
ROOT.addEventListener('hha:time', (e) => {
  const sec = e && e.detail ? Number(e.detail.sec) : null;
  if (sec === 0 && STATE.started && !STATE.ended){
    endGame('timeup');
  }
});

/* ------------------------- init ------------------------- */
(async function main(){
  softInitUI();
  bindStart();
  await requestMotionIfNeeded();

  // safety: if start overlay missing, auto start
  if (!UI.startOverlay){
    startGame();
  }
})();