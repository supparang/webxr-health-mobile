'use strict';

const W = window;
const D = document;

const qs = (k, d='')=>{
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(e){ return d; }
};
const qbool = (k,d=false)=>{
  const v = String(qs(k,d?'1':'0')).toLowerCase();
  return ['1','true','yes','y','on'].includes(v);
};
const clamp = (v,a,b)=> Math.max(a, Math.min(b, Number(v)||0));
const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
const isoNow = ()=> new Date().toISOString();

function mulberry32(seed){
  let t = seed >>> 0;
  return ()=>{
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFrom(str){
  let h = 2166136261 >>> 0;
  const s = String(str || '');
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const avg = a => (!a || !a.length) ? 0 : a.reduce((x,y)=>x+y,0)/a.length;
const std = a => {
  if(!a || a.length < 2) return 0;
  const m = avg(a);
  const v = a.reduce((s,x)=>s + (x-m)*(x-m), 0) / (a.length - 1);
  return Math.sqrt(Math.max(0,v));
};
const clamp01 = x => Math.max(0, Math.min(1, x));

const RUN  = String(qs('run','play')).toLowerCase();
const DIFF = String(qs('diff','normal')).toLowerCase();
const TIME = clamp(qs('time','80'), 45, 180);
const PID  = String(qs('pid','anon'));
const SEED = String(qs('seed', String(Date.now())));
const HUB  = String(qs('hub','../hub.html'));
const PRO  = qbool('pro', false);
const VIEW_QS = String(qs('view','mobile'));

const rng = mulberry32(seedFrom(`${PID}|${SEED}|bath-hero|${DIFF}|${PRO?1:0}`));

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
  comboPill: D.getElementById('comboPill'),
  bossPill: D.getElementById('bossPill'),
  coachPill: D.getElementById('coachPill'),
  fatiguePill: D.getElementById('fatiguePill'),
  steadyPill: D.getElementById('steadyPill'),
  pressurePill: D.getElementById('pressurePill'),
  progressBar: D.getElementById('progressBar'),
  readyBar: D.getElementById('readyBar'),
  feverBar: D.getElementById('feverBar'),

  bodyWrap: D.getElementById('body-wrap'),
  targetLayer: D.getElementById('target-layer'),
  stateLayer: D.getElementById('state-layer'),
  guideLayer: D.getElementById('guide-layer'),
  silhouetteOverlay: D.getElementById('silhouette-overlay'),
  toolCursor: D.getElementById('tool-cursor'),

  btnStart: D.getElementById('btnStart'),
  btnLearn: D.getElementById('btnLearn'),
  btnFlip: D.getElementById('btnFlip'),
  btnHelp: D.getElementById('btnHelp'),
  btnCloseHelp: D.getElementById('btnCloseHelp'),
  btnReadyStart: D.getElementById('btnReadyStart'),
  btnReadyLearn: D.getElementById('btnReadyLearn'),
  panelReady: D.getElementById('panelReady'),
  panelHelp: D.getElementById('panelHelp'),

  panelQuiz: D.getElementById('panelQuiz'),
  quizBody: D.getElementById('quizBody'),
  btnQuizNext: D.getElementById('btnQuizNext'),

  phaseBanner: D.getElementById('phaseBanner'),

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
  btnExport: D.getElementById('btnExport'),
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

  badgeShelf: D.getElementById('badgeShelf'),
  teacherSummary: D.getElementById('teacherSummary')
};

const PHASES = ['PREP','WET','SOAP','SCRUB','RINSE','DRY','DRESS','END'];
const QUIZ = [
  { q:'ลำดับที่ถูกต้องควรเริ่มจากอะไร?', a:['ฟอกสบู่', 'ทำให้เปียกก่อน'], correct:1 },
  { q:'ถ้ายังมีฟองค้าง ควรทำอะไร?', a:['ล้างออกให้หมด', 'ใส่เสื้อเลย'], correct:0 },
  { q:'ซอกนิ้วเท้าหลังอาบน้ำควรทำอย่างไร?', a:['เช็ดให้แห้ง', 'ปล่อยไว้'], correct:0 }
];
const REASONS = [
  { id:'skip', label:'ฉันข้ามขั้น' },
  { id:'fast', label:'ฉันรีบเกินไป' },
  { id:'soap', label:'ฉันใช้สบู่/ฟองไม่พอ' },
  { id:'boss', label:'ฉันพลาดจุดอับสำคัญ' }
];
const IMPROVES = [
  { id:'wet', label:'ทำให้เปียกทั่วก่อน' },
  { id:'rinse', label:'ล้างฟองให้หมด' },
  { id:'dry', label:'เช็ดจุดอับให้แห้ง' },
  { id:'boss', label:'ถูจุดอับให้ครบ' }
];

const TOOL_LABEL = {
  water:'น้ำ',
  soap:'สบู่',
  scrub:'ถูจุดอับ',
  rinse:'ล้างฟอง',
  towel:'ผ้าขนหนู',
  dress:'เสื้อ'
};

const SPOTS = {
  front: [
    { id:'neck', label:'คอ', x:50, y:22, hard:2, boss:false, part:'torso' },
    { id:'armpitL', label:'รักแร้ซ้าย', x:30, y:34, hard:3, boss:true, part:'armL' },
    { id:'armpitR', label:'รักแร้ขวา', x:70, y:34, hard:3, boss:true, part:'armR' },
    { id:'elbowL', label:'ข้อพับแขนซ้าย', x:20, y:46, hard:2, boss:false, part:'armL' },
    { id:'elbowR', label:'ข้อพับแขนขวา', x:80, y:46, hard:2, boss:false, part:'armR' },
    { id:'kneeL', label:'ข้อพับขาซ้าย', x:46, y:73, hard:2, boss:false, part:'legL' },
    { id:'kneeR', label:'ข้อพับขาขวา', x:54, y:73, hard:2, boss:false, part:'legR' },
    { id:'toeL', label:'ซอกนิ้วเท้าซ้าย', x:46, y:93, hard:4, boss:true, part:'legL' },
    { id:'toeR', label:'ซอกนิ้วเท้าขวา', x:54, y:93, hard:4, boss:true, part:'legR' }
  ],
  back: [
    { id:'earL', label:'หลังหูซ้าย', x:40, y:14, hard:3, boss:true, part:'head' },
    { id:'earR', label:'หลังหูขวา', x:60, y:14, hard:3, boss:true, part:'head' },
    { id:'backNeck', label:'ท้ายทอย', x:50, y:18, hard:2, boss:false, part:'head' },
    { id:'backL', label:'หลังซ้าย', x:42, y:36, hard:2, boss:false, part:'torso' },
    { id:'backR', label:'หลังขวา', x:58, y:36, hard:2, boss:false, part:'torso' },
    { id:'waist', label:'เอว', x:50, y:52, hard:3, boss:true, part:'torso' },
    { id:'behindKneeL', label:'หลังเข่าซ้าย', x:44, y:76, hard:3, boss:true, part:'legL' },
    { id:'behindKneeR', label:'หลังเข่าขวา', x:56, y:76, hard:3, boss:true, part:'legR' },
    { id:'heelL', label:'ส้นเท้าซ้าย', x:46, y:94, hard:2, boss:false, part:'legL' },
    { id:'heelR', label:'ส้นเท้าขวา', x:54, y:94, hard:2, boss:false, part:'legR' }
  ]
};

const HINTS = {
  neck:'คอมีเหงื่อสะสมได้ ควรล้างให้ทั่ว',
  armpitL:'รักแร้เป็นจุดอับ ต้องถูให้สะอาด',
  armpitR:'รักแร้เป็นจุดอับ ต้องถูให้สะอาด',
  elbowL:'ข้อพับแขนมีเหงื่อสะสมได้',
  elbowR:'ข้อพับแขนมีเหงื่อสะสมได้',
  kneeL:'ข้อพับขาเป็นจุดอับ ควรถูให้ทั่ว',
  kneeR:'ข้อพับขาเป็นจุดอับ ควรถูให้ทั่ว',
  toeL:'ซอกนิ้วเท้าต้องล้างและเช็ดให้แห้ง',
  toeR:'ซอกนิ้วเท้าต้องล้างและเช็ดให้แห้ง',
  earL:'หลังหูเป็นจุดอับที่มักลืมล้าง',
  earR:'หลังหูเป็นจุดอับที่มักลืมล้าง',
  backNeck:'ท้ายทอยมีเหงื่อสะสมได้',
  backL:'หลังมีเหงื่อและคราบ',
  backR:'หลังมีเหงื่อและคราบ',
  waist:'เอวเป็นจุดอับที่ควรถูให้ดี',
  behindKneeL:'หลังเข่าเป็นจุดอับ ควรล้างและเช็ดให้แห้ง',
  behindKneeR:'หลังเข่าเป็นจุดอับ ควรล้างและเช็ดให้แห้ง',
  heelL:'ส้นเท้าควรล้างและเช็ดให้สะอาด',
  heelR:'ส้นเท้าควรล้างและเช็ดให้สะอาด'
};

const S = {
  sessionId: `bath_${PID}_${Date.now()}`,
  started:false,
  ended:false,
  mode:'standard',
  phase:0,
  phaseStartedAt:0,
  view:'front',
  timeLeft:TIME,

  cleanScore:0,
  residue:15,
  fungusRisk:10,
  sweat:0,
  readyPct:0,
  fever:0,

  combo:0,
  comboMax:0,
  feverOn:false,

  rtGood:[],
  rtEarly:[],
  rtLate:[],
  pressureBurst:0,
  fatiguePct:0,
  steadyPct:100,
  pressurePct:0,

  foamPower:0,
  wetHits:0,
  rinseHits:0,
  dryHits:0,
  fakeHits:0,
  oilHits:0,
  bossHits:0,
  bossFails:0,

  dragging:false,
  dragKind:'',
  dragSeen:new Set(),

  spotState:{},
  wetMap:{},
  foamMap:{},
  dryMap:{},
  targets:new Map(),
  tid:0,

  bossActive:false,
  bossHp:0,
  bossMax:0,
  bossSpotId:'',
  bossDeadline:0,

  quizIndex:0,
  quizCorrect:0,
  selfReason:'',
  selfRating:0,
  improvePick:'',

  beforeStats:{ residue:15, risk:10, sweat:0, clean:0 },
  aiSnapshot:null,
  plan:[]
};

function currentSpots(){
  return SPOTS[S.view] || [];
}
function resetSpotState(){
  S.spotState = {};
  S.wetMap = {};
  S.foamMap = {};
  S.dryMap = {};
  currentSpots().forEach(sp=>{
    S.spotState[sp.id] = { cleared:false, hits:0, misses:0, need:sp.hard, boss:!!sp.boss };
    S.wetMap[sp.id] = 0;
    S.foamMap[sp.id] = 0;
    S.dryMap[sp.id] = 0;
  });
  S.plan = currentSpots().map(s=>s.id);
}
function setCoach(text){
  if(UI.coachPill) UI.coachPill.textContent = `COACH: ${text}`.slice(0, 96);
}
function phaseName(p){
  const map = {
    PREP:'เตรียมตัว',
    WET:'ทำให้เปียก',
    SOAP:'ใช้สบู่',
    SCRUB:'ถูจุดอับ',
    RINSE:'ล้างฟอง',
    DRY:'เช็ดให้แห้ง',
    DRESS:'ใส่เสื้อ',
    END:'สรุปผล'
  };
  return map[p] || '—';
}
function currentToolLabel(){
  const p = PHASES[S.phase];
  if(p === 'WET') return TOOL_LABEL.water;
  if(p === 'SOAP') return TOOL_LABEL.soap;
  if(p === 'SCRUB') return TOOL_LABEL.scrub;
  if(p === 'RINSE') return TOOL_LABEL.rinse;
  if(p === 'DRY') return TOOL_LABEL.towel;
  if(p === 'DRESS') return TOOL_LABEL.dress;
  return '—';
}
function phaseQuest(){
  const p = PHASES[S.phase];
  if(p === 'WET') return 'ลากน้ำให้เปียกทั่ว';
  if(p === 'SOAP') return 'เก็บฟองจริง ระวังฟองหลอก';
  if(p === 'SCRUB') return 'เคลียร์จุดอับสำคัญ';
  if(p === 'RINSE') return 'ล้างฟองออกให้หมด';
  if(p === 'DRY') return 'เช็ดตัวให้แห้ง โดยเฉพาะจุดอับ';
  if(p === 'DRESS') return 'ใส่เสื้อเมื่อพร้อมจริง';
  return 'ช่วยอาบน้ำให้พร้อมออกไป';
}
function showPhaseBanner(text){
  if(!UI.phaseBanner) return;
  UI.phaseBanner.textContent = text;
  UI.phaseBanner.classList.remove('hidden');
  clearTimeout(showPhaseBanner._tm);
  showPhaseBanner._tm = setTimeout(()=>{
    UI.phaseBanner.classList.add('hidden');
  }, 1300);
}
function updatePhysicalProxy(){
  const early = avg(S.rtEarly), late = avg(S.rtLate);
  const drift = (S.rtEarly.length>=3 && S.rtLate.length>=3) ? (late-early) : 0;
  const rtStd = std(S.rtGood);
  const stead = clamp01(1 - (rtStd/420) - (S.pressureBurst/8));
  const press = clamp01((S.pressureBurst/5) + (S.sweat/280) + (S.fungusRisk/280));
  const fat = clamp01((drift/380) + (S.sweat/260));
  S.steadyPct = stead * 100;
  S.pressurePct = press * 100;
  S.fatiguePct = fat * 100;
}
function computeMastery(){
  const list = currentSpots();
  const total = list.length || 1;
  const cleared = list.reduce((a,sp)=> a + (S.spotState[sp.id]?.cleared ? 1 : 0), 0);
  const coveragePct = Math.round((cleared / total) * 100);

  const missionDone = coveragePct >= (S.mode === 'learn' ? 55 : 70);
  const rinsePass = S.residue <= (PRO ? 16 : 18);
  const dryPass = S.fungusRisk <= (PRO ? 22 : 25);
  const bossPass = S.bossFails === 0 || !S.bossSpotId;
  const pass = missionDone && rinsePass && dryPass && bossPass;

  return { pass, missionDone, rinsePass, dryPass, bossPass, coveragePct };
}
function computeRubric(){
  const m = computeMastery();
  return {
    pass:m.pass,
    cov:m.coveragePct,
    residue:Math.round(S.residue),
    risk:Math.round(S.fungusRisk),
    missionDone:m.missionDone,
    bossPass:m.bossPass,
    rinsePass:m.rinsePass,
    dryPass:m.dryPass
  };
}
function dragQuality(){
  const wet = Math.min(100, Math.round((S.wetHits / Math.max(1, currentSpots().length*3)) * 100));
  const rinse = Math.min(100, Math.round((S.rinseHits / Math.max(1, currentSpots().length*2.2)) * 100));
  const dry = Math.min(100, Math.round((S.dryHits / Math.max(1, currentSpots().length*2.2)) * 100));
  return { wet, rinse, dry };
}
function updateScores(){
  const mastery = computeMastery();
  let score = mastery.coveragePct
    - (S.residue * 0.45)
    - (S.fungusRisk * 0.45)
    + Math.min(18, S.comboMax * 0.8)
    + Math.min(12, S.fever * 0.12);

  if(!mastery.rinsePass) score = Math.min(score, 58);
  if(!mastery.dryPass) score = Math.min(score, 58);
  if(!mastery.bossPass) score = Math.min(score, 52);
  if(!mastery.missionDone) score = Math.min(score, 60);

  S.cleanScore = clamp(score, 0, 100);
  S.readyPct = clamp(
    S.cleanScore
    + (mastery.rinsePass ? 10 : 0)
    + (mastery.dryPass ? 10 : 0)
    + (mastery.bossPass ? 10 : 0),
    0, 100
  );
}
function updateHUD(){
  updateScores();
  updatePhysicalProxy();
  const p = PHASES[S.phase];

  if(UI.phasePill) UI.phasePill.textContent = `ขั้นตอน: ${phaseName(p)}`;
  if(UI.questPill) UI.questPill.textContent = `ภารกิจ: ${phaseQuest()}`;
  if(UI.timePill) UI.timePill.textContent = `TIME: ${Math.max(0, Math.ceil(S.timeLeft))}`;
  if(UI.cleanPill) UI.cleanPill.textContent = `สะอาดแล้ว: ${Math.round(S.cleanScore)}%`;
  if(UI.rubricPill) UI.rubricPill.textContent = `RUBRIC: ${computeRubric().pass ? 'PASS' : 'TRY AGAIN'}`;
  if(UI.toolPill) UI.toolPill.textContent = `อุปกรณ์: ${currentToolLabel()}`;
  if(UI.foamPill) UI.foamPill.textContent = `SOAP POWER: ${Math.round(S.foamPower)}`;
  if(UI.residuePill) UI.residuePill.textContent = `ฟองค้าง: ${Math.round(S.residue)}%`;
  if(UI.riskPill) UI.riskPill.textContent = `เสี่ยงอับชื้น: ${Math.round(S.fungusRisk)}%`;
  if(UI.meterPill) UI.meterPill.textContent = `เหงื่อ: ${Math.round(S.sweat)}%`;
  if(UI.viewPill) UI.viewPill.textContent = `VIEW: ${S.view.toUpperCase()}`;
  if(UI.comboPill) UI.comboPill.textContent = `COMBO: ${S.combo}`;
  if(UI.bossPill){
    UI.bossPill.textContent = S.bossActive ? `BOSS: ${S.bossHp}/${S.bossMax}` : 'BOSS: —';
  }

  if(UI.fatiguePill) UI.fatiguePill.textContent = `FATIGUE: ${Math.round(S.fatiguePct)}%`;
  if(UI.steadyPill) UI.steadyPill.textContent = `STEADY: ${Math.round(S.steadyPct)}%`;
  if(UI.pressurePill) UI.pressurePill.textContent = `PRESSURE: ${Math.round(S.pressurePct)}%`;

  const mastery = computeMastery();
  if(UI.progressBar) UI.progressBar.style.width = `${mastery.coveragePct}%`;
  if(UI.readyBar) UI.readyBar.style.width = `${Math.round(S.readyPct)}%`;
  if(UI.feverBar) UI.feverBar.style.width = `${Math.round(S.fever)}%`;
}
function comboPlus(v=1){
  S.combo += v;
  S.comboMax = Math.max(S.comboMax, S.combo);
  S.fever = clamp(S.fever + 4 + v, 0, 100);
  S.feverOn = S.fever >= 70;
}
function comboBreak(){
  if(S.combo >= 4) S.pressureBurst += 1;
  S.combo = 0;
  S.fever = clamp(S.fever - 10, 0, 100);
  S.feverOn = S.fever >= 70;
}
function feverMultiplier(){
  return S.feverOn ? 1.35 : 1;
}
function partNode(part){
  return UI.silhouetteOverlay?.querySelector(`[data-part="${part}"]`);
}
function renderOverlay(){
  if(!UI.silhouetteOverlay) return;
  const parts = ['head','torso','armL','armR','legL','legR'];
  parts.forEach(part=>{
    const el = partNode(part);
    if(!el) return;
    el.classList.remove('wet','foam','dry');
    el.style.opacity = '0';
  });

  const buckets = {
    head:{wet:0,foam:0,dry:0,n:0},
    torso:{wet:0,foam:0,dry:0,n:0},
    armL:{wet:0,foam:0,dry:0,n:0},
    armR:{wet:0,foam:0,dry:0,n:0},
    legL:{wet:0,foam:0,dry:0,n:0},
    legR:{wet:0,foam:0,dry:0,n:0}
  };
  currentSpots().forEach(sp=>{
    const b = buckets[sp.part];
    if(!b) return;
    b.wet += (S.wetMap[sp.id] || 0);
    b.foam += (S.foamMap[sp.id] || 0);
    b.dry += (S.dryMap[sp.id] || 0);
    b.n += 1;
  });

  Object.keys(buckets).forEach(part=>{
    const el = partNode(part);
    const b = buckets[part];
    if(!el || !b.n) return;

    const wet = b.wet / b.n;
    const foam = b.foam / b.n;
    const dry = b.dry / b.n;

    const p = PHASES[S.phase];
    if(p === 'WET' && wet > 0.15){
      el.classList.add('wet');
      el.style.opacity = String(Math.min(.9, .18 + wet * .72));
    }else if((p === 'SOAP' || p === 'SCRUB' || p === 'RINSE') && foam > 0.15){
      el.classList.add('foam');
      el.style.opacity = String(Math.min(.9, .18 + foam * .72));
    }else if((p === 'DRY' || p === 'DRESS') && dry > 0.15){
      el.classList.add('dry');
      el.style.opacity = String(Math.min(.9, .18 + dry * .72));
    }
  });
}
function renderStateLayer(){
  if(!UI.stateLayer || !UI.guideLayer) return;
  UI.stateLayer.innerHTML = '';
  UI.guideLayer.innerHTML = '';

  currentSpots().forEach(sp=>{
    const p = PHASES[S.phase];
    const wet = S.wetMap[sp.id] || 0;
    const foam = S.foamMap[sp.id] || 0;
    const dry = S.dryMap[sp.id] || 0;

    let type = '', icon = '';
    if(p === 'WET' && wet > 0.15){ type='wet'; icon='💧'; }
    if((p === 'SOAP' || p === 'SCRUB' || p === 'RINSE') && foam > 0.18){ type='foam'; icon='🫧'; }
    if((p === 'DRY' || p === 'DRESS') && dry > 0.18){ type='dry'; icon='🧻'; }

    if(type){
      const el = D.createElement('div');
      el.className = `stateDot ${type}`;
      el.style.left = `${sp.x}%`;
      el.style.top = `${sp.y}%`;
      el.textContent = icon;
      UI.stateLayer.appendChild(el);
    }
  });

  const guide = currentGuideSpots();
  guide.forEach(sp=>{
    const el = D.createElement('div');
    el.className = 'guideArrow';
    el.style.left = `${sp.x}%`;
    el.style.top = `${sp.y}%`;
    el.textContent = '➡';
    UI.guideLayer.appendChild(el);
  });

  renderOverlay();
}
function currentGuideSpots(){
  const p = PHASES[S.phase];
  const list = currentSpots();

  if(p === 'WET'){
    return list.filter(sp => (S.wetMap[sp.id] || 0) < 0.55).slice(0,3);
  }
  if(p === 'SOAP'){
    return list.filter(sp => (S.foamMap[sp.id] || 0) < 0.4).slice(0,3);
  }
  if(p === 'SCRUB'){
    return list.filter(sp => !S.spotState[sp.id]?.cleared).slice(0,3);
  }
  if(p === 'RINSE'){
    return list.filter(sp => (S.foamMap[sp.id] || 0) > 0.22).slice(0,3);
  }
  if(p === 'DRY'){
    return list.filter(sp => (S.dryMap[sp.id] || 0) < 0.55).slice(0,3);
  }
  return [];
}
function clearTargets(){
  if(UI.targetLayer) UI.targetLayer.innerHTML = '';
  S.targets.clear();
}
function removeTarget(id){
  const t = S.targets.get(id);
  if(!t) return;
  try{ t.el.remove(); }catch(e){}
  S.targets.delete(id);
}
function makeTarget({kind,label,x,y,spotId='',ttlMs=1400,hitsNeed=1,boss=false}){
  const id = `t${++S.tid}`;
  const el = D.createElement('div');
  el.className = `target ${kind}${boss ? ' boss' : ''}`;
  el.style.left = `${x}%`;
  el.style.top  = `${y}%`;
  el.innerHTML = `
    <div class="ico">${label}</div>
    <div class="tag">${spotId ? (currentSpots().find(s=>s.id===spotId)?.label || '') : ''}</div>
  `;
  const target = {
    id, el, kind, label, x, y, spotId,
    bornAt: now(),
    ttlAt: now() + ttlMs,
    hits:0,
    hitsNeed,
    boss
  };
  el.addEventListener('pointerdown', e=>{
    e.preventDefault();
    handleTargetHit(id);
  }, {passive:false});
  UI.targetLayer.appendChild(el);
  S.targets.set(id, target);
  return target;
}
function spawnSoapTarget(){
  const fakeRateBase = DIFF === 'hard' ? .30 : DIFF === 'easy' ? .12 : .18;
  const fakeRate = S.mode === 'learn' ? fakeRateBase * 0.45 : fakeRateBase;
  const isFake = rng() < fakeRate;
  makeTarget({
    kind:isFake ? 'bad' : 'good',
    label:'🫧',
    x:22 + rng()*56,
    y:18 + rng()*70,
    ttlMs:S.mode === 'learn' ? 1700 : (PRO ? 1150 : 1400),
    hitsNeed:1
  }).isFake = isFake;
}
function pickScrubSpot(){
  const list = currentSpots().filter(sp => !S.spotState[sp.id]?.cleared);
  if(!list.length) return null;
  list.sort((a,b)=>{
    const wa = (S.spotState[a.id]?.need || a.hard) + (a.boss ? 1.2 : 0);
    const wb = (S.spotState[b.id]?.need || b.hard) + (b.boss ? 1.2 : 0);
    return wb - wa;
  });
  if(S.mode === 'learn') return list[0];
  return list[(rng() * Math.min(4, list.length)) | 0];
}
function spawnScrubTarget(){
  const spot = pickScrubSpot();
  if(!spot) return;
  const p = scrubStage();

  if(p === 'trick' && rng() < (S.mode === 'learn' ? .18 : .38)){
    makeTarget({
      kind:'bad',
      label:'🛢️',
      x:spot.x + (rng()*8-4),
      y:spot.y + (rng()*8-4),
      ttlMs:PRO ? 1300 : 1500
    });
    return;
  }

  if(p === 'boss' && spot.boss && !S.bossActive){
    spawnBoss(spot);
    return;
  }

  makeTarget({
    kind:'warn',
    label:'✨',
    x:spot.x + (rng()*6-3),
    y:spot.y + (rng()*6-3),
    spotId:spot.id,
    ttlMs:S.mode === 'learn' ? 2000 : (PRO ? 1450 : 1750),
    hitsNeed:Math.max(1, spot.hard - (S.feverOn ? 1 : 0))
  });
}
function spawnBoss(spot){
  S.bossActive = true;
  S.bossSpotId = spot.id;
  S.bossMax = spot.hard + (PRO ? 3 : 2) + (DIFF === 'hard' ? 2 : 0);
  S.bossHp = S.bossMax;
  S.bossDeadline = now() + (S.mode === 'learn' ? 6800 : (PRO ? 4600 : 5800));
  makeTarget({
    kind:'boss',
    label:'😷',
    x:spot.x,
    y:spot.y,
    spotId:spot.id,
    ttlMs:S.bossDeadline - now(),
    hitsNeed:S.bossHp,
    boss:true
  });
  setCoach(`บอสมาแล้ว! โฟกัส ${spot.label}`);
  showPhaseBanner(`BOSS: ${spot.label}`);
}
function spawnDressTarget(){
  makeTarget({
    kind:'good',
    label:'👕',
    x:50,
    y:56,
    ttlMs:1800
  });
}
function scrubStage(){
  const cleared = currentSpots().reduce((a,sp)=> a + (S.spotState[sp.id]?.cleared ? 1 : 0), 0);
  const total = currentSpots().length || 1;
  const pct = cleared / total;
  if(pct < .35) return 'warm';
  if(pct < .75) return 'trick';
  return 'boss';
}
function percentPointFromClient(clientX, clientY){
  const box = UI.bodyWrap.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * 100;
  const y = ((clientY - box.top) / box.height) * 100;
  if(x < 0 || x > 100 || y < 0 || y > 100) return null;
  return {x,y};
}
function nearestSpot(pt){
  let best = null, bestD = Infinity;
  currentSpots().forEach(sp=>{
    const dx = sp.x - pt.x;
    const dy = sp.y - pt.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if(d < bestD){
      best = sp;
      bestD = d;
    }
  });
  return bestD <= 14 ? best : null;
}
function cursorIconForPhase(){
  const p = PHASES[S.phase];
  if(p === 'WET') return { icon:'💧', cls:'wet' };
  if(p === 'SOAP') return { icon:'🧼', cls:'soap' };
  if(p === 'SCRUB') return { icon:'🫧', cls:'scrub' };
  if(p === 'RINSE') return { icon:'🚿', cls:'rinse' };
  if(p === 'DRY') return { icon:'🧻', cls:'dry' };
  if(p === 'DRESS') return { icon:'👕', cls:'dress' };
  return { icon:'•', cls:'' };
}
function showCursor(clientX, clientY){
  if(!UI.toolCursor) return;
  const box = UI.bodyWrap.getBoundingClientRect();
  UI.toolCursor.className = '';
  UI.toolCursor.id = 'tool-cursor';
  const c = cursorIconForPhase();
  if(c.cls) UI.toolCursor.classList.add(c.cls);
  UI.toolCursor.textContent = c.icon;
  UI.toolCursor.classList.add('show');
  UI.toolCursor.style.left = `${clientX - box.left}px`;
  UI.toolCursor.style.top = `${clientY - box.top}px`;
}
function hideCursor(){
  if(UI.toolCursor) UI.toolCursor.classList.remove('show');
}
function activeDragKind(){
  const p = PHASES[S.phase];
  if(p === 'WET') return 'wet';
  if(p === 'RINSE') return 'rinse';
  if(p === 'DRY') return 'dry';
  return '';
}
function beginDrag(kind){
  if(!kind || !S.started || S.ended) return;
  S.dragging = true;
  S.dragKind = kind;
  S.dragSeen = new Set();
}
function endDrag(){
  S.dragging = false;
  S.dragKind = '';
  S.dragSeen = new Set();
}
function applyDragToSpot(spot, kind){
  if(!spot) return;
  const key = `${kind}:${spot.id}`;
  if(S.dragSeen.has(key)) return;
  S.dragSeen.add(key);

  if(kind === 'wet'){
    S.wetHits += 1;
    comboPlus(1);
    S.sweat = clamp(S.sweat - 0.20, 0, 100);
    S.wetMap[spot.id] = clamp((S.wetMap[spot.id] || 0) + (0.20 * feverMultiplier()), 0, 1);
    if(S.wetMap[spot.id] > 0.72) S.foamMap[spot.id] = clamp((S.foamMap[spot.id] || 0) + 0.04, 0, 1);
  }
  if(kind === 'rinse'){
    S.rinseHits += 1;
    comboPlus(1);
    S.residue = clamp(S.residue - (1.20 * feverMultiplier()), 0, 100);
    S.foamMap[spot.id] = clamp((S.foamMap[spot.id] || 0) - 0.28, 0, 1);
    S.wetMap[spot.id] = clamp((S.wetMap[spot.id] || 0) + 0.06, 0, 1);
  }
  if(kind === 'dry'){
    S.dryHits += 1;
    comboPlus(1);
    S.fungusRisk = clamp(S.fungusRisk - (1.10 * feverMultiplier()), 0, 100);
    S.dryMap[spot.id] = clamp((S.dryMap[spot.id] || 0) + 0.25, 0, 1);
    S.wetMap[spot.id] = clamp((S.wetMap[spot.id] || 0) - 0.16, 0, 1);
  }

  if(S.mode === 'learn'){
    setCoach(HINTS[spot.id] || 'ทำจุดนี้ให้ครบ');
  }

  updateHUD();
  renderStateLayer();
}
function onBodyPointer(clientX, clientY){
  showCursor(clientX, clientY);
  if(!S.dragging || !S.dragKind) return;
  const pt = percentPointFromClient(clientX, clientY);
  if(!pt) return;
  const spot = nearestSpot(pt);
  if(!spot) return;
  applyDragToSpot(spot, S.dragKind);
}
function handleTargetHit(id){
  const t = S.targets.get(id);
  if(!t || !S.started || S.ended) return;

  const rt = Math.max(0, Math.round(now() - t.bornAt));
  S.rtGood.push(rt);

  const elapsed = TIME - S.timeLeft;
  if(elapsed <= TIME*0.33) S.rtEarly.push(rt);
  else if(elapsed >= TIME*0.66) S.rtLate.push(rt);

  const p = PHASES[S.phase];

  if(p === 'SOAP'){
    if(t.kind === 'good'){
      S.foamPower = clamp(S.foamPower + (12 * feverMultiplier()), 0, 100);
      const spot = nearestSpot({x:t.x,y:t.y});
      if(spot) S.foamMap[spot.id] = clamp((S.foamMap[spot.id] || 0) + 0.32, 0, 1);
      comboPlus(1);
      setCoach('ดีมาก ได้ฟองจริง');
      removeTarget(id);
    }else{
      S.fakeHits += 1;
      S.residue = clamp(S.residue + 2.2, 0, 100);
      S.sweat = clamp(S.sweat + 0.9, 0, 100);
      comboBreak();
      setCoach('ฟองหลอก! เลือกฟองจริงเท่านั้น');
      removeTarget(id);
    }
    updateHUD();
    renderStateLayer();
    return;
  }

  if(p === 'SCRUB'){
    if(t.kind === 'bad'){
      S.oilHits += 1;
      S.residue = clamp(S.residue + 3.2, 0, 100);
      S.sweat = clamp(S.sweat + 1.6, 0, 100);
      comboBreak();
      setCoach('โดนคราบหลอก! โฟกัสจุดอับจริง');
      removeTarget(id);
      updateHUD();
      renderStateLayer();
      return;
    }

    if(t.boss){
      t.hits += 1;
      S.bossHits += 1;
      comboPlus(2);
      S.bossHp = Math.max(0, S.bossHp - 1);
      setCoach(`ถูต่อ! ${currentSpots().find(s=>s.id===t.spotId)?.label || 'จุดอับ'} ยังไม่หมด`);
      if(S.bossHp <= 0){
        S.spotState[t.spotId].cleared = true;
        S.residue = clamp(S.residue - 8, 0, 100);
        S.bossActive = false;
        S.bossSpotId = '';
        setCoach('ชนะบอส! จุดอับนี้สะอาดแล้ว');
        removeTarget(id);
      }
      updateHUD();
      renderStateLayer();
      return;
    }

    if(t.kind === 'warn'){
      t.hits += 1;
      comboPlus(1);
      S.spotState[t.spotId].hits += 1;
      if(t.hits >= t.hitsNeed){
        S.spotState[t.spotId].cleared = true;
        S.residue = clamp(S.residue - (2.6 * feverMultiplier()), 0, 100);
        setCoach(HINTS[t.spotId] || 'เคลียร์จุดอับแล้ว');
        removeTarget(id);
      }
      updateHUD();
      renderStateLayer();
      return;
    }
  }

  if(p === 'DRESS'){
    if(computeMastery().pass){
      comboPlus(2);
      removeTarget(id);
      endGame('complete');
    }else{
      comboBreak();
      if(!computeMastery().rinsePass) setCoach('ยังมีฟองค้าง ต้องล้างก่อน');
      else if(!computeMastery().dryPass) setCoach('ยังชื้นอยู่ ต้องเช็ดให้แห้งก่อน');
      else if(!computeMastery().missionDone) setCoach('ยังมีจุดอับที่ต้องจัดการ');
      else setCoach('ยังไม่พร้อมใส่เสื้อ');
    }
  }
}
function phaseGate(){
  const p = PHASES[S.phase];
  const list = currentSpots();

  if(p === 'WET'){
    const wetAvg = avg(list.map(sp => S.wetMap[sp.id] || 0));
    return wetAvg >= (S.mode === 'learn' ? 0.45 : 0.58);
  }
  if(p === 'SOAP'){
    return S.foamPower >= (S.mode === 'learn' ? 28 : 36);
  }
  if(p === 'SCRUB'){
    return computeMastery().coveragePct >= (S.mode === 'learn' ? 55 : 70) && !S.bossActive;
  }
  if(p === 'RINSE'){
    return S.residue <= (S.mode === 'learn' ? 24 : 18);
  }
  if(p === 'DRY'){
    return S.fungusRisk <= (S.mode === 'learn' ? 30 : 25);
  }
  if(p === 'DRESS'){
    return false;
  }
  return false;
}
function enterPhase(i){
  S.phase = i;
  S.phaseStartedAt = now();
  clearTargets();

  const p = PHASES[S.phase];
  showPhaseBanner(phaseName(p));

  if(p === 'WET'){
    setCoach('ลากน้ำให้เปียกทั่ว โดยเฉพาะจุดอับ');
  }
  if(p === 'SOAP'){
    setCoach('เก็บฟองจริง ระวังฟองหลอก');
  }
  if(p === 'SCRUB'){
    setCoach('ถูจุดอับสำคัญให้ครบ');
  }
  if(p === 'RINSE'){
    setCoach('ล้างฟองออกให้หมด');
  }
  if(p === 'DRY'){
    setCoach('เช็ดให้แห้ง โดยเฉพาะจุดอับ');
  }
  if(p === 'DRESS'){
    setCoach('ถ้าพร้อมจริง จะใส่เสื้อได้');
    spawnDressTarget();
  }

  updateHUD();
  renderStateLayer();
}
function nextPhase(){
  const next = Math.min(S.phase + 1, PHASES.length - 1);
  if(next !== S.phase) enterPhase(next);
}
function spawnLoop(){
  const p = PHASES[S.phase];
  if(p === 'SOAP'){
    if(S.targets.size < (S.mode === 'learn' ? 2 : 3)) spawnSoapTarget();
  }
  if(p === 'SCRUB'){
    if(S.bossActive && now() > S.bossDeadline){
      S.bossFails += 1;
      S.residue = clamp(S.residue + 7, 0, 100);
      S.sweat = clamp(S.sweat + 3, 0, 100);
      S.bossActive = false;
      comboBreak();
      setCoach('บอสหนี! คราบกระจาย ต้องรีบแก้');
      clearTargets();
    }
    if(S.targets.size < (S.mode === 'learn' ? 2 : 3)) spawnScrubTarget();
  }
}
function tick(){
  if(!S.started || S.ended) return;

  const t = now();
  if(!tick._last) tick._last = t;
  const dt = Math.min(50, Math.max(0, t - tick._last)) / 1000;
  tick._last = t;

  S.timeLeft = Math.max(0, S.timeLeft - dt);
  if(S.timeLeft <= 0){
    endGame('timeout');
    return;
  }

  S.sweat = clamp(S.sweat + (S.mode === 'learn' ? 0.012 : 0.018), 0, 100);
  if(S.fever > 0) S.fever = clamp(S.fever - 0.12, 0, 100);
  S.feverOn = S.fever >= 70;

  for(const [id,tg] of S.targets.entries()){
    if(now() >= tg.ttlAt){
      if(tg.kind === 'warn' && tg.spotId){
        S.spotState[tg.spotId].misses += 1;
        comboBreak();
      }
      removeTarget(id);
    }
  }

  if(phaseGate()){
    const p = PHASES[S.phase];
    const spent = (now() - S.phaseStartedAt) / 1000;
    const min = p === 'WET' ? 5 : p === 'SOAP' ? 4 : p === 'SCRUB' ? 8 : p === 'RINSE' ? 5 : p === 'DRY' ? 5 : 1;
    if(spent >= min){
      nextPhase();
    }
  }

  if(PHASES[S.phase] === 'DRESS' && computeMastery().pass && S.targets.size === 0){
    spawnDressTarget();
  }

  updateHUD();
  renderStateLayer();
  spawnLoop();
  requestAnimationFrame(tick);
}
function renderQuiz(){
  const item = QUIZ[S.quizIndex];
  if(!item || !UI.quizBody) return;

  UI.quizBody.innerHTML = '';
  const q = D.createElement('div');
  q.style.fontWeight = '1000';
  q.style.marginBottom = '10px';
  q.textContent = `${S.quizIndex + 1}/3 — ${item.q}`;
  UI.quizBody.appendChild(q);

  item.a.forEach((txt, idx)=>{
    const b = D.createElement('button');
    b.className = 'chip';
    b.textContent = txt;
    b.addEventListener('click', ()=>{
      [...UI.quizBody.querySelectorAll('.chip')].forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      b.dataset.ok = String(idx === item.correct ? 1 : 0);
    });
    UI.quizBody.appendChild(b);
  });

  UI.btnQuizNext.textContent = (S.quizIndex === QUIZ.length - 1) ? 'เริ่มเกม' : 'ข้อถัดไป';
}
function showQuiz(mode){
  S.mode = mode;
  S.quizIndex = 0;
  S.quizCorrect = 0;
  UI.panelReady.classList.add('hidden');
  UI.panelQuiz.classList.remove('hidden');
  UI.btnQuizNext.dataset.mode = mode;
  renderQuiz();
}
function nextQuiz(){
  const picked = UI.quizBody.querySelector('.chip.on');
  if(!picked) return;
  if(String(picked.dataset.ok) === '1') S.quizCorrect += 1;

  if(S.quizIndex < QUIZ.length - 1){
    S.quizIndex += 1;
    renderQuiz();
    return;
  }

  UI.panelQuiz.classList.add('hidden');
  startGame(UI.btnQuizNext.dataset.mode || 'standard');
}
function resetGameState(){
  S.started = false;
  S.ended = false;
  S.sessionId = `bath_${PID}_${Date.now()}`;
  S.phase = 0;
  S.phaseStartedAt = 0;
  S.view = 'front';
  S.timeLeft = TIME;

  S.cleanScore = 0;
  S.residue = 15;
  S.fungusRisk = 10;
  S.sweat = 0;
  S.readyPct = 0;
  S.fever = 0;
  S.feverOn = false;

  S.combo = 0;
  S.comboMax = 0;

  S.rtGood = [];
  S.rtEarly = [];
  S.rtLate = [];
  S.pressureBurst = 0;
  S.fatiguePct = 0;
  S.steadyPct = 100;
  S.pressurePct = 0;

  S.foamPower = 0;
  S.wetHits = 0;
  S.rinseHits = 0;
  S.dryHits = 0;
  S.fakeHits = 0;
  S.oilHits = 0;
  S.bossHits = 0;
  S.bossFails = 0;

  S.dragging = false;
  S.dragKind = '';
  S.dragSeen = new Set();

  S.targets = new Map();
  S.tid = 0;

  S.bossActive = false;
  S.bossHp = 0;
  S.bossMax = 0;
  S.bossSpotId = '';
  S.bossDeadline = 0;

  S.selfReason = '';
  S.selfRating = 0;
  S.improvePick = '';
  S.beforeStats = { residue:15, risk:10, sweat:0, clean:0 };
  S.aiSnapshot = null;

  resetSpotState();
  clearTargets();
}
function startGame(mode='standard'){
  resetGameState();
  S.mode = mode;
  S.started = true;
  S.phase = 0;
  UI.panelEnd.classList.add('hidden');
  UI.panelHelp.classList.add('hidden');
  enterPhase(1);
  tick._last = 0;
  requestAnimationFrame(tick);
}
function flipView(){
  S.view = S.view === 'front' ? 'back' : 'front';
  resetSpotState();
  clearTargets();
  renderStateLayer();
  updateHUD();
}
function renderHeatmap(){
  UI.heatmap.innerHTML = '';
  currentSpots().forEach(sp=>{
    const st = S.spotState[sp.id];
    const base = st.cleared ? 92 : clamp(78 - st.misses*10 - (st.need*6), 0, 100);
    const cls = base >= 85 ? 'good' : base >= 60 ? 'mid' : 'bad';
    const el = D.createElement('div');
    el.className = `hm ${cls}`;
    el.innerHTML = `<div class="t">${sp.label}</div><div class="v">${Math.round(base)}%</div>`;
    UI.heatmap.appendChild(el);
  });
}
function renderChips(container, list, getter, setter){
  container.innerHTML = '';
  list.forEach(o=>{
    const b = D.createElement('button');
    b.className = `chip ${getter() === o.id ? 'on' : ''}`;
    b.textContent = o.label;
    b.addEventListener('click', ()=>{
      setter(o.id);
      renderChips(container, list, getter, setter);
    });
    container.appendChild(b);
  });
}
function renderStars(){
  UI.stars.innerHTML = '';
  for(let i=1;i<=5;i++){
    const b = D.createElement('button');
    b.className = `star ${S.selfRating >= i ? 'on' : ''}`;
    b.textContent = '★';
    b.addEventListener('click', ()=>{
      S.selfRating = i;
      renderStars();
    });
    UI.stars.appendChild(b);
  }
}
function movePlan(idx, dir){
  const j = idx + dir;
  if(j < 0 || j >= S.plan.length) return;
  [S.plan[idx], S.plan[j]] = [S.plan[j], S.plan[idx]];
  renderPlan();
}
function renderPlan(){
  UI.planList.innerHTML = '';
  S.plan.forEach((id, idx)=>{
    const sp = currentSpots().find(x=>x.id===id) || { id, label:id };
    const row = D.createElement('div');
    row.className = 'planItem';
    row.innerHTML = `<div class="name">${idx+1}. ${sp.label}</div>`;
    const btns = D.createElement('div');
    btns.className = 'planBtns';

    const up = D.createElement('button');
    up.className = 'pbtn';
    up.textContent = '▲';
    up.addEventListener('click', ()=> movePlan(idx,-1));

    const down = D.createElement('button');
    down.className = 'pbtn';
    down.textContent = '▼';
    down.addEventListener('click', ()=> movePlan(idx,1));

    btns.appendChild(up);
    btns.appendChild(down);
    row.appendChild(btns);
    UI.planList.appendChild(row);
  });
}
function learningLines(){
  const out = [];
  const m = computeMastery();
  const dq = dragQuality();

  out.push(dq.wet >= 55 ? 'หนูทำให้ตัวเปียกได้ค่อนข้างทั่ว' : 'หนูยังทำให้ตัวเปียกไม่ทั่วพอ');
  out.push(m.rinsePass ? 'หนูล้างฟองออกได้ดี' : 'หนูยังล้างฟองออกไม่หมด');
  out.push(m.dryPass ? 'หนูเช็ดตัวได้แห้งดี' : 'หนูยังเช็ดจุดอับไม่แห้งพอ');
  out.push(m.bossPass ? 'หนูจัดการจุดอับสำคัญได้ดี' : 'จุดอับสำคัญยังต้องฝึกเพิ่ม');

  return out;
}
function weakSpotList(){
  return currentSpots()
    .map(sp=>{
      const st = S.spotState[sp.id] || {};
      const score = (st.cleared ? 0 : 1) + ((st.misses || 0) * 0.45);
      return { id:sp.id, label:sp.label, score };
    })
    .sort((a,b)=>b.score - a.score)
    .slice(0,3);
}
function computeBadges(){
  const badges = [];
  const dq = dragQuality();
  const m = computeMastery();

  if(dq.wet >= 70) badges.push({ icon:'💧', title:'เปียกทั่ว', desc:'ทำให้ร่างกายเปียกได้ทั่ว' });
  if(m.rinsePass && dq.rinse >= 70) badges.push({ icon:'🚿', title:'ล้างเก่ง', desc:'ล้างฟองออกได้ดี' });
  if(m.dryPass && dq.dry >= 70) badges.push({ icon:'🧻', title:'เช็ดแห้งดี', desc:'เช็ดตัวได้แห้งดี' });
  if(m.bossPass) badges.push({ icon:'🏅', title:'พิชิตจุดอับ', desc:'ผ่านจุดอับสำคัญ' });
  if(m.pass) badges.push({ icon:'🏆', title:'พร้อมออกไป', desc:'อาบน้ำครบขั้นและพร้อมจริง' });

  if(!badges.length){
    badges.push({ icon:'🌱', title:'กำลังพัฒนา', desc:'ลองอีกครั้งเพื่อเก่งขึ้น' });
  }
  return badges;
}
function renderBadges(){
  UI.badgeShelf.innerHTML = '';
  computeBadges().forEach(b=>{
    const el = D.createElement('div');
    el.className = 'badgeCard';
    el.innerHTML = `
      <div class="badgeIcon">${b.icon}</div>
      <div class="badgeBody">
        <div class="badgeTitle">${b.title}</div>
        <div class="badgeDesc">${b.desc}</div>
      </div>
    `;
    UI.badgeShelf.appendChild(el);
  });
}
function renderRubric(){
  const r = computeRubric();
  UI.selfRubric.textContent = `RUBRIC: ${r.pass ? 'PASS' : 'TRY AGAIN'}`;
  UI.rubricDesc.textContent =
    `Coverage ${r.cov}% • ฟองค้าง ${r.residue}% • เสี่ยงอับชื้น ${r.risk}% • Mission ${r.missionDone ? 'PASS' : 'FAIL'} • Boss ${r.bossPass ? 'PASS' : 'FAIL'} • Rinse ${r.rinsePass ? 'PASS' : 'FAIL'} • Dry ${r.dryPass ? 'PASS' : 'FAIL'}`;
}
function renderBeforeAfter(){
  UI.baBeforeResidue.textContent = `${Math.round(S.beforeStats.residue)}%`;
  UI.baBeforeRisk.textContent = `${Math.round(S.beforeStats.risk)}%`;
  UI.baBeforeSweat.textContent = `${Math.round(S.beforeStats.sweat)}%`;
  UI.baBeforeClean.textContent = `${Math.round(S.beforeStats.clean)}%`;

  UI.baAfterResidue.textContent = `${Math.round(S.residue)}%`;
  UI.baAfterRisk.textContent = `${Math.round(S.fungusRisk)}%`;
  UI.baAfterSweat.textContent = `${Math.round(S.sweat)}%`;
  UI.baAfterClean.textContent = `${Math.round(S.cleanScore)}%`;
}
function renderAIExplain(){
  const weak = weakSpotList().map(x=>x.label);
  let tip = 'ทำตามลำดับ เปียก → ฟอก → ถู → ล้าง → เช็ด → ใส่เสื้อ';
  if(!computeMastery().rinsePass) tip = 'ตอนนี้ควรฝึกล้างฟองให้หมด';
  else if(!computeMastery().dryPass) tip = 'ตอนนี้ควรฝึกเช็ดจุดอับให้แห้ง';
  else if(!computeMastery().bossPass) tip = 'ตอนนี้ควรฝึกจุดอับสำคัญให้ครบ';
  else if(computeMastery().pass) tip = 'ดีมาก หนูอาบน้ำได้ถูกขั้นแล้ว';

  UI.aiTipPill.textContent = `AI TIP: ${tip}`;
  UI.aiCauseChips.innerHTML = '';
  weak.forEach(w=>{
    const c = D.createElement('div');
    c.className = 'chip on';
    c.textContent = w;
    UI.aiCauseChips.appendChild(c);
  });
  UI.aiMetaText.textContent =
    `หลักฐาน: coverage ${computeMastery().coveragePct}% • residue ${Math.round(S.residue)}% • risk ${Math.round(S.fungusRisk)}% • comboMax ${S.comboMax} • fakeHits ${S.fakeHits} • bossFails ${S.bossFails}`;
}
function renderTeacherSummary(){
  UI.teacherSummary.innerHTML = '';

  const dq = dragQuality();
  const m = computeMastery();
  const weak = weakSpotList();

  const blocks = [
    {
      title:'ภาพรวม',
      text:`สะอาดแล้ว ${Math.round(S.cleanScore)}% • ฟองค้าง ${Math.round(S.residue)}% • เสี่ยงอับชื้น ${Math.round(S.fungusRisk)}% • Wet ${dq.wet}% • Rinse ${dq.rinse}% • Dry ${dq.dry}%`
    },
    {
      title:'จุดเด่น',
      chips:[
        dq.wet >= 70 ? 'ทำให้เปียกได้ทั่ว' : '',
        m.rinsePass ? 'ล้างฟองได้ดี' : '',
        m.dryPass ? 'เช็ดแห้งได้ดี' : '',
        m.bossPass ? 'ผ่านจุดอับสำคัญ' : ''
      ].filter(Boolean)
    },
    {
      title:'จุดที่ควรเสริม',
      chips:weak.map(x=>x.label)
    },
    {
      title:'ข้อเสนอแนะสำหรับครู',
      text:[
        !m.rinsePass ? 'ฝึกขั้น RINSE เพิ่ม' : '',
        !m.dryPass ? 'ฝึกเช็ดจุดอับให้แห้ง' : '',
        !m.bossPass ? 'ฝึกจุดอับสำคัญ เช่น หลังหู/ซอกนิ้วเท้า' : '',
        dq.wet < 50 ? 'ฝึกทำให้เปียกทั่วมากขึ้น' : ''
      ].filter(Boolean).join(' • ') || 'ผู้เรียนทำได้ดี สามารถขยับไปโหมดที่ท้าทายขึ้นได้'
    }
  ];

  blocks.forEach(b=>{
    const card = D.createElement('div');
    card.className = 'tsCard';
    card.innerHTML = `<div class="tsTitle">${b.title}</div>`;
    if(b.text){
      const txt = D.createElement('div');
      txt.className = 'tsText';
      txt.textContent = b.text;
      card.appendChild(txt);
    }
    if(b.chips){
      const list = D.createElement('div');
      list.className = 'tsList';
      (b.chips.length ? b.chips : ['-']).forEach(x=>{
        const c = D.createElement('div');
        c.className = 'tsChip';
        c.textContent = x;
        list.appendChild(c);
      });
      card.appendChild(list);
    }
    UI.teacherSummary.appendChild(card);
  });
}
function saveBathLastSummary(reason){
  const payload = {
    game:'bath',
    ts: isoNow(),
    pid: PID,
    run: RUN,
    diff: DIFF,
    pro: !!PRO,
    mode: S.mode,
    view: S.view,
    reason,
    scoreFinal: Math.round(S.cleanScore),
    residue: Math.round(S.residue),
    fungusRisk: Math.round(S.fungusRisk),
    sweat: Math.round(S.sweat),
    mastery: computeMastery(),
    rubric: computeRubric(),
    dragQuality: dragQuality(),
    weakSpots: weakSpotList(),
    badges: computeBadges(),
    hub: HUB,
    seed: SEED
  };
  try{ localStorage.setItem(`HHA_LAST_SUMMARY:bath:${PID}`, JSON.stringify(payload)); }catch(e){}
}
function saveTeacherSummary(){
  try{
    localStorage.setItem(`HHA_BATH_TEACHER_SUMMARY:${PID}`, JSON.stringify({
      ts: isoNow(),
      pid: PID,
      game:'bath',
      cleanScore: Math.round(S.cleanScore),
      residue: Math.round(S.residue),
      fungusRisk: Math.round(S.fungusRisk),
      dragQuality: dragQuality(),
      weakSpots: weakSpotList(),
      badges: computeBadges()
    }));
  }catch(e){}
}
function saveGlobalLastSummary(reason){
  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
      game:'bath',
      ts: isoNow(),
      pid: PID,
      run: RUN,
      diff: DIFF,
      mode: S.mode,
      reason,
      scoreFinal: Math.round(S.cleanScore),
      residue: Math.round(S.residue),
      fungusRisk: Math.round(S.fungusRisk),
      sweat: Math.round(S.sweat),
      seed: SEED,
      hub: HUB
    }));
  }catch(e){}
}
function reportData(){
  return {
    ts: isoNow(),
    game:'bath',
    pid: PID,
    run: RUN,
    diff: DIFF,
    pro: !!PRO,
    mode: S.mode,
    view: S.view,
    seed: SEED,
    scoreFinal: Math.round(S.cleanScore),
    residue: Math.round(S.residue),
    fungusRisk: Math.round(S.fungusRisk),
    sweat: Math.round(S.sweat),
    comboMax: S.comboMax,
    fakeHits: S.fakeHits,
    oilHits: S.oilHits,
    bossHits: S.bossHits,
    bossFails: S.bossFails,
    wetHits: S.wetHits,
    rinseHits: S.rinseHits,
    dryHits: S.dryHits,
    mastery: computeMastery(),
    rubric: computeRubric(),
    dragQuality: dragQuality(),
    weakSpots: weakSpotList(),
    badges: computeBadges(),
    selfReason:S.selfReason,
    selfRating:S.selfRating,
    improvePick:S.improvePick
  };
}
function reportText(){
  const r = reportData();
  return [
    'HeroHealth Bath Hero Report',
    `เวลา: ${r.ts}`,
    `PID: ${r.pid}`,
    `mode=${r.mode} run=${r.run} diff=${r.diff} pro=${r.pro ? 'ON' : 'OFF'}`,
    `score=${r.scoreFinal}% residue=${r.residue}% risk=${r.fungusRisk}% sweat=${r.sweat}%`,
    `wet=${r.dragQuality.wet}% rinse=${r.dragQuality.rinse}% dry=${r.dragQuality.dry}%`,
    `bossFails=${r.bossFails} comboMax=${r.comboMax}`,
    `weak=${(r.weakSpots||[]).map(x=>x.label).join(', ') || '-'}`,
    `badges=${(r.badges||[]).map(x=>x.title).join(', ') || '-'}`,
    `selfReason=${r.selfReason || '-'} selfRating=${r.selfRating || 0} improve=${r.improvePick || '-'}`,
    `seed=${r.seed}`
  ].join('\n');
}
function downloadTextFile(filename, text){
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = D.createElement('a');
  a.href = url;
  a.download = filename;
  D.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}
