// === fitness/js/jump-duck.js — Jump Duck Rush (BOSS + QUEST + AI v2.2) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- DOM refs ---------- */

const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

const elMode     = $('#jd-mode');
const elDiff     = $('#jd-diff');
const elDuration = $('#jd-duration');
const elAiToggle = $('#jd-ai');

const elResearchBlock = $('#jd-research-block');
const elPid     = $('#jd-participant-id');
const elGroup   = $('#jd-group');
const elNote    = $('#jd-note');

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudDur    = $('#hud-duration');
const elHudStab   = $('#hud-stability');
const elHudObs    = $('#hud-obstacles');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudTime   = $('#hud-time');
const elHudPhase  = $('#hud-phase');
const elHudAI     = $('#hud-ai');
const elHudQuest  = $('#hud-quest');

const elBossPhase = $('#boss-phase');
const elBossHpTxt = $('#boss-hp-text');
const elBossHpFill= $('#boss-hp-fill');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');

/* Result */
const resMode         = $('#res-mode');
const resDiff         = $('#res-diff');
const resDuration     = $('#res-duration');
const resTotalObs     = $('#res-total-obs');
const resHits         = $('#res-hits');
const resMiss         = $('#res-miss');
const resJumpHit      = $('#res-jump-hit');
const resDuckHit      = $('#res-duck-hit');
const resJumpMiss     = $('#res-jump-miss');
const resDuckMiss     = $('#res-duck-miss');
const resAcc          = $('#res-acc');
const resRTMean       = $('#res-rt-mean');
const resStabilityMin = $('#res-stability-min');
const resScore        = $('#res-score');
const resRank         = $('#res-rank');

/* ---------- Config ---------- */

const JD_DIFFS = {
  easy:   { speedUnitsPerSec: 38, spawnIntervalMs: 1300, hitWindowMs: 260, stabilityDamageOnMiss: 10, stabilityGainOnHit: 3, scorePerHit: 12 },
  normal: { speedUnitsPerSec: 48, spawnIntervalMs: 1000, hitWindowMs: 220, stabilityDamageOnMiss: 13, stabilityGainOnHit: 3, scorePerHit: 14 },
  hard:   { speedUnitsPerSec: 62, spawnIntervalMs:  800, hitWindowMs: 200, stabilityDamageOnMiss: 16, stabilityGainOnHit: 4, scorePerHit: 16 }
};

// spawn / hit line in % of field
const SPAWN_X   = 100;
const CENTER_X  = 24;
const MISS_X    = 4;

// phases by progress
const PHASE_THRESH = [0.33, 0.70]; // <0.33 => 1, <0.70 => 2, else 3

/* ---------- Seeded RNG ---------- */

function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function getSeed(){
  try{
    const q = new URL(location.href).searchParams;
    const s = q.get('seed');
    if(s != null && s !== ''){
      const n = Number(s);
      if(Number.isFinite(n)) return Math.floor(n) >>> 0;
      // hash string
      let h = 2166136261;
      const str = String(s);
      for(let i=0;i<str.length;i++){
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
  }catch{}
  return (Date.now() >>> 0);
}

/* ---------- SFX / UI helpers ---------- */

function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu'   && viewMenu)   viewMenu.classList.remove('jd-hidden');
  if (name === 'play'   && viewPlay)   viewPlay.classList.remove('jd-hidden');
  if (name === 'result' && viewResult) viewResult.classList.remove('jd-hidden');
}

function playSfx(id){
  const el = document.getElementById(id);
  if (!el) return;
  try{
    el.currentTime = 0;
    el.play().catch(()=>{});
  }catch{}
}

let judgeTimer = null;
function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=>{ elJudge.classList.remove('show'); }, 520);
}

function safeRemoveEl(el){
  try{ if(el && el.parentNode) el.parentNode.removeChild(el); }catch{}
}

function setPhaseClass(phase){
  document.body.classList.remove('jd-phase-1','jd-phase-2','jd-phase-3');
  document.body.classList.add('jd-phase-'+phase);
}

function modeLabel(mode){
  if (mode === 'training') return 'Training';
  if (mode === 'test')     return 'Test';
  if (mode === 'research') return 'Research';
  if (mode === 'tutorial') return 'Tutorial';
  return 'Play';
}

function fmtMs(ms){
  if (!ms || ms<=0) return '-';
  return ms.toFixed(0)+' ms';
}

function hardClearPlayfield(){
  if(elObsHost) elObsHost.innerHTML = '';
  if(elPlayArea) elPlayArea.classList.remove('shake','jd-boss-warn');
  if(elAvatar) elAvatar.classList.remove('jump','duck');
  if(elJudge){
    elJudge.classList.remove('show','ok','miss','combo');
    elJudge.textContent = 'READY';
  }
}

/* ---------- AI Predictor (online + deterministic) ---------- */

