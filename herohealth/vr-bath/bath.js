'use strict';

window.__BATH_BOOT_OK__ = false;
console.log('[Bath] script loaded', location.href);

const W = window, D = document;
const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
const qbool = (k,d=false)=>{ const v=String(qs(k,d?'1':'0')).toLowerCase(); return ['1','true','yes','y','on'].includes(v); };
const clamp=(v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));
const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
const isoNow = ()=> new Date().toISOString();

function cleanHubUrl(raw){
  raw = String(raw || '../hub.html').trim();
  raw = raw.replace(/[.]+$/, '');
  return raw || '../hub.html';
}

function mulberry32(seed){ let t=seed>>>0; return ()=>{ t+=0x6D2B79F5; let r=Math.imul(t^(t>>>15),1|t); r^=r+Math.imul(r^(r>>>7),61|r); return ((r^(r>>>14))>>>0)/4294967296; }; }
function seedFrom(str){ let h=2166136261>>>0; const s=String(str||''); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
const avg = (a)=> (!a||!a.length)?0:a.reduce((x,y)=>x+y,0)/a.length;
const std = (a)=>{ if(!a||a.length<2) return 0; const m=avg(a); const v=a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1); return Math.sqrt(Math.max(0,v)); };
const clamp01 = (x)=>Math.max(0,Math.min(1,x));

const RUN = String(qs('run','play')).toLowerCase();
const DIFF = String(qs('diff','normal')).toLowerCase();
const TIME = clamp(qs('time','90'), 45, 180);
const PID  = String(qs('pid','anon'));
const SEED = String(qs('seed', String(Date.now())));
const HUB  = cleanHubUrl(qs('hub','../hub.html'));
const LOG_ON = qbool('log', false);
const API = String(qs('api',''));
const PRO = qbool('pro', false);

const rng = mulberry32(seedFrom(`${PID}|${SEED}|bath|${DIFF}|${PRO?1:0}`));

const UI = {
  phasePill: D.getElementById('phasePill'),
  questPill: D.getElementById('questPill'),
  timePill: D.getElementById('timePill'),
  cleanPill: D.getElementById('cleanPill'),
  rubricPill: D.getElementById('rubricPill'),
  toolPill: D.getElementById('toolPill'),
  foamPill: D.getElementById('foamPill'),
  residuePill: D.getElementById('residuePill'),
  riskPill: D.getElementById('riskPill'),
  meterPill: D.getElementById('meterPill'),
  viewPill: D.getElementById('viewPill'),
  proPill: D.getElementById('proPill'),
  coachPill: D.getElementById('coachPill'),
  fatiguePill: D.getElementById('fatiguePill'),
  steadyPill: D.getElementById('steadyPill'),
  pressurePill: D.getElementById('pressurePill'),
  progressBar: D.getElementById('progressBar'),

  targetLayer: D.getElementById('target-layer'),
  stateLayer: D.getElementById('state-layer'),
  guideLayer: D.getElementById('guide-layer'),
  bodyWrap: D.getElementById('body-wrap'),
  silhouetteOverlay: D.getElementById('silhouette-overlay'),
  toolCursor: D.getElementById('tool-cursor'),

  btnStart: D.getElementById('btnStart'),
  btnLearn: D.getElementById('btnLearn'),
  btnFlip: D.getElementById('btnFlip'),
  btnHelp: D.getElementById('btnHelp'),
  btnCloseHelp: D.getElementById('btnCloseHelp'),
  panelHelp: D.getElementById('panelHelp'),

  panelQuiz: D.getElementById('panelQuiz'),
  quizBody: D.getElementById('quizBody'),
  btnQuizNext: D.getElementById('btnQuizNext'),

  panelEnd: D.getElementById('panelEnd'),
  endSummary: D.getElementById('endSummary'),
  heatmap: D.getElementById('heatmap'),
  reasonChips: D.getElementById('reasonChips'),
  stars: D.getElementById('stars'),
  selfRubric: D.getElementById('selfRubric'),
  rubricDesc: D.getElementById('rubricDesc'),
  improveChips: D.getElementById('improveChips'),
  planList: D.getElementById('planList'),
  btnPlayPlan: D.getElementById('btnPlayPlan'),
  btnReplay: D.getElementById('btnReplay'),
  btnCooldown: D.getElementById('btnCooldown'),
  btnBack: D.getElementById('btnBack'),

  aiTipPill: D.getElementById('aiTipPill'),
  aiCauseChips: D.getElementById('aiCauseChips'),
  aiMetaText: D.getElementById('aiMetaText'),

  baBeforeResidue: D.getElementById('baBeforeResidue'),
  baBeforeRisk: D.getElementById('baBeforeRisk'),
  baBeforeSweat: D.getElementById('baBeforeSweat'),
  baBeforeClean: D.getElementById('baBeforeClean'),
  baAfterResidue: D.getElementById('baAfterResidue'),
  baAfterRisk: D.getElementById('baAfterRisk'),
  baAfterSweat: D.getElementById('baAfterSweat'),
  baAfterClean: D.getElementById('baAfterClean'),
};

async function safePost(url, payload){
  try{
    if(!LOG_ON || !url) return;
    await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload), keepalive:true });
  }catch(e){}
}
function studentMeta(){
  const q = (k)=> String(qs(k,'')||'');
  return {
    studentKey: q('studentKey') || PID,
    schoolCode: q('schoolCode'),
    schoolName: q('schoolName'),
    classRoom: q('classRoom'),
    studentNo: q('studentNo'),
    nickName: q('nickName'),
    gender: q('gender'),
    age: q('age'),
    gradeLevel: q('gradeLevel')
  };
}
function baseCtx(sessionId){
  return {
    timestampIso: isoNow(),
    projectTag: String(qs('projectTag','HeroHealth')),
    runMode: String(qs('runMode', RUN)),
    studyId: String(qs('studyId','')),
    phase: String(qs('phase','')),
    conditionGroup: String(qs('conditionGroup','')),
    sessionId,
    gameMode: RUN,
    diff: DIFF,
    ...studentMeta()
  };
}
function logEvent(sessionId, eventType, extra={}){
  safePost(API, { table:'events', ...baseCtx(sessionId), eventType, timeFromStartMs: Math.round(now() - S.startMs), extra: JSON.stringify(extra||{}) });
}

let FX=null, MISS=null;
(async ()=>{
  try{ FX = (await import('./bath.fx.js?v=20260308b')).bootFx(); }catch(e){ console.warn('[Bath] bath.fx import failed', e); }
  try{
    MISS = (await import('./bath.missions.js?v=20260308b')).bootMissions({
      warmNeed: PRO ? 5 : 4,
      trickNeed: PRO ? 6 : 4,
      bossNeed: 1
    });
  }catch(e){
    console.warn('[Bath] bath.missions import failed', e);
  }
})();

const SPOTS = {
  front: [
    { id:'earL', label:'หลังหูซ้าย', x:36, y:14, hard:3, boss:true },
    { id:'earR', label:'หลังหูขวา', x:64, y:14, hard:3, boss:true },
    { id:'neck', label:'คอ', x:50, y:22, hard:3 },
    { id:'armpitL', label:'รักแร้ซ้าย', x:28, y:34, hard:4, boss:true },
    { id:'armpitR', label:'รักแร้ขวา', x:72, y:34, hard:4, boss:true },
    { id:'elbowL', label:'ข้อพับแขนซ้าย', x:20, y:44, hard:3 },
    { id:'elbowR', label:'ข้อพับแขนขวา', x:80, y:44, hard:3 },
    { id:'kneeL', label:'ข้อพับขาซ้าย', x:44, y:74, hard:3 },
    { id:'kneeR', label:'ข้อพับขาขวา', x:56, y:74, hard:3 },
    { id:'toeL', label:'ซอกนิ้วเท้าซ้าย', x:46, y:92, hard:4, boss:true },
    { id:'toeR', label:'ซอกนิ้วเท้าขวา', x:54, y:92, hard:4, boss:true },
  ],
  back: [
    { id:'backNeck', label:'ท้ายทอย', x:50, y:18, hard:3 },
    { id:'backL', label:'หลังซ้าย', x:42, y:36, hard:3 },
    { id:'backR', label:'หลังขวา', x:58, y:36, hard:3 },
    { id:'waist', label:'เอว', x:50, y:52, hard:4, boss:true },
    { id:'behindKneeL', label:'หลังเข่าซ้าย', x:44, y:76, hard:3 },
    { id:'behindKneeR', label:'หลังเข่าขวา', x:56, y:76, hard:3 },
    { id:'heelL', label:'ส้นเท้าซ้าย', x:46, y:94, hard:3 },
    { id:'heelR', label:'ส้นเท้าขวา', x:54, y:94, hard:3 },
  ]
};

