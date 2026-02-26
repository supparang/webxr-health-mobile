// === /herohealth/plate/plate-create.js ===
// Plate Create / Constraint Plate — SAFE ENGINE (PRODUCTION+) — v1.0
// HHA Standard events + deterministic research + optional scoring core + pause bridge
//
// Expected UI ids from plate-create.html:
// crRound, crRoundPill, crTimer, crScore, crCorrect
// crScenarioTitle, crScenarioMeta
// crFoodPool, crPlateSlots, crReasonChips, crExplain
// crFeedback, crSummary, crDebug
// buttons: crSubmit, crNext, crShufflePool, crClearPlate, crRestart, crBackHub

'use strict';

const ROOT = window;
const DOC  = document;

// ---------------- Soft dependency: scoring core ----------------
// If you later add /herohealth/plate/plate-reasoning-score.js with export scorePlateCreate(payload)
// this engine will auto-use it.
let SCORE_CORE = null;
try{
  import('./plate-reasoning-score.js')
    .then(mod => { SCORE_CORE = mod; })
    .catch(()=>{});
}catch(e){}

// ---------------- Utilities ----------------
const clamp = (v,a,b)=>{ v = Number(v)||0; return v<a?a:(v>b?b:v); };
const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
const qs = (id)=> DOC.getElementById(id);

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}
function setText(id, v){
  const el = qs(id);
  if(el) el.textContent = String(v);
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
}
function loadJson(key, fallback){
  try{
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  }catch{ return fallback; }
}

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleInPlace(arr, rng=Math.random){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}
function uniq(arr){ return [...new Set(arr)]; }
function pick(arr, rng=Math.random){
  if(!Array.isArray(arr) || !arr.length) return undefined;
  return arr[Math.floor(rng()*arr.length)];
}

async function flushHardened(reason){
  try{
    const L = ROOT.HHA_LOGGER || ROOT.HHACloudLogger || ROOT.HHA_CloudLogger || null;
    if(L && typeof L.flush === 'function'){
      await Promise.race([ Promise.resolve(L.flush(reason||'manual')), new Promise(res=>setTimeout(res,650)) ]);
    }else if(L && typeof L.flushNow === 'function'){
      await Promise.race([ Promise.resolve(L.flushNow({reason})), new Promise(res=>setTimeout(res,650)) ]);
    }
  }catch{}
}

// ---------------- Storage keys ----------------
const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

// ---------------- Thai 5 food groups (fixed mapping) ----------------
const GROUPS = {
  1: { id:1, nameTH:'โปรตีน', short:'โปรตีน', emoji:'🍗' },
  2: { id:2, nameTH:'คาร์โบไฮเดรต', short:'คาร์บ', emoji:'🍚' },
  3: { id:3, nameTH:'ผัก', short:'ผัก', emoji:'🥬' },
  4: { id:4, nameTH:'ผลไม้', short:'ผลไม้', emoji:'🍎' },
  5: { id:5, nameTH:'ไขมัน', short:'ไขมัน', emoji:'🥜' }
};

// ---------------- Food catalog (toy set; safe + expandable) ----------------
const FOODS = [
  // G1 Protein
  { id:'egg', nameTH:'ไข่ต้ม', g:1, budget:'low', prepMin:5, dairy:false, highProtein:true, preWorkout:true, processed:false },
  { id:'chicken', nameTH:'อกไก่ย่าง', g:1, budget:'mid', prepMin:12, dairy:false, highProtein:true, preWorkout:true, processed:false },
  { id:'tofu', nameTH:'เต้าหู้', g:1, budget:'low', prepMin:6, dairy:false, highProtein:true, preWorkout:true, processed:false, vegetarian:true },
  { id:'milk', nameTH:'นมจืด', g:1, budget:'mid', prepMin:1, dairy:true, highProtein:false, preWorkout:true, processed:false },
  { id:'yogurt', nameTH:'โยเกิร์ต', g:1, budget:'mid', prepMin:1, dairy:true, highProtein:false, preWorkout:true, processed:false },

  // G2 Carb
  { id:'rice', nameTH:'ข้าวสวย', g:2, budget:'low', prepMin:3, dairy:false, highProtein:false, preWorkout:true, processed:false },
  { id:'brownrice', nameTH:'ข้าวกล้อง', g:2, budget:'mid', prepMin:4, dairy:false, highProtein:false, preWorkout:true, processed:false },
  { id:'bread', nameTH:'ขนมปังโฮลวีต', g:2, budget:'low', prepMin:1, dairy:false, highProtein:false, preWorkout:true, processed:false },
  { id:'sweetpotato', nameTH:'มันหวาน', g:2, budget:'low', prepMin:8, dairy:false, highProtein:false, preWorkout:true, processed:false },

  // G3 Veg
  { id:'kale', nameTH:'คะน้า', g:3, budget:'low', prepMin:6, dairy:false, highProtein:false, preWorkout:true, processed:false },
  { id:'cucumber', nameTH:'แตงกวา', g:3, budget:'low', prepMin:2, dairy:false, highProtein:false, preWorkout:true, processed:false },
  { id:'broccoli', nameTH:'บรอกโคลี', g:3, budget:'mid', prepMin:7, dairy:false, highProtein:false, preWorkout:true, processed:false },

  // G4 Fruit
  { id:'banana', nameTH:'กล้วย', g:4, budget:'low', prepMin:1, dairy:false, highProtein:false, preWorkout:true, processed:false },
  { id:'papaya', nameTH:'มะละกอ', g:4, budget:'low', prepMin:2, dairy:false, highProtein:false, preWorkout:true, processed:false },
  { id:'apple', nameTH:'แอปเปิล', g:4, budget:'mid', prepMin:1, dairy:false, highProtein:false, preWorkout:true, processed:false },

  // G5 Fat
  { id:'peanut', nameTH:'ถั่วลิสง', g:5, budget:'low', prepMin:1, dairy:false, highProtein:false, preWorkout:true, processed:false },
  { id:'sesame', nameTH:'งา', g:5, budget:'low', prepMin:1, dairy:false, highProtein:false, preWorkout:true, processed:false },
  { id:'avocado', nameTH:'อะโวคาโด', g:5, budget:'high', prepMin:2, dairy:false, highProtein:false, preWorkout:true, processed:false },

  // distractors (outside 5 groups / processed)
  { id:'soda', nameTH:'น้ำอัดลม', g:0, budget:'mid', prepMin:1, dairy:false, highProtein:false, preWorkout:false, processed:true },
  { id:'fries', nameTH:'เฟรนช์ฟรายส์', g:0, budget:'mid', prepMin:8, dairy:false, highProtein:false, preWorkout:false, processed:true },
  { id:'cake', nameTH:'เค้ก', g:0, budget:'mid', prepMin:2, dairy:true, highProtein:false, preWorkout:false, processed:true },
];