function createAIPredictor(rng){
  const S = {
    enabled: true,
    jumpAccEMA: 0.75,
    duckAccEMA: 0.75,
    jumpRtEMA:  220,
    duckRtEMA:  220,
    wJump: [0,0,0,0], // bias, combo, stability, phase
    wDuck: [0,0,0,0],
    lr: 0.06,
    targetP: 0.70,
    lastTypes: [],
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function sigmoid(z){ return 1/(1+Math.exp(-z)); }

  function features(state){
    const combo = clamp((state.combo||0)/10, 0, 1);
    const stab  = clamp((state.stability||0)/100, 0, 1);
    const ph    = clamp((state.phase||1)/3, 0, 1);
    return [1, combo, stab, ph];
  }

  function predictP(action, state){
    const x = features(state);
    const w = (action==='jump') ? S.wJump : S.wDuck;
    const z = w[0]*x[0] + w[1]*x[1] + w[2]*x[2] + w[3]*x[3];
    const p = sigmoid(z);
    const base = (action==='jump') ? S.jumpAccEMA : S.duckAccEMA;
    return clamp(0.55*p + 0.45*base, 0.05, 0.95);
  }

  function update(action, state, wasHit, rtMs){
    const x = features(state);
    const y = wasHit ? 1 : 0;

    const w = (action==='jump') ? S.wJump : S.wDuck;
    const p = sigmoid(w[0]*x[0] + w[1]*x[1] + w[2]*x[2] + w[3]*x[3]);
    const err = (y - p);
    for(let i=0;i<w.length;i++){
      w[i] += S.lr * err * x[i];
    }

    const a = 0.10;
    if(action==='jump') S.jumpAccEMA = (1-a)*S.jumpAccEMA + a*(y);
    else               S.duckAccEMA = (1-a)*S.duckAccEMA + a*(y);

    if(wasHit && rtMs && rtMs>0){
      const r = 0.08;
      if(action==='jump') S.jumpRtEMA = (1-r)*S.jumpRtEMA + r*rtMs;
      else               S.duckRtEMA = (1-r)*S.duckRtEMA + r*rtMs;
    }

    S.lastTypes.push(action);
    if(S.lastTypes.length > 10) S.lastTypes.shift();
  }

  function chooseNextRequiredAction(state){
    const pJ = predictP('jump', state);
    const pD = predictP('duck', state);

    const last  = S.lastTypes[S.lastTypes.length-1] || '';
    const last2 = S.lastTypes[S.lastTypes.length-2] || '';
    const tooSame = (last && last===last2);

    const scoreJ = Math.abs(pJ - S.targetP);
    const scoreD = Math.abs(pD - S.targetP);

    let pick = (scoreJ < scoreD) ? 'jump' : 'duck';

    if(tooSame){
      pick = (last==='jump') ? 'duck' : 'jump';
    }else{
      // mild randomness
      if(rng() < 0.18) pick = (pick==='jump') ? 'duck' : 'jump';
    }

    // phase3: force both
    if(state.phase === 3){
      if(rng() < 0.60) pick = (last==='jump') ? 'duck' : 'jump';
    }
    return pick;
  }

  function snapshot(){
    return {
      enabled: S.enabled,
      jumpAccEMA:+S.jumpAccEMA.toFixed(3),
      duckAccEMA:+S.duckAccEMA.toFixed(3),
      jumpRtEMA: Math.round(S.jumpRtEMA),
      duckRtEMA: Math.round(S.duckRtEMA),
      wJump: S.wJump.map(v=>+v.toFixed(3)),
      wDuck: S.wDuck.map(v=>+v.toFixed(3)),
    };
  }

  return {
    setEnabled(v){ S.enabled = !!v; },
    isEnabled(){ return !!S.enabled; },
    chooseNextRequiredAction,
    predictP,
    update,
    snapshot
  };
}

/* ---------- QUEST / BADGES (เน้นทั้งคู่) ---------- */

function createQuestSystem(rng){
  const Q = {
    id: 'perfect_both_3',
    title: 'PerfectBoth 3',
    desc: 'ต้องถูก 3 ครั้งติด โดยมีทั้ง Jump และ Duck',
    target: 3,
    streak: 0,
    used: {jump:0, duck:0},
    done: false,
    fail: 0
  };

  function pickNewQuest(state){
    // phase-based quest pool
    const poolP1 = ['perfect_both_3','alternate_6'];
    const poolP2 = ['alternate_6','no_miss_8'];
    const poolP3 = ['boss_burst_10s','alternate_8'];

    let pool = poolP1;
    if(state.phase === 2) pool = poolP2;
    if(state.phase === 3) pool = poolP3;

    const id = pool[Math.floor(rng()*pool.length)];
    if(id === 'perfect_both_3'){
      Q.id='perfect_both_3'; Q.title='PerfectBoth 3'; Q.desc='ถูก 3 ครั้งติด และต้องมีทั้ง Jump+Duck'; Q.target=3;
      Q.streak=0; Q.used={jump:0,duck:0}; Q.done=false; Q.fail=0;
    }else if(id === 'alternate_6'){
      Q.id='alternate_6'; Q.title='Alternate 6'; Q.desc='สลับ Jump/Duck ให้ถูกติดกัน 6 ครั้ง'; Q.target=6;
      Q.streak=0; Q.used={jump:0,duck:0}; Q.done=false; Q.fail=0;
    }else if(id === 'no_miss_8'){
      Q.id='no_miss_8'; Q.title='NoMiss 8'; Q.desc='ถูก 8 ครั้งก่อนพลาด'; Q.target=8;
      Q.streak=0; Q.used={jump:0,duck:0}; Q.done=false; Q.fail=0;
    }else if(id === 'boss_burst_10s'){
      Q.id='boss_burst_10s'; Q.title='BossBurst 10s'; Q.desc='Phase 3: ลดเลือดบอส 25% ภายใน 10 วินาที'; Q.target=25;
      Q.streak=0; Q.used={jump:0,duck:0}; Q.done=false; Q.fail=0;
      Q._startHp = state.bossHp;
      Q._startMs = state.elapsedMs;
    }else if(id === 'alternate_8'){
      Q.id='alternate_8'; Q.title='Alternate 8'; Q.desc='Phase 3: สลับถูก 8 ครั้งติด'; Q.target=8;
      Q.streak=0; Q.used={jump:0,duck:0}; Q.done=false; Q.fail=0;
    }
    return Q;
  }

  function updateHUD(){
    if(!elHudQuest) return;
    if(Q.done){
      elHudQuest.textContent = Q.title + ' ✓';
    }else{
      if(Q.id === 'boss_burst_10s'){
        elHudQuest.textContent = `${Q.title} ${Math.max(0, Math.round((Q._startHp - (window.__JD_STATE__?.bossHp ?? 100))))}/${Q.target}`;
      }else{
        elHudQuest.textContent = `${Q.title} ${Q.streak}/${Q.target}`;
      }
    }
  }

  function onHit(action, state){
    if(Q.done) return;

    if(Q.id === 'perfect_both_3'){
      Q.streak++;
      Q.used[action] = (Q.used[action]||0)+1;
      if(Q.streak >= Q.target && Q.used.jump>0 && Q.used.duck>0){
        Q.done = true;
        state.score += 120;
        showJudge('QUEST CLEAR! +120', 'combo');
      }
    }

    if(Q.id === 'no_miss_8'){
      Q.streak++;
      if(Q.streak >= Q.target){
        Q.done = true;
        state.score += 140;
        showJudge('QUEST CLEAR! +140', 'combo');
      }
    }

    if(Q.id === 'alternate_6' || Q.id === 'alternate_8'){
      // ต้องสลับ action ติดกัน
      const last = state._questLastAct || '';
      if(last && last === action){
        Q.streak = 1; // รีสตาร์ท (เริ่มนับใหม่จากครั้งนี้)
      }else{
        Q.streak++;
      }
      state._questLastAct = action;
      if(Q.streak >= Q.target){
        Q.done = true;
        state.score += (Q.target>=8 ? 180 : 150);
        showJudge('ALTERNATE CLEAR! +BONUS', 'combo');
      }
    }

    if(Q.id === 'boss_burst_10s'){
      const dt = (state.elapsedMs - Q._startMs);
      if(dt <= 10000){
        const drop = (Q._startHp - state.bossHp);
        if(drop >= Q.target){
          Q.done = true;
          state.score += 220;
          showJudge('BOSS BURST! +220', 'combo');
        }
      }else{
        // time window missed -> reroll quest once
        if(Q.fail === 0){
          Q.fail = 1;
          pickNewQuest(state);
          showJudge('Quest เปลี่ยน! ลุยต่อ 🔄', 'ok');
        }
      }
    }

    updateHUD();
  }

  function onMiss(state){
    if(Q.done) return;

    // miss reset for most quests
    if(Q.id === 'perfect_both_3' || Q.id === 'no_miss_8' || Q.id.startsWith('alternate_')){
      Q.streak = 0;
      Q.used = {jump:0,duck:0};
      state._questLastAct = '';
    }

    updateHUD();
  }

  return { Q, pickNewQuest, updateHUD, onHit, onMiss };
}

/* ---------- Boss Skill Director (3 skills) ---------- */
/**
 * Skills:
 * 1) WALL: ยิงชุดเดียวกัน 3–4 ลูกถี่ ๆ (ทดสอบความอึด)
 * 2) SWITCH: เป้า flip ใกล้เส้นชน (เฟ้นท์หนัก)
 * 3) FAKE-COMBO: ปล่อยคู่ติด + อันแรกหลอกให้คิดว่าเหมือนเดิม
 */
function createBossDirector(rng){
  const B = {
    nextSkillAtMs: 0,
    cooldownMs: 5200,
    lastSkill: '',
  };

  function schedule(state){
    if(state.phase !== 3) return;
    if(B.nextSkillAtMs === 0){
      B.nextSkillAtMs = state.elapsedMs + 2800;
    }
  }

  function tryFire(state){
    if(state.phase !== 3) return null;
    if(state.elapsedMs < B.nextSkillAtMs) return null;

    const roll = rng();
    let skill = 'wall';
    if(roll < 0.33) skill='wall';
    else if(roll < 0.66) skill='switch';
    else skill='fakecombo';

    // avoid repeating same skill
    if(skill === B.lastSkill){
      skill = (skill === 'wall') ? 'switch' : 'wall';
    }
    B.lastSkill = skill;

    B.nextSkillAtMs = state.elapsedMs + B.cooldownMs + Math.floor(rng()*1800);
    return skill;
  }

  return { schedule, tryFire };
}

/* ---------- State ---------- */

let running   = false;
let state     = null;
let lastFrame = null;
let rafId     = null;

let rng = null;
let AI  = null;
let QS  = null;
let BOSS= null;

let lastAction = null; // {type, time}
let nextObstacleId = 1;

/* ---------- Logging (events CSV) ---------- */

function pushEvent(row){
  if (!state) return;
  state.events.push(row);
}

function buildEventsCsv(){
  if (!state || !state.events.length) return '';
  const rows = state.events;
  const cols = Object.keys(rows[0]);
  const esc = (v)=>{
    if (v == null) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')){
      return '"' + s.replace(/"/g,'""') + '"';
    }
    return s;
  };
  const lines = [cols.join(',')];
  for (const r of rows){
    lines.push(cols.map(c=>esc(r[c])).join(','));
  }
  return lines.join('\n');
}

/* ---------- HUD ---------- */

function setBossHp(v){
  state.bossHp = Math.max(0, Math.min(100, v));
  if(elBossHpTxt) elBossHpTxt.textContent = String(Math.round(state.bossHp));
  if(elBossHpFill) elBossHpFill.style.transform = `scaleX(${(state.bossHp/100).toFixed(3)})`;
}

function updateHUD(){
  if(!state) return;
  if (elHudMode)  elHudMode.textContent = modeLabel(state.mode);
  if (elHudDiff)  elHudDiff.textContent = state.diffKey;
  if (elHudDur)   elHudDur.textContent  = (state.durationMs/1000|0)+'s';
  if (elHudStab)  elHudStab.textContent = state.stability.toFixed(1)+'%';
  if (elHudObs)   elHudObs.textContent  = `${state.hits} / ${state.obstaclesSpawned}`;
  if (elHudScore) elHudScore.textContent= String(Math.round(state.score));
  if (elHudCombo) elHudCombo.textContent= String(state.combo);
  if (elHudTime)  elHudTime.textContent = (state.remainingMs/1000).toFixed(1);
  if (elHudPhase) elHudPhase.textContent= String(state.phase);
  if (elBossPhase) elBossPhase.textContent = String(state.phase);
  if (elHudAI) elHudAI.textContent = state.aiEnabled ? 'ON' : 'OFF';
  if (QS) QS.updateHUD();
}

/* ---------- Controls (fix clutter + ensure once) ---------- */

function installPlayControls(){
  if(!elPlayArea) return;
  if(elPlayArea.querySelector('.jd-controls')) return;

  const zones = document.createElement('div');
  zones.className = 'jd-tapzones';
  zones.innerHTML = `
    <div class="jd-tapzone" data-z="jump"></div>
    <div class="jd-tapzone" data-z="duck"></div>
  `;
  zones.addEventListener('pointerdown', (ev)=>{
    if(!running) return;
    const z = ev.target && ev.target.getAttribute('data-z');
    if(z === 'jump') triggerAction('jump');
    else if(z === 'duck') triggerAction('duck');
  }, {passive:true});

  const controls = document.createElement('div');
  controls.className = 'jd-controls';
  controls.innerHTML = `
    <button class="jd-control-btn jump" type="button" data-act="jump">
      <span class="jd-control-icon">⬆</span>
      <span class="jd-control-label">JUMP</span>
    </button>
    <button class="jd-control-btn duck" type="button" data-act="duck">
      <span class="jd-control-icon">⬇</span>
      <span class="jd-control-label">DUCK</span>
    </button>
  `;
  controls.addEventListener('pointerdown', (ev)=>{
    if(!running) return;
    const btn = ev.target.closest('button[data-act]');
    if(!btn) return;
    const act = btn.getAttribute('data-act');
    if(act === 'jump') triggerAction('jump');
    if(act === 'duck') triggerAction('duck');
  }, {passive:true});

  elPlayArea.appendChild(zones);
  elPlayArea.appendChild(controls);
}

/* ---------- Mode UI ---------- */

function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');

  // suggest AI off in test/research unless user touched
  if(elAiToggle){
    if(mode !== 'training'){
      if(!elAiToggle.dataset.touched) elAiToggle.checked = false;
    }else{
      if(!elAiToggle.dataset.touched) elAiToggle.checked = true;
    }
  }
}