const SPOT_HINT = {
  earL:'หลังหูมีเหงื่อและคราบสะสมได้',
  earR:'หลังหูมีเหงื่อและคราบสะสมได้',
  neck:'คอมีเหงื่อและฝุ่นสะสม',
  armpitL:'รักแร้เป็นจุดอับ ควรถูให้สะอาด',
  armpitR:'รักแร้เป็นจุดอับ ควรถูให้สะอาด',
  elbowL:'ข้อพับแขนมีเหงื่อสะสมได้',
  elbowR:'ข้อพับแขนมีเหงื่อสะสมได้',
  kneeL:'ข้อพับขาเป็นจุดอับ ควรถูให้ทั่ว',
  kneeR:'ข้อพับขาเป็นจุดอับ ควรถูให้ทั่ว',
  toeL:'ซอกนิ้วเท้าถ้าไม่ล้างและเช็ดให้แห้ง เสี่ยงเชื้อรา',
  toeR:'ซอกนิ้วเท้าถ้าไม่ล้างและเช็ดให้แห้ง เสี่ยงเชื้อรา',
  backNeck:'ท้ายทอยมีเหงื่อสะสมได้',
  backL:'แผ่นหลังมีเหงื่อและคราบ',
  backR:'แผ่นหลังมีเหงื่อและคราบ',
  waist:'บริเวณเอวเป็นจุดอับ',
  behindKneeL:'หลังเข่าเป็นจุดอับ ควรถูให้ดี',
  behindKneeR:'หลังเข่าเป็นจุดอับ ควรถูให้ดี',
  heelL:'ส้นเท้าควรล้างและเช็ดให้แห้ง',
  heelR:'ส้นเท้าควรล้างและเช็ดให้แห้ง'
};

const SPOT_SHORT_TH = {
  earL:'หลังหู',
  earR:'หลังหู',
  neck:'คอ',
  armpitL:'รักแร้',
  armpitR:'รักแร้',
  elbowL:'ข้อพับแขน',
  elbowR:'ข้อพับแขน',
  kneeL:'ข้อพับขา',
  kneeR:'ข้อพับขา',
  toeL:'ซอกนิ้วเท้า',
  toeR:'ซอกนิ้วเท้า',
  backNeck:'ท้ายทอย',
  backL:'หลัง',
  backR:'หลัง',
  waist:'เอว',
  behindKneeL:'หลังเข่า',
  behindKneeR:'หลังเข่า',
  heelL:'ส้นเท้า',
  heelR:'ส้นเท้า'
};
function spotThaiLabel(spotId){
  if (!spotId) return '';
  return SPOT_SHORT_TH[spotId] || spotId;
}
function shouldShowSpotTag(kind, spotId){
  if (!spotId) return false;
  if (kind === 'boss' || kind === 'warn') return true;
  if (kind === 'good' && (PHASES[S.phase] === 'SOAP' || PHASES[S.phase] === 'SCRUB')) return true;
  return false;
}

const PLAN_KEY = `HHA_BATH_PLAN::${PID}`;
function loadPlan(view){
  try{
    const raw = localStorage.getItem(`${PLAN_KEY}:${view}`);
    const a = JSON.parse(raw||'null');
    const ids = (SPOTS[view]||[]).map(s=>s.id);
    if (Array.isArray(a) && a.length && a.every(x=>ids.includes(x))) return a.slice();
  }catch(e){}
  return (SPOTS[view]||[]).slice().sort((a,b)=>(b.boss?1:0)-(a.boss?1:0)).map(s=>s.id);
}
function savePlan(view, plan){
  try{ localStorage.setItem(`${PLAN_KEY}:${view}`, JSON.stringify(plan)); }catch(e){}
}

const TOOLS = [
  { id:'soap', label:'สบู่', foamGain: 10, scrubBonus: 0.0 },
  { id:'sponge', label:'ฟองน้ำ', foamGain: 6, scrubBonus: 0.15 },
  { id:'shampoo', label:'แชมพู', foamGain: 8, scrubBonus: 0.08 },
];

function isLearnMode(){
  return String(S.mode || '').toLowerCase() === 'learn';
}
function phaseThai(p){
  const map = {
    PREP:'เตรียมตัว',
    WET:'ทำให้เปียก',
    SOAP:'ฟอกสบู่',
    SCRUB:'ถูจุดอับ',
    RINSE:'ล้างฟอง',
    DRY:'เช็ดให้แห้ง',
    DRESS:'ใส่เสื้อ',
    END:'สรุปผล'
  };
  return map[p] || 'พร้อมเริ่ม';
}
function toolThai(t){
  const map = { soap:'สบู่', sponge:'ฟองน้ำ', shampoo:'แชมพู' };
  return map[t] || t;
}
function explainMistake(reason){
  const map = {
    wrong_wet:'ตอนนี้ต้องทำให้เปียกก่อน ยังไม่ควรทำขั้นอื่น',
    no_foam:'ฟองไม่พอ ต้องใช้สบู่ก่อนถู',
    fake_bubble:'อันนี้เป็นฟองหลอก ไม่ช่วยให้สะอาด',
    wrong_scrub:'ตอนนี้ต้องถูจุดอับ ไม่ใช่กดอย่างอื่น',
    oil_decoy:'คราบมันทำให้สกปรกเพิ่ม ต้องระวัง',
    wrong_rinse:'ตอนนี้ต้องล้างฟองออกให้หมด',
    wrong_dry:'ตอนนี้ต้องเช็ดตัวให้แห้ง',
    wrong_dress:'ยังใส่เสื้อไม่ได้ เพราะยังไม่พร้อม',
  };
  return map[reason] || 'ลองทำตามขั้นตอนปัจจุบันอีกครั้ง';
}

const PHASES = ['PREP','WET','SOAP','SCRUB','RINSE','DRY','DRESS','END'];
const EM = { water:'💧', foam:'🫧', fake:'🫧', shimmer:'✨', towel:'🧻', shirt:'👕', boss:'😷', oil:'🛢️' };

const QUIZ = [
  { q:'ลำดับที่ถูกต้องควรเริ่มจากอะไร?', a:['ฟอกสบู่', 'ทำให้เปียก (WET)'], correct:1 },
  { q:'ถ้ารีบข้าม RINSE จะเกิดอะไร?', a:['ฟองค้าง', 'สะอาดขึ้น'], correct:0 },
  { q:'จุดอับต้องทำยังไง?', a:['ถูซ้ำให้พอ', 'แตะครั้งเดียวพอ'], correct:0 }
];
const REASONS = [
  { id:'skip', label:'ฉันข้ามขั้น' },
  { id:'fast', label:'ฉันรีบเกินไป' },
  { id:'tool', label:'ฉันใช้ฟอง/เครื่องมือไม่พอ' },
  { id:'boss', label:'ฉันแพ้บอส' },
];
const IMPROVES = [
  { id:'wet', label:'ทำ WET ให้ครบก่อน' },
  { id:'rinse', label:'อย่าข้าม RINSE' },
  { id:'focusBoss', label:'โฟกัสจุดอับที่ยาก' },
  { id:'slow', label:'ช้าลงนิดเพื่อความแม่น' },
];

