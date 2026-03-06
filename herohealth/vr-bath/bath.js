// === /herohealth/vr-bath/bath.js ===
// Bath — Hidden Dirt Quest (Top-down) — BLOOM 1–6 + Boss + Physical Proxy + Explainable Coach
// FULL v20260306-BATH-BLOOM1-6
'use strict';

const W = window, D = document;

const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
const qbool = (k,d=false)=>{ const v=String(qs(k,d?'1':'0')).toLowerCase(); return ['1','true','yes','y','on'].includes(v); };
const clamp=(v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));
const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
const isoNow = ()=> new Date().toISOString();

function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFrom(str){
  // deterministic from pid+seed param
  let h = 2166136261 >>> 0;
  const s = String(str||'');
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function median(arr){
  if(!arr || !arr.length) return 0;
  const a = arr.slice().sort((x,y)=>x-y);
  const m = Math.floor(a.length/2);
  return a.length%2 ? a[m] : Math.round((a[m-1]+a[m])/2);
}
function avg(arr){ return (!arr||!arr.length) ? 0 : arr.reduce((a,b)=>a+b,0)/arr.length; }
function std(arr){
  if(!arr||arr.length<2) return 0;
  const m = avg(arr);
  const v = arr.reduce((s,x)=>s+(x-m)*(x-m),0)/(arr.length-1);
  return Math.sqrt(Math.max(0,v));
}
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

const RUN = String(qs('run','play')).toLowerCase();
const DIFF = String(qs('diff','normal')).toLowerCase();
const TIME = clamp(qs('time','90'), 45, 180);
const PID  = String(qs('pid','anon'));
const SEED = String(qs('seed', String(Date.now())));
const HUB  = String(qs('hub','../hub.html'));
const LOG_ON = qbool('log', false);
const API = String(qs('api',''));

const rng = mulberry32(seedFrom(`${PID}|${SEED}|bath`));

// UI
const UI = {
  phasePill: D.getElementById('phasePill'),
  timePill: D.getElementById('timePill'),
  cleanPill: D.getElementById('cleanPill'),
  rubricPill: D.getElementById('rubricPill'),

  toolPill: D.getElementById('toolPill'),
  foamPill: D.getElementById('foamPill'),
  residuePill: D.getElementById('residuePill'),
  riskPill: D.getElementById('riskPill'),
  meterPill: D.getElementById('meterPill'),
  viewPill: D.getElementById('viewPill'),
  coachPill: D.getElementById('coachPill'),
  fatiguePill: D.getElementById('fatiguePill'),
  steadyPill: D.getElementById('steadyPill'),
  pressurePill: D.getElementById('pressurePill'),

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
  btnBack: D.getElementById('btnBack'),
};

function safePost(url, payload){
  return (async ()=>{
    try{
      if(!LOG_ON || !url) return;
      await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload), keepalive:true });
    }catch(e){}
  })();
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

// Bath zones/hidden spots (front/back)
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

