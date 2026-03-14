// === /fitness/js/balance-hold.js ===
// Balance Hold — FULL PRODUCTION PATCH
// PATCH v20260305-BH-FULL-PROD-IDLEFIX
'use strict';

const GAME_ID = 'balance-hold';
const GAME_TITLE = 'Balance Hold';
const GAME_CATEGORY = 'exercise';
const GAME_VERSION = 'v20260305-A-SCHEMA';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* views */
const viewMenu    = $('#view-menu');
const viewPlay    = $('#view-play');
const viewResult  = $('#view-result');

/* menu fields */
const elDiffSel   = $('#difficulty');
const elDurSel    = $('#sessionDuration');

/* HUD */
const hudMode     = $('#hud-mode');
const hudDiff     = $('#hud-diff');
const hudDur      = $('#hud-dur');
const hudStab     = $('#hud-stability');
const hudObs      = $('#hud-obstacles');
const hudTime     = $('#hud-time');
const hudScore    = $('#hud-score');
const hudCombo    = $('#hud-combo');
const hudHp       = $('#hud-hp');
const hudStage    = $('#hud-stage');
const hudRt       = $('#hud-rt');

const playArea    = $('#playArea');
const platformWrap= $('#platform-wrap');
const platformEl  = $('#platform');
const indicatorEl = $('#indicator');
let obstacleLayer = $('#obstacle-layer');

const coachLabel  = $('#coachLabel');
const coachBubble = $('#coachBubble');

/* result fields */
const resMode        = $('#res-mode');
const resDiff        = $('#res-diff');
const resDur         = $('#res-dur');
const resEnd         = $('#res-end');
const resStab        = $('#res-stability');
const resMeanTilt    = $('#res-meanTilt');
const resRmsTilt     = $('#res-rmsTilt');
const resAvoid       = $('#res-avoid');
const resHit         = $('#res-hit');
const resAvoidRate   = $('#res-avoidRate');
const resFatigue     = $('#res-fatigue');
const resSamples     = $('#res-samples');
const btnBackHub     = $('#btnBackHub');
const btnBackHubMenu = $('#btnBackHubMenu');

/* help / pause */
const btnPause      = $('#btnPause');
const btnHelp       = $('#btnHelp');
const helpOverlay   = $('#helpOverlay');
const btnHelpResume = $('#btnHelpResume');
const btnHelpClose  = $('#btnHelpClose');

/* debug */
const btnDebug          = $('#btnDebug');
const debugPanel        = $('#debugPanel');
const btnDebugClose     = $('#btnDebugClose');
const dbgSpawnGust      = $('#dbgSpawnGust');
const dbgSpawnBomb      = $('#dbgSpawnBomb');
const dbgSpawnShock     = $('#dbgSpawnShock');
const dbgBossWave       = $('#dbgBossWave');
const dbgAddShield      = $('#dbgAddShield');
const dbgHpUp           = $('#dbgHpUp');
const dbgHpDown         = $('#dbgHpDown');
const dbgScoreUp        = $('#dbgScoreUp');
const dbgGotoTrick      = $('#dbgGotoTrick');
const dbgGotoBoss       = $('#dbgGotoBoss');
const dbgToggleTutorial = $('#dbgToggleTutorial');
const dbgSnapshot       = $('#dbgSnapshot');
const debugReadout      = $('#debugReadout');

/* teacher / export */
const teacherPanel      = $('#teacherPanel');
const btnTeacherClose   = $('#btnTeacherClose');
const btnTeacherToggle  = $('#btnTeacherToggle');

const teacherStage      = $('#teacherStage');
const teacherStability  = $('#teacherStability');
const teacherAvoidHit   = $('#teacherAvoidHit');
const teacherScore      = $('#teacherScore');
const teacherHpShield   = $('#teacherHpShield');
const teacherRankLive   = $('#teacherRankLive');

const btnCopySummary    = $('#btnCopySummary');
const btnExportJson     = $('#btnExportJson');

/* helpers */
const clamp   = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
const clamp01 = (x)=>clamp(x,0,1);
const nowMs   = ()=> (performance && performance.now) ? performance.now() : Date.now();
const fmtPercent = (v)=>(v==null||Number.isNaN(v))?'-':(v*100).toFixed(1)+'%';
const fmtFloat   = (v,d=2)=>(v==null||Number.isNaN(v))?'-':v.toFixed(d);

function qs(k, d=''){
  try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; }
}
function qbool(k, d=false){
  const v = String(qs(k, d ? '1' : '0')).toLowerCase();
  return ['1','true','yes','y','on'].includes(v);
}
function isoNow(){
  return new Date().toISOString();
}
function makeSessionId(){
  const pid = String(qs('pid','anon')).trim() || 'anon';
  const seed = String(qs('seed','')).trim() || String(Date.now());
  return `bh-${pid}-${seed}-${Date.now()}`;
}
function safeJsonParse(s, fallback){
  try{ return JSON.parse(s); }catch(e){ return fallback; }
}

function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=>v && v.classList.add('hidden'));
  if (name==='menu')   viewMenu && viewMenu.classList.remove('hidden');
  if (name==='play')   viewPlay && viewPlay.classList.remove('hidden');
  if (name==='result') viewResult && viewResult.classList.remove('hidden');
}

function mapEndReason(code){
  switch(code){
    case 'timeout': return 'ครบเวลาที่กำหนด / Timeout';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    case 'fail':    return 'เสียสมดุล (HP หมด) / Failed';
    default:        return code || '-';
  }
}

/* seeded RNG */
function xmur3(str){
  str = String(str||''); let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h<<13)|(h>>>19); }
  return function(){ h = Math.imul(h ^ (h>>>16), 2246822507); h = Math.imul(h ^ (h>>>13), 3266489909); return (h ^= (h>>>16))>>>0; };
}
function mulberry32(a){
  let t = a>>>0;
  return function(){ t += 0x6D2B79F5; let r = Math.imul(t ^ (t>>>15), 1|t); r ^= r + Math.imul(r ^ (r>>>7), 61|r); return ((r ^ (r>>>14))>>>0)/4294967296; };
}
function makeRng(seedStr){ const g=xmur3(seedStr); return mulberry32(g()); }
function randBetween(rng,a,b){ return a + rng()*(b-a); }

/* FX */
function popText(msg, isBad=false){
  const fx = document.getElementById('fx-layer');
  if(!fx) return;
  const d = document.createElement('div');
  d.className = 'pop';
  d.textContent = msg;
  if (isBad) d.style.borderColor = 'rgba(239,68,68,.25)';
  fx.appendChild(d);
  setTimeout(()=> d.remove(), 950);
}
function shakePlay(){
  const el = document.getElementById('playArea');
  if(!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(()=> el.classList.remove('shake'), 260);
}

/* Audio */
function beep(freq=440, dur=0.06, type='sine', gain=0.025){
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!window.__bhAudio) window.__bhAudio = new AC();
    const ac = window.__bhAudio;
    const osc = ac.createOscillator();
    const g = ac.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;

    osc.connect(g);
    g.connect(ac.destination);

    const t0 = ac.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.start(t0);
    osc.stop(t0 + dur);
  }catch(e){}
}
function sfxAvoid(){ beep(720, 0.05, 'triangle', 0.02); }
function sfxHit(){ beep(160, 0.12, 'sawtooth', 0.035); }
function sfxShield(){ beep(860, 0.07, 'square', 0.02); }
function sfxBoss(){ beep(220, 0.08, 'square', 0.03); setTimeout(()=>beep(320,0.08,'square',0.025), 90); }

/* Ensure layers */
function ensureObstacleLayer(){
  if (obstacleLayer) return obstacleLayer;
  if (!playArea) return null;
  const div = document.createElement('div');
  div.id = 'obstacle-layer';
  div.className = 'obstacle-layer';
  div.style.position='absolute';
  div.style.inset='0';
  div.style.pointerEvents='none';
  div.style.zIndex='6';
  playArea.appendChild(div);
  obstacleLayer = div;
  return obstacleLayer;
}

/* Difficulty */
const GAME_DIFF = {
  easy:   { safeHalf:0.32,  disturbMinMs:1380, disturbMaxMs:2280, disturbStrength:0.23, passiveDrift:0.088, hp:4 },
  normal: { safeHalf:0.150, disturbMinMs:720,  disturbMaxMs:1240, disturbStrength:0.43, passiveDrift:0.178, hp:3 },
  hard:   { safeHalf:0.118, disturbMinMs:520,  disturbMaxMs:930,  disturbStrength:0.56, passiveDrift:0.220, hp:3 }
};
function pickDiff(key){ return GAME_DIFF[key] || GAME_DIFF.normal; }
function dangerThresholdMs(diffKey){
  if (diffKey === 'easy') return 1150;
  if (diffKey === 'hard') return 620;
  return 780;
}
function recoveryDurationMs(diffKey){
  if (diffKey === 'easy') return 650;
  if (diffKey === 'hard') return 1550;
  return 1150;
}