// ---------------- Reason chips ----------------
const REASON_CHIPS = [
  { id:'bal_5groups', text:'พยายามให้ครบหลายหมู่', tags:['balance'] },
  { id:'veg_first', text:'เพิ่มผักเพราะมักขาด', tags:['balance','veg'] },
  { id:'protein_satiety', text:'เลือกโปรตีนเพื่ออิ่มนาน', tags:['protein'] },
  { id:'quick_prep', text:'เลือกของทำเร็วเพราะเวลาน้อย', tags:['time'] },
  { id:'budget_limit', text:'เลือกของประหยัดตามงบ', tags:['budget'] },
  { id:'avoid_dairy', text:'หลีกเลี่ยงนม/ผลิตภัณฑ์นม', tags:['allergy','dairy'] },
  { id:'preworkout_energy', text:'เน้นพลังงานก่อนออกกำลัง', tags:['preworkout'] },
  { id:'reduce_processed', text:'ลดของหวาน/ทอด/แปรรูป', tags:['processed'] },
  { id:'just_tasty', text:'เลือกเพราะอร่อยอย่างเดียว', tags:['weak_reason'] },
];

// ---------------- Scenarios (Create / Constraint Plate) ----------------
const SCENARIOS = [
  {
    id:'quick-budget',
    title:'เช้าเร่งรีบ งบจำกัด',
    meta:'เวลา 5 นาที • งบจำกัด • ต้องอิ่มพอเรียน',
    maxPick:5,
    poolSize:10,
    constraints:{
      timeMaxMin:5,
      budgetMax:'low-mid',
      requireGroupsMin:3,
      noDairy:false,
      highProtein:false,
      preWorkout:false,
      avoidProcessed:true
    },
    preferReasonTags:['time','budget','balance']
  },
  {
    id:'high-protein',
    title:'ต้องการโปรตีนสูง',
    meta:'อยากได้โปรตีนสูง • ยังต้องสมดุล',
    maxPick:5,
    poolSize:11,
    constraints:{
      timeMaxMin:null,
      budgetMax:null,
      requireGroupsMin:3,
      noDairy:false,
      highProtein:true,
      preWorkout:false,
      avoidProcessed:true
    },
    preferReasonTags:['protein','balance']
  },
  {
    id:'no-dairy',
    title:'แพ้นม (Dairy-free)',
    meta:'หลีกเลี่ยงนม/โยเกิร์ต • จัดจานให้สมดุล',
    maxPick:5,
    poolSize:10,
    constraints:{
      timeMaxMin:null,
      budgetMax:null,
      requireGroupsMin:3,
      noDairy:true,
      highProtein:false,
      preWorkout:false,
      avoidProcessed:true
    },
    preferReasonTags:['allergy','balance']
  },
  {
    id:'preworkout',
    title:'มื้อก่อนออกกำลังกาย',
    meta:'พลังงานพอดี • ย่อยง่าย • ไม่หนักเกินไป',
    maxPick:5,
    poolSize:10,
    constraints:{
      timeMaxMin:null,
      budgetMax:null,
      requireGroupsMin:3,
      noDairy:false,
      highProtein:false,
      preWorkout:true,
      avoidProcessed:true
    },
    preferReasonTags:['preworkout','balance']
  },
];

