// === /herohealth/plate/plate-create.js ===
// HeroHealth Plate Create (Constraint Plate) — v1.0
// ✅ Bloom Create: สร้างจานใหม่ภายใต้ข้อจำกัด
// ✅ Uses shared scoring core: /herohealth/plate/plate-reasoning-score.js
// ✅ Uses shared scenarios + food catalog: /herohealth/plate/plate-reasoning-scenarios.js
// ✅ Deterministic by seed (study/research), random in play
// ✅ Emits HHA events: start / score / judge / end / labels / features_1s
// ✅ UI expects IDs from plate-create.html (see comments below)
//
// Recommended HTML IDs:
// - crScenarioTitle, crScenarioMeta, crRoundPill
// - crFoodPool (food choices pool)
// - crPlateSlots (selected items area)
// - crReasonChips (reason chips container)
// - crExplain (textarea)
// - crSubmit, crNext, crRestart, crBackHub
// - crClearPlate, crShufflePool (optional)
// - crScore, crCorrect, crRound, crTimer
// - crFeedback, crSummary
// - crDebug (optional)
// - crPaused (optional)
//
// Exports:
// - boot({ mount, cfg })

'use strict';

import {
  FOOD_MAP,
  getScenarioById,
  listScenarioIds,
  computePlateStats,
  summarizeConstraintsTH,
  foodChipLabelTH
} from './plate-reasoning-scenarios.js';

import {
  scoreCreatePlate,
  summarizeScoreTH
} from './plate-reasoning-score.js';

const ROOT = window;

