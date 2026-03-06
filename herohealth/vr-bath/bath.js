'use strict';

const W = window, D = document;
const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
const qbool = (k,d=false)=>{ const v=String(qs(k,d?'1':'0')).toLowerCase(); return ['1','true','yes','y','on'].includes(v); };
const clamp=(v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));
const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
const isoNow = ()=> new Date().toISOString();

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
const HUB  = String(qs('hub','../hub.html'));
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
  bodyWrap: D.getElementById('body-wrap'),

  btnStart: D.getElementById('btnStart'),
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
  try{ FX = (await import('./bath.fx.js?v=20260306d')).bootFx(); }catch(e){}
  try{ MISS = (await import('./bath.missions.js?v=20260306d')).bootMissions({
    warmNeed: PRO ? 5 : 4,
    trickNeed: PRO ? 6 : 4,
    bossNeed: 1
  }); }catch(e){}
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
    { id:'kneeL', label:'หลังเข่าซ้าย', x:44, y:74, hard:3 },
    { id:'kneeR', label:'หลังเข่าขวา', x:56, y:74, hard:3 },
    { id:'toeL', label:'ซอกนิ้วเท้าซ้าย', x:46, y:92, hard:4, boss:true },
    { id:'toeR', label:'ซอกนิ้วเท้าขวา', x:54, y:92, hard:4, boss:true },
  ],
  back: [
    { id:'backNeck', label:'ท้ายทอย', x:50, y:18, hard:3 },
    { id:'backL', label:'หลังซ้าย', x:42, y:36, hard:3 },
    { id:'backR', label:'หลังขวา', x:58, y:36, hard:3 },
    { id:'waist', label:'เอว/ขอบกางเกง', x:50, y:52, hard:4, boss:true },
    { id:'behindKneeL', label:'หลังเข่าซ้าย', x:44, y:76, hard:3 },
    { id:'behindKneeR', label:'หลังเข่าขวา', x:56, y:76, hard:3 },
    { id:'heelL', label:'ส้นเท้าซ้าย', x:46, y:94, hard:3 },
    { id:'heelR', label:'ส้นเท้าขวา', x:54, y:94, hard:3 },
  ]
};

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

const PHASES = ['PREP','WET','SOAP','SCRUB','RINSE','DRY','DRESS','END'];
const EM = { water:'💧', foam:'🫧', fake:'🫧', shimmer:'✨', towel:'🧻', shirt:'👕', boss:'😷', oil:'🛢️' };

const QUIZ = [
  { q:'ลำดับที่ถูกต้องควรเริ่มจากอะไร?', a:['ฟอกสบู่', 'ทำให้เปียก (WET)'], correct:1 },
  { q:'ถ้ารีบข้าม RINSE จะเกิดอะไร?', a:['residue ติดค้าง', 'สะอาดขึ้น'], correct:0 },
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

  foam: 0,
  sweat: 0,
  residue: 15,
  fungusRisk: 10,
  cleanScore: 0,

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
};

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

  return {
    pass,
    missionDone,
    rinsePass,
    dryPass,
    bossPass,
    coveragePct
  };
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

function hud(){
  const rub = computeRubric();
  UI.phasePill && (UI.phasePill.textContent = `PHASE: ${PHASES[S.phase]||'—'}`);
  UI.questPill && (UI.questPill.textContent = `QUEST: ${MISS?.text?.() || '—'}`);
  UI.timePill && (UI.timePill.textContent = `TIME: ${Math.max(0, Math.ceil(S.timeLeft))}`);
  UI.viewPill && (UI.viewPill.textContent = `VIEW: ${S.view.toUpperCase()}`);
  UI.toolPill && (UI.toolPill.textContent = `TOOL: ${String(S.tool).toUpperCase()}`);
  UI.foamPill && (UI.foamPill.textContent = `FOAM: ${Math.round(S.foam)}`);
  UI.meterPill && (UI.meterPill.textContent = `SWEAT: ${Math.round(S.sweat)}%`);
  UI.residuePill && (UI.residuePill.textContent = `RESIDUE: ${Math.round(S.residue)}%`);
  UI.riskPill && (UI.riskPill.textContent = `FUNGUS RISK: ${Math.round(S.fungusRisk)}%`);
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

  let rawClean = cov
    - (S.residue * 0.45)
    - (S.fungusRisk * 0.45)
    - (S.pressurePct * 0.10);

  rawClean = clamp(rawClean, 0, 100);
  if (!mastery.missionDone) rawClean = Math.min(rawClean, 59);
  if (!mastery.bossPass)    rawClean = Math.min(rawClean, 49);
  if (!mastery.rinsePass)   rawClean = Math.min(rawClean, 54);
  if (!mastery.dryPass)     rawClean = Math.min(rawClean, 54);

  S.cleanScore = rawClean;
  UI.cleanPill && (UI.cleanPill.textContent = `CLEAN: ${Math.round(S.cleanScore)}%`);

  if (UI.coachPill && !String(UI.coachPill.textContent||'').startsWith('COACH:')) UI.coachPill.textContent = 'COACH: —';
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
  el.innerHTML = `<div class="ico">${label}</div><div class="tag">${spotId?spotId:''}</div>`;

  const id = `t${++S.tidSeq}`;
  const bornAt = now();
  const ttlAt = bornAt + ttlMs;

  const t = { id, el, kind, label, x, y, spotId, bornAt, ttlAt, needHits, hits:0, boss };
  S.targets.set(id, t);

  el.addEventListener('pointerdown', (e)=>{ e.preventDefault(); handleHit(id, e); }, { passive:false });
  UI.targetLayer.appendChild(el);
  return t;
}

