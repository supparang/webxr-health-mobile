// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + Boss++ A+B+C)
// ✅ Mobile / PC / VR(Cardboard) / cVR
// ✅ HUD-safe spawn via CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as Miss
// ✅ Storm rule: timeLeft <= 30s => STORM ON (once), ends when boss ends or game ends
// ✅ Boss rule: miss >= 4 => BOSS ON (HP by diff: 10/12/14)
// ✅ Rage rule: miss >= 5 => RAGE ON (until end)
// ✅ Boss Phase2 lasts 6s then returns to Phase1 if not cleared
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:storm, hha:boss, hha:end, hha:celebrate
// ✅ End summary: uses HTML #endOverlay via aria-hidden ONLY (NO dynamic overlay creation)
// ✅ Save last summary: HHA_LAST_SUMMARY

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

  // particles (optional) — supports both minimal and ultra implementations
  function fx(){
    return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles || null;
  }
  function fxPop(x,y,text,cls=null,opts=null){
    const P = fx();
    try{
      if(P && typeof P.popText==='function') P.popText(x,y,text,cls,opts);
      else if(P && typeof P.scorePop==='function') P.scorePop(x,y,text);
    }catch(_){}
  }
  function fxBurst(x,y,kind='good',opts=null){
    const P = fx();
    try{ if(P && typeof P.burstAt==='function') P.burstAt(x,y,kind,opts); }catch(_){}
  }
  function fxRing(x,y,kind='good',opts=null){
    const P = fx();
    try{ if(P && typeof P.ringPulse==='function') P.ringPulse(x,y,kind,opts); }catch(_){}
  }
  function fxCelebrate(kind='win', opts=null){
    const P = fx();
    try{ if(P && typeof P.celebrate==='function') P.celebrate(kind, opts); }catch(_){}
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

  // logger study params
  const studyId = payload.studyId ?? qs('studyId', qs('study', null));
  const phase = payload.phase ?? qs('phase', null);
  const conditionGroup = payload.conditionGroup ?? qs('conditionGroup', qs('cond', null));

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-13b';
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
      bossHpMax: 10, // ✅ HP 10
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
      bossHpMax: 14, // ✅ HP 14
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
      bossHpMax: 12, // ✅ HP 12
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

    // HTML end overlay ids (HHA Standard)
    endOverlay: byId('endOverlay'),
    endTitle: byId('endTitle'),
    endSub: byId('endSub'),
    endGrade: byId('endGrade'),
    endScore: byId('endScore'),
    endMiss: byId('endMiss'),
    endTime: byId('endTime'),
    endBackHub: byId('endBackHub') || byId('btnBackHub'),
    endReplay: byId('endReplay') || byId('btnRestartEnd'),
  };

  const LAYER_L = byId('gj-layer');
  const LAYER_R = byId('gj-layer-r');

  // ----------------------- safety checks -----------------------
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

    // misses (good expired + junk hit)
    miss: 0,

    // counts
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetShieldSpawned: 0,
    nTargetDiamondSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    // reaction times
    rtGood: [],
    rtBreakdown: { lt300:0, lt450:0, lt700:0, ge700:0 },

    // fever / shield
    fever: 0,
    shield: 0,

    // quest
    goals: [],
    goal: null,
    goalsCleared: 0,
    goalsTotal: 3,

    mini: null,
    miniCleared: 0,
    miniTotal: 3,
    miniSeq: [],
    miniIndex: 0,

    // spawn
    spawnAcc: 0,
    targets: new Map(), // id => tObj

    // boss / storm / rage (A+B+C)
    stormOn: false,
    bossOn: false,
    rageOn: false,
    bossHp: 0,
    bossHpMax: DIFF.bossHpMax,
    bossPhase: 0,          // 0 none, 1 P1, 2 P2
    bossPhase2Sec: 6,      // ✅ Phase2 = 6s
    bossPhase2Until: 0,

    // session
    sessionId: null,
    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  // ----------------------- fast mini config -----------------------
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
        emit('hha:judge', { type:'perfect', label:'GOAL!' });
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
        // update sometimes
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

  // ----------------------- HUD / fever / shield -----------------------
  function setScore(v, meta=null){
    state.score = Math.max(0, Math.floor(v));
    HUD.score && (HUD.score.textContent = String(state.score));
    emit('hha:score', Object.assign({ score: state.score }, meta||{}));
  }
  function setMiss(v, meta=null){
    state.miss = Math.max(0, Math.floor(v));
    HUD.miss && (HUD.miss.textContent = String(state.miss));
    emit('hha:miss', Object.assign({ miss: state.miss }, meta||{}));
  }
  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    HUD.time && (HUD.time.textContent = String(Math.ceil(state.timeLeftSec)));
    emit('hha:time', { t: state.timeLeftSec, timeLeftSec: state.timeLeftSec });
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
  };

  function makeTargetKind(){
    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    const starW = DIFF.starRate;
    const shieldW = DIFF.shieldRate;
    const junkW = DIFF.junkRate;

    let junkBoost = 0;
    let goodBoost = 0;

    if(state.stormOn) junkBoost += 0.03;
    if(state.bossOn)  junkBoost += (state.bossPhase===2 ? 0.08 : 0.05);
    if(state.rageOn)  junkBoost += 0.06;
    if(state.bossOn)  goodBoost += 0.02; // keep fair

    const junkAdj = clamp(junkW + junkBoost, 0.08, 0.55);
    const starAdj = clamp(starW + (state.bossOn?0.01:0), 0.02, 0.14);
    const shieldAdj = clamp(shieldW + (state.bossOn?0.01:0), 0.02, 0.14);

    const goodW = Math.max(0.01, 1 - (junkAdj + starAdj + shieldAdj + diamondW));
    const goodAdj = clamp(goodW + goodBoost, 0.20, 0.85);

    return pickWeighted(rng, [
      {k:'good', w:goodAdj},
      {k:'junk', w:junkAdj},
      {k:'star', w:starAdj},
      {k:'shield', w:shieldAdj},
      {k:'diamond', w:diamondW},
    ]);
  }

  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  function spawnOne(){
    if(state.ended) return;

    const kind = makeTargetKind();

    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;

    const id = `t${++targetSeq}`;

    const bossLifeMul = state.bossOn ? (state.bossPhase===2 ? 0.86 : 0.94) : 1.0;
    const rageLifeMul = state.rageOn ? 0.92 : 1.0;

    const lifeMs =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      Math.round(DIFF.goodLifeMs * 1.25);

    const lifeAdj = Math.round(lifeMs * bossLifeMul * rageLifeMul);

    const baseSize = (kind==='good') ? 54 : (kind==='junk') ? 56 : 50;
    const bossSizeMul = state.bossOn ? 0.96 : 1.0;
    const rageSizeMul = state.rageOn ? 0.95 : 1.0;
    const size = clamp((baseSize + randIn(rng, -4, 10)) * bossSizeMul * rageSizeMul, 44, 72);

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

    let elR = null;
    if(LAYER_R){
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
    }

    const bornAt = now();
    const tObj = {
      id, kind,
      bornAt,
      lifeMs: lifeAdj,
      x,y,
      elL,
      elR,
      hit:false,
    };

    elL.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onTargetHit(tObj, { via:'tap', clientX: ev.clientX, clientY: ev.clientY });
    }, { passive:false });

    LAYER_L.appendChild(elL);
    if(elR && LAYER_R) LAYER_R.appendChild(elR);

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
      }, 140);
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
          emit('hha:judge', { type:'perfect', label:'FAST PASS!' });
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

  // ----------------------- Boss / Storm / Rage (A+B+C) -----------------------
  function setStorm(on){
    on = !!on;
    if(on === state.stormOn) return;
    state.stormOn = on;
    emit('hha:storm', { on, t: state.timeLeftSec, phase: on?1:0 });
    emit('hha:judge', { type: on ? 'perfect' : 'good', label: on ? 'STORM!' : 'STORM CLEAR' });
    if(on){
      bodyPulse('gj-storm', 420);
      fxRing(innerWidth/2, innerHeight*0.28, 'star', { size: 220 });
      fxPop(innerWidth/2, innerHeight*0.25, 'STORM!', 'warn', { size: 22 });
    }
  }

  function setBoss(on){
    on = !!on;
    if(on === state.bossOn) return;

    state.bossOn = on;

    if(on){
      state.bossHpMax = DIFF.bossHpMax;
      state.bossHp = state.bossHpMax;
      state.bossPhase = 1;
      state.bossPhase2Until = 0;

      emit('hha:boss', { on:true, hp: state.bossHp, hpMax: state.bossHpMax, phase: state.bossPhase, phase2Sec: state.bossPhase2Sec, rage: state.rageOn });
      emit('hha:judge', { type:'bad', label:'BOSS!' });
      bodyPulse('gj-boss', 520);
      fxRing(innerWidth/2, innerHeight*0.32, 'violet', { size: 260 });
      fxPop(innerWidth/2, innerHeight*0.26, `BOSS! HP ${state.bossHpMax}`, 'violet', { size: 22 });

    }else{
      emit('hha:boss', { on:false, hp: 0, hpMax: state.bossHpMax, phase: 0, rage: state.rageOn });
      emit('hha:celebrate', { kind:'boss' });
      fxCelebrate('boss', { count: 22 });
    }
  }

  function setRage(on){
    on = !!on;
    if(on === state.rageOn) return;
    state.rageOn = on;
    emit('hha:boss', { on: state.bossOn, hp: state.bossHp, hpMax: state.bossHpMax, phase: state.bossPhase, rage: state.rageOn, phase2Sec: state.bossPhase2Sec });
    emit('hha:judge', { type:'bad', label: on ? 'RAGE!' : 'RAGE OFF' });
    if(on){
      bodyPulse('gj-rage', 620);
      fxRing(innerWidth/2, innerHeight*0.30, 'bad', { size: 280 });
      fxPop(innerWidth/2, innerHeight*0.25, 'RAGE!', 'bad', { size: 24 });
    }
  }

  function bossTryEnterPhase2(){
    if(!state.bossOn) return;
    if(state.bossPhase === 2) return;
    const half = Math.ceil(state.bossHpMax * 0.5);
    if(state.bossHp <= half){
      state.bossPhase = 2;
      state.bossPhase2Until = now() + (state.bossPhase2Sec * 1000);
      emit('hha:boss', { on:true, hp: state.bossHp, hpMax: state.bossHpMax, phase: 2, rage: state.rageOn, phase2Sec: state.bossPhase2Sec });
      emit('hha:judge', { type:'bad', label:'PHASE 2!' });
      fxRing(innerWidth/2, innerHeight*0.32, 'bad', { size: 300 });
      fxPop(innerWidth/2, innerHeight*0.26, 'PHASE 2!', 'bad', { size: 22 });
      bodyPulse('gj-phase2', 520);
    }
  }

  function bossTick(){
    if(!state.bossOn) return;
    if(state.bossPhase === 2 && state.bossPhase2Until > 0 && now() >= state.bossPhase2Until){
      state.bossPhase = 1;
      state.bossPhase2Until = 0;
      emit('hha:boss', { on:true, hp: state.bossHp, hpMax: state.bossHpMax, phase: 1, rage: state.rageOn, phase2Sec: state.bossPhase2Sec });
      fxPop(innerWidth/2, innerHeight*0.26, 'BACK TO P1', 'warn', { size: 16 });
    }
  }

  function bossHpDelta(delta, reason=''){
    if(!state.bossOn) return;
    const before = state.bossHp;
    state.bossHp = clamp(state.bossHp + (Number(delta)||0), 0, state.bossHpMax);

    if(state.bossHp !== before){
      emit('hha:boss', { on:true, hp: state.bossHp, hpMax: state.bossHpMax, phase: state.bossPhase, rage: state.rageOn, why: reason, phase2Sec: state.bossPhase2Sec });
      fxPop(innerWidth/2, innerHeight*0.33, `HP ${state.bossHp}/${state.bossHpMax}`, delta<0 ? 'good' : 'bad', { size: 14 });
    }

    bossTryEnterPhase2();

    if(state.bossHp <= 0){
      setBoss(false);
      if(state.stormOn) setStorm(false);
      emit('hha:judge', { type:'perfect', label:'BOSS DOWN!' });
      fxPop(innerWidth/2, innerHeight*0.26, 'BOSS DOWN!', 'good', { size: 22 });
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

    if(kind==='good'){
      state.nHitGood++;
      addCombo();
      addFever(3.2);

      const bossBonus = state.bossOn ? (state.bossPhase===2 ? 2 : 1) : 0;
      const delta = DIFF.goodScore + Math.min(6, Math.floor(state.combo/5)) + bossBonus;

      setScore(state.score + delta, { delta, x:px, y:py });
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);

      fxBurst(px,py,'good');
      fxRing(px,py,'good',{ size: 120 });
      emit('hha:judge', { type:'good', label:'GOOD!', x:px, y:py, combo: state.combo, miss: state.miss });

      if(state.bossOn){
        const dmg = (state.bossPhase===2 ? 2 : 1);
        bossHpDelta(-dmg, 'good-hit');
      }

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);
        fxBurst(px,py,'shield');
        fxRing(px,py,'shield',{ size: 140 });
        fxPop(px,py,'BLOCK','cyan',{ size: 16 });
        emit('hha:judge', { type:'block', label:'BLOCK!', x:px, y:py, combo: state.combo, miss: state.miss });
      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1), { x:px, y:py, deltaMiss: (DIFF.junkPenaltyMiss||1) });
        setScore(state.score + (DIFF.junkPenaltyScore||-10), { delta: (DIFF.junkPenaltyScore||-10), x:px, y:py });

        updateGoalsOnMiss();
        miniOnJunkHit();

        fxBurst(px,py,'bad');
        fxRing(px,py,'bad',{ size: 150 });
        emit('hha:judge', { type:'bad', label:'OOPS!', x:px, y:py, combo: state.combo, miss: state.miss });

        bodyPulse('gj-junk-hit', 220);

        if(state.bossOn){
          const heal = (state.bossPhase===2 ? 2 : 1);
          bossHpDelta(+heal, 'junk-hit');
        }
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      const before = state.miss;
      const after = Math.max(0, state.miss - 1);
      setMiss(after, { x:px, y:py, deltaMiss: after-before });
      updateGoalsOnMiss();

      fxBurst(px,py,'star');
      fxRing(px,py,'star',{ size: 160 });
      fxPop(px,py,'MISS -1','warn',{ size: 16 });
      emit('hha:judge', { type:'perfect', label:'STAR!', x:px, y:py, miss: state.miss });

      if(state.bossOn) bossHpDelta(-1, 'star');

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);

      fxBurst(px,py,'shield');
      fxRing(px,py,'shield',{ size: 160 });
      fxPop(px,py,'SHIELD +1','cyan',{ size: 16 });
      emit('hha:judge', { type:'perfect', label:'SHIELD!', x:px, y:py, miss: state.miss });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);

      const bonus = 35;
      setScore(state.score + bonus, { delta: bonus, x:px, y:py });
      updateGoalsOnScore();

      fxBurst(px,py,'diamond');
      fxRing(px,py,'violet',{ size: 180 });
      emit('hha:judge', { type:'perfect', label:'DIAMOND!', x:px, y:py, miss: state.miss });

      if(state.bossOn) bossHpDelta(-3, 'diamond');
    }

    setMiniText();
    removeTarget(tObj);

    if(!state.bossOn && state.miss >= 4) setBoss(true);
    if(!state.rageOn && state.miss >= 5) setRage(true);

    if(state.miss >= DIFF.missLimit){
      endGame('missLimit');
    }
  }

  // ----------------------- cVR/VR shooting (lockPx-aware) -----------------------
  function shootCrosshair(ev){
    if(state.ended) return;

    const det = ev?.detail || null;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    // use lockPx from vr-ui (fair, user-config)
    const lockPx = Math.max(18, Math.min(110, Number(det?.lockPx ?? 82) || 82));
    const R = (isCVR || isVR) ? lockPx : Math.min(90, lockPx);

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
      emit('hha:judge', { type:'miss', label:'MISS', x:cx, y:cy, miss: state.miss });
    }
  }

  try{ ROOT.removeEventListener('hha:shoot', shootCrosshair); }catch(_){}
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
          state.nExpireGood++;
          resetCombo();
          addFever(6);

          const x = tObj.x, y = tObj.y;
          setMiss(state.miss + 1, { x, y, deltaMiss: 1 });
          updateGoalsOnMiss();

          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          fxBurst(x, y, 'bad');
          fxRing(x, y, 'bad', { size: 170 });
          fxPop(x, y, 'MISS', 'bad', { size: 16 });
          emit('hha:judge', { type:'miss', label:'MISS!', x, y, miss: state.miss });

          bodyPulse('gj-good-expire', 160);

          if(!state.bossOn && state.miss >= 4) setBoss(true);
          if(!state.rageOn && state.miss >= 5) setRage(true);

          if(state.miss >= DIFF.missLimit){
            removeTarget(tObj);
            endGame('missLimit');
            return;
          }
        }

        removeTarget(tObj);
      }
    }
  }

  // ----------------------- spawn scheduler -----------------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);
    }

    if(state.timeLeftSec <= 18) r *= 1.10;
    if(state.timeLeftSec <= 10) r *= 1.15;

    if(state.stormOn) r *= 1.10;
    if(state.bossOn)  r *= (state.bossPhase===2 ? 1.30 : 1.18);
    if(state.rageOn)  r *= 1.18;

    return clamp(r, 0.8, 2.25);
  }

  // ----------------------- grading / summary -----------------------
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

  // ✅ HTML end overlay (aria-only)
  function showEndOverlayHtml(summary){
    const ov = HUD.endOverlay;
    if(!ov) return;

    try{
      HUD.endTitle && (HUD.endTitle.textContent = (summary.reason === 'missLimit') ? 'Game Over' : 'Completed');
      HUD.endSub && (HUD.endSub.textContent = `reason=${summary.reason||'-'} | mode=${summary.runMode||runMode} | view=${summary.device||deviceLabel(view)}`);
      HUD.endGrade && (HUD.endGrade.textContent = summary.grade || '—');
      HUD.endScore && (HUD.endScore.textContent = String(summary.scoreFinal ?? 0));
      HUD.endMiss && (HUD.endMiss.textContent = String(summary.misses ?? 0));
      HUD.endTime && (HUD.endTime.textContent = String(Math.round(Number(summary.durationPlayedSec||0))));

      ov.setAttribute('aria-hidden','false');
      ov.style.display = 'flex'; // safe: many CSS already rely on display none
    }catch(_){}

    // bind buttons (once)
    if(HUD.endReplay && !HUD.endReplay.__hha_bound){
      HUD.endReplay.__hha_bound = true;
      HUD.endReplay.addEventListener('click', ()=>{ try{ location.reload(); }catch(_){ } });
    }
    if(HUD.endBackHub && !HUD.endBackHub.__hha_bound){
      HUD.endBackHub.__hha_bound = true;
      HUD.endBackHub.addEventListener('click', ()=>{
        try{
          if(hub) location.href = hub;
          else alert('ยังไม่ได้ใส่ hub url');
        }catch(_){}
      });
    }
  }

  // ----------------------- end game -----------------------
  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    if(state.stormOn) emit('hha:storm', { on:false, t: state.timeLeftSec });
    if(state.bossOn)  emit('hha:boss', { on:false, hp: state.bossHp, hpMax: state.bossHpMax, phase: state.bossPhase, rage: state.rageOn });

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

    emit('hha:end', Object.assign({
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
      rtBreakdownJson: summary.rtBreakdownJson,
      reason,
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,
      grade,
    }, {}));

    emit('hha:celebrate', { kind:'end', grade });
    fxCelebrate('win', { count: 18 });
    bodyPulse('gj-end', 520);

    // ✅ show HTML overlay only
    showEndOverlayHtml(summary);
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

    // ✅ STORM trigger at 30s (once)
    if(state.timeLeftSec <= 30 && !state.stormOn){
      setStorm(true);
    }

    // boss phase tick
    bossTick();

    // mini tick
    tickMini(dt);

    // spawn
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();

      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.12) spawnOne();
      if(state.bossOn && state.bossPhase===2 && rng() < 0.18) spawnOne();
      if(state.rageOn && rng() < 0.10) spawnOne();
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
      msg: 'ทริค: อย่าแตะขยะ! ⭐ ลด MISS และ 🛡️ กันขยะได้ (กันแล้วไม่เป็น MISS)',
      kind: 'tip'
    });

    requestAnimationFrame(tick);
  }

  start();

  // ----------------------- visibility flush helpers -----------------------
  DOC.addEventListener('visibilitychange', ()=>{
    try{
      if(DOC.visibilityState === 'hidden' && !state.ended){
        log({ type:'visibility', v:'hidden', t: new Date().toISOString(), tag:PROJECT_TAG });
      }
    }catch(_){}
  }, { passive:true });

  ROOT.addEventListener('pagehide', ()=>{
    try{
      if(!state.ended){
        log({ type:'pagehide', t: new Date().toISOString(), tag:PROJECT_TAG });
      }
    }catch(_){}
  }, { passive:true });

  // expose debug
  ROOT.__GJ_STATE__ = state;
}