/* Coach */
const COACH_LINES = {
  welcome:'ลากซ้าย–ขวาเพื่อคุมให้อยู่โซนปลอดภัย / Drag left–right to balance',
  drift:'เอียงค้างนานไป—ดันกลับกลางช้า ๆ / Drift—return to center',
  hit:'โดนแรงรบกวน! ตั้งหลักไว ๆ / Hit! Recover fast',
  boss:'บอสมาแล้ว! โซนแคบลง / Boss! Narrow safe zone'
};
let lastCoachAt=0;
const COACH_COOLDOWN_MS=4500;
function showCoach(key){
  if (!coachBubble) return;
  const now = nowMs();
  if (now - lastCoachAt < COACH_COOLDOWN_MS) return;
  const msg = COACH_LINES[key];
  if (!msg) return;
  lastCoachAt = now;
  coachBubble.textContent = msg;
  coachBubble.classList.remove('hidden');
  setTimeout(()=> coachBubble && coachBubble.classList.add('hidden'), 4200);
}

/* Stage */
function stageFrom(tNorm){
  if (tNorm < 0.40) return 'Warm';
  if (tNorm < 0.78) return 'Trick';
  return 'Boss';
}
function stageCfg(base, stage, idleBoost){
  const idleMul = 1 + 2.2*(idleBoost||0);
  let safeMul=1, freqMul=1, strMul=1, driftMul=1;

  if (stage==='Warm'){
    safeMul=0.95;
    freqMul=1.12;
    strMul=1.02;
    driftMul=1.10;
  }
  else if(stage==='Trick'){
    safeMul=0.80;
    freqMul=1.42;
    strMul=1.26;
    driftMul=1.38;
  }
  else{
    safeMul=0.58;
    freqMul=2.00;
    strMul=1.62;
    driftMul=1.82;
  }

  return {
    safeHalf: clamp(base.safeHalf*safeMul, 0.08, 0.42),
    disturbMinMs: clamp(base.disturbMinMs/(freqMul), 380, 4000),
    disturbMaxMs: clamp(base.disturbMaxMs/(freqMul), 520, 5000),
    disturbStrength: clamp(base.disturbStrength*strMul, 0.12, 0.78),
    passiveDrift: clamp(base.passiveDrift*driftMul*idleMul, 0.02, 0.36)
  };
}

/* State */
let state=null;
let rafId=null;
let rng=null;
let __lastBalanceSummary = null;

/* Telemetry */
function buildStandardContext(){
  return {
    gameId: GAME_ID,
    title: GAME_TITLE,
    category: GAME_CATEGORY,
    gameVersion: GAME_VERSION,

    sessionId: state?.sessionId || null,
    pid: String(qs('pid','anon')).trim() || 'anon',

    run: String(qs('run','play')).trim() || 'play',
    diff: String(elDiffSel?.value || qs('diff','normal')).trim() || 'normal',
    time: Number(elDurSel?.value || qs('time','80') || 80),
    seed: String(qs('seed','')).trim() || '',
    view: String(qs('view','')).trim() || '',

    studyId: String(qs('studyId','')).trim() || '',
    phase: String(qs('phase','')).trim() || '',
    conditionGroup: String(qs('conditionGroup','')).trim() || '',

    hub: String(qs('hub','')).trim() || '',
    logEnabled: !!state?.logEnabled
  };
}

function buildEventRow(type, payload){
  const ctx = buildStandardContext();
  return {
    timestampIso: isoNow(),
    ts: Date.now(),
    ...ctx,
    eventType: String(type || 'unknown'),
    elapsedMs: Math.round(state?.elapsed || 0),
    payload: payload || {}
  };
}

function pushTelemetry(type, payload){
  if (!state || !state.telemetry) return;

  const eventTypeMap = {
    start: 'start',
    avoid: 'avoid',
    hit: 'hit',
    shield_pickup: 'shield_pickup',
    shield_block: 'shield_block',
    mission_complete: 'mission_complete',
    boss_enter: 'boss_enter',
    pause: 'pause',
    resume: 'resume',
    end: 'end'
  };
  const finalType = eventTypeMap[type] || 'custom';

  const row = {
    t: Date.now(),
    elapsedMs: Math.round(state.elapsed || 0),
    type: finalType,
    payload: payload || {}
  };

  state.telemetry.push(row);

  if (state.logEnabled){
    state.cloudQueue.push(buildEventRow(finalType, payload || {}));
  }

  if (state.telemetry.length > 200){
    state.telemetry.splice(0, state.telemetry.length - 200);
  }
  if (state.cloudQueue.length > 400){
    state.cloudQueue.splice(0, state.cloudQueue.length - 400);
  }
}

/* Help / Pause / Tutorial */
function showHelpOverlay(show){
  if (!helpOverlay) return;
  helpOverlay.classList.toggle('hidden', !show);
  helpOverlay.setAttribute('aria-hidden', show ? 'false' : 'true');
}
function setPaused(v){
  if (!state) return;
  if (!!state.paused === !!v) return;

  state.paused = !!v;
  if (state.paused){
    state.pauseStartedAt = nowMs();
    pushTelemetry('pause', {
      hp: state.hp || 0,
      score: state.score || 0,
      stage: stageFrom(state.durationMs ? (state.elapsed/state.durationMs) : 0)
    });
    showHelpOverlay(true);
  }else{
    const pausedFor = Math.max(0, nowMs() - (state.pauseStartedAt || nowMs()));
    state.startTime += pausedFor;
    state.lastFrame = nowMs();
    if (state.nextObstacleAt) state.nextObstacleAt += pausedFor;
    if (state.nextSampleAt) state.nextSampleAt += pausedFor;
    if (state.nextShieldAt) state.nextShieldAt += pausedFor;
    if (state.boss?.nextWaveAt) state.boss.nextWaveAt += pausedFor;
    if (state.tutorialUntil) state.tutorialUntil += pausedFor;
    pushTelemetry('resume', {
      hp: state.hp || 0,
      score: state.score || 0,
      stage: stageFrom(state.durationMs ? (state.elapsed/state.durationMs) : 0)
    });
    showHelpOverlay(false);
  }
}
function ensureTutorialBanner(){
  if (!playArea) return null;
  let el = document.getElementById('tutorialBanner');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'tutorialBanner';
  el.className = 'tutorialBanner';
  playArea.appendChild(el);
  return el;
}
function updateTutorial(now){
  if (!state || !playArea) return;
  const el = ensureTutorialBanner();
  if (!el) return;

  if (now > (state.tutorialUntil || 0)){
    el.remove();
    return;
  }

  const elapsed = now - state.startTime;
  let text = 'ลากซ้าย–ขวาเพื่อคุมลูกบอลให้อยู่ในโซนสีเขียว';
  if (elapsed > 2800) text = 'หลบ 💨 / 💣 / ⚡ ให้ได้ และพยายามอย่าเสีย HP';
  if (elapsed > 5600) text = 'เก็บ 🛡️ ตอนอยู่ใน safe zone เพื่อกัน hit 1 ครั้ง';
  if (elapsed > 8000) text = 'ปลายเกมจะเข้า Boss — เตรียมรับ sweep และ wave';

  el.textContent = text;
}

/* Mission HUD */
function ensureMissionHud(){
  const hud = document.querySelector('.hud');
  if (!hud) return null;

  let box = document.getElementById('missionHud');
  if (box) return box;

  box = document.createElement('div');
  box.id = 'missionHud';
  box.style.marginTop = '8px';
  box.style.display = 'flex';
  box.style.gap = '8px';
  box.style.flexWrap = 'wrap';
  box.innerHTML = `
    <span id="m1Chip" style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35);border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;">① Safe Streak</span>
    <span id="m2Chip" style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35);border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;">② Avoid x6</span>
    <span id="m3Chip" style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35);border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;">③ Reach Boss</span>
  `;
  hud.appendChild(box);
  return box;
}
function updateMissionHud(){
  ensureMissionHud();
  const mark = (id, done)=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = done ? 'rgba(34,197,94,.35)' : 'rgba(148,163,184,.18)';
    el.style.background  = done ? 'rgba(34,197,94,.14)' : 'rgba(2,6,23,.35)';
    el.textContent = (done ? '✅ ' : '') + el.textContent.replace(/^✅\s*/, '');
  };

  if (!state || !state.missions) return;
  mark('m1Chip', state.missions.m1SafeStreakDone);
  mark('m2Chip', state.missions.m2AvoidDone);
  mark('m3Chip', state.missions.m3BossDone);
}