/* ---------- Game start/stop ---------- */

function computePhase(progress){
  if(progress < PHASE_THRESH[0]) return 1;
  if(progress < PHASE_THRESH[1]) return 2;
  return 3;
}

function collectParticipant(metaMode){
  if (metaMode !== 'research') return {id:'', group:'', note:''};
  return {
    id:    (elPid?.value || '').trim(),
    group: (elGroup?.value || '').trim(),
    note:  (elNote?.value || '').trim()
  };
}

function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

function startGameBase(opts){
  const mode       = opts.mode || 'training';
  const diffKey    = opts.diffKey || (elDiff?.value) || 'normal';
  const cfg        = JD_DIFFS[diffKey] || JD_DIFFS.normal;
  const durationMs = opts.durationMs ?? (parseInt((elDuration?.value)||'60',10)*1000 || 60000);
  const isTutorial = !!opts.isTutorial;

  const seed = getSeed();
  rng  = mulberry32(seed);
  AI   = createAIPredictor(rng);
  QS   = createQuestSystem(rng);
  BOSS = createBossDirector(rng);

  let aiEnabled = !!(elAiToggle ? elAiToggle.checked : true);
  if(mode !== 'training') aiEnabled = !!(elAiToggle ? elAiToggle.checked : false);
  AI.setEnabled(aiEnabled);

  state = {
    sessionId: makeSessionId(),
    seed,
    mode,
    diffKey,
    cfg,
    isTutorial,
    aiEnabled,
    durationMs,
    startTime: performance.now(),
    elapsedMs: 0,
    remainingMs: durationMs,

    stability: 100,
    minStability: 100,

    obstacles: [],
    obstaclesSpawned: 0,

    hits: 0,
    miss: 0,

    jumpHit: 0,
    duckHit: 0,
    jumpMiss: 0,
    duckMiss: 0,

    score: 0,
    combo: 0,
    maxCombo: 0,
    hitRTs: [],

    phase: 1,
    bossHp: 100,
    bossDefeated: false,

    // spawn timing
    nextSpawnAt: performance.now() + 650,

    // quest helper
    _questLastAct: '',

    // boss skill flags
    bossSkill: { active:false, type:'', untilMs:0, wallRemain:0, wallReq:'jump' },

    participant: collectParticipant(mode),

    events: []
  };

  // allow QS to see state in HUD builder
  window.__JD_STATE__ = state;

  running = true;
  lastFrame = state.startTime;

  nextObstacleId = 1;
  lastAction = null;

  hardClearPlayfield();
  setPhaseClass(1);
  setBossHp(100);

  installPlayControls();
  showView('play');

  QS.pickNewQuest(state);
  QS.updateHUD();

  showJudge(isTutorial ? 'Tutorial: Low=JUMP · High=DUCK' : 'เริ่มเลย! เฟส 1 วอร์มอัพ ✨', 'ok');
  updateHUD();

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function startGame(){
  const mode = (elMode?.value) || 'training';
  startGameBase({ mode, isTutorial:false });
}

function startTutorial(){
  startGameBase({ mode:'training', diffKey:'easy', durationMs:15000, isTutorial:true });
}

function endGame(reason){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }
  if (!state) return;

  if (state.isTutorial){
    showJudge('จบ Tutorial! ไปบู๊บอสกัน 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  // result summary
  const totalObs = state.obstaclesSpawned || 0;
  const hits     = state.hits || 0;
  const acc      = totalObs ? hits/totalObs : 0;
  const rtMean   = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  fillResultView(acc, rtMean, totalObs);

  showView('result');
}

/* ---------- Result view ---------- */

function fillResultView(acc, rtMean, totalObs){
  const durSec = (state.durationMs||60000)/1000;

  if (resMode)         resMode.textContent         = modeLabel(state.mode);
  if (resDiff)         resDiff.textContent         = state.diffKey;
  if (resDuration)     resDuration.textContent     = durSec.toFixed(0)+'s';
  if (resTotalObs)     resTotalObs.textContent     = String(totalObs);
  if (resHits)         resHits.textContent         = String(state.hits);
  if (resMiss)         resMiss.textContent         = String(state.miss);
  if (resJumpHit)      resJumpHit.textContent      = String(state.jumpHit);
  if (resDuckHit)      resDuckHit.textContent      = String(state.duckHit);
  if (resJumpMiss)     resJumpMiss.textContent     = String(state.jumpMiss);
  if (resDuckMiss)     resDuckMiss.textContent     = String(state.duckMiss);
  if (resAcc)          resAcc.textContent          = (acc*100).toFixed(1)+' %';
  if (resRTMean)       resRTMean.textContent       = fmtMs(rtMean);
  if (resStabilityMin) resStabilityMin.textContent = (state.minStability||0).toFixed(1)+' %';
  if (resScore)        resScore.textContent        = String(Math.round(state.score));

  if (resRank){
    let rank = 'C';
    const stab = state.minStability ?? 0;
    if (acc >= 0.90 && stab >= 85) rank='S';
    else if (acc >= 0.80 && stab >= 75) rank='A';
    else if (acc >= 0.65 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40)   rank='D';
    // boss defeated bonus badge
    if(state.bossDefeated && (rank==='A' || rank==='S')) rank = 'S';
    resRank.textContent = rank;
  }
}

/* ---------- Input ---------- */

function triggerAction(type){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now };

  if (elAvatar){
    elAvatar.classList.remove('jump','duck');
    elAvatar.classList.add(type);
    setTimeout(()=>{ elAvatar && elAvatar.classList.remove(type); }, 180);
  }
}

function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp'){ ev.preventDefault(); triggerAction('jump'); }
  if (ev.code === 'ArrowDown'){ ev.preventDefault(); triggerAction('duck'); }
}