// ---------------- Fallback scoring (if no plate-reasoning-score.js) ----------------
function budgetRank(b){
  if(b === 'low') return 1;
  if(b === 'mid') return 2;
  if(b === 'high') return 3;
  return 2;
}
function evaluateBalance(selected){
  const gCount = {1:0,2:0,3:0,4:0,5:0,0:0};
  for(const f of selected){
    const g = Number(f.g)||0;
    if(gCount[g] == null) gCount[g] = 0;
    gCount[g]++;
  }
  const distinct = [1,2,3,4,5].filter(g=>gCount[g]>0).length;
  const maxOne = Math.max(...[1,2,3,4,5].map(g=>gCount[g])) || 0;
  let score = distinct / 5;
  if(maxOne >= 3) score -= 0.15;
  if(maxOne >= 4) score -= 0.15;
  score -= Math.min(0.3, (gCount[0]||0) * 0.12);
  return { score: clamp(score,0,1), distinct, gCount };
}
function evaluateConstraints(selected, scenario){
  const c = scenario?.constraints || {};
  let score = 1;
  let pass = true;
  const issues = [];
  const positives = [];

  if(c.requireGroupsMin != null){
    const distinct = uniq(selected.map(f=>f.g).filter(g=>g>=1&&g<=5)).length;
    if(distinct < c.requireGroupsMin){ pass=false; score -= 0.25; issues.push(`ยังไม่ถึง ${c.requireGroupsMin} หมู่`); }
    else positives.push(`มีอย่างน้อย ${distinct} หมู่`);
  }

  if(c.noDairy){
    const dairyHit = selected.some(f=>!!f.dairy);
    if(dairyHit){ pass=false; score -= 0.35; issues.push('มีอาหารที่มีนม/ผลิตภัณฑ์นม'); }
    else positives.push('หลีกเลี่ยงนมได้ถูกต้อง');
  }

  if(c.highProtein){
    const hasP = selected.some(f=>f.g===1 || f.highProtein);
    if(!hasP){ pass=false; score -= 0.25; issues.push('โจทย์นี้ต้องการโปรตีนสูง'); }
    else positives.push('มีแหล่งโปรตีน');
  }

  if(c.preWorkout){
    const bad = selected.filter(f => f.preWorkout === false || f.processed);
    if(bad.length >= 2){ pass=false; score -= 0.25; issues.push('มีของที่ไม่เหมาะก่อนออกกำลังมากไป'); }
    else positives.push('ค่อนข้างเหมาะก่อนออกกำลังกาย');
  }

  if(c.avoidProcessed){
    const p = selected.filter(f=>f.processed || f.g===0).length;
    if(p >= 2){ pass=false; score -= 0.25; issues.push('มีอาหารแปรรูป/หวาน/ทอดมากเกินไป'); }
    else if(p === 1){ score -= 0.08; issues.push('มีอาหารแปรรูป 1 รายการ'); }
    else positives.push('หลีกเลี่ยงอาหารแปรรูปได้ดี');
  }

  if(c.timeMaxMin != null){
    const avgPrep = selected.length ? (selected.reduce((s,f)=>s+(Number(f.prepMin)||0),0)/selected.length) : 99;
    if(avgPrep > Number(c.timeMaxMin)+0.2){ pass=false; score -= 0.2; issues.push(`ใช้เวลานาน (เฉลี่ย ~${avgPrep.toFixed(1)} นาที)`); }
    else positives.push(`เตรียมได้ทันเวลา (${c.timeMaxMin} นาที)`);
  }

  if(c.budgetMax){
    const maxAllowed = (c.budgetMax === 'low-mid') ? 2 : budgetRank(c.budgetMax);
    const avgB = selected.length ? (selected.reduce((s,f)=>s+budgetRank(f.budget),0)/selected.length) : 99;
    if(avgB > maxAllowed + 0.05){ pass=false; score -= 0.2; issues.push('เกินงบโดยรวม'); }
    else positives.push('อยู่ในงบประมาณ');
  }

  score = clamp(score,0,1);
  return { pass, score, issues, positives };
}
function evaluateReasoning(reasonChipIds, reasonText, scenario){
  const chips = Array.isArray(reasonChipIds) ? reasonChipIds : [];
  const text = String(reasonText||'').trim();
  const wanted = scenario?.preferReasonTags || [];
  const picked = chips.map(id => REASON_CHIPS.find(c=>c.id===id)).filter(Boolean);
  const tags = uniq(picked.flatMap(c => c.tags||[]));

  let score = 0.40;
  const issues = [];
  const positives = [];

  if(chips.length > 0){ score += 0.18; positives.push('เลือกชิปเหตุผล'); }
  else issues.push('ยังไม่เลือกชิปเหตุผล');

  if(text.length >= 10){ score += 0.18; positives.push('มีคำอธิบาย'); }
  else issues.push('คำอธิบายสั้นเกินไป');

  const matchWanted = wanted.filter(t=>tags.includes(t)).length;
  if(wanted.length){
    score += Math.min(0.18, matchWanted * 0.07);
    if(matchWanted>0) positives.push('เหตุผลสอดคล้องเงื่อนไขโจทย์');
    else issues.push('เหตุผลยังไม่ชี้เงื่อนไขโจทย์');
  }

  if(tags.includes('weak_reason')){ score -= 0.14; issues.push('เหตุผลยังเน้นความชอบมากไป'); }

  return { score: clamp(score,0,1), tags, matchWanted, issues, positives };
}
function fallbackScoreCreate(payload){
  const selected = payload?.selectedFoods || [];
  const scenario = payload?.scenario || null;
  const bal = evaluateBalance(selected);
  const con = evaluateConstraints(selected, scenario);
  const rea = evaluateReasoning(payload?.selectedReasonChipIds || [], payload?.reasonText || '', scenario);

  const total01 = clamp((bal.score*0.40) + (con.score*0.38) + (rea.score*0.22), 0, 1);
  const total = Math.round(total01 * 100);
  const pass = (total >= 65) && con.pass && (bal.distinct >= (scenario?.constraints?.requireGroupsMin || 3));

  const labels = {
    y_pass: pass?1:0,
    y_score: total,
    y_balance: Math.round(bal.score*100),
    y_constraints: Math.round(con.score*100),
    y_reasoning: Math.round(rea.score*100),
    y_distinct_groups: bal.distinct,
    y_processed_count: (bal.gCount?.[0]||0)
  };

  const feedback = []
    .concat(con.positives||[])
    .concat(con.issues||[])
    .concat(rea.positives||[])
    .concat(rea.issues||[])
    .filter(Boolean);

  return {
    ok:true,
    mode:'create',
    totalScore: total,
    total01,
    pass,
    balance: bal,
    constraints: con,
    reasoning: rea,
    summaryText: `สมดุล ${Math.round(bal.score*100)}% • เงื่อนไข ${Math.round(con.score*100)}% • เหตุผล ${Math.round(rea.score*100)}%`,
    feedbackText: feedback.slice(0,4).join(' | ') || 'ลองเพิ่มความหลากหลายและชี้เหตุผลให้ตรงโจทย์มากขึ้น',
    labels
  };
}
function scoreCreate(payload){
  try{
    if(SCORE_CORE && typeof SCORE_CORE.scorePlateCreate === 'function'){
      return SCORE_CORE.scorePlateCreate(payload);
    }
  }catch(e){}
  return fallbackScoreCreate(payload);
}

// ---------------- AI hooks (optional) ----------------
function createAI(state){
  const H = ROOT.HHA && typeof ROOT.HHA.createAIHooks === 'function'
    ? ROOT.HHA.createAIHooks
    : null;

  const runMode = String(state.cfg?.runMode || 'play').toLowerCase();
  const deterministic = (runMode === 'study' || runMode === 'research');

  if(!H){
    return { enabled: !deterministic, deterministic, onEvent(){}, getTip(){return null;}, reset(){} };
  }

  try{
    const ai = H({
      game:'plate-create',
      runMode: state.cfg?.runMode || 'play',
      diff: state.cfg?.diff || 'normal',
      seed: state.cfg?.seed || 0,
      deterministic
    });
    return ai || { enabled: !deterministic, deterministic, onEvent(){}, getTip(){return null;}, reset(){} };
  }catch{
    return { enabled: !deterministic, deterministic, onEvent(){}, getTip(){return null;}, reset(){} };
  }
}

// ---------------- State ----------------
const STATE = {
  booted:false,
  running:false,
  ended:false,
  paused:false,

  cfg:null,
  rng:Math.random,
  AI:null,

  startedAt:0,
  tStartIso:'',
  timePlannedSec:0,
  timeLeft:0,
  timerHandle:null,
  featureHandle:null,

  roundIndex:0,
  roundsPlanned:4,
  currentScenario:null,
  currentPool:[],
  currentSelectedIds:[],
  currentReasonChipIds:[],
  submittedThisRound:false,

  historyRounds:[],
  scoreTotal:0,
  passCount:0,
  failCount:0,

  // analytics counters
  uiActionCount:0,
  addCount:0,
  removeCount:0,
  chipToggleCount:0,
  textInputCount:0,
  submitCount:0,
  lastFeaturesScore:0,

  // pause bridge
  __pauseBridgeWired:false,
  __onPauseReq:null,
  __onResumeReq:null,
};

// ---------------- Helpers ----------------
function playedSec(){ return STATE.startedAt ? Math.max(0, Math.floor((now()-STATE.startedAt)/1000)) : 0; }
function roundNo(){ return clamp(STATE.roundIndex+1, 1, STATE.roundsPlanned||1); }

function markUIAction(type='ui'){
  STATE.uiActionCount++;
  if(type==='add') STATE.addCount++;
  if(type==='remove') STATE.removeCount++;
  if(type==='chip') STATE.chipToggleCount++;
  if(type==='text') STATE.textInputCount++;
  emit('hha:ui', { game:'plate-create', type, tPlayedSec: playedSec() });
}