const S = {
  sessionId: `bath_${PID}_${Date.now()}`,
  started:false, ended:false,
  phase:0,
  view:'front',
  tool:'soap',
  timeLeft: TIME,
  startMs: 0,
  lastFrameMs:0,
  lastSpawnMs:0,

  dragging:false,
  dragKind:'',
  dragHits:new Set(),
  lastDragAt:0,

  foam: 0,
  sweat: 0,
  residue: 15,
  fungusRisk: 10,
  cleanScore: 0,

  wetMap:{},
  foamMap:{},
  dryMap:{},

  spot: {},
  targets: new Map(),
  tidSeq:0,

  rtGood: [], rtEarly: [], rtLate: [],
  missTimes: [], pressureBurst:0,
  combo:0, comboMax:0,
  steadyPct:100, fatiguePct:0, pressurePct:0,

  quizIndex:0, quizCorrect:0,
  selfReason:'', selfRating:0, improvePick:'',
  mode:'standard',
  plan: loadPlan('front'),
  planCursor:0,

  bossActive:false,
  bossHp:0,
  bossDeadline:0,
  bossSpotId:null,

  fakeHits:0,
  oilHits:0,
  foamSpent:0,
  rinseHits:0,
  wetHits:0,
  dryHits:0,
  bossHits:0,
  bossFails:0,

  lastCoachMs:0,
  aiSnapshot:null,

  dragTraceCount:0,
  dragDistinctSpots:new Set(),
  dragPhaseScore:{ wet:0, rinse:0, dry:0 },

  beforeStats:{ residue:15, risk:10, sweat:0, clean:0 },
};

function resetBodyMaps(){
  S.wetMap = {};
  S.foamMap = {};
  S.dryMap = {};
  (SPOTS[S.view] || []).forEach(sp=>{
    S.wetMap[sp.id] = 0;
    S.foamMap[sp.id] = 0;
    S.dryMap[sp.id] = 0;
  });
}
function resetSpotStats(){
  S.spot = {};
  (SPOTS[S.view]||[]).forEach(sp=>{
    S.spot[sp.id] = { spawn:0, hit:0, miss:0, cleared:0, need: sp.hard, lastSeenMs:0, boss:!!sp.boss };
  });
}
function tuneByDiff(){
  S.timeLeft = TIME;
  if (PRO) S.timeLeft = clamp(TIME, 60, 180);
}

function computeMastery(){
  const list = SPOTS[S.view] || [];
  const total = list.length || 1;
  const cleared = list.reduce((a,sp)=>a + (S.spot[sp.id]?.cleared ? 1 : 0), 0);
  const coveragePct = Math.round((cleared / total) * 100);

  const missionDone = !!(MISS && MISS.done && MISS.done());
  const rinsePass = S.residue <= (PRO ? 16 : 18);
  const dryPass = S.fungusRisk <= (PRO ? 22 : 25);
  const bossPass = missionDone && S.bossFails === 0;
  const pass = missionDone && rinsePass && dryPass && bossPass;

  return { pass, missionDone, rinsePass, dryPass, bossPass, coveragePct };
}

function computeRubric(){
  const mastery = computeMastery();
  const pass = mastery.pass && mastery.coveragePct >= 80;
  return {
    pass,
    cov: mastery.coveragePct,
    residue: Math.round(S.residue),
    risk: Math.round(S.fungusRisk),
    missionDone: mastery.missionDone,
    bossPass: mastery.bossPass,
    rinsePass: mastery.rinsePass,
    dryPass: mastery.dryPass
  };
}

function dragQuality(){
  const wetQ = Math.min(100, Math.round((S.dragPhaseScore.wet || 0) * 8));
  const rinseQ = Math.min(100, Math.round((S.dragPhaseScore.rinse || 0) * 10));
  const dryQ = Math.min(100, Math.round((S.dragPhaseScore.dry || 0) * 10));
  const distinct = S.dragDistinctSpots ? S.dragDistinctSpots.size : 0;
  const coverageBonus = Math.min(20, distinct);
  return {
    wet: Math.min(100, wetQ + Math.round(coverageBonus * 0.5)),
    rinse: Math.min(100, rinseQ + Math.round(coverageBonus * 0.4)),
    dry: Math.min(100, dryQ + Math.round(coverageBonus * 0.4))
  };
}

function learningSummary(){
  const points = [];
  const dq = dragQuality();

  if (S.residue > 18) points.push('หนูยังล้างฟองออกไม่หมด');
  else points.push('หนูล้างฟองออกได้ดี');

  if (S.fungusRisk > 25) points.push('หนูยังเช็ดตัวไม่แห้งพอ โดยเฉพาะจุดอับ');
  else points.push('หนูเช็ดตัวได้แห้งดี ลดความเสี่ยงอับชื้น');

  if (S.bossFails > 0) points.push('จุดอับสำคัญยังต้องฝึกเพิ่ม');
  else points.push('หนูจัดการจุดอับสำคัญได้ดี');

  if (!computeMastery().missionDone) points.push('รอบหน้าควรทำตามลำดับให้ครบทุกช่วง');
  else points.push('หนูทำตามลำดับการอาบน้ำได้ดี');

  if (dq.wet < 45) points.push('หนูยังทำให้ตัวเปียกไม่ทั่วพอ');
  else points.push('หนูทำให้ตัวเปียกได้ทั่วดี');

  if (dq.rinse < 45) points.push('หนูยังล้างฟองออกไม่ทั่ว');
  if (dq.dry < 45) points.push('หนูยังเช็ดตัวไม่ทั่ว โดยเฉพาะจุดอับ');

  return points;
}

function updatePhysicalProxy(){
  const early = avg(S.rtEarly), late = avg(S.rtLate);
  const drift = (S.rtEarly.length>=3 && S.rtLate.length>=3) ? (late-early) : 0;
  const rtStd = std(S.rtGood);
  const stead = clamp01(1 - (rtStd/420) - (S.pressureBurst/8));
  const press = clamp01((S.pressureBurst/4) + (S.sweat/260) + (S.fungusRisk/260));
  const fat = clamp01((drift/380) + (S.sweat/260));
  S.steadyPct = stead*100;
  S.pressurePct = press*100;
  S.fatiguePct = fat*100;
}

function spotToBodyPart(spotId){
  const map = {
    earL:'head', earR:'head', neck:'head', backNeck:'head',
    armpitL:'armL', elbowL:'armL',
    armpitR:'armR', elbowR:'armR',
    backL:'torso', backR:'torso', waist:'torso',
    kneeL:'legL', behindKneeL:'legL', toeL:'legL', heelL:'legL',
    kneeR:'legR', behindKneeR:'legR', toeR:'legR', heelR:'legR'
  };
  return map[spotId] || 'torso';
}

function renderSilhouetteOverlay(){
  if (!UI.silhouetteOverlay) return;

  const nodes = {
    head: UI.silhouetteOverlay.querySelector('[data-part="head"]'),
    torso: UI.silhouetteOverlay.querySelector('[data-part="torso"]'),
    armL: UI.silhouetteOverlay.querySelector('[data-part="armL"]'),
    armR: UI.silhouetteOverlay.querySelector('[data-part="armR"]'),
    legL: UI.silhouetteOverlay.querySelector('[data-part="legL"]'),
    legR: UI.silhouetteOverlay.querySelector('[data-part="legR"]')
  };

  const parts = {
    head:{ wet:0, foam:0, dry:0, n:0 },
    torso:{ wet:0, foam:0, dry:0, n:0 },
    armL:{ wet:0, foam:0, dry:0, n:0 },
    armR:{ wet:0, foam:0, dry:0, n:0 },
    legL:{ wet:0, foam:0, dry:0, n:0 },
    legR:{ wet:0, foam:0, dry:0, n:0 }
  };

  for (const sp of (SPOTS[S.view] || [])){
    const part = spotToBodyPart(sp.id);
    if (!parts[part]) continue;
    parts[part].wet += (S.wetMap[sp.id] || 0);
    parts[part].foam += (S.foamMap[sp.id] || 0);
    parts[part].dry += (S.dryMap[sp.id] || 0);
    parts[part].n++;
  }

  Object.entries(parts).forEach(([part, v])=>{
    const el = nodes[part];
    if (!el) return;

    const wet = v.n ? v.wet / v.n : 0;
    const foam = v.n ? v.foam / v.n : 0;
    const dry = v.n ? v.dry / v.n : 0;

    el.classList.remove('wet','foam','dry');
    el.style.opacity = '0';

    if (PHASES[S.phase] === 'WET' && wet > 0.15){
      el.classList.add('wet');
      el.style.opacity = String(Math.min(0.9, 0.15 + wet * 0.75));
    } else if ((PHASES[S.phase] === 'SOAP' || PHASES[S.phase] === 'SCRUB' || PHASES[S.phase] === 'RINSE') && foam > 0.12){
      el.classList.add('foam');
      el.style.opacity = String(Math.min(0.88, 0.12 + foam * 0.72));
    } else if ((PHASES[S.phase] === 'DRY' || PHASES[S.phase] === 'DRESS') && dry > 0.12){
      el.classList.add('dry');
      el.style.opacity = String(Math.min(0.88, 0.12 + dry * 0.72));
    }
  });
}

