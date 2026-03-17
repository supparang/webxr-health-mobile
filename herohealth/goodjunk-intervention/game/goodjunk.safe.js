'use strict';

const WIN = window;
const DOC = document;

function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(_){ return d; }
}

function safeNum(v, d=0){
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}

function clamp(v,a,b){
  v = safeNum(v, a);
  return Math.max(a, Math.min(b, v));
}

function pct(num, den, d=0){
  num = safeNum(num, 0);
  den = safeNum(den, 0);
  if(den <= 0) return d;
  return +((num / den) * 100).toFixed(2);
}

function nowMs(){
  return (performance && performance.now) ? performance.now() : Date.now();
}

function nowIso(){
  return new Date().toISOString();
}

function safeUrl(raw, fallback=''){
  try{
    if(!raw) return fallback;
    return new URL(raw, location.href).toString();
  }catch(_){
    return fallback;
  }
}

function median(arr){
  const xs = Array.isArray(arr) ? arr.filter(Number.isFinite) : [];
  if(!xs.length) return 0;
  xs.sort((a,b)=>a-b);
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : Math.round((xs[m-1] + xs[m]) / 2);
}

function pick(arr){
  if(!Array.isArray(arr) || !arr.length) return '';
  return arr[(Math.random() * arr.length) | 0];
}

/* -------------------------------------------------------
 * Context / config
 * ----------------------------------------------------- */
const CTX = {
  projectTag: qs('projectTag', 'herohealth-goodjunk-intervention'),
  studyId: qs('studyId', ''),
  phase: qs('phase', ''),
  conditionGroup: qs('conditionGroup', ''),
  sessionOrder: qs('sessionOrder', ''),
  blockLabel: qs('blockLabel', ''),
  sessionId: qs('sessionId', `gjint-${qs('studentKey','anon')}-${Date.now()}`),

  studentKey: qs('studentKey', 'anon'),
  schoolCode: qs('schoolCode', ''),
  schoolName: qs('schoolName', ''),
  classRoom: qs('classRoom', ''),
  studentNo: qs('studentNo', ''),
  nickName: qs('nickName', qs('studentKey', 'anon')),
  gradeLevel: qs('gradeLevel', ''),
  gender: qs('gender', ''),
  age: qs('age', ''),

  run: qs('run', 'play'),
  diff: qs('diff', 'easy'),
  view: qs('view', 'mobile'),
  time: clamp(qs('time', '80'), 30, 180),
  seed: qs('seed', String(Date.now())),
  kid: qs('kid', '1') === '1',
  readable: qs('readable', '1') === '1',
  hub: safeUrl(qs('hub', '../../hub.html'), '../../hub.html')
};

const GAME_VERSION = 'goodjunk-intervention-starter-v1';
const GAME_KEY = 'goodjunk-intervention';

const GOOD = ['🍎','🍌','🥦','🥬','🥕','🍉','🍊','🥒','🥛','🥚'];
const JUNK = ['🍟','🍔','🍕','🍩','🍫','🧋','🥤','🍬'];
const BONUS = ['⭐','💎'];
const SHIELD = ['🛡️'];

/* -------------------------------------------------------
 * DOM refs
 * ----------------------------------------------------- */