function coach(msg, mood='neutral'){
  emit('hha:coach', { game:'plate-create', msg, mood });
}

function setPaused(p){
  STATE.paused = !!p;
  emit('hha:pause_state', { game:'plate-create', paused:STATE.paused });
  if(STATE.paused){
    const fb = qs('crFeedback');
    if(fb) fb.textContent = 'หยุดชั่วคราว — กด Resume เพื่อเล่นต่อ';
  }
}

function wirePauseBridge(){
  if(STATE.__pauseBridgeWired) return;
  STATE.__pauseBridgeWired = true;

  STATE.__onPauseReq = ()=>{ if(STATE.running && !STATE.ended) setPaused(true); };
  STATE.__onResumeReq = ()=>{ if(STATE.running && !STATE.ended) setPaused(false); };

  ROOT.addEventListener('hha:pause', STATE.__onPauseReq, { passive:true });
  ROOT.addEventListener('hha:resume', STATE.__onResumeReq, { passive:true });
}

// ---------------- Config ----------------
function parseCfgFromUrl(){
  const U = new URL(location.href);
  const runRaw = (U.searchParams.get('run') || U.searchParams.get('runMode') || 'play').toLowerCase();
  const diff = (U.searchParams.get('diff') || 'normal').toLowerCase();
  const time = clamp(U.searchParams.get('time') || 240, 30, 3600);
  const rounds = clamp(U.searchParams.get('rounds') || 4, 1, 20);
  const pool = clamp(U.searchParams.get('pool') || 10, 6, 24);
  const maxpick = clamp(U.searchParams.get('maxpick') || 5, 3, 8);
  const seedP = U.searchParams.get('seed');

  const runMode = (runRaw === 'study' || runRaw === 'research') ? runRaw : 'play';
  const isStudy = (runMode === 'study' || runMode === 'research');
  const seed = isStudy
    ? (Number(seedP) || 24680)
    : (seedP != null ? (Number(seedP) || 24680) : ((Date.now() ^ (Math.random()*1e9))|0));

  return { runMode, diff: ['easy','normal','hard'].includes(diff)?diff:'normal', durationPlannedSec: time, roundsPlanned: rounds, poolSize: pool, maxPick: maxpick, seed };
}

function normalizeCfg(inputCfg){
  const f = parseCfgFromUrl();
  const c = Object.assign({}, f, (inputCfg && typeof inputCfg==='object' ? inputCfg : {}));

  c.runMode = String(c.runMode || c.run || f.runMode || 'play').toLowerCase();
  if(c.runMode !== 'study' && c.runMode !== 'research') c.runMode = 'play';

  c.diff = String(c.diff || f.diff || 'normal').toLowerCase();
  if(!['easy','normal','hard'].includes(c.diff)) c.diff = 'normal';

  c.durationPlannedSec = clamp(c.durationPlannedSec ?? c.time ?? f.durationPlannedSec ?? 240, 30, 3600);
  c.roundsPlanned = clamp(c.roundsPlanned ?? c.rounds ?? f.roundsPlanned ?? 4, 1, 20);
  c.poolSize = clamp(c.poolSize ?? c.pool ?? f.poolSize ?? 10, 6, 24);
  c.maxPick = clamp(c.maxPick ?? c.maxpick ?? f.maxPick ?? 5, 3, 8);

  const isStudy = (c.runMode === 'study' || c.runMode === 'research');
  if(isStudy) c.seed = Number(c.seed) || 24680;
  else c.seed = Number(c.seed) || ((Date.now() ^ (Math.random()*1e9))|0);

  return c;
}

// ---------------- Scenario / pool ----------------
function structuredCloneSafe(obj){
  try{ return structuredClone(obj); }catch{ return JSON.parse(JSON.stringify(obj)); }
}

function chooseScenarioForRound(){
  const sp = new URL(location.href).searchParams;
  const explicit = sp.get('scenario');
  if(explicit){
    const s = SCENARIOS.find(x=>x.id===explicit);
    if(s) return structuredCloneSafe(s);
  }

  const used = STATE.historyRounds.map(r=>r.scenarioId);
  const unplayed = SCENARIOS.filter(s=>!used.includes(s.id));
  const pool = unplayed.length ? unplayed : SCENARIOS;
  return structuredCloneSafe(pick(pool, STATE.rng));
}

function buildPoolForScenario(s){
  const rng = STATE.rng;
  const poolSize = clamp(s.poolSize ?? STATE.cfg.poolSize, 6, 24);

  // Build a base list ensuring diversity
  const forced = [];
  for(let g=1; g<=5; g++){
    const arr = FOODS.filter(f=>f.g===g && !f.processed);
    shuffleInPlace(arr, rng);
    if(arr[0]) forced.push(arr[0]);
  }

  if(s.constraints?.highProtein){
    const proteins = FOODS.filter(f=>f.g===1 || f.highProtein);
    shuffleInPlace(proteins, rng);
    forced.push(...proteins.slice(0,2));
  }

  if(s.constraints?.preWorkout){
    const pre = FOODS.filter(f=>f.preWorkout);
    shuffleInPlace(pre, rng);
    forced.push(...pre.slice(0,2));
  }

  // If noDairy, keep 1-2 dairy as distractor, but ensure most are non-dairy
  let candidates = FOODS.slice();
  if(s.constraints?.noDairy){
    const non = candidates.filter(f=>!f.dairy);
    const dairy = candidates.filter(f=>f.dairy);
    shuffleInPlace(non, rng);
    shuffleInPlace(dairy, rng);
    candidates = non.concat(dairy.slice(0,2));
  }

  // Remove duplicates from forced
  const forcedIds = uniq(forced.map(f=>f.id));
  const forcedUniq = forcedIds.map(id=>FOODS.find(f=>f.id===id)).filter(Boolean);

  const rest = candidates.filter(f=>!forcedIds.includes(f.id));
  shuffleInPlace(rest, rng);

  const finalPool = shuffleInPlace(forcedUniq.concat(rest).slice(0, poolSize), rng);
  return finalPool;
}

// ---------------- UI render ----------------
function groupEmoji(g){ return GROUPS[g]?.emoji || '⚠️'; }
function groupShort(g){ return GROUPS[g]?.short || 'นอกโจทย์'; }

function renderScenario(){
  const s = STATE.currentScenario;
  if(!s) return;

  setText('crRound', `${roundNo()}/${STATE.roundsPlanned}`);
  setText('crRoundPill', `รอบ ${roundNo()}/${STATE.roundsPlanned}`);
  setText('crScenarioTitle', s.title || 'Scenario');
  setText('crScenarioMeta', s.meta || '');

  // also set timer/score quickly
  setText('crTimer', `${STATE.timeLeft|0}s`);
  setText('crScore', `${STATE.scoreTotal|0}`);
  setText('crCorrect', `${STATE.passCount|0}/${STATE.historyRounds.length|0}`);
}