function exportReport(){
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  downloadTextFile(`bath-report-${PID}-${stamp}.txt`, reportText());
  setTimeout(()=>{
    downloadTextFile(`bath-report-${PID}-${stamp}.json`, JSON.stringify(reportData(), null, 2));
  }, 120);
}
function endGame(reason='complete'){
  if(S.ended) return;
  S.ended = true;
  S.started = false;
  clearTargets();
  updateHUD();

  renderHeatmap();
  renderChips(UI.reasonChips, REASONS, ()=>S.selfReason, v=>S.selfReason=v);
  renderStars();
  renderChips(UI.improveChips, IMPROVES, ()=>S.improvePick, v=>S.improvePick=v);
  renderRubric();
  renderBeforeAfter();
  renderBadges();
  renderAIExplain();
  renderTeacherSummary();
  renderPlan();

  const m = computeMastery();
  const lines = learningLines();

  UI.endSummary.innerHTML =
    `Mode <b>${S.mode}</b> • View <b>${S.view.toUpperCase()}</b> • PRO <b>${PRO ? 'ON' : 'OFF'}</b><br/>`+
    `สะอาดแล้ว <b>${Math.round(S.cleanScore)}%</b> • ฟองค้าง <b>${Math.round(S.residue)}%</b> • เสี่ยงอับชื้น <b>${Math.round(S.fungusRisk)}%</b><br/>`+
    `Mission <b>${m.missionDone ? 'PASS' : 'NOT YET'}</b> • Boss <b>${m.bossPass ? 'PASS' : 'FAIL'}</b> • Rinse <b>${m.rinsePass ? 'PASS' : 'FAIL'}</b> • Dry <b>${m.dryPass ? 'PASS' : 'FAIL'}</b><br/><br/>`+
    `<b>สิ่งที่ได้เรียนรู้</b><br/>`+
    lines.map(x=>`• ${x}`).join('<br/>')+
    `<br/><br/><b>จบด้วย:</b> ${reason}`;

  UI.panelEnd.classList.remove('hidden');

  saveBathLastSummary(reason);
  saveTeacherSummary();
  saveGlobalLastSummary(reason);
}
function bindBodyInput(){
  if(!UI.bodyWrap) return;

  UI.bodyWrap.addEventListener('pointerdown', e=>{
    const k = activeDragKind();
    showCursor(e.clientX, e.clientY);
    if(!k) return;
    beginDrag(k);
    onBodyPointer(e.clientX, e.clientY);
  }, {passive:true});

  UI.bodyWrap.addEventListener('pointermove', e=>{
    showCursor(e.clientX, e.clientY);
    onBodyPointer(e.clientX, e.clientY);
  }, {passive:true});

  UI.bodyWrap.addEventListener('pointerup', ()=>{
    endDrag();
    hideCursor();
  }, {passive:true});

  UI.bodyWrap.addEventListener('pointerleave', ()=>{
    endDrag();
    hideCursor();
  }, {passive:true});

  UI.bodyWrap.addEventListener('pointercancel', ()=>{
    endDrag();
    hideCursor();
  }, {passive:true});
}
function bootReady(){
  resetGameState();
  UI.panelReady.classList.remove('hidden');
  UI.panelQuiz.classList.add('hidden');
  UI.panelHelp.classList.add('hidden');
  UI.panelEnd.classList.add('hidden');
  renderStateLayer();
  updateHUD();
}

UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp.classList.remove('hidden'));
UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp.classList.add('hidden'));

UI.btnStart?.addEventListener('click', ()=> showQuiz('standard'));
UI.btnLearn?.addEventListener('click', ()=> showQuiz('learn'));
UI.btnReadyStart?.addEventListener('click', ()=> showQuiz('standard'));
UI.btnReadyLearn?.addEventListener('click', ()=> showQuiz('learn'));
UI.btnQuizNext?.addEventListener('click', ()=> nextQuiz());

UI.btnFlip?.addEventListener('click', ()=>{
  flipView();
});

UI.btnReplay?.addEventListener('click', ()=>{
  UI.panelEnd.classList.add('hidden');
  showQuiz('standard');
});
UI.btnPlayPlan?.addEventListener('click', ()=>{
  UI.panelEnd.classList.add('hidden');
  startGame('plan');
});
UI.btnCooldown?.addEventListener('click', ()=>{
  const hub = encodeURIComponent(HUB);
  const next = `../warmup-gate.html?gatePhase=cooldown&phase=cooldown&cat=hygiene&theme=bath&game=bath&hub=${hub}&pid=${encodeURIComponent(PID)}&diff=${encodeURIComponent(DIFF)}&pro=${PRO?1:0}&run=${encodeURIComponent(RUN)}&time=${encodeURIComponent(TIME)}&view=${encodeURIComponent(VIEW_QS)}&seed=${encodeURIComponent(SEED)}`;
  location.href = next;
});
UI.btnBack?.addEventListener('click', ()=>{
  location.href = HUB;
});
UI.btnExport?.addEventListener('click', ()=> exportReport());

bindBodyInput();
bootReady();