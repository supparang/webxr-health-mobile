// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + Boss++ Patch A+B+C + Layout Safe)
// ✅ Mobile / PC / VR(Cardboard) / cVR
// ✅ HUD-safe spawn via CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Avoid VR-UI buttons via CSS vars: --hha-vrui-w / --hha-vrui-h (from vr-ui.js)
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as miss
// ✅ Mini "เก็บให้ไว" -> instant pass (fast_hits) with view-based threshold
// ✅ Global FX events: hha:time / hha:score / hha:judge / hha:end
// ✅ Boss++: miss>=4 start, miss>=5 rage, phase2 last 6s, HP by diff
// ✅ End summary + back-to-HUB + save last summary (HHA_LAST_SUMMARY)

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
  function fxPop(x,y,text,cls){
    const P = fx();
    try{
      if(P?.popText) P.popText(x,y,text,cls);
      else if(P?.scorePop) P.scorePop(x,y,text);
    }catch(_){}
  }
  function fxBurst(x,y,kind='good'){
    const P = fx();
    try{
      if(P?.burstAt) P.burstAt(x,y,kind);
      else if(P?.burst) P.burst(x,y,{r: kind==='bad'?64:52});
      else if(P?.shockwave) P.shockwave(x,y,{r: kind==='bad'?66:56});
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

  // logger study params
  const studyId = payload.studyId ?? qs('studyId', qs('study', null));
  const phase = payload.phase ?? qs('phase', null);
  const conditionGroup = payload.conditionGroup ?? qs('conditionGroup', qs('cond', null));

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-12a';
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

  const adaptiveOn = (runMode !== 'research');

  const FX_THRESH = {
    stormSec: 30,
    bossMiss: 4,
    rageMiss: 5,
    phase2Sec: 6, // last 6 seconds
  };

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

    boss: {
      active:false,
      hp: 0,
      hpMax: 0,
      endsAtMs: 0,
      phase2AtMs: 0,
      lastWarpMs: 0,
      warpEveryMs: 720,
      warpEveryMsP2: 460,
      warpEveryMsRage: 420,
      totalSec: 14,
      phase2Sec: FX_THRESH.phase2Sec,
      targetId: null,
    },

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
        emit('hha:judge', { kind:'goal', label:'GOAL!', misses: state.miss, deltaMiss:0 });
      }
      setGoalText();
    }

    emit('hha:judge', { kind:'mini', label:'MINI CLEAR!', misses: state.miss, deltaMiss:0 });
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
    emit('hha:score', { score: state.score, misses: state.miss });
  }
  function setMiss(v){
    const before = state.miss;
    state.miss = Math.max(0, Math.floor(v));
    if(HUD.miss) HUD.miss.textContent = String(state.miss);
    if(state.miss !== before) emit('hha:score', { score: state.score, misses: state.miss });
  }
  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    if(HUD.time) HUD.time.textContent = String(Math.ceil(state.timeLeftSec));
    emit('hha:time', { timeLeftSec: state.timeLeftSec });
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

  function getLayer(){
    return (DOC.body?.classList.contains('view-cvr') && LAYER_R) ? LAYER_L : LAYER_L;
  }

  function getSafeRect(){
    const layer = getLayer();
    if(!layer){
      const W = DOC.documentElement.clientWidth;
      const H = DOC.documentElement.clientHeight;
      return { W,H, xMin:0, xMax:W, yMin:0, yMax:H, layerLeft:0, layerTop:0 };
    }

    const r = layer.getBoundingClientRect();
    const W = Math.max(1, Math.floor(r.width));
    const H = Math.max(1, Math.floor(r.height));

    const sat = readRootPxVar('--sat', 0);
    const topSafe = readRootPxVar('--gj-top-safe', 130 + sat);
    const botSafe = readRootPxVar('--gj-bottom-safe', 120);

    let insetX = Math.max(14, Math.floor(W * 0.06));
    let insetY = Math.max(14, Math.floor(H * 0.06));

    // ✅ avoid VR-UI button cluster (top-left) if present
    const vruiH = readRootPxVar('--hha-vrui-h', 0);
    const vruiW = readRootPxVar('--hha-vrui-w', 0);
    insetY = Math.max(insetY, vruiH + 10);
    insetX = Math.max(insetX, Math.min(90, Math.floor(vruiW * 0.35)));

    const xMin = clamp(insetX, 0, W - 10);
    const xMax = clamp(W - insetX, xMin + 10, W);
    const yMin = clamp(topSafe + insetY, 0, H - 10);
    const yMax = clamp(H - (botSafe + insetY), yMin + 10, H);

    return {
      W, H,
      xMin, xMax, yMin, yMax,
      layerLeft: Math.floor(r.left),
      layerTop:  Math.floor(r.top),
    };
  }

  function localToClient(x,y){
    const rect = getSafeRect();
    return { cx: rect.layerLeft + x, cy: rect.layerTop + y };
  }

  // ----------------------- targets -----------------------
  let targetSeq = 0;

  const EMOJI = {
    good:   ['🥦','🍎','🥕','🍌','🍇','🥬','🍊','🍉'],
    junk:   ['🍟','🍔','🍭','🍩','🧁','🥤','🍪','🍫'],
    star:   ['⭐'],
    shield: ['🛡️'],
    diamond:['💎'],
    boss:   ['🦠'],
  };

  function makeTargetKind(){
    const bossOn = state.boss.active;

    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    let starW   = DIFF.starRate;
    let shieldW = DIFF.shieldRate;
    let junkW   = DIFF.junkRate;

    if(bossOn){
      const isP2 = bossIsPhase2();
      junkW = clamp(junkW + (isP2 ? 0.10 : 0.06), 0.05, 0.60);
      shieldW = clamp(shieldW - (isP2 ? 0.018 : 0.012), 0.01, 0.10);
      starW = clamp(starW + (isP2 ? 0.01 : 0.006), 0.03, 0.14);
    }

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

  function spawnEl(kind, x, y, size, opts={}){
    const id = opts.id || `t${++targetSeq}`;

    const elL = DOC.createElement('div');
    elL.className = 'gj-target';
    elL.dataset.id = id;
    elL.dataset.kind = kind;
    elL.textContent = opts.emoji || pickEmoji(kind);
    elL.style.left = `${x}px`;
    elL.style.top  = `${y}px`;
    elL.style.fontSize = `${size}px`;
    if(opts.extraClass) elL.classList.add(opts.extraClass);

    let elR = null;
    if(LAYER_R){
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
    }

    const bornAt = now();
    const lifeMs = Number(opts.lifeMs)||0;

    const tObj = {
      id, kind,
      bornAt,
      lifeMs: lifeMs > 0 ? lifeMs : (kind==='boss' ? 9999999 : 1800),
      x,y,
      elL,
      elR,
      hit:false,
      data: opts.data || null,
    };

    // pointer hit (PC/Mobile) — note: in cVR CSS should set pointer-events:none
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
    const size = clamp(baseSize + randIn(rng, -4, 10), 44, 74);

    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

    spawnEl(kind, x, y, size, { lifeMs });
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
      }else setMiniText();
      return;
    }

    if(m.type==='fast_hits'){
      const thr = Number(m.thrMs)||450;
      if(rtMs!=null && rtMs<=thr){
        m.cur++;
        if(m.cur >= m.target){
          m.done = true;
          emit('hha:judge', { kind:'mini', label:'FAST PASS!', misses: state.miss, deltaMiss:0 });
          markMiniCleared();
        }else setMiniText();
      }
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
        emit('hha:judge', { kind:'goal', label:'GOAL!', misses: state.miss, deltaMiss:0 });
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

  // ----------------------- boss++ -----------------------
  function bossIsPhase2(){
    if(!state.boss.active) return false;
    return now() >= state.boss.phase2AtMs;
  }

  function bossEnsure(){
    if(state.boss.active) return;
    if(state.miss < FX_THRESH.bossMiss) return;

    state.boss.active = true;
    state.boss.hpMax = DIFF.bossHp;
    state.boss.hp = state.boss.hpMax;

    const t = now();
    state.boss.endsAtMs = t + state.boss.totalSec * 1000;
    state.boss.phase2AtMs = state.boss.endsAtMs - state.boss.phase2Sec * 1000;
    state.boss.lastWarpMs = 0;

    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));
    const size = clamp(86 + randIn(rng, -6, 10), 78, 104);

    const bossId = `boss${++targetSeq}`;
    state.boss.targetId = bossId;

    spawnEl('boss', x, y, size, {
      id: bossId,
      emoji: pickEmoji('boss'),
      extraClass: 'gj-boss',
      lifeMs: 9999999,
      data: { hp: state.boss.hp, hpMax: state.boss.hpMax }
    });

    emit('hha:judge', { kind:'boss', label:'BOSS!', misses: state.miss, deltaMiss:0 });
    bodyPulse('gj-boss-start', 360);

    // ✅ FIX: FX uses client coords
    const cc = localToClient(x, y);
    fxBurst(cc.cx, cc.cy,'bad');
    fxPop(cc.cx, cc.cy-10, 'BOSS!', 'big');

    addShield(1);
  }

  function bossWarpIfNeeded(){
    if(!state.boss.active) return;

    const t = now();
    const isP2 = bossIsPhase2();
    const isRage = (state.miss >= FX_THRESH.rageMiss);

    const every =
      isRage ? (isP2 ? state.boss.warpEveryMsRage : 520)
             : (isP2 ? state.boss.warpEveryMsP2 : state.boss.warpEveryMs);

    if(state.boss.lastWarpMs && (t - state.boss.lastWarpMs) < every) return;
    state.boss.lastWarpMs = t;

    const bossObj = state.targets.get(state.boss.targetId);
    if(!bossObj || bossObj.hit) return;

    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

    bossObj.x = x; bossObj.y = y;
    try{
      bossObj.elL.style.left = `${x}px`;
      bossObj.elL.style.top  = `${y}px`;
      bossObj.elR && (bossObj.elR.style.left = `${x}px`);
      bossObj.elR && (bossObj.elR.style.top  = `${y}px`);
      bossObj.elL.classList.add('warp');
      bossObj.elR && bossObj.elR.classList.add('warp');
      setTimeout(()=>{
        try{ bossObj.elL.classList.remove('warp'); bossObj.elR && bossObj.elR.classList.remove('warp'); }catch(_){}
      }, 140);
    }catch(_){}
  }

  function bossTick(){
    if(!state.boss.active) return;

    const t = now();
    if(t >= state.boss.endsAtMs){
      const before = state.miss;
      setMiss(state.miss + 1);
      updateGoalsOnMiss();

      emit('hha:judge', { kind:'miss', label:'BOSS FAIL', misses: state.miss, deltaMiss: state.miss - before });
      bodyPulse('gj-boss-fail', 260);
      fxBurst(DOC.documentElement.clientWidth/2, DOC.documentElement.clientHeight/2, 'bad');
      fxPop(DOC.documentElement.clientWidth/2, DOC.documentElement.clientHeight*0.35, 'BOSS FAIL', 'big');

      bossEnd(false);
      return;
    }

    if(bossIsPhase2()) DOC.body.classList.add('gj-boss-p2');
    else DOC.body.classList.remove('gj-boss-p2');

    bossWarpIfNeeded();
  }

  function bossHit(clientX, clientY){
    if(!state.boss.active) return false;
    const bossObj = state.targets.get(state.boss.targetId);
    if(!bossObj || bossObj.hit) return false;

    state.boss.hp = Math.max(0, state.boss.hp - 1);

    fxBurst(clientX, clientY, 'good');
    fxPop(clientX, clientY-6, `-1 HP`, 'score');
    bodyPulse('gj-boss-hit', 140);

    emit('hha:judge', { kind:'boss', label:'HIT BOSS', misses: state.miss, deltaMiss:0, bossHp: state.boss.hp, bossHpMax: state.boss.hpMax });

    if(state.boss.hp <= 0){
      bossEnd(true);
    }
    return true;
  }

  function bossEnd(win){
    const bossObj = state.targets.get(state.boss.targetId);
    if(bossObj) removeTarget(bossObj);

    state.boss.active = false;
    state.boss.targetId = null;
    DOC.body.classList.remove('gj-boss-p2');

    if(win){
      const bonus = 80;
      setScore(state.score + bonus);
      setMiss(Math.max(0, state.miss - 1));
      addShield(1);
      addFever(-14);

      emit('hha:judge', { kind:'boss', label:'BOSS DOWN!', misses: state.miss, deltaMiss:0 });
      emit('hha:celebrate', { kind:'boss' });
      fxPop(DOC.documentElement.clientWidth/2, DOC.documentElement.clientHeight*0.30, `BOSS DOWN +${bonus}`, 'big');
      bodyPulse('gj-boss-down', 360);
    }else{
      addFever(10);
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

    if(kind === 'boss'){
      tObj.hit = false; // keep alive
      bossHit(px, py);
      return;
    }

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
      fxPop(px,py,`+${delta}`,'score');

      emit('hha:judge', { kind:'good', label:'GOOD!', misses: state.miss, deltaMiss:0, x:px, y:py, rtMs });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);
        fxBurst(px,py,'block');
        fxPop(px,py,'BLOCK','score');
        emit('hha:judge', { kind:'block', label:'BLOCK!', misses: state.miss, deltaMiss:0, x:px, y:py, blocked:true });
      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        const before = state.miss;
        setMiss(state.miss + (DIFF.junkPenaltyMiss||1));
        const deltaMiss = state.miss - before;

        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        updateGoalsOnMiss();
        miniOnJunkHit();

        fxBurst(px,py,'bad');
        fxPop(px,py,'-','score');
        emit('hha:judge', { kind:'junk', label:'OOPS!', misses: state.miss, deltaMiss, x:px, y:py, blocked:false });

        bodyPulse('gj-junk-hit', 220);
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);

      const before = state.miss;
      setMiss(Math.max(0, state.miss - 1));
      const deltaMiss = state.miss - before;

      updateGoalsOnMiss();
      fxBurst(px,py,'star');
      fxPop(px,py,'MISS -1','score');

      emit('hha:judge', { kind:'star', label:'STAR!', misses: state.miss, deltaMiss, x:px, y:py });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      fxBurst(px,py,'shield');
      fxPop(px,py,'SHIELD +1','score');

      emit('hha:judge', { kind:'shield', label:'SHIELD!', misses: state.miss, deltaMiss:0, x:px, y:py });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);

      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();

      fxBurst(px,py,'diamond');
      fxPop(px,py,`+${bonus}`,'big');

      emit('hha:judge', { kind:'diamond', label:'DIAMOND!', misses: state.miss, deltaMiss:0, x:px, y:py });
    }

    setMiniText();
    removeTarget(tObj);

    bossEnsure();

    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // cVR/VR shooting (crosshair center)
  function shootCrosshair(){
    if(state.ended) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    if(state.boss.active){
      const bossObj = state.targets.get(state.boss.targetId);
      if(bossObj && !bossObj.hit){
        const dBoss = Math.hypot(bossObj.x - cx, bossObj.y - cy);
        const bossR = (state.miss >= FX_THRESH.rageMiss) ? 92 : 100;
        if(dBoss <= bossR){
          bossHit(cx, cy);
          return;
        }
      }
    }

    const R = (isCVR || isVR) ? 82 : 70;
    let best = null;
    let bestD = 1e9;

    for(const t of state.targets.values()){
      if(t.hit) continue;
      if(t.kind === 'boss') continue;
      const d = Math.hypot((t.x - cx),(t.y - cy));
      if(d < R && d < bestD){
        bestD = d;
        best = t;
      }
    }

    if(best){
      onTargetHit(best, { via:'shoot', clientX: cx, clientY: cy });
    }else{
      bodyPulse('gj-miss-shot', 120);
      emit('hha:judge', { kind:'shot_miss', label:'MISS SHOT', misses: state.miss, deltaMiss:0, x:cx, y:cy });
    }
  }

  ROOT.addEventListener('hha:shoot', shootCrosshair, { passive:true });

  // ----------------------- expiry tick -----------------------
  function expireTargets(){
    const t = now();
    for(const tObj of state.targets.values()){
      if(tObj.hit) continue;
      if(tObj.kind === 'boss') continue;

      if((t - tObj.bornAt) >= tObj.lifeMs){
        tObj.hit = true;

        if(tObj.kind === 'good'){
          state.nExpireGood++;
          resetCombo();
          addFever(6);

          const before = state.miss;
          setMiss(state.miss + 1);
          const deltaMiss = state.miss - before;

          updateGoalsOnMiss();

          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          fxBurst(tObj.x, tObj.y, 'bad');
          fxPop(tObj.x, tObj.y, 'MISS','score');

          emit('hha:judge', { kind:'expire', label:'MISS!', misses: state.miss, deltaMiss, x:tObj.x, y:tObj.y });
          bodyPulse('gj-good-expire', 160);

          bossEnsure();

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

  // ----------------------- spawn scheduler -----------------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    const bossOn = state.boss.active;
    const isP2 = bossOn && bossIsPhase2();
    const isRage = (state.miss >= FX_THRESH.rageMiss);

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);

      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);

      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.15;
    }

    if(bossOn){
      r *= isP2 ? (isRage ? 1.55 : 1.40) : 1.18;
    }

    return clamp(r, 0.8, 2.2);
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
      if(hub) location.href = hub;
      else alert('ยังไม่ได้ใส่ hub url');
    });
  }

  // ----------------------- end game -----------------------
  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    if(state.boss.active) bossEnd(false);
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
      studyId, phase, conditionGroup,
      view,
    }));

    emit('hha:celebrate', { kind:'end', grade });
    showEndOverlay(summary);
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

    bossEnsure();
    bossTick();

    tickMini(dt);

    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.12) spawnOne();
      if(state.boss.active && bossIsPhase2() && rng() < 0.18) spawnOne();
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
      startTimeIso: state.startTimeIso,
      misses: 0,
      timeLeftSec: durationPlannedSec,
    });

    emit('hha:coach', {
      msg: 'ทริค: อย่าแตะขยะ! ⭐ ลด MISS และ 🛡️ กันขยะได้ (กันแล้วไม่เป็น MISS) — ถ้าเริ่มบอส ให้รีบยิง 🦠 เพื่อลด HP!',
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