const EL = {
  layer: DOC.getElementById('gj-layer'),

  hudScore: DOC.getElementById('hud-score'),
  hudTime: DOC.getElementById('hud-time'),
  hudMiss: DOC.getElementById('hud-miss'),
  hudGrade: DOC.getElementById('hud-grade'),
  hudGoal: DOC.getElementById('hud-goal'),
  hudGoalCur: DOC.getElementById('hud-goal-cur'),
  hudGoalTarget: DOC.getElementById('hud-goal-target'),
  goalDesc: DOC.getElementById('goalDesc'),

  hudMini: DOC.getElementById('hud-mini'),
  miniTimer: DOC.getElementById('miniTimer'),

  missionBox: DOC.getElementById('missionBox'),
  missionTitle: DOC.getElementById('missionTitle'),
  missionGoal: DOC.getElementById('missionGoal'),
  missionHint: DOC.getElementById('missionHint'),
  missionFill: DOC.getElementById('missionFill'),

  aiBox: DOC.getElementById('aiBox'),
  coachInline: DOC.getElementById('coachInline'),
  coachExplain: DOC.getElementById('coachExplain'),
  aiRisk: DOC.getElementById('aiRisk'),
  aiHint: DOC.getElementById('aiHint'),

  bossBar: DOC.getElementById('bossBar'),
  bossFill: DOC.getElementById('bossFill'),
  bossHint: DOC.getElementById('bossHint'),

  stageBanner: DOC.getElementById('stageBanner'),
  stageBannerBig: DOC.getElementById('stageBannerBig'),
  stageBannerSmall: DOC.getElementById('stageBannerSmall'),
  milestoneBanner: DOC.getElementById('milestoneBanner'),
  dangerOverlay: DOC.getElementById('dangerOverlay'),

  endOverlay: DOC.getElementById('endOverlay'),
  endTitle: DOC.getElementById('endTitle'),
  endSub: DOC.getElementById('endSub'),
  endGrade: DOC.getElementById('endGrade'),
  endScore: DOC.getElementById('endScore'),
  endMiss: DOC.getElementById('endMiss'),
  endTime: DOC.getElementById('endTime'),
  endDecision: DOC.getElementById('endDecision'),

  nutritionExplainBody: DOC.getElementById('nutritionExplainBody'),
  reflectionBody: DOC.getElementById('reflectionBody'),
  reflectionBullets: DOC.getElementById('reflectionBullets'),
  takeHomeMissionBody: DOC.getElementById('takeHomeMissionBody'),

  btnReplay: DOC.getElementById('btnReplay'),
  btnBackHub: DOC.getElementById('btnBackHub'),
  btnEndBackHub: DOC.getElementById('btnEndBackHub')
};

if(!EL.layer){
  console.warn('[GoodJunk Intervention] Missing #gj-layer');
  throw new Error('Missing #gj-layer');
}

/* -------------------------------------------------------
 * Runtime state
 * ----------------------------------------------------- */
const STATE = {
  startTimeIso: nowIso(),
  lastTick: nowMs(),

  plannedSec: CTX.time,
  tLeft: CTX.time,

  playing: true,
  ended: false,
  paused: false,

  score: 0,
  missTotal: 0,
  missGoodExpired: 0,
  missJunkHit: 0,
  goodHitCount: 0,

  shots: 0,
  hits: 0,
  combo: 0,
  bestCombo: 0,
  fever: 0,
  shield: 0,

  goalTarget: CTX.diff === 'hard' ? 24 : (CTX.diff === 'normal' ? 18 : 14),

  rtList: [],
  targets: new Map(),

  eventRows: [],
  mlRows: [],
  mlGameendRows: [],

  summary: null
};

/* -------------------------------------------------------
 * Target helpers
 * ----------------------------------------------------- */
function layerRect(){
  return EL.layer.getBoundingClientRect();
}

function spawnRect(){
  const r = layerRect();
  const topPad = CTX.view === 'mobile' ? 170 : 160;
  const bottomPad = 130;
  const leftPad = 18;
  const rightPad = 18;

  return {
    x1: r.left + leftPad,
    x2: r.right - rightPad,
    y1: r.top + topPad,
    y2: r.bottom - bottomPad
  };
}

function randPoint(){
  const s = spawnRect();
  return {
    x: s.x1 + Math.random() * Math.max(10, s.x2 - s.x1),
    y: s.y1 + Math.random() * Math.max(10, s.y2 - s.y1)
  };
}

function makeId(prefix='t'){
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function makeTarget(type, emoji, ttlSec){
  const p = randPoint();
  const el = DOC.createElement('div');
  el.className = 'gj-target';
  el.textContent = emoji;
  el.dataset.type = type;
  el.dataset.id = makeId(type);
  el.style.position = 'absolute';
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
  el.style.transform = 'translate(-50%,-50%)';
  el.style.fontSize = type === 'junk' ? '46px' : '48px';
  el.style.lineHeight = '1';
  el.style.cursor = 'pointer';
  el.style.userSelect = 'none';
  el.style.filter = 'drop-shadow(0 16px 40px rgba(0,0,0,.45))';
  el.style.textShadow = '0 10px 30px rgba(0,0,0,.48)';

  const bornAt = nowMs();
  const id = el.dataset.id;
  const rowBase = {
    targetId: id,
    emoji,
    itemType: type,
    bornAt,
    ttlSec,
    x: p.x,
    y: p.y
  };

  STATE.targets.set(id, {
    id,
    type,
    emoji,
    bornAt,
    ttlSec,
    x: p.x,
    y: p.y,
    el
  });

  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    ev.stopPropagation();
    hitTarget(id);
  }, { passive:false });

  EL.layer.appendChild(el);

  pushEventRow('spawn', {
    targetId: id,
    emoji,
    itemType: type,
    judgment: '',
    rtMs: '',
    totalScore: STATE.score,
    combo: STATE.combo,
    isGood: type === 'good' ? 1 : 0,
    extra: JSON.stringify({ ttlSec, x: Math.round(p.x), y: Math.round(p.y) })
  });

  return rowBase;
}