function renderReasonChips(){
  const wrap = qs('crReasonChips');
  if(!wrap) return;
  wrap.innerHTML = '';

  const wanted = STATE.currentScenario?.preferReasonTags || [];
  const chips = REASON_CHIPS.slice().sort((a,b)=>{
    const aw = (a.tags||[]).some(t=>wanted.includes(t)) ? 1 : 0;
    const bw = (b.tags||[]).some(t=>wanted.includes(t)) ? 1 : 0;
    return bw-aw;
  });

  for(const c of chips){
    const btn = DOC.createElement('button');
    btn.type = 'button';
    btn.className = 'reason-chip';
    btn.dataset.id = c.id;
    btn.textContent = c.text;
    if(STATE.currentReasonChipIds.includes(c.id)) btn.classList.add('is-on');

    btn.addEventListener('click', ()=>{
      if(STATE.submittedThisRound || !STATE.running || STATE.paused || STATE.ended) return;
      const i = STATE.currentReasonChipIds.indexOf(c.id);
      if(i>=0) STATE.currentReasonChipIds.splice(i,1);
      else STATE.currentReasonChipIds.push(c.id);
      btn.classList.toggle('is-on');
      markUIAction('chip');
      refreshLiveHints();
    }, { passive:true });

    wrap.appendChild(btn);
  }
}

function renderFoodPool(){
  const wrap = qs('crFoodPool');
  if(!wrap) return;
  wrap.innerHTML = '';

  const used = new Set(STATE.currentSelectedIds);

  for(const f of STATE.currentPool){
    const btn = DOC.createElement('button');
    btn.type = 'button';
    const unknown = ![1,2,3,4,5].includes(Number(f.g));
    btn.className = `food-chip${used.has(f.id)?' is-used':''}${unknown?' unknown':''}`;
    btn.dataset.id = f.id;
    btn.innerHTML = `
      <div>${groupEmoji(f.g)} ${f.nameTH}</div>
      <div style="font-size:11px;color:var(--mut);margin-top:2px;">
        ${groupShort(f.g)} • ${f.prepMin ?? '-'} นาที • ${f.budget || '-'}
      </div>
    `;
    btn.addEventListener('click', ()=>{
      if(STATE.submittedThisRound || !STATE.running || STATE.paused || STATE.ended) return;
      addFood(f.id);
    }, { passive:true });
    wrap.appendChild(btn);
  }
}

function getSelectedFoods(){
  return STATE.currentSelectedIds
    .map(id => STATE.currentPool.find(f=>f.id===id) || FOODS.find(f=>f.id===id))
    .filter(Boolean);
}

function renderPlate(){
  const wrap = qs('crPlateSlots');
  if(!wrap) return;
  wrap.innerHTML = '';

  const selected = getSelectedFoods();
  const maxPick = clamp(STATE.currentScenario?.maxPick ?? STATE.cfg.maxPick, 3, 8);

  if(!selected.length){
    const empty = DOC.createElement('div');
    empty.className = 'plate-empty';
    empty.innerHTML = `ยังไม่ได้เลือกอาหารลงจาน<br><span style="font-size:12px;color:var(--mut)">เลือกจากฝั่งซ้าย แล้วอธิบายเหตุผลด้านล่าง</span>`;
    wrap.appendChild(empty);
  }else{
    const list = DOC.createElement('div');
    list.className = 'plate-selected-list';

    for(const f of selected){
      const row = DOC.createElement('div');
      row.className = 'plate-selected-item';

      const chip = DOC.createElement('div');
      chip.className = 'plate-selected-chip';
      chip.innerHTML = `
        <div>${groupEmoji(f.g)} ${f.nameTH}</div>
        <div style="font-size:11px;color:var(--mut);margin-top:2px;">
          ${groupShort(f.g)} • ${f.prepMin ?? '-'} นาที • ${f.budget || '-'}
        </div>
      `;

      const del = DOC.createElement('button');
      del.type = 'button';
      del.className = 'plate-remove-btn';
      del.textContent = 'ลบ';
      del.addEventListener('click', ()=>{
        if(STATE.submittedThisRound || !STATE.running || STATE.paused || STATE.ended) return;
        removeFood(f.id);
      }, { passive:true });

      row.appendChild(chip);
      row.appendChild(del);
      list.appendChild(row);
    }

    wrap.appendChild(list);
  }

  // basic live stats
  const gset = uniq(selected.map(f=>f.g).filter(g=>g>=1&&g<=5)).length;
  const avgPrep = selected.length ? (selected.reduce((s,f)=>s+(Number(f.prepMin)||0),0)/selected.length) : 0;
  const processed = selected.filter(f=>f.processed || f.g===0).length;
  const dairy = selected.filter(f=>f.dairy).length;
  const protein = selected.filter(f=>f.g===1 || f.highProtein).length;

  const stats = DOC.createElement('div');
  stats.className = 'plate-live-stats';
  stats.innerHTML = `
    <div class="row"><span>เลือกแล้ว</span><b>${selected.length}/${maxPick}</b></div>
    <div class="row"><span>จำนวนหมู่</span><b>${gset} หมู่</b></div>
    <div class="row"><span>เวลาเฉลี่ย</span><b>${selected.length ? avgPrep.toFixed(1) : 0} นาที</b></div>
    <div class="row"><span>โปรตีน / dairy / แปรรูป</span><b>${protein} / ${dairy} / ${processed}</b></div>
  `;
  wrap.appendChild(stats);
}

function refreshButtons(){
  const submit = qs('crSubmit');
  const next = qs('crNext');
  const isLast = (STATE.roundIndex >= STATE.roundsPlanned - 1);

  if(submit){
    submit.disabled = (!STATE.running || STATE.paused || STATE.ended);
    submit.style.display = STATE.submittedThisRound ? 'none' : '';
  }
  if(next){
    next.disabled = (!STATE.running || STATE.paused || STATE.ended);
    next.style.display = (STATE.submittedThisRound && !isLast) ? '' : 'none';
  }
}

function writeDebug(extra={}){
  const el = qs('crDebug');
  if(!el) return;

  const payload = {
    cfg: STATE.cfg,
    running: STATE.running,
    paused: STATE.paused,
    ended: STATE.ended,
    round: `${roundNo()}/${STATE.roundsPlanned}`,
    scenarioId: STATE.currentScenario?.id,
    poolCount: STATE.currentPool.length,
    selectedIds: STATE.currentSelectedIds,
    reasonChipIds: STATE.currentReasonChipIds,
    submittedThisRound: STATE.submittedThisRound,
    timeLeft: STATE.timeLeft,
    scoreTotal: STATE.scoreTotal,
    passCount: STATE.passCount,
    failCount: STATE.failCount,
    ...extra
  };

  try{ el.textContent = JSON.stringify(payload, null, 2); }
  catch{ el.textContent = String(payload); }
}

