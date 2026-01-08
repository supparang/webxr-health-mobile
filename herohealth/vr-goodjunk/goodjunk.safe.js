// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + BOSS DIRECTOR A+B+C)
// ✅ STORM: timeLeft<=30
// ✅ BOSS: miss>=4 (2 phases + weakpoint)
// ✅ RAGE: miss>=5 (harder boss + decoys)
// ✅ Fair: boss is beatable, phase2 requires weakpoint, no instant-kill penalties

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
    try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function log(detail){
    try{ emit('hha:log', detail); }catch(_){}
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
  function fxScorePop(x,y,text){
    const P = fx();
    try{
      if(P && typeof P.scorePop==='function') P.scorePop(x,y,text);
      else if(P && typeof P.popText==='function') P.popText(x,y,text,'score');
    }catch(_){}
  }
  function fxBurst(x,y,kind='good'){
    const P = fx();
    try{
      if(P && typeof P.burstAt==='function') P.burstAt(x,y,kind);
      else if(P && typeof P.burst==='function') P.burst(x,y,{r:56});
    }catch(_){}
  }
  function fxShock(x,y,r=64){
    const P = fx();
    try{
      if(P && typeof P.shockwave==='function') P.shockwave(x,y,{r});
      else fxBurst(x,y,'good');
    }catch(_){}
  }
  function fxCelebrate(){
    const P = fx();
    try{
      if(P && typeof P.celebrate==='function') P.celebrate();
    }catch(_){}
  }
  function bodyPulse(cls, ms=180){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms);
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

  const studyId = payload.studyId ?? qs('studyId', qs('study', null));
  const phase = payload.phase ?? qs('phase', null);
  const conditionGroup = payload.conditionGroup ?? qs('conditionGroup', qs('cond', null));

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-08_BOSS_ABC';
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

    // optional bossbar
    bossBar: byId('gjBossBar'),
    bossFill: byId('gjBossFill'),
    bossPhase: byId('gjBossPhase'),
    bossName: byId('gjBossName'),
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
    goals: null,
    goalsCleared: 0,
    goalsTotal: 3,

    mini: null,
    miniCleared: 0,
    miniTotal: 3,
    miniSeq: [],
    miniIndex: 0,

    spawnAcc: 0,
    targets: new Map(), // id => targetObj

    // --------- DIRECTOR STATES (A+B+C) ----------
    stormOn: false,
    bossOn: false,
    rageOn: false,
    boss: null,       // boss object
    bossTimer: 0,     // seconds remaining for boss window

    // session
    sessionId: null,
    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  // ----------------------- fast mini config (เดิม) -----------------------
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

  // ----------------------- quests (เดิมของคุณ) -----------------------
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
    if(state.goal && state.goal.type==='minis'){
      state.goal.cur = clamp(state.miniCleared, 0, state.goal.target);
      if(state.goal.cur >= state.goal.target && !state.goal.done){
        state.goal.done = true;
        state.goalsCleared++;
        emit('hha:judge', { type:'good', label:'GOAL!' });
      }
      setGoalText();
    }
    emit('hha:judge', { type:'perfect', label:'MINI CLEAR!' });
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
      if(HUD.lowTimeOverlay) HUD.lowTimeOverlay.setAttribute('aria-hidden','true');
    }
  }

  // ----------------------- playfield safe spawn -----------------------
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
    const yMax = Math.floor(Math.max(yMin + 140, H - botSafe));

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
    boss: ['🦠','👾','🧟','🪳'],
    weak: ['⭐'],
    decoy: ['🫧','💢'],
  };

  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  function makeTargetKind(){
    // during boss: reduce normal clutter a bit, still spawn some
    const inBoss = state.bossOn;
    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    const starW = inBoss ? DIFF.starRate*0.65 : DIFF.starRate;
    const shieldW = inBoss ? DIFF.shieldRate*0.75 : DIFF.shieldRate;
    const junkW = inBoss ? DIFF.junkRate*0.85 : DIFF.junkRate;
    const goodW = Math.max(0.01, 1 - (junkW + starW + shieldW + diamondW));
    return pickWeighted(rng, [
      {k:'good', w:goodW},
      {k:'junk', w:junkW},
      {k:'star', w:starW},
      {k:'shield', w:shieldW},
      {k:'diamond', w:diamondW},
    ]);
  }

  function spawnDomTarget({kind,x,y,size,lifeMs,cssExtra=''}) {
    const id = `t${++targetSeq}`;

    const elL = DOC.createElement('div');
    elL.className = `gj-target spawn ${cssExtra}`.trim();
    elL.dataset.id = id;
    elL.dataset.kind = kind;
    elL.textContent = pickEmoji(kind);
    elL.style.left = `${x}px`;
    elL.style.top  = `${y}px`;
    elL.style.fontSize = `${size}px`;

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
    return tObj;
  }

  function spawnOne(){
    if(state.ended) return;

    // if boss is active, sometimes prioritize weak/decoy from director tick (not here)
    const kind = makeTargetKind();

    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;

    const lifeMs =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      Math.round(DIFF.goodLifeMs * 1.25);

    const baseSize = (kind==='good') ? 54 : (kind==='junk') ? 56 : 50;
    const size = clamp(baseSize + randIn(rng, -4, 10), 44, 72);

    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

    spawnDomTarget({ kind, x, y, size, lifeMs });
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

  // ----------------------- RT helpers -----------------------
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
      }else setMiniText();
      return;
    }

    if(m.type==='fast_hits'){
      const thr = Number(m.thrMs)||450;
      if(rtMs!=null && rtMs<=thr){
        m.cur++;
        if(m.cur >= m.target){
          m.done = true;
          emit('hha:judge', { type:'perfect', label:'FAST PASS!' });
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

  // ----------------------- goal updates -----------------------
  function updateGoalsOnScore(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='score'){
      g.cur = clamp(state.score, 0, g.target);
      if(g.cur >= g.target){
        g.done = true;
        state.goalsCleared++;
        emit('hha:judge', { type:'perfect', label:'GOAL!' });
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

  // ----------------------- DIRECTOR (C) : STORM/BOSS/RAGE controller -----------------------
  function setDirectorClasses(){
    DOC.body.classList.toggle('gj-storm', !!state.stormOn);
    DOC.body.classList.toggle('gj-boss',  !!state.bossOn);
    DOC.body.classList.toggle('gj-rage',  !!state.rageOn);

    if(HUD.bossBar){
      HUD.bossBar.setAttribute('aria-hidden', state.bossOn ? 'false' : 'true');
      HUD.bossBar.style.display = state.bossOn ? 'block' : 'none';
    }
  }

  function bossConfig(){
    // fairness: boss window and hp depend on diff + rage
    const base = (diff==='easy') ? {hp:10, win:14} : (diff==='hard') ? {hp:14, win:13} : {hp:12, win:13};
    if(state.rageOn){
      return { hp: base.hp + 4, win: base.win + 1 };
    }
    return base;
  }

  function bossBarUpdate(){
    if(!state.bossOn || !state.boss) return;
    const b = state.boss;
    if(HUD.bossFill){
      const pct = clamp((b.hp / Math.max(1,b.hpMax))*100, 0, 100);
      HUD.bossFill.style.width = pct + '%';
    }
    if(HUD.bossPhase){
      HUD.bossPhase.textContent = (b.phase===2) ? 'Phase 2 · ยิง ⭐ เท่านั้น' : 'Phase 1 · ยิงได้';
    }
    if(HUD.bossName){
      HUD.bossName.textContent = state.rageOn ? 'RAGE BOSS' : 'BOSS';
    }
  }

  function startBoss(){
    if(state.bossOn || state.ended) return;

    state.bossOn = true;
    state.rageOn = (state.miss >= 5);
    state.stormOn = (state.timeLeftSec <= 30); // can be both storm + boss

    const cfg = bossConfig();
    const rect = getSafeRect();
    const x = Math.floor((rect.xMin + rect.xMax)/2);
    const y = Math.floor((rect.yMin + rect.yMax)/2);

    // boss object
    const bossT = spawnDomTarget({
      kind:'boss',
      x, y,
      size: 86,
      lifeMs: 999999,
      cssExtra: `boss ${state.rageOn?'rage':''}`.trim()
    });

    state.boss = {
      id: bossT.id,
      t: bossT,
      hpMax: cfg.hp,
      hp: cfg.hp,
      phase: 1,
      vx: randIn(rng,-1,1) * (state.rageOn ? 62 : 46), // px/sec
      vy: randIn(rng,-1,1) * (state.rageOn ? 52 : 38),
      weak: null,      // weakpoint target object
      weakCd: 0,
      weakLife: 0,
      decoyCd: 0,
    };

    state.bossTimer = cfg.win;

    emit('hha:coach', { kind:'warn', msg: state.rageOn ? '😈 RAGE! บอสโหดขึ้น! เล็ง ⭐ ให้ดี!' : '👾 บอสมา! ยิงเพื่อลด HP แล้ว Phase 2 ต้องยิง ⭐' });
    emit('hha:judge', { type:'bad', label:'BOSS!' });

    setDirectorClasses();
    bossBarUpdate();
  }

  function endBoss(reason='boss-end'){
    if(!state.bossOn) return;

    // cleanup boss/weak/decoys
    try{
      const b = state.boss;
      if(b?.weak) removeTarget(b.weak);
      if(b?.t) removeTarget(b.t);
    }catch(_){}
    state.boss = null;
    state.bossOn = false;
    state.rageOn = false;

    setDirectorClasses();

    // small reward for beating boss (fair)
    if(reason === 'boss-defeat'){
      addShield(1);
      addFever(-12);
      setScore(state.score + 25);
      fxCelebrate();
      emit('hha:celebrate', { kind:'boss' });
      emit('hha:judge', { type:'perfect', label:'BOSS DOWN!' });
    } else if(reason === 'boss-timeout'){
      // fair penalty: +1 miss only (not game over)
      setMiss(state.miss + 1);
      updateGoalsOnMiss();
      emit('hha:judge', { type:'miss', label:'BOSS ESCAPED!' });
      fxShock(innerWidth/2, innerHeight/2, 78);
    }
  }

  function spawnWeakPoint(){
    const b = state.boss;
    if(!b || !b.t) return;

    // place weakpoint near boss (offset)
    const ox = randIn(rng, -56, 56);
    const oy = randIn(rng, -46, 46);

    const x = clamp(b.t.x + ox, 40, DOC.documentElement.clientWidth-40);
    const y = clamp(b.t.y + oy, 80, DOC.documentElement.clientHeight-80);

    const weak = spawnDomTarget({
      kind:'weak',
      x, y,
      size: 44,
      lifeMs: 900, // short
      cssExtra: 'weak'
    });

    b.weak = weak;
    b.weakLife = 0.9;
  }

  function spawnDecoy(){
    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));
    const d = spawnDomTarget({
      kind:'decoy',
      x,y,
      size: 42,
      lifeMs: 900,
      cssExtra: ''
    });
    d.elL.textContent = pickEmoji('decoy');
    if(d.elR) d.elR.textContent = d.elL.textContent;
  }

  function bossTick(dt){
    if(!state.bossOn || !state.boss) return;

    const b = state.boss;
    state.bossTimer -= dt;

    // move boss within safe rect
    const rect = getSafeRect();
    const speedMul = state.rageOn ? 1.15 : 1.0;
    let nx = b.t.x + b.vx * dt * speedMul;
    let ny = b.t.y + b.vy * dt * speedMul;

    const padX = 70, padY = 90;
    const minX = rect.xMin + padX;
    const maxX = rect.xMax - padX;
    const minY = rect.yMin + padY;
    const maxY = rect.yMax - padY;

    if(nx < minX){ nx = minX; b.vx = Math.abs(b.vx); }
    if(nx > maxX){ nx = maxX; b.vx = -Math.abs(b.vx); }
    if(ny < minY){ ny = minY; b.vy = Math.abs(b.vy); }
    if(ny > maxY){ ny = maxY; b.vy = -Math.abs(b.vy); }

    // write position (boss)
    b.t.x = nx; b.t.y = ny;
    b.t.elL.style.left = nx + 'px';
    b.t.elL.style.top  = ny + 'px';
    if(b.t.elR){
      b.t.elR.style.left = nx + 'px';
      b.t.elR.style.top  = ny + 'px';
    }

    // weakpoint lifetime
    if(b.weak){
      b.weakLife -= dt;
      if(b.weakLife <= 0){
        removeTarget(b.weak);
        b.weak = null;
      }
    }

    // spawn weakpoint rhythm
    b.weakCd -= dt;
    const weakGap = (b.phase===2 ? (state.rageOn?0.55:0.72) : (state.rageOn?0.85:1.05));
    if(!b.weak && b.weakCd <= 0){
      spawnWeakPoint();
      b.weakCd = weakGap;
    }

    // rage decoys
    if(state.rageOn){
      b.decoyCd -= dt;
      if(b.decoyCd <= 0){
        spawnDecoy();
        b.decoyCd = 1.15;
      }
    }

    // phase transition
    if(b.phase===1 && b.hp <= Math.ceil(b.hpMax*0.55)){
      b.phase = 2;
      b.t.elL.classList.add('phase2');
      if(b.t.elR) b.t.elR.classList.add('phase2');
      emit('hha:judge', { type:'bad', label:'PHASE 2!' });
      emit('hha:coach', { kind:'tip', msg:'⭐ Phase 2: ยิงเฉพาะ ⭐ จุดอ่อน!' });
      fxShock(b.t.x, b.t.y, 86);
    }

    bossBarUpdate();

    // timeout end (fair penalty)
    if(state.bossTimer <= 0){
      endBoss('boss-timeout');
    }
  }

  // ----------------------- hit logic -----------------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){ state.combo = 0; }

  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    tObj.hit = true;

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

    const px = meta.clientX ?? tObj.x;
    const py = meta.clientY ?? tObj.y;

    // -------- boss/weak/decoy handling ----------
    if(kind === 'weak'){
      // weakpoint = heavy damage (phase2 main)
      const b = state.boss;
      if(b){
        b.hp -= state.rageOn ? 3 : 2;
        fxShock(px,py, 76);
        fxScorePop(px,py, '⭐ CRIT');
        emit('hha:judge', { type:'perfect', label:'CRIT!' });

        if(b.hp <= 0){
          endBoss('boss-defeat');
        } else bossBarUpdate();
      }
      removeTarget(tObj);
      return;
    }

    if(kind === 'boss'){
      const b = state.boss;
      if(b){
        if(b.phase === 1){
          b.hp -= 1;
          fxShock(px,py, 66);
          fxScorePop(px,py, '-HP');
          emit('hha:judge', { type:'good', label:'HIT!' });
          if(b.hp <= 0) endBoss('boss-defeat');
          else bossBarUpdate();
        } else {
          // phase2: boss body hit does nothing (fair, no punishment)
          fxBurst(px,py,'block');
          fxScorePop(px,py,'⭐');
          emit('hha:judge', { type:'block', label:'AIM ⭐' });
        }
      }
      // do NOT remove boss target
      tObj.hit = false;
      return;
    }

    if(kind === 'decoy'){
      // harmless pop (no penalty)
      fxBurst(px,py,'star');
      fxScorePop(px,py,'POOF');
      emit('hha:judge', { type:'good', label:'OK' });
      removeTarget(tObj);
      return;
    }

    // -------- normal (เดิมของคุณ) ----------
    if(kind==='good'){
      state.nHitGood++;
      addCombo();
      addFever(3.2);
      const delta = DIFF.goodScore + Math.min(6, Math.floor(state.combo/5));
      setScore(state.score + delta);
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);
      fxBurst(px,py,'good');
      fxScorePop(px,py,`+${delta}`);
      emit('hha:judge', { type:'good', label:'GOOD!' });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);
        fxBurst(px,py,'block');
        fxScorePop(px,py,'BLOCK');
        emit('hha:judge', { type:'block', label:'BLOCK!' });
      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);
        setMiss(state.miss + (DIFF.junkPenaltyMiss||1));
        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        updateGoalsOnMiss();
        miniOnJunkHit();
        fxBurst(px,py,'bad');
        fxScorePop(px,py,'-');
        emit('hha:judge', { type:'bad', label:'OOPS!' });
        bodyPulse('gj-junk-hit', 220);
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();
      fxBurst(px,py,'star');
      fxScorePop(px,py,'MISS -1');
      emit('hha:judge', { type:'good', label:'STAR!' });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      fxBurst(px,py,'shield');
      fxScorePop(px,py,'SHIELD +1');
      emit('hha:judge', { type:'good', label:'SHIELD!' });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();
      fxBurst(px,py,'diamond');
      fxScorePop(px,py,`+${bonus}`);
      emit('hha:judge', { type:'perfect', label:'DIAMOND!' });
    }

    setMiniText();
    removeTarget(tObj);

    // director triggers (BOSS/RAGE)
    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // cVR shooting
  function shootCrosshair(){
    if(state.ended) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    const R = (isCVR || isVR) ? 92 : 76;
    let best = null;
    let bestD = 1e9;

    for(const t of state.targets.values()){
      // allow boss/weak etc
      if(t.hit && t.kind !== 'boss') continue;
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

  // ----------------------- expiry tick -----------------------
  function expireTargets(){
    const t = now();
    for(const tObj of state.targets.values()){
      if(tObj.kind==='boss') continue; // never expire boss here
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
          fxScorePop(tObj.x, tObj.y, 'MISS');
          emit('hha:judge', { type:'miss', label:'MISS!' });
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

  // ----------------------- spawn rate (เพิ่ม director factor) -----------------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);

      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.15;
    }

    // STORM: extra excitement
    if(state.stormOn) r *= 1.18;

    // BOSS: reduce clutter slightly so it's fair
    if(state.bossOn) r *= 0.88;

    // RAGE: bring some chaos back
    if(state.rageOn) r *= 1.06;

    return clamp(r, 0.75, 2.15);
  }

  // ----------------------- grading / summary (เดิมของคุณ) -----------------------
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
    // (ใช้ของเดิมคุณได้เลย — ผมไม่แตะเพื่อให้สั้น)
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
      if(hub) location.href = hub;
      else alert('ยังไม่ได้ใส่ hub url');
    });
  }

  // ----------------------- end game -----------------------
  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    // end boss if active
    if(state.bossOn) endBoss('boss-end');

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

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
      nHitGood: state.nHitGood,
      nHitJunk: state.nHitJunk,
      nHitJunkGuard: state.nHitJunkGuard,
      nExpireGood: state.nExpireGood,
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

    emit('hha:end', Object.assign({}, summary, {
      view,
      studyId, phase, conditionGroup
    }));

    emit('hha:celebrate', { kind:'end', grade });
    showEndOverlay(summary);
  }

  // ----------------------- main loop -----------------------
  let lastTick = 0;

  function directorTick(dt){
    // STORM rule
    const shouldStorm = (state.timeLeftSec <= 30);

    // BOSS + RAGE rules
    const shouldBoss = (state.miss >= 4);
    const shouldRage = (state.miss >= 5);

    state.stormOn = shouldStorm;

    if(shouldRage) state.rageOn = true;

    // start boss once when crossing miss>=4
    if(shouldBoss && !state.bossOn){
      startBoss();
    }

    setDirectorClasses();
  }

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

    // director
    directorTick(dt);

    // boss tick
    bossTick(dt);

    // mini tick
    tickMini(dt);

    // spawn
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.12) spawnOne();
    }

    // expiry
    expireTargets();

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
      msg: 'ทริค: อย่าแตะขยะ! ถ้าเห็น ⭐ แตะเพื่อลด MISS และ 🛡️ เพื่อกันขยะได้',
      kind: 'tip'
    });

    requestAnimationFrame(tick);
  }

  start();

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

  ROOT.__GJ_STATE__ = state;
}