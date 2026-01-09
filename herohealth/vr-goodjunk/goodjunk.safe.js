// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + FX + Phases + Boss++)
// ✅ Mobile / PC / VR(Cardboard) / cVR
// ✅ HUD-safe spawn via CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as miss
// ✅ Phases:
//    - timeLeft <= 30s => STORM (body.gj-storm)
//    - miss >= 4 => BOSS (body.gj-boss) + Boss fight HP: easy=10 normal=12 hard=14, Phase2 lasts 6s
//    - miss >= 5 => RAGE (body.gj-rage) (harder spawn + more junk pressure)
// ✅ Mini "เก็บให้ไว" -> instant pass (fast_hits) with view-based threshold
// ✅ Emits: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate
// ✅ End summary (fills existing #endOverlay if present) + back-to-HUB + save last summary (HHA_LAST_SUMMARY)
// ✅ Logger: hha:start / hha:end compatible with hha-cloud-logger.js

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ----------------------- helpers -----------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);
  const BODY = DOC.body;

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
    try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function log(detail){
    try{ emit('hha:log', detail); }catch(_){}
  }

  function pulseBodyClass(cls, ms=180){
    try{
      BODY.classList.add(cls);
      setTimeout(()=>{ try{ BODY.classList.remove(cls); }catch(_){} }, ms);
    }catch(_){}
  }

  // ----------------------- rng (deterministic for research) -----------------------
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeSeededRng(seedStr){
    const seed = String(seedStr ?? '');
    const gen = xmur3(seed || String(Date.now()));
    return sfc32(gen(), gen(), gen(), gen());
  }
  function randIn(rng, a, b){ return a + (b-a) * rng(); }
  function pickWeighted(rng, items){
    let sum = 0;
    for(const it of items) sum += (Number(it.w)||0);
    let r = rng() * sum;
    for(const it of items){
      r -= (Number(it.w)||0);
      if(r <= 0) return it.k;
    }
    return items[items.length-1]?.k;
  }

  function deviceLabel(view){
    if(view==='pc') return 'pc';
    if(view==='vr') return 'vr';
    if(view==='cvr') return 'cvr';
    return 'mobile';
  }

  // ----------------------- FX (Particles optional) -----------------------
  function fx(){
    return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles || null;
  }
  function fxText(x,y,text){
    const P = fx();
    try{
      if(P && typeof P.popText==='function') P.popText(x,y,text);
      else if(P && typeof P.scorePop==='function') P.scorePop(x,y,text);
    }catch(_){}
  }

  // ----------------------- config -----------------------
  const view = String(payload.view || qs('view','mobile') || 'mobile').toLowerCase();
  const diff = String(payload.diff || qs('diff','normal') || 'normal').toLowerCase();
  const runMode = String(payload.run || qs('run','play') || 'play').toLowerCase(); // play | research
  const durationPlannedSec = clamp(Number(payload.time ?? qs('time','80') ?? 80) || 80, 20, 300);
  const hub = payload.hub ?? qs('hub', null);
  const seedParam = (payload.seed ?? qs('seed', null));
  const seed = (runMode === 'research')
    ? (seedParam ?? (qs('ts', null) ?? 'RESEARCH-SEED'))
    : (seedParam ?? String(Date.now()));

  // logger study params
  const studyId = payload.studyId ?? qs('studyId', qs('study', null));
  const phase = payload.phase ?? qs('phase', null);
  const conditionGroup = payload.conditionGroup ?? qs('conditionGroup', qs('cond', null));

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-09a';
  const PROJECT_TAG = 'GoodJunkVR';

  const rng = makeSeededRng(String(seed));

  const isVR  = (view === 'vr');
  const isCVR = (view === 'cvr');

  // difficulty tuning
  const DIFF = (() => {
    if(diff==='easy') return {
      spawnPerSec: 1.05,
      junkRate: 0.22,
      starRate: 0.08,
      shieldRate: 0.06,
      goodLifeMs: 2100,
      junkPenaltyMiss: 1,
      goodScore: 12,
      junkPenaltyScore: -10,
      missLimit: 12,
      bossHP: 10,
    };
    if(diff==='hard') return {
      spawnPerSec: 1.55,
      junkRate: 0.32,
      starRate: 0.06,
      shieldRate: 0.045,
      goodLifeMs: 1500,
      junkPenaltyMiss: 1,
      goodScore: 14,
      junkPenaltyScore: -14,
      missLimit: 9,
      bossHP: 14,
    };
    return { // normal
      spawnPerSec: 1.25,
      junkRate: 0.27,
      starRate: 0.07,
      shieldRate: 0.055,
      goodLifeMs: 1800,
      junkPenaltyMiss: 1,
      goodScore: 13,
      junkPenaltyScore: -12,
      missLimit: 10,
      bossHP: 12,
    };
  })();

  const adaptiveOn = (runMode !== 'research');

  // ----------------------- UI refs -----------------------
  const HUD = {
    score: byId('hud-score'),
    time: byId('hud-time'),
    miss: byId('hud-miss'),
    grade: byId('hud-grade'),

    goal: byId('hud-goal'),
    goalCur: byId('hud-goal-cur'),
    goalTarget: byId('hud-goal-target'),
    goalDesc: byId('goalDesc'),

    mini: byId('hud-mini'),
    miniTimer: byId('miniTimer'),

    feverFill: byId('feverFill'),
    feverText: byId('feverText'),
    shieldPills: byId('shieldPills'),

    lowTimeOverlay: byId('lowTimeOverlay'),
    lowTimeNum: byId('gj-lowtime-num'),
  };

  const LAYER_L = byId('gj-layer');
  const LAYER_R = byId('gj-layer-r');

  if(!LAYER_L){
    console.error('[GoodJunkVR] missing #gj-layer');
    return;
  }

  // ----------------------- state -----------------------
  const state = {
    started: false,
    ended: false,

    tStart: 0,
    tNow: 0,
    timeLeftSec: durationPlannedSec,

    score: 0,
    combo: 0,
    comboMax: 0,

    miss: 0,

    // counts
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetShieldSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetBossSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,
    nHitBoss: 0,

    // RT
    rtGood: [],
    rtBreakdown: { lt300:0, lt450:0, lt700:0, ge700:0 },

    // fever / shield
    fever: 0,
    shield: 0,

    // quest
    goal: null,
    goals: [],
    goalsCleared: 0,
    goalsTotal: 3,

    mini: null,
    miniCleared: 0,
    miniTotal: 3,
    miniSeq: [],
    miniIndex: 0,

    // spawn
    spawnAcc: 0,
    targets: new Map(),

    // boss
    bossActive: false,
    bossHp: 0,
    bossHpMax: 0,
    bossPhase: 0,        // 1 or 2
    bossPhase2Left: 0,   // seconds (Phase2=6s)
    bossLastSpawnAt: 0,
    bossId: null,

    // session
    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  // ----------------------- minis -----------------------
  function fastCfgByView(view){
    if(view==='pc')  return { thrMs: 440, target: 2, timeLimitSec: 10 };
    if(view==='cvr') return { thrMs: 460, target: 2, timeLimitSec: 10 };
    if(view==='vr')  return { thrMs: 480, target: 2, timeLimitSec: 10 };
    return { thrMs: 470, target: 2, timeLimitSec: 10 };
  }

  function pickMiniSequence(view='mobile'){
    const fast = fastCfgByView(view);
    return [
      { type:'streak_good', title:'เก็บดีติดกัน', target:3, cur:0, done:false },
      { type:'avoid_junk',  title:'อย่าโดนขยะ', target:6, cur:0, done:false },
      { type:'fast_hits', title:'เก็บให้ไว', target: fast.target, cur:0, done:false,
        thrMs: fast.thrMs, timeLimitSec: fast.timeLimitSec, leftSec: fast.timeLimitSec }
    ];
  }

  function resetMini(m){
    m.cur = 0;
    m.done = false;
    if(m.type === 'fast_hits'){
      const lim = Number(m.timeLimitSec)||10;
      m.leftSec = lim;
    }
  }

  // ----------------------- goals -----------------------
  function makeGoals(){
    return [
      { type:'survive', title:'เอาตัวรอด', target: DIFF.missLimit, cur:0, done:false,
        desc:`MISS ต้องไม่เกิน ${DIFF.missLimit}` },
      { type:'score', title:'ทำคะแนน', target: (diff==='easy'? 420 : diff==='hard'? 520 : 470), cur:0, done:false,
        desc:`เก็บของดีเพื่อทำคะแนน` },
      { type:'minis', title:'ทำ MINI', target: 2, cur:0, done:false,
        desc:`ผ่าน MINI ให้ได้ 2 ครั้ง` }
    ];
  }

  function setGoalText(){
    const g = state.goal;
    if(!g) return;
    if(HUD.goal) HUD.goal.textContent = g.title || '—';
    if(HUD.goalTarget) HUD.goalTarget.textContent = String(g.target ?? 0);
    if(HUD.goalCur) HUD.goalCur.textContent = String(g.cur ?? 0);
    if(HUD.goalDesc) HUD.goalDesc.textContent = g.desc || '—';
  }

  function setMiniText(){
    const m = state.mini;
    if(!m){
      if(HUD.mini) HUD.mini.textContent = '—';
      if(HUD.miniTimer) HUD.miniTimer.textContent = '—';
      emit('quest:update', { mini:null, goal:state.goal });
      return;
    }
    if(HUD.mini){
      if(m.type==='fast_hits'){
        HUD.mini.textContent = `${m.title}: ${m.cur}/${m.target} (เร็วกว่า ${m.thrMs}ms)`;
      }else if(m.type==='avoid_junk'){
        HUD.mini.textContent = `${m.title}: อยู่ให้ครบ ${m.target}s (ห้ามโดนขยะ)`;
      }else{
        HUD.mini.textContent = `${m.title}: ${m.cur}/${m.target}`;
      }
    }
    if(HUD.miniTimer){
      if(m.type==='fast_hits') HUD.miniTimer.textContent = `${Math.ceil(m.leftSec||0)}s`;
      else HUD.miniTimer.textContent = '—';
    }
    emit('quest:update', { mini:m, goal:state.goal });
  }

  function nextMini(){
    state.miniIndex = (state.miniIndex + 1) % state.miniSeq.length;
    state.mini = state.miniSeq[state.miniIndex];
    resetMini(state.mini);
    setMiniText();
  }

  function markMiniCleared(){
    state.miniCleared++;

    // goal minis
    if(state.goal && state.goal.type==='minis'){
      state.goal.cur = clamp(state.miniCleared, 0, state.goal.target);
      if(state.goal.cur >= state.goal.target && !state.goal.done){
        state.goal.done = true;
        state.goalsCleared++;
        emit('hha:judge', { label:'GOAL!' });
        pulseBodyClass('fx-goal', 320);
      }
      setGoalText();
    }

    emit('hha:judge', { label:'MINI CLEAR!' });
    pulseBodyClass('fx-mini', 240);
    emit('hha:celebrate', { kind:'mini' });

    nextMini();
  }

  function tickMini(dtSec){
    const m = state.mini;
    if(!m || m.done) return;

    if(m.type==='avoid_junk'){
      m.cur += dtSec;
      if(m.cur >= m.target){
        m.cur = m.target;
        m.done = true;
        markMiniCleared();
      }else{
        if((Math.floor(m.cur*3) % 2)===0) setMiniText();
      }
      return;
    }

    if(m.type==='fast_hits'){
      m.leftSec = Math.max(0, (Number(m.leftSec)||0) - dtSec);
      if(HUD.miniTimer) HUD.miniTimer.textContent = `${Math.ceil(m.leftSec)}s`;

      if(m.leftSec <= 0 && !m.done){
        resetMini(m);
        setMiniText();
      }
      return;
    }
  }

  // ----------------------- HUD / fever / shield -----------------------
  function setScore(v){
    state.score = Math.max(0, Math.floor(v));
    if(HUD.score) HUD.score.textContent = String(state.score);
    emit('hha:score', { score: state.score });
  }
  function setMiss(v){
    state.miss = Math.max(0, Math.floor(v));
    if(HUD.miss) HUD.miss.textContent = String(state.miss);
  }
  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    if(HUD.time) HUD.time.textContent = String(Math.ceil(state.timeLeftSec));
    emit('hha:time', { t: state.timeLeftSec });
  }
  function setGradeText(txt){
    if(HUD.grade) HUD.grade.textContent = txt;
  }
  function addFever(delta){
    state.fever = clamp(state.fever + (Number(delta)||0), 0, 100);
    if(HUD.feverFill) HUD.feverFill.style.width = `${state.fever}%`;
    if(HUD.feverText) HUD.feverText.textContent = `${Math.round(state.fever)}%`;
  }
  function addShield(n){
    state.shield = clamp(state.shield + (Number(n)||0), 0, 5);
    renderShield();
  }
  function useShield(){
    if(state.shield > 0){
      state.shield--;
      renderShield();
      return true;
    }
    return false;
  }
  function renderShield(){
    if(!HUD.shieldPills) return;
    const pills = [];
    for(let i=0;i<state.shield;i++) pills.push('🛡️');
    HUD.shieldPills.textContent = pills.length ? pills.join(' ') : '—';
  }

  function updateLowTimeFx(){
    const t = state.timeLeftSec;
    if(t <= 10){
      pulseBodyClass('fx-lowtime', 120);
      if(HUD.lowTimeOverlay){
        HUD.lowTimeOverlay.setAttribute('aria-hidden', (t<=5) ? 'false' : 'true');
      }
      if(HUD.lowTimeNum && t<=5){
        HUD.lowTimeNum.textContent = String(Math.ceil(t));
      }
    }else{
      if(HUD.lowTimeOverlay) HUD.lowTimeOverlay.setAttribute('aria-hidden','true');
    }
  }

  // ----------------------- phase classes (storm/boss/rage) -----------------------
  function updatePhaseClasses(){
    const storm = (state.timeLeftSec <= 30);
    const boss  = (state.miss >= 4);
    const rage  = (state.miss >= 5);

    BODY.classList.toggle('gj-storm', !!storm);
    BODY.classList.toggle('gj-boss',  !!boss);
    BODY.classList.toggle('gj-rage',  !!rage);

    // boss fight auto start when threshold reached
    if(boss && !state.bossActive && !state.ended){
      startBossFight();
    }
  }

  // ----------------------- safe spawn rect -----------------------
  function readRootPxVar(name, fallbackPx){
    try{
      const cs = getComputedStyle(DOC.documentElement);
      const v = String(cs.getPropertyValue(name) || '').trim().replace('px','');
      const n = Number(v);
      return Number.isFinite(n) ? n : fallbackPx;
    }catch(_){ return fallbackPx; }
  }

  function getSafeRect(){
    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;

    const sat = readRootPxVar('--sat', 0);
    const topSafe = readRootPxVar('--gj-top-safe', 130 + sat);
    const botSafe = readRootPxVar('--gj-bottom-safe', 120);

    const xMin = Math.floor(W * 0.12);
    const xMax = Math.floor(W * 0.88);
    const yMin = Math.floor(topSafe);
    const yMax = Math.floor(Math.max(yMin + 120, H - botSafe));

    return { W,H, xMin,xMax, yMin,yMax };
  }

  // ----------------------- targets -----------------------
  let targetSeq = 0;

  const EMOJI = {
    good: ['🥦','🍎','🥕','🍌','🍇','🥬','🍊','🍉'],
    junk: ['🍟','🍔','🍭','🍩','🧁','🥤','🍪','🍫'],
    star: ['⭐'],
    shield: ['🛡️'],
    diamond: ['💎'],
    boss: ['👹','😈','💀','👺'],
  };

  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  function makeTargetKind(){
    // Boss mode: inject boss target occasionally + more junk pressure in phase2/rage
    const diamondW = (diff==='hard') ? 0.012 : 0.015;

    let starW = DIFF.starRate;
    let shieldW = DIFF.shieldRate;
    let junkW = DIFF.junkRate;

    // Storm: slightly more star/shield to keep kids hopeful
    if(state.timeLeftSec <= 30){
      starW *= 1.12;
      shieldW *= 1.08;
    }

    // Rage: more junk pressure
    if(state.miss >= 5){
      junkW = Math.min(0.46, junkW * 1.28);
      starW *= 0.85;
      shieldW *= 0.92;
    }

    // Boss active: sometimes spawn boss itself
    let bossW = 0;
    if(state.bossActive){
      bossW = (state.bossPhase === 2) ? 0.07 : 0.055; // Phase2 more boss presence
      junkW = Math.min(0.52, junkW * (state.bossPhase === 2 ? 1.22 : 1.12));
      starW *= 0.90;
      shieldW *= 0.92;
    }

    const goodW = Math.max(0.01, 1 - (junkW + starW + shieldW + diamondW + bossW));
    return pickWeighted(rng, [
      {k:'good', w:goodW},
      {k:'junk', w:junkW},
      {k:'star', w:starW},
      {k:'shield', w:shieldW},
      {k:'diamond', w:diamondW},
      {k:'boss', w:bossW},
    ]);
  }

  function spawnOne(){
    if(state.ended) return;

    const kind = makeTargetKind();

    // count spawned
    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;
    else if(kind==='boss') state.nTargetBossSpawned++;

    const id = `t${++targetSeq}`;
    const baseLife =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='diamond') ? Math.round(DIFF.goodLifeMs * 1.25) :
      Math.round(DIFF.goodLifeMs * (state.bossPhase===2 ? 1.35 : 1.45)); // boss longer

    const lifeMs = clamp(baseLife, 900, 4200);

    // size scaling
    const baseSize =
      (kind==='boss') ? 86 :
      (kind==='good') ? 54 :
      (kind==='junk') ? 56 : 50;

    const size = clamp(baseSize + randIn(rng, -4, 12), 44, (kind==='boss'? 112 : 76));

    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

    const elL = DOC.createElement('div');
    elL.className = 'gj-target spawn';
    elL.dataset.id = id;
    elL.dataset.kind = kind;
    elL.textContent = pickEmoji(kind);
    elL.style.left = `${x}px`;
    elL.style.top  = `${y}px`;
    elL.style.fontSize = `${size}px`;

    // boss aura class via inline class (safe even without extra css)
    if(kind==='boss'){
      elL.style.filter = 'drop-shadow(0 18px 26px rgba(239,68,68,.35))';
    }

    let elR = null;
    if(LAYER_R){
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
    }

    const bornAt = now();
    const tObj = { id, kind, bornAt, lifeMs, x,y, elL, elR, hit:false };

    elL.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onTargetHit(tObj, { via:'tap', clientX: ev.clientX, clientY: ev.clientY });
    }, { passive:false });

    LAYER_L.appendChild(elL);
    if(elR && LAYER_R) LAYER_R.appendChild(elR);

    requestAnimationFrame(()=>{ try{ elL.classList.add('spawn'); if(elR) elR.classList.add('spawn'); }catch(_){ } });

    state.targets.set(id, tObj);
  }

  function removeTarget(tObj){
    if(!tObj) return;
    try{
      tObj.elL?.classList.add('gone');
      tObj.elR?.classList.add('gone');
      setTimeout(()=>{
        try{ tObj.elL?.remove(); }catch(_){}
        try{ tObj.elR?.remove(); }catch(_){}
      }, 160);
    }catch(_){}
    state.targets.delete(tObj.id);
  }

  // ----------------------- scoring / RT -----------------------
  function recordRt(ms){
    if(ms == null) return;
    const v = Math.max(0, Math.floor(ms));
    state.rtGood.push(v);
    if(v < 300) state.rtBreakdown.lt300++;
    else if(v < 450) state.rtBreakdown.lt450++;
    else if(v < 700) state.rtBreakdown.lt700++;
    else state.rtBreakdown.ge700++;
  }
  function median(arr){
    if(!arr.length) return null;
    const a = arr.slice().sort((x,y)=>x-y);
    const mid = Math.floor(a.length/2);
    return (a.length%2) ? a[mid] : Math.round((a[mid-1]+a[mid]) / 2);
  }
  function avg(arr){
    if(!arr.length) return null;
    let s=0; for(const v of arr) s += v;
    return Math.round(s/arr.length);
  }

  // ----------------------- mini handlers -----------------------
  function miniOnGoodHit(rtMs){
    const m = state.mini;
    if(!m || m.done) return;

    if(m.type==='streak_good'){
      m.cur++;
      if(m.cur >= m.target){
        m.done = true;
        markMiniCleared();
      }else{
        setMiniText();
      }
      return;
    }

    if(m.type==='fast_hits'){
      const thr = Number(m.thrMs)||450;
      if(rtMs!=null && rtMs<=thr){
        m.cur++;
        if(m.cur >= m.target){
          m.done = true;
          emit('hha:judge', { label:'FAST PASS!' });
          markMiniCleared();
        }else{
          setMiniText();
        }
      }
      return;
    }
  }

  function miniOnJunkHit(){
    const m = state.mini;
    if(!m || m.done) return;

    if(m.type==='avoid_junk' || m.type==='streak_good'){
      resetMini(m);
      setMiniText();
    }
  }

  // ----------------------- goal updates -----------------------
  function updateGoalsOnScore(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='score'){
      g.cur = clamp(state.score, 0, g.target);
      if(g.cur >= g.target){
        g.done = true;
        state.goalsCleared++;
        emit('hha:judge', { label:'GOAL!' });
        pulseBodyClass('fx-goal', 320);
      }
      setGoalText();
    }
  }

  function updateGoalsOnMiss(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='survive'){
      g.cur = clamp(state.miss, 0, g.target);
      setGoalText();
    }
  }

  // ----------------------- combo -----------------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){ state.combo = 0; }

  // ----------------------- Boss Fight (โหด++ แต่แฟร์) -----------------------
  function startBossFight(){
    state.bossActive = true;
    state.bossHpMax = DIFF.bossHP;
    state.bossHp = state.bossHpMax;
    state.bossPhase = 1;
    state.bossPhase2Left = 0;
    state.bossId = null;

    emit('hha:judge', { label:`BOSS 등장! HP ${state.bossHp}/${state.bossHpMax}` });
    emit('hha:coach', { kind:'warn', msg:'บอสมาแล้ว! เล็งแล้วแตะ/ยิงบอส 👹 เพื่อลด HP (ระวังขยะ!)' });

    // give tiny fairness aid: +1 shield in easy/normal (optional)
    if(diff !== 'hard'){
      addShield(1);
      fxText(DOC.documentElement.clientWidth*0.5, DOC.documentElement.clientHeight*0.5, '🛡️ +1');
      pulseBodyClass('fx-block', 160);
    }
  }

  function enterBossPhase2(){
    if(!state.bossActive || state.bossPhase === 2) return;
    state.bossPhase = 2;
    state.bossPhase2Left = 6; // ✅ Phase2-6s
    emit('hha:judge', { label:'BOSS PHASE 2!' });
    emit('hha:coach', { kind:'warn', msg:'Phase 2 (6s)! บอสโกรธแล้ว—เกิดเร็วขึ้น ระวังขยะ!' });
    pulseBodyClass('fx-miss', 220);
  }

  function bossHit(px,py){
    if(!state.bossActive) return;

    state.nHitBoss++;
    state.bossHp = Math.max(0, state.bossHp - 1);

    fxText(px,py,`-1 HP (${state.bossHp}/${state.bossHpMax})`);
    pulseBodyClass('fx-good', 160);

    // trigger phase2 when HP <= ceil(40%) OR timeLeft<=18 OR rage condition
    const hpTrigger = Math.ceil(state.bossHpMax * 0.40);
    if(state.bossHp <= hpTrigger || state.timeLeftSec <= 18 || state.miss >= 5){
      enterBossPhase2();
    }

    if(state.bossHp <= 0){
      // boss defeated (big reward, fair)
      state.bossActive = false;
      state.bossPhase = 0;
      state.bossPhase2Left = 0;

      const bonus = (diff==='hard') ? 70 : 55;
      setScore(state.score + bonus);
      updateGoalsOnScore();

      // reward: reduce miss by 1 (never below 0) + shield+1
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();
      addShield(1);

      emit('hha:judge', { label:`BOSS DOWN! +${bonus}` });
      emit('hha:celebrate', { kind:'boss' });
      pulseBodyClass('fx-goal', 320);
    }
  }

  // ----------------------- hit logic -----------------------
  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    tObj.hit = true;

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

    const px = meta.clientX ?? tObj.x;
    const py = meta.clientY ?? tObj.y;

    if(kind==='good'){
      state.nHitGood++;
      addCombo();
      addFever(3.2);

      // small combo scaling
      const delta = DIFF.goodScore + Math.min(6, Math.floor(state.combo/5));
      setScore(state.score + delta);
      updateGoalsOnScore();

      recordRt(rtMs);
      miniOnGoodHit(rtMs);

      fxText(px,py,`+${delta}`);
      emit('hha:judge', { label:'GOOD!' });
      pulseBodyClass('fx-good', 160);

    } else if(kind==='junk'){
      const blocked = useShield();
      resetCombo();

      if(blocked){
        state.nHitJunkGuard++;
        addFever(-6);

        fxText(px,py,'BLOCK');
        emit('hha:judge', { label:'BLOCK!' });
        pulseBodyClass('fx-block', 160);
      }else{
        state.nHitJunk++;
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1));
        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        updateGoalsOnMiss();

        miniOnJunkHit();

        fxText(px,py,'MISS+');
        emit('hha:judge', { label:'OOPS!' });
        pulseBodyClass('fx-miss', 220);
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);

      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();

      fxText(px,py,'MISS -1');
      emit('hha:judge', { label:'STAR!' });
      pulseBodyClass('fx-mini', 220);

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);

      addShield(1);

      fxText(px,py,'🛡️ +1');
      emit('hha:judge', { label:'SHIELD!' });
      pulseBodyClass('fx-block', 160);

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);

      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();

      fxText(px,py,`+${bonus}`);
      emit('hha:judge', { label:'DIAMOND!' });
      pulseBodyClass('fx-goal', 260);

    } else if(kind==='boss'){
      // boss hit reduces HP, doesn't affect miss directly
      resetCombo();
      bossHit(px,py);
      emit('hha:judge', { label:'HIT BOSS!' });
    }

    setMiniText();
    removeTarget(tObj);

    // phase update + end conditions
    updatePhaseClasses();

    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // ----------------------- crosshair shooting (cVR/VR) -----------------------
  function shootCrosshair(){
    if(state.ended) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    // stricter in VR
    const R = (isCVR || isVR) ? 86 : 72;

    let best = null;
    let bestD = 1e9;

    for(const t of state.targets.values()){
      if(t.hit) continue;
      const dx = (t.x - cx);
      const dy = (t.y - cy);
      const d = Math.hypot(dx,dy);

      // slightly prioritize boss if close
      const bias = (t.kind === 'boss') ? 10 : 0;
      const score = d - bias;

      if(d < R && score < bestD){
        bestD = score;
        best = t;
      }
    }

    if(best){
      onTargetHit(best, { via:'shoot', clientX: cx, clientY: cy });
    }else{
      pulseBodyClass('fx-lowtime', 120);
    }
  }

  ROOT.addEventListener('hha:shoot', shootCrosshair, { passive:true });

  // ----------------------- expiry tick -----------------------
  function expireTargets(){
    const t = now();
    for(const tObj of state.targets.values()){
      if(tObj.hit) continue;
      const age = t - tObj.bornAt;
      if(age >= tObj.lifeMs){
        tObj.hit = true;
        const kind = tObj.kind;

        if(kind === 'good'){
          // miss definition includes good expired
          state.nExpireGood++;
          resetCombo();
          addFever(6);

          setMiss(state.miss + 1);
          updateGoalsOnMiss();

          // reset streak mini
          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          fxText(tObj.x, tObj.y, 'MISS');
          emit('hha:judge', { label:'MISS!' });
          pulseBodyClass('fx-miss', 220);

          updatePhaseClasses();

          if(state.miss >= DIFF.missLimit){
            removeTarget(tObj);
            endGame('miss-limit');
            return;
          }
        }

        // boss expiry: keep pressure but no penalty; just remove
        removeTarget(tObj);
      }
    }
  }

  // ----------------------- spawn rate -----------------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.22*struggle);

      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.15;
    }

    // Storm: little bump
    if(state.timeLeftSec <= 30) r *= 1.08;

    // Boss: more intensity, phase2 stronger
    if(state.bossActive){
      r *= (state.bossPhase === 2) ? 1.28 : 1.18;
    }

    // Rage: stacked pressure (but clamp)
    if(state.miss >= 5){
      r *= 1.18;
    }

    return clamp(r, 0.8, 2.25);
  }

  // ----------------------- grading -----------------------
  function calcAccuracyGoodPct(){
    if(state.nTargetGoodSpawned <= 0) return null;
    return Math.round((state.nHitGood / Math.max(1, state.nTargetGoodSpawned)) * 1000) / 10;
  }
  function calcJunkErrorPct(){
    const denom = Math.max(1, state.nTargetJunkSpawned);
    return Math.round((state.nHitJunk / denom) * 1000) / 10;
  }
  function calcFastHitRatePct(){
    if(!state.rtGood.length) return null;
    const fast = state.rtGood.filter(x => x <= 450).length;
    return Math.round((fast / state.rtGood.length) * 1000) / 10;
  }

  // Grade SSS/SS/S/A/B/C (ตามที่คุณอยากได้)
  function gradeFrom(score, miss){
    // โฟกัสความแฟร์: miss สำคัญกว่า score นิดนึง
    if(miss <= 1 && score >= 620) return 'SSS';
    if(miss <= 2 && score >= 560) return 'SS';
    if(miss <= 3 && score >= 500) return 'S';
    if(miss <= 5 && score >= 430) return 'A';
    if(miss <= 7 && score >= 350) return 'B';
    if(miss <= 9 && score >= 280) return 'C';
    return 'D';
  }

  // ----------------------- END overlay (use existing DOM if present) -----------------------
  function fillAndShowEndOverlay(summary){
    // Prefer existing #endOverlay in HTML
    const ov = byId('endOverlay');
    if(!ov){
      // fallback: just alert minimal
      try{ alert(`END: grade=${summary.grade} score=${summary.scoreFinal} miss=${summary.misses}`); }catch(_){}
      return;
    }

    try{
      const t = (summary.reason === 'miss-limit') ? 'Game Over' : 'Completed';
      const sub = `reason=${summary.reason||'-'} | mode=${summary.runMode||'-'} | view=${summary.device||'-'} | diff=${summary.diff||'-'}`;

      const set = (id, val)=>{
        const el = byId(id);
        if(el) el.textContent = String(val ?? '—');
      };

      set('endTitle', t);
      set('endSub', sub);
      set('endGrade', summary.grade || '—');
      set('endScore', summary.scoreFinal ?? 0);
      set('endMiss', summary.misses ?? 0);
      set('endTime', Math.round(Number(summary.durationPlayedSec||0)));

      // show by aria-hidden ONLY (CSS handles display)
      ov.setAttribute('aria-hidden','false');

      pulseBodyClass('fx-end', 950);
    }catch(_){}
  }

  // ----------------------- end game -----------------------
  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    // clear targets
    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

    // survive goal completes at end if miss <= limit
    if(state.goal && state.goal.type==='survive' && !state.goal.done){
      if(state.miss <= DIFF.missLimit){
        state.goal.done = true;
        state.goalsCleared++;
      }
      setGoalText();
    }
    state.goalsCleared = clamp(state.goalsCleared, 0, state.goalsTotal);

    const scoreFinal = state.score;
    const comboMax = state.comboMax;
    const misses = state.miss;

    const accuracyGoodPct = calcAccuracyGoodPct();
    const junkErrorPct = calcJunkErrorPct();
    const avgRtGoodMs = avg(state.rtGood);
    const medianRtGoodMs = median(state.rtGood);
    const fastHitRatePct = calcFastHitRatePct();

    const grade = gradeFrom(scoreFinal, misses);
    setGradeText(grade);

    state.endTimeIso = new Date().toISOString();

    const summary = {
      projectTag: PROJECT_TAG,
      gameVersion: GAME_VERSION,
      device: deviceLabel(view),
      runMode,
      diff,
      seed,

      reason,
      durationPlannedSec,
      durationPlayedSec: Math.round(durationPlannedSec - state.timeLeftSec),

      scoreFinal,
      comboMax,
      misses,

      goalsCleared: state.goalsCleared,
      goalsTotal: state.goalsTotal,
      miniCleared: state.miniCleared,
      miniTotal: state.miniTotal,

      nTargetGoodSpawned: state.nTargetGoodSpawned,
      nTargetJunkSpawned: state.nTargetJunkSpawned,
      nTargetStarSpawned: state.nTargetStarSpawned,
      nTargetDiamondSpawned: state.nTargetDiamondSpawned,
      nTargetShieldSpawned: state.nTargetShieldSpawned,
      nTargetBossSpawned: state.nTargetBossSpawned,

      nHitGood: state.nHitGood,
      nHitJunk: state.nHitJunk,
      nHitJunkGuard: state.nHitJunkGuard,
      nExpireGood: state.nExpireGood,
      nHitBoss: state.nHitBoss,

      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs,
      medianRtGoodMs,
      fastHitRatePct,
      rtBreakdownJson: JSON.stringify(state.rtBreakdown),

      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,

      grade,
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}

    // emit end for logger
    emit('hha:end', {
      projectTag: PROJECT_TAG,
      runMode,
      studyId,
      phase,
      conditionGroup,
      device: deviceLabel(view),
      view,
      diff,
      seed,
      gameVersion: GAME_VERSION,

      durationPlannedSec,
      durationPlayedSec: summary.durationPlayedSec,

      scoreFinal,
      comboMax,
      misses,

      goalsCleared: summary.goalsCleared,
      goalsTotal: summary.goalsTotal,
      miniCleared: summary.miniCleared,
      miniTotal: summary.miniTotal,

      nTargetGoodSpawned: summary.nTargetGoodSpawned,
      nTargetJunkSpawned: summary.nTargetJunkSpawned,
      nTargetStarSpawned: summary.nTargetStarSpawned,
      nTargetDiamondSpawned: summary.nTargetDiamondSpawned,
      nTargetShieldSpawned: summary.nTargetShieldSpawned,
      nTargetBossSpawned: summary.nTargetBossSpawned,

      nHitGood: summary.nHitGood,
      nHitJunk: summary.nHitJunk,
      nHitJunkGuard: summary.nHitJunkGuard,
      nExpireGood: summary.nExpireGood,
      nHitBoss: summary.nHitBoss,

      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs,
      medianRtGoodMs,
      fastHitRatePct,
      rtBreakdownJson: summary.rtBreakdownJson,

      reason,
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,

      grade,
    });

    emit('hha:celebrate', { kind:'end', grade });

    // fill existing end overlay
    fillAndShowEndOverlay(summary);
  }

  // ----------------------- main loop -----------------------
  let lastTick = 0;

  function tick(){
    if(state.ended) return;

    const t = now();
    if(!lastTick) lastTick = t;
    const dt = Math.min(0.05, (t - lastTick) / 1000);
    lastTick = t;

    state.tNow = t;

    // time
    state.timeLeftSec -= dt;
    if(state.timeLeftSec < 0) state.timeLeftSec = 0;

    setTimeLeft(state.timeLeftSec);
    updateLowTimeFx();

    // boss phase2 timer
    if(state.bossActive && state.bossPhase === 2){
      state.bossPhase2Left = Math.max(0, state.bossPhase2Left - dt);
      if(state.bossPhase2Left <= 0){
        // phase2 ends, stay bossActive but revert to phase1 intensity
        state.bossPhase = 1;
        emit('hha:judge', { label:'Phase 2 ended' });
      }
    }

    // phase classes
    updatePhaseClasses();

    // mini tick
    tickMini(dt);

    // spawn
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();

      // low time burst spice
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.12) spawnOne();

      // boss phase2: extra burst (แต่ clamp ด้วย rng)
      if(state.bossActive && state.bossPhase === 2 && rng() < 0.18) spawnOne();
    }

    // expiry
    expireTargets();

    // end by time
    if(state.timeLeftSec <= 0){
      endGame('timeup');
      return;
    }

    requestAnimationFrame(tick);
  }

  // ----------------------- init -----------------------
  function initHud(){
    setScore(0);
    setMiss(0);
    setTimeLeft(durationPlannedSec);
    setGradeText('—');
    addFever(0);
    renderShield();

    // quests
    state.goals = makeGoals();
    state.goal = state.goals[0];
    setGoalText();

    state.miniSeq = pickMiniSequence(view);
    state.miniIndex = 0;
    state.mini = state.miniSeq[state.miniIndex];
    resetMini(state.mini);
    setMiniText();

    emit('quest:update', { goal: state.goal, mini: state.mini });
  }

  function start(){
    if(state.started) return;
    state.started = true;

    state.tStart = now();
    state.startTimeIso = new Date().toISOString();

    initHud();
    updatePhaseClasses();

    emit('hha:start', {
      projectTag: PROJECT_TAG,
      runMode,
      studyId,
      phase,
      conditionGroup,
      view,
      device: deviceLabel(view),
      diff,
      seed,
      gameVersion: GAME_VERSION,
      durationPlannedSec,
      startTimeIso: state.startTimeIso
    });

    emit('hha:coach', {
      msg: 'ทริค: อย่าแตะขยะ! ⭐ ลด MISS และ 🛡️ กันขยะได้ (กันแล้วไม่เป็น MISS)',
      kind: 'tip'
    });

    requestAnimationFrame(tick);
  }

  start();

  // ----------------------- flush helpers -----------------------
  DOC.addEventListener('visibilitychange', ()=>{
    try{
      if(DOC.visibilityState === 'hidden' && !state.ended){
        log({ type:'visibility', v:'hidden', t: new Date().toISOString() });
      }
    }catch(_){}
  }, { passive:true });

  ROOT.addEventListener('pagehide', ()=>{
    try{
      if(!state.ended){
        log({ type:'pagehide', t: new Date().toISOString() });
      }
    }catch(_){}
  }, { passive:true });

  // debug
  ROOT.__GJ_STATE__ = state;

  // ----------------------- internal: miss trigger helpers -----------------------
  // Ensure: hit junk (unblocked) + expire good both call updatePhaseClasses already.
  // End overlay: this safe.js controls by aria-hidden only.
}