function removeTarget(id){
  const t = STATE.targets.get(id);
  if(!t) return;
  try{ t.el.remove(); }catch(_){}
  STATE.targets.delete(id);
}

/* -------------------------------------------------------
 * Data helpers
 * ----------------------------------------------------- */
function tGameMsNow(){
  return Math.max(0, Math.round((STATE.plannedSec - STATE.tLeft) * 1000));
}

function currentAccPct(){
  return pct(STATE.hits, Math.max(1, STATE.shots), 0);
}

function currentMedianRtGoodMs(){
  return median(STATE.rtList);
}

function pushEventRow(eventType, payload={}){
  const row = {
    timestampIso: nowIso(),
    projectTag: CTX.projectTag,
    runMode: CTX.run,
    studyId: CTX.studyId,
    phase: CTX.phase,
    conditionGroup: CTX.conditionGroup,
    sessionId: CTX.sessionId,
    eventType,
    gameMode: 'solo',
    diff: CTX.diff,
    timeFromStartMs: tGameMsNow(),
    targetId: payload.targetId ?? '',
    emoji: payload.emoji ?? '',
    itemType: payload.itemType ?? '',
    lane: payload.lane ?? '',
    rtMs: payload.rtMs ?? '',
    judgment: payload.judgment ?? '',
    totalScore: payload.totalScore ?? STATE.score,
    combo: payload.combo ?? STATE.combo,
    isGood: payload.isGood ?? '',
    feverState: STATE.fever > 0 ? 1 : 0,
    feverValue: Math.round(STATE.fever || 0),
    goalProgress: `${STATE.goodHitCount}/${STATE.goalTarget}`,
    miniProgress: '',
    extra: payload.extra ?? '',
    studentKey: CTX.studentKey,
    schoolCode: CTX.schoolCode,
    classRoom: CTX.classRoom,
    studentNo: CTX.studentNo,
    nickName: CTX.nickName
  };

  STATE.eventRows.push(row);
  return row;
}

function buildMlRow(){
  return {
    ts: nowIso(),
    pid: CTX.studentKey,
    game: GAME_KEY,
    score: STATE.score,
    miss: STATE.missTotal,
    accPct: currentAccPct(),
    combo: STATE.combo,
    fever: Math.round(STATE.fever || 0),
    shield: STATE.shield,
    missGoodExpired: STATE.missGoodExpired,
    missJunkHit: STATE.missJunkHit,
    timeLeft: Math.ceil(STATE.tLeft),
    difficulty: CTX.diff,
    view: CTX.view
  };
}

function buildMlGameendRow(reason){
  return {
    endIso: nowIso(),
    pid: CTX.studentKey,
    run: CTX.run,
    diff: CTX.diff,
    view: CTX.view,
    seed: CTX.seed,
    scoreFinal: STATE.score,
    missTotal: STATE.missTotal,
    accPct: currentAccPct(),
    medianRtGoodMs: currentMedianRtGoodMs(),
    reason
  };
}