// --------------------------------------------------
// Utils
// --------------------------------------------------
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function q(id){ return document.getElementById(id); }
function setText(id, v){ const el=q(id); if(el) el.textContent = String(v ?? ''); }
function show(el, on=true){ if(el) el.style.display = on ? '' : 'none'; }
function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){} }
function esc(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uniq(arr){ return [...new Set((Array.isArray(arr)?arr:[]).map(String))]; }
function round1(v){ return Math.round((Number(v)||0)*10)/10; }
function round0(v){ return Math.round(Number(v)||0); }

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function pickOne(arr, rng=Math.random){
  const A = Array.isArray(arr) ? arr : [];
  if(!A.length) return null;
  return A[Math.floor(rng()*A.length)];
}
function shuffle(arr, rng=Math.random){
  const a = [...(Array.isArray(arr)?arr:[])];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function parseQS(){
  const U = new URL(location.href);
  const runRaw = String(U.searchParams.get('run') || 'play').toLowerCase();
  const diff = String(U.searchParams.get('diff') || 'normal').toLowerCase();
  const time = clamp(U.searchParams.get('time') || 240, 30, 3600);
  const rounds = clamp(U.searchParams.get('rounds') || 4, 1, 20);
  const poolSize = clamp(U.searchParams.get('pool') || 10, 6, 24);
  const maxPick = clamp(U.searchParams.get('maxpick') || 5, 3, 8);
  const seedQ = U.searchParams.get('seed');
  const scenario = U.searchParams.get('scenario') || '';
  const isStudy = (runRaw === 'study' || runRaw === 'research');
  const seed = isStudy
    ? (Number(seedQ) || 97531)
    : (seedQ != null ? (Number(seedQ)||97531) : ((Date.now() ^ (Math.random()*1e9))|0));

  return {
    runMode: isStudy ? runRaw : 'play',
    diff: ['easy','normal','hard'].includes(diff) ? diff : 'normal',
    durationPlannedSec: time,
    roundsPlanned: rounds,
    poolSize,
    maxPick,
    seed,
    scenario
  };
}
function normalizeCfg(cfg){
  const d = parseQS();
  const x = Object.assign({}, d, (cfg && typeof cfg==='object') ? cfg : {});
  x.runMode = String(x.runMode || x.run || d.runMode || 'play').toLowerCase();
  if(x.runMode !== 'study' && x.runMode !== 'research') x.runMode = 'play';

  x.diff = String(x.diff || d.diff || 'normal').toLowerCase();
  if(!['easy','normal','hard'].includes(x.diff)) x.diff = 'normal';

  x.durationPlannedSec = clamp(x.durationPlannedSec ?? x.time ?? d.durationPlannedSec ?? 240, 30, 3600);
  x.roundsPlanned = clamp(x.roundsPlanned ?? x.rounds ?? d.roundsPlanned ?? 4, 1, 20);
  x.poolSize = clamp(x.poolSize ?? d.poolSize ?? 10, 6, 24);
  x.maxPick = clamp(x.maxPick ?? d.maxPick ?? 5, 3, 8);

  const isStudy = (x.runMode === 'study' || x.runMode === 'research');
  x.seed = isStudy ? (Number(x.seed)||97531) : (Number(x.seed)||((Date.now() ^ (Math.random()*1e9))|0));
  x.scenario = String(x.scenario || d.scenario || '');

  return x;
}

// --------------------------------------------------
// Reason chips (fallback)
// --------------------------------------------------
const REASON_CHIPS_FALLBACK = [
  { id:'veg_enough', labelTH:'มีผักเพียงพอ', polarity:'good' },
  { id:'protein_ok', labelTH:'โปรตีนเหมาะสม', polarity:'good' },
  { id:'carb_ok', labelTH:'คาร์บพอเหมาะ', polarity:'good' },
  { id:'budget_fit', labelTH:'อยู่ในงบ', polarity:'good' },
  { id:'time_fit', labelTH:'เตรียมทันเวลา', polarity:'good' },
  { id:'allergy_safe', labelTH:'ปลอดภัยต่อการแพ้', polarity:'good' },
  { id:'preworkout_fit', labelTH:'เหมาะก่อนออกกำลัง', polarity:'good' },
  { id:'postworkout_fit', labelTH:'เหมาะหลังออกกำลัง', polarity:'good' },
  { id:'school_morning_fit', labelTH:'เหมาะมื้อเช้าไปโรงเรียน', polarity:'good' },
  { id:'home_ingredient_fit', labelTH:'ใช้ของที่บ้านได้คุ้ม', polarity:'good' },

  { id:'veg_too_low', labelTH:'ผักน้อยเกินไป', polarity:'bad' },
  { id:'protein_too_low', labelTH:'โปรตีนน้อยไป', polarity:'bad' },
  { id:'carb_too_high', labelTH:'แป้งมากเกินไป', polarity:'bad' },
  { id:'sugar_high', labelTH:'น้ำตาลสูง', polarity:'bad' },
  { id:'fried_high', labelTH:'ของทอด/ไขมันสูง', polarity:'bad' },
  { id:'budget_over', labelTH:'เกินงบ', polarity:'bad' },
  { id:'time_over', labelTH:'ใช้เวลาเตรียมนานเกิน', polarity:'bad' },
  { id:'allergy_violated', labelTH:'มีอาหารที่แพ้', polarity:'bad' }
];

// --------------------------------------------------
// State
// --------------------------------------------------
const STATE = {
  booted:false,
  running:false,
  ended:false,
  paused:false,

  cfg:null,
  rng:Math.random,
  mountEl:null,

  timePlannedSec:0,
  timeLeft:0,
  roundsPlanned:0,
  roundIndex:0,
  roundActive:false,

  scoreTotal:0,
  submitCount:0,
  passCount:0,      // create score >= threshold
  failCount:0,

  // interactions
  poolClicks:0,
  plateAdds:0,
  plateRemoves:0,
  chipToggles:0,
  shuffleCount:0,
  clearCount:0,
  choiceChanges:0, // alias-ish metric for consistency

  submitLatencyMsList:[],

  // current round
  currentScenario:null,
  foodPoolIds:[],
  selectedPlateIds:[],
  selectedReasonChipIds:[],
  lastRoundStartedAtMs:0,
  lastRoundResult:null,

  // per-second deltas
  _lastTickScore:0,
  _lastTickSubmit:0,
  _lastTickPass:0,
  _lastTickFail:0,
  _lastTickPoolClicks:0,
  _lastTickAdds:0,
  _lastTickRemoves:0,
  _lastTickChipToggles:0,

  _gameTimer:null,
  _featuresTimer:null,

  // pause bridge
  __pauseBridgeWired:false,
  __onPause:null,
  __onResume:null
};

// --------------------------------------------------
// Food helpers
// --------------------------------------------------
function allFoodIds(){
  return Object.keys(FOOD_MAP || {});
}
function foodById(id){ return FOOD_MAP?.[id] || null; }
function foodHasTag(id, tag){
  const tags = Array.isArray(foodById(id)?.tags) ? foodById(id).tags : [];
  return tags.map(String).includes(String(tag));
}
function foodGroup(id){ return String(foodById(id)?.group || ''); }

function getReasonChipsData(){
  if(Array.isArray(ROOT.HHA_PLATE_REASON_CHIPS) && ROOT.HHA_PLATE_REASON_CHIPS.length){
    return ROOT.HHA_PLATE_REASON_CHIPS;
  }
  return REASON_CHIPS_FALLBACK;
}

// --------------------------------------------------
// Pool builder (Constraint Plate)
// --------------------------------------------------
function buildPoolForScenario(scenario, cfg, rng=Math.random){
  const ids = allFoodIds();
  const c = scenario?.constraints || {};
  const t = scenario?.targetProfile || {};

  const pool = new Set();

  // 1) Must-cover groups
  const wantGroups = Array.isArray(t.wantGroups) ? t.wantGroups : ['carb','protein','veg','fruit'];
  for(const g of wantGroups){
    const cand = shuffle(ids.filter(id => foodGroup(id) === g), rng);
    if(cand[0]) pool.add(cand[0]);
    if(cand[1] && rng() < 0.45) pool.add(cand[1]);
  }

  // 2) Optional groups
  const optionalGroups = Array.isArray(t.optionalGroups) ? t.optionalGroups : ['fat'];
  for(const g of optionalGroups){
    const cand = shuffle(ids.filter(id => foodGroup(id) === g), rng);
    if(cand[0] && rng() < 0.75) pool.add(cand[0]);
  }

  // 3) Add "temptation" decoys
  const decoyBias = (cfg?.diff === 'hard') ? 0.75 : (cfg?.diff === 'easy' ? 0.35 : 0.55);

  if(c.avoidHighSugar || decoyBias > 0.4){
    const sugary = shuffle(ids.filter(id => foodHasTag(id, 'high_sugar')), rng);
    if(sugary[0]) pool.add(sugary[0]);
    if(sugary[1] && rng() < decoyBias) pool.add(sugary[1]);
  }

  if(t.preferNotFried || decoyBias > 0.45){
    const fried = shuffle(ids.filter(id => foodHasTag(id, 'fried')), rng);
    if(fried[0]) pool.add(fried[0]);
    if(fried[1] && rng() < decoyBias) pool.add(fried[1]);
  }

  // 4) Allergy scenario: include some dairy as trap (for analyze/create challenge)
  if(Array.isArray(c.allergy) && c.allergy.includes('dairy')){
    const dairy = shuffle(ids.filter(id => foodHasTag(id, 'dairy')), rng);
    if(dairy[0]) pool.add(dairy[0]);
    if(dairy[1] && rng() < 0.5) pool.add(dairy[1]);
  }

  // 5) Top up to poolSize
  const targetSize = clamp(cfg?.poolSize || 10, 6, 24);
  const remain = shuffle(ids.filter(id => !pool.has(id)), rng);
  for(const id of remain){
    if(pool.size >= targetSize) break;
    pool.add(id);
  }

  // 6) Trim to exact size but preserve diversity
  let out = [...pool];
  out = shuffle(out, rng).slice(0, targetSize);

  // Ensure at least one carb/protein/veg appears if possible
  const mustGroups = ['carb','protein','veg'];
  for(const g of mustGroups){
    if(!out.some(id => foodGroup(id) === g)){
      const replacement = pickOne(shuffle(ids.filter(id => foodGroup(id) === g && !out.includes(id)), rng), rng);
      if(replacement){
        const idx = Math.floor(rng()*out.length);
        out[idx] = replacement;
      }
    }
  }

  return uniq(out);
}

// --------------------------------------------------
// UI render
// --------------------------------------------------
function renderFoodChip(id, opts={}){
  const f = foodById(id);
  if(!f) return `<button type="button" class="food-chip unknown" data-food-id="${esc(id)}">${esc(id)}</button>`;

  const emoji = f.emoji || '🍽️';
  const label = foodChipLabelTH ? foodChipLabelTH(id) : (f.labelTH || f.nameTH || id);
  const group = f.groupLabelTH || f.groupTH || f.group || '';
  const extraCls = opts.className ? ` ${opts.className}` : '';
  const title = `${label} • ${group}`;

  return `<button type="button" class="food-chip${extraCls}" data-food-id="${esc(id)}" title="${esc(title)}">${esc(emoji)} ${esc(label)}</button>`;
}

function renderPool(){
  const box = q('crFoodPool');
  if(!box) return;

  const selected = new Set(STATE.selectedPlateIds);
  box.innerHTML = STATE.foodPoolIds.map(id => {
    const onPlate = selected.has(id);
    return renderFoodChip(id, { className: onPlate ? 'is-used' : '' });
  }).join('');
}

function renderPlateSlots(){
  const box = q('crPlateSlots');
  if(!box) return;

  if(!STATE.selectedPlateIds.length){
    box.innerHTML = `<div class="plate-empty">ยังไม่ได้เลือกอาหาร • แตะรายการด้านบนเพื่อเพิ่มลงจาน</div>`;
    return;
  }

  const stats = computePlateStats(STATE.selectedPlateIds);
  box.innerHTML = `
    <div class="plate-selected-list">
      ${STATE.selectedPlateIds.map(id => `
        <div class="plate-selected-item">
          ${renderFoodChip(id, { className:'is-onplate' })}
          <button type="button" class="plate-remove-btn" data-remove-food-id="${esc(id)}" aria-label="ลบ ${esc(id)}">ลบ</button>
        </div>
      `).join('')}
    </div>
    <div class="plate-live-stats">
      <div class="row"><span>จำนวนรายการ</span><b>${STATE.selectedPlateIds.length}/${STATE.cfg.maxPick}</b></div>
      <div class="row"><span>หมู่ที่มี</span><b>${Object.entries(stats.groups||{}).filter(([,v])=>v>0).map(([k])=>k).join(', ') || '-'}</b></div>
      <div class="row"><span>โปรตีน/คาร์บ/ไขมัน/น้ำตาล</span><b>${round1(stats.macros?.protein||0)} / ${round1(stats.macros?.carb||0)} / ${round1(stats.macros?.fat||0)} / ${round1(stats.macros?.sugar||0)}</b></div>
      <div class="row"><span>งบ / เวลาเตรียม</span><b>${round1(stats.cost||0)} / ${round1(stats.prepMin||0)} นาที</b></div>
    </div>
  `;
}

function renderReasonChips(selectedIds=[]){
  const box = q('crReasonChips');
  if(!box) return;
  const selected = new Set(uniq(selectedIds));
  const chips = getReasonChipsData();

  box.innerHTML = chips.map(ch => {
    const on = selected.has(String(ch.id));
    const cls = `reason-chip ${on?'is-on':''} ${ch.polarity==='bad'?'neg':'pos'}`;
    return `<button type="button" class="${cls}" data-chip-id="${esc(ch.id)}" aria-pressed="${on?'true':'false'}">${esc(ch.labelTH || ch.id)}</button>`;
  }).join('');
}

function renderCurrentRound(){
  const scn = STATE.currentScenario;
  if(!scn) return;

  setText('crRoundPill', `รอบ ${STATE.roundIndex+1}/${STATE.roundsPlanned}`);
  setText('crScenarioTitle', scn.titleTH || scn.title || 'Constraint Plate');
  setText('crScenarioMeta', summarizeConstraintsTH ? summarizeConstraintsTH(scn) : '');

  renderPool();
  renderPlateSlots();
  renderReasonChips(STATE.selectedReasonChipIds);

  const explain = q('crExplain');
  if(explain) explain.value = '';

  setText('crFeedback', '');
  setText('crSummary', '');
  show(q('crNext'), false);
  const submit = q('crSubmit');
  if(submit){ submit.disabled = false; submit.textContent = 'ส่งจานนี้'; }

  renderTopSummary();
  emitScorePulse();
}

function renderTopSummary(){
  setText('crScore', STATE.scoreTotal|0);
  setText('crCorrect', `${STATE.passCount}/${STATE.submitCount || 0}`); // ใช้ passCount แทน "correct"
  setText('crRound', `${Math.min(STATE.roundIndex+1, STATE.roundsPlanned)}/${STATE.roundsPlanned}`);
  setText('crTimer', `${Math.max(0, STATE.timeLeft|0)}s`);
}

// --------------------------------------------------
// Game flow
// --------------------------------------------------
function chooseScenarioForRound(){
  const fixed = String(STATE.cfg?.scenario || '').trim();
  if(fixed){
    const sc = getScenarioById(fixed);
    if(sc) return sc;
  }

  const ids = (typeof listScenarioIds === 'function') ? listScenarioIds() : [];
  if(!ids.length){
    throw new Error('plate-create.js: no scenario IDs found from plate-reasoning-scenarios.js');
  }

  let pool = ids;
  if(STATE.currentScenario?.id && ids.length > 1){
    pool = ids.filter(id => id !== STATE.currentScenario.id);
    if(!pool.length) pool = ids;
  }

  const id = pickOne(pool, STATE.rng);
  const sc = getScenarioById(id);
  if(!sc) throw new Error(`plate-create.js: scenario not found: ${id}`);
  return sc;
}

function startRound(){
  if(STATE.ended) return;

  STATE.roundActive = true;
  STATE.currentScenario = chooseScenarioForRound();
  STATE.foodPoolIds = buildPoolForScenario(STATE.currentScenario, STATE.cfg, STATE.rng);
  STATE.selectedPlateIds = [];
  STATE.selectedReasonChipIds = [];
  STATE.lastRoundStartedAtMs = nowMs();
  STATE.lastRoundResult = null;

  renderCurrentRound();

  emit('hha:judge', {
    game:'plate-create',
    kind:'round_start',
    round: STATE.roundIndex+1,
    scenarioId: STATE.currentScenario.id,
    poolSize: STATE.foodPoolIds.length
  });
}

function nextRoundOrEnd(){
  if(STATE.roundIndex + 1 >= STATE.roundsPlanned){
    endGame('rounds_done');
    return;
  }
  STATE.roundIndex++;
  startRound();
}

// --------------------------------------------------
// Actions
// --------------------------------------------------
function addFoodToPlate(foodId){
  if(!STATE.running || STATE.paused || STATE.ended || !STATE.roundActive) return;
  const id = String(foodId || '');
  if(!id || !STATE.foodPoolIds.includes(id)) return;
  if(STATE.selectedPlateIds.includes(id)) return;

  if(STATE.selectedPlateIds.length >= STATE.cfg.maxPick){
    setText('crFeedback', `เลือกได้สูงสุด ${STATE.cfg.maxPick} รายการ`);
    emit('hha:judge', {
      game:'plate-create', kind:'add_blocked_maxpick',
      round: STATE.roundIndex+1, maxPick: STATE.cfg.maxPick
    });
    return;
  }

  STATE.selectedPlateIds = [...STATE.selectedPlateIds, id];
  STATE.poolClicks++;
  STATE.plateAdds++;
  STATE.choiceChanges++;

  renderPool();
  renderPlateSlots();

  emit('hha:judge', {
    game:'plate-create',
    kind:'add_food',
    round: STATE.roundIndex+1,
    foodId:id,
    plateCount: STATE.selectedPlateIds.length
  });
}

function removeFoodFromPlate(foodId){
  if(!STATE.running || STATE.paused || STATE.ended || !STATE.roundActive) return;
  const id = String(foodId || '');
  if(!id) return;

  const before = STATE.selectedPlateIds.length;
  STATE.selectedPlateIds = STATE.selectedPlateIds.filter(x => x !== id);
  if(STATE.selectedPlateIds.length === before) return;

  STATE.plateRemoves++;
  STATE.choiceChanges++;

  renderPool();
  renderPlateSlots();

  emit('hha:judge', {
    game:'plate-create',
    kind:'remove_food',
    round: STATE.roundIndex+1,
    foodId:id,
    plateCount: STATE.selectedPlateIds.length
  });
}

function toggleReasonChip(chipId){
  if(!STATE.running || STATE.paused || STATE.ended || !STATE.roundActive) return;
  const id = String(chipId || '');
  if(!id) return;

  const set = new Set(STATE.selectedReasonChipIds);
  if(set.has(id)) set.delete(id);
  else set.add(id);
  STATE.selectedReasonChipIds = [...set];
  STATE.chipToggles++;

  renderReasonChips(STATE.selectedReasonChipIds);

  emit('hha:judge', {
    game:'plate-create',
    kind:'toggle_reason_chip',
    round: STATE.roundIndex+1,
    chipId:id,
    selectedCount: STATE.selectedReasonChipIds.length
  });
}

function clearPlate(){
  if(!STATE.running || STATE.paused || STATE.ended || !STATE.roundActive) return;
  if(!STATE.selectedPlateIds.length) return;

  STATE.selectedPlateIds = [];
  STATE.clearCount++;
  STATE.choiceChanges++;

  renderPool();
  renderPlateSlots();
  setText('crFeedback', 'ล้างจานแล้ว • เลือกใหม่ได้');

  emit('hha:judge', {
    game:'plate-create',
    kind:'clear_plate',
    round: STATE.roundIndex+1
  });
}

function shufflePool(){
  if(!STATE.running || STATE.paused || STATE.ended || !STATE.roundActive) return;
  STATE.foodPoolIds = shuffle(STATE.foodPoolIds, STATE.rng);
  STATE.shuffleCount++;

  renderPool();
  setText('crFeedback', 'สลับลำดับตัวเลือกแล้ว');

  emit('hha:judge', {
    game:'plate-create',
    kind:'shuffle_pool',
    round: STATE.roundIndex+1
  });
}

// --------------------------------------------------
// Submit / scoring
// --------------------------------------------------
function handleSubmit(){
  if(!STATE.running || STATE.paused || STATE.ended || !STATE.roundActive) return;

  const submitBtn = q('crSubmit');
  if(submitBtn) submitBtn.disabled = true;

  if(!STATE.selectedPlateIds.length){
    setText('crFeedback', 'ยังไม่ได้จัดจาน เลือกอาหารก่อน');
    if(submitBtn) submitBtn.disabled = false;
    return;
  }

  const explainText = String(q('crExplain')?.value || '').trim();

  const result = scoreCreatePlate({
    scenario: STATE.currentScenario,
    plateItemIds: STATE.selectedPlateIds,
    selectedReasonChipIds: STATE.selectedReasonChipIds,
    explanationText: explainText
  });

  STATE.lastRoundResult = result;
  STATE.roundActive = false;
  STATE.submitCount++;

  const rtMs = Math.max(0, Math.round(nowMs() - STATE.lastRoundStartedAtMs));
  STATE.submitLatencyMsList.push(rtMs);

  const scoreRound = Number(result?.score || 0);
  STATE.scoreTotal += scoreRound;

  // pass/fail threshold (Bloom Create challenge)
  const passThreshold = (STATE.cfg.diff === 'hard') ? 75 : (STATE.cfg.diff === 'easy' ? 55 : 65);
  const passed = scoreRound >= passThreshold;
  if(passed) STATE.passCount++;
  else STATE.failCount++;

  renderTopSummary();

  const sum = summarizeScoreTH(result);
  setText('crSummary', (sum?.shortTH || `คะแนน ${scoreRound}/100`) + ` • เกณฑ์ผ่าน ${passThreshold}`);
  setText('crFeedback', result?.feedbackTH || (passed ? 'ผ่านโจทย์ 🎉' : 'ยังไม่ผ่าน ลองปรับสัดส่วน/เงื่อนไขอีกนิด'));

  show(q('crNext'), true);
  if(submitBtn) submitBtn.textContent = 'ส่งแล้ว';

  // emit score + labels
  emit('hha:score', {
    game:'plate-create',
    round: STATE.roundIndex+1,
    roundsPlanned: STATE.roundsPlanned,
    scoreRound,
    scoreTotal: STATE.scoreTotal|0,
    passCount: STATE.passCount|0,
    failCount: STATE.failCount|0,
    passed,
    passThreshold,
    leftSec: STATE.timeLeft|0,
    timeLeftSec: STATE.timeLeft|0
  });

  emit('hha:judge', {
    game:'plate-create',
    kind:'create_submit',
    round: STATE.roundIndex+1,
    scenarioId: STATE.currentScenario?.id || '',
    plateCount: STATE.selectedPlateIds.length,
    reasonChipCount: STATE.selectedReasonChipIds.length,
    scoreRound,
    passed,
    passThreshold,
    rtMs
  });

  emit('hha:labels', {
    game:'plate-create',
    type:'round_end',
    round: STATE.roundIndex+1,
    scenarioId: STATE.currentScenario?.id || '',
    y_score_round: scoreRound,
    y_pass: passed ? 1 : 0,
    y_balance_score: Number(result?.breakdown?.balanceScore || 0),
    y_constraint_score: Number(result?.breakdown?.constraintScore || 0),
    y_reason_score: Number(result?.breakdown?.reasonScore || 0),
    y_explain_score: Number(result?.breakdown?.explanationScore || 0),
    y_plate_count: STATE.selectedPlateIds.length
  });

  try{
    const dbg = q('crDebug');
    if(dbg) dbg.textContent = JSON.stringify({
      result,
      selectedPlateIds: STATE.selectedPlateIds,
      stats: computePlateStats(STATE.selectedPlateIds)
    }, null, 2);
  }catch(e){}
}

function endGame(reason='end'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  STATE.roundActive = false;

  stopTimers();

  const avgScore = STATE.submitCount ? (STATE.scoreTotal / STATE.submitCount) : 0;
  const avgRtMs = STATE.submitLatencyMsList.length
    ? (STATE.submitLatencyMsList.reduce((a,b)=>a+b,0) / STATE.submitLatencyMsList.length)
    : 0;

  const summary = {
    timestampIso: new Date().toISOString(),
    game:'plate-create',
    gameMode:'plate-create',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || 0,
    roundsPlanned: STATE.roundsPlanned|0,
    roundsPlayed: STATE.submitCount|0,
    scoreTotal: STATE.scoreTotal|0,
    scoreAvg: round1(avgScore),
    passCount: STATE.passCount|0,
    failCount: STATE.failCount|0,
    passPct: STATE.submitCount ? round1((STATE.passCount / STATE.submitCount) * 100) : 0,
    avgRtMs: round0(avgRtMs),
    timePlannedSec: STATE.timePlannedSec|0,
    timeLeftSec: STATE.timeLeft|0,
    reason
  };

  try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(e){}

  setText('crSummary', `จบโหมด Create • เฉลี่ย ${summary.scoreAvg}/100 • ผ่าน ${summary.passCount}/${summary.roundsPlayed}`);
  setText('crFeedback', 'ได้โหมด Create แล้ว ✅ (Bloom ครบสาย Plate มากขึ้น)');

  emit('hha:end', summary);
  emit('hha:labels', {
    game:'plate-create',
    type:'end',
    reason,
    y_score_total: summary.scoreTotal,
    y_score_avg: summary.scoreAvg,
    y_pass: summary.passCount,
    y_fail: summary.failCount,
    y_pass_pct: summary.passPct,
    y_avg_rt_ms: summary.avgRtMs
  });

  tryFlush('plate-create-end');
}

// --------------------------------------------------
// Timers / features_1s
// --------------------------------------------------
function emitScorePulse(){
  emit('hha:score', {
    game:'plate-create',
    leftSec: STATE.timeLeft|0,
    timeLeftSec: STATE.timeLeft|0,
    scoreTotal: STATE.scoreTotal|0,
    passCount: STATE.passCount|0,
    failCount: STATE.failCount|0,
    round: STATE.roundIndex+1,
    roundsPlanned: STATE.roundsPlanned|0
  });
}

function emitFeatures1s(){
  const scoreDelta = (STATE.scoreTotal - STATE._lastTickScore)|0;
  const submitDelta = (STATE.submitCount - STATE._lastTickSubmit)|0;
  const passDelta = (STATE.passCount - STATE._lastTickPass)|0;
  const failDelta = (STATE.failCount - STATE._lastTickFail)|0;
  const poolClickDelta = (STATE.poolClicks - STATE._lastTickPoolClicks)|0;
  const addDelta = (STATE.plateAdds - STATE._lastTickAdds)|0;
  const removeDelta = (STATE.plateRemoves - STATE._lastTickRemoves)|0;
  const chipToggleDelta = (STATE.chipToggles - STATE._lastTickChipToggles)|0;

  STATE._lastTickScore = STATE.scoreTotal|0;
  STATE._lastTickSubmit = STATE.submitCount|0;
  STATE._lastTickPass = STATE.passCount|0;
  STATE._lastTickFail = STATE.failCount|0;
  STATE._lastTickPoolClicks = STATE.poolClicks|0;
  STATE._lastTickAdds = STATE.plateAdds|0;
  STATE._lastTickRemoves = STATE.plateRemoves|0;
  STATE._lastTickChipToggles = STATE.chipToggles|0;

  const avgRtMs = STATE.submitLatencyMsList.length
    ? (STATE.submitLatencyMsList.reduce((a,b)=>a+b,0) / STATE.submitLatencyMsList.length)
    : 0;

  const currentStats = computePlateStats(STATE.selectedPlateIds || []);
  const groupCount = Object.values(currentStats.groups || {}).filter(v => Number(v) > 0).length;

  emit('hha:features_1s', {
    game:'plate-create',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || 0,
    timeLeftSec: STATE.timeLeft|0,
    roundNow: STATE.roundIndex+1,
    roundsPlanned: STATE.roundsPlanned|0,

    scoreNow: STATE.scoreTotal|0,
    scoreDelta1s: scoreDelta,
    submitNow: STATE.submitCount|0,
    submitDelta1s: submitDelta,
    passNow: STATE.passCount|0,
    passDelta1s: passDelta,
    failNow: STATE.failCount|0,
    failDelta1s: failDelta,

    poolClicksNow: STATE.poolClicks|0,
    poolClicksDelta1s: poolClickDelta,
    plateAddsNow: STATE.plateAdds|0,
    plateAddsDelta1s: addDelta,
    plateRemovesNow: STATE.plateRemoves|0,
    plateRemovesDelta1s: removeDelta,
    chipToggleNow: STATE.chipToggles|0,
    chipToggleDelta1s: chipToggleDelta,

    roundActive: !!STATE.roundActive,
    paused: !!STATE.paused,

    // live plate composition proxies
    plateCountNow: STATE.selectedPlateIds.length|0,
    plateMaxPick: STATE.cfg?.maxPick || 5,
    groupCountNow: groupCount|0,
    proteinNow: round1(currentStats.macros?.protein || 0),
    carbNow: round1(currentStats.macros?.carb || 0),
    fatNow: round1(currentStats.macros?.fat || 0),
    sugarNow: round1(currentStats.macros?.sugar || 0),
    costNow: round1(currentStats.cost || 0),
    prepNowMin: round1(currentStats.prepMin || 0),

    avgRtMs: round0(avgRtMs)
  });
}

function startTimers(){
  stopTimers();

  STATE._gameTimer = setInterval(()=>{
    if(!STATE.running || STATE.ended || STATE.paused) return;
    STATE.timeLeft--;
    renderTopSummary();

    emit('hha:time', {
      game:'plate-create',
      leftSec: STATE.timeLeft|0,
      timeLeftSec: STATE.timeLeft|0
    });
    emitScorePulse();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);

  STATE._featuresTimer = setInterval(()=>{
    if(!STATE.running || STATE.ended || STATE.paused) return;
    emitFeatures1s();
  }, 1000);
}

function stopTimers(){
  try{ clearInterval(STATE._gameTimer); }catch(e){}
  try{ clearInterval(STATE._featuresTimer); }catch(e){}
  STATE._gameTimer = null;
  STATE._featuresTimer = null;
}

// --------------------------------------------------
// Pause bridge / flush
// --------------------------------------------------
function setPaused(p){
  STATE.paused = !!p;
  emit('hha:pause_state', { game:'plate-create', paused: STATE.paused });
  const badge = q('crPaused');
  if(badge) badge.style.display = STATE.paused ? '' : 'none';
}
function wirePauseBridge(){
  if(STATE.__pauseBridgeWired) return;
  STATE.__pauseBridgeWired = true;

  STATE.__onPause = ()=>{ if(STATE.running && !STATE.ended) setPaused(true); };
  STATE.__onResume = ()=>{ if(STATE.running && !STATE.ended) setPaused(false); };

  ROOT.addEventListener('hha:pause', STATE.__onPause, { passive:true });
  ROOT.addEventListener('hha:resume', STATE.__onResume, { passive:true });
}

async function tryFlush(reason){
  try{
    const L = ROOT.HHA_LOGGER || ROOT.HHACloudLogger || ROOT.HHA_CloudLogger || null;
    if(L && typeof L.flush === 'function'){
      await Promise.race([ Promise.resolve(L.flush(reason||'manual')), new Promise(res=>setTimeout(res,650)) ]);
    }else if(L && typeof L.flushNow === 'function'){
      await Promise.race([ Promise.resolve(L.flushNow({ reason })), new Promise(res=>setTimeout(res,650)) ]);
    }
  }catch(e){}
}

// --------------------------------------------------
// Wiring UI
// --------------------------------------------------
function wireUIEvents(){
  // Pool click (add)
  q('crFoodPool')?.addEventListener('click', (e)=>{
    const btn = e.target?.closest?.('[data-food-id]');
    if(!btn) return;
    addFoodToPlate(btn.getAttribute('data-food-id'));
  });

  // Plate remove
  q('crPlateSlots')?.addEventListener('click', (e)=>{
    const btn = e.target?.closest?.('[data-remove-food-id]');
    if(!btn) return;
    removeFoodFromPlate(btn.getAttribute('data-remove-food-id'));
  });

  // Reason chips
  q('crReasonChips')?.addEventListener('click', (e)=>{
    const btn = e.target?.closest?.('[data-chip-id]');
    if(!btn) return;
    toggleReasonChip(btn.getAttribute('data-chip-id'));
  });

  q('crSubmit')?.addEventListener('click', ()=> handleSubmit(), { passive:true });
  q('crNext')?.addEventListener('click', ()=> nextRoundOrEnd(), { passive:true });

  q('crClearPlate')?.addEventListener('click', ()=> clearPlate(), { passive:true });
  q('crShufflePool')?.addEventListener('click', ()=> shufflePool(), { passive:true });

  q('crRestart')?.addEventListener('click', async ()=>{
    await tryFlush('plate-create-restart');
    location.reload();
  }, { passive:true });

  q('crBackHub')?.addEventListener('click', async ()=>{
    await tryFlush('plate-create-back-hub');
    const U = new URL(location.href);
    const hub = U.searchParams.get('hub') || '';
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }, { passive:true });

  q('crExplain')?.addEventListener('keydown', (e)=>{
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
      e.preventDefault();
      handleSubmit();
    }
  });
}

// --------------------------------------------------
// Start / boot
// --------------------------------------------------
function resetStateForGame(){
  STATE.running = true;
  STATE.ended = false;
  STATE.paused = false;

  STATE.timePlannedSec = Number(STATE.cfg?.durationPlannedSec || 240) || 240;
  STATE.timeLeft = STATE.timePlannedSec|0;
  STATE.roundsPlanned = Number(STATE.cfg?.roundsPlanned || 4) || 4;
  STATE.roundIndex = 0;
  STATE.roundActive = false;

  STATE.scoreTotal = 0;
  STATE.submitCount = 0;
  STATE.passCount = 0;
  STATE.failCount = 0;

  STATE.poolClicks = 0;
  STATE.plateAdds = 0;
  STATE.plateRemoves = 0;
  STATE.chipToggles = 0;
  STATE.shuffleCount = 0;
  STATE.clearCount = 0;
  STATE.choiceChanges = 0;

  STATE.submitLatencyMsList = [];

  STATE.currentScenario = null;
  STATE.foodPoolIds = [];
  STATE.selectedPlateIds = [];
  STATE.selectedReasonChipIds = [];
  STATE.lastRoundStartedAtMs = 0;
  STATE.lastRoundResult = null;

  STATE._lastTickScore = 0;
  STATE._lastTickSubmit = 0;
  STATE._lastTickPass = 0;
  STATE._lastTickFail = 0;
  STATE._lastTickPoolClicks = 0;
  STATE._lastTickAdds = 0;
  STATE._lastTickRemoves = 0;
  STATE._lastTickChipToggles = 0;

  const deterministic = (STATE.cfg.runMode === 'study' || STATE.cfg.runMode === 'research');
  STATE.rng = deterministic ? seededRng(STATE.cfg.seed) : Math.random;
}

function startGame(){
  resetStateForGame();
  renderTopSummary();

  emit('hha:start', {
    projectTag:'HHA',
    game:'plate-create',
    gameMode:'plate-create',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timePlannedSec,
    roundsPlanned: STATE.roundsPlanned,
    poolSize: STATE.cfg.poolSize,
    maxPick: STATE.cfg.maxPick,
    aiDeterministic: (STATE.cfg.runMode === 'study' || STATE.cfg.runMode === 'research')
  });

  setText('crSummary', 'จัดจานใหม่ให้ผ่านเงื่อนไข แล้วอธิบายเหตุผล');
  setText('crFeedback', 'แตะอาหารจากตัวเลือกเพื่อเพิ่มลงจาน');

  startTimers();
  startRound();
}

export function boot({ mount, cfg } = {}){
  STATE.mountEl = mount || document.body;
  STATE.cfg = normalizeCfg(cfg);

  if(!STATE.booted){
    STATE.booted = true;
    wireUIEvents();
    wirePauseBridge();

    window.addEventListener('beforeunload', ()=>{ try{ tryFlush('beforeunload'); }catch(e){} });
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden) try{ tryFlush('hidden'); }catch(e){}
    }, { passive:true });
  }

  renderReasonChips([]);
  renderTopSummary();
  show(q('crNext'), false);

  startGame();

  return {
    stop(reason='stop'){ endGame(reason); },
    pause(){ setPaused(true); },
    resume(){ setPaused(false); },
    getState(){ return STATE; }
  };
}

// Optional auto-init
(function autoInitMaybe(){
  try{
    const auto = document.documentElement?.getAttribute('data-plate-create-auto');
    if(auto !== '1') return;
    if(STATE.booted) return;
    boot({ mount: document.body, cfg: null });
  }catch(e){}
})();