function currentGuideSpotIds(){
  if (PHASES[S.phase] === 'WET'){
    const order = ['neck','armpitL','armpitR','toeL','toeR','earL','earR'];
    return order.filter(id => (S.wetMap[id] || 0) < 0.6).slice(0, 3);
  }
  if (PHASES[S.phase] === 'SOAP'){
    const order = ['neck','armpitL','armpitR','backL','backR','toeL','toeR'];
    return order.filter(id => (S.foamMap[id] || 0) < 0.5).slice(0, 3);
  }
  if (PHASES[S.phase] === 'SCRUB'){
    const list = SPOTS[S.view] || [];
    return list.filter(sp => !S.spot[sp.id]?.cleared).slice(0,3).map(sp => sp.id);
  }
  if (PHASES[S.phase] === 'RINSE'){
    const order = ['neck','armpitL','armpitR','toeL','toeR'];
    return order.filter(id => (S.foamMap[id] || 0) > 0.2).slice(0, 3);
  }
  if (PHASES[S.phase] === 'DRY'){
    const order = ['toeL','toeR','armpitL','armpitR','neck'];
    return order.filter(id => (S.dryMap[id] || 0) < 0.6).slice(0, 3);
  }
  return [];
}

function renderBodyOverlay(){
  if (!UI.stateLayer || !UI.guideLayer) return;

  UI.stateLayer.innerHTML = '';
  UI.guideLayer.innerHTML = '';

  const list = SPOTS[S.view] || [];
  const guideIds = new Set(currentGuideSpotIds());

  for (const sp of list){
    const wet = clamp(S.wetMap[sp.id] || 0, 0, 1);
    const foam = clamp(S.foamMap[sp.id] || 0, 0, 1);
    const dry = clamp(S.dryMap[sp.id] || 0, 0, 1);

    let type = '';
    let icon = '';

    if (PHASES[S.phase] === 'WET' && wet > 0.15){
      type = 'wet'; icon = '💧';
    } else if ((PHASES[S.phase] === 'SOAP' || PHASES[S.phase] === 'SCRUB' || PHASES[S.phase] === 'RINSE') && foam > 0.15){
      type = 'foam'; icon = '🫧';
    } else if ((PHASES[S.phase] === 'DRY' || PHASES[S.phase] === 'DRESS') && dry > 0.15){
      type = 'dry'; icon = '🧻';
    }

    if (type){
      const el = D.createElement('div');
      el.className = `stateDot ${type}`;
      el.style.left = `${sp.x}%`;
      el.style.top = `${sp.y}%`;
      el.textContent = icon;
      UI.stateLayer.appendChild(el);
    }

    if (guideIds.has(sp.id)){
      const g = D.createElement('div');
      g.className = 'guideArrow';
      g.style.left = `${sp.x}%`;
      g.style.top = `${sp.y}%`;
      g.textContent = '➡';
      UI.guideLayer.appendChild(g);
    }
  }

  renderSilhouetteOverlay();
}

function hud(){
  const rub = computeRubric();
  UI.phasePill && (UI.phasePill.textContent = `ขั้นตอน: ${S.started ? phaseThai(PHASES[S.phase]) : 'พร้อมเริ่ม'}`);
  UI.questPill && (UI.questPill.textContent = `ภารกิจตอนนี้: ${MISS?.text?.() || (S.started ? 'ทำตามขั้นตอนปัจจุบัน' : 'กดเริ่มเพื่อทำแบบทดสอบก่อนเล่น')}`);
  UI.timePill && (UI.timePill.textContent = `TIME: ${Math.max(0, Math.ceil(S.timeLeft))}`);
  UI.viewPill && (UI.viewPill.textContent = `VIEW: ${S.view.toUpperCase()}`);
  UI.toolPill && (UI.toolPill.textContent = `อุปกรณ์: ${toolThai(S.tool)}`);
  UI.foamPill && (UI.foamPill.textContent = `FOAM: ${Math.round(S.foam)}`);
  UI.meterPill && (UI.meterPill.textContent = `SWEAT: ${Math.round(S.sweat)}%`);
  UI.residuePill && (UI.residuePill.textContent = `ฟองค้าง: ${Math.round(S.residue)}%`);
  UI.riskPill && (UI.riskPill.textContent = `เสี่ยงอับชื้น: ${Math.round(S.fungusRisk)}%`);
  UI.rubricPill && (UI.rubricPill.textContent = `RUBRIC: ${rub.pass?'PASS':'TRY AGAIN'}`);

  if (UI.proPill){
    UI.proPill.textContent = `PRO: ${PRO?'ON':'OFF'}`;
    UI.proPill.classList.toggle('on', !!PRO);
    UI.proPill.classList.toggle('off', !PRO);
  }

  UI.fatiguePill && (UI.fatiguePill.textContent = `FATIGUE: ${Math.round(S.fatiguePct)}%`);
  UI.steadyPill && (UI.steadyPill.textContent = `STEADY: ${Math.round(S.steadyPct)}%`);
  UI.pressurePill && (UI.pressurePill.textContent = `PRESSURE: ${Math.round(S.pressurePct)}%`);

  const p = MISS?.progress01?.() ?? 0;
  UI.progressBar && (UI.progressBar.style.width = `${Math.round(p*100)}%`);

  const list = SPOTS[S.view]||[];
  const total = list.length || 1;
  const cleared = list.reduce((a,sp)=>a + (S.spot[sp.id]?.cleared?1:0), 0);
  const cov = (cleared/total)*100;
  const mastery = computeMastery();

  let rawClean = cov - (S.residue * 0.45) - (S.fungusRisk * 0.45) - (S.pressurePct * 0.10);
  rawClean = clamp(rawClean, 0, 100);
  if (!mastery.missionDone) rawClean = Math.min(rawClean, 59);
  if (!mastery.bossPass) rawClean = Math.min(rawClean, 49);
  if (!mastery.rinsePass) rawClean = Math.min(rawClean, 54);
  if (!mastery.dryPass) rawClean = Math.min(rawClean, 54);

  S.cleanScore = rawClean;
  UI.cleanPill && (UI.cleanPill.textContent = `สะอาดแล้ว: ${Math.round(S.cleanScore)}%`);
}

function clearTargets(){
  UI.targetLayer && (UI.targetLayer.innerHTML = '');
  S.targets.clear();
}

function makeTarget({ kind, label, x, y, spotId=null, ttlMs=1400, needHits=1, boss=false }){
  const el = D.createElement('div');
  el.className = `target ${kind}${boss?' boss':''}`;
  el.style.left = `${x}%`;
  el.style.top  = `${y}%`;

  const thaiTag = shouldShowSpotTag(kind, spotId) ? spotThaiLabel(spotId) : '';
  el.innerHTML = `<div class="ico">${label}</div><div class="tag">${thaiTag}</div>`;

  const id = `t${++S.tidSeq}`;
  const bornAt = now();
  const ttlAt = bornAt + ttlMs;

  const t = { id, el, kind, label, x, y, spotId, bornAt, ttlAt, needHits, hits:0, boss };
  S.targets.set(id, t);

  el.addEventListener('pointerdown', (e)=>{ e.preventDefault(); handleHit(id, e); }, { passive:false });
  UI.targetLayer.appendChild(el);
  return t;
}