function buildSessionsRow(reason){
  return {
    timestampIso: nowIso(),
    projectTag: CTX.projectTag,
    runMode: CTX.run,
    studyId: CTX.studyId,
    phase: CTX.phase,
    conditionGroup: CTX.conditionGroup,
    sessionOrder: CTX.sessionOrder,
    blockLabel: CTX.blockLabel,
    siteCode: qs('siteCode',''),
    schoolYear: qs('schoolYear',''),
    semester: qs('semester',''),
    sessionId: CTX.sessionId,
    gameMode: 'solo',
    diff: CTX.diff,
    durationPlannedSec: STATE.plannedSec,
    durationPlayedSec: Math.max(0, Math.round(STATE.plannedSec - STATE.tLeft)),
    scoreFinal: STATE.score,
    comboMax: STATE.bestCombo,
    misses: STATE.missTotal,
    goalsCleared: STATE.goodHitCount,
    goalsTotal: STATE.goalTarget,
    miniCleared: '',
    miniTotal: '',
    nTargetGoodSpawned: STATE.eventRows.filter(r => r.eventType === 'spawn' && r.itemType === 'good').length,
    nTargetJunkSpawned: STATE.eventRows.filter(r => r.eventType === 'spawn' && r.itemType === 'junk').length,
    nTargetStarSpawned: STATE.eventRows.filter(r => r.eventType === 'spawn' && r.emoji === '⭐').length,
    nTargetDiamondSpawned: STATE.eventRows.filter(r => r.eventType === 'spawn' && r.emoji === '💎').length,
    nTargetShieldSpawned: STATE.eventRows.filter(r => r.eventType === 'spawn' && r.itemType === 'shield').length,
    nHitGood: STATE.goodHitCount,
    nHitJunk: STATE.missJunkHit,
    nHitJunkGuard: '',
    nExpireGood: STATE.missGoodExpired,
    accuracyGoodPct: currentAccPct(),
    junkErrorPct: pct(STATE.missJunkHit, Math.max(1, STATE.shots), 0),
    avgRtGoodMs: STATE.rtList.length ? Math.round(STATE.rtList.reduce((s,x)=>s+x,0) / STATE.rtList.length) : 0,
    medianRtGoodMs: currentMedianRtGoodMs(),
    fastHitRatePct: pct(STATE.rtList.filter(x=>x<=900).length, Math.max(1, STATE.rtList.length), 0),
    device: CTX.view,
    gameVersion: GAME_VERSION,
    reason,
    startTimeIso: STATE.startTimeIso,
    endTimeIso: nowIso(),
    studentKey: CTX.studentKey,
    schoolCode: CTX.schoolCode,
    schoolName: CTX.schoolName,
    classRoom: CTX.classRoom,
    studentNo: CTX.studentNo,
    nickName: CTX.nickName,
    gender: CTX.gender,
    age: CTX.age,
    gradeLevel: CTX.gradeLevel,
    heightCm: qs('heightCm',''),
    weightKg: qs('weightKg',''),
    bmi: qs('bmi',''),
    bmiGroup: qs('bmiGroup',''),
    vrExperience: qs('vrExperience',''),
    gameFrequency: qs('gameFrequency',''),
    handedness: qs('handedness',''),
    visionIssue: qs('visionIssue',''),
    healthDetail: qs('healthDetail',''),
    consentParent: qs('consentParent',''),
    consentTeacher: qs('consentTeacher',''),
    profileSource: qs('profileSource','query'),
    surveyKey: qs('surveyKey',''),
    excludeFlag: qs('excludeFlag',''),
    noteResearcher: qs('noteResearcher',''),
    rtBreakdownJson: JSON.stringify({
      n: STATE.rtList.length,
      median: currentMedianRtGoodMs()
    }),
    __extraJson: JSON.stringify({
      gameKey: GAME_KEY,
      kid: CTX.kid ? 1 : 0,
      readable: CTX.readable ? 1 : 0
    })
  };
}

/* -------------------------------------------------------
 * Intervention layer
 * ----------------------------------------------------- */
function buildNutritionExplanation(){
  if(STATE.missJunkHit >= 5){
    return 'รอบนี้ยังเผลอแตะอาหารหวาน มัน หรือเครื่องดื่มหวานหลายครั้ง ลองจำไว้ว่าอาหารแบบนี้ควรกินนาน ๆ ครั้ง และควรเลือกผลไม้หรือนมจืดแทนเมื่อทำได้';
  }

  if(STATE.goodHitCount >= Math.ceil(STATE.goalTarget * 0.8)){
    return 'รอบนี้เลือกอาหารดีได้ดีมาก แปลว่าเริ่มแยกได้แล้วว่าอาหารที่มีประโยชน์ควรเป็นตัวเลือกหลักของมื้อหรือของว่าง';
  }

  return 'รอบนี้เริ่มฝึกแยกอาหารดีและอาหารที่ควรลดได้แล้ว ลองสังเกตว่าอาหารดีมักเป็นผลไม้ ผัก นมจืด หรืออาหารที่ให้ประโยชน์กับร่างกายมากกว่าอาหารหวานจัด มันจัด หรือเค็มจัด';
}

