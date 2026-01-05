// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — PRODUCTION (LATEST, HUD-safe spawn + storm/boss/rage + HHA events)
// ✅ HUD-safe spawn uses CSS vars: --gj-top-safe / --gj-bottom-safe (set by run HTML)
// ✅ Miss definition: miss = good expired + junk hit
//    - If junk hit while Shield active => BLOCK (NOT miss)
// ✅ Storm: time <= 30s
// ✅ Boss: miss >= 4
// ✅ Rage: miss >= 5
// ✅ Works with: goodjunk-vr.html (A) + goodjunk-vr.css (A) + vr-ui.js (hha:shoot) + hha-cloud-logger.js
// Emits: hha:start, hha:time, hha:score, quest:update, hha:coach, hha:judge, hha:end, hha:flush (listen)

'use strict';

// ------------------------- tiny utils -------------------------
const DOC = document;
const WIN = window;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a : v>b?b : v; }
function nowMs(){ return performance?.now?.() ?? Date.now(); }
function qsNum(v, def){ const n = Number(v); return Number.isFinite(n)?n:def; }
function byId(id){ return DOC.getElementById(id); }

function tryEvent(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  try{ DOC.body?.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function readCssPxVar(name, fallbackPx){
  try{
    const s = getComputedStyle(DOC.documentElement).getPropertyValue(name);
    const n = parseFloat(String(s||'').trim());
    return Number.isFinite(n) ? n : fallbackPx;
  }catch(_){
    return fallbackPx;
  }
}

// ---- deterministic RNG (research) ----
function hashSeedToU32(seed){
  // accept number/string; produce uint32
  const s = String(seed ?? '');
  let h = 2166136261 >>> 0; // FNV-1a
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function makeRng(seed){
  let x = (hashSeedToU32(seed) || 123456789) >>> 0;
  return function rng(){
    // xorshift32
    x ^= (x << 13) >>> 0;
    x ^= (x >>> 17) >>> 0;
    x ^= (x << 5) >>> 0;
    return (x >>> 0) / 4294967296;
  };
}
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)] ?? arr[0]; }

