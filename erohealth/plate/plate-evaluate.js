// === /herohealth/plate/plate-evaluate.js ===
// HeroHealth Plate Evaluate (Critique A/B) — v1.0
// ✅ Evaluate level (Bloom): compare plate A/B and justify
// ✅ Uses shared scoring core: /herohealth/plate/plate-reasoning-score.js
// ✅ Deterministic scenarios/pairs with seed
// ✅ Emits HHA events: start / score / judge / end / labels / features_1s
// ✅ UI-agnostic enough but expects IDs from plate-evaluate.html
//
// Expected HTML IDs (recommended):
// - evScenarioTitle, evScenarioMeta, evRoundPill
// - evPlateA, evPlateB (containers for food chips/cards)
// - evPickA, evPickB (buttons)
// - evReasonChips (container)
// - evExplain (textarea/input)
// - evSubmit, evNext, evRestart, evBackHub
// - evScore, evCorrect, evRound, evTimer
// - evFeedback, evSummary
// - evDebug (optional)
//
// Exports:
// - boot({ mount, cfg })
// - buildEvaluatePairForScenario(scenario, rng?)  (optional helper)

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
  scoreEvaluateChoice,
  summarizeScoreTH
} from './plate-reasoning-score.js';

// --------------------------------------------------
// Utilities
// --------------------------------------------------
const ROOT = window;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function q(id){ return document.getElementById(id); }
function setText(id, v){ const el=q(id); if(el) el.textContent = String(v ?? ''); }
function show(el, on=true){ if(el) el.style.display = on ? '' : 'none'; }
function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}
function esc(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uniq(arr){ return [...new Set((Array.isArray(arr)?arr:[]).map(String))]; }
function round1(v){ return Math.round((Number(v)||0) * 10) / 10; }
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
  const time = clamp(U.searchParams.get('time') || 180, 30, 3600);
  const rounds = clamp(U.searchParams.get('rounds') || 5, 1, 20);
  const seedQ = U.searchParams.get('seed');
  const scenario = U.searchParams.get('scenario') || ''; // optional fixed scenario
  const isStudy = (runRaw === 'study' || runRaw === 'research');

  const seed = isStudy
    ? (Number(seedQ) || 24681357)
    : (seedQ != null ? (Number(seedQ)||24681357) : ((Date.now() ^ (Math.random()*1e9))|0));

  return {
    runMode: isStudy ? runRaw : 'play',
    diff: ['easy','normal','hard'].includes(diff) ? diff : 'normal',
    durationPlannedSec: time,
    roundsPlanned: rounds,
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

  x.durationPlannedSec = clamp(x.durationPlannedSec ?? x.time ?? d.durationPlannedSec ?? 180, 30, 3600);
  x.roundsPlanned = clamp(x.roundsPlanned ?? x.rounds ?? d.roundsPlanned ?? 5, 1, 20);

  const isStudy = (x.runMode === 'study' || x.runMode === 'research');
  x.seed = isStudy ? (Number(x.seed)||24681357) : (Number(x.seed)||((Date.now() ^ (Math.random()*1e9))|0));
  x.scenario = String(x.scenario || d.scenario || '');

  return x;
}

// --------------------------------------------------
// Fallback reason chips (if scenario file doesn't expose list)
// (IDs should match plate-reasoning-scenarios.js / plate-reasoning-score.js)
// --------------------------------------------------
const REASON_CHIPS_FALLBACK = [
  { id:'veg_enough',      labelTH:'มีผักเพียงพอ', polarity:'good' },
  { id:'protein_ok',      labelTH:'โปรตีนเหมาะสม', polarity:'good' },
  { id:'carb_ok',         labelTH:'คาร์บพอเหมาะ', polarity:'good' },
  { id:'fat_ok',          labelTH:'ไม่หวาน/มันเกินไป', polarity:'good' },
  { id:'budget_fit',      labelTH:'อยู่ในงบ', polarity:'good' },
  { id:'time_fit',        labelTH:'เตรียมทันเวลา', polarity:'good' },
  { id:'allergy_safe',    labelTH:'ปลอดภัยต่อการแพ้', polarity:'good' },
  { id:'preworkout_fit',  labelTH:'เหมาะก่อนออกกำลัง', polarity:'good' },
  { id:'postworkout_fit', labelTH:'เหมาะหลังออกกำลัง', polarity:'good' },
  { id:'school_morning_fit', labelTH:'เหมาะมื้อเช้าไปโรงเรียน', polarity:'good' },
  { id:'home_ingredient_fit', labelTH:'ใช้วัตถุดิบที่บ้านได้คุ้ม', polarity:'good' },

  { id:'veg_too_low',      labelTH:'ผักน้อยเกินไป', polarity:'bad' },
  { id:'protein_too_low',  labelTH:'โปรตีนน้อยไป', polarity:'bad' },
  { id:'carb_too_high',    labelTH:'แป้ง/คาร์บมากเกินไป', polarity:'bad' },
  { id:'sugar_high',       labelTH:'น้ำตาลสูง', polarity:'bad' },
  { id:'fried_high',       labelTH:'มีของทอด/มันเกินไป', polarity:'bad' },
  { id:'budget_over',      labelTH:'เกินงบ', polarity:'bad' },
  { id:'time_over',        labelTH:'ใช้เวลาเตรียมนานเกิน', polarity:'bad' },
  { id:'allergy_violated', labelTH:'มีอาหารที่แพ้', polarity:'bad' },
  { id:'energy_too_high',  labelTH:'พลังงานรวมสูงเกิน', polarity:'bad' },
  { id:'energy_too_low',   labelTH:'พลังงาน/สารอาหารยังไม่พอ', polarity:'bad' }
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

  // time + rounds
  timePlannedSec:0,
  timeLeft:0,
  roundIndex:0,      // 0-based
  roundsPlanned:5,
  roundActive:false,

  // evaluate metrics
  scoreTotal:0,
  correctCount:0,
  wrongCount:0,
  reasoningAvg:0, // derived
  submittedCount:0,

  // shot/click-ish metrics for HHA feature stream parity
  choiceChanges:0,
  chipToggles:0,
  submitLatencyMsList:[],

  // current round
  currentScenario:null,
  currentPair:null,
  selectedChoice:'', // A or B
  selectedReasonChipIds:[],
  lastRoundStartedAtMs:0,
  lastRoundResult:null,

  // features rolling
  _lastTickScore:0,
  _lastTickCorrect:0,
  _lastTickWrong:0,
  _lastTickChipToggles:0,
  _lastTickChoiceChanges:0,
  _featuresTimer:null,
  _gameTimer:null,

  // listeners
  __pauseBridgeWired:false,
  __onPause:null,
  __onResume:null
};

// --------------------------------------------------
// Scenario pair builder
// --------------------------------------------------
function allFoodIds(){
  return Object.keys(FOOD_MAP || {});
}

function foodHasGroup(id, g){
  return String(FOOD_MAP?.[id]?.group || '') === String(g || '');
}
function foodHasTag(id, tag){
  const tags = Array.isArray(FOOD_MAP?.[id]?.tags) ? FOOD_MAP[id].tags : [];
  return tags.map(String).includes(String(tag));
}
function foodCost(id){ return Number(FOOD_MAP?.[id]?.cost || 0) || 0; }
function foodPrep(id){ return Number(FOOD_MAP?.[id]?.prepMin || 0) || 0; }

function chooseFoodsForScenarioBase(scenario, rng=Math.random){
  // Build "better" plate candidates heuristically from constraints/targetProfile
  const ids = allFoodIds();
  const c = scenario?.constraints || {};
  const t = scenario?.targetProfile || {};

  let pool = [...ids];

  // allergy filter (dairy only known in scoring engine, but we can also filter "dairy" tag if provided)
  if(Array.isArray(c.allergy) && c.allergy.includes('dairy')){
    pool = pool.filter(id => !foodHasTag(id, 'dairy'));
  }

  // avoid sugar
  if(c.avoidHighSugar){
    pool = pool.filter(id => !foodHasTag(id, 'high_sugar'));
  }

  // prefer not fried
  if(t.preferNotFried){
    pool = pool.filter(id => !foodHasTag(id, 'fried'));
  }

  // target groups
  const wantGroups = Array.isArray(t.wantGroups) ? t.wantGroups : ['carb','protein','veg','fruit'];
  const optionalGroups = Array.isArray(t.optionalGroups) ? t.optionalGroups : ['fat'];

  const chosen = [];
  const used = new Set();

  // pick one from each desired group if possible
  for(const g of wantGroups){
    const cand = shuffle(pool.filter(id => foodHasGroup(id, g) && !used.has(id)), rng);
    if(cand[0]){
      chosen.push(cand[0]); used.add(cand[0]);
    }
  }

  // add one optional sometimes
  if(optionalGroups.length && rng() < 0.55){
    const og = pickOne(optionalGroups, rng);
    const cand = shuffle(pool.filter(id => foodHasGroup(id, og) && !used.has(id)), rng);
    if(cand[0]){ chosen.push(cand[0]); used.add(cand[0]); }
  }

  // if too few, top up randomly from filtered pool
  while(chosen.length < 4){
    const cand = pickOne(pool.filter(id => !used.has(id)), rng);
    if(!cand) break;
    chosen.push(cand); used.add(cand);
  }

  // trim by budget/time heuristics if needed
  const budgetMax = Number(c.budgetMax || 0);
  const prepMax = Number(c.prepTimeMaxMin || 0);

  let safety = 0;
  while(safety++ < 50){
    const stats = computePlateStats(chosen);
    let changed = false;

    if(budgetMax > 0 && budgetMax < 999 && Number(stats.cost||0) > budgetMax){
      // replace highest cost item
      let hiIdx = -1, hiCost = -1;
      for(let i=0;i<chosen.length;i++){
        const cc = foodCost(chosen[i]);
        if(cc > hiCost){ hiCost = cc; hiIdx = i; }
      }
      const alternatives = shuffle(pool.filter(id =>
        !used.has(id) &&
        foodCost(id) <= hiCost &&
        (!foodHasTag(id,'fried') || !t.preferNotFried)
      ), rng);
      if(hiIdx >= 0 && alternatives[0]){
        used.delete(chosen[hiIdx]);
        chosen[hiIdx] = alternatives[0];
        used.add(alternatives[0]);
        changed = true;
      }
    }

    if(prepMax > 0 && Number(stats.prepMin||0) > prepMax){
      let hiIdx = -1, hiPrep = -1;
      for(let i=0;i<chosen.length;i++){
        const pp = foodPrep(chosen[i]);
        if(pp > hiPrep){ hiPrep = pp; hiIdx = i; }
      }
      const alternatives = shuffle(pool.filter(id =>
        !used.has(id) && foodPrep(id) <= hiPrep
      ), rng);
      if(hiIdx >= 0 && alternatives[0]){
        used.delete(chosen[hiIdx]);
        chosen[hiIdx] = alternatives[0];
        used.add(alternatives[0]);
        changed = true;
      }
    }

    if(!changed) break;
  }

  return uniq(chosen).slice(0, 5);
}

function mutateToWorsePlate(baseItemIds, scenario, rng=Math.random){
  const ids = allFoodIds();
  const c = scenario?.constraints || {};
  const t = scenario?.targetProfile || {};

  let out = [...uniq(baseItemIds)];
  if(!out.length) out = chooseFoodsForScenarioBase(scenario, rng);

  // Mutation recipe: intentionally break 1-3 things
  const mutations = [];

  // 1) remove veg if exists
  if(out.some(id => foodHasGroup(id, 'veg')) && rng() < 0.8){
    const idx = out.findIndex(id => foodHasGroup(id, 'veg'));
    if(idx >= 0){
      const replace = pickOne(
        shuffle(ids.filter(id =>
          !out.includes(id) &&
          (foodHasGroup(id, 'carb') || foodHasTag(id, 'high_sugar') || foodHasTag(id, 'fried'))
        ), rng),
        rng
      );
      if(replace){
        out[idx] = replace;
        mutations.push('remove_veg');
      }
    }
  }

  // 2) add fried/high-sugar item by replacement
  if(rng() < 0.75){
    const badPool = shuffle(ids.filter(id =>
      !out.includes(id) && (foodHasTag(id, 'fried') || foodHasTag(id, 'high_sugar'))
    ), rng);
    if(badPool[0] && out.length){
      const idx = Math.floor(rng()*out.length);
      out[idx] = badPool[0];
      mutations.push('add_fried_or_sugar');
    }
  }

  // 3) violate budget/time sometimes
  if((Number(c.budgetMax||0) > 0 && Number(c.budgetMax||0) < 999) && rng() < 0.65){
    const expensive = shuffle(ids.filter(id => !out.includes(id) && foodCost(id) >= 3), rng);
    if(expensive[0] && out.length){
      out[Math.floor(rng()*out.length)] = expensive[0];
      mutations.push('budget_pressure');
    }
  }
  if(Number(c.prepTimeMaxMin||0) > 0 && rng() < 0.55){
    const slow = shuffle(ids.filter(id => !out.includes(id) && foodPrep(id) >= 10), rng);
    if(slow[0] && out.length){
      out[Math.floor(rng()*out.length)] = slow[0];
      mutations.push('time_pressure');
    }
  }

  // 4) allergy violation for dairy scenario
  if(Array.isArray(c.allergy) && c.allergy.includes('dairy') && rng() < 0.6){
    const dairyPool = shuffle(ids.filter(id => !out.includes(id) && foodHasTag(id, 'dairy')), rng);
    if(dairyPool[0] && out.length){
      out[Math.floor(rng()*out.length)] = dairyPool[0];
      mutations.push('allergy_violation');
    }
  }

  return { itemIds: uniq(out).slice(0, 5), mutations };
}

/**
 * Helper exported for testing / external use
 */
export function buildEvaluatePairForScenario(scenario, rng=Math.random){
  const scn = typeof scenario === 'string' ? getScenarioById(scenario) : scenario;
  if(!scn) throw new Error('PlateEvaluate: scenario not found');

  const goodIds = chooseFoodsForScenarioBase(scn, rng);
  let badObj = mutateToWorsePlate(goodIds, scn, rng);

  // Safety: if bad and good accidentally too similar in stats, mutate again
  let tries = 0;
  while(tries++ < 4){
    const sGood = computePlateStats(goodIds);
    const sBad = computePlateStats(badObj.itemIds);
    const delta =
      Math.abs((sGood.macros?.protein||0) - (sBad.macros?.protein||0)) +
      Math.abs((sGood.macros?.carb||0)    - (sBad.macros?.carb||0)) +
      Math.abs((sGood.macros?.fat||0)     - (sBad.macros?.fat||0)) +
      Math.abs((sGood.macros?.sugar||0)   - (sBad.macros?.sugar||0)) +
      Math.abs((sGood.cost||0)            - (sBad.cost||0));
    if(delta >= 5) break;
    badObj = mutateToWorsePlate(goodIds, scn, rng);
  }

  const AisCorrect = rng() < 0.5;
  const A = AisCorrect ? { itemIds: goodIds } : { itemIds: badObj.itemIds };
  const B = AisCorrect ? { itemIds: badObj.itemIds } : { itemIds: goodIds };

  A.stats = computePlateStats(A.itemIds);
  B.stats = computePlateStats(B.itemIds);

  return {
    scenarioId: scn.id,
    A,
    B,
    correctChoice: AisCorrect ? 'A' : 'B',
    meta: {
      badMutations: badObj.mutations || []
    }
  };
}

// --------------------------------------------------
// UI render
// --------------------------------------------------
function renderFoodChip(id){
  const f = FOOD_MAP?.[id];
  if(!f){
    return `<span class="food-chip unknown" data-id="${esc(id)}">${esc(id)}</span>`;
  }
  const emoji = f.emoji || '🍽️';
  const label = foodChipLabelTH ? foodChipLabelTH(id) : (f.labelTH || f.nameTH || id);
  const group = f.groupLabelTH || f.groupTH || f.group || '';
  return `<span class="food-chip" data-id="${esc(id)}" title="${esc(group)}">${esc(emoji)} ${esc(label)}</span>`;
}

function renderPlateStatsMini(stats){
  const m = stats?.macros || {};
  const g = stats?.groups || {};
  return `
    <div class="plate-mini-stats">
      <div class="row"><span>หมู่:</span><b>${esc(Object.entries(g).filter(([,v])=>v>0).map(([k])=>k).join(', ') || '-')}</b></div>
      <div class="row"><span>โปรตีน/คาร์บ/ไขมัน/น้ำตาล:</span><b>${round1(m.protein||0)} / ${round1(m.carb||0)} / ${round1(m.fat||0)} / ${round1(m.sugar||0)}</b></div>
      <div class="row"><span>งบ / เวลาเตรียม:</span><b>${round1(stats?.cost||0)} / ${round1(stats?.prepMin||0)} นาที</b></div>
    </div>
  `;
}

function renderPlateCard(targetEl, sideLabel, plateObj){
  if(!targetEl) return;
  const stats = plateObj?.stats || computePlateStats(plateObj?.itemIds || []);
  targetEl.innerHTML = `
    <div class="plate-card" data-side="${esc(sideLabel)}">
      <div class="plate-card-head">
        <div class="plate-card-title">จาน ${esc(sideLabel)}</div>
      </div>
      <div class="plate-foods">
        ${(plateObj?.itemIds || []).map(renderFoodChip).join('')}
      </div>
      ${renderPlateStatsMini(stats)}
    </div>
  `;
}

function getReasonChipsData(){
  // If page injects chips via global, allow override
  if(Array.isArray(ROOT.HHA_PLATE_REASON_CHIPS) && ROOT.HHA_PLATE_REASON_CHIPS.length){
    return ROOT.HHA_PLATE_REASON_CHIPS;
  }
  return REASON_CHIPS_FALLBACK;
}

function renderReasonChips(selectedIds=[]){
  const box = q('evReasonChips');
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
  const pair = STATE.currentPair;
  if(!scn || !pair) return;

  setText('evRoundPill', `รอบ ${STATE.roundIndex+1}/${STATE.roundsPlanned}`);
  setText('evScenarioTitle', scn.titleTH || scn.title || 'Plate Critique');
  setText('evScenarioMeta', summarizeConstraintsTH ? summarizeConstraintsTH(scn) : '');

  renderPlateCard(q('evPlateA'), 'A', pair.A);
  renderPlateCard(q('evPlateB'), 'B', pair.B);

  renderReasonChips(STATE.selectedReasonChipIds);

  const explain = q('evExplain');
  if(explain) explain.value = '';

  // reset pick UI
  updatePickButtons();
  setText('evFeedback', '');
  setText('evSummary', '');
  show(q('evNext'), false);
  const submit = q('evSubmit');
  if(submit){ submit.disabled = false; submit.textContent = 'ยืนยันคำตอบ'; }

  emitScorePulse();
}

function updatePickButtons(){
  const a = q('evPickA');
  const b = q('evPickB');
  if(a){
    a.classList.toggle('is-on', STATE.selectedChoice === 'A');
    a.setAttribute('aria-pressed', STATE.selectedChoice === 'A' ? 'true':'false');
  }
  if(b){
    b.classList.toggle('is-on', STATE.selectedChoice === 'B');
    b.setAttribute('aria-pressed', STATE.selectedChoice === 'B' ? 'true':'false');
  }
}

function renderTopSummary(){
  setText('evScore', STATE.scoreTotal);
  setText('evCorrect', `${STATE.correctCount}/${STATE.submittedCount || 0}`);
  setText('evRound', `${STATE.roundIndex+1}/${STATE.roundsPlanned}`);
  setText('evTimer', `${Math.max(0, STATE.timeLeft|0)}s`);
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
    throw new Error('plate-evaluate.js: no scenario IDs found from plate-reasoning-scenarios.js');
  }

  // deterministic round selection (avoid immediate repeat when possible)
  let pool = ids;
  if(STATE.currentScenario?.id && ids.length > 1){
    pool = ids.filter(id => id !== STATE.currentScenario.id);
    if(!pool.length) pool = ids;
  }
  const id = pickOne(pool, STATE.rng);
  const sc = getScenarioById(id);
  if(!sc) throw new Error(`plate-evaluate.js: scenario not found: ${id}`);
  return sc;
}