function spawnWater(){ return makeTarget({ kind:'good', label:EM.water, x:25 + rng()*50, y:18 + rng()*72, ttlMs: PRO?1000:1200 }); }
function spawnFoam(real=true){
  const fake = !real;
  return makeTarget({ kind: fake?'bad':'good', label: fake?EM.fake:EM.foam, x:25 + rng()*50, y:18 + rng()*72, ttlMs: PRO?1200:1400 });
}
function spawnShimmerSpot(isTrick=false){
  const list = SPOTS[S.view]||[];
  if(!list.length) return null;

  let pick;
  if (S.mode==='plan' && S.plan?.length){
    const sid = S.plan[S.planCursor % S.plan.length];
    S.planCursor++;
    pick = list.find(s=>s.id===sid) || list[Math.floor(rng()*list.length)];
  } else {
    const arr = list.map(s=>{
      const st = S.spot[s.id];
      const uncleared = st && !st.cleared;
      const w = (uncleared?1.6:0.7) * (s.boss?1.4:1.0);
      return { s, w };
    });
    const sum = arr.reduce((a,b)=>a+b.w,0);
    let r = rng()*sum;
    for(const it of arr){ r -= it.w; if(r<=0){ pick = it.s; break; } }
    if(!pick) pick = arr[0].s;
  }

  const st = S.spot[pick.id];
  st.spawn++; st.lastSeenMs = now();

  const tool = TOOLS.find(t=>t.id===S.tool) || TOOLS[0];
  let need = pick.hard + (PRO?1:0) + (DIFF==='hard'?1:0) - (DIFF==='easy'?1:0);
  need = Math.max(2, Math.round(need * (1 - (tool.scrubBonus||0))));
  const ttl = (PRO?1500:1650) + (pick.boss?500:0) + Math.round(S.sweat*4);

  return makeTarget({
    kind: isTrick ? 'bad' : 'warn',
    label: isTrick ? EM.oil : EM.shimmer,
    x: pick.x + (rng()*6-3),
    y: pick.y + (rng()*6-3),
    spotId: pick.id,
    ttlMs: ttl,
    needHits: isTrick ? 1 : need
  });
}
function spawnTowel(){ return makeTarget({ kind:'good', label:EM.towel, x:28 + rng()*44, y:20 + rng()*72, ttlMs: PRO?1400:1600 }); }
function spawnDress(){ return makeTarget({ kind:'good', label:EM.shirt, x:50 + (rng()*12-6), y:58 + (rng()*10-5), ttlMs: PRO?1600:1800 }); }

function maybeSpawnBoss(){
  if (S.bossActive || !MISS || MISS.S.stage !== 3) return;
  const list = (SPOTS[S.view]||[]).filter(s=>s.boss);
  if(!list.length) return;
  const s = list[Math.floor(rng()*list.length)];

  S.bossActive = true;
  S.bossSpotId = s.id;
  S.bossHp = (PRO?9:0) + (DIFF==='hard'?8:(DIFF==='easy'?5:6));
  S.bossDeadline = now() + (PRO?5200:6500);

  makeTarget({ kind:'boss', label:EM.boss, x:s.x, y:s.y, spotId:s.id, ttlMs:(PRO?5200:6500), needHits:S.bossHp, boss:true });
  FX?.toast?.('บอสมา! ถูให้ทัน!', 'warn', 950);
  S.lastCoachMs = 0;
  logEvent(S.sessionId, 'boss_spawn', { spotId:s.id, hp:S.bossHp });
}

function bossFailSpread(){
  S.residue = clamp(S.residue + 12, 0, 100);
  S.sweat = clamp(S.sweat + 10, 0, 100);
  for(let i=0;i<4;i++) spawnShimmerSpot(false);
  S.bossFails++;
  S.bossActive=false; S.bossHp=0; S.bossSpotId=null; S.bossDeadline=0;
  FX?.toast?.('บอสหนี! คราบกระจาย!', 'bad', 900);
  logEvent(S.sessionId, 'boss_fail', {});
}
function bossWin(){
  S.residue = clamp(S.residue - 10, 0, 100);
  MISS?.onBossWin?.();
  S.bossActive=false; S.bossHp=0; S.bossSpotId=null; S.bossDeadline=0;
  FX?.toast?.('ชนะบอส! ดีมาก!', 'good', 900);
  logEvent(S.sessionId, 'boss_win', {});
}

function activeDragKind(){
  const phase = PHASES[S.phase];
  if (phase === 'WET') return 'wet';
  if (phase === 'RINSE') return 'rinse';
  if (phase === 'DRY') return 'dry';
  return '';
}
function bodyPointToPercent(clientX, clientY){
  const box = UI.bodyWrap?.getBoundingClientRect();
  if (!box) return null;
  const x = ((clientX - box.left) / box.width) * 100;
  const y = ((clientY - box.top) / box.height) * 100;
  if (x < 0 || x > 100 || y < 0 || y > 100) return null;
  return { x, y };
}
function nearestSpotId(px, py){
  const list = SPOTS[S.view] || [];
  let best = null, bestD = Infinity;
  for (const sp of list){
    const dx = sp.x - px;
    const dy = sp.y - py;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < bestD){ bestD = d; best = sp.id; }
  }
  return bestD <= 12 ? best : null;
}
function applyDragOnSpot(spotId, dragKind){
  const st = S.spot[spotId];
  if (!st) return;

  S.dragTraceCount++;
  S.dragDistinctSpots.add(`${dragKind}:${spotId}`);

  if (dragKind === 'wet'){
    S.dragPhaseScore.wet += 1;
    S.wetHits++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);
    S.residue = clamp(S.residue - 0.45, 0, 100);
    S.sweat = clamp(S.sweat - 0.25, 0, 100);
    S.wetMap[spotId] = clamp((S.wetMap[spotId] || 0) + 0.22, 0, 1);
    return;
  }
  if (dragKind === 'rinse'){
    S.dragPhaseScore.rinse += 1;
    S.rinseHits++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);
    S.residue = clamp(S.residue - 1.25, 0, 100);
    S.foamMap[spotId] = clamp((S.foamMap[spotId] || 0) - 0.28, 0, 1);
    S.wetMap[spotId] = clamp((S.wetMap[spotId] || 0) + 0.05, 0, 1);
    return;
  }
  if (dragKind === 'dry'){
    S.dragPhaseScore.dry += 1;
    S.dryHits++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);
    S.fungusRisk = clamp(S.fungusRisk - 1.15, 0, 100);
    S.dryMap[spotId] = clamp((S.dryMap[spotId] || 0) + 0.24, 0, 1);
    S.wetMap[spotId] = clamp((S.wetMap[spotId] || 0) - 0.18, 0, 1);
  }
}
function beginDragTool(kind){
  if (!kind || !S.started || S.ended) return;
  S.dragging = true;
  S.dragKind = kind;
  S.dragHits = new Set();
  S.lastDragAt = now();
}
function endDragTool(){
  S.dragging = false;
  S.dragKind = '';
  S.dragHits = new Set();
}
function onBodyDragAt(clientX, clientY){
  if (!S.dragging || !S.dragKind) return;
  const pt = bodyPointToPercent(clientX, clientY);
  if (!pt) return;
  const sid = nearestSpotId(pt.x, pt.y);
  if (!sid) return;

  const key = `${S.dragKind}:${sid}`;
  const tnow = now();
  if (S.dragHits.has(key) && (tnow - S.lastDragAt) < 90) return;

  S.dragHits.add(key);
  S.lastDragAt = tnow;
  applyDragOnSpot(sid, S.dragKind);

  if (isLearnMode()){
    const tip = SPOT_HINT[sid] || 'ทำจุดนี้ให้ครบ';
    UI.coachPill && (UI.coachPill.textContent = `COACH: ${tip}`.slice(0, 86));
  }

  updatePhysicalProxy();
  hud();
  renderBodyOverlay();
}

function phaseCursorIcon(){
  const p = PHASES[S.phase];
  if (p === 'WET') return { cls:'wet', icon:'💧' };
  if (p === 'SOAP') return { cls:'soap', icon:'🧼' };
  if (p === 'SCRUB') return { cls:'scrub', icon:'🫧' };
  if (p === 'RINSE') return { cls:'rinse', icon:'🚿' };
  if (p === 'DRY') return { cls:'dry', icon:'🧻' };
  if (p === 'DRESS') return { cls:'dress', icon:'👕' };
  return { cls:'', icon:'•' };
}
function updateToolCursor(clientX, clientY, forceShow=false){
  if (!UI.toolCursor || !UI.bodyWrap) return;
  const box = UI.bodyWrap.getBoundingClientRect();
  const inside = clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
  const p = phaseCursorIcon();
  UI.toolCursor.className = '';
  UI.toolCursor.id = 'tool-cursor';
  if (p.cls) UI.toolCursor.classList.add(p.cls);
  UI.toolCursor.textContent = p.icon;

  if (inside || forceShow){
    UI.toolCursor.classList.add('show');
    UI.toolCursor.style.left = `${clientX - box.left}px`;
    UI.toolCursor.style.top  = `${clientY - box.top}px`;
  } else {
    UI.toolCursor.classList.remove('show');
  }
}
function hideToolCursor(){
  if (!UI.toolCursor) return;
  UI.toolCursor.classList.remove('show');
}

