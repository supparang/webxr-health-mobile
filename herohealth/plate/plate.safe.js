// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION (HHA Standard + SAFE)
// ✅ Play: adaptive ON (fair), Research/Study: deterministic seed + adaptive OFF
// ✅ Works with Universal VR UI (vr-ui.js): tap-to-shoot => event hha:shoot
// ✅ Goal + Mini quest + Boss/Storm hooks (lightweight)
// ✅ End summary + Back HUB + Save last summary (localStorage HHA_LAST_SUMMARY)
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate
//
// Expected HTML:
// - #plate-layer   (play layer)
// - HUD elements created here (no dependency)
// - Include ../vr/mode-factory.js, ../vr/particles.js, ../vr/hha-cloud-logger.js, ../vr/vr-ui.js
//
// URL params:
// ?run=play|research|study
// &diff=easy|normal|hard
// &time=70
// &seed=123
// &hub=https%3A%2F%2F...%2Fhub.html
// &log=https%3A%2F%2Fscript.google.com%2Fmacros%2F...%2Fexec

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

const STORAGE_LAST = 'HHA_LAST_SUMMARY';

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function nowIso(){ return new Date().toISOString(); }
function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function rint(rng, a, b){ return Math.floor((rng()*((b+1)-a))+a); }
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)] || arr[0]; }
function pct(n, d){ d = Math.max(1, Number(d)||1); return Math.round((Number(n)||0) * 100 / d); }