/* Goal HUD */
function ensureGoalHud(){
  const hud = document.querySelector('.hud');
  if (!hud) return null;

  let box = document.getElementById('goalHud');
  if (box) return box;

  box = document.createElement('div');
  box.id = 'goalHud';
  box.style.marginTop = '8px';
  box.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
      <div id="goalLabel" style="font-size:12px;font-weight:1000;color:rgba(229,231,235,.92);">Goal Progress</div>
      <div id="goalPct" style="font-size:12px;font-weight:1000;color:rgba(229,231,235,.82);">0%</div>
    </div>
    <div style="height:12px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden;border:1px solid rgba(148,163,184,.18);">
      <div id="goalFill" style="height:100%;width:0%;background:linear-gradient(90deg, rgba(34,197,94,.75), rgba(34,211,238,.75));"></div>
    </div>
  `;
  hud.appendChild(box);
  return box;
}
function updateGoalHud(){
  ensureGoalHud();
  if (!state) return;

  const goalFill = document.getElementById('goalFill');
  const goalPct  = document.getElementById('goalPct');
  const goalLabel= document.getElementById('goalLabel');

  const stabPart  = clamp01((state.totalSamples ? state.stableSamples / state.totalSamples : 0) / 0.85);
  const avoidPart = clamp01((state.obstaclesAvoided || 0) / 8);
  const bossPart  = state.missions?.m3BossDone ? 1 : (state.elapsed / state.durationMs >= 0.78 ? 0.75 : 0);
  const scorePart = clamp01((state.score || 0) / 1200);

  const progress = clamp01((stabPart*0.35) + (avoidPart*0.25) + (bossPart*0.20) + (scorePart*0.20));

  if (goalFill) goalFill.style.width = `${(progress*100).toFixed(1)}%`;
  if (goalPct)  goalPct.textContent = `${Math.round(progress*100)}%`;

  if (goalLabel){
    if (progress >= 1) goalLabel.textContent = 'Goal Complete!';
    else if (progress >= 0.75) goalLabel.textContent = 'Almost There';
    else if (progress >= 0.45) goalLabel.textContent = 'Good Progress';
    else goalLabel.textContent = 'Goal Progress';
  }
}

/* Debug */
function showDebugPanel(show){
  if (!debugPanel) return;
  debugPanel.classList.toggle('hidden', !show);
  debugPanel.setAttribute('aria-hidden', show ? 'false' : 'true');
}
function updateDebugReadout(){
  if (!debugReadout){
    return;
  }
  if (!state){
    debugReadout.textContent = 'state: -';
    return;
  }

  const tNorm = state.durationMs ? (state.elapsed / state.durationMs) : 0;
  const stage = stageFrom(tNorm);

  const data = {
    angle: Number(state.angle || 0).toFixed(3),
    targetAngle: Number(state.targetAngle || 0).toFixed(3),
    stage,
    hp: state.hp || 0,
    shield: state.shield || 0,
    score: state.score || 0,
    combo: state.combo || 0,
    obstaclesTotal: state.obstaclesTotal || 0,
    obstaclesAvoided: state.obstaclesAvoided || 0,
    obstaclesHit: state.obstaclesHit || 0,
    biasDir: state.biasDir || 0,
    idlePressure: Number(state.idlePressure || 0).toFixed(3),
    dangerMs: Math.round(state.dangerMs || 0),
    nextObstacleInMs: Math.max(0, Math.round((state.nextObstacleAt || 0) - nowMs())),
    nextShieldInMs: Math.max(0, Math.round((state.nextShieldAt || 0) - nowMs())),
    paused: !!state.paused
  };

  debugReadout.textContent = JSON.stringify(data, null, 2);
}
function setStageProgress(norm){
  if (!state) return;
  norm = clamp(norm, 0, 0.999);
  const newElapsed = state.durationMs * norm;
  state.startTime = nowMs() - newElapsed;
  state.elapsed = newElapsed;
  state.lastFrame = nowMs();
}
function refreshHudNow(){
  if (!state) return;
  if (hudScore) hudScore.textContent = String(state.score || 0);
  if (hudCombo) hudCombo.textContent = String(state.combo || 0);
  if (hudHp)    hudHp.textContent = `${state.hp}${(state.shield>0)?` • 🛡️${state.shield}`:''}`;
  if (hudObs)   hudObs.textContent = `${state.obstaclesAvoided || 0} / ${state.obstaclesTotal || 0}`;
  updateMissionHud();
  updateGoalHud();
  updateDebugReadout();
}

/* Teacher */
function showTeacherPanel(show){
  if (!teacherPanel) return;
  teacherPanel.classList.toggle('hidden', !show);
  teacherPanel.setAttribute('aria-hidden', show ? 'false' : 'true');
}
function buildLiveSummary(){
  if (!state) return null;

  const totalObs = (state.obstaclesAvoided || 0) + (state.obstaclesHit || 0);
  const avoidRate = totalObs ? (state.obstaclesAvoided/totalObs) : 0;
  const stabilityRatio = state.totalSamples ? (state.stableSamples/state.totalSamples) : 0;

  const summary = {
    gameId: GAME_ID,
    pid: String(qs('pid','anon')),
    seed: String(qs('seed','')),
    diff: String(elDiffSel?.value || qs('diff','normal')),
    durationSec: Math.round((state.durationMs || 0)/1000),
    elapsedSec: Math.round((state.elapsed || 0)/1000),
    stage: stageFrom(state.durationMs ? (state.elapsed/state.durationMs) : 0),
    score: state.score || 0,
    comboMax: state.comboMax || 0,
    hpEnd: state.hp || 0,
    shield: state.shield || 0,
    stabilityRatio,
    avoidRate,
    obstaclesAvoided: state.obstaclesAvoided || 0,
    obstaclesHit: state.obstaclesHit || 0,
    m1SafeStreakDone: !!state.missions?.m1SafeStreakDone,
    m2AvoidDone: !!state.missions?.m2AvoidDone,
    m3BossDone: !!state.missions?.m3BossDone,
    bestSafeStreak: state.bestSafeStreak || 0
  };

  summary.rank = calcRank(summary);
  summary.stars = calcStars(summary);
  summary.perfect = calcPerfect(summary);
  return summary;
}
function updateTeacherPanel(){
  if (!teacherPanel) return;
  const s = buildLiveSummary();
  if (!s) return;

  if (teacherStage)     teacherStage.textContent = s.stage;
  if (teacherStability) teacherStability.textContent = `${Math.round((s.stabilityRatio||0)*100)}%`;
  if (teacherAvoidHit)  teacherAvoidHit.textContent = `${s.obstaclesAvoided} / ${s.obstaclesHit}`;
  if (teacherScore)     teacherScore.textContent = String(s.score);
  if (teacherHpShield)  teacherHpShield.textContent = `${s.hpEnd} / ${s.shield}`;

  if (teacherRankLive){
    const liveRank = calcRank(s);
    const liveStars = calcStars(s);
    teacherRankLive.textContent = `${liveRank} ${starText(liveStars)}${calcPerfect(s) ? ' 👑' : ''}`;
  }
}

/* Rank / Stars / Perfect */
function calcPerfect(summary){
  return (
    (summary.stabilityRatio || 0) >= 0.90 &&
    (summary.avoidRate || 0) >= 0.88 &&
    (summary.obstaclesHit || 0) <= 1 &&
    (summary.hpEnd || 0) >= 2 &&
    (summary.score || 0) >= 1400 &&
    !!summary.m1SafeStreakDone &&
    !!summary.m2AvoidDone &&
    !!summary.m3BossDone
  );
}
function calcRank(summary){
  if (calcPerfect(summary)) return 'S+';

  const stab = Number(summary.stabilityRatio || 0);
  const avoidRate = Number(summary.avoidRate || 0);
  const hit = Number(summary.obstaclesHit || 0);
  const score = Number(summary.score || 0);
  const hp = Number(summary.hpEnd || 0);

  if (stab >= 0.90 && avoidRate >= 0.90 && hit <= 1 && hp >= 2 && score >= 1600) return 'S';
  if (stab >= 0.82 && avoidRate >= 0.80 && hit <= 2 && hp >= 1 && score >= 1100) return 'A';
  if (stab >= 0.72 && avoidRate >= 0.68 && score >= 700) return 'B';
  if (stab >= 0.58 && avoidRate >= 0.52 && score >= 380) return 'C';
  return 'D';
}
function rankLabel(rank){
  if (rank === 'S+') return 'Perfect Balance Master';
  if (rank === 'S') return 'Super Balance';
  if (rank === 'A') return 'Excellent';
  if (rank === 'B') return 'Great Job';
  if (rank === 'C') return 'Keep Practicing';
  return 'Try Again';
}
function calcStars(summary){
  let stars = 0;
  if ((summary.stabilityRatio || 0) >= 0.60) stars++;
  if ((summary.avoidRate || 0) >= 0.70) stars++;
  if ((summary.hpEnd || 0) >= 2 && (summary.score || 0) >= 900) stars++;
  return stars;
}
function calcMissionStatus(summary){
  return {
    m1: !!summary.m1SafeStreakDone,
    m2: !!summary.m2AvoidDone,
    m3: !!summary.m3BossDone
  };
}
function starText(stars){
  if (stars >= 3) return '⭐⭐⭐';
  if (stars === 2) return '⭐⭐';
  if (stars === 1) return '⭐';
  return '☆';
}

/* Result hero */
function ensureResultHeroBox(){
  if (!viewResult) return null;

  let box = document.getElementById('resultHeroBox');
  if (box) return box;

  box = document.createElement('div');
  box.id = 'resultHeroBox';
  box.style.marginTop = '12px';
  box.style.padding = '14px';
  box.style.borderRadius = '18px';
  box.style.border = '1px solid rgba(148,163,184,.18)';
  box.style.background = 'rgba(2,6,23,.45)';
  box.style.boxShadow = '0 10px 30px rgba(0,0,0,.22)';
  box.innerHTML = `
    <div id="resultRankLine" style="font-size:28px;font-weight:1000;">🏅 Rank —</div>
    <div id="resultRankSub" style="margin-top:6px;color:rgba(229,231,235,.78);font-weight:800;">—</div>
    <div id="resultHighlights" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;"></div>
  `;

  const card = viewResult.querySelector('.card');
  if (card){
    const first = card.querySelector('.h2');
    if (first && first.nextSibling){
      card.insertBefore(box, first.nextSibling);
    }else{
      card.appendChild(box);
    }
  }else{
    viewResult.appendChild(box);
  }
  return box;
}
function setResultHero(summary){
  ensureResultHeroBox();

  const rank = calcRank(summary);
  const stars = calcStars(summary);
  const missions = calcMissionStatus(summary);
  const perfect = calcPerfect(summary);

  const line = document.getElementById('resultRankLine');
  const sub  = document.getElementById('resultRankSub');
  const hi   = document.getElementById('resultHighlights');

  if (line) line.textContent = `${perfect ? '👑' : '🏅'} Rank ${rank}  ${starText(stars)}`;
  if (sub){
    sub.textContent = perfect
      ? `Perfect Clear • Score ${summary.score} • Stability ${Math.round((summary.stabilityRatio||0)*100)}%`
      : `${rankLabel(rank)} • Score ${summary.score} • Stability ${Math.round((summary.stabilityRatio||0)*100)}%`;
  }

  if (hi){
    const chips = [
      `Avoid ${(summary.avoidRate*100).toFixed(0)}%`,
      `Hit ${summary.obstaclesHit}`,
      `HP ${summary.hpEnd}`,
      `Combo ${summary.comboMax}`,
      `${missions.m1 ? '✅' : '⬜'} M1`,
      `${missions.m2 ? '✅' : '⬜'} M2`,
      `${missions.m3 ? '✅' : '⬜'} M3`,
      `${perfect ? '👑 PERFECT' : `⭐ ${calcStars(summary)} Stars`}`
    ];

    hi.innerHTML = chips.map(t => `
      <span style="
        border:1px solid rgba(148,163,184,.18);
        background:${t.includes('PERFECT') ? 'rgba(245,158,11,.14)' : 'rgba(2,6,23,.32)'};
        border-radius:999px;
        padding:7px 10px;
        font-size:12px;
        font-weight:900;
        color:rgba(229,231,235,.92);
      ">${t}</span>
    `).join('');
  }
}
function ensureExtraResultRows(summary){
  const grid = document.querySelector('.resgrid');
  if (!grid) return;

  const ensureRow = (id, label, value)=>{
    let el = document.getElementById(id);
    if (!el){
      const wrap = document.createElement('div');
      wrap.className = 'r';
      wrap.innerHTML = `<span>${label}</span><b id="${id}">—</b>`;
      grid.appendChild(wrap);
      el = wrap.querySelector('b');
    }
    el.textContent = value;
  };

  ensureRow('res-score-extra', 'Score', String(summary.score || 0));
  ensureRow('res-combo-extra', 'Combo Max', String(summary.comboMax || 0));
  ensureRow('res-hp-extra', 'HP End', String(summary.hpEnd || 0));
  ensureRow('res-stars-extra', 'Stars', starText(calcStars(summary)));
  ensureRow('res-missions-extra', 'Missions', `${summary.m1SafeStreakDone?'1':'-'} ${summary.m2AvoidDone?'2':'-'} ${summary.m3BossDone?'3':'-'}`);
  ensureRow('res-perfect-extra', 'Perfect', summary.perfect ? 'YES' : 'NO');
}
function ensureEndActions(){
  const row = viewResult?.querySelector('.row');
  if (!row) return null;

  let cont = document.getElementById('btnContinueNext');
  if (!cont){
    cont = document.createElement('button');
    cont.id = 'btnContinueNext';
    cont.className = 'btn';
    cont.textContent = '⏭ Continue';
    row.insertBefore(cont, row.firstChild);
  }
  return cont;
}
function wireEndActions(summary){
  const cont = ensureEndActions();
  const hub  = String(qs('hub','')).trim();

  if (cont){
    cont.onclick = ()=>{
      const next = qs('next','');
      if (next){
        location.href = next;
        return;
      }
      showView('menu');
    };
    const stars = calcStars(summary);
    cont.textContent = stars >= 2 ? '⏭ Continue' : '↻ Practice More';
  }

  if (btnBackHub && hub){
    btnBackHub.style.display = '';
    btnBackHub.onclick = ()=> location.href = hub;
  }
}

/* Export / Summary */
function buildHHALastSummary(summary){
  const ctx = buildStandardContext();

  return {
    ...ctx,

    score: Number(summary.score || 0),
    rank: calcRank(summary),
    stars: calcStars(summary),
    perfect: !!summary.perfect,

    status: {
      ended: true,
      endReason: String(summary.endReason || 'unknown'),
      timestampIso: isoNow(),
      ts: Date.now()
    },

    metrics: {
      durationPlayedSec: Number(summary.durationPlayedSec || 0),
      stabilityRatio: Number(summary.stabilityRatio || 0),
      avoidRate: Number(summary.avoidRate || 0),
      meanTilt: Number(summary.meanTilt || 0),
      rmsTilt: Number(summary.rmsTilt || 0),
      fatigueIndex: Number(summary.fatigueIndex || 0),
      bestSafeStreak: Number(summary.bestSafeStreak || 0),

      obstaclesAvoided: Number(summary.obstaclesAvoided || 0),
      obstaclesHit: Number(summary.obstaclesHit || 0),
      hpEnd: Number(summary.hpEnd || 0),
      comboMax: Number(summary.comboMax || 0),
      telemetryCount: Number(Array.isArray(state?.telemetry) ? state.telemetry.length : 0)
    },

    missions: {
      m1: !!summary.m1SafeStreakDone,
      m2: !!summary.m2AvoidDone,
      m3: !!summary.m3BossDone
    }
  };
}
function buildSessionRow(summary){
  const ctx = buildStandardContext();

  return {
    timestampIso: isoNow(),
    ts: Date.now(),

    ...ctx,

    sessionEndReason: String(summary.endReason || 'unknown'),
    durationPlannedSec: Number(ctx.time || 0),
    durationPlayedSec: Number(summary.durationPlayedSec || 0),

    scoreFinal: Number(summary.score || 0),
    rank: calcRank(summary),
    stars: calcStars(summary),
    perfect: !!summary.perfect,

    stabilityRatio: Number(summary.stabilityRatio || 0),
    avoidRate: Number(summary.avoidRate || 0),
    meanTilt: Number(summary.meanTilt || 0),
    rmsTilt: Number(summary.rmsTilt || 0),
    fatigueIndex: Number(summary.fatigueIndex || 0),
    bestSafeStreak: Number(summary.bestSafeStreak || 0),

    obstaclesAvoided: Number(summary.obstaclesAvoided || 0),
    obstaclesHit: Number(summary.obstaclesHit || 0),
    hpEnd: Number(summary.hpEnd || 0),
    comboMax: Number(summary.comboMax || 0),

    mission1: !!summary.m1SafeStreakDone,
    mission2: !!summary.m2AvoidDone,
    mission3: !!summary.m3BossDone,

    telemetryCount: Number(Array.isArray(state?.telemetry) ? state.telemetry.length : 0)
  };
}
function buildFinalSummary(summary){
  return {
    schemaVersion: GAME_VERSION,
    context: buildStandardContext(),
    session: buildSessionRow(summary),
    lastSummary: buildHHALastSummary(summary),
    telemetry: state?.telemetry || []
  };
}
async function copySummaryText(summary){
  const text = JSON.stringify(summary, null, 2);
  try{
    await navigator.clipboard.writeText(text);
    popText('📋 Copied Summary');
  }catch(e){
    popText('Copy failed', true);
  }
}
function exportSummaryJson(summary){
  const data = buildFinalSummary(summary);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `balance-hold-summary-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    try{ document.body.removeChild(a); }catch(e){}
    URL.revokeObjectURL(url);
  }, 120);
}
function exportTeacherCsv(summary){
  const row = buildSessionRow(summary);
  const keys = Object.keys(row);
  const esc = (v)=>{
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const csv = [
    keys.join(','),
    keys.map(k => esc(row[k])).join(',')
  ].join('\r\n');

  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `balance-hold-teacher-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{
    try{ document.body.removeChild(a); }catch(e){}
    URL.revokeObjectURL(url);
  }, 120);
}
function ensureTeacherCsvButton(){
  const exportPanel = document.getElementById('exportPanel');
  if (!exportPanel) return null;

  let btn = document.getElementById('btnExportTeacherCsv');
  if (btn) return btn;

  const row = exportPanel.querySelector('.row');
  if (!row) return null;

  btn = document.createElement('button');
  btn.id = 'btnExportTeacherCsv';
  btn.className = 'btn';
  btn.type = 'button';
  btn.textContent = '📄 Teacher CSV';
  row.appendChild(btn);
  return btn;
}

/* Cloud */
async function flushCloudLogs(finalSummary){
  if (!state || !state.logEnabled || !state.apiUrl) return false;
  if (state.flushPending) return false;

  state.flushPending = true;
  try{
    const body = {
      source: 'herohealth-balance-hold',
      schemaVersion: GAME_VERSION,
      session: buildSessionRow(finalSummary),
      events: Array.isArray(state.cloudQueue) ? state.cloudQueue.slice() : [],
      lastSummary: buildHHALastSummary(finalSummary)
    };

    const res = await fetch(state.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    });

    if (!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }

    state.cloudQueue = [];
    state.flushPending = false;
    return true;
  }catch(e){
    state.flushPending = false;
    return false;
  }
}
function persistLocalSessionBackup(summary){
  try{
    const key = 'BH_LOCAL_LOG_BACKUP';
    const arr = safeJsonParse(localStorage.getItem(key), []);
    arr.push({
      session: buildSessionRow(summary),
      events: Array.isArray(state?.cloudQueue) ? state.cloudQueue.slice() : [],
      lastSummary: buildHHALastSummary(summary)
    });
    localStorage.setItem(key, JSON.stringify(arr.slice(-20)));
  }catch(e){}
}
function installUnloadFlush(){
  window.addEventListener('beforeunload', ()=>{
    if (!state) return;

    const live = buildLiveSummary();
    if (!live) return;

    try{
      const hha = buildHHALastSummary(live);
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(hha));
    }catch(e){}

    try{
      persistLocalSessionBackup(live);
    }catch(e){}
  });
}

/* Feedback helpers */
function flashHudHp(){
  const el = hudHp?.closest('.chip') || hudHp?.parentElement;
  if (!el) return;
  el.classList.remove('hp-flash');
  void el.offsetWidth;
  el.classList.add('hp-flash');
  setTimeout(()=> el.classList.remove('hp-flash'), 420);
}

function flashComboGlow(){
  const el = hudCombo?.closest('.chip') || hudCombo?.parentElement;
  if (!el) return;
  el.classList.remove('combo-glow');
  void el.offsetWidth;
  el.classList.add('combo-glow');
  setTimeout(()=> el.classList.remove('combo-glow'), 520);
}

function showPerfectCelebration(summary){
  if (!playArea || !summary?.perfect) return;

  const box = document.createElement('div');
  box.className = 'perfect-celebration';
  box.innerHTML = `
    <div class="perfect-title">👑 PERFECT CLEAR</div>
    <div class="perfect-sub">Rank ${calcRank(summary)} • ${starText(calcStars(summary))} • Score ${summary.score}</div>
  `;
  playArea.appendChild(box);
  setTimeout(()=> box.remove(), 2200);
}

function spawnTelegraph(xNorm, kind, impactDelay, forceBoss=false){
  if (!playArea) return;
  const wrapRect = playArea.getBoundingClientRect();
  const pxX = wrapRect ? (wrapRect.width / 2 + xNorm * (wrapRect.width * 0.32)) : 0;

  const ring = document.createElement('div');
  ring.className = `telegraph telegraph-${kind}${forceBoss ? ' boss' : ''}`;
  ring.style.left = `${pxX}px`;
  ring.style.top = forceBoss ? '24%' : '30%';
  playArea.appendChild(ring);

  const life = Math.max(220, impactDelay - 60);
  setTimeout(()=>{ try{ ring.remove(); }catch(e){} }, life);
}

/* Boss */
function bossDirectorTick(now, stage, cfg){
  if (!state) return;

  if (stage === 'Boss' && state.boss.lastStage !== 'Boss'){
    state.boss.active = true;
    state.boss.waveIndex = 0;
    state.boss.nextWaveAt = now + 450;
    showCoach('boss');
    popText('⚡ Boss Phase!');
    sfxBoss();
    pushTelemetry('boss_enter', {});
  }
  state.boss.lastStage = stage;

  if (!state.boss.active || stage !== 'Boss') return;

  const gap = clamp(
    2100 * (cfg.safeHalf <= 0.16 ? 0.82 : 1.0),
    1200,
    2500
  );

  if (now >= state.boss.nextWaveAt){
    spawnBossWave(now, cfg, state.boss.waveIndex++);
    state.boss.nextWaveAt = now + gap;
  }
}
function spawnBossWave(now, cfg, waveIndex){
  const mode = waveIndex % 4;

  if (mode === 0){
    popText(`⚡ Sweep ${Math.floor(waveIndex/4)+1}`);
    const steps = [-0.88,-0.55,-0.20,0.20,0.55,0.88];
    steps.forEach((xNorm, i)=>{
      setTimeout(()=>{
        if(state) spawnObstacle(nowMs(), cfg, {
          kind:'shock',
          xNorm,
          impactDelay: 620,
          forceBoss:true
        });
      }, i * 110);
    });
    setTimeout(()=>{ if(state) state.biasDir *= -1; }, 720);
    return;
  }

  if (mode === 1){
    popText('🎯 Fake Middle');
    setTimeout(()=>{
      if(state) spawnObstacle(nowMs(), cfg, { kind:'bomb', xNorm:0.00, impactDelay:720, forceBoss:true });
    }, 0);
    setTimeout(()=>{
      if(state) spawnObstacle(nowMs(), cfg, { kind:'shock', xNorm:-0.72, impactDelay:620, forceBoss:true });
    }, 180);
    setTimeout(()=>{
      if(state) spawnObstacle(nowMs(), cfg, { kind:'shock', xNorm: 0.72, impactDelay:620, forceBoss:true });
    }, 360);
    return;
  }

  if (mode === 2){
    popText('🔁 Crush');
    const arr = [-0.82, 0.82, -0.74, 0.74];
    arr.forEach((xNorm, i)=>{
      setTimeout(()=>{
        if(state) spawnObstacle(nowMs(), cfg, {
          kind: i % 2 === 0 ? 'bomb' : 'shock',
          xNorm,
          impactDelay: 640,
          forceBoss:true
        });
      }, i * 180);
    });
    return;
  }

  popText(`⚡ Wave ${waveIndex+1}`);
  const arr = [-0.84, 0.00, 0.84];
  [0,140,280].forEach((off,i)=>{
    setTimeout(()=>{
      if(state) spawnObstacle(nowMs(), cfg, {
        kind: i === 1 ? 'bomb' : 'shock',
        xNorm: arr[i],
        impactDelay: 640,
        forceBoss:true
      });
    }, off);
  });
}

/* Shield */
function spawnShield(now){
  if (!state) return;
  ensureObstacleLayer();
  if (!obstacleLayer || !playArea) return;

  const wrapRect = playArea.getBoundingClientRect();
  const xNorm = (rng()*2 - 1);
  const pxX = wrapRect.width/2 + xNorm*(wrapRect.width*0.30);

  const el = document.createElement('div');
  el.className = 'obstacle';
  el.textContent = '🛡️';
  el.style.top = '14%';
  el.style.left = pxX+'px';
  el.style.fontSize = '30px';
  obstacleLayer.appendChild(el);

  const pickupAt = now + 900;
  setTimeout(()=>{
    if (!state){ try{el.remove();}catch{} return; }

    const inSafe = Math.abs(state.angle) <= (state.stageCfg?.safeHalf ?? state.baseCfg.safeHalf);
    if (inSafe){
      state.shield = Math.min(2, (state.shield||0) + 1);
      state.score += 40;
      popText('🛡️ Shield +1');
      sfxShield();
      pushTelemetry('shield_pickup', { shield: state.shield });
    }else{
      popText('🛡️ Missed', true);
    }
    try{ el.remove(); }catch{}
  }, Math.max(0, pickupAt - nowMs()));

  setTimeout(()=>{ try{ el.remove(); }catch{} }, 1400);
}

/* Start */
function startPlay(){
  const diffKey = (elDiffSel?.value || qs('diff','normal')).toLowerCase();
  const durSec  = parseInt(elDurSel?.value || qs('time','80'),10) || 80;
  const baseCfg = pickDiff(diffKey);

  const isMobileView = String(qs('view','')).toLowerCase() === 'mobile';
  if (isMobileView){
    if (diffKey === 'easy') baseCfg.safeHalf *= 0.98;
    if (diffKey === 'normal') baseCfg.safeHalf *= 0.94;
    if (diffKey === 'hard') baseCfg.safeHalf *= 0.92;
  }

  const seed = String(qs('seed','')) || String(Date.now());
  const pid  = String(qs('pid','anon')).trim() || 'anon';
  rng = makeRng(`${seed}|${pid}|${diffKey}|${durSec}`);

  ensureObstacleLayer();

  const now = nowMs();
  state = {
    baseCfg,
    durationMs: durSec*1000,
    startTime: now,
    lastFrame: now,
    elapsed: 0,

    angle: 0,
    targetAngle: 0,
    lastInputAt: now,
    idlePressure: 0,
    lastMoveDir: 0,
    dangerMs: 0,
    lastPenaltyAt: 0,
    recoveryUntil: 0,
    diffKey,

    biasDir: (rng()<0.5 ? -1 : 1),
    nextBiasFlipAt: now + randBetween(rng, 1600, 3600),

    nextObstacleAt: now + randBetween(rng, baseCfg.disturbMinMs, baseCfg.disturbMaxMs),
    obstacleSeq: 1,
    obstaclesTotal: 0,
    obstaclesAvoided: 0,
    obstaclesHit: 0,

    sampleEveryMs: 110,
    nextSampleAt: now + 110,
    totalSamples: 0,
    stableSamples: 0,
    sumTiltAbs: 0,
    sumTiltSq: 0,
    samples: [],

    hp: baseCfg.hp || 3,
    shield: 0,
    nextShieldAt: now + 9000,

    score: 0,
    combo: 0,
    comboMax: 0,
    stableStreak: 0,
    bestSafeStreak: 0,
    hasSeenObstacle: false,

    stageCfg: baseCfg,
    boss: { active:false, nextWaveAt:0, waveIndex:0, lastStage:'Warm' },

    missions: {
      m1SafeStreakDone: false,
      m2AvoidDone: false,
      m3BossDone: false
    },

    paused: false,
    pauseStartedAt: 0,
    tutorialUntil: now + 10000,
    tutorialStep: 0,
    audioUnlocked: false,

    telemetry: [],
    startedAtIso: new Date().toISOString(),

    sessionId: makeSessionId(),
    logEnabled: qbool('log', false),
    apiUrl: String(qs('api','')).trim(),
    flushPending: false,
    cloudQueue: []
  };

  pushTelemetry('start', {
    diff: diffKey,
    durationSec: durSec,
    pid: String(qs('pid','anon')),
    seed: String(qs('seed',''))
  });

  if (hudMode)  hudMode.textContent = 'Play';
  if (hudDiff)  hudDiff.textContent = diffKey;
  if (hudDur)   hudDur.textContent  = String(durSec);
  if (hudTime)  hudTime.textContent = durSec.toFixed(1);
  if (hudStab)  hudStab.textContent = '0%';
  if (hudObs)   hudObs.textContent  = '0 / 0';
  if (hudScore) hudScore.textContent= '0';
  if (hudCombo) hudCombo.textContent= '0';
  if (hudHp)    hudHp.textContent   = String(state.hp);
  if (hudStage) hudStage.textContent= 'Warm';
  if (hudRt)    hudRt.textContent   = '-';

  if (coachLabel) coachLabel.textContent = 'ลากซ้าย–ขวาเพื่อคุมสมดุล / Drag left–right to balance';
  if (coachBubble) coachBubble.classList.add('hidden');
  lastCoachAt = 0;
  showCoach('welcome');

  ensureMissionHud();
  updateMissionHud();
  ensureGoalHud();
  updateGoalHud();

  if (btnPause) btnPause.textContent = '⏸ Pause';
  showHelpOverlay(false);
  showDebugPanel(false);
  updateDebugReadout();
  showTeacherPanel(false);

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
  showView('play');
}

/* Loop */
function loop(now){
  if (!state) return;

  if (state.paused){
    rafId = requestAnimationFrame(loop);
    return;
  }

  const dt = Math.max(0, now - state.lastFrame);
  state.lastFrame = now;

  state.elapsed = now - state.startTime;
  const remainMs = Math.max(0, state.durationMs - state.elapsed);
  if (hudTime) hudTime.textContent = (remainMs/1000).toFixed(1);

  updateTutorial(now);

  if (state.elapsed >= state.durationMs){
    stopGame('timeout');
    return;
  }

  const tNorm = state.durationMs ? (state.elapsed/state.durationMs) : 0;
  const stage = stageFrom(tNorm);
  if (hudStage) hudStage.textContent = stage;

  if (stage === 'Boss' && !state.missions.m3BossDone && state.elapsed >= state.durationMs * 0.82){
    state.missions.m3BossDone = true;
    popText('✅ Mission 3');
    pushTelemetry('mission_complete', { mission:'m3' });
  }

  const idleMs = now - (state.lastInputAt || state.startTime);
  const idleBoost = idleMs > 900 ? clamp01((idleMs - 900) / 1800) : 0;

  if (now >= state.nextBiasFlipAt){
    state.biasDir *= -1;
    state.nextBiasFlipAt = now + randBetween(rng, 1200, 3000);
  }

  const cfg = stageCfg(state.baseCfg, stage, idleBoost);
  state.stageCfg = cfg;

  bossDirectorTick(now, stage, cfg);

  if (now >= (state.nextShieldAt || 0)){
    spawnShield(now);
    const base = (stage === 'Warm') ? 10000 : (stage === 'Trick' ? 7600 : 5200);
    state.nextShieldAt = now + randBetween(rng, base * 0.85, base * 1.15);
  }

  if (idleBoost > 0){
    state.idlePressure = clamp((state.idlePressure || 0) + 0.012 * idleBoost, 0, 0.22);
  }else{
    state.idlePressure = clamp((state.idlePressure || 0) - 0.018, 0, 0.22);
  }

  const antiIdlePush =
    state.biasDir *
    (cfg.passiveDrift + (state.idlePressure || 0)) *
    (dt / 1000);

  const centerEscape = (Math.abs(state.angle) < 0.10 && idleBoost > 0.35)
    ? state.biasDir * 0.055
    : 0;

  const inRecovery = now < (state.recoveryUntil || 0);
  const recoveryPush = inRecovery ? state.biasDir * 0.06 : 0;

  const target = state.targetAngle + antiIdlePush + centerEscape + recoveryPush;

  const lerp = (stage === 'Warm') ? 0.12 : (stage === 'Trick' ? 0.13 : 0.14);
  const effectiveLerp =
    lerp *
    (idleBoost > 0.5 ? 0.90 : 1.0) *
    (inRecovery ? 0.88 : 1.0);

  state.angle += (target - state.angle) * effectiveLerp;

  state.angle = clamp(state.angle, -1.25, 1.25);
  state.targetAngle = clamp(state.targetAngle, -1, 1);

  if (Math.abs(state.angle) >= 0.92){
    state.dangerMs = (state.dangerMs || 0) + dt;
  }else{
    state.dangerMs = Math.max(0, (state.dangerMs || 0) - dt * 1.5);
  }

  if (state.dangerMs >= dangerThresholdMs(state.diffKey || 'normal')){
    state.hp = Math.max(0, (state.hp || 0) - 1);
    state.dangerMs = 0;
    state.recoveryUntil = now + recoveryDurationMs(state.diffKey || 'normal');
    popText('⚠ Off-Balance!', true);
    shakePlay();
    sfxHit();
    flashHudHp();

    if (hudHp) hudHp.textContent = `${state.hp}${(state.shield > 0) ? ` • 🛡️${state.shield}` : ''}`;

    if (state.hp <= 0){
      stopGame('fail');
      return;
    }
  }

  updateVisuals();

  if (now >= state.nextSampleAt){
    const inSafe = Math.abs(state.angle) <= cfg.safeHalf;

    state.totalSamples++;
    if (inSafe) state.stableSamples++;

    const absTilt = Math.abs(state.angle);
    state.sumTiltAbs += absTilt;
    state.sumTiltSq  += absTilt*absTilt;
    state.samples.push({tNorm, tilt:absTilt});

    if (!state.hasSeenObstacle){
      if (inSafe) state.score += 1;
      if (idleBoost > 0.7) state.score = Math.max(0, state.score - 2);
      state.combo = 0;
      state.stableStreak = 0;
    }else{
      if (inSafe){
        state.stableStreak++;
        state.bestSafeStreak = Math.max(state.bestSafeStreak || 0, state.stableStreak || 0);

        if (!state.missions.m1SafeStreakDone && (state.stableStreak || 0) >= 20){
          state.missions.m1SafeStreakDone = true;
          popText('✅ Mission 1');
          pushTelemetry('mission_complete', { mission:'m1' });
        }

        if (state.stableStreak % 5 === 0){
          state.combo = Math.min(99, state.combo + 1);
          state.comboMax = Math.max(state.comboMax, state.combo);

          const mul = (stage==='Warm') ? 1.0 : (stage==='Trick' ? 1.30 : 1.68);
          state.score += Math.round(14 * mul + state.combo * 3);

          if (state.combo === 5)  popText('🔥 Combo x5');
          if (state.combo === 10) popText('✨ Steady x10');
          if (state.combo === 15) popText('⚖️ Balance Master');
          flashComboGlow();
        }
      }else{
        state.stableStreak = 0;
        state.combo = Math.max(0, state.combo - 1);
      }
    }

    if (idleBoost > 0.75){
      state.combo = Math.max(0, (state.combo || 0) - 1);
      if (!state.lastPenaltyAt || (now - state.lastPenaltyAt) >= 220){
        state.score = Math.max(0, (state.score || 0) - 3);
        state.lastPenaltyAt = now;
      }
    }

    const stabRatio = state.totalSamples ? state.stableSamples / state.totalSamples : 0;
    if (hudStab)  hudStab.textContent = fmtPercent(stabRatio);
    if (hudScore) hudScore.textContent = String(state.score);
    if (hudCombo) hudCombo.textContent = String(state.combo);
    if (hudHp)    hudHp.textContent = `${state.hp}${(state.shield > 0) ? ` • 🛡️${state.shield}` : ''}`;

    if (absTilt > 0.60 && stage !== 'Warm') showCoach('drift');

    state.nextSampleAt = now + state.sampleEveryMs;
  }

  if (now >= state.nextObstacleAt){
    spawnObstacle(now, cfg, null);
  }

  updateMissionHud();
  updateGoalHud();

  if (!debugPanel?.classList.contains('hidden')){
    updateDebugReadout();
  }
  if (!teacherPanel?.classList.contains('hidden')){
    updateTeacherPanel();
  }

  rafId = requestAnimationFrame(loop);
}

/* Visuals */
function updateVisuals(){
  if (!platformEl || !indicatorEl || !state) return;

  const maxDeg = 18;
  platformEl.style.transform = `rotate(${(state.angle*maxDeg).toFixed(3)}deg)`;

  const wrapRect = platformWrap?.getBoundingClientRect();
  if (wrapRect){
    const halfW = wrapRect.width * 0.34;
    indicatorEl.style.transform = `translateX(${(state.angle*halfW).toFixed(2)}px) translateY(-18px)`;
  }

  if (hudObs){
    hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
  }
}

/* Obstacle */
function spawnObstacle(now, cfg, opt){
  ensureObstacleLayer();
  if (!state || !obstacleLayer) return;

  opt = opt || {};
  state.obstacleSeq++;
  state.obstaclesTotal++;
  state.hasSeenObstacle = true;

  const kind = opt.kind || ((rng() < 0.58) ? 'gust' : (rng() < 0.86 ? 'bomb' : 'shock'));
  const emoji = (kind === 'gust') ? '💨' : (kind === 'bomb' ? '💣' : '⚡');

  const span = document.createElement('div');
  span.className = 'obstacle';
  span.textContent = emoji;
  span.style.top = (opt.forceBoss ? '7%' : '16%');

  const size =
    kind === 'shock' ? (opt.forceBoss ? 42 : 36) :
    kind === 'bomb'  ? 34 : 32;

  span.style.fontSize = size + 'px';
  span.style.opacity = '0.98';
  span.style.filter = kind === 'shock'
    ? 'drop-shadow(0 0 18px rgba(245,158,11,.45)) drop-shadow(0 10px 20px rgba(0,0,0,.55))'
    : kind === 'bomb'
      ? 'drop-shadow(0 0 14px rgba(239,68,68,.30)) drop-shadow(0 10px 20px rgba(0,0,0,.55))'
      : 'drop-shadow(0 0 12px rgba(34,211,238,.26)) drop-shadow(0 10px 20px rgba(0,0,0,.55))';

  const wrapRect = playArea?.getBoundingClientRect();
  const xNorm = (typeof opt.xNorm === 'number') ? opt.xNorm : (rng() * 2 - 1);
  const pxX = wrapRect ? (wrapRect.width / 2 + xNorm * (wrapRect.width * 0.32)) : 0;
  span.style.left = pxX + 'px';

  obstacleLayer.appendChild(span);
  setTimeout(()=> span.remove(), 1600);

  const impactDelay = opt.impactDelay || ((kind === 'shock') ? 700 : (kind === 'bomb' ? 840 : 900));
  spawnTelegraph(xNorm, kind, impactDelay, !!opt.forceBoss);

  const preKick =
    kind === 'gust'  ? 0.075 :
    kind === 'bomb'  ? 0.120 :
                       0.150;

  const preKickDelay = Math.max(120, impactDelay - 260);
  setTimeout(()=>{
    if (!state) return;

    const dirFromSpawn = (xNorm >= 0 ? 1 : -1);
    state.angle += dirFromSpawn * preKick;
  }, preKickDelay);

  const impactAt = now + impactDelay;

  setTimeout(()=>{
    if (!state) return;

    const inSafe = Math.abs(state.angle) <= cfg.safeHalf;

    if (inSafe){
      state.obstaclesAvoided++;
      state.score += (kind === 'shock' ? 30 : 18);
      state.combo = Math.min(99, state.combo + 1);
      state.comboMax = Math.max(state.comboMax, state.combo);
      span.classList.add('avoid');

      popText(kind === 'shock' ? '+Perfect Avoid' : '+Avoid');
      if (kind === 'shock') flashComboGlow();
      sfxAvoid();
      pushTelemetry('avoid', { kind, score: state.score, hp: state.hp });

      if (!state.missions.m2AvoidDone && (state.obstaclesAvoided || 0) >= 6){
        state.missions.m2AvoidDone = true;
        popText('✅ Mission 2');
        pushTelemetry('mission_complete', { mission:'m2' });
      }
    }else{
      if ((state.shield || 0) > 0){
        state.shield -= 1;
        state.obstaclesAvoided++;
        span.classList.add('avoid');

        popText('🛡️ Block!');
        shakePlay();
        sfxShield();
        pushTelemetry('shield_block', { kind, shield: state.shield, hp: state.hp });

        if (hudHp) hudHp.textContent = `${state.hp}${(state.shield > 0) ? ` • 🛡️${state.shield}` : ''}`;
        if (hudObs) hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
        return;
      }

      if ((state.combo || 0) >= 5){
        popText('💥 Combo Break', true);
      }

      state.obstaclesHit++;
      state.hp = Math.max(0, (state.hp || 0) - 1);
      state.score = Math.max(0, state.score - (
        kind === 'shock' ? 88 :
        kind === 'bomb'  ? 64 :
                           40
      ));
      state.combo = Math.max(0, state.combo - 3);
      state.stableStreak = 0;

      const knockBase = cfg.disturbStrength * (
        kind === 'gust'  ? 0.92 :
        kind === 'bomb'  ? 1.45 :
                           1.95
      );
      const knockDir = (state.angle >= 0 ? 1 : -1);
      state.angle += knockDir * knockBase;
      state.recoveryUntil = nowMs() + recoveryDurationMs(state.diffKey || 'normal');

      span.classList.add('hit');
      showCoach('hit');
      popText(kind === 'shock' ? '-HP ⚡' : '-HP', true);
      shakePlay();
      sfxHit();
      flashHudHp();
      pushTelemetry('hit', { kind, score: state.score, hp: state.hp });

      if (state.hp <= 0){
        stopGame('fail');
        return;
      }
    }

    if (hudObs)   hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
    if (hudScore) hudScore.textContent = String(state.score);
    if (hudCombo) hudCombo.textContent = String(state.combo);
    if (hudHp)    hudHp.textContent = `${state.hp}${(state.shield > 0) ? ` • 🛡️${state.shield}` : ''}`;
  }, Math.max(0, impactAt - nowMs()));

  state.nextObstacleAt = now + randBetween(rng, cfg.disturbMinMs, cfg.disturbMaxMs);
}

/* Analytics */
function computeAnalytics(){
  if (!state || !state.totalSamples){
    return { stabilityRatio:0, meanTilt:0, rmsTilt:0, fatigueIndex:0, samples:0 };
  }
  const n = state.totalSamples;
  const stabRatio = state.stableSamples / n;
  const meanTilt  = state.sumTiltAbs / n;
  const rmsTilt   = Math.sqrt(state.sumTiltSq / n);

  let fatigue = 0;
  if (state.samples.length>=10){
    const arr = state.samples;
    const seg = Math.max(3, Math.floor(arr.length*0.25));
    const early = arr.slice(0, seg);
    const late  = arr.slice(-seg);
    const mE = early.reduce((a,b)=>a+b.tilt,0)/early.length;
    const mL = late.reduce((a,b)=>a+b.tilt,0)/late.length;
    if (mE>0) fatigue = (mL-mE)/mE;
  }
  return { stabilityRatio:stabRatio, meanTilt, rmsTilt, fatigueIndex:fatigue, samples:n };
}

/* Stop */
function stopGame(endedBy){
  if (!state) return;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  const a = computeAnalytics();
  const totalObs = state.obstaclesAvoided + state.obstaclesHit;
  const avoidRate = totalObs ? (state.obstaclesAvoided/totalObs) : 0;

  const summary = {
    endReason: endedBy || 'unknown',
    durationPlayedSec: Math.round((state.elapsed || 0) / 1000),

    stabilityRatio: a.stabilityRatio || 0,
    meanTilt: a.meanTilt || 0,
    rmsTilt: a.rmsTilt || 0,
    fatigueIndex: a.fatigueIndex || 0,
    samples: a.samples || 0,

    obstaclesAvoided: state.obstaclesAvoided || 0,
    obstaclesHit: state.obstaclesHit || 0,
    avoidRate: avoidRate || 0,

    score: state.score || 0,
    comboMax: state.comboMax || 0,
    hpEnd: state.hp || 0,

    m1SafeStreakDone: !!state.missions?.m1SafeStreakDone,
    m2AvoidDone: !!state.missions?.m2AvoidDone,
    m3BossDone: !!state.missions?.m3BossDone,
    bestSafeStreak: state.bestSafeStreak || 0,

    perfect: false
  };

  summary.perfect = calcPerfect(summary);

  const hhaLastSummary = buildHHALastSummary(summary);
  __lastBalanceSummary = summary;
  pushTelemetry('end', {
    rank: calcRank(summary),
    stars: calcStars(summary),
    perfect: !!summary.perfect,
    score: summary.score
  });

  if (resMode) resMode.textContent = 'Play';
  if (resDiff) resDiff.textContent = (elDiffSel?.value || qs('diff','normal') || '-');
  if (resDur)  resDur.textContent  = String((state.durationMs/1000) || '-');
  if (resEnd)  resEnd.textContent  = mapEndReason(endedBy);

  if (resStab)     resStab.textContent     = fmtPercent(a.stabilityRatio || 0);
  if (resMeanTilt) resMeanTilt.textContent = fmtFloat(a.meanTilt || 0,3);
  if (resRmsTilt)  resRmsTilt.textContent  = fmtFloat(a.rmsTilt || 0,3);

  if (resAvoid) resAvoid.textContent = String(state.obstaclesAvoided || 0);
  if (resHit)   resHit.textContent   = String(state.obstaclesHit || 0);
  if (resAvoidRate) resAvoidRate.textContent = fmtPercent(avoidRate);

  if (resFatigue) resFatigue.textContent = fmtFloat(a.fatigueIndex || 0,3);
  if (resSamples) resSamples.textContent = String(a.samples || 0);

  setResultHero(summary);
  showPerfectCelebration(summary);
  ensureExtraResultRows(summary);
  wireEndActions(summary);

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(hhaLastSummary));
  }catch(e){}

  persistLocalSessionBackup(summary);
  flushCloudLogs(summary);

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
      ...hhaLastSummary,
      telemetryCount: Array.isArray(state?.telemetry) ? state.telemetry.length : 0
    }));
  }catch(e){}

  const endRank = calcRank(summary);
  const endStars = calcStars(summary);
  popText(summary.perfect
    ? `👑 PERFECT • ${endRank} • ${summary.score}`
    : `Rank ${endRank} • ${starText(endStars)} • Score ${summary.score}`
  );

  updateTeacherPanel();
  showHelpOverlay(false);
  if (btnPause) btnPause.textContent = '⏸ Pause';
  const tut = document.getElementById('tutorialBanner');
  if (tut) tut.remove();
  showDebugPanel(false);
  updateDebugReadout();

  state = null;
  showView('result');
}

/* Input */
function attachInput(){
  if (!playArea) return;
  let active=false;

  function updateTargetFromEvent(ev){
    if (!state) return;

    const rect = playArea.getBoundingClientRect();
    const x = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX);
    if (x == null) return;

    const prev = state.targetAngle || 0;
    const relX = (x - rect.left) / rect.width;
    state.targetAngle = clamp((relX - 0.5) * 2, -1, 1);

    state.lastMoveDir =
      state.targetAngle > prev ? 1 :
      state.targetAngle < prev ? -1 :
      (state.lastMoveDir || 0);

    state.lastInputAt = nowMs();
  }

  playArea.addEventListener('pointerdown', ev=>{
    active=true;
    try{ playArea.setPointerCapture(ev.pointerId); }catch(e){}
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointermove', ev=>{
    if(!active) return;
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointerup', ev=>{
    active=false;
    try{ playArea.releasePointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault();
  }, {passive:false});

  playArea.addEventListener('pointercancel', ev=>{
    active=false;
    ev.preventDefault();
  }, {passive:false});
}

/* Init */
function init(){
  $('[data-action="start-normal"]')?.addEventListener('click',()=> startPlay());
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click',()=> showView('menu')));
  $('[data-action="stop"]')?.addEventListener('click',()=>{ if(state) stopGame('manual'); });
  $('[data-action="play-again"]')?.addEventListener('click',()=> showView('menu'));

  const qDiff = String(qs('diff','')).toLowerCase();
  const qTime = String(qs('time','')).trim();
  if (elDiffSel && ['easy','normal','hard'].includes(qDiff)) elDiffSel.value = qDiff;
  if (elDurSel && qTime) elDurSel.value = qTime;

  const hub = String(qs('hub','')).trim();
  if (hub && btnBackHubMenu){
    btnBackHubMenu.style.display = '';
    btnBackHubMenu.onclick = ()=> location.href = hub;
  }

  attachInput();
  installUnloadFlush();

  btnPause?.addEventListener('click', ()=>{
    if (!state) return;
    setPaused(!state.paused);
    if (btnPause) btnPause.textContent = state.paused ? '▶ Resume' : '⏸ Pause';
  });

  btnHelp?.addEventListener('click', ()=>{
    if (!state) return;
    setPaused(true);
    if (btnPause) btnPause.textContent = '▶ Resume';
  });

  btnHelpResume?.addEventListener('click', ()=>{
    if (!state) return;
    setPaused(false);
    if (btnPause) btnPause.textContent = '⏸ Pause';
  });

  btnHelpClose?.addEventListener('click', ()=>{
    if (!state) return;
    setPaused(false);
    if (btnPause) btnPause.textContent = '⏸ Pause';
  });

  btnDebug?.addEventListener('click', ()=>{
    if (!state && viewPlay?.classList.contains('hidden')) return;
    const willShow = debugPanel?.classList.contains('hidden');
    showDebugPanel(willShow);
    updateDebugReadout();
  });

  btnDebugClose?.addEventListener('click', ()=> showDebugPanel(false));

  dbgSpawnGust?.addEventListener('click', ()=>{
    if (!state) return;
    spawnObstacle(nowMs(), state.stageCfg || state.baseCfg, { kind:'gust' });
    updateDebugReadout();
  });
  dbgSpawnBomb?.addEventListener('click', ()=>{
    if (!state) return;
    spawnObstacle(nowMs(), state.stageCfg || state.baseCfg, { kind:'bomb' });
    updateDebugReadout();
  });
  dbgSpawnShock?.addEventListener('click', ()=>{
    if (!state) return;
    spawnObstacle(nowMs(), state.stageCfg || state.baseCfg, { kind:'shock' });
    updateDebugReadout();
  });
  dbgBossWave?.addEventListener('click', ()=>{
    if (!state) return;
    spawnBossWave(nowMs(), state.stageCfg || state.baseCfg, state.boss?.waveIndex || 0);
    if (state.boss) state.boss.waveIndex = (state.boss.waveIndex || 0) + 1;
    updateDebugReadout();
  });
  dbgAddShield?.addEventListener('click', ()=>{
    if (!state) return;
    state.shield = Math.min(3, (state.shield || 0) + 1);
    popText('🛡️ Debug Shield');
    sfxShield();
    refreshHudNow();
  });
  dbgHpUp?.addEventListener('click', ()=>{
    if (!state) return;
    state.hp = Math.min(5, (state.hp || 0) + 1);
    refreshHudNow();
  });
  dbgHpDown?.addEventListener('click', ()=>{
    if (!state) return;
    state.hp = Math.max(0, (state.hp || 0) - 1);
    if (state.hp <= 0){
      stopGame('fail');
      return;
    }
    refreshHudNow();
  });
  dbgScoreUp?.addEventListener('click', ()=>{
    if (!state) return;
    state.score = (state.score || 0) + 200;
    popText('+200 Debug');
    refreshHudNow();
  });
  dbgGotoTrick?.addEventListener('click', ()=>{
    if (!state) return;
    setStageProgress(0.52);
    popText('⏩ Trick');
    refreshHudNow();
  });
  dbgGotoBoss?.addEventListener('click', ()=>{
    if (!state) return;
    setStageProgress(0.82);
    popText('👑 Boss');
    refreshHudNow();
  });
  dbgToggleTutorial?.addEventListener('click', ()=>{
    if (!state) return;
    const tut = document.getElementById('tutorialBanner');
    if (tut){
      tut.remove();
      state.tutorialUntil = nowMs() - 1;
      popText('Tutorial Off');
    }else{
      state.tutorialUntil = nowMs() + 10000;
      popText('Tutorial On');
    }
    updateDebugReadout();
  });
  dbgSnapshot?.addEventListener('click', ()=>{
    updateDebugReadout();
    popText('📋 Snapshot Ready');
  });

  btnCopySummary?.addEventListener('click', ()=>{
    if (!__lastBalanceSummary) return;
    copySummaryText(buildFinalSummary(__lastBalanceSummary));
  });

  btnExportJson?.addEventListener('click', ()=>{
    if (!__lastBalanceSummary) return;
    exportSummaryJson(__lastBalanceSummary);
  });

  btnTeacherToggle?.addEventListener('click', ()=>{
    const willShow = teacherPanel?.classList.contains('hidden');
    showTeacherPanel(willShow);
    updateTeacherPanel();
  });

  btnTeacherClose?.addEventListener('click', ()=> showTeacherPanel(false));

  const btnExportTeacherCsv = ensureTeacherCsvButton();
  btnExportTeacherCsv?.addEventListener('click', ()=>{
    if (!__lastBalanceSummary) return;
    exportTeacherCsv(__lastBalanceSummary);
  });

  const a = String(qs('autostart',''));
  if (a === '1'){
    setTimeout(()=> startPlay(), 60);
    return;
  }

  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);