function refreshLiveHints(){
  if(STATE.submittedThisRound) return;

  const selected = getSelectedFoods();
  const s = STATE.currentScenario;
  if(!s) return;

  const distinct = uniq(selected.map(f=>f.g).filter(g=>g>=1&&g<=5)).length;
  const processed = selected.filter(f=>f.processed || f.g===0).length;
  const dairy = selected.filter(f=>f.dairy).length;
  const protein = selected.filter(f=>f.g===1 || f.highProtein).length;
  const chipCount = STATE.currentReasonChipIds.length;
  const txtLen = (qs('crExplain')?.value || '').trim().length;

  const msgs = [];
  if(selected.length === 0) msgs.push('แตะอาหารเพื่อเพิ่มลงจาน');
  else msgs.push(`เลือกแล้ว ${selected.length}/${s.maxPick}`);

  if((s.constraints?.requireGroupsMin||0) > distinct) msgs.push(`เพิ่มให้ถึง ${s.constraints.requireGroupsMin} หมู่`);
  else if(distinct >= 3) msgs.push('ความหลากหลายดีขึ้น 👍');

  if(s.constraints?.noDairy && dairy>0) msgs.push('โจทย์นี้แพ้นม — เอา dairy ออก');
  if(s.constraints?.highProtein && protein<1) msgs.push('โจทย์นี้ต้องการโปรตีนสูง — เพิ่มหมู่โปรตีน');
  if(s.constraints?.avoidProcessed && processed>0) msgs.push('ลดของแปรรูป/หวาน/ทอด');

  setText('crFeedback', msgs.slice(0,2).join(' | '));
  setText('crSummary', `หมู่: ${distinct} • ชิป: ${chipCount} • เหตุผล: ${txtLen} ตัวอักษร`);
}

// ---------------- Round mechanics ----------------
function addFood(foodId){
  const s = STATE.currentScenario;
  if(!s) return;
  if(STATE.currentSelectedIds.includes(foodId)) return;

  const maxPick = clamp(s.maxPick ?? STATE.cfg.maxPick, 3, 8);
  if(STATE.currentSelectedIds.length >= maxPick){
    coach(`เลือกได้สูงสุด ${maxPick} รายการ`, 'neutral');
    setText('crFeedback', `เต็มแล้ว (${maxPick}) — ลบก่อน`);
    return;
  }

  STATE.currentSelectedIds.push(foodId);
  markUIAction('add');
  renderFoodPool();
  renderPlate();
  refreshLiveHints();
  writeDebug();
}

function removeFood(foodId){
  const i = STATE.currentSelectedIds.indexOf(foodId);
  if(i<0) return;
  STATE.currentSelectedIds.splice(i,1);
  markUIAction('remove');
  renderFoodPool();
  renderPlate();
  refreshLiveHints();
  writeDebug();
}

function clearPlate(){
  if(STATE.submittedThisRound || !STATE.running || STATE.paused || STATE.ended) return;
  if(!STATE.currentSelectedIds.length) return;
  STATE.currentSelectedIds = [];
  markUIAction('remove');
  renderFoodPool();
  renderPlate();
  refreshLiveHints();
  writeDebug({ action:'clearPlate' });
}

function shufflePool(){
  if(!STATE.currentPool.length) return;
  shuffleInPlace(STATE.currentPool, STATE.rng);
  markUIAction('ui');
  renderFoodPool();
  writeDebug({ action:'shufflePool' });
}

function setupRound(){
  STATE.currentScenario = chooseScenarioForRound();
  STATE.currentScenario.maxPick = clamp(STATE.currentScenario.maxPick ?? STATE.cfg.maxPick, 3, 8);
  STATE.currentScenario.poolSize = clamp(STATE.currentScenario.poolSize ?? STATE.cfg.poolSize, 6, 24);

  STATE.currentPool = buildPoolForScenario(STATE.currentScenario);
  STATE.currentSelectedIds = [];
  STATE.currentReasonChipIds = [];
  STATE.submittedThisRound = false;

  const ta = qs('crExplain');
  if(ta) ta.value = '';

  renderScenario();
  renderReasonChips();
  renderFoodPool();
  renderPlate();
  refreshButtons();
  refreshLiveHints();
  writeDebug({ action:'setupRound' });
}

function compileRoundPayload(){
  const selectedFoods = getSelectedFoods();
  const reasonText = (qs('crExplain')?.value || '').trim();
  return {
    game:'plate-create',
    mode:'create',
    scenario: structuredCloneSafe(STATE.currentScenario),
    selectedFoods: selectedFoods.map(f=>({ ...f })),
    selectedReasonChipIds: [...STATE.currentReasonChipIds],
    reasonText,
    cfg: structuredCloneSafe(STATE.cfg),
    meta:{
      round: roundNo(),
      roundsPlanned: STATE.roundsPlanned,
      tPlayedSec: playedSec(),
      seed: STATE.cfg?.seed || 0
    }
  };
}