function buildReflectionPrompt(){
  if(STATE.missJunkHit >= 4){
    return {
      text: 'ถ้าหิวหลังเลิกเรียน ครั้งหน้าหนูจะพยายามเลือกอะไรแทนขนมหรือเครื่องดื่มหวาน',
      bullets: [
        'ฉันเผลอเลือก junk ตอนสถานการณ์แบบไหน',
        'ถ้าหิวจริง ฉันจะเตรียมของว่างดีอะไรได้บ้าง',
        'ฉันจะลองเปลี่ยนแค่ 1 อย่างก่อน'
      ]
    };
  }

  if(STATE.goodHitCount >= STATE.goalTarget){
    return {
      text: 'หนูทำได้ดีมาก ลองคิดต่อว่าในชีวิตจริงวันนี้จะเลือกของว่างดีอะไรได้ 1 อย่าง',
      bullets: [
        'ฉันเลือกอาหารดีได้เพราะอะไร',
        'ของว่างดีที่ฉันหาได้ง่ายคืออะไร',
        'ฉันจะชวนใครที่บ้านให้ช่วยเลือกด้วยดีไหม'
      ]
    };
  }

  return {
    text: 'ลองคิดดูว่า วันนี้หนูได้เรียนรู้อะไรเกี่ยวกับอาหารดีและอาหารที่ควรลด',
    bullets: [
      'อาหารดีที่ฉันจำได้มีอะไรบ้าง',
      'อาหารที่ควรลดมีอะไรบ้าง',
      'ครั้งหน้าฉันอยากเล่นให้ดีขึ้นตรงไหน'
    ]
  };
}

function buildTakeHomeMission(){
  if(STATE.goodHitCount < Math.ceil(STATE.goalTarget * 0.6)){
    return 'ภารกิจวันนี้: ลองเลือกของว่างดี 1 อย่างแทนขนมหวานหรือเครื่องดื่มหวาน แล้วบอกผู้ปกครองว่าหนูเลือกเพราะอะไร';
  }

  if(STATE.missJunkHit >= 4){
    return 'ภารกิจวันนี้: ลองลดน้ำหวานหรือขนมลง 1 ครั้ง และเปลี่ยนเป็นผลไม้หรือนมจืดแทน';
  }

  return 'ภารกิจวันนี้: เลือกผลไม้หรืออาหารดี 1 อย่างในมื้อว่าง แล้วลองคุยกับคนที่บ้านว่าอาหารดีช่วยร่างกายอย่างไร';
}

/* -------------------------------------------------------
 * UI render
 * ----------------------------------------------------- */
function gradeFromState(){
  const acc = currentAccPct();
  if(STATE.score >= 260 && acc >= 80 && STATE.missTotal <= 3) return 'A';
  if(STATE.score >= 190 && acc >= 65 && STATE.missTotal <= 5) return 'B';
  if(STATE.score >= 130 && acc >= 50) return 'C';
  return 'D';
}