function spawnWater(){
  const x = 25 + rng()*50;
  const y = 18 + rng()*72;
  return makeTarget({ kind:'good', label:EM.water, x, y, ttlMs: PRO?1000:1200 });
}
function spawnFoam(real=true){
  const x = 25 + rng()*50;
  const y = 18 + rng()*72;
  const fake = !real;
  return makeTarget({ kind: fake?'bad':'good', label: fake?EM.fake:EM.foam, x, y, ttlMs: PRO?1200:1400 });
}
function spawnShimmerSpot(isTrick=false){
  const list = SPOTS[S.view]||[];
  if(!list.length) return null;

  let pick;
  if (S.mode==='plan' && S.plan && S.plan.length){
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

  const label = isTrick ? EM.oil : EM.shimmer;
  const kind = isTrick ? 'bad' : 'warn';

  return makeTarget({
    kind, label,
    x: pick.x + (rng()*6-3),
    y: pick.y + (rng()*6-3),
    spotId: pick.id,
    ttlMs: ttl,
    needHits: isTrick ? 1 : need
  });
}
function spawnTowel(){
  const x = 28 + rng()*44;
  const y = 20 + rng()*72;
  return makeTarget({ kind:'good', label:EM.towel, x, y, ttlMs: PRO?1400:1600 });
}
function spawnDress(){
  const x = 50 + (rng()*12-6);
  const y = 58 + (rng()*10-5);
  return makeTarget({ kind:'good', label:EM.shirt, x, y, ttlMs: PRO?1600:1800 });
}

function maybeSpawnBoss(){
  if (S.bossActive || !MISS || MISS.S.stage !== 3) return;
  const list = (SPOTS[S.view]||[]).filter(s=>s.boss);
  if(!list.length) return;
  const s = list[Math.floor(rng()*list.length)];

  S.bossActive = true;
  S.bossSpotId = s.id;
  S.bossHp = (PRO?9:0) + (DIFF==='hard'?8:(DIFF==='easy'?5:6));
  S.bossDeadline = now() + (PRO?5200:6500);

  makeTarget({
    kind:'boss',
    label: EM.boss,
    x: s.x, y: s.y,
    spotId: s.id,
    ttlMs: (PRO?5200:6500),
    needHits: S.bossHp,
    boss:true
  });

  FX?.toast?.('บอสมา! ถูให้ทัน!', 'warn', 950);
  FX?.pulse?.('warn', 140);
  coachEmit('boss_spawn');
  logEvent(S.sessionId, 'boss_spawn', { spotId:s.id, hp:S.bossHp });
}

function bossFailSpread(){
  S.residue = clamp(S.residue + 12, 0, 100);
  S.sweat = clamp(S.sweat + 10, 0, 100);
  for(let i=0;i<4;i++) spawnShimmerSpot(false);

  FX?.toast?.('บอสหนี! คราบกระจาย!', 'bad', 900);
  FX?.pulse?.('bad', 140);
  FX?.shake?.(UI.bodyWrap, 170);

  S.bossFails++;
  coachEmit('boss_fail');
  logEvent(S.sessionId, 'boss_fail', { spotId:S.bossSpotId });

  S.bossActive=false; S.bossHp=0; S.bossSpotId=null; S.bossDeadline=0;
}

function bossWin(){
  S.residue = clamp(S.residue - 10, 0, 100);
  FX?.toast?.('ชนะบอส! ดีมาก!', 'good', 900);
  FX?.pulse?.('good', 140);

  MISS?.onBossWin?.();
  coachEmit('boss_win');
  logEvent(S.sessionId, 'boss_win', { spotId:S.bossSpotId });

  S.bossActive=false; S.bossHp=0; S.bossSpotId=null; S.bossDeadline=0;
}

function detectMissBurst(){
  const t = (now()-S.startMs)/1000;
  const w = 6;
  const recent = S.missTimes.filter(x=>(t-x)<=w);
  if (recent.length >= 3){
    S.pressureBurst++;
    S.missTimes = [];
    return true;
  }
  return false;
}

function miss(rt, reason, e){
  S.combo = 0;
  S.sweat = clamp(S.sweat + (PRO?1.9:1.2) + (DIFF==='hard'?0.6:0), 0, 100);
  if (PHASES[S.phase]==='WET' || PHASES[S.phase]==='RINSE') S.residue = clamp(S.residue + 1.0, 0, 100);
  if (PHASES[S.phase]==='DRY' || PHASES[S.phase]==='DRESS') S.fungusRisk = clamp(S.fungusRisk + 1.4, 0, 100);

  const sec = (now()-S.startMs)/1000;
  S.missTimes.push(sec);
  if (detectMissBurst()) coachEmit('miss_burst');

  FX?.pulse?.('bad', 100);
  if (e?.clientX) FX?.popScore?.(e.clientX, e.clientY, '-1', 'bad');

  logEvent(S.sessionId,'miss',{reason, rtMs:rt, phase:PHASES[S.phase]});
}

function coachEmit(tag){
  const tnow = now();
  if (tnow - S.lastCoachMs < 6500 && !String(tag).includes('boss')) return;
  S.lastCoachMs = tnow;

  const list = SPOTS[S.view]||[];
  const total = list.length || 1;
  const cleared = list.reduce((a,sp)=>a + (S.spot[sp.id]?.cleared?1:0), 0);
  const cov = cleared/total;

  const hard = list
    .map(sp=>{
      const st=S.spot[sp.id];
      const score = (st?.cleared?0:1) * ((st?.need||3)/4) + (sp.boss?0.25:0);
      return { id:sp.id, label:sp.label, score };
    })
    .sort((a,b)=>b.score-a.score)
    .slice(0,2);

  const stage = MISS?.S?.stage || 0;
  const stageName = stage===1?'Warm':stage===2?'Trick':stage===3?'Boss':'—';

  const causes = [];
  if (hard[0] && hard[0].score>=0.55) causes.push({ key:'spot', label:`พลาดจุดอับ: ${hard[0].label}`, score: hard[0].score });
  if (S.residue>=45) causes.push({ key:'residue', label:`residue สูง ${Math.round(S.residue)}%`, score: S.residue/100 });
  if (S.fungusRisk>=45) causes.push({ key:'risk', label:`เช็ดไม่แห้ง ${Math.round(S.fungusRisk)}%`, score: S.fungusRisk/100 });
  if (S.foam<=0 && (PHASES[S.phase]==='SOAP' || PHASES[S.phase]==='SCRUB')) causes.push({ key:'foam', label:`FOAM หมด`, score: 0.72 });
  if (S.fatiguePct>=55) causes.push({ key:'fatigue', label:`ล้า/ช้าลง`, score: S.fatiguePct/100 });
  if (S.pressurePct>=55) causes.push({ key:'pressure', label:`พลาดเป็นชุด`, score: S.pressurePct/100 });

  if (stage===2 && (S.oilHits>=1 || S.fakeHits>=1)){
    causes.push({ key:'decoy', label:`โดนของหลอก ${S.oilHits+S.fakeHits} ครั้ง`, score: 0.78 });
  }
  if (stage===3 && S.bossFails>=1){
    causes.push({ key:'bossfail', label:`บอสหนี ${S.bossFails} ครั้ง`, score: 0.82 });
  }
  if (PHASES[S.phase]==='RINSE' && S.rinseHits<=1 && S.residue>=30){
    causes.push({ key:'skiprinse', label:`ล้างน้อยไป`, score: 0.70 });
  }
  if (PHASES[S.phase]==='WET' && S.wetHits<=2){
    causes.push({ key:'wetlow', label:`เปียกไม่พอ`, score: 0.64 });
  }
  if (PHASES[S.phase]==='DRY' && S.dryHits<=1 && S.fungusRisk>=30){
    causes.push({ key:'drylow', label:`เช็ดไม่พอ`, score: 0.68 });
  }

  causes.sort((a,b)=>(b.score||0)-(a.score||0));
  const top2 = causes.slice(0,2);
  if (top2.length<2 && hard[1]) top2.push({ key:'spot2', label:`รอง: ${hard[1].label}`, score: hard[1].score });

  let tip = 'ทำตามลำดับ: WET→SOAP→SCRUB→RINSE→DRY';
  if (stage===2) tip = 'Trick: อย่าแตะ oil/fake — โฟกัสเฉพาะประกาย ✨';
  if (stage===3) tip = 'Boss: คุมจังหวะ + เก็บ foam ให้พอ แล้วถูให้ทันเวลา';
  if (top2.find(x=>x.key==='foam')) tip = 'foam หมด! อย่าเปลืองตอน SCRUB';
  if (top2.find(x=>x.key==='skiprinse')) tip = 'อย่าข้าม RINSE: ล้างให้หมดก่อนเช็ด';
  if (top2.find(x=>x.key==='drylow')) tip = 'DRY ให้ครบจุดสำคัญ เพื่อลดเชื้อรา';

  const payload = {
    tip,
    causes: top2.map(c=>({ key:c.key, label:c.label, score:c.score })),
    meta:{
      tag, stage:stageName,
      cov:Math.round(cov*100),
      residue:Math.round(S.residue),
      risk:Math.round(S.fungusRisk),
      sweat:Math.round(S.sweat),
      pro:!!PRO
    }
  };
  S.aiSnapshot = payload;
  UI.coachPill && (UI.coachPill.textContent = `COACH: ${tip} (${top2.map(c=>c.label).join(' + ')})`.slice(0, 86));
  logEvent(S.sessionId,'ai_coach', payload);
}

function renderAIExplain(){
  if(!UI.aiTipPill || !UI.aiCauseChips || !UI.aiMetaText) return;
  const a = S.aiSnapshot;
  if(!a){
    UI.aiTipPill.textContent = 'AI TIP: —';
    UI.aiCauseChips.innerHTML = '';
    UI.aiMetaText.textContent = 'ยังไม่มีข้อมูล AI';
    return;
  }
  UI.aiTipPill.textContent = `AI TIP: ${a.tip || '—'}`;
  UI.aiCauseChips.innerHTML = '';
  const causes = Array.isArray(a.causes) ? a.causes.slice(0,2) : [];
  causes.forEach(c=>{
    const b = D.createElement('div');
    b.className = 'chip on';
    b.textContent = c.label || c.key || '—';
    UI.aiCauseChips.appendChild(b);
  });
  const m = a.meta || {};
  UI.aiMetaText.textContent =
    `หลักฐาน: stage ${m.stage ?? '—'} • coverage ${m.cov ?? '—'}% • residue ${m.residue ?? '—'}% • risk ${m.risk ?? '—'}% • sweat ${m.sweat ?? '—'}% • PRO ${m.pro ? 'ON' : 'OFF'} • tag ${m.tag ?? '—'}`;
}

function removeTarget(id){
  const t = S.targets.get(id);
  if(!t) return;
  try{ t.el.remove(); }catch(e){}
  S.targets.delete(id);
}

function handleHit(id, e){
  const t = S.targets.get(id);
  if(!t || S.ended || !S.started) return;

  const rt = Math.max(0, Math.round(now() - t.bornAt));
  const sec = (now()-S.startMs)/1000;

  const goodAction = (t.kind==='good' || t.kind==='warn' || t.kind==='boss');
  if (goodAction){
    S.rtGood.push(rt);
    if (sec <= TIME*0.33) S.rtEarly.push(rt);
    else if (sec >= TIME*0.66) S.rtLate.push(rt);
  }

  const phase = PHASES[S.phase];

  if (phase==='WET'){
    if (t.label === EM.water){
      S.wetHits++;
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
      S.residue = clamp(S.residue - 0.8, 0, 100);
      S.sweat = clamp(S.sweat - 0.5, 0, 100);
      FX?.pulse?.('good', 90);
      FX?.popScore?.(e?.clientX||0, e?.clientY||0, '+1', 'good');
      removeTarget(id);
      logEvent(S.sessionId,'wet_hit',{rtMs:rt});
    } else miss(rt,'wrong_wet', e);
  }
  else if (phase==='SOAP'){
    if (t.label === EM.foam){
      if (S.foam <= 0) miss(rt,'no_foam', e);
      else{
        S.foamSpent++;
        S.foam = Math.max(0, S.foam - 1);
        S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
        S.residue = clamp(S.residue - 1.1, 0, 100);
        FX?.pulse?.('good', 90);
        removeTarget(id);
        logEvent(S.sessionId,'soap_hit',{rtMs:rt});
      }
    } else {
      S.fakeHits++;
      S.foamSpent++;
      S.foam = Math.max(0, S.foam - 1);
      S.residue = clamp(S.residue + 2.0, 0, 100);
      S.sweat = clamp(S.sweat + 1.0, 0, 100);
      FX?.pulse?.('bad', 90);
      FX?.toast?.('ฟองหลอก!', 'bad', 650);
      removeTarget(id);
      miss(rt,'fake_bubble', e);
    }
  }
  else if (phase==='SCRUB'){
    if (t.boss){
      S.bossHits++;
      t.hits++;
      S.bossHp = Math.max(0, S.bossHp - 1);
      if (S.foam > 0) S.foam = Math.max(0, S.foam - 0.35);
      else S.residue = clamp(S.residue + 1.2, 0, 100);

      FX?.pulse?.('warn', 80);
      if (S.bossHp <= 0){
        removeTarget(id);
        bossWin();
      } else {
        logEvent(S.sessionId,'boss_hit',{spotId:t.spotId, hpLeft:S.bossHp, rtMs:rt});
      }
    }
    else if (t.kind === 'warn' && t.label === EM.shimmer){
      const st = S.spot[t.spotId];
      if (!st) return;

      t.hits++; st.hit++;
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
      if (S.foam > 0) S.foam = Math.max(0, S.foam - 0.25);
      else S.residue = clamp(S.residue + 0.9, 0, 100);

      FX?.pulse?.('warn', 70);

      if (t.hits >= t.needHits){
        st.cleared = 1;
        S.residue = clamp(S.residue - 2.6, 0, 100);
        removeTarget(id);

        if (MISS){
          if (MISS.S.stage === 1) MISS.onWarmClear();
          else if (MISS.S.stage === 2) MISS.onTrickClear();
        }

        FX?.toast?.('เคลียร์จุดอับ!', 'good', 650);
        coachEmit('spot_clear');
        logEvent(S.sessionId,'scrub_clear',{spotId:t.spotId, need:t.needHits, rtMs:rt, stage: MISS?.S.stage });

        if (MISS && MISS.S.stage === 3) setTimeout(()=> maybeSpawnBoss(), 450);
      } else {
        logEvent(S.sessionId,'scrub_hit',{spotId:t.spotId, hit:t.hits, need:t.needHits, rtMs:rt});
      }
    }
    else if (t.kind === 'bad' && t.label === EM.oil){
      S.oilHits++;
      S.residue = clamp(S.residue + 3.0, 0, 100);
      S.sweat = clamp(S.sweat + 2.0, 0, 100);
      FX?.pulse?.('bad', 90);
      FX?.toast?.('Oil slick! ลื่น+สกปรก', 'bad', 800);
      removeTarget(id);
      miss(rt,'oil_decoy', e);

      if (MISS && MISS.S.stage === 2) MISS.onTrickClear();
    }
    else miss(rt,'wrong_scrub', e);
  }
  else if (phase==='RINSE'){
    if (t.label === EM.water){
      S.rinseHits++;
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
      S.residue = clamp(S.residue - 3.2, 0, 100);
      FX?.pulse?.('good', 80);
      removeTarget(id);
      logEvent(S.sessionId,'rinse_hit',{rtMs:rt});
    } else miss(rt,'wrong_rinse', e);
  }
  else if (phase==='DRY'){
    if (t.label === EM.towel){
      S.dryHits++;
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
      S.fungusRisk = clamp(S.fungusRisk - (PRO?3.4:3.0), 0, 100);
      FX?.pulse?.('good', 80);
      removeTarget(id);
      logEvent(S.sessionId,'dry_hit',{rtMs:rt});
    } else miss(rt,'wrong_dry', e);
  }
  else if (phase==='DRESS'){
    if (t.label === EM.shirt){
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
      FX?.toast?.('พร้อมแล้ว!', 'good', 650);
      removeTarget(id);
      logEvent(S.sessionId,'dress_hit',{rtMs:rt});
    } else miss(rt,'wrong_dress', e);
  }

  updatePhysicalProxy();
  hud();
  if ((S.combo + S.pressureBurst) % 8 === 0) coachEmit('periodic');
}

function phaseAdvance(){
  S.phase = Math.min(S.phase+1, PHASES.length-1);
  S.lastSpawnMs = 0;

  if (PHASES[S.phase] === 'SCRUB'){
    MISS?.reset?.();
    S.planCursor = 0;
    if (S.foam < 2) S.foam = 2;
  }
  if (PHASES[S.phase] === 'DRY'){
    S.fungusRisk = clamp(S.fungusRisk + Math.max(0, (S.residue-20)*0.15), 0, 100);
  }
  if (PHASES[S.phase] === 'END'){
    const mastery = computeMastery();
    endGame(mastery.pass ? 'complete' : 'incomplete_mastery');
  }
}

function phaseGate(){
  if (PHASES[S.phase] === 'WET') return S.comboMax >= (PRO?8:6);
  if (PHASES[S.phase] === 'SOAP') return (S.residue <= (PRO?38:40)) || (S.foam <= 0);
  if (PHASES[S.phase] === 'SCRUB'){
    if (MISS && MISS.done && MISS.done()) return true;
    return false;
  }
  if (PHASES[S.phase] === 'RINSE') return S.residue <= (PRO?16:18);
  if (PHASES[S.phase] === 'DRY') return S.fungusRisk <= (PRO?22:25);
  if (PHASES[S.phase] === 'DRESS') return true;
  return false;
}

function spawnLoop(tnow){
  const timeProgress = 1 - (S.timeLeft / TIME);
  S.sweat = clamp(S.sweat + (PRO?0.032:0.02) + timeProgress*(PRO?0.045:0.03), 0, 100);
  if (S.residue > 35) S.sweat = clamp(S.sweat + (PRO?0.05:0.03), 0, 100);

  if (S.bossActive && now() > S.bossDeadline) bossFailSpread();

  const baseEvery = (PHASES[S.phase]==='SCRUB') ? (PRO?650:820) : (PRO?780:980);
  const sweatBoost = 1 - (S.sweat/140);
  const every = clamp(baseEvery*sweatBoost, PRO?360:420, 1200);

  if (!S.lastSpawnMs) S.lastSpawnMs = tnow;
  if (tnow - S.lastSpawnMs < every) return;
  S.lastSpawnMs = tnow;

  if (PHASES[S.phase]==='WET'){
    spawnWater();
  } else if (PHASES[S.phase]==='SOAP'){
    const fakeRate = (DIFF==='hard') ? (PRO?0.34:0.28) : (DIFF==='easy' ? (PRO?0.16:0.12) : (PRO?0.24:0.18));
    spawnFoam(rng() > fakeRate);
  } else if (PHASES[S.phase]==='SCRUB'){
    const stage = MISS?.S?.stage || 1;
    if (stage===1){
      spawnShimmerSpot(false);
      if (rng() < 0.18) spawnShimmerSpot(false);
    } else if (stage===2){
      spawnShimmerSpot(rng() < (PRO?0.45:0.35));
      if (rng() < 0.25) spawnShimmerSpot(rng() < 0.6);
    } else {
      if (!S.bossActive) maybeSpawnBoss();
      if (rng() < 0.45) spawnShimmerSpot(false);
      if (rng() < (PRO?0.35:0.25)) spawnShimmerSpot(false);
    }
  } else if (PHASES[S.phase]==='RINSE'){
    spawnWater();
  } else if (PHASES[S.phase]==='DRY'){
    spawnTowel();
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
  if (S.timeLeft <= 0){ endGame('timeout'); return; }

  for (const [id,t] of S.targets.entries()){
    if (tnow >= t.ttlAt){
      if (PHASES[S.phase]==='WET' || PHASES[S.phase]==='RINSE') S.residue = clamp(S.residue + 1.2, 0, 100);
      if (PHASES[S.phase]==='DRY') S.fungusRisk = clamp(S.fungusRisk + 1.2, 0, 100);
      if (PHASES[S.phase]==='SCRUB' && t.kind==='warn' && t.spotId){
        const st = S.spot[t.spotId]; if (st) st.miss++;
        S.residue = clamp(S.residue + 1.8, 0, 100);
      }
      removeTarget(id);
      logEvent(S.sessionId,'target_expire',{phase:PHASES[S.phase]});
    }
  }

  if (phaseGate()){
    const elapsed = (tnow - S.startMs)/1000;
    const minSec = (PHASES[S.phase]==='WET'?8:PHASES[S.phase]==='SOAP'?8:PHASES[S.phase]==='SCRUB'?(PRO?18:14):PHASES[S.phase]==='RINSE'?8:PHASES[S.phase]==='DRY'?8:PHASES[S.phase]==='DRESS'?2:0);
    if (elapsed > minSec){
      phaseAdvance();
      logEvent(S.sessionId,'phase_advance',{to:PHASES[S.phase]});
      FX?.toast?.(`ไป ${PHASES[S.phase]}`, 'warn', 650);
      coachEmit('phase');
    }
  }

  if (S.phase>=2 && S.phase<=4) S.residue = clamp(S.residue - 0.01, 0, 100);
  if (S.phase>=5 && S.sweat > 55) S.fungusRisk = clamp(S.fungusRisk + 0.02, 0, 100);

  updatePhysicalProxy();
  hud();
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
      logEvent(S.sessionId, 'pick', { type: container.id, value:o.id });
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
      logEvent(S.sessionId,'self_rating',{rating:i});
    });
    UI.stars.appendChild(b);
  });
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
  const a = S.plan[idx];
  S.plan[idx] = S.plan[j];
  S.plan[j] = a;
  savePlan(S.view, S.plan);
  renderPlan();
  logEvent(S.sessionId,'plan_save',{view:S.view, plan:S.plan});
}
function renderRubric(){
  const rub = computeRubric();
  UI.selfRubric && (UI.selfRubric.textContent = `RUBRIC: ${rub.pass?'PASS':'TRY AGAIN'}`);
  UI.rubricDesc && (UI.rubricDesc.textContent =
    `Coverage ${rub.cov}% • Residue ${rub.residue}% • FungusRisk ${rub.risk}% • Mission ${rub.missionDone?'PASS':'FAIL'} • Boss ${rub.bossPass?'PASS':'FAIL'} • Rinse ${rub.rinsePass?'PASS':'FAIL'} • Dry ${rub.dryPass?'PASS':'FAIL'}`);
}