function handleHit(id, e){
  const t = S.targets.get(id);
  if(!t || S.ended || !S.started) return;
  const rt = Math.max(0, Math.round(now() - t.bornAt));

  const phase = PHASES[S.phase];

  if (phase==='SOAP'){
    if (t.label === EM.foam){
      if (S.foam <= 0) return miss(rt,'no_foam', e);
      S.foamSpent++;
      S.foam = Math.max(0, S.foam - 1);
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.residue = clamp(S.residue - 1.1, 0, 100);
      const sid = nearestSpotId(t.x, t.y);
      if (sid) S.foamMap[sid] = clamp((S.foamMap[sid] || 0) + 0.35, 0, 1);
      removeTarget(id);
      renderBodyOverlay();
      return;
    } else {
      S.fakeHits++;
      S.foam = Math.max(0, S.foam - 1);
      S.residue = clamp(S.residue + 2.0, 0, 100);
      removeTarget(id);
      renderBodyOverlay();
      return miss(rt,'fake_bubble', e);
    }
  }

  if (phase==='SCRUB'){
    if (t.boss){
      t.hits++;
      S.bossHp = Math.max(0, S.bossHp - 1);
      if (S.bossHp <= 0){
        removeTarget(id);
        return bossWin();
      }
      return;
    }

    if (t.kind === 'warn' && t.label === EM.shimmer){
      const st = S.spot[t.spotId];
      if (!st) return;
      t.hits++; st.hit++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      if (t.hits >= t.needHits){
        st.cleared = 1;
        S.residue = clamp(S.residue - 2.6, 0, 100);
        if (t.spotId) S.foamMap[t.spotId] = clamp((S.foamMap[t.spotId] || 0) + 0.10, 0, 1);
        removeTarget(id);
        if (MISS){
          if (MISS.S.stage === 1) MISS.onWarmClear();
          else if (MISS.S.stage === 2) MISS.onTrickClear();
        }
        const hint = SPOT_HINT[t.spotId] || 'จุดนี้ควรทำความสะอาดให้ครบ';
        UI.coachPill && (UI.coachPill.textContent = `COACH: ${hint}`.slice(0, 86));
        renderBodyOverlay();
        if (MISS && MISS.S.stage === 3) setTimeout(()=> maybeSpawnBoss(), 450);
      }
      return;
    }

    if (t.kind === 'bad' && t.label === EM.oil){
      S.oilHits++;
      S.residue = clamp(S.residue + 3.0, 0, 100);
      removeTarget(id);
      renderBodyOverlay();
      return miss(rt,'oil_decoy', e);
    }
  }

  if (phase==='DRESS'){
    if (t.label === EM.shirt){
      removeTarget(id);
      S.combo++;
      return;
    }
    return miss(rt,'wrong_dress', e);
  }
}

function guidedCoachForPhase(){
  if (!isLearnMode()) return;
  const map = {
    WET:'ลากผ่านร่างกายเพื่อทำให้เปียกทั่ว',
    SOAP:'ใช้สบู่เพื่อช่วยทำความสะอาด',
    SCRUB:'ถูจุดอับสำคัญ เช่น คอ รักแร้ หลังหู ซอกนิ้วเท้า',
    RINSE:'ลากล้างฟองและคราบออกให้หมด',
    DRY:'ลากเช็ดตัวให้แห้ง โดยเฉพาะจุดอับ',
    DRESS:'เมื่อแห้งแล้วค่อยใส่เสื้อ'
  };
  const msg = map[PHASES[S.phase]];
  if (msg) UI.coachPill && (UI.coachPill.textContent = `COACH: ${msg}`.slice(0, 86));
}

function phaseAdvance(){
  S.phase = Math.min(S.phase+1, PHASES.length-1);
  S.lastSpawnMs = 0;

  if (PHASES[S.phase] === 'SCRUB'){
    MISS?.reset?.();
    S.planCursor = 0;
  }
  if (PHASES[S.phase] === 'END'){
    const mastery = computeMastery();
    return endGame(mastery.pass ? 'complete' : 'incomplete_mastery');
  }

  renderBodyOverlay();
  guidedCoachForPhase();
}

function phaseGate(){
  if (isLearnMode()){
    if (PHASES[S.phase] === 'WET') return S.wetHits >= 8;
    if (PHASES[S.phase] === 'SOAP') return S.foamSpent >= 2 || S.residue <= 45;
    if (PHASES[S.phase] === 'SCRUB') return computeMastery().coveragePct >= 60;
    if (PHASES[S.phase] === 'RINSE') return S.rinseHits >= 6 || S.residue <= 25;
    if (PHASES[S.phase] === 'DRY') return S.dryHits >= 6 || S.fungusRisk <= 30;
    if (PHASES[S.phase] === 'DRESS') return true;
  }
  if (PHASES[S.phase] === 'WET') return S.wetHits >= (PRO?10:8);
  if (PHASES[S.phase] === 'SOAP') return S.foamSpent >= 2 || S.residue <= 40;
  if (PHASES[S.phase] === 'SCRUB') return !!(MISS && MISS.done && MISS.done());
  if (PHASES[S.phase] === 'RINSE') return S.rinseHits >= (PRO?8:6) || S.residue <= 18;
  if (PHASES[S.phase] === 'DRY') return S.dryHits >= (PRO?8:6) || S.fungusRisk <= 25;
  if (PHASES[S.phase] === 'DRESS') return true;
  return false;
}

function spawnLoop(tnow){
  if (!S.lastSpawnMs) S.lastSpawnMs = tnow;
  const baseEvery = (PHASES[S.phase]==='SCRUB') ? (PRO?650:820) : (PRO?780:980);
  const learnMul = isLearnMode() ? 1.35 : 1;
  const every = clamp(baseEvery * learnMul, 420, 1600);
  if (tnow - S.lastSpawnMs < every) return;
  S.lastSpawnMs = tnow;

  if (PHASES[S.phase]==='SOAP'){
    let fakeRate = (DIFF==='hard') ? (PRO?0.34:0.28) : (DIFF==='easy' ? 0.12 : 0.18);
    if (isLearnMode()) fakeRate *= 0.45;
    spawnFoam(rng() > fakeRate);
  } else if (PHASES[S.phase]==='SCRUB'){
    const stage = MISS?.S?.stage || 1;
    if (stage===1){
      spawnShimmerSpot(false);
    } else if (stage===2){
      spawnShimmerSpot(rng() < (isLearnMode() ? 0.18 : (PRO?0.45:0.35)));
    } else {
      if (!S.bossActive) maybeSpawnBoss();
      if (rng() < 0.35) spawnShimmerSpot(false);
    }
  } else if (PHASES[S.phase]==='DRESS'){
    spawnDress();
  }
}

function loop(){
  if (!S.started || S.ended) return;
  const tnow = now();
  const dt = S.lastFrameMs ? Math.min(80, Math.max(0, tnow - S.lastFrameMs)) : 16.7;
  S.lastFrameMs = tnow;

  S.timeLeft = Math.max(0, S.timeLeft - dt/1000);
  if (S.timeLeft <= 0) return endGame('timeout');

  if (S.bossActive && now() > S.bossDeadline) bossFailSpread();

  for (const [id,t] of S.targets.entries()){
    if (tnow >= t.ttlAt){
      if (PHASES[S.phase]==='SCRUB' && t.kind==='warn' && t.spotId){
        const st = S.spot[t.spotId]; if (st) st.miss++;
      }
      removeTarget(id);
    }
  }

  if (phaseGate()){
    const elapsed = (tnow - S.startMs)/1000;
    const minSec = (PHASES[S.phase]==='WET'?8:PHASES[S.phase]==='SOAP'?8:PHASES[S.phase]==='SCRUB'?(PRO?18:14):PHASES[S.phase]==='RINSE'?8:PHASES[S.phase]==='DRY'?8:PHASES[S.phase]==='DRESS'?2:0);
    if (elapsed > minSec){
      phaseAdvance();
    }
  }

  updatePhysicalProxy();
  hud();
  renderBodyOverlay();
  spawnLoop(tnow);
  requestAnimationFrame(loop);
}