function setHUD(){
  EL.hudScore.textContent = String(STATE.score);
  EL.hudTime.textContent = String(Math.ceil(STATE.tLeft));
  EL.hudMiss.textContent = String(STATE.missTotal);
  EL.hudGrade.textContent = gradeFromState();
  EL.hudGoal.textContent = STATE.tLeft > 15 ? 'LEARN' : 'FINISH';
  EL.hudGoalCur.textContent = String(STATE.goodHitCount);
  EL.hudGoalTarget.textContent = String(STATE.goalTarget);
  EL.goalDesc.textContent = 'เก็บอาหารดี • หลีกเลี่ยง junk';
  if(EL.hudMini) EL.hudMini.textContent = STATE.fever > 0 ? 'FEVER' : '—';
  if(EL.miniTimer) EL.miniTimer.textContent = String(Math.ceil(STATE.fever || 0));

  if(EL.missionTitle) EL.missionTitle.textContent = STATE.tLeft > 15 ? 'HEALTHY CHOICE' : 'FINAL PUSH';
  if(EL.missionGoal) EL.missionGoal.textContent = 'เก็บอาหารดีให้มาก และหลีกเลี่ยง junk food';
  if(EL.missionHint) EL.missionHint.textContent = STATE.missJunkHit >= 3
    ? 'ระวังของหวานและเครื่องดื่มหวาน'
    : 'เน้นผลไม้ ผัก และอาหารที่ดีต่อสุขภาพ';

  if(EL.missionFill){
    const p = pct(STATE.goodHitCount, Math.max(1, STATE.goalTarget), 0);
    EL.missionFill.style.width = `${p}%`;
    EL.missionFill.style.setProperty('--p', `${p}%`);
  }

  if(EL.coachInline){
    EL.coachInline.textContent = STATE.missJunkHit >= 4
      ? 'ระวัง junk ให้มากขึ้น'
      : 'โฟกัสอาหารดีไว้ก่อน';
  }

  if(EL.coachExplain){
    EL.coachExplain.textContent = STATE.goodHitCount >= STATE.goalTarget
      ? 'เริ่มแยกอาหารดีได้ดีขึ้นแล้ว'
      : 'ของว่างที่ดีช่วยร่างกายมากกว่า';
  }

  if(EL.aiRisk){
    const risk = Math.min(0.99, (STATE.missJunkHit * 0.08) + (STATE.missGoodExpired * 0.05));
    EL.aiRisk.textContent = risk.toFixed(2);
  }

  if(EL.aiHint){
    EL.aiHint.textContent = STATE.missJunkHit >= 4
      ? 'ลองชะลอจังหวะและเลือกของดีทีละชิ้น'
      : 'ทำได้ดี ลองเน้นผลไม้และผักเพิ่ม';
  }

  if(EL.dangerOverlay){
    EL.dangerOverlay.style.opacity = (STATE.tLeft <= 10 || STATE.missJunkHit >= 5) ? '1' : '0';
  }
}

function showStageBanner(big, small=''){
  if(!EL.stageBanner) return;
  EL.stageBannerBig.textContent = big || 'MODE';
  EL.stageBannerSmall.textContent = small || '';
  EL.stageBanner.classList.add('show');
  setTimeout(()=> EL.stageBanner.classList.remove('show'), 1200);
}

function showMilestone(text){
  if(!EL.milestoneBanner) return;
  EL.milestoneBanner.textContent = text;
  EL.milestoneBanner.classList.add('show');
  setTimeout(()=> EL.milestoneBanner.classList.remove('show'), 900);
}

function renderEndOverlay(reason){
  const grade = gradeFromState();
  const playSec = Math.max(0, Math.round(STATE.plannedSec - STATE.tLeft));
  const reflection = buildReflectionPrompt();

  STATE.summary = {
    title: reason === 'win' ? 'เยี่ยมมาก ทำภารกิจสำเร็จ!' : 'จบรอบแล้ว มาทบทวนกัน',
    subtitle: reason === 'win'
      ? 'หนูเริ่มแยกอาหารดีและอาหารที่ควรลดได้ดีขึ้น'
      : 'ทุกครั้งที่เล่นคือการฝึกเลือกอาหารที่ดีกับร่างกาย',
    grade,
    decision: reason === 'win'
      ? 'พร้อมไปทำแบบประเมินหลังเล่นและทำภารกิจสุขภาพต่อ'
      : 'ลองทำแบบประเมินหลังเล่น แล้วฝึกภารกิจเล็ก ๆ ต่อในชีวิตจริง'
  };

  EL.endTitle.textContent = STATE.summary.title;
  EL.endSub.textContent = STATE.summary.subtitle;
  EL.endGrade.textContent = grade;
  EL.endScore.textContent = String(STATE.score);
  EL.endMiss.textContent = String(STATE.missTotal);
  EL.endTime.textContent = `${playSec}s`;
  EL.endDecision.textContent = STATE.summary.decision;

  if(EL.nutritionExplainBody){
    EL.nutritionExplainBody.textContent = buildNutritionExplanation();
  }

  if(EL.reflectionBody){
    EL.reflectionBody.textContent = reflection.text;
  }

  if(EL.reflectionBullets){
    EL.reflectionBullets.innerHTML = reflection.bullets.map(x => `<li>${x}</li>`).join('');
  }

  if(EL.takeHomeMissionBody){
    EL.takeHomeMissionBody.textContent = buildTakeHomeMission();
  }

  EL.endOverlay.style.display = 'flex';
  EL.endOverlay.setAttribute('aria-hidden', 'false');
}