function saveLastSummary(reason){
  const rub = computeRubric();
  const payload = {
    game:'bath', ts: isoNow(),
    pid: PID, run: RUN, diff: DIFF, pro: !!PRO,
    view: S.view, reason,
    scoreFinal: Math.round(S.cleanScore),
    residue: Math.round(S.residue),
    fungusRisk: Math.round(S.fungusRisk),
    sweat: Math.round(S.sweat),
    rubric: rub,
    physical: { fatiguePct:S.fatiguePct, steadyPct:S.steadyPct, pressurePct:S.pressurePct },
    aiLast: S.aiSnapshot,
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
  coachEmit('end');

  const mastery = computeMastery();
  const rub = computeRubric();

  renderHeatmap();
  renderStars();
  renderChips(UI.reasonChips, REASONS, ()=>S.selfReason, v=>S.selfReason=v);
  renderChips(UI.improveChips, IMPROVES, ()=>S.improvePick, v=>S.improvePick=v);
  renderPlan();
  renderRubric();
  renderAIExplain();

  let nextStep = 'แนะนำ: เล่นใหม่';
  if (rub.pass) nextStep = 'แนะนำ: ไป Cooldown หรือกลับ HUB';
  else if (!mastery.bossPass) nextStep = 'แนะนำ: เล่นใหม่และโฟกัส Boss';
  else if (!mastery.rinsePass) nextStep = 'แนะนำ: เล่นใหม่และอย่าข้าม RINSE';
  else if (!mastery.dryPass) nextStep = 'แนะนำ: เล่นใหม่และ DRY ให้ครบ';
  else if (!mastery.missionDone) nextStep = 'แนะนำ: ทำ Warm → Trick → Boss ให้ครบ';

  if (UI.endSummary){
    UI.endSummary.innerHTML =
      `PRO <b>${PRO?'ON':'OFF'}</b> • Mode <b>${S.mode}</b> • View <b>${S.view.toUpperCase()}</b><br/>`+
      `CLEAN <b>${Math.round(S.cleanScore)}%</b> • Residue <b>${Math.round(S.residue)}%</b> • FungusRisk <b>${Math.round(S.fungusRisk)}%</b><br/>`+
      `Mission <b>${mastery.missionDone ? 'PASS' : 'NOT YET'}</b> • Boss <b>${mastery.bossPass ? 'PASS' : 'FAIL'}</b> • Rinse <b>${mastery.rinsePass ? 'PASS' : 'FAIL'}</b> • Dry <b>${mastery.dryPass ? 'PASS' : 'FAIL'}</b><br/>`+
      `Physical: Fatigue <b>${Math.round(S.fatiguePct)}%</b> • Steady <b>${Math.round(S.steadyPct)}%</b> • Pressure <b>${Math.round(S.pressurePct)}%</b><br/>`+
      `จบด้วย: <b>${reason}</b><br/>`+
      `<b>${nextStep}</b>`;
  }

  UI.panelEnd?.classList.remove('hidden');
  saveLastSummary(reason);

  safePost(API, {
    table:'sessions',
    ...baseCtx(S.sessionId),
    durationPlannedSec: TIME,
    durationPlayedSec: Math.max(0, Math.round(TIME - S.timeLeft)),
    scoreFinal: Math.round(S.cleanScore),
    comboMax: S.comboMax,
    misses: S.pressureBurst,
    accuracyGoodPct: Math.round(S.steadyPct),
    device: qs('view','pc'),
    gameVersion: 'v20260306d',
    reason,
    __extraJson: JSON.stringify({
      pro: !!PRO,
      phaseEnd: PHASES[S.phase],
      view: S.view,
      tool: S.tool,
      foam: S.foam,
      sweat: Math.round(S.sweat),
      residue: Math.round(S.residue),
      fungusRisk: Math.round(S.fungusRisk),
      rubric: rub,
      selfReason: S.selfReason,
      selfRating: S.selfRating,
      improvePick: S.improvePick,
      plan: S.plan,
      stageStats:{
        wetHits:S.wetHits, rinseHits:S.rinseHits, dryHits:S.dryHits,
        foamSpent:S.foamSpent, fakeHits:S.fakeHits, oilHits:S.oilHits,
        bossHits:S.bossHits, bossFails:S.bossFails
      },
      physical: { fatiguePct:S.fatiguePct, steadyPct:S.steadyPct, pressurePct:S.pressurePct },
      aiLast: S.aiSnapshot
    })
  });

  logEvent(S.sessionId,'session_end',{reason});
}

function showQuiz(nextMode='standard'){
  S.quizIndex=0; S.quizCorrect=0;
  UI.btnQuizNext.dataset.nextMode = nextMode;
  renderQuiz();
  UI.panelQuiz.classList.remove('hidden');
}
function renderQuiz(){
  const item = QUIZ[S.quizIndex];
  if(!UI.quizBody || !item) return;
  UI.quizBody.innerHTML = '';

  const q = D.createElement('div');
  q.style.fontWeight='900';
  q.style.marginBottom='10px';
  q.textContent = `${S.quizIndex+1}/3 — ${item.q}`;
  UI.quizBody.appendChild(q);

  item.a.forEach((txt, idx)=>{
    const b = D.createElement('button');
    b.className = 'chip';
    b.textContent = txt;
    b.addEventListener('click', ()=>{
      Array.from(UI.quizBody.querySelectorAll('button.chip')).forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      b.dataset.ok = (idx===item.correct)?'1':'0';
      logEvent(S.sessionId,'quiz_answer',{qIndex:S.quizIndex, pick:idx, ok:(idx===item.correct)});
    });
    UI.quizBody.appendChild(b);
  });

  UI.btnQuizNext.textContent = (S.quizIndex===QUIZ.length-1) ? 'เริ่มเกม' : 'ข้อถัดไป';
}
function nextQuizOrStart(){
  const picked = UI.quizBody.querySelector('button.chip.on');
  if(!picked) return;
  if (picked.dataset.ok==='1') S.quizCorrect++;

  if (S.quizIndex < QUIZ.length-1){
    S.quizIndex++;
    renderQuiz();
    return;
  }

  UI.panelQuiz.classList.add('hidden');
  const mode = UI.btnQuizNext.dataset.nextMode || 'standard';
  startGame(mode);
}

function startGame(mode='standard'){
  S.mode = mode;
  S.sessionId = `bath_${PID}_${Date.now()}`;
  S.started=true; S.ended=false;
  S.phase=0;
  S.view = S.view || 'front';
  S.tool = 'soap';
  tuneByDiff();
  S.startMs = now();
  S.lastFrameMs = 0;
  S.lastSpawnMs = 0;

  S.foam = 0;
  S.sweat = 0;
  S.residue = 15;
  S.fungusRisk = 10;
  S.cleanScore = 0;

  S.rtGood=[]; S.rtEarly=[]; S.rtLate=[];
  S.missTimes=[]; S.pressureBurst=0;
  S.combo=0; S.comboMax=0;
  S.steadyPct=100; S.fatiguePct=0; S.pressurePct=0;

  S.bossActive=false; S.bossHp=0; S.bossDeadline=0; S.bossSpotId=null;

  S.fakeHits=0; S.oilHits=0; S.foamSpent=0;
  S.rinseHits=0; S.wetHits=0; S.dryHits=0;
  S.bossHits=0; S.bossFails=0;

  S.plan = loadPlan(S.view);
  S.planCursor = 0;
  resetSpotStats();
  clearTargets();

  const t = TOOLS[Math.floor(rng()*TOOLS.length)];
  S.tool = t.id;
  S.foam = t.foamGain + (PRO?3:0) + (DIFF==='hard'?2:0);

  setTimeout(()=>{
    if(!S.started || S.ended) return;
    S.phase = 1;
    logEvent(S.sessionId,'phase_start',{phase:'WET'});
    FX?.toast?.('เริ่ม WET!', 'good', 700);
    coachEmit('start');
  }, 700);

  logEvent(S.sessionId,'session_start',{mode, view:S.view, tool:S.tool, seed:SEED, pro:!!PRO});
  hud();
  requestAnimationFrame(loop);
}

function flipView(){
  S.view = (S.view==='front') ? 'back' : 'front';
  S.plan = loadPlan(S.view);
  S.planCursor = 0;
  resetSpotStats();
  clearTargets();
  coachEmit('flip');
  hud();
}

UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.remove('hidden'));
UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.add('hidden'));