function renderHeatmap(){
  if (!UI.heatmap) return;
  UI.heatmap.innerHTML = '';
  const list = SPOTS[S.view]||[];
  list.forEach(sp=>{
    const st = S.spot[sp.id];
    const cov = st?.cleared ? 100 : clamp(100 - (st?.need||3)*18 - (st?.miss||0)*10, 0, 100);
    const cls = cov>=85?'good':cov>=60?'mid':'bad';
    const card = D.createElement('div');
    card.className = `hm ${cls}`;
    card.innerHTML = `<div class="t">${sp.label}</div><div class="v">${Math.round(cov)}%</div>`;
    UI.heatmap.appendChild(card);
  });
}
function renderChips(container, list, get, set){
  if (!container) return;
  container.innerHTML = '';
  list.forEach(o=>{
    const b = D.createElement('button');
    b.className = `chip ${get()===o.id?'on':''}`;
    b.textContent = o.label;
    b.addEventListener('click', ()=>{
      set(o.id);
      renderChips(container, list, get, set);
    });
    container.appendChild(b);
  });
}
function renderStars(){
  if(!UI.stars) return;
  UI.stars.innerHTML = '';
  for(let i=1;i<=5;i++){
    const b = D.createElement('button');
    b.className = `star ${S.selfRating>=i?'on':''}`;
    b.textContent = '★';
    b.addEventListener('click', ()=>{
      S.selfRating=i;
      renderStars();
    });
    UI.stars.appendChild(b);
  }
}
function renderPlan(){
  if(!UI.planList) return;
  UI.planList.innerHTML = '';
  const list = SPOTS[S.view]||[];
  const map = Object.fromEntries(list.map(s=>[s.id,s]));
  S.plan.forEach((id, idx)=>{
    const sp = map[id] || {label:id,id};
    const row = D.createElement('div');
    row.className = 'planItem';
    row.innerHTML = `<div class="name">${idx+1}. ${sp.label} <span class="muted">(${sp.id})</span></div>`;
    const btns = D.createElement('div');
    btns.className = 'planBtns';

    const up = D.createElement('button');
    up.className = 'pbtn'; up.textContent='▲';
    up.addEventListener('click', ()=> movePlan(idx,-1));

    const dn = D.createElement('button');
    dn.className = 'pbtn'; dn.textContent='▼';
    dn.addEventListener('click', ()=> movePlan(idx,+1));

    btns.appendChild(up); btns.appendChild(dn);
    row.appendChild(btns);
    UI.planList.appendChild(row);
  });
}
function movePlan(idx, dir){
  const j = idx+dir;
  if (j<0 || j>=S.plan.length) return;
  [S.plan[idx], S.plan[j]] = [S.plan[j], S.plan[idx]];
  savePlan(S.view, S.plan);
  renderPlan();
}
function renderRubric(){
  const rub = computeRubric();
  UI.selfRubric && (UI.selfRubric.textContent = `RUBRIC: ${rub.pass?'PASS':'TRY AGAIN'}`);
  UI.rubricDesc && (UI.rubricDesc.textContent =
    `Coverage ${rub.cov}% • ฟองค้าง ${rub.residue}% • เสี่ยงอับชื้น ${rub.risk}% • Mission ${rub.missionDone?'PASS':'FAIL'} • Boss ${rub.bossPass?'PASS':'FAIL'} • Rinse ${rub.rinsePass?'PASS':'FAIL'} • Dry ${rub.dryPass?'PASS':'FAIL'}`);
}

function renderAIExplain(){
  if(!UI.aiTipPill || !UI.aiCauseChips || !UI.aiMetaText) return;
  UI.aiTipPill.textContent = 'AI TIP: ทำตามลำดับ เปียก → ฟอก → ถู → ล้าง → เช็ด → ใส่เสื้อ';
  UI.aiCauseChips.innerHTML = '';
  UI.aiMetaText.textContent = 'AI จะเน้นจุดอับ ฟองค้าง และความแห้งหลังอาบ';
}

function renderBeforeAfterBoard(){
  if (!UI.baBeforeResidue) return;

  UI.baBeforeResidue.textContent = `${Math.round(S.beforeStats?.residue ?? 15)}%`;
  UI.baBeforeRisk.textContent    = `${Math.round(S.beforeStats?.risk ?? 10)}%`;
  UI.baBeforeSweat.textContent   = `${Math.round(S.beforeStats?.sweat ?? 0)}%`;
  UI.baBeforeClean.textContent   = `${Math.round(S.beforeStats?.clean ?? 0)}%`;

  UI.baAfterResidue.textContent = `${Math.round(S.residue)}%`;
  UI.baAfterRisk.textContent    = `${Math.round(S.fungusRisk)}%`;
  UI.baAfterSweat.textContent   = `${Math.round(S.sweat)}%`;
  UI.baAfterClean.textContent   = `${Math.round(S.cleanScore)}%`;
}

function saveLastSummary(reason){
  const payload = {
    game:'bath', ts: isoNow(),
    pid: PID, run: RUN, diff: DIFF, pro: !!PRO,
    view: S.view, reason,
    scoreFinal: Math.round(S.cleanScore),
    residue: Math.round(S.residue),
    fungusRisk: Math.round(S.fungusRisk),
    sweat: Math.round(S.sweat),
    seed: SEED, hub: HUB
  };
  try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload)); }catch(e){}
}

function endGame(reason='complete'){
  if (S.ended) return;
  S.ended = true;
  S.started = false;
  clearTargets();

  updatePhysicalProxy();

  const mastery = computeMastery();
  const rub = computeRubric();
  const dq = dragQuality();

  renderHeatmap();
  renderStars();
  renderChips(UI.reasonChips, REASONS, ()=>S.selfReason, v=>S.selfReason=v);
  renderChips(UI.improveChips, IMPROVES, ()=>S.improvePick, v=>S.improvePick=v);
  renderPlan();
  renderRubric();
  renderAIExplain();
  renderBeforeAfterBoard();

  let nextStep = 'แนะนำ: เล่นใหม่';
  if (rub.pass) nextStep = 'แนะนำ: ไป Cooldown หรือกลับ HUB';
  else if (!mastery.bossPass) nextStep = 'แนะนำ: เล่นใหม่และโฟกัสจุดอับ';
  else if (!mastery.rinsePass) nextStep = 'แนะนำ: เล่นใหม่และอย่าข้าม RINSE';
  else if (!mastery.dryPass) nextStep = 'แนะนำ: เล่นใหม่และ DRY ให้ครบ';

  if (UI.endSummary){
    UI.endSummary.innerHTML =
      `PRO <b>${PRO?'ON':'OFF'}</b> • Mode <b>${S.mode}</b> • View <b>${S.view.toUpperCase()}</b><br/>`+
      `สะอาดแล้ว <b>${Math.round(S.cleanScore)}%</b> • ฟองค้าง <b>${Math.round(S.residue)}%</b> • เสี่ยงอับชื้น <b>${Math.round(S.fungusRisk)}%</b><br/>`+
      `Mission <b>${mastery.missionDone ? 'PASS' : 'NOT YET'}</b> • Boss <b>${mastery.bossPass ? 'PASS' : 'FAIL'}</b> • Rinse <b>${mastery.rinsePass ? 'PASS' : 'FAIL'}</b> • Dry <b>${mastery.dryPass ? 'PASS' : 'FAIL'}</b><br/>`+
      `คุณภาพการลาก: เปียก <b>${dq.wet}%</b> • ล้าง <b>${dq.rinse}%</b> • เช็ด <b>${dq.dry}%</b><br/>`+
      `<b>${nextStep}</b>`;

    const learn = learningSummary();
    UI.endSummary.innerHTML += '<br/><br/><b>สิ่งที่ได้เรียนรู้</b><br/>' + learn.map(x => `• ${x}`).join('<br/>');
  }

  UI.panelEnd?.classList.remove('hidden');
  saveLastSummary(reason);
}