/* ---------- Obstacles ---------- */

function spawnObstacle(ts, progress){
  if (!elObsHost || !state) return;

  // spacing: prevent overlap too much
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > (state.phase === 3 ? 85 : 72)) return;

  // boss skill may override spawn pattern
  const bs = state.bossSkill;
  let required = '';

  // BOSS WALL: enforce same required for N spawns
  if(state.phase === 3 && bs.active && bs.type === 'wall' && bs.wallRemain > 0){
    required = bs.wallReq;
    bs.wallRemain--;
    if(bs.wallRemain <= 0){
      bs.active = false;
      bs.type = '';
      showJudge('WALL จบ! สลับให้ทันนะ 👀', 'ok');
    }
  }

  // normal decision if not overridden
  if(!required){
    if(state.aiEnabled && AI && AI.isEnabled()){
      required = AI.chooseNextRequiredAction({
        combo: state.combo,
        stability: state.stability,
        phase: state.phase
      });
    }else{
      required = (rng() < 0.5) ? 'jump' : 'duck';
      if(state.phase === 3 && state._lastReq){
        if(rng() < 0.62) required = (state._lastReq==='jump') ? 'duck' : 'jump';
      }
    }
  }
  state._lastReq = required;

  // phase-based feint
  const feintChance = state.isTutorial ? 0 : (state.phase === 2 ? 0.16 : (state.phase === 3 ? 0.28 : 0));
  let isFeint = (rng() < feintChance);

  // BOSS SWITCH skill: feint forced + flip late
  if(state.phase === 3 && bs.active && bs.type === 'switch'){
    isFeint = true;
  }

  // BOSS FAKECOMBO: spawn double with first being feint-ish
  const doDouble = (!state.isTutorial && state.phase === 3 && (rng() < 0.18));

  createObstacleDom(ts, required, isFeint, false);

  if(doDouble){
    setTimeout(()=>{
      if(!running || !state) return;
      const req2 = (required === 'jump') ? 'duck' : 'jump';
      // fakecombo: first is usually feint, second is clean
      createObstacleDom(performance.now(), req2, (rng()<0.12), true);
    }, 130);
  }

  state.obstaclesSpawned++;
}