// ------------------------- main export -------------------------
export function boot(opts = {}){
  const view = String(opts.view || 'mobile').toLowerCase();
  const diff = String(opts.diff || 'normal').toLowerCase();
  const runMode = String(opts.run || 'play').toLowerCase(); // play|research
  const durationPlannedSec = clamp(qsNum(opts.time, 80), 20, 300);
  const hub = (opts.hub ? String(opts.hub) : null);
  const studyId = opts.studyId ?? null;
  const phase = opts.phase ?? null;
  const conditionGroup = opts.conditionGroup ?? null;

  const isResearch = (runMode === 'research');
  const seed = (opts.seed ?? (isResearch ? 'RESEARCH' : null)) || null;
  const rng = isResearch ? makeRng(seed) : Math.random;

  // ------------------------- DOM refs -------------------------
  const elScore = byId('hud-score');
  const elTime  = byId('hud-time');
  const elMiss  = byId('hud-miss');
  const elGrade = byId('hud-grade');

  const elGoalTitle = byId('hud-goal');
  const elGoalDesc  = byId('goalDesc');
  const elGoalCur   = byId('hud-goal-cur');
  const elGoalTar   = byId('hud-goal-target');

  const elMiniDesc  = byId('hud-mini');
  const elMiniTimer = byId('miniTimer');

  const elFeverFill = byId('feverFill');
  const elFeverText = byId('feverText');

  const elShieldPills = byId('shieldPills');

  const layerL = byId('gj-layer');
  const layerR = byId('gj-layer-r');

  if(!layerL){
    console.warn('[GoodJunk] missing #gj-layer');
    return;
  }

  // ------------------------- state -------------------------
  const S = {
    startedAt: nowMs(),
    ended: false,

    score: 0,
    scoreFinal: 0,

    timeLeft: durationPlannedSec,
    playedSec: 0,

    // miss = good expired + junk hit (NOT include miss-shot)
    misses: 0,

    // counters
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    // RT (simple)
    rtGood: [],

    // power systems
    fever: 0,          // 0..100
    shield: 0,         // integer charges
    combo: 0,
    comboMax: 0,

    // phases
    storm: false,      // time<=30
    boss: false,       // miss>=4
    rage: false,       // miss>=5

    // spawn pacing
    spawnTimer: null,
    tickTimer: null,

    // quest
    goalIdx: 0,
    goalsCleared: 0,
    goalsTotal: 0,

    miniIdx: 0,
    miniCleared: 0,
    miniTotal: 0,
    miniEndsAt: 0,
    miniActive: null,
    allDone: false,

    // for multi-view shoot
    lastShootAt: 0,
  };

  // ------------------------- tuning -------------------------
  const DIFF = {
    easy:   { lifeGood:[2.2, 3.0], lifeJunk:[2.4, 3.2], baseSpawn:520, junkRate:0.26, specialRate:0.08, missLimit:7 },
    normal: { lifeGood:[1.9, 2.7], lifeJunk:[2.0, 2.9], baseSpawn:470, junkRate:0.30, specialRate:0.10, missLimit:6 },
    hard:   { lifeGood:[1.6, 2.3], lifeJunk:[1.7, 2.5], baseSpawn:410, junkRate:0.34, specialRate:0.12, missLimit:5 },
  }[diff] || {
    lifeGood:[1.9, 2.7], lifeJunk:[2.0, 2.9], baseSpawn:470, junkRate:0.30, specialRate:0.10, missLimit:6
  };

  // Research: make it a bit steadier (no adaptive chaos)
  const RESEARCH = {
    baseSpawn: Math.max(440, DIFF.baseSpawn),
  };

  // ------------------------- HUD-safe play rect -------------------------
  function getPlayRect(){
    // full viewport minus HUD safe zones
    const w = WIN.innerWidth || DOC.documentElement.clientWidth || 360;
    const h = WIN.innerHeight || DOC.documentElement.clientHeight || 640;

    const topSafe = readCssPxVar('--gj-top-safe', 140);
    const botSafe = readCssPxVar('--gj-bottom-safe', 120);

    // side padding (safe area already in CSS; still add a small margin)
    const side = 14;

    const left = side;
    const right = w - side;
    const top = topSafe;
    const bottom = h - botSafe;

    // if too small -> relax a bit (prevents "spawn at one place")
    const minH = 220;
    const minW = 240;
    let t = top, b = bottom, l = left, r = right;
    if((b - t) < minH){
      const extra = (minH - (b - t));
      t = Math.max(0, t - extra*0.55);
      b = Math.min(h, b + extra*0.45);
    }
    if((r - l) < minW){
      const extra = (minW - (r - l));
      l = Math.max(0, l - extra*0.5);
      r = Math.min(w, r + extra*0.5);
    }

    return { w, h, left:l, right:r, top:t, bottom:b };
  }

  function randRange(a,b){ return a + (b-a)*rng(); }

  function spawnPointForLayer(layerKey){
    const R = getPlayRect();

    // cVR: each half is its own play rect
    if(view === 'cvr'){
      const halfW = R.w * 0.5;
      const isRight = (layerKey === 'R');
      const baseL = isRight ? halfW : 0;
      const left = baseL + 14;
      const right = baseL + halfW - 14;
      const x = clamp(randRange(left, right), left, right);
      const y = clamp(randRange(R.top + 10, R.bottom - 10), R.top + 10, R.bottom - 10);
      return { x, y };
    }

    // pc/mobile/vr: full rect
    const x = clamp(randRange(R.left, R.right), R.left, R.right);
    const y = clamp(randRange(R.top + 10, R.bottom - 10), R.top + 10, R.bottom - 10);
    return { x, y };
  }

  // ------------------------- quest definitions -------------------------
  // Goals: focus on “ของดี” for Grade 5 clarity
  const GOALS = (function(){
    // total good hits target scales by time and diff
    const base = Math.round(durationPlannedSec * (diff === 'easy' ? 0.20 : diff === 'hard' ? 0.28 : 0.24));
    const g1 = clamp(base, 10, 32);
    const g2 = clamp(Math.round(g1 * 1.25), 12, 44);
    const g3 = clamp(Math.round(g1 * 1.55), 14, 56);

    return [
      { id:'good1', title:'GOAL: ยิงของดีให้ครบ', desc:'เก็บของดีให้ครบ แล้วไป GOAL ต่อ', target:g1, cur:0, done:false },
      { id:'good2', title:'GOAL: ยิงของดี (ต่อเนื่อง)', desc:'พยายามยิงให้แม่น หลีกเลี่ยงขยะ', target:g2, cur:0, done:false },
      { id:'good3', title:'GOAL: ยิงของดี (โหดขึ้น)', desc:'ใกล้จบแล้ว! ระวังขยะช่วงท้าย', target:g3, cur:0, done:false },
    ];
  })();

  const MINIS = (function(){
    // minis must be quick + explainable for grade 5
    return [
      { id:'fast2',  text:'ยิงให้ไว 2 ครั้ง', need:2, kind:'fast', sec:8 },
      { id:'streak3',text:'ยิงของดีติดกัน 3 ครั้ง', need:3, kind:'streakGood', sec:10 },
      { id:'nojunk', text:'ห้ามโดนขยะ (รอดให้ได้)', need:1, kind:'noJunk', sec:9 },
      { id:'fast3',  text:'ยิงให้ไว 3 ครั้ง', need:3, kind:'fast', sec:10 },
      { id:'streak4',text:'ยิงของดีติดกัน 4 ครั้ง', need:4, kind:'streakGood', sec:12 },
    ];
  })();

  S.goalsTotal = GOALS.length;
  S.miniTotal = MINIS.length;

  // ------------------------- quest helpers -------------------------
  function activeGoal(){ return GOALS[S.goalIdx] || null; }

  function pushQuestUpdate(reason){
    const g = activeGoal();
    const m = S.miniActive;
    tryEvent('quest:update', {
      game:'goodjunk',
      reason,
      goalIdx:S.goalIdx,
      goalTitle: g?.title || '—',
      goalDesc: g?.desc || '—',
      goalCur: g?.cur || 0,
      goalTarget: g?.target || 0,
      miniText: m?.text || '—',
      miniNeed: m?.need || 0,
      miniCur: m?.cur || 0,
      miniEndsAt: S.miniEndsAt || 0,
      goalsCleared:S.goalsCleared,
      goalsTotal:S.goalsTotal,
      miniCleared:S.miniCleared,
      miniTotal:S.miniTotal,
    });
  }

  function renderQuest(){
    const g = activeGoal();
    if(elGoalTitle) elGoalTitle.textContent = g?.title || '—';
    if(elGoalDesc)  elGoalDesc.textContent  = g?.desc  || '—';
    if(elGoalCur)   elGoalCur.textContent   = String(g?.cur ?? 0);
    if(elGoalTar)   elGoalTar.textContent   = String(g?.target ?? 0);

    if(elMiniDesc)  elMiniDesc.textContent  = S.miniActive?.text || '—';
    // miniTimer updated in tick
  }

  function startMini(){
    const m = MINIS[S.miniIdx % MINIS.length];
    S.miniIdx++;
    S.miniActive = { ...m, cur:0, done:false, failed:false };
    S.miniEndsAt = nowMs() + (m.sec * 1000);
    pushQuestUpdate('mini-start');
    tryEvent('hha:coach', { kind:'mini', msg:`MINI: ${m.text}`, rate:'hi' });
    renderQuest();
  }

  function clearMini(){
    if(!S.miniActive || S.miniActive.done) return;
    S.miniActive.done = true;
    S.miniCleared++;
    tryEvent('hha:judge', { kind:'mini-clear', msg:'MINI ผ่าน!' });
    // small celebration
    DOC.body?.classList.add('gj-mini-clear');
    setTimeout(()=>DOC.body?.classList.remove('gj-mini-clear'), 220);
    pushQuestUpdate('mini-clear');
    // start next mini immediately (grade 5: quick feedback)
    setTimeout(()=>startMini(), 380);
  }

  function failMini(reason){
    if(!S.miniActive || S.miniActive.done) return;
    S.miniActive.failed = true;
    S.miniActive.done = true;
    tryEvent('hha:judge', { kind:'mini-fail', msg:`MINI ไม่ผ่าน (${reason})` });
    pushQuestUpdate('mini-fail');
    // rotate quickly
    setTimeout(()=>startMini(), 380);
  }

  function bumpGoalGood(){
    const g = activeGoal();
    if(!g || g.done) return;
    g.cur = clamp(g.cur + 1, 0, g.target);
    if(g.cur >= g.target){
      g.done = true;
      S.goalsCleared++;
      tryEvent('hha:judge', { kind:'goal-clear', msg:'GOAL ผ่าน!' });
      pushQuestUpdate('goal-clear');

      // next goal or finish
      if(S.goalIdx < GOALS.length - 1){
        S.goalIdx++;
        renderQuest();
        pushQuestUpdate('goal-next');
        tryEvent('hha:coach', { kind:'goal', msg:'ไป GOAL ต่อ!' });
      }else{
        // all goals done => finish early (success)
        S.allDone = true;
        endGame('goalsAll');
      }
    }else{
      pushQuestUpdate('goal-progress');
    }
    renderQuest();
  }

  // ------------------------- HUD render -------------------------
  function setText(el, v){ if(el) el.textContent = String(v); }

  function updateFeverUI(){
    const f = clamp(S.fever, 0, 100);
    if(elFeverFill) elFeverFill.style.width = f.toFixed(0) + '%';
    if(elFeverText) elFeverText.textContent = f.toFixed(0) + '%';
  }
  function updateShieldUI(){
    if(!elShieldPills) return;
    if(S.shield <= 0) { elShieldPills.textContent = '—'; return; }
    const n = clamp(S.shield, 0, 6);
    elShieldPills.textContent = '🛡️'.repeat(n);
  }

  function computeGrade(){
    const good = S.nHitGood;
    const junk = S.nHitJunk;
    const exp  = S.nExpireGood;
    const denom = Math.max(1, good + junk + exp);
    const accuracy = good / denom; // crude but stable

    // penalize misses strongly (kid-friendly)
    const missPenalty = clamp(S.misses * 0.04, 0, 0.40);
    const score = clamp(accuracy - missPenalty, 0, 1);

    if(score >= 0.90) return 'S';
    if(score >= 0.80) return 'A';
    if(score >= 0.70) return 'B';
    if(score >= 0.60) return 'C';
    return 'D';
  }

  function renderHud(){
    setText(elScore, S.score);
    setText(elTime, Math.ceil(S.timeLeft));
    setText(elMiss, S.misses);
    setText(elGrade, computeGrade());

    // mini timer
    if(elMiniTimer){
      if(S.miniActive){
        const remain = Math.max(0, Math.ceil((S.miniEndsAt - nowMs())/1000));
        elMiniTimer.textContent = remain + 's';
      }else{
        elMiniTimer.textContent = '—';
      }
    }

    updateFeverUI();
    updateShieldUI();
  }

  // ------------------------- storm/boss/rage gates -------------------------
  function updatePhaseFlags(){
    // storm: time <= 30 sec
    const storm = (S.timeLeft <= 30);
    if(storm && !S.storm){
      S.storm = true;
      tryEvent('hha:coach', { kind:'storm', msg:'⛈️ STORM! ช่วงท้ายโหดขึ้น!' });
      DOC.body?.classList.add('gj-lowtime');
    }
    if(!storm && S.storm){
      S.storm = false;
      DOC.body?.classList.remove('gj-lowtime');
    }

    // boss / rage by misses
    const boss = (S.misses >= 4);
    const rage = (S.misses >= 5);

    if(boss && !S.boss){
      S.boss = true;
      tryEvent('hha:coach', { kind:'boss', msg:'👹 BOSS มาแล้ว! ระวังขยะ!' });
      DOC.body?.classList.add('gj-boss');
    }
    if(!boss && S.boss){
      S.boss = false;
      DOC.body?.classList.remove('gj-boss');
    }

    if(rage && !S.rage){
      S.rage = true;
      tryEvent('hha:coach', { kind:'rage', msg:'🔥 RAGE! โหดสุด!' });
      DOC.body?.classList.add('gj-rage');
    }
    if(!rage && S.rage){
      S.rage = false;
      DOC.body?.classList.remove('gj-rage');
    }

    // lowtime5 cue for big number + tick pulse (CSS expects gj-lowtime5 + gj-tick)
    if(S.timeLeft <= 5){
      DOC.body?.classList.add('gj-lowtime5');
    }else{
      DOC.body?.classList.remove('gj-lowtime5');
    }
  }

  // ------------------------- target creation -------------------------
  // simple emoji set (replace later with your PNG if needed)
  const GOOD = ['🍎','🍌','🥦','🥕','🍇'];
  const JUNK = ['🍩','🍟','🍔','🍬','🧁'];
  const STAR = '⭐';
  const DIAMOND = '💎';
  const SHIELD = '🛡️';

  function makeTarget(kind, layerKey){
    const el = DOC.createElement('div');
    el.className = 'gj-target spawn';
    el.setAttribute('role','button');
    el.setAttribute('tabindex','0');

    const size = (kind === 'shield' || kind === 'diamond') ? randRange(54, 68)
               : (kind === 'star') ? randRange(48, 62)
               : randRange(62, 86);

    const pt = spawnPointForLayer(layerKey);
    el.style.left = pt.x + 'px';
    el.style.top  = pt.y + 'px';
    el.style.fontSize = Math.round(size) + 'px';

    // lifetime
    let lifeSec;
    if(kind === 'good') lifeSec = randRange(DIFF.lifeGood[0], DIFF.lifeGood[1]);
    else if(kind === 'junk') lifeSec = randRange(DIFF.lifeJunk[0], DIFF.lifeJunk[1]);
    else lifeSec = randRange(2.0, 3.2);

    // phases make it tighter
    if(S.storm) lifeSec *= 0.92;
    if(S.boss)  lifeSec *= 0.90;
    if(S.rage)  lifeSec *= 0.86;

    const created = nowMs();
    el.dataset.kind = kind;
    el.dataset.layer = layerKey;
    el.dataset.created = String(created);
    el.dataset.expires = String(created + lifeSec*1000);

    // visual content
    if(kind === 'good') el.textContent = pick(rng, GOOD);
    if(kind === 'junk') el.textContent = pick(rng, JUNK);
    if(kind === 'star') el.textContent = STAR;
    if(kind === 'diamond') el.textContent = DIAMOND;
    if(kind === 'shield') el.textContent = SHIELD;

    // attach
    const host = (layerKey === 'R') ? (layerR || layerL) : layerL;
    host.appendChild(el);

    // counters
    if(kind === 'good') S.nTargetGoodSpawned++;
    if(kind === 'junk') S.nTargetJunkSpawned++;
    if(kind === 'star') S.nTargetStarSpawned++;
    if(kind === 'diamond') S.nTargetDiamondSpawned++;
    if(kind === 'shield') S.nTargetShieldSpawned++;

    // click / key
    el.addEventListener('click', (e)=>{
      e.preventDefault();
      hitTarget(el, { source:'tap', x:pt.x, y:pt.y });
    });
    el.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        hitTarget(el, { source:'key', x:pt.x, y:pt.y });
      }
    });

    // expire timer check will be handled by sweep
    return el;
  }

  function removeTarget(el){
    try{
      el.classList.add('gone');
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 140);
    }catch(_){}
  }

  // ------------------------- scoring / effects -------------------------
  function addScore(n){
    S.score = Math.max(0, (S.score + (Number(n)||0)));
    tryEvent('hha:score', { score:S.score });
  }

  function applyGoodHit(rt){
    S.nHitGood++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);

    // fever builds with combo but capped
    S.fever = clamp(S.fever + 1.2 + Math.min(3, S.combo*0.10), 0, 100);

    if(Number.isFinite(rt)) S.rtGood.push(rt);

    addScore(10 + Math.min(12, Math.floor(S.combo*0.35)));

    // quest progress
    bumpGoalGood();

    // mini logic
    const m = S.miniActive;
    if(m && !m.done){
      if(m.kind === 'fast'){
        if(rt <= 700) m.cur++;
        else m.cur = Math.max(0, m.cur - 0.5); // gentle
      }else if(m.kind === 'streakGood'){
        m.cur++;
      }
      if(m.cur >= m.need) clearMini();
      pushQuestUpdate('mini-progress');
    }
  }

  function applyJunkHit(blocked){
    if(blocked){
      S.nHitJunkGuard++;
      // fever drop slightly (reward)
      S.fever = clamp(S.fever - 4, 0, 100);
      S.combo = 0;
      tryEvent('hha:judge', { kind:'block', msg:'🛡️ BLOCK!' });
      return;
    }

    S.nHitJunk++;
    S.combo = 0;

    // miss rule: junk hit counts miss
    S.misses++;
    addScore(-8);

    // fever spike
    S.fever = clamp(S.fever + 9, 0, 100);

    // FX class hook
    DOC.body?.classList.add('gj-junk-hit');
    setTimeout(()=>DOC.body?.classList.remove('gj-junk-hit'), 220);

    // mini logic: noJunk fails
    const m = S.miniActive;
    if(m && !m.done && m.kind === 'noJunk'){
      failMini('hit-junk');
    }

    updatePhaseFlags();

    // fail if exceed missLimit
    if(S.misses >= DIFF.missLimit){
      endGame('missLimit');
    }
  }

  function applySpecialHit(kind){
    if(kind === 'star'){
      addScore(35);
      S.fever = clamp(S.fever + 6, 0, 100);
      tryEvent('hha:judge', { kind:'bonus', msg:'⭐ BONUS!' });
    }
    if(kind === 'diamond'){
      addScore(55);
      S.fever = clamp(S.fever + 10, 0, 100);
      tryEvent('hha:judge', { kind:'bonus', msg:'💎 SUPER!' });
    }
    if(kind === 'shield'){
      // grant 2 charges (kid-friendly)
      const add = (rng() < 0.25) ? 3 : 2;
      S.shield = clamp(S.shield + add, 0, 6);
      tryEvent('hha:judge', { kind:'shield', msg:`🛡️ +${add}` });
    }
  }

  function hitTarget(el, meta = {}){
    if(S.ended) return;
    if(!el || !el.dataset) return;

    const kind = el.dataset.kind || 'good';
    const created = Number(el.dataset.created||0);
    const rt = created ? (nowMs() - created) : NaN;

    // remove first
    removeTarget(el);

    if(kind === 'good'){
      applyGoodHit(rt);
    }else if(kind === 'junk'){
      if(S.shield > 0){
        S.shield = Math.max(0, S.shield - 1);
        applyJunkHit(true);
      }else{
        applyJunkHit(false);
      }
    }else{
      // specials count as "good-ish" but not goal progress
      applySpecialHit(kind);
      // still counts combo a bit
      S.combo = Math.min(50, S.combo + 1);
      S.comboMax = Math.max(S.comboMax, S.combo);
    }

    renderHud();
  }

  // ------------------------- crosshair shooting (vr-ui.js) -------------------------
  function elementAt(x,y){
    try{ return DOC.elementFromPoint(x,y); }catch(_){ return null; }
  }

  function shootAt(x,y, source='shoot'){
    if(S.ended) return false;
    const el = elementAt(x,y);
    if(!el) return false;

    // allow hitting emoji inside element
    const t = el.closest?.('.gj-target') || null;
    if(t){
      hitTarget(t, { source, x, y });
      return true;
    }

    // miss-shot: visual only (NOT counted as miss per your definition)
    DOC.body?.classList.add('gj-miss-shot');
    setTimeout(()=>DOC.body?.classList.remove('gj-miss-shot'), 120);
    // tiny fever tick to keep tension
    S.fever = clamp(S.fever + 0.8, 0, 100);
    S.combo = 0;
    renderHud();
    return false;
  }

  function onShoot(ev){
    // throttle a little
    const t = nowMs();
    if(t - S.lastShootAt < 40) return;
    S.lastShootAt = t;

    const w = WIN.innerWidth || 360;
    const h = WIN.innerHeight || 640;

    if(view === 'cvr'){
      // shoot both eyes center points
      const hitL = shootAt(w*0.25, h*0.52, 'cvr');
      const hitR = shootAt(w*0.75, h*0.52, 'cvr');
      return (hitL || hitR);
    }

    // normal center
    return shootAt(w*0.5, h*0.52, view === 'vr' ? 'vr' : 'shoot');
  }

  WIN.addEventListener('hha:shoot', onShoot);

  // ------------------------- spawning logic -------------------------
  function decideKind(){
    // specials appear occasionally; more during storm for excitement (but research stays stable)
    const specialRate = isResearch ? (DIFF.specialRate * 0.90) : DIFF.specialRate;
    const stormBoost = (!isResearch && S.storm) ? 1.30 : 1.0;
    const bossBoost  = (!isResearch && S.boss)  ? 1.10 : 1.0;
    const rageBoost  = (!isResearch && S.rage)  ? 1.15 : 1.0;

    const sr = clamp(specialRate * stormBoost * bossBoost * rageBoost, 0.04, 0.22);
    const r = rng();

    if(r < sr){
      const u = rng();
      if(u < 0.36) return 'star';
      if(u < 0.64) return 'diamond';
      return 'shield';
    }

    // junk rate grows with boss/rage; in research keep fixed
    let jr = DIFF.junkRate;
    if(!isResearch){
      if(S.storm) jr += 0.05;
      if(S.boss)  jr += 0.06;
      if(S.rage)  jr += 0.06;
    }
    jr = clamp(jr, 0.18, 0.52);

    return (rng() < jr) ? 'junk' : 'good';
  }

  function spawnOnce(){
    if(S.ended) return;

    const kind = decideKind();

    // pick layer
    let layerKey = 'L';
    if(view === 'cvr'){
      layerKey = (rng() < 0.5) ? 'L' : 'R';
    }

    makeTarget(kind, layerKey);

    // extra spawn pulses in storm/boss/rage (NOT in research)
    if(!isResearch){
      if(S.rage && rng() < 0.35) makeTarget(decideKind(), layerKey);
      if(S.boss && rng() < 0.20) makeTarget(decideKind(), layerKey);
      if(S.storm && rng() < 0.16) makeTarget(decideKind(), layerKey);
    }
  }

  function spawnIntervalMs(){
    let base = DIFF.baseSpawn;
    if(isResearch) base = RESEARCH.baseSpawn;

    // phases accelerate (play only)
    if(!isResearch){
      if(S.storm) base *= 0.86;
      if(S.boss)  base *= 0.90;
      if(S.rage)  base *= 0.86;
      // mild speed-up as fever rises
      base *= (1 - clamp(S.fever,0,100) * 0.0012);
    }

    // clamp for safety
    return clamp(Math.round(base), 240, 900);
  }

  function scheduleSpawn(){
    if(S.ended) return;
    clearTimeout(S.spawnTimer);
    S.spawnTimer = setTimeout(()=>{
      spawnOnce();
      scheduleSpawn();
    }, spawnIntervalMs());
  }

  // ------------------------- sweep expires -------------------------
  function sweepExpires(){
    if(S.ended) return;

    const t = nowMs();
    // check both layers
    const all = [];
    try{
      all.push(...layerL.querySelectorAll('.gj-target'));
      if(layerR) all.push(...layerR.querySelectorAll('.gj-target'));
    }catch(_){}

    for(const el of all){
      const exp = Number(el.dataset.expires||0);
      if(exp && t >= exp){
        const kind = el.dataset.kind || '';
        removeTarget(el);

        if(kind === 'good'){
          // good expired counts miss per your rule
          S.nExpireGood++;
          S.misses++;
          S.combo = 0;

          DOC.body?.classList.add('gj-good-expire');
          setTimeout(()=>DOC.body?.classList.remove('gj-good-expire'), 160);

          // fever up (pressure)
          S.fever = clamp(S.fever + 6, 0, 100);

          updatePhaseFlags();
          if(S.misses >= DIFF.missLimit){
            endGame('missLimit');
            return;
          }
        }
      }
    }
  }

  // ------------------------- tick / time -------------------------
  let lastTick = nowMs();
  function tick(){
    if(S.ended) return;

    const t = nowMs();
    const dt = Math.min(0.25, Math.max(0, (t - lastTick) / 1000));
    lastTick = t;

    // time
    S.playedSec += dt;
    S.timeLeft = Math.max(0, durationPlannedSec - S.playedSec);

    // fever decay (small)
    S.fever = clamp(S.fever - dt * (isResearch ? 0.55 : 0.45), 0, 100);

    // mini timer
    if(S.miniActive && !S.miniActive.done){
      if(t >= S.miniEndsAt){
        // if requirement met? otherwise fail
        if(S.miniActive.cur >= S.miniActive.need) clearMini();
        else failMini('timeout');
      }
    }

    // for streak mini: reset on non-good hits is handled in applyJunkHit / miss-shot
    // for noJunk: fail only when junk-hit

    // phase flags + lowtime tick pulse
    updatePhaseFlags();
    if(S.timeLeft <= 5){
      DOC.body?.classList.add('gj-tick');
      setTimeout(()=>DOC.body?.classList.remove('gj-tick'), 90);
    }

    // sweep expirations
    sweepExpires();

    // publish time event
    tryEvent('hha:time', {
      timeLeftSec: Math.ceil(S.timeLeft),
      timePlannedSec: durationPlannedSec,
    });

    // UI
    renderHud();

    // end by time
    if(S.timeLeft <= 0){
      endGame('timeUp');
      return;
    }

    // next tick
    S.tickTimer = requestAnimationFrame(tick);
  }

  // ------------------------- end / flush -------------------------
  function endGame(reason='timeUp'){
    if(S.ended) return;
    S.ended = true;

    // stop
    clearTimeout(S.spawnTimer);
    try{ cancelAnimationFrame(S.tickTimer); }catch(_){}
    WIN.removeEventListener('hha:shoot', onShoot);

    // compute final
    const grade = computeGrade();
    S.scoreFinal = S.score;

    const good = S.nHitGood;
    const junkErr = S.nHitJunk;
    const expGood = S.nExpireGood;
    const denom = Math.max(1, good + junkErr + expGood);
    const accuracyGoodPct = (good / denom) * 100;
    const junkErrorPct = (junkErr / denom) * 100;

    const avgRtGoodMs = S.rtGood.length ? (S.rtGood.reduce((a,b)=>a+b,0) / S.rtGood.length) : 0;
    const sorted = S.rtGood.slice().sort((a,b)=>a-b);
    const medianRtGoodMs = sorted.length ? sorted[Math.floor(sorted.length/2)] : 0;

    // emit end
    const payload = {
      game:'goodjunk',
      device:view,
      diff,
      runMode,
      reason,

      durationPlannedSec,
      durationPlayedSec: Math.round(S.playedSec),

      scoreFinal: S.scoreFinal,
      comboMax: S.comboMax,
      misses: S.misses,

      goalsCleared: S.goalsCleared,
      goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared,
      miniTotal: S.miniTotal,

      nTargetGoodSpawned: S.nTargetGoodSpawned,
      nTargetJunkSpawned: S.nTargetJunkSpawned,
      nTargetStarSpawned: S.nTargetStarSpawned,
      nTargetDiamondSpawned: S.nTargetDiamondSpawned,
      nTargetShieldSpawned: S.nTargetShieldSpawned,

      nHitGood: S.nHitGood,
      nHitJunk: S.nHitJunk,
      nHitJunkGuard: S.nHitJunkGuard,
      nExpireGood: S.nExpireGood,

      accuracyGoodPct: Number(accuracyGoodPct.toFixed(2)),
      junkErrorPct: Number(junkErrorPct.toFixed(2)),
      avgRtGoodMs: Math.round(avgRtGoodMs),
      medianRtGoodMs: Math.round(medianRtGoodMs),

      grade,

      // research meta
      seed: seed ?? null,
      studyId: studyId ?? null,
      phase: phase ?? null,
      conditionGroup: conditionGroup ?? null,
    };

    tryEvent('hha:end', payload);

    // small coach
    tryEvent('hha:coach', { kind:'end', msg:`จบเกม! เกรด ${grade}` });

    renderHud();
  }

  // respond to flush (logger wants best-effort)
  function onFlush(){
    // if not ended yet, just emit a heartbeat snapshot
    tryEvent('hha:score', { score:S.score, misses:S.misses, combo:S.combo, fever:S.fever, shield:S.shield });
  }
  WIN.addEventListener('hha:flush', onFlush);

  // ------------------------- init -------------------------
  function init(){
    // view classes are set by boot.js/run html; ensure base class
    DOC.body?.classList.add('gj');

    // cVR: enable R layer
    if(layerR){
      if(view === 'cvr') layerR.setAttribute('aria-hidden','false');
      else layerR.setAttribute('aria-hidden','true');
    }

    // quest init
    renderQuest();
    startMini();
    pushQuestUpdate('init');

    // kickoff HUD
    renderHud();

    // start events for logger
    tryEvent('hha:start', {
      game:'goodjunk',
      device:view,
      diff,
      runMode,
      durationPlannedSec,
      seed: seed ?? null,
      hub: hub ?? null,
      studyId: studyId ?? null,
      phase: phase ?? null,
      conditionGroup: conditionGroup ?? null,
    });

    // begin spawn + tick
    scheduleSpawn();
    S.tickTimer = requestAnimationFrame(tick);

    // gentle tip
    if(view === 'vr' || view === 'cvr'){
      tryEvent('hha:coach', { kind:'tip', msg:'VR: เล็งกลางจอแล้วแตะ/คลิกเพื่อยิง (crosshair)' });
    }else{
      tryEvent('hha:coach', { kind:'tip', msg:'แตะ/คลิกที่เป้าเพื่อยิง' });
    }
  }

  // cleanup on unload (avoid leaks)
  function cleanup(){
    clearTimeout(S.spawnTimer);
    try{ cancelAnimationFrame(S.tickTimer); }catch(_){}
    WIN.removeEventListener('hha:shoot', onShoot);
    WIN.removeEventListener('hha:flush', onFlush);
  }
  WIN.addEventListener('pagehide', cleanup, { passive:true });

  init();
}
