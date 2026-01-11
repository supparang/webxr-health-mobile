// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard) + BOSS/STORM/RAGE (FAIR)
// ✅ Mobile / PC / VR(Cardboard) / cVR
// ✅ HUD-safe spawn via CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Miss = good expired + junk hit; Shield-blocked junk does NOT count as miss
// ✅ Mini "เก็บให้ไว" -> instant pass with view-based threshold
// ✅ STORM: timeLeft <= 30s
// ✅ BOSS: miss >= 4 (HP by diff: 10/12/14), Phase2 every 6s
// ✅ RAGE: miss >= 5 (harder but capped; still fair)
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate

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

  // particles (optional) — supports either new or compat
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
      else if(P?.burst) P.burst(x,y,{r:56});
    }catch(_){}
  }
  function fxShock(x,y,r=64){
    const P = fx();
    try{
      if(P?.shockwave) P.shockwave(x,y,{r});
      else if(P?.burst) P.burst(x,y,{r});
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

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-11_BOSS_STORM_RAGE';
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
      missLimit: 12,   // survive goal limit
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

  // play vs research (adaptive off in research)
  const adaptiveOn = (runMode !== 'research');

  // thresholds (user rule)
  const STORM_AT_SEC = 30;
  const BOSS_AT_MISS = 4;
  const RAGE_AT_MISS = 5;

  // boss phase switching
  const BOSS_PHASE2_EVERY_SEC = 6;

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

  // ----------------------- inject boss UI (no HTML changes required) -----------------------
  function injectBossUi(){
    if(byId('gjBossUi')) return;

    const st = DOC.createElement('style');
    st.id = 'gj-boss-style';
    st.textContent = `
      .gj-boss{
        position:fixed;
        left: calc(12px + var(--sal));
        right: calc(12px + var(--sar));
        top: calc(58px + var(--sat));
        z-index: 190;
        pointer-events:none;
        opacity:0;
        transform: translateY(-6px);
        transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
        filter: none;
      }
      body.gj-boss-on .gj-boss{
        opacity:1;
        transform: translateY(0);
      }
      body.gj-rage-on .gj-boss{
        filter: saturate(1.08) contrast(1.04);
      }

      .gj-boss .row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 12px;
        border-radius: 16px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.68);
        backdrop-filter: blur(10px);
      }
      .gj-boss .ttl{
        font-weight: 1200;
        letter-spacing:.2px;
        color:#e5e7eb;
        display:flex;
        align-items:center;
        gap:8px;
        white-space:nowrap;
      }
      .gj-boss .sub{
        font-size:12px;
        color:#94a3b8;
        font-weight: 900;
        white-space:nowrap;
      }
      .gj-boss .bar{
        flex:1;
        height: 10px;
        border-radius: 999px;
        background: rgba(148,163,184,.16);
        overflow:hidden;
        border:1px solid rgba(148,163,184,.20);
      }
      .gj-boss .fill{
        height:100%;
        width: 0%;
        background: rgba(239,68,68,.75);
        transform-origin:left center;
        transition: width 160ms ease;
      }
      body.gj-rage-on .gj-boss .fill{
        background: rgba(245,158,11,.80);
      }

      .gj-storm-chip{
        position:fixed;
        left: calc(12px + var(--sal));
        top: calc(112px + var(--sat));
        z-index: 189;
        pointer-events:none;
        opacity:0;
        transform: translateY(-6px);
        transition: opacity 180ms ease, transform 180ms ease;
        font: 900 12px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        color:#e5e7eb;
        background: rgba(2,6,23,.58);
        border:1px solid rgba(148,163,184,.22);
        border-radius: 999px;
        padding: 8px 10px;
        backdrop-filter: blur(10px);
      }
      body.gj-storm-on .gj-storm-chip{
        opacity:1; transform: translateY(0);
      }
    `;
    DOC.head.appendChild(st);

    const boss = DOC.createElement('div');
    boss.id = 'gjBossUi';
    boss.className = 'gj-boss';
    boss.innerHTML = `
      <div class="row">
        <div class="ttl">👾 BOSS</div>
        <div class="bar"><div class="fill" id="gjBossFill"></div></div>
        <div class="sub" id="gjBossTxt">HP: -/-</div>
      </div>
    `;
    DOC.body.appendChild(boss);

    const storm = DOC.createElement('div');
    storm.id = 'gjStormChip';
    storm.className = 'gj-storm-chip';
    storm.textContent = '🌪️ STORM! (30s)';
    DOC.body.appendChild(storm);
  }
  injectBossUi();

  const BOSS_UI = {
    fill: byId('gjBossFill'),
    txt: byId('gjBossTxt'),
  };

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

    // misses (HHA standard for GoodJunk: good expired + junk hit)
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
    rtGood: [],  // ms
    rtBreakdown: { lt300:0, lt450:0, lt700:0, ge700:0 },

    // fever / shield
    fever: 0, // 0-100
    shield: 0, // integer pills

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
    targets: new Map(), // id => targetObj

    // storm/boss/rage
    stormOn: false,
    bossOn: false,
    rageOn: false,

    boss: {
      active:false,
      hp: 0,
      hpMax: 0,
      phase: 1,
      phaseT: 0,
      lastPhaseFlipAt: 0,
      cleared:false
    },

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
    return { thrMs: 470, target: 2, timeLimitSec: 10 }; // mobile
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
    const base = [
      { type:'survive', title:'เอาตัวรอด', target: DIFF.missLimit, cur:0, done:false,
        desc:`MISS ต้องไม่เกิน ${DIFF.missLimit}` },
      { type:'score', title:'ทำคะแนน', target: (diff==='easy'? 420 : diff==='hard'? 520 : 470), cur:0, done:false,
        desc:`เก็บของดีเพื่อทำคะแนน` },
      { type:'minis', title:'ทำ MINI', target: 2, cur:0, done:false,
        desc:`ผ่าน MINI ให้ได้ 2 ครั้ง` }
    ];
    return base;
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
      }else if(m.type==='streak_good'){
        HUD.mini.textContent = `${m.title}: ${m.cur}/${m.target}`;
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
    try{ emit('hha:celebrate', { kind:'mini' }); }catch(_){}
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
    emit('hha:score', { score: state.score, x: innerWidth/2, y: innerHeight*0.25 });
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

  // ----------------------- safe spawn -----------------------
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

    // Slight tighten in storm (keeps targets away from edges = fair)
    const edgeX = state.stormOn ? 0.14 : 0.12;
    const xMin = Math.floor(W * edgeX);
    const xMax = Math.floor(W * (1-edgeX));
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

    // rage makes junk more common (but capped)
    const rageJunkBoost = state.rageOn ? 0.08 : 0.0;
    const stormJunkBoost = state.stormOn ? 0.03 : 0.0;

    const starW = DIFF.starRate + (state.stormOn ? 0.01 : 0);   // keep fair: more chance to recover
    const shieldW = DIFF.shieldRate + (state.rageOn ? 0.01 : 0);// keep fair: rage gives a bit more shield
    const junkW = clamp(DIFF.junkRate + rageJunkBoost + stormJunkBoost, 0.12, 0.46);

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

    const kind = makeTargetKind();

    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;

    const id = `t${++targetSeq}`;

    // storm/rage shrinks life slightly (but capped)
    const lifeBase =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      Math.round(DIFF.goodLifeMs * 1.25);

    const stormMul = state.stormOn ? 0.92 : 1;
    const rageMul  = state.rageOn  ? 0.88 : 1;
    const lifeMs = clamp(Math.round(lifeBase * stormMul * rageMul), 900, 2800);

    const baseSize = (kind==='good') ? 54 : (kind==='junk') ? 56 : 50;
    const size = clamp(baseSize + randIn(rng, -4, 10), 44, 72);

    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

    const elL = DOC.createElement('div');
    elL.className = 'gj-target';
    elL.dataset.id = id;
    elL.dataset.kind = kind;
    elL.textContent = pickEmoji(kind);
    elL.style.left = `${x}px`;
    elL.style.top  = `${y}px`;
    elL.style.fontSize = `${size}px`;

    // storm wobble (CSS-free: inline animation via transform on tick)
    const wobble = state.stormOn ? {
      ax: randIn(rng,-1.0,1.0),
      ay: randIn(rng,-1.0,1.0),
      s:  randIn(rng,0.6,1.2),
    } : null;

    let elR = null;
    if(LAYER_R){
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
    }

    const bornAt = now();
    const tObj = {
      id, kind,
      bornAt,
      lifeMs,
      x,y,
      elL,
      elR,
      hit:false,
      wobble,
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
        emit('hha:judge', { type:'good', label:'GOAL!' });
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

  // ----------------------- storm/boss/rage director -----------------------
  function setStorm(on){
    if(!!on === state.stormOn) return;
    state.stormOn = !!on;
    DOC.body.classList.toggle('gj-storm-on', state.stormOn);

    if(state.stormOn){
      emit('hha:coach', { kind:'warn', msg:'🌪️ STORM! เหลือ 30 วิแล้ว! เป้าจะมาเร็วขึ้น!' });
      fxPop(innerWidth*0.5, innerHeight*0.22, 'STORM!', 'perfect');
      bodyPulse('fx-kick', 120);
    }
  }

  function bossUiUpdate(){
    if(!state.boss.active || !BOSS_UI.fill || !BOSS_UI.txt) return;
    const hp = clamp(state.boss.hp, 0, state.boss.hpMax);
    const pct = state.boss.hpMax ? (hp/state.boss.hpMax)*100 : 0;
    BOSS_UI.fill.style.width = `${pct}%`;
    BOSS_UI.txt.textContent = `HP: ${hp}/${state.boss.hpMax} · P${state.boss.phase}`;
  }

  function startBoss(){
    if(state.boss.active) return;
    state.boss.active = true;
    state.boss.hpMax = DIFF.bossHP;
    state.boss.hp = DIFF.bossHP;
    state.boss.phase = 1;
    state.boss.phaseT = 0;
    state.boss.lastPhaseFlipAt = now();
    state.boss.cleared = false;

    state.bossOn = true;
    DOC.body.classList.add('gj-boss-on');

    bossUiUpdate();

    emit('hha:coach', { kind:'warn', msg:`👾 BOSS โผล่! เก็บของดีเพื่อลด HP (${state.boss.hpMax})` });
    emit('hha:judge', { type:'perfect', label:'BOSS!' });
    fxShock(innerWidth*0.5, innerHeight*0.28, 92);
  }

  function endBossCleared(){
    if(!state.boss.active) return;
    state.boss.active = false;
    state.boss.cleared = true;

    state.bossOn = false;
    DOC.body.classList.remove('gj-boss-on');

    emit('hha:coach', { kind:'good', msg:'✅ โค่น BOSS สำเร็จ! เก่งมาก!' });
    emit('hha:judge', { type:'perfect', label:'BOSS DOWN!' });
    emit('hha:celebrate', { kind:'boss' });

    // reward: shields + score (fair)
    addShield(1);
    setScore(state.score + 35);
    updateGoalsOnScore();
  }

  function setRage(on){
    if(!!on === state.rageOn) return;
    state.rageOn = !!on;
    DOC.body.classList.toggle('gj-rage-on', state.rageOn);

    if(state.rageOn){
      emit('hha:coach', { kind:'warn', msg:'🔥 RAGE! อย่าโดนขยะอีกนะ!' });
      emit('hha:judge', { type:'bad', label:'RAGE!' });
      fxShock(innerWidth*0.5, innerHeight*0.28, 110);
    }
  }

  function updateBossPhase(){
    if(!state.boss.active) return;
    const t = now();
    const elapsed = (t - state.boss.lastPhaseFlipAt) / 1000;

    if(elapsed >= BOSS_PHASE2_EVERY_SEC){
      state.boss.lastPhaseFlipAt = t;
      state.boss.phase = (state.boss.phase === 1) ? 2 : 1;
      bossUiUpdate();

      // phase flip hint (small)
      emit('hha:judge', { type:'good', label: state.boss.phase === 2 ? 'PHASE 2!' : 'PHASE 1' });
      fxPop(innerWidth*0.5, innerHeight*0.24, state.boss.phase===2?'PHASE 2':'PHASE 1', 'score');
    }
  }

  function applyDirectors(){
    // storm
    if(state.timeLeftSec <= STORM_AT_SEC) setStorm(true);

    // boss & rage by miss thresholds
    if(state.miss >= BOSS_AT_MISS) startBoss();
    if(state.miss >= RAGE_AT_MISS) setRage(true);

    // boss phase logic
    updateBossPhase();

    // in boss mode: if player stabilizes (gets stars/shields) we still keep boss until hp=0
  }

  // ----------------------- hit logic -----------------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){
    state.combo = 0;
  }

  // Boss damage: every GOOD hit reduces HP by 1 (phase2 sometimes requires “streak”)
  function bossDamageOnGoodHit(){
    if(!state.boss.active) return;

    // Phase2: require a tiny chain for damage (still fair)
    // - If combo >= 2 then dmg=1, else dmg=0 (forces attention but not too harsh)
    // - In easy: always dmg=1
    let dmg = 1;
    if(state.boss.phase === 2 && diff !== 'easy'){
      dmg = (state.combo >= 2) ? 1 : 0;
    }
    if(dmg <= 0) return;

    state.boss.hp = Math.max(0, state.boss.hp - dmg);
    bossUiUpdate();

    emit('hha:judge', { type:'good', label:`BOSS -${dmg}` });

    if(state.boss.hp <= 0){
      endBossCleared();
    }
  }

  // Boss punishment: junk hit adds “pressure” (small hp regen or phase flip)
  function bossPunishOnJunkHit(blocked){
    if(!state.boss.active) return;
    if(blocked) return;

    // regen small (capped) — makes boss feel alive, but not unfair
    const regen = (diff==='hard') ? 2 : 1;
    state.boss.hp = Math.min(state.boss.hpMax, state.boss.hp + regen);
    bossUiUpdate();

    emit('hha:judge', { type:'bad', label:`BOSS +${regen}` });
  }

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

      const delta = DIFF.goodScore + Math.min(6, Math.floor(state.combo/5));
      setScore(state.score + delta);
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);

      // boss dmg
      bossDamageOnGoodHit();

      fxBurst(px,py,'good');
      fxPop(px,py,`+${delta}`,'good');
      emit('hha:judge', { type:'good', label:'GOOD!', x:px, y:py, combo: state.combo });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);

        fxBurst(px,py,'block');
        fxPop(px,py,'BLOCK','good');
        emit('hha:judge', { type:'block', label:'BLOCK!', x:px, y:py });

        // boss punish ignored if blocked
        bossPunishOnJunkHit(true);

      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1));
        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        updateGoalsOnMiss();
        miniOnJunkHit();

        // boss punish
        bossPunishOnJunkHit(false);

        fxBurst(px,py,'bad');
        fxPop(px,py,'-','bad');
        emit('hha:judge', { type:'bad', label:'OOPS!', x:px, y:py });
        bodyPulse('gj-junk-hit', 220);
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();

      // star in boss helps (tiny hp drop)
      if(state.boss.active){
        state.boss.hp = Math.max(0, state.boss.hp - 1);
        bossUiUpdate();
        emit('hha:judge', { type:'perfect', label:'STAR HELP!' });
        if(state.boss.hp <= 0) endBossCleared();
      }

      fxBurst(px,py,'star');
      fxPop(px,py,'MISS -1','perfect');
      emit('hha:judge', { type:'perfect', label:'STAR!', x:px, y:py });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);

      fxBurst(px,py,'shield');
      fxPop(px,py,'SHIELD +1','good');
      emit('hha:judge', { type:'good', label:'SHIELD!', x:px, y:py });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);

      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();

      // diamond hits boss hard (fair reward)
      if(state.boss.active){
        const dmg = (diff==='hard') ? 3 : 2;
        state.boss.hp = Math.max(0, state.boss.hp - dmg);
        bossUiUpdate();
        emit('hha:judge', { type:'perfect', label:`BOSS -${dmg}` });
        if(state.boss.hp <= 0) endBossCleared();
      }

      fxBurst(px,py,'diamond');
      fxPop(px,py,`+${bonus}`,'perfect');
      emit('hha:judge', { type:'perfect', label:'DIAMOND!', x:px, y:py });
    }

    setMiniText();
    removeTarget(tObj);

    // apply directors immediately
    applyDirectors();

    // hard fail only when miss explodes beyond survive limit (keeps fairness)
    // (still respects DIFF.missLimit, which is survive-goal limit, but game over uses missLimit*? in rage)
    const hardGameOverLimit = Math.max(DIFF.missLimit, (state.rageOn ? DIFF.missLimit : DIFF.missLimit));
    if(state.miss >= hardGameOverLimit){
      endGame('miss-limit');
    }
  }

  // cVR shooting (crosshair center)
  function shootCrosshair(){
    if(state.ended) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    const R = (isCVR || isVR) ? 82 : 70;
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
      emit('hha:judge', { type:'miss', label:'MISS', x:cx, y:cy });
    }
  }

  ROOT.addEventListener('hha:shoot', shootCrosshair, { passive:true });

  // ----------------------- expiry tick -----------------------
  function expireTargets(){
    const t = now();
    for(const tObj of state.targets.values()){
      if(tObj.hit) continue;

      const age = t - tObj.bornAt;

      // storm wobble: small drift (still inside safe-ish area)
      if(tObj.wobble && tObj.elL){
        const k = tObj.wobble;
        const wobX = Math.sin((age/280) * k.s + k.ax) * (state.rageOn ? 6 : 4);
        const wobY = Math.cos((age/310) * k.s + k.ay) * (state.rageOn ? 6 : 4);
        tObj.elL.style.transform = `translate3d(${wobX}px,${wobY}px,0)`;
        if(tObj.elR) tObj.elR.style.transform = `translate3d(${wobX}px,${wobY}px,0)`;
      }

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

          fxBurst(tObj.x, tObj.y, 'bad');
          fxPop(tObj.x, tObj.y, 'MISS','bad');
          emit('hha:judge', { type:'miss', label:'MISS!', x:tObj.x, y:tObj.y });
          bodyPulse('gj-good-expire', 160);

          removeTarget(tObj);
          applyDirectors();

          if(state.miss >= DIFF.missLimit){
            endGame('miss-limit');
            return;
          }
        }else{
          removeTarget(tObj);
        }
      }
    }
  }

  // ----------------------- spawn scheduler -----------------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    // storm boost (clear excitement)
    if(state.stormOn) r *= 1.22;

    // boss pressure: phase2 is more intense
    if(state.boss.active){
      r *= (state.boss.phase === 2) ? 1.18 : 1.08;
    }

    // rage boost (but capped later)
    if(state.rageOn) r *= 1.18;

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);

      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.15;
    }

    // hard caps (fair!)
    return clamp(r, 0.85, 2.25);
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

    byId('btnReplay')?.addEventListener('click', ()=>{ try{ location.reload(); }catch(_){ } });
    byId('btnBackHub')?.addEventListener('click', ()=>{
      try{
        if(hub) location.href = hub;
        else alert('ยังไม่ได้ใส่ hub url');
      }catch(_){}
    });
  }

  // ----------------------- end game -----------------------
  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

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
      stormOn: state.stormOn,
      bossOn: state.bossOn,
      rageOn: state.rageOn,
      bossHpMax: state.boss.hpMax,
      bossCleared: state.boss.cleared
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
      rtBreakdownJson: summary.rtBreakdownJson,

      reason,
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,

      stormOn: summary.stormOn,
      bossOn: summary.bossOn,
      rageOn: summary.rageOn,
      bossHpMax: summary.bossHpMax,
      bossCleared: summary.bossCleared
    });

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

    tickMini(dt);

    // directors (storm/boss/rage + boss phase)
    applyDirectors();

    // spawn
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();

      // storm burst (controlled)
      if(state.stormOn && rng() < 0.10) spawnOne();
      // rage extra burst (controlled)
      if(state.rageOn && rng() < 0.08) spawnOne();
      // last 8 seconds: excitement (but still capped)
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.10) spawnOne();
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
      startTimeIso: state.startTimeIso
    });

    emit('hha:coach', {
      msg: 'ทริค: อย่าแตะขยะ! ⭐ ลด MISS, 🛡️ กันขยะ (กันแล้วไม่เป็น MISS) — เหลือ 30 วิจะมี STORM!',
      kind: 'tip'
    });

    requestAnimationFrame(tick);
  }

  start();

  // ----------------------- visibility flush helpers -----------------------
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
}