function submitRound(){
  if(STATE.submittedThisRound || !STATE.running || STATE.paused || STATE.ended) return;

  const selected = getSelectedFoods();
  if(selected.length === 0){
    setText('crFeedback', 'ยังไม่ได้เลือกอาหารลงจาน');
    coach('เลือกอาหารก่อนแล้วค่อยส่งจาน 🍽️', 'neutral');
    return;
  }

  const payload = compileRoundPayload();
  const scored = scoreCreate(payload);

  STATE.submittedThisRound = true;
  STATE.submitCount++;

  const roundResult = {
    round: roundNo(),
    scenarioId: STATE.currentScenario?.id || '',
    scenarioTitle: STATE.currentScenario?.title || '',
    payload,
    scored,
    timestampIso: new Date().toISOString()
  };
  STATE.historyRounds.push(roundResult);

  const scoreRound = Number(scored?.totalScore || 0) || 0;
  STATE.scoreTotal += scoreRound;
  if(scored?.pass) STATE.passCount++;
  else STATE.failCount++;

  setText('crFeedback', `${scored?.pass ? '✅ ผ่าน' : '⚠️ ยังไม่ผ่าน'} • ${scored?.feedbackText || ''}`);
  setText('crSummary', `${scored?.summaryText || ''} • คะแนนรอบนี้ ${scoreRound}`);

  emit('hha:judge', {
    game:'plate-create',
    kind:'round_submit',
    round: roundNo(),
    scenarioId: STATE.currentScenario?.id || '',
    pass: !!scored?.pass,
    scoreRound,
    scoreTotal: STATE.scoreTotal|0
  });

  emit('hha:labels', {
    game:'plate-create',
    type:'round_end',
    round: roundNo(),
    scenarioId: STATE.currentScenario?.id || '',
    ...(scored?.labels || {}),
    y_round_pass: scored?.pass ? 1 : 0,
    y_round_score: scoreRound
  });

  try{ STATE.AI?.onEvent?.('round_submit', { roundResult }); }catch{}

  refreshButtons();
  renderFoodPool();
  renderPlate();
  renderScenario();
  writeDebug({ roundScored: scored });

  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const deterministic = (runMode === 'study' || runMode === 'research');
  if(!deterministic){
    try{
      const tip = STATE.AI?.getTip?.({ type:'round_submit', scored, round: roundNo(), tPlayedSec: playedSec() });
      if(tip?.msg) coach(tip.msg, tip.mood || (scored?.pass?'happy':'neutral'));
      else coach(scored?.pass ? 'ดีมาก! ผ่านโจทย์รอบนี้ 🎉' : 'ใกล้แล้ว! ลองปรับให้ตรงเงื่อนไขมากขึ้น 💪', scored?.pass?'happy':'neutral');
    }catch{
      coach(scored?.pass ? 'ดีมาก! ผ่านโจทย์รอบนี้ 🎉' : 'ใกล้แล้ว! ลองปรับให้ตรงเงื่อนไขมากขึ้น 💪', scored?.pass?'happy':'neutral');
    }
  }

  // last round -> end
  if(STATE.roundIndex >= STATE.roundsPlanned - 1){
    endGame('all-rounds-complete');
  }
}

function nextRound(){
  if(!STATE.submittedThisRound || !STATE.running || STATE.paused || STATE.ended) return;
  if(STATE.roundIndex >= STATE.roundsPlanned - 1) return;

  STATE.roundIndex++;
  setupRound();
  coach(`รอบ ${roundNo()} มาแล้ว! อ่านโจทย์แล้วจัดจานใหม่ ✨`, 'neutral');
}

// ---------------- HUD + loops ----------------
function updateHud(){
  setText('crTimer', `${Math.max(0, STATE.timeLeft|0)}s`);
  setText('crScore', `${STATE.scoreTotal|0}`);
  setText('crCorrect', `${STATE.passCount|0}/${STATE.historyRounds.length|0}`);
  setText('crRound', `${roundNo()}/${STATE.roundsPlanned}`);
  setText('crRoundPill', `รอบ ${roundNo()}/${STATE.roundsPlanned}`);

  emit('hha:score', {
    game:'plate-create',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    scoreTotal: STATE.scoreTotal|0,
    passCount: STATE.passCount|0,
    failCount: STATE.failCount|0,
    round: roundNo(),
    roundsPlanned: STATE.roundsPlanned|0,
    submittedThisRound: !!STATE.submittedThisRound,
    timeLeftSec: STATE.timeLeft|0,
    leftSec: STATE.timeLeft|0
  });
}

function emitFeatures1s(){
  const selected = getSelectedFoods();
  const distinctGroups = uniq(selected.map(f=>f.g).filter(g=>g>=1&&g<=5)).length;
  const processedCount = selected.filter(f=>f.processed || f.g===0).length;
  const dairyCount = selected.filter(f=>f.dairy).length;
  const reasonLen = ((qs('crExplain')?.value || '')+'').trim().length;

  const feat = {
    game:'plate-create',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || 0,

    tPlayedSec: playedSec(),
    timeLeftSec: STATE.timeLeft|0,

    round: roundNo(),
    roundsPlanned: STATE.roundsPlanned|0,
    scenarioId: STATE.currentScenario?.id || '',
    submittedThisRound: !!STATE.submittedThisRound,

    scoreTotal: STATE.scoreTotal|0,
    scoreDelta1s: (STATE.scoreTotal - (STATE.lastFeaturesScore||0))|0,

    plateItemCount: selected.length|0,
    distinctGroups: distinctGroups|0,
    processedCount: processedCount|0,
    dairyCount: dairyCount|0,

    reasonChipCount: (STATE.currentReasonChipIds.length|0),
    reasonTextLen: reasonLen|0,

    uiActionCountNow: STATE.uiActionCount|0,
    addCountNow: STATE.addCount|0,
    removeCountNow: STATE.removeCount|0,
    chipToggleCountNow: STATE.chipToggleCount|0,
    textInputCountNow: STATE.textInputCount|0,

    paused: !!STATE.paused,
    ended: !!STATE.ended
  };
  STATE.lastFeaturesScore = STATE.scoreTotal;

  emit('hha:features_1s', feat);
  try{ STATE.AI?.onEvent?.('features_1s', feat); }catch{}
}

function startLoops(){
  stopLoops();

  STATE.timerHandle = setInterval(()=>{
    if(!STATE.running || STATE.ended || STATE.paused) return;

    STATE.timeLeft--;
    emit('hha:time', { game:'plate-create', timeLeftSec: STATE.timeLeft|0, leftSec: STATE.timeLeft|0 });
    updateHud();

    if(STATE.timeLeft <= 0){
      endGame('timeout');
    }
  }, 1000);

  STATE.featureHandle = setInterval(()=>{
    if(!STATE.running || STATE.ended || STATE.paused) return;
    emitFeatures1s();
  }, 1000);
}

function stopLoops(){
  try{ if(STATE.timerHandle) clearInterval(STATE.timerHandle); }catch{}
  try{ if(STATE.featureHandle) clearInterval(STATE.featureHandle); }catch{}
  STATE.timerHandle = null;
  STATE.featureHandle = null;
}

// ---------------- Buttons wiring ----------------
function wireButtons(){
  qs('crShufflePool')?.addEventListener('click', ()=> shufflePool(), { passive:true });
  qs('crClearPlate')?.addEventListener('click', ()=> clearPlate(), { passive:true });
  qs('crSubmit')?.addEventListener('click', ()=> submitRound(), { passive:true });
  qs('crNext')?.addEventListener('click', ()=> nextRound(), { passive:true });

  qs('crRestart')?.addEventListener('click', async ()=>{
    await flushHardened('restart');
    location.reload();
  }, { passive:true });

  qs('crBackHub')?.addEventListener('click', async ()=>{
    await flushHardened('back-hub');
    const U = new URL(location.href);
    const hub = U.searchParams.get('hub') || '';
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }, { passive:true });

  const ta = qs('crExplain');
  if(ta){
    let tmr = null;
    ta.addEventListener('input', ()=>{
      if(STATE.submittedThisRound || !STATE.running || STATE.paused || STATE.ended) return;
      if(tmr) clearTimeout(tmr);
      tmr = setTimeout(()=>{
        markUIAction('text');
        refreshLiveHints();
        writeDebug();
      }, 120);
    });

    ta.addEventListener('keydown', (e)=>{
      if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
        e.preventDefault();
        submitRound();
      }
    });
  }

  ROOT.addEventListener('beforeunload', ()=>{ try{ flushHardened('beforeunload'); }catch{} });
  DOC.addEventListener('visibilitychange', ()=>{ if(DOC.hidden) try{ flushHardened('hidden'); }catch{} }, { passive:true });
}