function createObstacleDom(ts, required, feint, burst){
  const type = (required === 'duck') ? 'high' : 'low';

  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (type === 'high' ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = (required === 'duck') ? '⬇' : '⬆';

  const tagSpan = document.createElement('span');
  tagSpan.className = 'jd-obs-tag';
  tagSpan.textContent = (required === 'duck') ? 'DUCK' : 'JUMP';

  inner.appendChild(iconSpan);
  inner.appendChild(tagSpan);
  el.appendChild(inner);

  el.dataset.required = required;
  el.dataset.feint = feint ? '1' : '0';

  elObsHost.appendChild(el);

  state.obstacles.push({
    id: nextObstacleId++,
    required,
    type,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    hit:false,
    miss:false,
    element: el,
    centerTime: null,
    warned: false,
    feint: !!feint,
    flipped: false,
    burst: !!burst
  });
}

function maybeFlipFeint(obs){
  if(!obs || !obs.element || !obs.feint || obs.flipped) return;
  // flip near the line (switch can flip later)
  const bs = state.bossSkill;
  const flipGate = (state.phase === 3 && bs.active && bs.type === 'switch') ? (CENTER_X + 4) : (CENTER_X + 12);

  if(obs.x <= flipGate){
    obs.flipped = true;
    obs.required = (obs.required === 'jump') ? 'duck' : 'jump';
    obs.type = (obs.required === 'duck') ? 'high' : 'low';

    // update class
    obs.element.classList.toggle('jd-obstacle--high', obs.type === 'high');
    obs.element.classList.toggle('jd-obstacle--low',  obs.type === 'low');

    const icon = obs.element.querySelector('.jd-obs-icon');
    const tag  = obs.element.querySelector('.jd-obs-tag');
    if(icon) icon.textContent = (obs.required === 'duck') ? '⬇' : '⬆';
    if(tag)  tag.textContent  = (obs.required === 'duck') ? 'DUCK' : 'JUMP';

    // warn flash
    if(elPlayArea){
      elPlayArea.classList.add('jd-boss-warn');
      setTimeout(()=> elPlayArea && elPlayArea.classList.remove('jd-boss-warn'), 220);
    }
  }
}

function updateObstacles(dt, now, progress){
  const cfg = state.cfg;

  let speed = cfg.speedUnitsPerSec;

  if (state.mode === 'training' && !state.isTutorial){
    speed *= (1 + 0.25*progress);
  }
  if(state.phase === 2) speed *= 1.05;
  if(state.phase === 3) speed *= 1.12;

  const move = speed * (dt/1000);
  const toRemove = [];

  for (const obs of state.obstacles){
    obs.x -= move;

    if (obs.element){
      obs.element.style.left = obs.x + '%';
    }

    if(!obs.resolved) maybeFlipFeint(obs);

    if (!obs.centerTime && obs.x <= CENTER_X){
      obs.centerTime = now;
    }

    if (!obs.warned && obs.x <= CENTER_X + (state.phase===3 ? 22 : 18)){
      obs.warned = true;
      playSfx('jd-sfx-beep');
    }

    // HIT check
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const action = lastAction;
      if (action && action.time){
        const dtAction = Math.abs(action.time - now);
        const match = (action.type === obs.required);

        if (match && dtAction <= cfg.hitWindowMs){
          obs.resolved = true;
          obs.hit = true;

          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          const base   = cfg.scorePerHit;
          const stabil = state.stability > 80 ? 1.10 : 1.0;
          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const phaseM = (state.phase === 1) ? 1.0 : (state.phase === 2 ? 1.12 : 1.25);
          const gain   = Math.round(base * stabil * comboM * phaseM);

          state.score += gain;

          state.hits++;
          if(obs.required === 'jump') state.jumpHit++; else state.duckHit++;

          state.stability = Math.min(100, state.stability + cfg.stabilityGainOnHit);
          state.minStability = Math.min(state.minStability, state.stability);

          // boss hp melt in phase3: ต้องทั้งคู่ถึงจะละลายไว
          if(state.phase === 3){
            const dmg = 6.5 + Math.min(6, state.combo)*0.35 + (obs.required==='jump' ? 0.5 : 0.5);
            setBossHp(state.bossHp - dmg);
          }

          // remove DOM
          if(obs.element){
            const old = obs.element;
            obs.element = null;
            setTimeout(()=> safeRemoveEl(old), 210);
          }

          state.hitRTs.push(dtAction);

          // AI update
          if(state.aiEnabled && AI && AI.isEnabled()){
            AI.update(obs.required, {combo: state.combo, stability: state.stability, phase: state.phase}, true, dtAction);
          }

          // QUEST update (เน้นทั้งคู่)
          QS.onHit(obs.required, state);

          pushEvent({
            session_id: state.sessionId,
            seed: state.seed,
            mode: state.mode,
            diff: state.diffKey,
            phase: state.phase,
            ai_enabled: state.aiEnabled ? 1 : 0,
            event_type: 'hit',
            required_action: obs.required,
            rt_ms: Math.round(dtAction),
            time_ms: Math.round(state.elapsedMs),
            combo_after: state.combo,
            score_delta: gain,
            score_after: Math.round(state.score),
            stability_after_pct: +state.stability.toFixed(1),
            boss_hp_after: +state.bossHp.toFixed(1),
            feint: obs.feint ? 1 : 0,
            participant_id: state.participant.id || '',
            group: state.participant.group || '',
            note: state.participant.note || ''
          });

          if (state.combo >= 10){
            showJudge('COMBO x'+state.combo+' 🔥', 'combo');
            playSfx('jd-sfx-combo');
          }else{
            showJudge((obs.required==='jump') ? 'JUMP! 🦘' : 'DUCK! 🛡️', 'ok');
            playSfx('jd-sfx-hit');
          }

          continue;
        }
      }
    }

    // MISS
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;
      obs.miss = true;

      state.miss++;
      if(obs.required === 'jump') state.jumpMiss++; else state.duckMiss++;

      state.combo = 0;

      state.stability = Math.max(0, state.stability - cfg.stabilityDamageOnMiss);
      state.minStability = Math.min(state.minStability, state.stability);

      // boss punish (heal a bit)
      if(state.phase === 3){
        setBossHp(state.bossHp + 3.5);
      }

      if(obs.element){
        const old = obs.element;
        obs.element = null;
        setTimeout(()=> safeRemoveEl(old), 210);
      }

      // AI update
      if(state.aiEnabled && AI && AI.isEnabled()){
        AI.update(obs.required, {combo: state.combo, stability: state.stability, phase: state.phase}, false, 0);
      }

      QS.onMiss(state);

      pushEvent({
        session_id: state.sessionId,
        seed: state.seed,
        mode: state.mode,
        diff: state.diffKey,
        phase: state.phase,
        ai_enabled: state.aiEnabled ? 1 : 0,
        event_type: 'miss',
        required_action: obs.required,
        rt_ms: '',
        time_ms: Math.round(state.elapsedMs),
        combo_after: state.combo,
        score_delta: 0,
        score_after: Math.round(state.score),
        stability_after_pct: +state.stability.toFixed(1),
        boss_hp_after: +state.bossHp.toFixed(1),
        feint: obs.feint ? 1 : 0,
        participant_id: state.participant.id || '',
        group: state.participant.group || '',
        note: state.participant.note || ''
      });

      showJudge('MISS ลองใหม่อีกที ✨', 'miss');
      playSfx('jd-sfx-miss');
      if (elPlayArea){
        elPlayArea.classList.add('shake');
        setTimeout(()=> elPlayArea.classList.remove('shake'), 180);
      }
    }

    if (obs.x < -20){
      if (obs.element){
        safeRemoveEl(obs.element);
        obs.element = null;
      }
      toRemove.push(obs);
    }
  }

  if (toRemove.length){
    state.obstacles = state.obstacles.filter(o => !toRemove.includes(o));
  }

  // clear action after short time
  if (lastAction && now - lastAction.time > 260){
    lastAction = null;
  }
}