// Bloom 6 plan: order of focus spots during SCRUB (subset)
const PLAN_KEY = `HHA_BATH_PLAN::${PID}`;
function loadPlan(view){
  try{
    const raw = localStorage.getItem(`${PLAN_KEY}:${view}`);
    const a = JSON.parse(raw||'null');
    const ids = (SPOTS[view]||[]).map(s=>s.id);
    if (Array.isArray(a) && a.length && a.every(x=>ids.includes(x))) return a.slice();
  }catch(e){}
  // default: boss-prone first
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
function phaseName(i){ return PHASES[i] || '—'; }

const QUIZ = [
  { q:'ลำดับที่ถูกต้องควรเริ่มจากอะไร?', a:['ฟอกสบู่', 'ทำให้เปียก (WET)'], correct:1 },
  { q:'ถ้ารีบข้าม RINSE จะเกิดอะไร?', a:['residue ติดลบ', 'สะอาดขึ้น'], correct:0 },
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

const EM = {
  water:'💧', foam:'🫧', fake:'🫧', shimmer:'✨', towel:'🧻', shirt:'👕',
  boss:'😷'
};

const S = {
  sessionId: `bath_${PID}_${Date.now()}`,
  started:false, ended:false,
  phase:0,
  view:'front',
  tool: 'soap',
  timeLeft: TIME,
  startMs: 0,

  foam: 0,
  sweat: 0,         // 0..100
  residue: 0,       // 0..100
  fungusRisk: 0,    // 0..100
  cleanScore: 0,    // 0..100

  // per spot stats
  spot: {}, // id => {spawn, hit, miss, cleared, need, lastSeenMs}
  targets: new Map(), // tid -> {...}

  // physical proxy
  rtGood: [],
  rtEarly: [],
  rtLate: [],
  missTimes: [],
  combo:0,
  comboMax:0,
  pressureBurst:0,
  steadyPct:100,
  fatiguePct:0,
  pressurePct:0,

  // bloom eval
  quizIndex:0,
  quizCorrect:0,
  selfReason:'',
  selfRating:0,
  improvePick:'',
  plan: loadPlan('front'),
  planCursor:0,

  // boss
  bossActive:false,
  bossHp:0,
  bossDeadline:0,
  bossSpotId:null,

  // coach
  lastCoachMs:0,
  aiSnapshot:null,

  // loop
  lastFrameMs:0,
  lastSpawnMs:0,
};

function resetSpotStats(){
  S.spot = {};
  const list = SPOTS[S.view] || [];
  list.forEach(sp=>{
    S.spot[sp.id] = { spawn:0, hit:0, miss:0, cleared:0, need: sp.hard, lastSeenMs:0 };
  });
}

function tuneByDiff(){
  // tweak fairness
  if (DIFF==='easy'){
    S.timeLeft = clamp(TIME, 60, 180);
  } else if (DIFF==='hard'){
    S.timeLeft = clamp(TIME, 45, 160);
  } else {
    S.timeLeft = TIME;
  }
}

function computeRubric(){
  // coverage by cleared spots, low residue, low fungus risk
  const list = SPOTS[S.view] || [];
  const total = list.length || 1;
  const cleared = list.reduce((a,sp)=>a + (S.spot[sp.id]?.cleared?1:0), 0);
  const cov = Math.round((cleared/total)*100);

  const pass = (cov>=80) && (S.residue<=25) && (S.fungusRisk<=30);
  return { pass, cov, residue:Math.round(S.residue), risk:Math.round(S.fungusRisk) };
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
  UI.phasePill && (UI.phasePill.textContent = `PHASE: ${phaseName(S.phase)}`);
  UI.timePill && (UI.timePill.textContent = `TIME: ${Math.max(0, Math.ceil(S.timeLeft))}`);
  UI.viewPill && (UI.viewPill.textContent = `VIEW: ${S.view.toUpperCase()}`);
  UI.toolPill && (UI.toolPill.textContent = `TOOL: ${String(S.tool).toUpperCase()}`);
  UI.foamPill && (UI.foamPill.textContent = `FOAM: ${Math.round(S.foam)}`);
  UI.meterPill && (UI.meterPill.textContent = `SWEAT: ${Math.round(S.sweat)}%`);
  UI.residuePill && (UI.residuePill.textContent = `RESIDUE: ${Math.round(S.residue)}%`);
  UI.riskPill && (UI.riskPill.textContent = `FUNGUS RISK: ${Math.round(S.fungusRisk)}%`);

  const rub = computeRubric();
  UI.rubricPill && (UI.rubricPill.textContent = `RUBRIC: ${rub.pass ? 'PASS' : '—'}`);

  UI.fatiguePill && (UI.fatiguePill.textContent = `FATIGUE: ${Math.round(S.fatiguePct)}%`);
  UI.steadyPill && (UI.steadyPill.textContent = `STEADY: ${Math.round(S.steadyPct)}%`);
  UI.pressurePill && (UI.pressurePill.textContent = `PRESSURE: ${Math.round(S.pressurePct)}%`);

  // cleanScore heuristic
  const list = SPOTS[S.view] || [];
  const total = list.length || 1;
  const cleared = list.reduce((a,sp)=>a + (S.spot[sp.id]?.cleared?1:0), 0);
  const cov = (cleared/total)*100;
  S.cleanScore = clamp(cov - (S.residue*0.4) - (S.fungusRisk*0.4), 0, 100);
  UI.cleanPill && (UI.cleanPill.textContent = `CLEAN: ${Math.round(S.cleanScore)}%`);

  if (UI.coachPill && !String(UI.coachPill.textContent||'').startsWith('COACH:')) UI.coachPill.textContent = 'COACH: —';
}

function clearTargets(){
  UI.targetLayer && (UI.targetLayer.innerHTML = '');
  S.targets.clear();
}

let tidSeq = 0;
function makeTarget({ kind, label, x, y, spotId=null, ttlMs=1400, needHits=1, boss=false }){
  const el = D.createElement('div');
  el.className = `target ${kind}${boss?' boss':''}`;
  el.style.left = `${x}%`;
  el.style.top  = `${y}%`;
  el.innerHTML = `<div class="ico">${label}</div><div class="tag">${spotId?spotId:''}</div>`;

  const id = `t${++tidSeq}`;
  const bornAt = now();
  const ttlAt = bornAt + ttlMs;

  const t = { id, el, kind, label, x, y, spotId, bornAt, ttlAt, needHits, hits:0, boss };
  S.targets.set(id, t);

  const onHit = (e)=>{
    e.preventDefault();
    handleHit(id);
  };
  el.addEventListener('pointerdown', onHit, { passive:false });
  UI.targetLayer.appendChild(el);
  return t;
}

function spawnWater(){
  // spawn droplets across body (random)
  const x = 25 + rng()*50;
  const y = 18 + rng()*72;
  return makeTarget({ kind:'good', label:EM.water, x, y, ttlMs: 1200, needHits:1 });
}
function spawnFoam(real=true){
  const x = 25 + rng()*50;
  const y = 18 + rng()*72;
  return makeTarget({ kind: real?'good':'bad', label: real?EM.foam:EM.fake, x, y, ttlMs: 1400, needHits:1 });
}
function spawnShimmerSpot(){
  // plan-biased pick in SCRUB
  const list = SPOTS[S.view] || [];
  if (!list.length) return null;

  let pick;
  const planMode = (S.mode==='plan');
  if (planMode && S.plan && S.plan.length){
    const sid = S.plan[S.planCursor % S.plan.length];
    S.planCursor++;
    pick = list.find(s=>s.id===sid) || list[Math.floor(rng()*list.length)];
  } else {
    // weighted to uncleared and boss spots
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

  // need hits depends on tool and diff
  const tool = TOOLS.find(t=>t.id===S.tool) || TOOLS[0];
  let need = pick.hard;
  if (DIFF==='easy') need = Math.max(2, need-1);
  if (DIFF==='hard') need = need+1;

  // tool bonus reduces need slightly
  need = Math.max(2, Math.round(need * (1 - (tool.scrubBonus||0))));

  const ttl = 1600 + (pick.boss?400:0) + Math.round(S.sweat*4); // hotter => tougher
  return makeTarget({
    kind:'warn',
    label: EM.shimmer,
    x: pick.x + (rng()*6-3),
    y: pick.y + (rng()*6-3),
    spotId: pick.id,
    ttlMs: ttl,
    needHits: need
  });
}

function spawnTowel(){
  // for DRY: spawn towels near key wet zones
  const x = 28 + rng()*44;
  const y = 20 + rng()*72;
  return makeTarget({ kind:'good', label:EM.towel, x, y, ttlMs: 1600, needHits:1 });
}
function spawnDress(){
  const x = 50 + (rng()*12-6);
  const y = 58 + (rng()*10-5);
  return makeTarget({ kind:'good', label:EM.shirt, x, y, ttlMs: 1800, needHits:1 });
}

function maybeSpawnBoss(){
  if (S.bossActive) return;
  // boss chance rises with sweat/residue
  const base = 0.06 + (S.sweat/100)*0.10 + (S.residue/100)*0.06;
  if (rng() > base) return;

  const list = (SPOTS[S.view]||[]).filter(s=>s.boss);
  if(!list.length) return;
  const s = list[Math.floor(rng()*list.length)];
  S.bossActive = true;
  S.bossSpotId = s.id;
  S.bossHp = (DIFF==='hard') ? 8 : (DIFF==='easy' ? 5 : 6);
  S.bossDeadline = now() + (DIFF==='hard' ? 5200 : 6500);

  makeTarget({
    kind:'boss',
    label: EM.boss,
    x: s.x,
    y: s.y,
    spotId: s.id,
    ttlMs: (DIFF==='hard'?5200:6500),
    needHits: S.bossHp,
    boss:true
  });

  coachEmit('boss_spawn');
  logEvent(S.sessionId, 'boss_spawn', { spotId:s.id, hp:S.bossHp });
}

function bossFailSpread(){
  // spread residue + spawn extra shimmer quickly
  S.residue = clamp(S.residue + 10, 0, 100);
  S.sweat = clamp(S.sweat + 8, 0, 100);
  for(let i=0;i<3;i++) spawnShimmerSpot();
  coachEmit('boss_fail');
  logEvent(S.sessionId, 'boss_fail', { spotId:S.bossSpotId });
  S.bossActive=false; S.bossHp=0; S.bossSpotId=null; S.bossDeadline=0;
}

function bossWin(){
  S.residue = clamp(S.residue - 8, 0, 100);
  coachEmit('boss_win');
  logEvent(S.sessionId, 'boss_win', { spotId:S.bossSpotId });
  S.bossActive=false; S.bossHp=0; S.bossSpotId=null; S.bossDeadline=0;
}

function handleHit(id){
  const t = S.targets.get(id);
  if(!t || S.ended || !S.started) return;

  const rt = Math.max(0, Math.round(now() - t.bornAt));
  const sec = (now()-S.startMs)/1000;

  // collect RT for physical proxy on good hits
  const isGoodAction = (t.kind==='good' || t.kind==='warn' || t.kind==='boss');
  if (isGoodAction){
    S.rtGood.push(rt);
    if (sec <= TIME*0.33) S.rtEarly.push(rt);
    else if (sec >= TIME*0.66) S.rtLate.push(rt);
  }

  // phase logic
  if (S.phase === 0){ // PREP: tap selects tool (we use target as tool icons if needed)
    // (PREP selection handled by UI pills; here ignore)
    return;
  }

  if (S.phase === 1){ // WET
    if (t.label === EM.water){
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
      // wet improves foam efficiency later
      S.residue = clamp(S.residue - 0.8, 0, 100);
      S.sweat = clamp(S.sweat - 0.5, 0, 100);
      t.hits++;
      removeTarget(id);
      logEvent(S.sessionId,'wet_hit',{rtMs:rt});
    } else {
      miss(rt,'wrong_wet');
    }
  }
  else if (S.phase === 2){ // SOAP
    if (t.label === EM.foam){
      if (S.foam <= 0){
        miss(rt,'no_foam');
      } else {
        S.foam = Math.max(0, S.foam - 1);
        S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
        S.residue = clamp(S.residue - 1.0, 0, 100);
        t.hits++;
        removeTarget(id);
        logEvent(S.sessionId,'soap_hit',{rtMs:rt});
      }
    } else {
      // fake bubble: penalty
      S.foam = Math.max(0, S.foam - 1);
      S.residue = clamp(S.residue + 1.8, 0, 100);
      S.sweat = clamp(S.sweat + 0.8, 0, 100);
      miss(rt,'fake_bubble');
      removeTarget(id);
    }
  }
  else if (S.phase === 3){ // SCRUB
    if (t.kind === 'warn' && t.label === EM.shimmer){
      const spotId = t.spotId;
      const st = S.spot[spotId];
      if (!st) return;

      // require multiple hits (scrub)
      t.hits++;
      st.hit++;
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);

      // consume foam slowly while scrubbing
      if (S.foam > 0) S.foam = Math.max(0, S.foam - 0.25);
      else S.residue = clamp(S.residue + 0.8, 0, 100); // scrubbing without foam leaves residue

      // clear when enough hits
      if (t.hits >= t.needHits){
        st.cleared = 1;
        st.clearedAt = now();
        S.residue = clamp(S.residue - 2.5, 0, 100);
        removeTarget(id);
        coachEmit('spot_clear');
        logEvent(S.sessionId,'scrub_clear',{spotId, need:t.needHits, rtMs:rt});
      } else {
        // small feedback only
        logEvent(S.sessionId,'scrub_hit',{spotId, hit:t.hits, need:t.needHits, rtMs:rt});
      }
    }
    else if (t.boss){
      // boss needs repeated hits before deadline
      t.hits++;
      S.bossHp = Math.max(0, S.bossHp - 1);
      if (S.foam > 0) S.foam = Math.max(0, S.foam - 0.35);
      else S.residue = clamp(S.residue + 1.2, 0, 100);

      if (S.bossHp <= 0){
        removeTarget(id);
        bossWin();
      } else {
        logEvent(S.sessionId,'boss_hit',{spotId:t.spotId, hpLeft:S.bossHp, rtMs:rt});
      }
    }
    else {
      miss(rt,'wrong_scrub');
    }
  }
  else if (S.phase === 4){ // RINSE
    if (t.label === EM.water){
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
      // rinse reduces residue strongly
      S.residue = clamp(S.residue - 3.0, 0, 100);
      removeTarget(id);
      logEvent(S.sessionId,'rinse_hit',{rtMs:rt});
    } else {
      miss(rt,'wrong_rinse');
    }
  }
  else if (S.phase === 5){ // DRY
    if (t.label === EM.towel){
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
      // drying reduces fungus risk
      S.fungusRisk = clamp(S.fungusRisk - 3.0, 0, 100);
      removeTarget(id);
      logEvent(S.sessionId,'dry_hit',{rtMs:rt});
    } else {
      miss(rt,'wrong_dry');
    }
  }
  else if (S.phase === 6){ // DRESS
    if (t.label === EM.shirt){
      S.combo++; S.comboMax = Math.max(S.comboMax, S.combo);
      removeTarget(id);
      logEvent(S.sessionId,'dress_hit',{rtMs:rt});
    } else {
      miss(rt,'wrong_dress');
    }
  }

  updatePhysicalProxy();
  hud();

  // periodic explainable coach
  if ((S.combo + S.missTimes.length) % 8 === 0) coachEmit('periodic');
}

function removeTarget(id){
  const t = S.targets.get(id);
  if(!t) return;
  try{ t.el.remove(); }catch(e){}
  S.targets.delete(id);
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

function miss(rt, reason){
  // sweat rises with mistakes, residue too depending phase
  S.combo = 0;
  S.sweat = clamp(S.sweat + (DIFF==='hard'?1.6:1.2), 0, 100);
  if (S.phase===1 || S.phase===4) S.residue = clamp(S.residue + 0.8, 0, 100);
  if (S.phase===5 || S.phase===6) S.fungusRisk = clamp(S.fungusRisk + 1.4, 0, 100);

  const sec = (now()-S.startMs)/1000;
  S.missTimes.push(sec);
  if (detectMissBurst()) coachEmit('miss_burst');

  logEvent(S.sessionId,'miss',{reason, rtMs:rt, phase:phaseName(S.phase)});
}

function coachEmit(tag){
  const tnow = now();
  if (tnow - S.lastCoachMs < 6500 && tag!=='boss_spawn' && tag!=='boss_fail' && tag!=='boss_win') return;
  S.lastCoachMs = tnow;

  // explainable factors
  const list = SPOTS[S.view]||[];
  const total = list.length || 1;
  const cleared = list.reduce((a,sp)=>a + (S.spot[sp.id]?.cleared?1:0), 0);
  const cov = cleared/total;

  // top missed spots
  const misses = list.map(sp=>{
    const st=S.spot[sp.id];
    const need = st?.need||3;
    const score = (st?.cleared?0:1) * (need/4) + (sp.boss?0.2:0);
    return { id:sp.id, label:sp.label, score };
  }).sort((a,b)=>b.score-a.score).slice(0,2);

  const fastRate = (S.rtGood.length>=8) ? (S.rtGood.filter(x=>x<320).length / S.rtGood.length) : 0;

  const causes = [];
  if (misses[0] && misses[0].score>=0.55) causes.push({ key:'spot', label:`พลาด: ${misses[0].label}`, score: misses[0].score });
  if (S.residue>=45) causes.push({ key:'residue', label:`residue สูง ${Math.round(S.residue)}%`, score: S.residue/100 });
  if (S.fungusRisk>=45) causes.push({ key:'risk', label:`เช็ดไม่แห้ง ${Math.round(S.fungusRisk)}%`, score: S.fungusRisk/100 });
  if (fastRate>=0.45) causes.push({ key:'speed', label:`เร็วไป (${Math.round(fastRate*100)}% <320ms)`, score: fastRate });
  if (S.fatiguePct>=55) causes.push({ key:'fatigue', label:`ล้า/ช้าลง (drift ${Math.round(avg(S.rtLate)-avg(S.rtEarly))}ms)`, score: S.fatiguePct/100 });
  if (S.pressurePct>=55) causes.push({ key:'pressure', label:`พลาดเป็นชุด`, score: S.pressurePct/100 });

  causes.sort((a,b)=>(b.score||0)-(a.score||0));
  const top2 = causes.slice(0,2);
  if (top2.length<2 && misses[1]) top2.push({ key:'spot2', label:`รอง: ${misses[1].label}`, score: misses[1].score });

  let tip = 'โฟกัสตามลำดับ: WET→SOAP→SCRUB→RINSE→DRY';
  if (top2.find(x=>x.key==='spot' || x.key==='spot2')) tip = 'เริ่มจากจุดอับที่พลาดมากสุด แล้วถูซ้ำให้พอ';
  if (top2.find(x=>x.key==='residue')) tip = 'อย่าข้าม RINSE: ล้างฟองให้หมดก่อนเช็ด';
  if (top2.find(x=>x.key==='risk')) tip = 'DRY ให้ครบจุดสำคัญ เพื่อลดเชื้อรา';
  if (top2.find(x=>x.key==='speed')) tip = 'ช้าลงนิดเพื่อความแม่น แล้วค่อยเร่ง';
  if (tag==='boss_spawn') tip = 'บอสมา! ถูซ้ำให้ทันก่อนหมดเวลา';
  if (tag==='boss_fail') tip = 'บอสหนี! คราบกระจาย — รีบกลับไป SCRUB';
  if (tag==='boss_win') tip = 'ชนะบอส! ดีมาก — ไป RINSE ต่อ';

  const payload = { tip, causes: top2, meta:{ tag, cov:Math.round(cov*100), residue:Math.round(S.residue), risk:Math.round(S.fungusRisk), sweat:Math.round(S.sweat) } };
  S.aiSnapshot = payload;
  UI.coachPill && (UI.coachPill.textContent = `COACH: ${tip} (${top2.map(c=>c.label).join(' + ')})`.slice(0, 70));
  logEvent(S.sessionId,'ai_coach', payload);
}

function phaseAdvance(){
  S.phase = Math.min(S.phase+1, PHASES.length-1);
  if (S.phase===7){
    endGame('complete');
  } else {
    // reset spawn timer to feel snappy
    S.lastSpawnMs = 0;
    if (S.phase===3){
      // entering scrub: ensure some foam exists
      if (S.foam < 2) S.foam = 2;
      // plan cursor resets
      S.planCursor = 0;
    }
    if (S.phase===5){
      // DRY starts: if residue high, fungus risk rises
      S.fungusRisk = clamp(S.fungusRisk + Math.max(0, (S.residue-20)*0.15), 0, 100);
    }
  }
}

function phaseGate(){
  // simple thresholds to auto-advance
  if (S.phase===0) return false;

  if (S.phase===1){ // WET: require 10 hits
    return S.comboMax >= 6; // mild: encourage doing a few correct
  }
  if (S.phase===2){ // SOAP: require foam use
    return (S.residue <= 40) || (S.foam <= 0);
  }
  if (S.phase===3){ // SCRUB: require clear >= 60%
    const list = SPOTS[S.view]||[];
    const total = list.length||1;
    const cleared = list.reduce((a,sp)=>a+(S.spot[sp.id]?.cleared?1:0),0);
    return cleared/total >= 0.60;
  }
  if (S.phase===4){ // RINSE: require residue low
    return S.residue <= 18;
  }
  if (S.phase===5){ // DRY: require fungusRisk low
    return S.fungusRisk <= 25;
  }
  if (S.phase===6){ // DRESS: one hit enough
    return true;
  }
  return false;
}

function spawnLoop(tnow){
  if (!S.started || S.ended) return;

  // sweat naturally increases with time (and more if slow)
  const timeProgress = 1 - (S.timeLeft / TIME);
  S.sweat = clamp(S.sweat + 0.02 + timeProgress*0.03, 0, 100);

  // if residue high, sweat rises faster (sticky feeling)
  if (S.residue > 35) S.sweat = clamp(S.sweat + 0.03, 0, 100);

  // boss deadline check
  if (S.bossActive && now() > S.bossDeadline){
    bossFailSpread();
  }

  // spawn rate depends on phase + sweat
  const baseEvery = (S.phase===3) ? 820 : 980;
  const sweatBoost = 1 - (S.sweat/140); // higher sweat => faster spawns
  const every = clamp(baseEvery*sweatBoost, 420, 1200);

  if (!S.lastSpawnMs) S.lastSpawnMs = tnow;
  if (tnow - S.lastSpawnMs < every) return;
  S.lastSpawnMs = tnow;

  // phase-based spawns
  if (S.phase===1){
    spawnWater();
  } else if (S.phase===2){
    // real vs fake bubbles (diff affects fake rate)
    const fakeRate = (DIFF==='hard') ? 0.28 : (DIFF==='easy' ? 0.12 : 0.18);
    spawnFoam(rng() > fakeRate);
  } else if (S.phase===3){
    // shimmer spots + boss chance
    spawnShimmerSpot();
    if (rng() < 0.25) spawnShimmerSpot();
    maybeSpawnBoss();
  } else if (S.phase===4){
    spawnWater();
  } else if (S.phase===5){
    spawnTowel();
  } else if (S.phase===6){
    spawnDress();
  }
}

function loop(){
  if (!S.started || S.ended) return;

  const tnow = now();
  const dt = S.lastFrameMs ? Math.min(80, Math.max(0, tnow - S.lastFrameMs)) : 16.7;
  S.lastFrameMs = tnow;

  S.timeLeft = Math.max(0, S.timeLeft - dt/1000);
  if (S.timeLeft <= 0){
    endGame('timeout');
    return;
  }

  // expire targets
  for (const [id,t] of S.targets.entries()){
    if (tnow >= t.ttlAt){
      // missed important targets increases residue/risk by phase
      if (S.phase===1 || S.phase===4) S.residue = clamp(S.residue + 1.2, 0, 100);
      if (S.phase===5) S.fungusRisk = clamp(S.fungusRisk + 1.2, 0, 100);
      if (S.phase===3 && t.kind==='warn' && t.spotId){
        const st = S.spot[t.spotId];
        if (st) st.miss++;
        S.residue = clamp(S.residue + 1.8, 0, 100);
      }
      removeTarget(id);
      logEvent(S.sessionId,'target_expire',{phase:phaseName(S.phase)});
    }
  }

  // phase gates: auto-advance when satisfied + small delay feel
  if (phaseGate()){
    // to prevent immediate skip, require some seconds in phase
    const elapsed = (tnow - S.startMs)/1000;
    const minSec = (S.phase===1?8:S.phase===2?8:S.phase===3?14:S.phase===4?8:S.phase===5?8:S.phase===6?2:0);
    if (elapsed > minSec){
      phaseAdvance();
      logEvent(S.sessionId,'phase_advance',{to:phaseName(S.phase)});
      coachEmit('phase');
    }
  }

  // residue / fungus dynamics
  if (S.phase>=2 && S.phase<=4){
    // residue decays slowly if you keep playing well
    S.residue = clamp(S.residue - 0.01, 0, 100);
  }
  if (S.phase>=5){
    // if sweat high, fungus risk tends to rise unless dried
    if (S.sweat > 55) S.fungusRisk = clamp(S.fungusRisk + 0.02, 0, 100);
  }

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
    up.addEventListener('click', ()=>{ movePlan(idx,-1); });

    const dn = D.createElement('button');
    dn.className = 'pbtn'; dn.textContent='▼';
    dn.addEventListener('click', ()=>{ movePlan(idx,+1); });

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
    `Coverage ${rub.cov}% • Residue ${rub.residue}% • FungusRisk ${rub.risk}% • Physical(Fatigue ${Math.round(S.fatiguePct)}%, Steady ${Math.round(S.steadyPct)}%, Pressure ${Math.round(S.pressurePct)}%)`);
}

function endGame(reason='complete'){
  if (S.ended) return;
  S.ended = true;
  S.started = false;
  clearTargets();

  updatePhysicalProxy();
  coachEmit('end');

  const rub = computeRubric();
  renderHeatmap();
  renderStars();
  renderChips(UI.reasonChips, REASONS, ()=>S.selfReason, v=>S.selfReason=v);
  renderChips(UI.improveChips, IMPROVES, ()=>S.improvePick, v=>S.improvePick=v);
  renderPlan();
  renderRubric();

  if (UI.endSummary){
    UI.endSummary.innerHTML =
      `โหมด <b>${S.mode || 'standard'}</b> • View <b>${S.view.toUpperCase()}</b><br/>`+
      `CLEAN <b>${Math.round(S.cleanScore)}%</b> • Residue <b>${Math.round(S.residue)}%</b> • FungusRisk <b>${Math.round(S.fungusRisk)}%</b><br/>`+
      `Physical: Fatigue <b>${Math.round(S.fatiguePct)}%</b> • Steady <b>${Math.round(S.steadyPct)}%</b> • Pressure <b>${Math.round(S.pressurePct)}%</b><br/>`+
      `เหตุจบ: <b>${reason}</b>`;
  }

  UI.panelEnd?.classList.remove('hidden');

  // session log
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
    gameVersion: 'v20260306',
    reason,
    __extraJson: JSON.stringify({
      phaseEnd: phaseName(S.phase),
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
  S.missTimes=[]; S.combo=0; S.comboMax=0; S.pressureBurst=0;
  S.steadyPct=100; S.fatiguePct=0; S.pressurePct=0;

  S.bossActive=false; S.bossHp=0; S.bossDeadline=0; S.bossSpotId=null;

  S.plan = loadPlan(S.view);
  S.planCursor = 0;

  resetSpotStats();
  clearTargets();

  // PREP: choose tool by randomized default based on seed (fair)
  const t = TOOLS[Math.floor(rng()*TOOLS.length)];
  S.tool = t.id;
  S.foam = t.foamGain + (DIFF==='hard'?2:0);

  // show as PREP for 5 sec then auto advance
  setTimeout(()=>{
    if(!S.started || S.ended) return;
    S.phase = 1; // WET
    logEvent(S.sessionId,'phase_start',{phase:'WET'});
    coachEmit('start');
  }, 1000);

  logEvent(S.sessionId,'session_start',{mode, view:S.view, tool:S.tool, seed:SEED});
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

// Bind UI
UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.remove('hidden'));
UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.add('hidden'));

UI.btnFlip?.addEventListener('click', ()=>{
  if (!S.started || S.ended){
    flipView();
    return;
  }
  // during play: small penalty for flipping (time/attention)
  S.sweat = clamp(S.sweat + 2.0, 0, 100);
  flipView();
  logEvent(S.sessionId,'flip',{});
});

UI.btnStart?.addEventListener('click', ()=>{
  // Bloom 1 quiz gate
  showQuiz('standard');
});

UI.btnQuizNext?.addEventListener('click', ()=> nextQuizOrStart());

UI.btnReplay?.addEventListener('click', ()=>{
  UI.panelEnd?.classList.add('hidden');
  showQuiz('standard');
});

UI.btnBack?.addEventListener('click', ()=>{
  location.href = HUB;
});

UI.btnPlayPlan?.addEventListener('click', ()=>{
  // Save plan & play plan mode (still through quiz discipline)
  savePlan(S.view, S.plan);
  logEvent(S.sessionId,'plan_play',{view:S.view, plan:S.plan});
  UI.panelEnd?.classList.add('hidden');
  showQuiz('plan');
});

// initial
hud();
renderPlan();