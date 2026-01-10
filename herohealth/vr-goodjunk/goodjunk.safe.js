// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + FX Contract + Boss/Storm/Rage)
// ✅ Emits FX-ready events:
//    - hha:judge {type,x,y,combo,label}
//    - hha:score {delta,score,x,y}
//    - hha:miss  {miss,x,y,reason}
// ✅ Storm: timeLeft<=30s
// ✅ Boss: miss>=4 (once)  | Rage: miss>=5 (once)
// ✅ Boss HP by diff: 10/12/14  | Phase2 window: 6s (harder pressure)
// ✅ Fair: research deterministic (seed), adaptive off in research

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC = document;

  // ----------------------- helpers -----------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function emitDoc(name, detail){
    try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function emitBoth(name, detail){
    emit(name, detail);
    emitDoc(name, detail);
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

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-10a';
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

    // misses (HHA standard for GoodJunk: good expired + junk hit; shield-blocked junk DOES NOT count)
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
    targets: new Map(),

    // storm / boss / rage
    storm: { active:false, started:false },
    boss: {
      started:false,
      active:false,
      hpMax: DIFF.bossHP,
      hp: DIFF.bossHP,
      phase2Active:false,
      phase2Until: 0,
      phase2Sec: 6,
      lastSpawnBossAt: 0,
      spawnBossEveryMs: 1200,
      bossEmoji: '😈',
    },
    rage: { started:false, active:false },

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
      emitBoth('quest:update', { mini:null, goal:state.goal });
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
    emitBoth('quest:update', { mini:m, goal:state.goal });
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
        emitBoth('hha:judge', { type:'good', label:'GOAL!', x: innerWidth/2, y: innerHeight*0.25, combo: state.combo });
      }
      setGoalText();
    }

    emitBoth('hha:judge', { type:'perfect', label:'MINI CLEAR!', x: innerWidth/2, y: innerHeight*0.28, combo: state.combo });
    emitBoth('hha:celebrate', { kind:'mini' });
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

  // ----------------------- HUD / fever / shield + FX contract emits -----------------------
  function setScore(v, x, y, deltaOverride){
    const prev = state.score;
    state.score = Math.max(0, Math.floor(v));
    HUD.score && (HUD.score.textContent = String(state.score));
    const delta = (Number.isFinite(deltaOverride) ? deltaOverride : (state.score - prev));
    emitBoth('hha:score', { delta, score: state.score, x: x ?? innerWidth/2, y: y ?? innerHeight/2 });
  }

  function setMiss(v, x, y, reason='miss'){
    state.miss = Math.max(0, Math.floor(v));
    HUD.miss && (HUD.miss.textContent = String(state.miss));
    emitBoth('hha:miss', { miss: state.miss, x: x ?? innerWidth/2, y: y ?? innerHeight/2, reason });
  }

  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    HUD.time && (HUD.time.textContent = String(Math.ceil(state.timeLeftSec)));
    emitBoth('hha:time', { t: state.timeLeftSec });
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
    boss: ['😈'],
  };

  function makeTargetKind(){
    // Boss target only while boss active (spawned separately)
    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    const starW = DIFF.starRate;
    const shieldW = DIFF.shieldRate;

    // pressure modifiers
    let junkW = DIFF.junkRate;
    if(state.storm.active) junkW += 0.06;
    if(state.boss.active) junkW += 0.08;
    if(state.rage.active) junkW += 0.10;

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

  function spawnTarget(kindOverride=null, bossMeta=null){
    if(state.ended) return;

    const kind = kindOverride || makeTargetKind();

    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;

    const id = `t${++targetSeq}`;
    const baseLife =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      Math.round(DIFF.goodLifeMs * 1.25);

    // storm/boss/rage makes life shorter (more pressure) — fair caps
    let lifeMs = baseLife;
    if(state.storm.active) lifeMs *= 0.92;
    if(state.boss.active)  lifeMs *= 0.88;
    if(state.rage.active)  lifeMs *= 0.82;
    lifeMs = Math.round(clamp(lifeMs, 650, 3200));

    const baseSize = (kind==='good') ? 54 : (kind==='junk') ? 56 : 50;
    let size = clamp(baseSize + randIn(rng, -4, 10), 44, 72);

    // boss target bigger + clearer
    if(kind === 'boss'){
      size = clamp(74 + randIn(rng, -4, 8), 64, 90);
      lifeMs = Math.round(clamp(1100 + randIn(rng, -120, 160), 800, 1600));
    }

    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

    const elL = DOC.createElement('div');
    elL.className = 'gj-target spawn';
    elL.dataset.id = id;
    elL.dataset.kind = kind;
    if(bossMeta?.isBoss) elL.dataset.boss = '1';
    elL.textContent = (kind === 'boss') ? state.boss.bossEmoji : pickEmoji(kind);
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
      lifeMs,
      x,y,
      elL,
      elR,
      hit:false,
      isBoss: !!bossMeta?.isBoss,
      bossDmg: bossMeta?.bossDmg || 1,
    };

    elL.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onTargetHit(tObj, { via:'tap', clientX: ev.clientX, clientY: ev.clientY });
    }, { passive:false });

    LAYER_L.appendChild(elL);
    if(elR && LAYER_R) LAYER_R.appendChild(elR);

    requestAnimationFrame(()=>{ try{ elL.classList.add('spawn'); if(elR) elR.classList.add('spawn'); }catch(_){ } });

    state.targets.set(id, tObj);
  }

  function spawnOne(){ spawnTarget(null, null); }

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

  // ----------------------- RT stats -----------------------
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

  // ----------------------- minis -----------------------
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
          emitBoth('hha:judge', { type:'perfect', label:'FAST PASS!', x: innerWidth/2, y: innerHeight*0.30, combo: state.combo });
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

  // ----------------------- goals -----------------------
  function updateGoalsOnScore(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='score'){
      g.cur = clamp(state.score, 0, g.target);
      if(g.cur >= g.target){
        g.done = true;
        state.goalsCleared++;
        emitBoth('hha:judge', { type:'good', label:'GOAL!', x: innerWidth/2, y: innerHeight*0.22, combo: state.combo });
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

  // ----------------------- storm / boss / rage ----------
  function updateStormBossRage() {
    // STORM: when timeLeft <= 30s
    if(!state.storm.started && state.timeLeftSec <= 30){
      state.storm.started = true;
      state.storm.active = true;
      emitBoth('hha:judge', { type:'storm', label:'STORM!', x: innerWidth/2, y: innerHeight*0.20, combo: state.combo });
    }
    // storm ends at time <= 5 (let low-time overlay be the final drama) OR at end
    if(state.storm.active && state.timeLeftSec <= 5){
      state.storm.active = false;
    }

    // BOSS: miss >= 4 (once)
    if(!state.boss.started && state.miss >= 4){
      state.boss.started = true;
      state.boss.active = true;
      state.boss.hpMax = DIFF.bossHP;
      state.boss.hp = DIFF.bossHP;
      state.boss.phase2Active = false;
      state.boss.phase2Until = 0;
      state.boss.lastSpawnBossAt = 0;
      emitBoth('hha:judge', { type:'boss', label:'BOSS!', x: innerWidth/2, y: innerHeight*0.24, combo: state.combo });
    }

    // RAGE: miss >= 5 (once)
    if(!state.rage.started && state.miss >= 5){
      state.rage.started = true;
      state.rage.active = true;
      emitBoth('hha:judge', { type:'rage', label:'RAGE!', x: innerWidth/2, y: innerHeight*0.26, combo: state.combo });
    }
  }

  function bossStartPhase2Window(){
    state.boss.phase2Active = true;
    state.boss.phase2Until = now() + state.boss.phase2Sec * 1000;
    emitBoth('hha:judge', { type:'boss', label:'PHASE 2!', x: innerWidth/2, y: innerHeight*0.28, combo: state.combo });
  }

  function bossTick(){
    if(!state.boss.active || state.ended) return;

    // enter Phase2 when HP low (<=40%) and not yet started
    if(!state.boss.phase2Active){
      const thr = Math.ceil(state.boss.hpMax * 0.4);
      if(state.boss.hp <= thr){
        bossStartPhase2Window();
      }
    } else {
      if(now() >= state.boss.phase2Until){
        state.boss.phase2Active = false;
      }
    }

    // spawn boss target periodically
    const t = now();
    const every = state.boss.phase2Active ? 820 : state.rage.active ? 760 : 1100;
    if((t - state.boss.lastSpawnBossAt) >= every){
      state.boss.lastSpawnBossAt = t;
      spawnTarget('boss', { isBoss:true, bossDmg: 1 });
      // pressure burst in phase2 (fair: limited)
      if(state.boss.phase2Active && rng() < 0.55) spawnTarget(null, null);
      if(state.rage.active && rng() < 0.45) spawnTarget(null, null);
    }
  }

  function bossDamage(dmg, x, y){
    if(!state.boss.active) return;
    state.boss.hp = Math.max(0, state.boss.hp - (Number(dmg)||1));

    emitBoth('hha:judge', { type:'boss', label:`HP ${state.boss.hp}/${state.boss.hpMax}`, x, y, combo: state.combo });

    if(state.boss.hp <= 0){
      // boss cleared
      state.boss.active = false;

      const bonus = 90 + (diff==='hard'? 40 : diff==='easy'? 0 : 20);
      setScore(state.score + bonus, x, y, bonus);
      addFever(-18);
      addShield(2);

      emitBoth('hha:judge', { type:'perfect', label:'BOSS CLEAR!', x: innerWidth/2, y: innerHeight*0.22, combo: state.combo });
      emitBoth('hha:celebrate', { kind:'boss' });
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

    // BOSS HIT
    if(kind === 'boss' && tObj.isBoss){
      addCombo();
      bossDamage(tObj.bossDmg || 1, px, py);
      // tiny score for encouragement (fair)
      const delta = 4 + Math.min(6, Math.floor(state.combo/6));
      setScore(state.score + delta, px, py, delta);
      emitBoth('hha:judge', { type:'boss', label:'HIT!', x:px, y:py, combo: state.combo });
      removeTarget(tObj);
      return;
    }

    if(kind==='good'){
      state.nHitGood++;
      addCombo();
      addFever(3.2);
      const delta = DIFF.goodScore + Math.min(6, Math.floor(state.combo/5));
      setScore(state.score + delta, px, py, delta);
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);
      emitBoth('hha:judge', { type: (rtMs<=330 ? 'perfect':'good'), label:'GOOD!', x:px, y:py, combo: state.combo });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);
        emitBoth('hha:judge', { type:'block', label:'BLOCK!', x:px, y:py, combo: state.combo });
      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1), px, py, 'junk-hit');
        setScore(state.score + (DIFF.junkPenaltyScore||-10), px, py, (DIFF.junkPenaltyScore||-10));

        updateGoalsOnMiss();
        miniOnJunkHit();
        emitBoth('hha:judge', { type:'bad', label:'OOPS!', x:px, y:py, combo: state.combo });

        // triggers
        updateStormBossRage();
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      const before = state.miss;
      const after = Math.max(0, state.miss - 1);
      if(after !== before) setMiss(after, px, py, 'star');
      updateGoalsOnMiss();
      emitBoth('hha:judge', { type:'good', label:'STAR!', x:px, y:py, combo: state.combo });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      emitBoth('hha:judge', { type:'good', label:'SHIELD!', x:px, y:py, combo: state.combo });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus, px, py, bonus);
      updateGoalsOnScore();
      emitBoth('hha:judge', { type:'perfect', label:'DIAMOND!', x:px, y:py, combo: state.combo });
    }

    setMiniText();
    removeTarget(tObj);

    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
      return;
    }
  }

  // cVR/VR shooting (crosshair center) — listens to hha:shoot
  function shootCrosshair(){
    if(state.ended) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    const R = (isCVR || isVR) ? 88 : 72;
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
      emitBoth('hha:judge', { type:'miss', label:'MISS SHOT', x:cx, y:cy, combo: state.combo });
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
          state.nExpireGood++;
          resetCombo();
          addFever(6);

          setMiss(state.miss + 1, tObj.x, tObj.y, 'good-expire');
          updateGoalsOnMiss();

          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          emitBoth('hha:judge', { type:'miss', label:'MISS!', x:tObj.x, y:tObj.y, combo: state.combo });

          updateStormBossRage();

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

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);

      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.15;
    }

    // storm/boss/rage pressure (fair caps)
    if(state.storm.active) r *= 1.12;
    if(state.boss.active)  r *= 1.10;
    if(state.boss.phase2Active) r *= 1.18;
    if(state.rage.active)  r *= 1.12;

    return clamp(r, 0.8, 2.15);
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
    // Minimal: reuse your existing end overlay if present, else fallback card
    const endOverlay = byId('endOverlay');
    if(endOverlay){
      try{
        byId('endTitle') && (byId('endTitle').textContent = (summary.reason === 'miss-limit') ? 'Game Over' : 'Completed');
        byId('endSub') && (byId('endSub').textContent = `reason=${summary.reason} | run=${summary.runMode} | view=${summary.device}`);
        byId('endGrade') && (byId('endGrade').textContent = summary.grade || '—');
        byId('endScore') && (byId('endScore').textContent = String(summary.scoreFinal ?? 0));
        byId('endMiss') && (byId('endMiss').textContent = String(summary.misses ?? 0));
        byId('endTime') && (byId('endTime').textContent = String(Math.round(Number(summary.durationPlayedSec||0))));
        endOverlay.style.display = 'flex';
        endOverlay.setAttribute('aria-hidden','false');
        return;
      }catch(_){}
    }

    // fallback
    const ov = DOC.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:220;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.86);backdrop-filter:blur(10px);padding:16px;';
    const card = DOC.createElement('div');
    card.style.cssText = 'width:min(760px,94vw);background:rgba(2,6,23,.86);border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:18px;color:#e5e7eb;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          <div style="font-size:22px;font-weight:1000;">สรุปผล — GoodJunkVR</div>
          <div style="margin-top:6px;color:#94a3b8;font-weight:900;font-size:12px;">
            view=${summary.device} | run=${summary.runMode} | diff=${summary.diff}
          </div>
        </div>
        <div style="font-size:56px;font-weight:1200;line-height:1;">${summary.grade}</div>
      </div>
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.20);border-radius:18px;padding:12px;">
          <div style="color:#94a3b8;font-weight:1000;font-size:12px;">SCORE</div>
          <div style="font-size:26px;font-weight:1200;">${summary.scoreFinal}</div>
          <div style="margin-top:10px;color:#94a3b8;font-weight:1000;font-size:12px;">MISS</div>
          <div style="font-size:22px;font-weight:1200;">${summary.misses}</div>
        </div>
        <div style="background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.20);border-radius:18px;padding:12px;">
          <div style="color:#94a3b8;font-weight:1000;font-size:12px;">GOAL / MINI</div>
          <div style="font-size:16px;font-weight:1100;margin-top:4px;">
            Goals: ${summary.goalsCleared}/${summary.goalsTotal}<br/>
            Mini : ${summary.miniCleared}/${summary.miniTotal}
          </div>
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="gjReplay" type="button" style="flex:1;min-width:220px;height:54px;border-radius:16px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.16);color:#eafff3;font-weight:1200;font-size:16px;cursor:pointer;">เล่นอีกครั้ง</button>
        <button id="gjHub" type="button" style="flex:1;min-width:220px;height:54px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.55);color:#e5e7eb;font-weight:1200;font-size:16px;cursor:pointer;">กลับ HUB</button>
      </div>
    `;
    ov.appendChild(card);
    DOC.body.appendChild(ov);

    card.querySelector('#gjReplay')?.addEventListener('click', ()=> location.reload());
    card.querySelector('#gjHub')?.addEventListener('click', ()=>{
      if(hub) location.href = hub;
      else alert('ยังไม่ได้ใส่ hub url');
    });
  }

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

      goalsCleared: clamp(state.goalsCleared, 0, state.goalsTotal),
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

    emitBoth('hha:end', {
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
    });

    emitBoth('hha:celebrate', { kind:'end', grade });
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

    // storm/boss/rage triggers
    updateStormBossRage();

    // minis
    tickMini(dt);

    // boss tick (spawns boss targets + phase2 window)
    bossTick();

    // spawn
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();

      // extra burst in high drama (fair)
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.12) spawnOne();
      if(state.boss.phase2Active && rng() < 0.18) spawnOne();
      if(state.rage.active && rng() < 0.15) spawnOne();
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
    setScore(0, innerWidth/2, innerHeight/2, 0);
    setMiss(0, innerWidth/2, innerHeight/2, 'init');
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

    emitBoth('quest:update', { goal: state.goal, mini: state.mini });
  }

  function start(){
    if(state.started) return;
    state.started = true;

    state.tStart = now();
    state.startTimeIso = new Date().toISOString();

    initHud();

    emitBoth('hha:start', {
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

    emitBoth('hha:coach', {
      msg: 'ทริค: อย่าแตะขยะ! ⭐ ลด MISS และ 🛡️ บล็อกขยะ (บล็อกแล้วไม่เป็น MISS)',
      kind: 'tip'
    });

    requestAnimationFrame(tick);
  }

  start();

  // expose debug
  ROOT.__GJ_STATE__ = state;
}