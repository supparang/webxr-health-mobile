// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + ULTRA FX + FAIR)
// ✅ Mobile / PC / VR(Cardboard) / cVR
// ✅ HUD-safe spawn via CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as miss
// ✅ Mini "เก็บให้ไว" -> instant pass (fast_hits) with view-based threshold
// ✅ FX states: timeLeft<=30 => STORM, miss>=4 => BOSS, miss>=5 => RAGE
// ✅ Emits to BOTH window+document: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:miss, hha:end, hha:celebrate
// ✅ End summary + back-to-HUB + save last summary (HHA_LAST_SUMMARY)
// ✅ Logger: hha:start / hha:end compatible with hha-cloud-logger.js V2+

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
    try{ P?.scorePop?.(x,y,text); }catch(_){}
  }
  function fxBurst(x,y,kind='good'){
    const P = fx();
    try{ P?.burstAt?.(x,y,kind); }catch(_){}
  }
  function fxShock(x,y,r=64){
    const P = fx();
    try{ P?.shockwave?.(x,y,{r}); }catch(_){ fxBurst(x,y,'good'); }
  }

  // ✅ NEW: confetti/celebrate by grade tier
  function tierFromGrade(g){
    if(g === 'SSS') return 5;
    if(g === 'SS')  return 4;
    if(g === 'S')   return 3;
    if(g === 'A')   return 2;
    if(g === 'B')   return 1;
    return 0; // C
  }

  function doGradeConfetti(tier=0){
    if(!tier) return;

    const P = fx();
    const cx = Math.floor(innerWidth/2);
    const cy = Math.floor(innerHeight*0.32);

    try{
      P?.burstAt?.(cx, cy, 'good');
      P?.burstAt?.(cx-140, cy+40, 'good');
      P?.burstAt?.(cx+140, cy+40, 'good');
    }catch(_){}

    if(tier >= 3){
      try{ P?.shockwave?.(cx, cy, { r: 120 }); }catch(_){}
    }
    if(tier >= 4){
      try{ P?.burstAt?.(cx, cy+90, 'star'); }catch(_){}
      try{ P?.scorePop?.(cx, cy-20, '🔥'); }catch(_){}
    }
    if(tier >= 5){
      try{ P?.burstAt?.(cx, cy+110, 'diamond'); }catch(_){}
      try{ P?.scorePop?.(cx, cy-36, 'SSS!'); }catch(_){}
    }
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

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-06fx';
  const PROJECT_TAG = 'GoodJunkVR';

  const rng = makeSeededRng(String(seed));
  const isVR  = (view === 'vr');
  const isCVR = (view === 'cvr');

  // difficulty tuning (base)
  const DIFF_BASE = (() => {
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

    goals: [],
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

    fx: { storm:false, boss:false, rage:false },

    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  // ----------------------- fast mini config -----------------------
  function fastCfgByView(v){
    if(v==='pc')  return { thrMs: 440, target: 2, timeLimitSec: 10 };
    if(v==='cvr') return { thrMs: 460, target: 2, timeLimitSec: 10 };
    if(v==='vr')  return { thrMs: 480, target: 2, timeLimitSec: 10 };
    return { thrMs: 470, target: 2, timeLimitSec: 10 };
  }

  function pickMiniSequence(v='mobile'){
    const fast = fastCfgByView(v);
    return [
      { type:'streak_good', title:'เก็บดีติดกัน', target:3, cur:0, done:false },
      { type:'avoid_junk',  title:'อย่าโดนขยะ', target:6, cur:0, done:false },
      { type:'fast_hits',   title:'เก็บให้ไว', target: fast.target, cur:0, done:false,
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
      { type:'survive', title:'เอาตัวรอด', target: DIFF_BASE.missLimit, cur:0, done:false,
        desc:`MISS ต้องไม่เกิน ${DIFF_BASE.missLimit}` },
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
        HUD.mini.textContent = `${m.title}: อยู่ให้ครบ ${Math.floor(m.cur)}/${m.target}s (ห้ามโดนขยะ)`;
      }else{
        HUD.mini.textContent = `${m.title}: ${m.cur}/${m.target}`;
      }
    }
    if(HUD.miniTimer){
      HUD.miniTimer.textContent = (m.type==='fast_hits') ? `${Math.ceil(m.leftSec||0)}s` : '—';
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
        emit('hha:judge', { type:'perfect', x: innerWidth/2, y: innerHeight*0.33 });
      }
      setGoalText();
    }

    emit('hha:judge', { type:'perfect', x: innerWidth/2, y: innerHeight*0.35, label:'MINI CLEAR' });
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
        if((Math.floor(m.cur*2) % 2)===0) setMiniText();
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
  function setScore(v){
    state.score = Math.max(0, Math.floor(v));
    HUD.score && (HUD.score.textContent = String(state.score));
    emit('hha:score', { score: state.score, x: innerWidth*0.85, y: innerHeight*0.18 });
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
    if(t <= 10){
      DOC.body.classList.add('gj-lowtime');
      if(HUD.lowTimeOverlay){
        HUD.lowTimeOverlay.setAttribute('aria-hidden', (t<=5) ? 'false' : 'true');
      }
      if(HUD.lowTimeNum && t<=5){
        HUD.lowTimeNum.textContent = String(Math.ceil(t));
      }
    }else{
      DOC.body.classList.remove('gj-lowtime');
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

  function liveTuning(){
    // base
    let spawn = DIFF_BASE.spawnPerSec;
    let junk  = DIFF_BASE.junkRate;
    let star  = DIFF_BASE.starRate;
    let shield= DIFF_BASE.shieldRate;
    let life  = DIFF_BASE.goodLifeMs;

    // STORM
    if(state.fx.storm){
      spawn *= 1.12;
      life  *= 0.94;
      star  += 0.01;
      shield+= 0.01;
    }
    // BOSS
    if(state.fx.boss){
      spawn *= 1.10;
      junk  += 0.04;
      shield+= 0.01;
    }
    // RAGE
    if(state.fx.rage){
      spawn *= 1.16;
      junk  += 0.06;
      star  += 0.01;
      shield+= 0.015;
      life  *= 0.92;
    }

    junk = clamp(junk, 0.10, 0.55);
    star = clamp(star, 0.02, 0.16);
    shield = clamp(shield, 0.02, 0.16);
    life = clamp(life, 1100, 2600);
    spawn = clamp(spawn, 0.8, 2.25);

    return { spawnPerSec: spawn, junkRate:junk, starRate:star, shieldRate:shield, goodLifeMs: life };
  }

  function makeTargetKind(tune){
    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    const starW = tune.starRate;
    const shieldW = tune.shieldRate;
    const junkW = tune.junkRate;
    const goodW = Math.max(0.01, 1 - (junkW + starW + shieldW + diamondW));
    return pickWeighted(rng, [
      {k:'good', w:goodW},
      {k:'junk', w:junkW},
      {k:'star', w:starW},
      {k:'shield', w:shieldW},
      {k:'diamond', w:diamondW},
    ]);
  }

  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  function spawnOne(){
    if(state.ended) return;

    const tune = liveTuning();
    const kind = makeTargetKind(tune);

    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;

    const id = `t${++targetSeq}`;
    const lifeMs =
      (kind==='good') ? tune.goodLifeMs :
      (kind==='junk') ? Math.round(tune.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(tune.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(tune.goodLifeMs * 1.15) :
      Math.round(tune.goodLifeMs * 1.25);

    const baseSize = (kind==='good') ? 54 : (kind==='junk') ? 56 : 50;
    const size = clamp(baseSize + randIn(rng, -4, 10), 44, 74);

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
    const tObj = { id, kind, bornAt, lifeMs, x,y, elL, elR, hit:false };

    // mobile/pc direct hit
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
      }else setMiniText();
      return;
    }

    if(m.type==='fast_hits'){
      const thr = Number(m.thrMs)||450;
      if(rtMs!=null && rtMs<=thr){
        m.cur++;
        if(m.cur >= m.target){
          m.done = true;
          emit('hha:judge', { type:'perfect', x: innerWidth/2, y: innerHeight*0.35, label:'FAST PASS' });
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
        emit('hha:judge', { type:'perfect', x: innerWidth/2, y: innerHeight*0.30, label:'GOAL' });
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

      const delta = DIFF_BASE.goodScore + Math.min(6, Math.floor(state.combo/5));
      setScore(state.score + delta);
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);

      fxShock(px,py, 62);
      fxBurst(px,py,'good');
      fxScorePop(px,py,`+${delta}`);
      emit('hha:judge', { type:'good', x:px, y:py, combo: state.combo });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);

        fxBurst(px,py,'shield');
        fxScorePop(px,py,'BLOCK');
        emit('hha:judge', { type:'block', x:px, y:py });

      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        setMiss(state.miss + (DIFF_BASE.junkPenaltyMiss||1));
        setScore(state.score + (DIFF_BASE.junkPenaltyScore||-10));
        updateGoalsOnMiss();
        miniOnJunkHit();

        emit('hha:miss', { x:px, y:py, reason:'junk-hit' });
        fxShock(px,py, 72);
        fxBurst(px,py,'bad');
        fxScorePop(px,py,'-');
        emit('hha:judge', { type:'bad', x:px, y:py });
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();

      fxBurst(px,py,'star');
      fxScorePop(px,py,'MISS -1');
      emit('hha:judge', { type:'good', x:px, y:py, label:'STAR' });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);

      fxBurst(px,py,'shield');
      fxScorePop(px,py,'SHIELD +1');
      emit('hha:judge', { type:'good', x:px, y:py, label:'SHIELD' });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);

      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();

      fxShock(px,py, 86);
      fxBurst(px,py,'diamond');
      fxScorePop(px,py,`+${bonus}`);
      emit('hha:judge', { type:'perfect', x:px, y:py, label:'DIAMOND' });
    }

    setMiniText();
    removeTarget(tObj);

    if(state.miss >= DIFF_BASE.missLimit){
      endGame('miss-limit');
    }
  }

  // cVR / VR shoot from crosshair (กันยิงซ้อน)
  let lastShotAt = 0;

  function shootCrosshair(){
    if(state.ended) return;

    const t = performance.now();
    if(t - lastShotAt < 95) return;
    lastShotAt = t;

    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    const R = (isCVR || isVR) ? 86 : 70;
    let best = null;
    let bestD = 1e9;

    for(const tt of state.targets.values()){
      if(tt.hit) continue;
      const dx = (tt.x - cx);
      const dy = (tt.y - cy);
      const d = Math.hypot(dx,dy);
      if(d < R && d < bestD){
        bestD = d;
        best = tt;
      }
    }

    if(best){
      onTargetHit(best, { via:'shoot', clientX: cx, clientY: cy });
    }else{
      fxShock(cx,cy, 52);
      emit('hha:judge', { type:'miss', x:cx, y:cy, label:'WHIFF' });
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

        if(tObj.kind === 'good'){
          state.nExpireGood++;
          resetCombo();
          addFever(6);

          setMiss(state.miss + 1);
          updateGoalsOnMiss();

          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          emit('hha:miss', { x:tObj.x, y:tObj.y, reason:'good-expire' });
          fxBurst(tObj.x, tObj.y, 'bad');
          fxScorePop(tObj.x, tObj.y, 'MISS');
          emit('hha:judge', { type:'miss', x:tObj.x, y:tObj.y, label:'EXPIRE' });

          if(state.miss >= DIFF_BASE.missLimit){
            removeTarget(tObj);
            endGame('miss-limit');
            return;
          }
        }

        removeTarget(tObj);
      }
    }
  }

  // ----------------------- spawn scheduler -----------------------
  function spawnRate(){
    let r = liveTuning().spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF_BASE.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);

      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);

      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.15;
    }

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

  // ✅ NEW: Grade SSS/SS/S/A/B/C (แฟร์ตาม diff)
  function gradeFrom(score, miss){
    const adj =
      (diff === 'easy') ? -40 :
      (diff === 'hard') ? +40 : 0;

    const sss = 620 + adj;
    const ss  = 560 + adj;
    const s   = 500 + adj;
    const a   = 420 + adj;
    const b   = 320 + adj;

    if(miss <= 1 && score >= sss) return 'SSS';
    if(miss <= 2 && score >= ss)  return 'SS';
    if(miss <= 4 && score >= s)   return 'S';
    if(miss <= 6 && score >= a)   return 'A';
    if(miss <= 8 && score >= b)   return 'B';
    return 'C';
  }

  // ----------------------- end overlay wiring (existing DOM) -----------------------
  const endOverlay = byId('endOverlay');
  const endTitle = byId('endTitle');
  const endSub = byId('endSub');
  const endGrade = byId('endGrade');
  const endScore = byId('endScore');
  const endMiss = byId('endMiss');
  const endTime = byId('endTime');

  function showEndOverlay(summary){
    if(!endOverlay) return;
    try{
      endTitle && (endTitle.textContent = (summary.reason === 'miss-limit') ? 'Game Over' : 'Completed');
      endSub && (endSub.textContent = `reason=${summary.reason} | mode=${summary.runMode} | view=${summary.device}`);
      endGrade && (endGrade.textContent = summary.grade || '—');
      endScore && (endScore.textContent = String(summary.scoreFinal ?? 0));
      endMiss && (endMiss.textContent = String(summary.misses ?? 0));
      endTime && (endTime.textContent = String(Math.round(Number(summary.durationPlayedSec||0))));
      endOverlay.setAttribute('aria-hidden','false');
      endOverlay.style.display = 'flex';
    }catch(_){}
  }

  // ----------------------- end game -----------------------
  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

    if(state.goal && state.goal.type==='survive' && !state.goal.done){
      if(state.miss <= DIFF_BASE.missLimit){
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
      device: deviceLabel(DOC.body.dataset.view || view),
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

    emit('hha:end', {
      projectTag: PROJECT_TAG,
      runMode,
      studyId,
      phase,
      conditionGroup,
      device: summary.device,
      view: DOC.body.dataset.view || view,
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
    });

    emit('hha:celebrate', { kind:'end', grade });

    // ✅ NEW: confetti by tier (C = none)
    try{
      const tier = tierFromGrade(grade);
      doGradeConfetti(tier);
    }catch(_){}

    showEndOverlay(summary);
  }

  // ----------------------- storm/boss/rage triggers -----------------------
  function updateThreatStates(){
    if(!state.fx.storm && state.timeLeftSec <= 30){
      state.fx.storm = true;
      DOC.body.classList.add('gj-storm');
      emit('hha:storm', { t: Math.ceil(state.timeLeftSec) });
    }
    if(!state.fx.boss && state.miss >= 4){
      state.fx.boss = true;
      DOC.body.classList.add('gj-boss');
      emit('hha:boss', { miss: state.miss });
    }
    if(!state.fx.rage && state.miss >= 5){
      state.fx.rage = true;
      DOC.body.classList.add('gj-rage');
      emit('hha:rage', { miss: state.miss });
    }
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

    state.timeLeftSec -= dt;
    if(state.timeLeftSec < 0) state.timeLeftSec = 0;
    setTimeLeft(state.timeLeftSec);
    updateLowTimeFx();

    tickMini(dt);
    updateThreatStates();

    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.12) spawnOne();
    }

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
    state.goalsTotal = state.goals.length;
    setGoalText();

    state.miniSeq = pickMiniSequence(DOC.body.dataset.view || view);
    state.miniTotal = state.miniSeq.length;
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
      view: DOC.body.dataset.view || view,
      device: deviceLabel(DOC.body.dataset.view || view),
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

  // expose debug
  ROOT.__GJ_STATE__ = state;
}