/* -------------------------------------------------------
 * Gameplay
 * ----------------------------------------------------- */
function spawnOne(){
  if(STATE.paused || STATE.ended) return;

  const r = Math.random();
  if(r < 0.10){
    makeTarget('shield', pick(SHIELD), 2.8);
    return;
  }
  if(r < 0.20){
    makeTarget('bonus', pick(BONUS), 2.6);
    return;
  }
  if(r < (CTX.diff === 'hard' ? 0.52 : 0.42)){
    makeTarget('junk', pick(JUNK), CTX.diff === 'hard' ? 2.0 : 2.4);
    return;
  }
  makeTarget('good', pick(GOOD), CTX.diff === 'hard' ? 2.0 : 2.5);
}

function hitTarget(id){
  const t = STATE.targets.get(id);
  if(!t || STATE.paused || STATE.ended) return;

  STATE.shots++;

  if(t.type === 'good'){
    const rt = Math.max(80, Math.round(nowMs() - t.bornAt));
    STATE.hits++;
    STATE.goodHitCount++;
    STATE.combo++;
    STATE.bestCombo = Math.max(STATE.bestCombo, STATE.combo);
    STATE.score += 10 + Math.min(8, STATE.combo);
    STATE.rtList.push(rt);

    pushEventRow('hit', {
      targetId: t.id,
      emoji: t.emoji,
      itemType: t.type,
      rtMs: rt,
      judgment: 'good-hit',
      totalScore: STATE.score,
      combo: STATE.combo,
      isGood: 1,
      extra: JSON.stringify({ scoreDelta: 10 + Math.min(8, STATE.combo) })
    });

    if(STATE.combo === 5 || STATE.combo === 10){
      showMilestone(STATE.combo === 10 ? 'HEALTHY HERO!' : 'NICE CHOICE!');
    }

    if(STATE.combo >= 8){
      STATE.fever = Math.max(STATE.fever, 4);
    }
  }
  else if(t.type === 'junk'){
    STATE.hits++;
    STATE.missTotal++;
    STATE.missJunkHit++;
    STATE.combo = 0;
    STATE.score = Math.max(0, STATE.score - 8);

    pushEventRow('hit', {
      targetId: t.id,
      emoji: t.emoji,
      itemType: t.type,
      rtMs: '',
      judgment: 'junk-hit',
      totalScore: STATE.score,
      combo: STATE.combo,
      isGood: 0,
      extra: JSON.stringify({ scoreDelta: -8 })
    });
  }
  else if(t.type === 'bonus'){
    STATE.hits++;
    STATE.score += 20;
    STATE.fever = Math.max(STATE.fever, 4);

    pushEventRow('hit', {
      targetId: t.id,
      emoji: t.emoji,
      itemType: t.type,
      rtMs: '',
      judgment: 'bonus-hit',
      totalScore: STATE.score,
      combo: STATE.combo,
      isGood: '',
      extra: JSON.stringify({ scoreDelta: 20 })
    });
  }
  else if(t.type === 'shield'){
    STATE.hits++;
    STATE.shield = Math.min(9, STATE.shield + 1);
    STATE.score += 6;

    pushEventRow('hit', {
      targetId: t.id,
      emoji: t.emoji,
      itemType: t.type,
      rtMs: '',
      judgment: 'shield-hit',
      totalScore: STATE.score,
      combo: STATE.combo,
      isGood: '',
      extra: JSON.stringify({ shield: STATE.shield })
    });
  }

  removeTarget(id);
  setHUD();

  if(STATE.goodHitCount >= STATE.goalTarget){
    endGame('win');
  }
}

function expireTargets(){
  const now = nowMs();
  for(const [id, t] of STATE.targets){
    const ageSec = (now - t.bornAt) / 1000;
    if(ageSec < t.ttlSec) continue;

    if(t.type === 'good'){
      STATE.missTotal++;
      STATE.missGoodExpired++;
      STATE.combo = 0;

      pushEventRow('expire', {
        targetId: t.id,
        emoji: t.emoji,
        itemType: t.type,
        rtMs: '',
        judgment: 'good-expire',
        totalScore: STATE.score,
        combo: STATE.combo,
        isGood: 1,
        extra: ''
      });
    }

    removeTarget(id);
  }
}