// ---------------- End summary ----------------
function buildSummary(reason='end'){
  const roundsDone = STATE.historyRounds.length|0;
  const passPct = roundsDone ? (STATE.passCount / roundsDone) * 100 : 0;
  const avg = roundsDone ? (STATE.scoreTotal / roundsDone) : 0;

  return {
    timestampIso: new Date().toISOString(),
    projectTag:'HHA',
    sessionId:`PLATECREATE_${Date.now()}_${Math.random().toString(16).slice(2,8)}`,
    game:'plate-create',
    gameMode:'plate-create',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || 0,

    timePlannedSec: Number(STATE.timePlannedSec||0)||0,
    durationPlannedSec: Number(STATE.timePlannedSec||0)||0,
    durationPlayedSec: playedSec(),

    roundsPlanned: STATE.roundsPlanned|0,
    roundsCompleted: roundsDone,

    scoreFinal: STATE.scoreTotal|0,
    avgRoundScore: Math.round(avg*10)/10,

    passCount: STATE.passCount|0,
    failCount: STATE.failCount|0,
    passPct: Math.round(passPct*10)/10,

    submitCount: STATE.submitCount|0,
    addCount: STATE.addCount|0,
    removeCount: STATE.removeCount|0,
    chipToggleCount: STATE.chipToggleCount|0,
    textInputCount: STATE.textInputCount|0,

    reason
  };
}

function endGame(reason='end'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  stopLoops();
  refreshButtons();

  const summary = buildSummary(reason);

  saveJson(LS_LAST, summary);
  const hist = loadJson(LS_HIST, []);
  const next = Array.isArray(hist) ? hist : [];
  next.unshift(summary);
  while(next.length > 50) next.pop();
  saveJson(LS_HIST, next);

  emit('hha:end', summary);

  emit('hha:labels', {
    game:'plate-create',
    type:'end',
    reason,
    y_score_final: summary.scoreFinal,
    y_pass_count: summary.passCount,
    y_fail_count: summary.failCount,
    y_pass_pct: summary.passPct,
    y_rounds_completed: summary.roundsCompleted,
    y_avg_round_score: summary.avgRoundScore
  });

  setText('crFeedback', `🏁 จบโหมด Plate Create แล้ว • ผ่าน ${summary.passCount}/${summary.roundsCompleted} รอบ`);
  setText('crSummary', `คะแนนรวม ${summary.scoreFinal} • เฉลี่ย ${summary.avgRoundScore} • ผ่าน ${summary.passPct}%`);
  coach('จบเกมแล้ว! ดูสรุปผลได้เลย 🏁', summary.passCount>0 ? 'happy' : 'neutral');

  writeDebug({ endSummary: summary });
  flushHardened(reason);
}

// ---------------- Start game ----------------
function resetRuntime(){
  STATE.running=false; STATE.ended=false; STATE.paused=false;
  STATE.startedAt=0; STATE.tStartIso='';
  STATE.timePlannedSec=0; STATE.timeLeft=0;
  STATE.roundIndex=0;
  STATE.currentScenario=null;
  STATE.currentPool=[];
  STATE.currentSelectedIds=[];
  STATE.currentReasonChipIds=[];
  STATE.submittedThisRound=false;
  STATE.historyRounds=[];
  STATE.scoreTotal=0;
  STATE.passCount=0;
  STATE.failCount=0;
  STATE.uiActionCount=0;
  STATE.addCount=0;
  STATE.removeCount=0;
  STATE.chipToggleCount=0;
  STATE.textInputCount=0;
  STATE.submitCount=0;
  STATE.lastFeaturesScore=0;
  stopLoops();
}

function startGame(){
  resetRuntime();

  STATE.running=true;
  STATE.ended=false;
  STATE.paused=false;

  STATE.startedAt = now();
  STATE.tStartIso = new Date().toISOString();

  STATE.roundsPlanned = clamp(STATE.cfg?.roundsPlanned || 4, 1, 20);
  STATE.timePlannedSec = Number(STATE.cfg?.durationPlannedSec || 240) || 240;
  STATE.timeLeft = STATE.timePlannedSec;

  // RNG policy
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  STATE.rng = (runMode === 'study' || runMode === 'research')
    ? seededRng(STATE.cfg.seed)
    : Math.random;

  // AI hooks
  STATE.AI = createAI(STATE);
  try{ STATE.AI.reset?.(); }catch{}

  setupRound();
  updateHud();

  emit('hha:start', {
    projectTag:'HHA',
    game:'plate-create',
    gameMode:'plate-create',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    timePlannedSec: STATE.timePlannedSec,
    durationPlannedSec: STATE.timePlannedSec,
    roundsPlanned: STATE.roundsPlanned,
    poolSize: STATE.cfg.poolSize,
    maxPick: STATE.cfg.maxPick,
    startTimeIso: STATE.tStartIso,
    aiDeterministic: !!STATE.AI?.deterministic
  });

  coach('เริ่มโหมด Create! อ่านโจทย์ แล้วสร้างจานให้ผ่านข้อจำกัด 🍽️✨', 'neutral');
  emit('hha:time', { game:'plate-create', timeLeftSec: STATE.timeLeft|0, leftSec: STATE.timeLeft|0 });

  startLoops();
}

// ---------------- Exported API ----------------
export function boot({ mount, cfg } = {}){
  if(!mount) throw new Error('plate-create.js: missing mount');

  if(!STATE.booted){
    STATE.booted = true;
    wireButtons();
    wirePauseBridge();
  }

  STATE.cfg = normalizeCfg(cfg);

  // Start immediately when called by run page
  startGame();

  return {
    stop(reason='stop'){ try{ endGame(reason); }catch{} },
    pause(){ setPaused(true); },
    resume(){ setPaused(false); },
    getState(){ return STATE; },
    submitRound,
    nextRound
  };
}

// ---------------- Minimal compat (do not autostart) ----------------
(function initCompat(){
  // If someone imports this module on a page that doesn't call boot(), do nothing.
})();