function createSeededRng(seed){
  // xorshift32
  let x = (Number(seed)||0) >>> 0;
  if (!x) x = (Date.now() ^ 0x9E3779B9) >>> 0;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

function getRunMode(){
  const v = (qs('run','play')||'play').toLowerCase();
  if (v === 'research' || v === 'study') return 'research';
  return 'play';
}
function getDiff(){
  const v = (qs('diff','normal')||'normal').toLowerCase();
  if (v === 'easy' || v === 'hard' || v === 'normal') return v;
  return 'normal';
}

function ensurePlayLayer(){
  let el = DOC.querySelector('#plate-layer');
  if (el) return el;
  el = DOC.createElement('div');
  el.id = 'plate-layer';
  DOC.body.appendChild(el);
  return el;
}

function ensureUi(){
  // HUD Top (Goal/Mini)
  let hudTop = DOC.querySelector('.hud-top');
  if (!hudTop){
    hudTop = DOC.createElement('div');
    hudTop.className = 'hud-top';
    hudTop.innerHTML = `
      <div class="hud-chip" data-chip="goal">
        <div class="hud-title">GOAL</div>
        <div class="hud-row">
          <div class="hud-main" id="goalText">—</div>
          <div class="hud-right">
            <div class="hud-count" id="goalCount">0/0</div>
          </div>
        </div>
        <div class="hud-bar"><div class="hud-fill" id="goalFill"></div></div>
      </div>
      <div class="hud-chip" data-chip="mini">
        <div class="hud-title">MINI</div>
        <div class="hud-row">
          <div class="hud-main" id="miniText">—</div>
          <div class="hud-right">
            <div class="hud-count" id="miniCount">0/0</div>
          </div>
        </div>
        <div class="hud-bar"><div class="hud-fill" id="miniFill"></div></div>
      </div>
    `;
    DOC.body.appendChild(hudTop);
  }

  // Mini hint (optional)
  let miniPanel = DOC.querySelector('.mini-panel');
  if (!miniPanel){
    miniPanel = DOC.createElement('div');
    miniPanel.className = 'mini-panel';
    miniPanel.innerHTML = `
      <div class="mini-hint" id="miniHint" style="display:none">
        <div class="mini-tag">TIP</div>
        <div class="mini-text" id="miniHintText">—</div>
      </div>
    `;
    DOC.body.appendChild(miniPanel);
  }

  // Coach
  let coachPanel = DOC.querySelector('.coach-panel');
  if (!coachPanel){
    coachPanel = DOC.createElement('div');
    coachPanel.className = 'coach-panel';
    coachPanel.innerHTML = `
      <div class="coach-card">
        <img class="coach-img" id="coachImg" alt="coach" />
        <div class="coach-bubble">
          <div class="coach-name" id="coachName">COACH</div>
          <div class="coach-msg" id="coachMsg">พร้อมแล้ว ไปจัดจานให้สมดุลกัน!</div>
        </div>
      </div>
    `;
    DOC.body.appendChild(coachPanel);
  }

  // HUD buttons + stats
  let hudBtns = DOC.querySelector('.hud-btns');
  if (!hudBtns){
    hudBtns = DOC.createElement('div');
    hudBtns.className = 'hud-btns';
    hudBtns.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="k">SCORE</div><div class="v" id="statScore">0</div></div>
        <div class="stat"><div class="k">COMBO</div><div class="v" id="statCombo">0</div></div>
        <div class="stat"><div class="k">MISS</div><div class="v" id="statMiss">0</div></div>
        <div class="stat"><div class="k">TIME</div><div class="v" id="statTime">0</div></div>
      </div>

      <div class="bars">
        <div class="bar">
          <div class="bar-head"><span>PLATE</span><span id="plateProg">0%</span></div>
          <div class="bar-track"><div class="bar-fill" id="plateFill"></div></div>
        </div>
        <div class="bar">
          <div class="bar-head"><span>FEVER</span><span id="feverProg">0%</span></div>
          <div class="bar-track"><div class="bar-fill" id="feverFill"></div></div>
        </div>
      </div>

      <div class="groups" id="plateGroups"></div>

      <div class="actions">
        <button class="btn ghost" id="btnPeek">Mission</button>
        <button class="btn ghost" id="btnRestart">Restart</button>
        <button class="btn danger" id="btnBack">Back HUB</button>
      </div>
    `;
    DOC.body.appendChild(hudBtns);
  }

  // overlays (Start / Pause / Result)
  let startOv = DOC.querySelector('#startOverlay');
  if (!startOv){
    startOv = DOC.createElement('div');
    startOv.className = 'start-overlay';
    startOv.id = 'startOverlay';
    startOv.innerHTML = `
      <div class="start-card">
        <div class="brand">HEROHEALTH • BALANCED PLATE</div>
        <div class="title">จัดจานให้สมดุล!</div>
        <div class="sub" id="startSub"></div>
        <div class="tips">
          <div class="tip">ยิง/แตะ “อาหาร” ให้ตรงกับกลุ่มที่ต้องใส่ลงจาน</div>
          <div class="tip">อย่าพลาด! คอมโบช่วยทำแต้มให้พุ่ง</div>
          <div class="tip">โหมดวิจัย (research) จะ “คงที่” ด้วย seed เดิม</div>
        </div>
        <div class="start-actions">
          <button class="btn primary" id="btnStart">Start</button>
        </div>
        <div class="note muted">Tip: กด ENTER VR เพื่อเข้าโหมด VR (ถ้าอุปกรณ์รองรับ)</div>
      </div>
    `;
    DOC.body.appendChild(startOv);
  }

  let pauseOv = DOC.querySelector('#pauseOverlay');
  if (!pauseOv){
    pauseOv = DOC.createElement('div');
    pauseOv.className = 'overlay';
    pauseOv.id = 'pauseOverlay';
    pauseOv.style.display = 'none';
    pauseOv.innerHTML = `
      <div class="overlay-card">
        <div class="overlay-title">Pause</div>
        <div class="overlay-text">แตะ Start อีกครั้งเพื่อเล่นต่อ</div>
        <div style="margin-top:14px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap">
          <button class="btn primary" id="btnResume">Resume</button>
          <button class="btn ghost" id="btnPauseRestart">Restart</button>
          <button class="btn danger" id="btnPauseBack">Back HUB</button>
        </div>
      </div>
    `;
    DOC.body.appendChild(pauseOv);
  }

  let resultOv = DOC.querySelector('#resultOverlay');
  if (!resultOv){
    resultOv = DOC.createElement('div');
    resultOv.className = 'result-backdrop';
    resultOv.id = 'resultOverlay';
    resultOv.style.display = 'none';
    resultOv.innerHTML = `
      <div class="result-card">
        <div class="result-head">
          <div class="result-title" id="resTitle">สรุปผล</div>
          <div class="result-mode" id="resMode">—</div>
        </div>
        <div class="grade">
          <span>GRADE</span>
          <span class="grade-badge" id="resGrade">B</span>
          <span class="muted" id="resHint">—</span>
        </div>
        <div class="grid">
          <div class="cell"><div class="k">SCORE</div><div class="v" id="resScore">0</div></div>
          <div class="cell"><div class="k">ACCURACY</div><div class="v" id="resAcc">0%</div></div>
          <div class="cell"><div class="k">COMBO MAX</div><div class="v" id="resCombo">0</div></div>
          <div class="cell"><div class="k">GOALS</div><div class="v" id="resGoals">0/0</div></div>
          <div class="cell"><div class="k">MINI</div><div class="v" id="resMini">0/0</div></div>
          <div class="cell"><div class="k">MISS</div><div class="v" id="resMiss">0</div></div>
        </div>

        <div class="plate-break">
          <div class="k">PLATE CONTENT</div>
          <div class="groups2" id="resPlate">—</div>
        </div>

        <div class="result-actions">
          <button class="btn ghost" id="btnResultRestart">Restart</button>
          <button class="btn danger" id="btnResultBack">Back HUB</button>
        </div>
      </div>
    `;
    DOC.body.appendChild(resultOv);
  }

  // cache refs
  return {
    goalText: DOC.querySelector('#goalText'),
    goalCount: DOC.querySelector('#goalCount'),
    goalFill: DOC.querySelector('#goalFill'),
    miniText: DOC.querySelector('#miniText'),
    miniCount: DOC.querySelector('#miniCount'),
    miniFill: DOC.querySelector('#miniFill'),
    miniHint: DOC.querySelector('#miniHint'),
    miniHintText: DOC.querySelector('#miniHintText'),

    statScore: DOC.querySelector('#statScore'),
    statCombo: DOC.querySelector('#statCombo'),
    statMiss: DOC.querySelector('#statMiss'),
    statTime: DOC.querySelector('#statTime'),

    plateProg: DOC.querySelector('#plateProg'),
    plateFill: DOC.querySelector('#plateFill'),
    feverProg: DOC.querySelector('#feverProg'),
    feverFill: DOC.querySelector('#feverFill'),
    plateGroups: DOC.querySelector('#plateGroups'),

    coachImg: DOC.querySelector('#coachImg'),
    coachName: DOC.querySelector('#coachName'),
    coachMsg: DOC.querySelector('#coachMsg'),

    btnPeek: DOC.querySelector('#btnPeek'),
    btnRestart: DOC.querySelector('#btnRestart'),
    btnBack: DOC.querySelector('#btnBack'),

    startOverlay: DOC.querySelector('#startOverlay'),
    startSub: DOC.querySelector('#startSub'),
    btnStart: DOC.querySelector('#btnStart'),

    pauseOverlay: DOC.querySelector('#pauseOverlay'),
    btnResume: DOC.querySelector('#btnResume'),
    btnPauseRestart: DOC.querySelector('#btnPauseRestart'),
    btnPauseBack: DOC.querySelector('#btnPauseBack'),

    resultOverlay: DOC.querySelector('#resultOverlay'),
    resMode: DOC.querySelector('#resMode'),
    resGrade: DOC.querySelector('#resGrade'),
    resHint: DOC.querySelector('#resHint'),
    resScore: DOC.querySelector('#resScore'),
    resAcc: DOC.querySelector('#resAcc'),
    resCombo: DOC.querySelector('#resCombo'),
    resGoals: DOC.querySelector('#resGoals'),
    resMini: DOC.querySelector('#resMini'),
    resMiss: DOC.querySelector('#resMiss'),
    resPlate: DOC.querySelector('#resPlate'),
    btnResultRestart: DOC.querySelector('#btnResultRestart'),
    btnResultBack: DOC.querySelector('#btnResultBack'),
  };
}

function emit(name, detail={}){
  try { WIN.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
}

function setCoach(ui, msg, mood='neutral'){
  ui.coachName.textContent = 'COACH';
  ui.coachMsg.textContent = msg || '';
  // optional: hook known coach image set if available
  // user memory: coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png in /herohealth/img
  const base = '../img/';
  const map = {
    happy: 'coach-happy.png',
    sad: 'coach-sad.png',
    fever: 'coach-fever.png',
    neutral: 'coach-neutral.png',
  };
  const file = map[mood] || map.neutral;
  ui.coachImg.src = base + file;
  emit('hha:coach', { msg, mood });
}

function gradeFrom(score, accPct, goalsPct){
  // simple & kid-friendly
  const s = Number(score)||0;
  const a = Number(accPct)||0;
  const g = Number(goalsPct)||0;
  const v = (s/200) + (a/100) + (g/100);
  if (v >= 2.20) return ['S','สุดยอด! สมดุลมาก'];
  if (v >= 1.90) return ['A','เก่งมาก! ใกล้สมบูรณ์แล้ว'];
  if (v >= 1.60) return ['B','ดี! ลองเติมให้ครบกลุ่มขึ้น'];
  if (v >= 1.25) return ['C','พอใช้—ตั้งใจอีกนิดนะ'];
  return ['D','ลองใหม่ได้! เดี๋ยวเก่งขึ้นแน่นอน'];
}

/* ---------------- Plate model ---------------- */
const FOOD_GROUPS = [
  { key:'rice',  label:'ข้าว-แป้ง', emoji:['🍚','🍞','🥔','🍜','🥖'] },
  { key:'veg',   label:'ผัก',       emoji:['🥬','🥦','🥒','🥕','🍅'] },
  { key:'fruit', label:'ผลไม้',     emoji:['🍌','🍎','🍇','🍉','🍍'] },
  { key:'prot',  label:'โปรตีน',    emoji:['🥚','🐟','🍗','🫘','🥩'] },
  { key:'milk',  label:'นม',        emoji:['🥛','🧀','🥣'] },
];

function buildRoundPlan(diff){
  // target counts for a “balanced plate”
  // (not medical exact; game logic only)
  const base = (diff === 'easy') ? 10 : (diff === 'hard' ? 16 : 13);
  return {
    need: {
      rice:  Math.max(2, Math.round(base * 0.22)),
      veg:   Math.max(2, Math.round(base * 0.28)),
      fruit: Math.max(2, Math.round(base * 0.18)),
      prot:  Math.max(2, Math.round(base * 0.22)),
      milk:  Math.max(1, Math.round(base * 0.10)),
    },
    totalTarget: base
  };
}

function createQuest(diff, rng){
  const plan = buildRoundPlan(diff);

  const Q = {
    goalsTotal: 3,
    goalsCleared: 0,
    miniTotal: 2,
    miniCleared: 0,

    activeGoal: null,
    activeMini: null,
    allDone: false,

    plan,
    ticks: 0,

    goals: [
      { id:'fill-plate', text:'เติมจานให้ครบตามสัดส่วน', cur:0, target: plan.totalTarget, done:false },
      { id:'veg-focus',  text:'เก็บ “ผัก” ให้ถึงเป้า', cur:0, target: plan.need.veg, done:false },
      { id:'no-rush-miss', text:'อย่าพลาดเกินกำหนด', cur:0, target: 3, done:false }, // cur = misses, done when <= target at end or survive segment
    ],

    minis: [
      { id:'combo-6', text:'ทำคอมโบให้ได้ 6', cur:0, target:6, done:false },
      { id:'perfect-5', text:'เก็บถูกติดต่อกัน 5 ครั้ง', cur:0, target:5, done:false },
      { id:'milk-2', text:'เก็บนม 2 ครั้ง', cur:0, target:2, done:false },
    ],
  };

  function pickGoal(){
    const g = Q.goals.find(x=>!x.done);
    Q.activeGoal = g || null;
  }
  function pickMini(){
    const remain = Q.minis.filter(x=>!x.done);
    Q.activeMini = remain.length ? pick(rng, remain) : null;
  }

  function updateGoalProgress(id, cur, done=false){
    const g = Q.goals.find(x=>x.id===id);
    if (!g || g.done) return;
    g.cur = clamp(cur, 0, g.target);
    if (done){
      g.done = true;
      Q.goalsCleared++;
      pickGoal();
    }
  }
  function updateMiniProgress(id, cur, done=false){
    const m = Q.minis.find(x=>x.id===id);
    if (!m || m.done) return;
    m.cur = clamp(cur, 0, m.target);
    if (done){
      m.done = true;
      Q.miniCleared++;
      pickMini();
    }
  }

  function checkAllDone(){
    if (Q.goalsCleared >= Q.goalsTotal && Q.miniCleared >= Q.miniTotal){
      Q.allDone = true;
      emit('quest:update', { allDone:true, goalsCleared:Q.goalsCleared, miniCleared:Q.miniCleared });
    }
  }

  function start(){
    pickGoal();
    pickMini();
  }

  return {
    Q,
    start,
    updateGoalProgress,
    updateMiniProgress,
    checkAllDone,
  };
}

/* ---------------- Game core ---------------- */
export function boot(){
  if (!DOC) return;

  const runMode = getRunMode();            // play | research
  const diff = getDiff();                  // easy normal hard
  const durationPlannedSec = clamp(qs('time', '70'), 20, 240);
  const seedParam = qs('seed', '');
  const seed = seedParam ? Number(seedParam) : (Date.now());
  const rng = (runMode === 'research')
    ? createSeededRng(seed)
    : createSeededRng(seed); // play still seeded (for replay) but adaptive may vary slightly by performance

  const hub = qs('hub','') || '';
  const endpoint = qs('log','') || ''; // used by hha-cloud-logger.js itself (via URL) — we just pass through summary

  // UI & play layer
  ensurePlayLayer();
  const ui = ensureUi();

  // start overlay content
  ui.startSub.innerHTML = `
    <span>mode: <b>${runMode}</b></span>
    <span>diff: <b>${diff}</b></span>
    <span>time: <b>${durationPlannedSec}s</b></span>
    <span>seed: <b>${seed}</b></span>
  `;

  // state
  const S = {
    gameTag: 'PlateVR',
    gameMode: 'plate',
    runMode,
    diff,
    seed,
    sessionId: `PLATE-${Math.random().toString(16).slice(2)}-${Date.now()}`,
    startTimeIso: '',
    endTimeIso: '',
    phase: 'start',

    durationPlannedSec,
    tLeft: durationPlannedSec,
    timerHandle: null,
    running: false,

    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    nSpawned: 0,
    nHit: 0,
    nHitCorrect: 0,
    nHitWrong: 0,

    // plate composition
    plate: { rice:0, veg:0, fruit:0, prot:0, milk:0 },

    // difficulty knobs (adaptive in play only)
    spawnEveryMs: (diff==='easy') ? 760 : (diff==='hard' ? 520 : 640),
    ttlMs: (diff==='easy') ? 2400 : (diff==='hard' ? 1700 : 2050),
    sizePx: (diff==='easy') ? 86 : (diff==='hard' ? 66 : 76),
    adaptive: (runMode === 'play'),

    // perfect streak for mini
    perfectStreak: 0,

    // boss / rush
    rushOn: false,
    rushTicks: 0,

    // quest
    quest: createQuest(diff, rng),
  };

  // Build safezones so mode-factory won't spawn under HUD
  const SAFEZONE_SELECTORS = [
    '.hud-top',
    '.hud-btns',
    '.mini-panel',
    '.coach-panel',
    '.a-enter-vr, .a-enter-vr-button, .a-enter-ar' // best-effort A-Frame buttons
  ];

  // mode-factory engine
  const engine = factoryBoot({
    seed: S.seed,
    rng,
    spawnHost: '#plate-layer',
    boundsHost: '#plate-layer',
    safezoneSelectors: SAFEZONE_SELECTORS,
    // spread
    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',
  });

  function resetHud(){
    ui.statScore.textContent = '0';
    ui.statCombo.textContent = '0';
    ui.statMiss.textContent = '0';
    ui.statTime.textContent = String(S.durationPlannedSec);

    ui.plateGroups.innerHTML = '';
    renderPlateChips();
    setCoach(ui, 'พร้อมแล้ว! เริ่มจัดจานให้สมดุลกัน!', 'neutral');
  }

  function renderPlateChips(){
    const keys = Object.keys(S.plate);
    ui.plateGroups.innerHTML = keys.map(k=>{
      const g = FOOD_GROUPS.find(x=>x.key===k);
      const need = S.quest.Q.plan.need[k] || 0;
      const got = S.plate[k] || 0;
      const ok = got >= need;
      const cls = ok ? 'g' : 'g';
      const tag = `${g ? g.label : k}: ${got}/${need}`;
      return `<span class="${cls}">${tag}</span>`;
    }).join('');
    const cur = Object.values(S.plate).reduce((a,b)=>a+b,0);
    const total = S.quest.Q.plan.totalTarget;
    const p = Math.round(100 * cur / Math.max(1,total));
    ui.plateProg.textContent = `${clamp(p,0,100)}%`;
    ui.plateFill.style.width = `${clamp(p,0,100)}%`;
  }

  function updateQuestUi(){
    const Q = S.quest.Q;

    if (Q.activeGoal){
      ui.goalText.textContent = Q.activeGoal.text;
      ui.goalCount.textContent = `${Q.activeGoal.cur}/${Q.activeGoal.target}`;
      ui.goalFill.style.width = `${pct(Q.activeGoal.cur, Q.activeGoal.target)}%`;
    } else {
      ui.goalText.textContent = '—';
      ui.goalCount.textContent = '0/0';
      ui.goalFill.style.width = '0%';
    }

    if (Q.activeMini){
      ui.miniText.textContent = Q.activeMini.text;
      ui.miniCount.textContent = `${Q.activeMini.cur}/${Q.activeMini.target}`;
      ui.miniFill.style.width = `${pct(Q.activeMini.cur, Q.activeMini.target)}%`;
    } else {
      ui.miniText.textContent = '—';
      ui.miniCount.textContent = '0/0';
      ui.miniFill.style.width = '0%';
    }

    emit('quest:update', {
      goalsCleared: Q.goalsCleared,
      goalsTotal: Q.goalsTotal,
      miniCleared: Q.miniCleared,
      miniTotal: Q.miniTotal,
      activeGoal: Q.activeGoal ? { id:Q.activeGoal.id, cur:Q.activeGoal.cur, target:Q.activeGoal.target } : null,
      activeMini: Q.activeMini ? { id:Q.activeMini.id, cur:Q.activeMini.cur, target:Q.activeMini.target } : null
    });
  }

  function setTime(t){
    S.tLeft = Math.max(0, Math.floor(t));
    ui.statTime.textContent = String(S.tLeft);
    emit('hha:time', { tLeftSec: S.tLeft, durationPlannedSec: S.durationPlannedSec });
  }

  function addScore(delta, reason=''){
    S.score = Math.max(0, (S.score|0) + (delta|0));
    ui.statScore.textContent = String(S.score);
    emit('hha:score', { score:S.score, delta, reason });
  }

  function setCombo(v){
    S.combo = Math.max(0, v|0);
    S.comboMax = Math.max(S.comboMax, S.combo);
    ui.statCombo.textContent = String(S.combo);
  }

  function addMiss(reason=''){
    S.misses++;
    ui.statMiss.textContent = String(S.misses);
    setCombo(0);
    S.perfectStreak = 0;

    emit('hha:judge', { ok:false, reason });
  }

  function judgeTarget(t){
    // t.meta: { groupKey, isGood }
    const key = t?.meta?.groupKey;
    if (!key) return { ok:false, reason:'no-group' };

    const need = S.quest.Q.plan.need[key] || 0;
    const got = S.plate[key] || 0;

    // correct if still need this group, otherwise "overfill" counts as wrong in harder modes
    const overPenalty = (S.diff !== 'easy');
    const ok = (got < need) || (!overPenalty && got >= need);

    return { ok, reason: ok ? 'correct' : 'overfill' };
  }

  function onHitTarget(t){
    S.nHit++;
    const res = judgeTarget(t);

    if (res.ok){
      S.nHitCorrect++;
      S.plate[t.meta.groupKey] = (S.plate[t.meta.groupKey]||0) + 1;
      renderPlateChips();

      S.perfectStreak++;
      setCombo(S.combo + 1);

      const base = 10 + Math.min(20, S.combo*2);
      addScore(base, 'hit-correct');

      emit('hha:judge', { ok:true, reason:res.reason, groupKey:t.meta.groupKey });

      // update goals
      const totalNow = Object.values(S.plate).reduce((a,b)=>a+b,0);
      S.quest.updateGoalProgress('fill-plate', totalNow, totalNow >= S.quest.Q.plan.totalTarget);
      S.quest.updateGoalProgress('veg-focus', S.plate.veg||0, (S.plate.veg||0) >= S.quest.Q.plan.need.veg);

      // minis
      S.quest.updateMiniProgress('combo-6', S.combo, S.combo >= 6);
      S.quest.updateMiniProgress('perfect-5', S.perfectStreak, S.perfectStreak >= 5);
      S.quest.updateMiniProgress('milk-2', S.plate.milk||0, (S.plate.milk||0) >= 2);

      // coach micro tips (rate-limited)
      if (S.combo === 3) setCoach(ui, 'คอมโบมาแล้ว! รักษาให้ต่อเนื่องนะ', 'happy');
      if ((S.plate.veg||0) === S.quest.Q.plan.need.veg) setCoach(ui, 'ผักครบเป้าแล้ว เยี่ยม!', 'happy');

      // all done check
      S.quest.checkAllDone();
      updateQuestUi();

      // rush trigger: when near finish (adds excitement)
      const pctPlate = Math.round(100 * totalNow / Math.max(1,S.quest.Q.plan.totalTarget));
      if (!S.rushOn && pctPlate >= 70 && S.tLeft >= 10){
        S.rushOn = true;
        S.rushTicks = 0;
        setCoach(ui, 'เข้าสู่ “Plate Rush”! เร็วขึ้นอีกนิด!', 'fever');
      }
    } else {
      S.nHitWrong++;
      addMiss(res.reason);

      // penalty score (soft)
      addScore(-6, 'hit-wrong');
      setCoach(ui, 'โอ๊ะ อันนี้เกินสัดส่วนแล้ว ลองเปลี่ยนกลุ่มดูนะ', 'sad');

      // update miss goal (cur=misses) — this goal is evaluated at end as pass/fail
      const g = S.quest.Q.goals.find(x=>x.id==='no-rush-miss');
      if (g && !g.done){
        g.cur = S.misses;
      }
      updateQuestUi();
    }
  }

  function onExpireTarget(t){
    // treat expire as miss (kid pressure)
    addMiss('expire');
  }

  function makeFoodTarget(){
    // choose a group with remaining need (weighted), else any
    const need = S.quest.Q.plan.need;
    const weights = FOOD_GROUPS.map(g=>{
      const got = S.plate[g.key]||0;
      const rem = Math.max(0, (need[g.key]||0) - got);
      return { g, w: 1 + rem*2 };
    });
    let sum = weights.reduce((a,x)=>a+x.w,0);
    let r = rng() * sum;
    let chosen = weights[0].g;
    for (const x of weights){
      r -= x.w;
      if (r <= 0){ chosen = x.g; break; }
    }

    const emoji = pick(rng, chosen.emoji);
    return {
      text: emoji,
      meta: { groupKey: chosen.key }
    };
  }

  function spawnOne(){
    if (!S.running) return;

    const cfg = {
      ttlMs: S.ttlMs,
      sizePx: S.sizePx,
      cssClass: 'hha-target plate-target',
    };

    // Rush makes it spicy
    if (S.rushOn){
      cfg.ttlMs = Math.max(900, Math.floor(S.ttlMs * 0.72));
      cfg.sizePx = Math.max(56, Math.floor(S.sizePx * 0.92));
    }

    const t0 = makeFoodTarget();
    S.nSpawned++;

    const t = engine.spawnTarget({
      text: t0.text,
      ttlMs: cfg.ttlMs,
      sizePx: cfg.sizePx,
      cssClass: cfg.cssClass,
      meta: t0.meta,
      onHit: (target)=>onHitTarget(target),
      onExpire: (target)=>onExpireTarget(target),
    });

    // In case engine returns null
    return t;
  }

  function updateFeverUi(){
    // simple fever: grows with combo, shrinks on miss
    const fever = clamp((S.combo * 8) - (S.misses * 6), 0, 100);
    ui.feverProg.textContent = `${fever}%`;
    ui.feverFill.style.width = `${fever}%`;
  }

  function tickAdaptive(){
    if (!S.adaptive) return;

    // gentle adaptation: if accuracy good => faster; if poor => slower
    const acc = pct(S.nHitCorrect, S.nHit);
    if (S.nHit >= 10){
      if (acc >= 78){
        S.spawnEveryMs = clamp(S.spawnEveryMs - 10, 420, 900);
        S.ttlMs = clamp(S.ttlMs - 12, 900, 3200);
      } else if (acc <= 55){
        S.spawnEveryMs = clamp(S.spawnEveryMs + 12, 420, 980);
        S.ttlMs = clamp(S.ttlMs + 16, 900, 3400);
      }
    }
  }

  function startRun(){
    if (S.running) return;
    S.running = true;
    S.phase = 'run';
    S.startTimeIso = nowIso();

    // quest start
    S.quest.start();
    updateQuestUi();

    // announce
    emit('hha:start', {
      gameTag: S.gameTag,
      sessionId: S.sessionId,
      runMode: S.runMode,
      diff: S.diff,
      seed: S.seed,
      durationPlannedSec: S.durationPlannedSec,
      hub,
      endpoint,
      startTimeIso: S.startTimeIso,
    });

    // hide overlays
    ui.startOverlay.style.display = 'none';
    ui.pauseOverlay.style.display = 'none';
    ui.resultOverlay.style.display = 'none';

    setCoach(ui, 'ไป! ยิงอาหารให้สมดุล!', 'happy');

    let lastSpawn = 0;
    let lastTick = performance.now();

    function frame(ts){
      if (!S.running) return;

      const dt = ts - lastTick;
      lastTick = ts;

      // timer
      if (dt > 0){
        // run timer per second, simple
        if (!S._accum) S._accum = 0;
        S._accum += dt;
        if (S._accum >= 1000){
          const step = Math.floor(S._accum / 1000);
          S._accum -= step * 1000;
          setTime(S.tLeft - step);

          // rush ticks
          if (S.rushOn){
            S.rushTicks += step;
            if (S.rushTicks % 5 === 0){
              addScore(8, 'rush-bonus');
            }
          }

          // end
          if (S.tLeft <= 0){
            endRun('time');
            return;
          }
        }
      }

      // spawn loop
      if (ts - lastSpawn >= S.spawnEveryMs){
        lastSpawn = ts;
        spawnOne();
      }

      // update UI bits
      updateFeverUi();
      tickAdaptive();

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function pauseRun(){
    if (!S.running) return;
    S.running = false;
    S.phase = 'pause';
    ui.pauseOverlay.style.display = '';
    setCoach(ui, 'พักก่อน แล้วค่อยลุยต่อ!', 'neutral');
  }

  function resumeRun(){
    if (S.phase !== 'pause') return;
    ui.pauseOverlay.style.display = 'none';
    startRun(); // safe: startRun checks S.running; but we need resume, so manually set
  }

  function restart(){
    // hard refresh with same url params (keeps seed unless caller changes)
    try { location.reload(); } catch {}
  }

  function openHub(){
    // obey hub param; fallback: ../hub.html
    const to = hub || '../hub.html';
    try { location.href = to; } catch {}
  }

  function endRun(reason='end'){
    if (S.phase === 'end') return;
    S.running = false;
    S.phase = 'end';
    S.endTimeIso = nowIso();

    // evaluate miss goal
    const missGoal = S.quest.Q.goals.find(x=>x.id==='no-rush-miss');
    if (missGoal && !missGoal.done){
      const pass = (S.misses <= missGoal.target);
      missGoal.cur = S.misses;
      missGoal.done = pass;
      if (pass) S.quest.Q.goalsCleared++;
    }

    // finalize all-done
    // (If not reached target counts, fill goal might remain not done.)
    if (S.quest.Q.goalsCleared >= S.quest.Q.goalsTotal) S.quest.Q.goalsCleared = S.quest.Q.goalsTotal;
    if (S.quest.Q.miniCleared >= S.quest.Q.miniTotal) S.quest.Q.miniCleared = S.quest.Q.miniTotal;

    updateQuestUi();

    const totalHits = S.nHit;
    const accPct = pct(S.nHitCorrect, totalHits);
    const goalsPct = pct(S.quest.Q.goalsCleared, S.quest.Q.goalsTotal);
    const [grade, hint] = gradeFrom(S.score, accPct, goalsPct);

    // summary for logger / storage
    const plateText = FOOD_GROUPS.map(g=>{
      const need = S.quest.Q.plan.need[g.key] || 0;
      const got = S.plate[g.key] || 0;
      return `${g.label} ${got}/${need}`;
    }).join(' • ');

    const summary = {
      timestampIso: nowIso(),
      projectTag: 'HeroHealth',
      gameMode: S.gameMode,
      gameTag: S.gameTag,
      runMode: S.runMode,
      diff: S.diff,
      durationPlannedSec: S.durationPlannedSec,
      durationPlayedSec: (()=>{
        try{
          const st = new Date(S.startTimeIso).getTime();
          const et = new Date(S.endTimeIso).getTime();
          return clamp(Math.round((et-st)/1000), 0, S.durationPlannedSec);
        }catch{ return 0; }
      })(),
      seed: S.seed,
      sessionId: S.sessionId,
      scoreFinal: S.score,
      comboMax: S.comboMax,
      misses: S.misses,
      goalsCleared: S.quest.Q.goalsCleared,
      goalsTotal: S.quest.Q.goalsTotal,
      miniCleared: S.quest.Q.miniCleared,
      miniTotal: S.quest.Q.miniTotal,
      nTargetSpawned: S.nSpawned,
      nHit: S.nHit,
      nHitCorrect: S.nHitCorrect,
      nHitWrong: S.nHitWrong,
      accuracyPct: accPct,
      grade,
      reason,
      startTimeIso: S.startTimeIso,
      endTimeIso: S.endTimeIso,
      plate: { ...S.plate },
      plateText,
      hub,
      endpoint,
      gameVersion: qs('v','') || 'plate.safe.js',
      device: (()=>{
        const v = (qs('view','')||'').toLowerCase();
        return v || 'auto';
      })()
    };

    // save last summary for HUB “continue/last result”
    try { localStorage.setItem(STORAGE_LAST, JSON.stringify(summary)); } catch {}

    // show result UI
    ui.resMode.textContent = `${S.runMode} • ${S.diff} • ${S.durationPlannedSec}s`;
    ui.resGrade.textContent = grade;
    ui.resHint.textContent = hint;
    ui.resScore.textContent = String(S.score);
    ui.resAcc.textContent = `${accPct}%`;
    ui.resCombo.textContent = String(S.comboMax);
    ui.resGoals.textContent = `${S.quest.Q.goalsCleared}/${S.quest.Q.goalsTotal}`;
    ui.resMini.textContent = `${S.quest.Q.miniCleared}/${S.quest.Q.miniTotal}`;
    ui.resMiss.textContent = String(S.misses);
    ui.resPlate.textContent = plateText;

    ui.resultOverlay.style.display = '';

    if (WIN.Particles && typeof WIN.Particles.celebrate === 'function'){
      try { WIN.Particles.celebrate(); } catch {}
    }
    emit('hha:celebrate', { grade });

    // emit end for cloud logger (flush-hardened module listens this)
    emit('hha:end', summary);

    setCoach(ui, grade === 'S' || grade === 'A' ? 'สุดยอด! สรุปผลพร้อมแล้ว' : 'ดีมาก! ลองใหม่เพื่อให้สมดุลขึ้นนะ', 'happy');
  }

  /* ---------------- Input: tap-to-shoot from vr-ui.js ---------------- */
  function bindShoot(){
    // Two hit modes:
    // 1) vr-ui crosshair emits hha:shoot {x,y,lockPx,source}
    // 2) fallback: click/tap on target elements directly (engine handles)
    WIN.addEventListener('hha:shoot', (ev)=>{
      if (S.phase !== 'run' || !S.running) return;
      const d = ev?.detail || {};
      const x = Number(d.x)||0, y = Number(d.y)||0;
      const lockPx = Number(d.lockPx)||28;
      try {
        // engine helper: hitTest(x,y,lockPx) if available
        if (engine && typeof engine.hitTest === 'function'){
          engine.hitTest(x, y, lockPx);
        }
      } catch {}
    }, { passive:true });
  }

  /* ---------------- Buttons ---------------- */
  function bindUi(){
    ui.btnStart.addEventListener('click', ()=>{
      // reset in case reopened
      resetHud();
      // start run
      startRun();
    });

    ui.btnPeek.addEventListener('click', ()=>{
      // quick mission peek toggle via mini hint panel
      const Q = S.quest.Q;
      const g = Q.activeGoal ? `${Q.activeGoal.text} (${Q.activeGoal.cur}/${Q.activeGoal.target})` : '';
      const m = Q.activeMini ? `${Q.activeMini.text} (${Q.activeMini.cur}/${Q.activeMini.target})` : '';
      ui.miniHintText.textContent = `GOAL: ${g} • MINI: ${m}`;
      ui.miniHint.style.display = (ui.miniHint.style.display === 'none' || !ui.miniHint.style.display) ? '' : 'none';
    });

    ui.btnRestart.addEventListener('click', restart);
    ui.btnBack.addEventListener('click', openHub);

    ui.btnResume.addEventListener('click', ()=>{
      ui.pauseOverlay.style.display = 'none';
      // resume loop
      if (S.phase === 'pause'){
        S.phase = 'run';
        S.running = true;
        // continue frame loop
        requestAnimationFrame(()=>{ /* kick */ });
      }
    });
    ui.btnPauseRestart.addEventListener('click', restart);
    ui.btnPauseBack.addEventListener('click', openHub);

    ui.btnResultRestart.addEventListener('click', restart);
    ui.btnResultBack.addEventListener('click', openHub);

    // ESC toggles pause (pc)
    WIN.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape'){
        if (S.phase === 'run' && S.running){
          pauseRun();
        } else if (S.phase === 'pause'){
          ui.pauseOverlay.style.display = 'none';
          S.phase = 'run';
          S.running = true;
          requestAnimationFrame(()=>{});
        }
      }
    });
  }

  // Boot sequence
  resetHud();
  bindShoot();
  bindUi();

  // Start overlay shown by default
  ui.startOverlay.style.display = '';

  // initial quest UI
  S.quest.start();
  updateQuestUi();

  // coach greet
  setCoach(ui, 'กด Start แล้วเริ่มจัดจานให้สมดุลได้เลย!', 'neutral');
}

// Auto-boot if loaded directly
try{
  if (DOC && DOC.readyState !== 'loading') boot();
  else DOC.addEventListener('DOMContentLoaded', boot, { once:true });
}catch{}