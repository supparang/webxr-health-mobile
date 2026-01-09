// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + BOSS+++)
// ✅ Storm: timeLeft<=30s
// ✅ Boss: miss>=4 | Rage: miss>=5
// ✅ Boss HP: easy/normal/hard = 10/12/14
// ✅ Phase2 = 6s
// ✅ A) Armor Window (Phase2): hit weakpoint only inside 0.8s window
// ✅ B) Decoy Weakpoint (Phase2): wrong weakpoint => penalty wave
// ✅ C) Fair Assist: deterministic star/shield drops when struggle
// ✅ Deterministic patterns (seeded RNG)

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ----------------------- helpers -----------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // rng (deterministic for research)
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

  // particles (optional)
  function fx(){
    return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles || null;
  }
  function fxPop(x,y,text,cls){
    const P = fx();
    try{
      if(P && typeof P.popText==='function') P.popText(x,y,text,cls||'hha-pop');
    }catch(_){}
  }
  function fxBurst(x,y,kind='good'){
    const P = fx();
    try{
      if(P && typeof P.burstAt==='function') P.burstAt(x,y,kind);
    }catch(_){}
  }
  function fxCelebrate(kind='end'){
    const P = fx();
    try{
      if(P && typeof P.celebrate==='function') P.celebrate(kind);
    }catch(_){}
  }

  function bodyPulse(cls, ms=180){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms);
    }catch(_){}
  }
  function setBodyFlag(cls, on){
    try{ DOC.body.classList.toggle(cls, !!on); }catch(_){}
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

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-09BOSSPLUS';
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
      bossHp: 10,
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
      bossHp: 14,
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
      bossHp: 12,
    };
  })();

  // play vs research (adaptive off in research)
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

    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetShieldSpawned: 0,
    nTargetDiamondSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    rtGood: [],
    rtBreakdown: { lt300:0, lt450:0, lt700:0, ge700:0 },

    fever: 0,
    shield: 0,

    goal: null,
    goalsCleared: 0,
    goalsTotal: 3,

    mini: null,
    miniCleared: 0,
    miniTotal: 3,
    miniSeq: [],
    miniIndex: 0,

    spawnAcc: 0,
    targets: new Map(),

    sessionId: null,
    startTimeIso: new Date().toISOString(),
    endTimeIso: null,

    // ======= STORM / BOSS / RAGE =======
    stormOn: false,

    bossOn: false,
    bossRage: false,
    bossHpMax: DIFF.bossHp,
    bossHp: DIFF.bossHp,
    bossPhase: 1,
    bossPhase2Left: 0,      // 6s
    bossNextWaveIn: 0,

    // ======= A) Armor Window =======
    bossArmorWindowOpen: false,
    bossArmorWindowT: 0,         // remaining seconds
    bossArmorCycleT: 0,          // cycle timer to open/close windows
    bossArmorOpenDur: 0.80,      // window length
    bossArmorCloseDur: 0.55,     // downtime

    // ======= B) Decoy =======
    bossDecoyOn: false,          // only in phase2
    bossDecoyPenaltyCd: 0,       // cooldown to prevent spam penalty
    bossStunT: 0,                // small stun after decoy hit

    // deterministic wave counters
    waveTick: 0,

    // ======= C) Fair Assist =======
    assistCd: 0,
    assistBudget: 3,             // max drops per run (fair)
    assistGateStep: 0,
  };

  // ----------------------- mini config -----------------------
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
    m.cur = 0; m.done = false;
    if(m.type === 'fast_hits'){
      const lim = Number(m.timeLimitSec)||10;
      m.leftSec = lim;
    }
  }

  // ----------------------- quests -----------------------
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
    HUD.goal && (HUD.goal.textContent = g.title || '—');
    HUD.goalTarget && (HUD.goalTarget.textContent = String(g.target ?? 0));
    HUD.goalCur && (HUD.goalCur.textContent = String(g.cur ?? 0));
    HUD.goalDesc && (HUD.goalDesc.textContent = g.desc || '—');
  }
  function setMiniText(){
    const m = state.mini;
    if(!m){
      HUD.mini && (HUD.mini.textContent = '—');
      HUD.miniTimer && (HUD.miniTimer.textContent = '—');
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

    if(state.goal && state.goal.type==='minis'){
      state.goal.cur = clamp(state.miniCleared, 0, state.goal.target);
      if(state.goal.cur >= state.goal.target && !state.goal.done){
        state.goal.done = true;
        state.goalsCleared++;
        emit('hha:judge', { label:'GOAL!' });
      }
      setGoalText();
    }

    emit('hha:judge', { label:'MINI CLEAR!' });
    bodyPulse('gj-mini-clear', 220);
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
      HUD.miniTimer && (HUD.miniTimer.textContent = `${Math.ceil(m.leftSec)}s`);
      if(m.leftSec <= 0 && !m.done){
        resetMini(m);
        setMiniText();
      }
      return;
    }
  }

  // ----------------------- HUD core -----------------------
  function setScore(v){
    state.score = Math.max(0, Math.floor(v));
    HUD.score && (HUD.score.textContent = String(state.score));
    emit('hha:score', { score: state.score });
  }
  function setMiss(v){
    state.miss = Math.max(0, Math.floor(v));
    HUD.miss && (HUD.miss.textContent = String(state.miss));
  }
  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    HUD.time && (HUD.time.textContent = String(Math.ceil(state.timeLeftSec)));
    emit('hha:time', { t: state.timeLeftSec });
  }
  function setGradeText(txt){
    HUD.grade && (HUD.grade.textContent = txt);
  }
  function addFever(delta){
    state.fever = clamp(state.fever + (Number(delta)||0), 0, 100);
    HUD.feverFill && (HUD.feverFill.style.width = `${state.fever}%`);
    HUD.feverText && (HUD.feverText.textContent = `${Math.round(state.fever)}%`);
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
    const body = DOC.body;
    body.classList.remove('gj-lowtime','gj-lowtime5','gj-tick');
    if(t <= 10){
      body.classList.add('gj-lowtime');
      if(t <= 5) body.classList.add('gj-lowtime5');

      if(HUD.lowTimeOverlay){
        HUD.lowTimeOverlay.setAttribute('aria-hidden', (t<=5) ? 'false' : 'true');
      }
      if(HUD.lowTimeNum && t<=5){
        HUD.lowTimeNum.textContent = String(Math.ceil(t));
        body.classList.add('gj-tick');
        setTimeout(()=>body.classList.remove('gj-tick'), 120);
      }
    }else{
      HUD.lowTimeOverlay && HUD.lowTimeOverlay.setAttribute('aria-hidden','true');
    }
  }

  // ----------------------- safe rect -----------------------
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
    boss: ['👹'],
    weak: ['🎯'],
    decoy: ['🎯'], // decoy uses same emoji but CSS makes it “fake”
  };

  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  // ----------------------- boss events -----------------------
  function bossEmit(){
    emit('hha:boss', {
      active: state.bossOn,
      hp: state.bossHp,
      hpMax: state.bossHpMax,
      phase: state.bossPhase,
      rage: state.bossRage,
      phase2Left: state.bossPhase2Left,

      // NEW
      armorOpen: state.bossArmorWindowOpen,
      armorLeft: state.bossArmorWindowT,
      decoyOn: state.bossDecoyOn,
      stunT: state.bossStunT,
    });
  }

  function startStorm(){
    if(state.stormOn) return;
    state.stormOn = true;
    setBodyFlag('gj-storm', true);
    emit('hha:judge', { label:'STORM!' });
    emit('hha:coach', { msg:'⛈️ STORM! ช่วงท้ายโหดขึ้น — โฟกัสของดี + เลี่ยงขยะ', kind:'warn' });
    bossEmit();
  }

  function startBoss(){
    if(state.bossOn) return;
    state.bossOn = true;
    state.bossRage = (state.miss >= 5);
    state.bossHpMax = DIFF.bossHp;
    state.bossHp = DIFF.bossHp;
    state.bossPhase = 1;
    state.bossPhase2Left = 0;
    state.bossNextWaveIn = 0.25;

    // armor system init
    state.bossArmorWindowOpen = false;
    state.bossArmorWindowT = 0;
    state.bossArmorCycleT = 0;

    // decoy init
    state.bossDecoyOn = false;
    state.bossDecoyPenaltyCd = 0;
    state.bossStunT = 0;

    setBodyFlag('gj-boss', true);
    if(state.bossRage) setBodyFlag('gj-rage', true);

    emit('hha:judge', { label:'BOSS!' });
    emit('hha:coach', { msg:'👹 BOSS มาแล้ว! ยิง/แตะ 🎯 เพื่อลด HP บอส', kind:'boss' });
    bossEmit();
  }

  function setRage(on){
    if(state.bossRage === on) return;
    state.bossRage = !!on;
    setBodyFlag('gj-rage', state.bossRage);
    emit('hha:judge', { label: state.bossRage ? 'RAGE!' : 'CALM' });
    bossEmit();
  }

  function damageBoss(dmg){
    if(!state.bossOn || state.ended) return;
    const d = Math.max(1, Math.floor(dmg||1));
    state.bossHp = clamp(state.bossHp - d, 0, state.bossHpMax);
    bossEmit();

    if(state.bossHp <= 0){
      emit('hha:judge', { label:'BOSS DOWN!' });
      fxCelebrate('boss');
      setBodyFlag('gj-boss', false);
      setBodyFlag('gj-rage', false);
      setBodyFlag('gj-armor', false);
      setBodyFlag('gj-decoy', false);
      state.bossOn = false;
      state.bossRage = false;
      state.bossDecoyOn = false;

      const bonus = 85;
      setScore(state.score + bonus);
      fxPop(innerWidth/2, innerHeight*0.25, `+${bonus} BOSS BONUS`, 'hha-judge');
      addShield(2);
      addFever(-15);

      bossEmit();
      return;
    }

    // Phase2 enters at half HP
    if(state.bossPhase === 1 && state.bossHp <= Math.ceil(state.bossHpMax * 0.5)){
      state.bossPhase = 2;
      state.bossPhase2Left = 6.0; // your rule
      emit('hha:judge', { label:'PHASE 2!' });
      emit('hha:coach', { msg:'⚡ Phase 2 (6s)! ตอนนี้มี Armor Window + Decoy!', kind:'boss' });

      // enable decoy in phase2
      state.bossDecoyOn = true;
      setBodyFlag('gj-decoy', true);

      // start armor cycle immediately
      state.bossArmorWindowOpen = true;
      state.bossArmorWindowT = state.bossArmorOpenDur;
      state.bossArmorCycleT = 0;
      setBodyFlag('gj-armor', true);

      bossEmit();
    }
  }

  // ----------------------- spawn -----------------------
  function spawnAt(kind, x, y, opts={}){
    if(state.ended) return;
    const id = `t${++targetSeq}`;

    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;

    const baseLife =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='diamond') ? Math.round(DIFF.goodLifeMs * 1.25) :
      (kind==='boss') ? Math.round(DIFF.goodLifeMs * 1.90) :
      (kind==='weak' || kind==='decoy') ? Math.round(DIFF.goodLifeMs * 1.05) :
      Math.round(DIFF.goodLifeMs * 1.2);

    let lifeMs = baseLife;
    if(state.stormOn) lifeMs = Math.round(lifeMs * 0.90);
    if(state.bossOn)  lifeMs = Math.round(lifeMs * (state.bossPhase===2 ? 0.80 : 0.95));
    if(state.bossRage) lifeMs = Math.round(lifeMs * 0.78);

    const sizeBase =
      (kind==='good') ? 54 :
      (kind==='junk') ? 56 :
      (kind==='boss') ? 82 :
      (kind==='weak' || kind==='decoy') ? 68 :
      52;

    const size = clamp(sizeBase + randIn(rng, -3, 10), 44, (kind==='boss'? 112 : 78));

    const elL = DOC.createElement('div');
    elL.className = 'gj-target';
    elL.dataset.id = id;
    elL.dataset.kind = kind;
    elL.textContent = pickEmoji(kind);
    elL.style.left = `${Math.floor(x)}px`;
    elL.style.top  = `${Math.floor(y)}px`;
    elL.style.fontSize = `${Math.floor(size)}px`;
    if(opts?.className) elL.classList.add(opts.className);

    let elR = null;
    if(LAYER_R){
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
    }

    const bornAt = now();
    const tObj = { id, kind, bornAt, lifeMs, x:Math.floor(x), y:Math.floor(y), elL, elR, hit:false, meta:opts?.meta||null };

    elL.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onTargetHit(tObj, { via:'tap', clientX: ev.clientX, clientY: ev.clientY });
    }, { passive:false });

    LAYER_L.appendChild(elL);
    if(elR && LAYER_R) LAYER_R.appendChild(elR);

    state.targets.set(id, tObj);
    return tObj;
  }

  function makeTargetKind(){
    if(state.bossOn) return 'junk';

    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    const starW = DIFF.starRate;
    const shieldW = DIFF.shieldRate;

    const stormBoost = state.stormOn ? 0.06 : 0;
    const junkW = clamp(DIFF.junkRate + stormBoost + (state.bossRage?0.08:0), 0.12, 0.60);
    const goodW = Math.max(0.01, 1 - (junkW + starW + shieldW + diamondW));

    return pickWeighted(rng, [
      {k:'good', w:goodW},
      {k:'junk', w:junkW},
      {k:'star', w:starW},
      {k:'shield', w:shieldW},
      {k:'diamond', w:diamondW},
    ]);
  }

  function spawnOne(){
    if(state.ended) return;
    const kind = makeTargetKind();
    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));
    spawnAt(kind, x, y);
  }

  function removeTarget(tObj){
    if(!tObj) return;
    try{
      tObj.elL?.classList.add('gone');
      tObj.elR?.classList.add('gone');
      setTimeout(()=>{
        try{ tObj.elL?.remove(); }catch(_){}
        try{ tObj.elR?.remove(); }catch(_){}
      }, 140);
    }catch(_){}
    state.targets.delete(tObj.id);
  }

  // ----------------------- RT/metrics -----------------------
  function recordRt(ms){
    if(ms == null) return;
    const v = Math.max(0, Math.floor(ms));
    state.rtGood.push(v);
    if(v < 300) state.rtBreakdown.lt300++;
    else if(v < 450) state.rtBreakdown.lt450++;
    else if(v < 700) state.rtBreakdown.lt700++;
    else state.rtBreakdown.ge700++;
  }

  // ----------------------- mini hooks -----------------------
  function miniOnGoodHit(rtMs){
    const m = state.mini;
    if(!m || m.done) return;

    if(m.type==='streak_good'){
      m.cur++;
      if(m.cur >= m.target){
        m.done = true;
        markMiniCleared();
      }else setMiniText();
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
        }else setMiniText();
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

  // ----------------------- goals -----------------------
  function updateGoalsOnScore(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='score'){
      g.cur = clamp(state.score, 0, g.target);
      if(g.cur >= g.target){
        g.done = true;
        state.goalsCleared++;
        emit('hha:judge', { label:'GOAL!' });
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

  // ----------------------- A) Armor window tick -----------------------
  function tickArmor(dt){
    if(!state.bossOn || state.bossPhase !== 2) return;

    // phase2 clock is 6s but armor continues regardless (keeps intensity)
    // open/close cycle
    if(state.bossArmorWindowOpen){
      state.bossArmorWindowT = Math.max(0, state.bossArmorWindowT - dt);
      if(state.bossArmorWindowT <= 0){
        state.bossArmorWindowOpen = false;
        setBodyFlag('gj-armor', false);
        state.bossArmorCycleT = state.bossArmorCloseDur;
      }
    }else{
      state.bossArmorCycleT = Math.max(0, state.bossArmorCycleT - dt);
      if(state.bossArmorCycleT <= 0){
        state.bossArmorWindowOpen = true;
        state.bossArmorWindowT = state.bossArmorOpenDur;
        setBodyFlag('gj-armor', true);
      }
    }
    bossEmit();
  }

  // ----------------------- B) Decoy penalty -----------------------
  function doDecoyPenalty(x,y){
    if(state.bossDecoyPenaltyCd > 0) return;
    state.bossDecoyPenaltyCd = 1.2; // cooldown

    state.bossStunT = 0.55; // small stun
    bodyPulse('gj-decoy-hit', 220);

    fxPop(x,y,'DECOY!','hha-judge');
    emit('hha:judge', { label:'DECOY!' });
    emit('hha:coach', { msg:'😵 ยิง 🎯 ผิด! โดนโทษ (ขยะโผล่เป็นคลื่น)', kind:'warn' });

    // deterministic penalty wave
    const rect = getSafeRect();
    const n = state.bossRage ? 7 : 5;
    for(let i=0;i<n;i++){
      spawnAt('junk', randIn(rng, rect.xMin, rect.xMax), randIn(rng, rect.yMin, rect.yMax), { className:'fx-decoy' });
    }
  }

  // ----------------------- weakpoint damage -----------------------
  function bossWeakpointDamage(rtMs){
    if(rtMs <= 320) return 3;
    if(rtMs <= 480) return 2;
    return 1;
  }

  // ----------------------- hit logic -----------------------
  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    if(state.bossStunT > 0){
      // stunned: ignore hits (makes decoy punishment meaningful but brief)
      fxPop(meta.clientX ?? tObj.x, meta.clientY ?? tObj.y, 'STUN', 'hha-judge');
      return;
    }

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

      const comboBonus = Math.min(6, Math.floor(state.combo/5));
      const phaseBonus = (state.bossOn && state.bossPhase===2) ? 2 : 0;

      const delta = DIFF.goodScore + comboBonus + phaseBonus;
      setScore(state.score + delta);
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);

      fxBurst(px,py,'good');
      fxPop(px,py,`+${delta}`,'hha-score');
      emit('hha:judge', { label:'GOOD!' });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);
        fxBurst(px,py,'block');
        fxPop(px,py,'BLOCK','hha-judge');
        emit('hha:judge', { label:'BLOCK!' });
      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1));
        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        updateGoalsOnMiss();
        miniOnJunkHit();

        fxBurst(px,py,'bad');
        fxPop(px,py,'OOPS','hha-judge');
        emit('hha:judge', { label:'OOPS!' });
        bodyPulse('gj-junk-hit', 220);
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();
      fxBurst(px,py,'star');
      fxPop(px,py,'MISS -1','hha-judge');
      emit('hha:judge', { label:'STAR!' });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      fxBurst(px,py,'shield');
      fxPop(px,py,'SHIELD +1','hha-judge');
      emit('hha:judge', { label:'SHIELD!' });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();
      fxBurst(px,py,'diamond');
      fxPop(px,py,`+${bonus}`,'hha-score');
      emit('hha:judge', { label:'DIAMOND!' });

    } else if(kind==='boss'){
      resetCombo();
      fxBurst(px,py,'bad');
      fxPop(px,py,'HIT 🎯','hha-judge');
      emit('hha:judge', { label:'WEAKPOINT!' });
      bodyPulse('gj-boss-bonk', 160);

    } else if(kind==='weak'){
      // A) Armor window check (Phase2 only)
      if(state.bossOn && state.bossPhase===2){
        if(!state.bossArmorWindowOpen){
          // blocked
          fxBurst(px,py,'block');
          fxPop(px,py,'ARMOR','hha-judge');
          emit('hha:judge', { label:'ARMOR!' });
          removeTarget(tObj);
          setMiniText();
          return;
        }
      }

      resetCombo();
      fxBurst(px,py,'good');

      const dmg = bossWeakpointDamage(rtMs);
      fxPop(px,py,`-${dmg} HP`,'hha-judge');
      emit('hha:judge', { label:'CRIT!' });

      damageBoss(dmg);

    } else if(kind==='decoy'){
      // B) decoy
      removeTarget(tObj);
      doDecoyPenalty(px,py);
      setMiniText();
      return;
    }

    setMiniText();
    removeTarget(tObj);

    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // cVR/VR shooting
  function shootCrosshair(){
    if(state.ended) return;
    if(state.bossStunT > 0){
      fxPop(innerWidth/2, innerHeight/2, 'STUN', 'hha-judge');
      return;
    }

    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    const R = (isCVR || isVR) ? 86 : 70;
    let best = null;
    let bestD = 1e9;

    for(const t of state.targets.values()){
      if(t.hit) continue;
      const dx = (t.x - cx);
      const dy = (t.y - cy);
      const d = Math.hypot(dx,dy);
      if(d < R && d < bestD){
        bestD = d;
        best = t;
      }
    }

    if(best){
      onTargetHit(best, { via:'shoot', clientX: cx, clientY: cy });
    }else{
      bodyPulse('gj-miss-shot', 120);
    }
  }
  ROOT.addEventListener('hha:shoot', shootCrosshair, { passive:true });

  // ----------------------- expiry -----------------------
  function expireTargets(){
    const t = now();
    for(const tObj of state.targets.values()){
      if(tObj.hit) continue;
      const age = t - tObj.bornAt;
      if(age >= tObj.lifeMs){
        tObj.hit = true;
        const kind = tObj.kind;

        if(kind === 'good'){
          state.nExpireGood++;
          resetCombo();
          addFever(6);
          setMiss(state.miss + 1);
          updateGoalsOnMiss();

          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          fxBurst(tObj.x, tObj.y, 'bad');
          fxPop(tObj.x, tObj.y, 'MISS', 'hha-judge');
          emit('hha:judge', { label:'MISS!' });
          bodyPulse('gj-good-expire', 160);

          if(state.miss >= DIFF.missLimit){
            removeTarget(tObj);
            endGame('miss-limit');
            return;
          }
        }

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
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);
    }

    if(state.stormOn) r *= 1.20;
    if(state.bossOn)  r *= 0.55;
    if(state.bossRage) r *= 1.25;

    if(state.timeLeftSec <= 18) r *= 1.10;
    if(state.timeLeftSec <= 10) r *= 1.12;

    // stun slows spawn a bit
    if(state.bossStunT > 0) r *= 0.75;

    return clamp(r, 0.75, 2.25);
  }

  // ----------------------- waves -----------------------
  function clearSomeTargets(maxRemove=8){
    let c=0;
    for(const tObj of state.targets.values()){
      if(c>=maxRemove) break;
      if(tObj.kind==='boss' || tObj.kind==='weak' || tObj.kind==='decoy') continue;
      removeTarget(tObj);
      c++;
    }
  }

  function spawnStormWave(){
    const rect = getSafeRect();
    const cx = (rect.xMin + rect.xMax)/2;
    const cy = (rect.yMin + rect.yMax)/2;

    state.waveTick++;
    const ring = 6 + (state.waveTick % 2);
    for(let i=0;i<ring;i++){
      const ang = (Math.PI*2) * ((i + (state.waveTick*0.17)) / ring);
      const rx = (rect.xMax-rect.xMin)*0.32;
      const ry = (rect.yMax-rect.yMin)*0.26;
      const x = clamp(cx + Math.cos(ang)*rx + randIn(rng,-18,18), rect.xMin, rect.xMax);
      const y = clamp(cy + Math.sin(ang)*ry + randIn(rng,-18,18), rect.yMin, rect.yMax);
      spawnAt('junk', x, y, { className:'fx-storm' });
    }

    for(let k=0;k<2;k++){
      spawnAt('good',
        randIn(rng, rect.xMin, rect.xMax),
        randIn(rng, rect.yMin, rect.yMax),
        { className:'fx-good' }
      );
    }
    if(rng() < 0.18) spawnAt('star', randIn(rng, rect.xMin, rect.xMax), randIn(rng, rect.yMin, rect.yMax));
  }

  function spawnBossWave(dt){
    state.bossNextWaveIn -= dt;
    if(state.bossNextWaveIn > 0) return;

    const rect = getSafeRect();
    const cx = (rect.xMin + rect.xMax)/2;
    const cy = (rect.yMin + rect.yMax)/2;

    const rage = state.bossRage;
    const p2 = (state.bossPhase===2);

    clearSomeTargets(rage ? 10 : 7);

    // boss core
    spawnAt('boss', cx, cy, { className:'boss-core' });

    // real weakpoint
    const wob = p2 ? 0.28 : 0.22;
    const dx = (rect.xMax-rect.xMin)*wob * (rng()*2-1);
    const dy = (rect.yMax-rect.yMin)*wob * (rng()*2-1);
    spawnAt('weak',
      clamp(cx+dx, rect.xMin, rect.xMax),
      clamp(cy+dy, rect.yMin, rect.yMax),
      { className:'boss-weak' }
    );

    // B) decoy weakpoint in phase2
    if(p2 && state.bossDecoyOn){
      const ddx = (rect.xMax-rect.xMin)*wob * (rng()*2-1);
      const ddy = (rect.yMax-rect.yMin)*wob * (rng()*2-1);
      spawnAt('decoy',
        clamp(cx+ddx, rect.xMin, rect.xMax),
        clamp(cy+ddy, rect.yMin, rect.yMax),
        { className:'boss-decoy' }
      );
    }

    // pressure targets
    const junkN = rage ? (p2? 10 : 8) : (p2? 8 : 6);
    const goodN = rage ? (p2? 2 : 3) : (p2? 3 : 4);

    for(let i=0;i<junkN;i++){
      spawnAt('junk',
        randIn(rng, rect.xMin, rect.xMax),
        randIn(rng, rect.yMin, rect.yMax),
        { className: rage ? 'fx-rage' : 'fx-boss' }
      );
    }

    for(let i=0;i<goodN;i++){
      spawnAt('good',
        randIn(rng, rect.xMin, rect.xMax),
        randIn(rng, rect.yMin, rect.yMax),
        { className:'fx-good' }
      );
    }

    if(p2 && rng() < 0.35) spawnAt('shield', randIn(rng, rect.xMin, rect.xMax), randIn(rng, rect.yMin, rect.yMax));
    if(rage && rng() < 0.10) spawnAt('star', randIn(rng, rect.xMin, rect.xMax), randIn(rng, rect.yMin, rect.yMax));

    // next wave timing
    const base = p2 ? 0.85 : 1.05;
    const rageMul = rage ? 0.78 : 1.0;
    state.bossNextWaveIn = clamp(base*rageMul, 0.55, 1.25);
  }

  // ----------------------- C) Fair Assist (deterministic) -----------------------
  function tickAssist(dt){
    if(state.assistCd > 0) state.assistCd = Math.max(0, state.assistCd - dt);
    if(state.assistBudget <= 0) return;
    if(state.assistCd > 0) return;

    // struggle signal (deterministic from state only)
    const missRate = state.miss / Math.max(1, DIFF.missLimit);
    const lowScore = state.score < (diff==='easy'? 180 : diff==='hard'? 220 : 200);
    const late = state.timeLeftSec <= 40;

    // gate steps: drop at miss>=3, then miss>=6, then miss>=8 (or close to limit)
    const gates = [3, 6, Math.max(8, DIFF.missLimit-2)];
    while(state.assistGateStep < gates.length && state.miss < gates[state.assistGateStep]) return;

    // only when it "feels needed"
    if(!(missRate >= 0.35 || (late && lowScore))) return;

    // deterministic choice: alternate shield/star, avoid over-helping in rage
    const rect = getSafeRect();
    const x = randIn(rng, rect.xMin, rect.xMax);
    const y = randIn(rng, rect.yMin, rect.yMax);

    const wantShield = (state.assistGateStep % 2 === 0);
    const kind = (state.bossRage && wantShield) ? 'shield' : (wantShield ? 'shield' : 'star');

    spawnAt(kind, x, y, { className:'fx-assist' });
    emit('hha:coach', { msg:`🎁 BONUS DROP! (${kind==='shield'?'🛡️':'⭐'})`, kind:'tip' });

    state.assistBudget--;
    state.assistGateStep++;
    state.assistCd = 6.0; // spacing
  }

  // ----------------------- end game summary (same style) -----------------------
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
  function gradeFrom(score, miss){
    if(miss <= 2 && score >= 520) return 'S';
    if(miss <= 4 && score >= 460) return 'A';
    if(miss <= 6 && score >= 380) return 'B';
    if(miss <= 8 && score >= 300) return 'C';
    return 'D';
  }

  function showEndOverlay(summary){
    const ov = DOC.createElement('div');
    ov.id = 'hhaEndOverlay';
    ov.style.cssText = `
      position:fixed; inset:0; z-index:220;
      display:flex; align-items:center; justify-content:center;
      background: rgba(2,6,23,.86); backdrop-filter: blur(10px);
      padding: calc(18px + var(--sat)) 16px calc(18px + var(--sab));
    `;
    const card = DOC.createElement('div');
    card.style.cssText = `
      width:min(760px, 94vw);
      background: rgba(2,6,23,.84);
      border:1px solid rgba(148,163,184,.22);
      border-radius: 22px;
      padding:18px;
      box-shadow: 0 18px 55px rgba(0,0,0,.45);
      color:#e5e7eb;
      font-family: system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
    `;

    const grade = summary.grade || '-';
    const reason = summary.reason || '';

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;">
        <div>
          <div style="font-size:22px;font-weight:1200;">สรุปผล — GoodJunkVR</div>
          <div style="margin-top:6px;color:#94a3b8;font-weight:900;font-size:12px;">
            view=${deviceLabel(view)} | run=${runMode} | diff=${diff} | seed=${String(seed).slice(0,18)}
          </div>
        </div>
        <div style="font-size:56px;font-weight:1300;line-height:1;">${grade}</div>
      </div>

      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.20);border-radius:18px;padding:12px;">
          <div style="color:#94a3b8;font-weight:1000;font-size:12px;">SCORE</div>
          <div style="font-size:26px;font-weight:1200;">${summary.scoreFinal ?? 0}</div>
          <div style="margin-top:10px;color:#94a3b8;font-weight:1000;font-size:12px;">MISS</div>
          <div style="font-size:22px;font-weight:1200;">${summary.misses ?? 0}</div>
        </div>

        <div style="background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.20);border-radius:18px;padding:12px;">
          <div style="color:#94a3b8;font-weight:1000;font-size:12px;">GOAL / MINI</div>
          <div style="font-size:16px;font-weight:1100;margin-top:4px;">
            Goals: ${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}<br/>
            Mini : ${summary.miniCleared ?? 0}/${summary.miniTotal ?? 0}
          </div>
          <div style="margin-top:10px;color:#94a3b8;font-weight:1000;font-size:12px;">REACT (ms)</div>
          <div style="font-size:14px;font-weight:1000;margin-top:4px;">
            avg: ${summary.avgRtGoodMs ?? '-'} | med: ${summary.medianRtGoodMs ?? '-'}<br/>
            fast%: ${summary.fastHitRatePct ?? '-'} | acc%: ${summary.accuracyGoodPct ?? '-'}
          </div>
        </div>
      </div>

      <div style="margin-top:10px;color:#94a3b8;font-weight:900;font-size:12px;">
        reason: <b style="color:#e5e7eb">${reason}</b>
      </div>

      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="btnReplay" type="button" style="
          flex:1; min-width:220px; height:54px; border-radius:16px;
          border:1px solid rgba(34,197,94,.35);
          background: rgba(34,197,94,.16); color:#eafff3;
          font-weight:1200; font-size:16px; cursor:pointer;
        ">เล่นอีกครั้ง</button>

        <button id="btnBackHub" type="button" style="
          flex:1; min-width:220px; height:54px; border-radius:16px;
          border:1px solid rgba(148,163,184,.22);
          background: rgba(2,6,23,.55); color:#e5e7eb;
          font-weight:1200; font-size:16px; cursor:pointer;
        ">กลับ HUB</button>
      </div>
    `;

    ov.appendChild(card);
    DOC.body.appendChild(ov);

    byId('btnReplay')?.addEventListener('click', ()=> location.reload());
    byId('btnBackHub')?.addEventListener('click', ()=>{
      try{
        if(hub) location.href = hub;
        else alert('ยังไม่ได้ใส่ hub url');
      }catch(_){}
    });
  }

  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

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

      nHitGood: state.nHitGood,
      nHitJunk: state.nHitJunk,
      nHitJunkGuard: state.nHitJunkGuard,
      nExpireGood: state.nExpireGood,

      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs,
      medianRtGoodMs,
      fastHitRatePct,

      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,

      grade,
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}

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
      nHitGood: summary.nHitGood,
      nHitJunk: summary.nHitJunk,
      nHitJunkGuard: summary.nHitJunkGuard,
      nExpireGood: summary.nExpireGood,
      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs,
      medianRtGoodMs,
      fastHitRatePct,
      reason,
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,
    });

    emit('hha:celebrate', { kind:'end', grade });
    fxCelebrate('end');

    showEndOverlay(summary);
  }

  // ----------------------- init -----------------------
  function initHud(){
    setScore(0);
    setMiss(0);
    setTimeLeft(durationPlannedSec);
    setGradeText('—');
    addFever(0);
    renderShield();

    state.goals = makeGoals();
    state.goal = state.goals[0];
    setGoalText();

    state.miniSeq = pickMiniSequence(view);
    state.miniIndex = 0;
    state.mini = state.miniSeq[state.miniIndex];
    resetMini(state.mini);
    setMiniText();

    emit('quest:update', { goal: state.goal, mini: state.mini });
    bossEmit();
  }

  function start(){
    if(state.started) return;
    state.started = true;
    state.tStart = now();
    state.startTimeIso = new Date().toISOString();

    initHud();

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

  // ----------------------- main loop -----------------------
  let lastTick = 0;

  function tick(){
    if(state.ended) return;

    const t = now();
    if(!lastTick) lastTick = t;
    const dt = Math.min(0.05, (t - lastTick) / 1000);
    lastTick = t;

    // time
    state.timeLeftSec -= dt;
    if(state.timeLeftSec < 0) state.timeLeftSec = 0;
    setTimeLeft(state.timeLeftSec);
    updateLowTimeFx();

    // storm
    if(!state.stormOn && state.timeLeftSec <= 30) startStorm();

    // boss
    if(!state.bossOn && state.miss >= 4) startBoss();

    // rage
    if(state.bossOn) setRage(state.miss >= 5);

    // phase2 countdown (6s)
    if(state.bossOn && state.bossPhase === 2 && state.bossPhase2Left > 0){
      state.bossPhase2Left = Math.max(0, state.bossPhase2Left - dt);
      bossEmit();
    }

    // stun & decoy cooldown
    if(state.bossStunT > 0) state.bossStunT = Math.max(0, state.bossStunT - dt);
    if(state.bossDecoyPenaltyCd > 0) state.bossDecoyPenaltyCd = Math.max(0, state.bossDecoyPenaltyCd - dt);

    // A) armor cycle tick
    tickArmor(dt);

    // mini tick
    tickMini(dt);

    // C) fair assist tick
    tickAssist(dt);

    // spawn background targets
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.10) spawnOne();
    }

    // storm deterministic wave
    if(state.stormOn && !state.bossOn){
      const bucket = Math.floor(state.timeLeftSec);
      if(bucket % 3 === 0 && (Math.abs((state.timeLeftSec - bucket)) < 0.03)){
        spawnStormWave();
      }
    }

    // boss waves
    if(state.bossOn){
      spawnBossWave(dt);
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

  // start now
  start();

  // expose debug
  ROOT.__GJ_STATE__ = state;
}