function startRound(){
  if(STATE.ended) return;
  STATE.roundActive = true;
  STATE.selectedChoice = '';
  STATE.selectedReasonChipIds = [];
  STATE.lastRoundResult = null;
  STATE.lastRoundStartedAtMs = nowMs();

  STATE.currentScenario = chooseScenarioForRound();
  STATE.currentPair = buildEvaluatePairForScenario(STATE.currentScenario, STATE.rng);

  renderCurrentRound();
  renderTopSummary();

  emit('hha:judge', {
    game:'plate-evaluate',
    kind:'round_start',
    round: STATE.roundIndex+1,
    scenarioId: STATE.currentScenario.id
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

function handleSubmit(){
  if(!STATE.running || STATE.paused || STATE.ended || !STATE.roundActive) return;

  const submitBtn = q('evSubmit');
  if(submitBtn) submitBtn.disabled = true;

  const explainText = String(q('evExplain')?.value || '').trim();

  const result = scoreEvaluateChoice({
    scenario: STATE.currentScenario,
    pair: STATE.currentPair,
    selectedChoice: STATE.selectedChoice,
    selectedReasonChipIds: STATE.selectedReasonChipIds,
    explanationText: explainText
  });

  STATE.lastRoundResult = result;
  STATE.roundActive = false;
  STATE.submittedCount++;

  const rtMs = Math.max(0, Math.round(nowMs() - STATE.lastRoundStartedAtMs));
  STATE.submitLatencyMsList.push(rtMs);

  if(result?.ok){
    STATE.scoreTotal += Number(result.score || 0);
    if(result.choiceCorrect) STATE.correctCount++;
    else STATE.wrongCount++;
  }

  // reasoningAvg derived
  const reasonSum = (STATE.submitLatencyMsList.length ? 0 : 0); // no-op placeholder
  void reasonSum;
  renderTopSummary();

  // UI feedback
  const sum = summarizeScoreTH(result);
  setText('evSummary', sum.shortTH || `คะแนน ${result?.score || 0}/100`);
  setText('evFeedback', result?.feedbackTH || '');

  // highlight correct answer
  const pickA = q('evPickA');
  const pickB = q('evPickB');
  if(pickA && pickB){
    pickA.classList.remove('is-correct','is-wrong');
    pickB.classList.remove('is-correct','is-wrong');

    const correct = String(result?.correctChoice || '').toUpperCase();
    const selected = String(result?.selectedChoice || '').toUpperCase();

    if(correct === 'A') pickA.classList.add('is-correct');
    if(correct === 'B') pickB.classList.add('is-correct');

    if(selected && selected !== correct){
      if(selected === 'A') pickA.classList.add('is-wrong');
      if(selected === 'B') pickB.classList.add('is-wrong');
    }
  }

  show(q('evNext'), true);
  if(submitBtn) submitBtn.textContent = 'ส่งแล้ว';

  // Emit HHA scoring
  emit('hha:score', {
    game:'plate-evaluate',
    round: STATE.roundIndex+1,
    roundsPlanned: STATE.roundsPlanned,
    scoreRound: Number(result?.score || 0),
    scoreTotal: STATE.scoreTotal|0,
    correctCount: STATE.correctCount|0,
    wrongCount: STATE.wrongCount|0,
    choiceCorrect: !!result?.choiceCorrect,
    misconceptionType: result?.misconceptionType || 'none',
    leftSec: STATE.timeLeft|0,
    timeLeftSec: STATE.timeLeft|0
  });

  emit('hha:judge', {
    game:'plate-evaluate',
    kind: 'evaluate_submit',
    round: STATE.roundIndex+1,
    scenarioId: STATE.currentScenario?.id || '',
    choice: result?.selectedChoice || '',
    correctChoice: result?.correctChoice || '',
    choiceCorrect: !!result?.choiceCorrect,
    reasonChipCount: (STATE.selectedReasonChipIds || []).length,
    misconceptionType: result?.misconceptionType || 'none',
    scoreRound: Number(result?.score || 0),
    rtMs
  });

  emit('hha:labels', {
    game:'plate-evaluate',
    type:'round_end',
    round: STATE.roundIndex+1,
    scenarioId: STATE.currentScenario?.id || '',
    y_score_round: Number(result?.score || 0),
    y_choice_correct: result?.choiceCorrect ? 1 : 0,
    y_reason_score: Number(result?.breakdown?.reasonScore || 0),
    y_explain_score: Number(result?.breakdown?.explanationScore || 0),
    y_misconception: result?.misconceptionType || 'none'
  });

  try{
    q('evDebug') && (q('evDebug').textContent = JSON.stringify(result, null, 2));
  }catch(e){}
}

function endGame(reason='end'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  STATE.roundActive = false;

  stopTimers();

  const avgScore = STATE.submittedCount ? (STATE.scoreTotal / STATE.submittedCount) : 0;
  const avgRtMs = STATE.submitLatencyMsList.length
    ? (STATE.submitLatencyMsList.reduce((a,b)=>a+b,0) / STATE.submitLatencyMsList.length)
    : 0;

  const summary = {
    timestampIso: new Date().toISOString(),
    game: 'plate-evaluate',
    gameMode: 'plate-evaluate',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || 0,
    roundsPlanned: STATE.roundsPlanned|0,
    roundsPlayed: STATE.submittedCount|0,
    scoreTotal: STATE.scoreTotal|0,
    scoreAvg: round1(avgScore),
    correctCount: STATE.correctCount|0,
    wrongCount: STATE.wrongCount|0,
    accuracyPct: STATE.submittedCount ? round1((STATE.correctCount / STATE.submittedCount) * 100) : 0,
    avgRtMs: round0(avgRtMs),
    timePlannedSec: STATE.timePlannedSec|0,
    timeLeftSec: STATE.timeLeft|0,
    reason
  };

  // localStorage last summary (compatible style)
  try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(e){}

  setText('evSummary', `จบโหมด Evaluate • เฉลี่ย ${summary.scoreAvg}/100 • ตอบถูก ${summary.correctCount}/${summary.roundsPlayed}`);
  setText('evFeedback', 'พร้อมไปต่อโหมด Create ได้เลย 🎯');

  emit('hha:end', summary);
  emit('hha:labels', {
    game:'plate-evaluate',
    type:'end',
    reason,
    y_score_total: summary.scoreTotal,
    y_score_avg: summary.scoreAvg,
    y_correct: summary.correctCount,
    y_wrong: summary.wrongCount,
    y_acc: summary.accuracyPct,
    y_avg_rt_ms: summary.avgRtMs
  });

  // flush-hardened logger best-effort
  tryFlush('plate-evaluate-end');
}

// --------------------------------------------------
// Timers + feature stream
// --------------------------------------------------
function emitScorePulse(){
  emit('hha:score', {
    game:'plate-evaluate',
    leftSec: STATE.timeLeft|0,
    timeLeftSec: STATE.timeLeft|0,
    scoreTotal: STATE.scoreTotal|0,
    correctCount: STATE.correctCount|0,
    wrongCount: STATE.wrongCount|0,
    round: STATE.roundIndex+1,
    roundsPlanned: STATE.roundsPlanned|0
  });
}

function emitFeatures1s(){
  // lightweight "reasoning interaction" features
  const scoreDelta = (STATE.scoreTotal - STATE._lastTickScore)|0;
  const correctDelta = (STATE.correctCount - STATE._lastTickCorrect)|0;
  const wrongDelta = (STATE.wrongCount - STATE._lastTickWrong)|0;
  const chipToggleDelta = (STATE.chipToggles - STATE._lastTickChipToggles)|0;
  const choiceChangeDelta = (STATE.choiceChanges - STATE._lastTickChoiceChanges)|0;

  STATE._lastTickScore = STATE.scoreTotal|0;
  STATE._lastTickCorrect = STATE.correctCount|0;
  STATE._lastTickWrong = STATE.wrongCount|0;
  STATE._lastTickChipToggles = STATE.chipToggles|0;
  STATE._lastTickChoiceChanges = STATE.choiceChanges|0;

  const avgRtMs = STATE.submitLatencyMsList.length
    ? (STATE.submitLatencyMsList.reduce((a,b)=>a+b,0) / STATE.submitLatencyMsList.length)
    : 0;

  emit('hha:features_1s', {
    game:'plate-evaluate',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || 0,
    timeLeftSec: STATE.timeLeft|0,
    roundNow: STATE.roundIndex+1,
    roundsPlanned: STATE.roundsPlanned|0,

    scoreNow: STATE.scoreTotal|0,
    scoreDelta1s: scoreDelta,

    correctNow: STATE.correctCount|0,
    correctDelta1s: correctDelta,
    wrongNow: STATE.wrongCount|0,
    wrongDelta1s: wrongDelta,

    chipToggleNow: STATE.chipToggles|0,
    chipToggleDelta1s: chipToggleDelta,
    choiceChangeNow: STATE.choiceChanges|0,
    choiceChangeDelta1s: choiceChangeDelta,

    selectedChoice: STATE.selectedChoice || '',
    selectedReasonCount: (STATE.selectedReasonChipIds || []).length,

    roundActive: !!STATE.roundActive,
    paused: !!STATE.paused,
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
      game:'plate-evaluate',
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
// Input handlers
// --------------------------------------------------
function onPick(choice){
  if(!STATE.running || STATE.paused || STATE.ended || !STATE.roundActive) return;
  const c = String(choice || '').toUpperCase();
  if(c !== 'A' && c !== 'B') return;
  if(STATE.selectedChoice !== c){
    STATE.choiceChanges++;
  }
  STATE.selectedChoice = c;
  updatePickButtons();

  emit('hha:judge', {
    game:'plate-evaluate',
    kind:'pick_choice',
    round: STATE.roundIndex+1,
    choice:c
  });
}

function onToggleReasonChip(chipId){
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
    game:'plate-evaluate',
    kind:'toggle_reason_chip',
    round: STATE.roundIndex+1,
    chipId:id,
    selected:set.has(id) ? 1 : 0,
    selectedCount: STATE.selectedReasonChipIds.length
  });
}

function wireUIEvents(){
  // Pick buttons
  q('evPickA')?.addEventListener('click', ()=> onPick('A'), { passive:true });
  q('evPickB')?.addEventListener('click', ()=> onPick('B'), { passive:true });

  // Reason chips (delegation)
  q('evReasonChips')?.addEventListener('click', (e)=>{
    const btn = e.target?.closest?.('[data-chip-id]');
    if(!btn) return;
    onToggleReasonChip(btn.getAttribute('data-chip-id'));
  });

  // Submit / next
  q('evSubmit')?.addEventListener('click', ()=> handleSubmit(), { passive:true });
  q('evNext')?.addEventListener('click', ()=> nextRoundOrEnd(), { passive:true });

  // restart
  q('evRestart')?.addEventListener('click', async ()=>{
    await tryFlush('plate-evaluate-restart');
    location.reload();
  }, { passive:true });

  // back hub
  q('evBackHub')?.addEventListener('click', async ()=>{
    await tryFlush('plate-evaluate-back-hub');
    const U = new URL(location.href);
    const hub = U.searchParams.get('hub') || '';
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }, { passive:true });

  // enter to submit (optional)
  q('evExplain')?.addEventListener('keydown', (e)=>{
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
      e.preventDefault();
      handleSubmit();
    }
  });
}

// --------------------------------------------------
// Pause bridge / flush
// --------------------------------------------------
function setPaused(p){
  STATE.paused = !!p;
  emit('hha:pause_state', { game:'plate-evaluate', paused: STATE.paused });
  const badge = q('evPaused');
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
      await Promise.race([
        Promise.resolve(L.flush(reason||'manual')),
        new Promise(res=>setTimeout(res, 650))
      ]);
    }else if(L && typeof L.flushNow === 'function'){
      await Promise.race([
        Promise.resolve(L.flushNow({ reason })),
        new Promise(res=>setTimeout(res, 650))
      ]);
    }
  }catch(e){}
}

// --------------------------------------------------
// Start / boot
// --------------------------------------------------
function resetStateForGame(){
  STATE.running = true;
  STATE.ended = false;
  STATE.paused = false;

  STATE.timePlannedSec = Number(STATE.cfg?.durationPlannedSec || 180) || 180;
  STATE.timeLeft = STATE.timePlannedSec|0;
  STATE.roundsPlanned = Number(STATE.cfg?.roundsPlanned || 5) || 5;
  STATE.roundIndex = 0;
  STATE.roundActive = false;

  STATE.scoreTotal = 0;
  STATE.correctCount = 0;
  STATE.wrongCount = 0;
  STATE.reasoningAvg = 0;
  STATE.submittedCount = 0;

  STATE.choiceChanges = 0;
  STATE.chipToggles = 0;
  STATE.submitLatencyMsList = [];

  STATE.currentScenario = null;
  STATE.currentPair = null;
  STATE.selectedChoice = '';
  STATE.selectedReasonChipIds = [];
  STATE.lastRoundStartedAtMs = 0;
  STATE.lastRoundResult = null;

  STATE._lastTickScore = 0;
  STATE._lastTickCorrect = 0;
  STATE._lastTickWrong = 0;
  STATE._lastTickChipToggles = 0;
  STATE._lastTickChoiceChanges = 0;

  const deterministic = (STATE.cfg.runMode === 'study' || STATE.cfg.runMode === 'research');
  STATE.rng = deterministic ? seededRng(STATE.cfg.seed) : Math.random;
}

function startGame(){
  resetStateForGame();
  renderTopSummary();

  emit('hha:start', {
    projectTag:'HHA',
    game:'plate-evaluate',
    gameMode:'plate-evaluate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timePlannedSec,
    roundsPlanned: STATE.roundsPlanned,
    aiDeterministic: (STATE.cfg.runMode === 'study' || STATE.cfg.runMode === 'research')
  });

  startTimers();
  startRound();
}

export function boot({ mount, cfg } = {}){
  // mount is optional for evaluate (DOM page-level UI), but accept to match HHA style
  STATE.mountEl = mount || document.body;
  STATE.cfg = normalizeCfg(cfg);

  if(!STATE.booted){
    STATE.booted = true;
    wireUIEvents();
    wirePauseBridge();

    // flush-hardened hooks
    window.addEventListener('beforeunload', ()=>{ try{ tryFlush('beforeunload'); }catch(e){} });
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden) try{ tryFlush('hidden'); }catch(e){}
    }, { passive:true });
  }

  // initial UI
  renderReasonChips([]);
  renderTopSummary();
  setText('evSummary', 'เลือกจานที่ดีกว่า แล้วอธิบายเหตุผล');
  setText('evFeedback', '');
  show(q('evNext'), false);

  startGame();

  return {
    stop(reason='stop'){ endGame(reason); },
    pause(){ setPaused(true); },
    resume(){ setPaused(false); },
    getState(){ return STATE; }
  };
}

// Optional auto-init (only if page marks opt-in)
(function autoInitMaybe(){
  try{
    const auto = document.documentElement?.getAttribute('data-plate-evaluate-auto');
    if(auto !== '1') return;
    if(STATE.booted) return;
    boot({ mount: document.body, cfg: null });
  }catch(e){}
})();