function showQuiz(nextMode='standard'){
  try{
    S.quizIndex = 0;
    S.quizCorrect = 0;
    UI.btnQuizNext.dataset.nextMode = nextMode;
    renderQuiz();
    UI.panelQuiz.classList.remove('hidden');
  }catch(err){
    console.error('[Bath] showQuiz failed', err);
    startGame(nextMode);
  }
}
function renderQuiz(){
  const item = QUIZ[S.quizIndex];
  if(!UI.quizBody || !item) return;

  UI.quizBody.innerHTML = '';

  const q = D.createElement('div');
  q.style.fontWeight = '900';
  q.style.marginBottom = '10px';
  q.textContent = `${S.quizIndex + 1}/3 — ${item.q}`;
  UI.quizBody.appendChild(q);

  item.a.forEach((txt, idx)=>{
    const b = D.createElement('button');
    b.className = 'chip';
    b.textContent = txt;
    b.addEventListener('click', ()=>{
      Array.from(UI.quizBody.querySelectorAll('button.chip')).forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      b.dataset.ok = (idx === item.correct) ? '1' : '0';
    });
    UI.quizBody.appendChild(b);
  });

  UI.btnQuizNext.textContent = (S.quizIndex === QUIZ.length - 1) ? 'เริ่มเกม' : 'ข้อถัดไป';
}
function nextQuizOrStart(){
  const picked = UI.quizBody.querySelector('button.chip.on');
  if(!picked) return;
  if (picked.dataset.ok === '1') S.quizCorrect++;

  if (S.quizIndex < QUIZ.length - 1){
    S.quizIndex++;
    renderQuiz();
    return;
  }

  UI.panelQuiz.classList.add('hidden');
  startGame(UI.btnQuizNext.dataset.nextMode || 'standard');
}

function startGame(mode='standard'){
  S.mode = mode;
  S.sessionId = `bath_${PID}_${Date.now()}`;
  S.started = true;
  S.ended = false;
  S.phase = 0;

  UI.panelQuiz?.classList.add('hidden');
  UI.panelHelp?.classList.add('hidden');
  UI.panelEnd?.classList.add('hidden');

  S.view = S.view || 'front';
  tuneByDiff();
  S.startMs = now();
  S.lastFrameMs = 0;
  S.lastSpawnMs = 0;

  S.foam = 0;
  S.sweat = 0;
  S.residue = 15;
  S.fungusRisk = 10;
  S.cleanScore = 0;

  S.beforeStats = { residue: 15, risk: 10, sweat: 0, clean: 0 };

  S.rtGood=[]; S.rtEarly=[]; S.rtLate=[];
  S.missTimes=[]; S.pressureBurst=0;
  S.combo=0; S.comboMax=0;
  S.steadyPct=100; S.fatiguePct=0; S.pressurePct=0;

  S.bossActive=false; S.bossHp=0; S.bossDeadline=0; S.bossSpotId=null;
  S.fakeHits=0; S.oilHits=0; S.foamSpent=0;
  S.rinseHits=0; S.wetHits=0; S.dryHits=0;
  S.bossHits=0; S.bossFails=0;

  S.dragTraceCount = 0;
  S.dragDistinctSpots = new Set();
  S.dragPhaseScore = { wet:0, rinse:0, dry:0 };

  S.plan = loadPlan(S.view);
  S.planCursor = 0;
  resetSpotStats();
  resetBodyMaps();
  clearTargets();

  const t = TOOLS.find(x=>x.id==='soap') || TOOLS[0];
  S.tool = t.id;
  S.foam = t.foamGain + (PRO ? 3 : 0) + (DIFF === 'hard' ? 2 : 0);

  UI.coachPill && (UI.coachPill.textContent = mode === 'learn'
    ? 'COACH: วันนี้เราจะอาบน้ำทีละขั้นอย่างถูกต้อง'
    : 'COACH: เริ่มจากทำให้ตัวเปียกก่อน');

  renderBodyOverlay();
  hud();

  setTimeout(()=>{
    if(!S.started || S.ended) return;
    S.phase = 1;
    guidedCoachForPhase();
    hud();
    renderBodyOverlay();
  }, 700);

  requestAnimationFrame(loop);
}

function flipView(){
  S.view = (S.view==='front') ? 'back' : 'front';
  S.plan = loadPlan(S.view);
  S.planCursor = 0;
  resetSpotStats();
  resetBodyMaps();
  clearTargets();
  hud();
  renderBodyOverlay();
}

function bootPreviewState(){
  S.timeLeft = TIME;
  S.tool = S.tool || 'soap';
  S.view = S.view || 'front';
  hud();
}

function bindBodyDrag(){
  if (!UI.bodyWrap) return;

  UI.bodyWrap.addEventListener('pointerdown', (e)=>{
    const kind = activeDragKind();
    updateToolCursor(e.clientX, e.clientY, true);
    if (!kind) return;
    beginDragTool(kind);
    onBodyDragAt(e.clientX, e.clientY);
  }, { passive:true });

  UI.bodyWrap.addEventListener('pointermove', (e)=>{
    updateToolCursor(e.clientX, e.clientY, false);
    if (!S.dragging) return;
    onBodyDragAt(e.clientX, e.clientY);
  }, { passive:true });

  UI.bodyWrap.addEventListener('pointerup', ()=> { endDragTool(); hideToolCursor(); }, { passive:true });
  UI.bodyWrap.addEventListener('pointercancel', ()=> { endDragTool(); hideToolCursor(); }, { passive:true });
  UI.bodyWrap.addEventListener('pointerleave', ()=> { endDragTool(); hideToolCursor(); }, { passive:true });
}

UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.remove('hidden'));
UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.add('hidden'));

UI.btnFlip?.addEventListener('click', ()=>{
  if (!S.started || S.ended){ flipView(); return; }
  flipView();
});

UI.btnStart?.addEventListener('click', ()=> showQuiz('standard'));
UI.btnLearn?.addEventListener('click', ()=> showQuiz('learn'));
UI.btnQuizNext?.addEventListener('click', ()=> nextQuizOrStart());

UI.btnReplay?.addEventListener('click', ()=>{
  UI.panelEnd?.classList.add('hidden');
  showQuiz('standard');
});

UI.btnPlayPlan?.addEventListener('click', ()=>{
  savePlan(S.view, S.plan);
  UI.panelEnd?.classList.add('hidden');
  showQuiz('plan');
});

UI.btnCooldown?.addEventListener('click', ()=>{
  const hub = encodeURIComponent(HUB);
  const next = `../warmup-gate.html?gatePhase=cooldown&phase=cooldown&cat=hygiene&theme=bath&game=bath&hub=${hub}&pid=${encodeURIComponent(PID)}&diff=${encodeURIComponent(DIFF)}&pro=${PRO?1:0}&run=${encodeURIComponent(RUN)}&time=${encodeURIComponent(TIME)}&view=${encodeURIComponent(qs('view','mobile'))}&seed=${encodeURIComponent(SEED)}`;
  location.href = next;
});

UI.btnBack?.addEventListener('click', ()=>{ location.href = HUB; });

function bootBathSafe(){
  try{
    bootPreviewState();
    renderPlan();
    bindBodyDrag();
    renderBodyOverlay();
    window.__BATH_BOOT_OK__ = true;
  }catch(err){
    console.error('[Bath] bootBathSafe failed', err);
  }
}

window.__bathDebug = function(){
  return {
    started: S.started,
    ended: S.ended,
    phase: PHASES[S.phase],
    timeLeft: S.timeLeft,
    tool: S.tool,
    view: S.view,
    hasBtnStart: !!UI.btnStart,
    hasQuizPanel: !!UI.panelQuiz,
    hasQuizBody: !!UI.quizBody,
    hasTargetLayer: !!UI.targetLayer,
    bootOk: !!window.__BATH_BOOT_OK__
  };
};

if (D.readyState === 'loading'){
  D.addEventListener('DOMContentLoaded', bootBathSafe, { once:true });
} else {
  bootBathSafe();
}