UI.btnFlip?.addEventListener('click', ()=>{
  if (!S.started || S.ended){ flipView(); return; }
  S.sweat = clamp(S.sweat + 2.0, 0, 100);
  flipView();
  logEvent(S.sessionId,'flip',{});
});

UI.btnStart?.addEventListener('click', ()=> showQuiz('standard'));
UI.btnQuizNext?.addEventListener('click', ()=> nextQuizOrStart());

UI.btnReplay?.addEventListener('click', ()=>{
  UI.panelEnd?.classList.add('hidden');
  showQuiz('standard');
});

UI.btnPlayPlan?.addEventListener('click', ()=>{
  savePlan(S.view, S.plan);
  logEvent(S.sessionId,'plan_play',{view:S.view, plan:S.plan});
  UI.panelEnd?.classList.add('hidden');
  showQuiz('plan');
});

UI.btnCooldown?.addEventListener('click', ()=>{
  const hub = encodeURIComponent(HUB);
  const next = `../cooldown-gate.html?game=bath&hub=${hub}&pid=${encodeURIComponent(PID)}&diff=${encodeURIComponent(DIFF)}&pro=${PRO?1:0}`;
  location.href = next;
});

UI.btnBack?.addEventListener('click', ()=>{ location.href = HUB; });

hud();
renderPlan();