/* ---------- Boss Skill triggers ---------- */

function fireBossSkill(skill){
  const bs = state.bossSkill;
  bs.active = true;
  bs.type = skill;

  if(skill === 'wall'){
    bs.wallReq = (rng() < 0.5) ? 'jump' : 'duck';
    bs.wallRemain = 3 + (rng() < 0.45 ? 1 : 0); // 3–4
    showJudge(`BOSS: WALL (${bs.wallReq.toUpperCase()} x${bs.wallRemain})`, 'combo');
  }
  if(skill === 'switch'){
    bs.untilMs = state.elapsedMs + 2300;
    showJudge('BOSS: SWITCH (มันจะหลอกใกล้ ๆ) 👀', 'combo');
  }
  if(skill === 'fakecombo'){
    bs.untilMs = state.elapsedMs + 2400;
    showJudge('BOSS: FAKE-COMBO (คู่ติดมาแล้ว!) ⚡', 'combo');
  }

  if(elPlayArea){
    elPlayArea.classList.add('jd-boss-warn');
    setTimeout(()=> elPlayArea && elPlayArea.classList.remove('jd-boss-warn'), 520);
  }
}

/* ---------- Loop ---------- */

function loop(ts){
  if (!running || !state) return;

  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  state.elapsedMs = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  const progress = Math.min(1, state.elapsedMs / state.durationMs);

  // phase update
  const newPhase = computePhase(progress);
  if(newPhase !== state.phase){
    state.phase = newPhase;
    setPhaseClass(newPhase);

    if(newPhase === 2){
      showJudge('เฟส 2: เริ่มมี FEINT แล้วนะ 👀', 'ok');
      QS.pickNewQuest(state);
    }
    if(newPhase === 3){
      showJudge('🔥 BOSS PHASE! สลับ Jump/Duck ให้ไว!', 'combo');
      QS.pickNewQuest(state);
      BOSS.schedule(state);
    }
  }

  // end by time
  if(state.elapsedMs >= state.durationMs){
    endGame('timeout');
    return;
  }

  // boss defeated early
  if(state.phase === 3 && state.bossHp <= 0 && !state.bossDefeated){
    state.bossDefeated = true;
    state.score += 250;
    showJudge('🏆 BOSS DEFEATED! +250', 'combo');
    endGame('boss-defeated');
    return;
  }

  // boss director
  if(state.phase === 3){
    // expire some skills
    const bs = state.bossSkill;
    if(bs.active && (bs.type === 'switch' || bs.type === 'fakecombo')){
      if(state.elapsedMs >= bs.untilMs){
        bs.active = false;
        bs.type = '';
      }
    }

    const skill = BOSS.tryFire(state);
    if(skill) fireBossSkill(skill);
  }

  // spawn obstacles (interval + ramp)
  while(ts >= state.nextSpawnAt){
    spawnObstacle(ts, progress);

    let interval = state.cfg.spawnIntervalMs;

    if(state.mode === 'training' && !state.isTutorial){
      const factor = 1 - 0.30*progress;
      interval = interval * Math.max(0.58, factor);
    }

    if(state.phase === 2) interval *= 0.92;
    if(state.phase === 3) interval *= 0.78;

    // if boss skill active: slightly faster
    if(state.phase === 3 && state.bossSkill.active) interval *= 0.86;

    state.nextSpawnAt += interval;
  }

  updateObstacles(dt, ts, progress);
  updateHUD();

  rafId = requestAnimationFrame(loop);
}

/* ---------- Export ---------- */

function initJD(){
  installPlayControls();

  elAiToggle?.addEventListener('change', ()=>{
    elAiToggle.dataset.touched = '1';
  });

  $('[data-action="start"]')?.addEventListener('click', ()=> startGame());
  $('[data-action="tutorial"]')?.addEventListener('click', ()=> startTutorial());

  $('[data-action="stop-early"]')?.addEventListener('click', ()=>{
    if (running) endGame('manual');
  });

  $('[data-action="play-again"]')?.addEventListener('click', ()=> startGame());

  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=> showView('menu'));
  });

  window.addEventListener('keydown', handleKeyDown, {passive:false});

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  showView('menu');
}

window.JD_EXPORT = {
  getEventsCsv(){ return buildEventsCsv(); },
  getModel(){ try{ return AI ? AI.snapshot() : null; }catch{ return null; } },
  getState(){ return state ? JSON.parse(JSON.stringify(state)) : null; }
};

window.addEventListener('DOMContentLoaded', initJD);