let spawnAcc = 0;
let lastMlAt = 0;

function maybeSampleMl(now){
  if(now - lastMlAt < 2000) return;
  lastMlAt = now;
  STATE.mlRows.push(buildMlRow());
}

function endGame(reason='time'){
  if(STATE.ended) return;

  STATE.ended = true;
  STATE.playing = false;
  STATE.paused = true;

  for(const [id] of STATE.targets){
    removeTarget(id);
  }

  pushEventRow('end', {
    targetId: '',
    emoji: '',
    itemType: '',
    rtMs: '',
    judgment: reason === 'win' ? 'win' : 'end',
    totalScore: STATE.score,
    combo: STATE.bestCombo,
    isGood: '',
    extra: JSON.stringify({ reason })
  });

  STATE.mlRows.push(buildMlRow());
  STATE.mlGameendRows.push(buildMlGameendRow(reason));

  const sessionsRow = buildSessionsRow(reason);
  console.log('[GoodJunk Intervention] session row', sessionsRow);
  console.log('[GoodJunk Intervention] events', STATE.eventRows);
  console.log('[GoodJunk Intervention] ml rows', STATE.mlRows);
  console.log('[GoodJunk Intervention] ml_gameend', STATE.mlGameendRows);

  renderEndOverlay(reason);
}

function tick(){
  const t = nowMs();
  let dt = (t - STATE.lastTick) / 1000;
  STATE.lastTick = t;
  dt = clamp(dt, 0, 0.05);

  if(!STATE.playing){
    requestAnimationFrame(tick);
    return;
  }

  if(STATE.paused){
    requestAnimationFrame(tick);
    return;
  }

  STATE.tLeft = Math.max(0, STATE.tLeft - dt);
  STATE.fever = Math.max(0, STATE.fever - dt);

  if(STATE.tLeft <= 0){
    endGame(STATE.goodHitCount >= Math.ceil(STATE.goalTarget * 0.8) ? 'win' : 'time');
    return;
  }

  spawnAcc += dt * (CTX.diff === 'hard' ? 1.35 : (CTX.diff === 'normal' ? 1.05 : 0.88));
  while(spawnAcc >= 1){
    spawnAcc -= 1;
    spawnOne();
  }

  expireTargets();
  maybeSampleMl(t);
  setHUD();

  requestAnimationFrame(tick);
}

/* -------------------------------------------------------
 * Boot
 * ----------------------------------------------------- */
function wireGlobalShoot(){
  WIN.addEventListener('hha:shoot', ()=>{
    if(STATE.paused || STATE.ended) return;

    const r = layerRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    let best = null;
    let bestD = Infinity;

    for(const [id, t] of STATE.targets){
      const br = t.el.getBoundingClientRect();
      const tx = br.left + br.width/2;
      const ty = br.top + br.height/2;
      const dx = cx - tx;
      const dy = cy - ty;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD){
        bestD = d2;
        best = id;
      }
    }

    if(best){
      hitTarget(best);
    }
  });
}

function wireButtons(){
  if(EL.btnReplay){
    EL.btnReplay.addEventListener('click', ()=>{
      location.href = location.href;
    });
  }

  if(EL.btnBackHub){
    EL.btnBackHub.addEventListener('click', ()=>{
      location.href = CTX.hub;
    });
  }

  if(EL.btnEndBackHub){
    EL.btnEndBackHub.addEventListener('click', ()=>{
      location.href = CTX.hub;
    });
  }

  if(EL.missionBox){
    EL.missionBox.addEventListener('click', ()=>{
      showStageBanner('HEALTHY CHOICE', 'เน้นอาหารดีให้มากขึ้น');
    });
  }

  if(EL.aiBox){
    EL.aiBox.addEventListener('click', ()=>{
      showStageBanner('COACH TIP', 'เลือกของดีช้า ๆ แต่แม่น ๆ');
    });
  }
}

function boot(){
  console.log('[GoodJunk Intervention] boot', CTX);

  wireGlobalShoot();
  wireButtons();
  setHUD();
  showStageBanner('START', 'เก็บอาหารดี หลีกเลี่ยง junk');

  requestAnimationFrame(tick);
}

boot();