// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + STORM/BOSS/RAGE + FX Director)
// ✅ Mobile / PC / VR(Cardboard) / cVR
// ✅ HUD-safe spawn via CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as miss
// ✅ STORM: timeLeft<=30s
// ✅ BOSS: miss>=4 (HP easy/normal/hard = 10/12/14) + Phase2 lasts 6s
// ✅ RAGE: miss>=5 (boss harder + faster + scarier FX)
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:phase, hha:end, hha:celebrate
// ✅ End summary + back-to-HUB + save last summary (HHA_LAST_SUMMARY)
// ✅ Logger compatible with hha-cloud-logger.js

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ----------------------- helpers -----------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?v=max:v));
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

  // particles (optional, tolerant)
  function fx(){
    return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles || null;
  }
  function fxScorePop(x,y,text){
    const P = fx();
    try{
      if(P && typeof P.scorePop==='function') return P.scorePop(x,y,text);
      if(P && typeof P.popText==='function') return P.popText(x,y,String(text||''));
    }catch(_){}
  }
  function fxBurst(x,y,kind='good'){
    const P = fx();
    try{
      if(P && typeof P.burstAt==='function') return P.burstAt(x,y,kind);
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
  const durationPlannedSec = Math.max(20, Math.min(300, Number(payload.time ?? qs('time','80') ?? 80) || 80));
  const hub = payload.hub ?? qs('hub', null);
  const seedParam = (payload.seed ?? qs('seed', null));
  const seed = (runMode === 'research')
    ? (seedParam ?? (qs('ts', null) ?? 'RESEARCH-SEED'))
    : (seedParam ?? String(Date.now()));

  // logger study params
  const studyId = payload.studyId ?? qs('studyId', qs('study', null));
  const phase = payload.phase ?? qs('phase', null);
  const conditionGroup = payload.conditionGroup ?? qs('conditionGroup', qs('cond', null));

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-10a_BOSS_STORM_RAGE';
  const PROJECT_TAG = 'GoodJunkVR';

  const rng = makeSeededRng(String(seed));

  // play vs research (adaptive off in research)
  const adaptiveOn = (runMode !== 'research');

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

    miss: 0, // good expired + junk hit

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
    fever: 0, // 0-100
    shield: 0, // 0-5

    // quest
    goal: null,
    goalsCleared: 0,
    goalsTotal: 3,
    goals: [],

    mini: null,
    miniCleared: 0,
    miniTotal: 3,
    miniSeq: [],
    miniIndex: 0,

    // spawn
    spawnAcc: 0,
    targets: new Map(), // id => targetObj

    // STORM / BOSS / RAGE
    stormOn: false,
    rageOn: false,
    boss: {
      active:false,
      hp:0,
      hpMax:0,
      phase:0,            // 1 or 2
      phase2LeftSec:0,    // 6s
      lastBossSpawnAt:0,
      bossSpawnEveryMs: 820, // tuned per phase
      aliveBossId: null,
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

    // goal minis
    if(state.goal && state.goal.type==='minis'){
      state.goal.cur = Math.max(0, Math.min(state.goal.target, state.miniCleared));
      if(state.goal.cur >= state.goal.target && !state.goal.done){
        state.goal.done = true;
        state.goalsCleared++;
        emit('hha:judge', { label:'GOAL!', x: innerWidth*0.5, y: innerHeight*0.25 });
      }
      setGoalText();
    }

    emit('hha:judge', { label:'MINI CLEAR!', x: innerWidth*0.5, y: innerHeight*0.33 });
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

  // ----------------------- HUD / fever / shield -----------------------
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
    state.fever = Math.max(0, Math.min(100, state.fever + (Number(delta)||0)));
    HUD.feverFill && (HUD.feverFill.style.width = `${state.fever}%`);
    HUD.feverText && (HUD.feverText.textContent = `${Math.round(state.fever)}%`);
  }
  function addShield(n){
    state.shield = Math.max(0, Math.min(5, state.shield + (Number(n)||0)));
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
    boss: ['🦠','😈','👾','🧟‍♂️'], // boss core
    bossDecoy: ['🍔','🍟','🍩','🍭'], // decoy "fake" (punish if hit)
  };

  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  function dynamicRates(){
    // base
    let spawnMul = 1;
    let junkAdd = 0;

    // STORM: last 30s (if boss isn't showing, storm is the "hype")
    if(state.stormOn && !state.boss.active){
      spawnMul *= 1.18;
      junkAdd += 0.06;
    }

    // BOSS active: more chaos
    if(state.boss.active){
      spawnMul *= (state.boss.phase === 2) ? 1.24 : 1.12;
      junkAdd += (state.boss.phase === 2) ? 0.10 : 0.06;
    }

    // RAGE: when miss>=5 (extra intensity)
    if(state.rageOn){
      spawnMul *= 1.18;
      junkAdd += 0.06;
    }

    return { spawnMul, junkAdd };
  }

  function makeTargetKind(){
    const dyn = dynamicRates();

    // diamond rare reward
    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    const starW = DIFF.starRate;
    const shieldW = DIFF.shieldRate;

    // during boss, keep some rewards but reduce them slightly (focus pressure)
    const rewardMul = state.boss.active ? 0.75 : 1.0;

    let junkW = clamp(DIFF.junkRate + dyn.junkAdd, 0.12, 0.62);
    const goodW = Math.max(0.01, 1 - (junkW + starW*rewardMul + shieldW*rewardMul + diamondW));

    return pickWeighted(rng, [
      {k:'good', w:goodW},
      {k:'junk', w:junkW},
      {k:'star', w:starW*rewardMul},
      {k:'shield', w:shieldW*rewardMul},
      {k:'diamond', w:diamondW},
    ]);
  }

  function spawnDomTarget({ kind, x, y, size, lifeMs, tag='t' }){
    const id = `${tag}${++targetSeq}`;
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

    // count spawned
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
    const size = Math.max(44, Math.min(72, baseSize + randIn(rng, -4, 10)));

    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

    spawnDomTarget({ kind, x,y, size, lifeMs, tag:'t' });
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
          emit('hha:judge', { label:'FAST PASS!', x: innerWidth*0.5, y: innerHeight*0.33 });
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
      g.cur = Math.max(0, Math.min(g.target, state.score));
      if(g.cur >= g.target){
        g.done = true;
        state.goalsCleared++;
        emit('hha:judge', { label:'GOAL!', x: innerWidth*0.5, y: innerHeight*0.25 });
      }
      setGoalText();
    }
  }
  function updateGoalsOnMiss(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='survive'){
      g.cur = Math.max(0, Math.min(g.target, state.miss));
      setGoalText();
    }
  }

  // ----------------------- combo -----------------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){ state.combo = 0; }

  // ----------------------- BOSS control -----------------------
  function bossStart(){
    if(state.boss.active) return;

    state.boss.active = true;
    state.boss.hpMax = DIFF.bossHp;
    state.boss.hp = state.boss.hpMax;
    state.boss.phase = 1;
    state.boss.phase2LeftSec = 0;
    state.boss.lastBossSpawnAt = 0;
    state.boss.bossSpawnEveryMs = 900;
    state.boss.aliveBossId = null;

    emit('hha:phase', { phase:'boss', hp: state.boss.hp, hpMax: state.boss.hpMax, ttlMs: 1800 });
    emit('hha:judge', { label:'BOSS!', x: innerWidth*0.5, y: innerHeight*0.42 });
    bodyPulse('gj-boss-start', 260);
  }

  function bossEnterPhase2(){
    if(!state.boss.active) return;
    if(state.boss.phase >= 2) return;

    state.boss.phase = 2;
    state.boss.phase2LeftSec = 6; // ตามที่คุณกำหนด
    state.boss.bossSpawnEveryMs = 620;

    emit('hha:phase', { phase:'boss', hp: state.boss.hp, hpMax: state.boss.hpMax, ttlMs: 1800 });
    emit('hha:judge', { label:'BOSS PHASE 2!', x: innerWidth*0.5, y: innerHeight*0.42 });
    bodyPulse('gj-boss-p2', 240);
  }

  function bossDown(){
    if(!state.boss.active) return;

    state.boss.active = false;
    state.boss.aliveBossId = null;

    // reward: bonus + shields
    setScore(state.score + 90);
    addShield(1);
    addFever(-18);

    emit('hha:celebrate', { kind:'boss' });
    emit('hha:judge', { label:'BOSS DOWN!', x: innerWidth*0.5, y: innerHeight*0.42 });

    // clear phase visuals unless rage still on
    if(state.rageOn){
      emit('hha:phase', { phase:'rage', ttlMs: 1400 });
    }else if(state.stormOn){
      emit('hha:phase', { phase:'storm', ttlMs: 1200 });
    }else{
      emit('hha:phase', { phase:'clear' });
    }
  }

  function bossMaybeSpawn(dtSec){
    if(!state.boss.active) return;

    // Phase2 timer counts down (6s)
    if(state.boss.phase === 2){
      state.boss.phase2LeftSec = Math.max(0, state.boss.phase2LeftSec - dtSec);
      if(state.boss.phase2LeftSec <= 0){
        // fall back to phase 1 spawn tempo, but boss still active
        state.boss.phase = 1;
        state.boss.bossSpawnEveryMs = 820;
      }
    }

    // keep emitting boss phase info occasionally (hp display for FX director chip)
    if((Math.floor(state.tNow/700) % 6) === 0){
      emit('hha:phase', { phase: state.rageOn ? 'rage' : 'boss', hp: state.boss.hp, hpMax: state.boss.hpMax, ttlMs: 900 });
    }

    // ensure at most 1 boss core alive (clean if missing)
    if(state.boss.aliveBossId && !state.targets.has(state.boss.aliveBossId)){
      state.boss.aliveBossId = null;
    }

    const t = now();
    const every = state.rageOn ? Math.max(520, state.boss.bossSpawnEveryMs - 80) : state.boss.bossSpawnEveryMs;

    // spawn boss core if none alive, or sometimes spawn decoys to confuse
    if(!state.boss.aliveBossId && (t - state.boss.lastBossSpawnAt) >= every){
      state.boss.lastBossSpawnAt = t;

      const rect = getSafeRect();
      const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
      const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

      // boss core
      const size = state.rageOn ? 92 : 86;
      const lifeMs = state.rageOn ? 1200 : 1450;

      const bossObj = spawnDomTarget({ kind:'boss', x,y, size, lifeMs, tag:'b' });
      state.boss.aliveBossId = bossObj.id;

      emit('hha:judge', { label:'BOSS APPEAR!', x, y });

      // decoys around (punish if hit)
      const nDecoy = state.rageOn ? 2 : (state.boss.phase===2 ? 2 : 1);
      for(let i=0;i<nDecoy;i++){
        const dx = Math.max(rect.xMin, Math.min(rect.xMax, x + randIn(rng, -160, 160)));
        const dy = Math.max(rect.yMin, Math.min(rect.yMax, y + randIn(rng, -140, 140)));
        const dSize = state.rageOn ? 68 : 62;
        const dLife = state.rageOn ? 900 : 1050;
        // we map as 'bossDecoy' kind
        spawnDomTarget({ kind:'bossDecoy', x:Math.floor(dx), y:Math.floor(dy), size:dSize, lifeMs:dLife, tag:'d' });
      }
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
      const delta = DIFF.goodScore + Math.min(6, Math.floor(state.combo/5));
      setScore(state.score + delta);
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);
      fxBurst(px,py,'good');
      fxScorePop(px,py,`+${delta}`);
      emit('hha:judge', { label:'GOOD!', x:px, y:py });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);
        fxBurst(px,py,'block');
        fxScorePop(px,py,'BLOCK');
        emit('hha:judge', { label:'BLOCK!', x:px, y:py });
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
        emit('hha:judge', { label:'OOPS!', x:px, y:py });
        bodyPulse('gj-junk-hit', 220);
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();
      fxBurst(px,py,'star');
      fxScorePop(px,py,'MISS -1');
      emit('hha:judge', { label:'STAR!', x:px, y:py });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      fxBurst(px,py,'shield');
      fxScorePop(px,py,'SHIELD +1');
      emit('hha:judge', { label:'SHIELD!', x:px, y:py });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();
      fxBurst(px,py,'diamond');
      fxScorePop(px,py,`+${bonus}`);
      emit('hha:judge', { label:'DIAMOND!', x:px, y:py });

    } else if(kind==='boss'){
      // ✅ boss core hit = reduce HP
      resetCombo();
      addFever(8);

      // harder in rage/phase2: need more hits feeling (hp already fixed, but punish stronger)
      const dmg = state.rageOn ? 1 : 1;
      state.boss.hp = Math.max(0, state.boss.hp - dmg);

      // phase2 trigger when hp <= half
      const half = Math.ceil(state.boss.hpMax * 0.5);
      if(state.boss.phase === 1 && state.boss.hp <= half){
        bossEnterPhase2();
      }

      emit('hha:judge', { label:'BOSS HIT!', x:px, y:py });
      emit('hha:phase', { phase: state.rageOn ? 'rage' : 'boss', hp: state.boss.hp, hpMax: state.boss.hpMax, ttlMs: 1200 });

      fxBurst(px,py,'bad');
      fxScorePop(px,py,`HP ${state.boss.hp}/${state.boss.hpMax}`);
      bodyPulse('gj-boss-hit', 210);

      // reward small score each hit
      setScore(state.score + (state.rageOn ? 10 : 8));

      // clear alive boss id
      if(state.boss.aliveBossId === tObj.id) state.boss.aliveBossId = null;

      if(state.boss.hp <= 0){
        removeTarget(tObj);
        bossDown();
        return;
      }

    } else if(kind==='bossDecoy'){
      // ✅ decoy punishes: counts as miss + big score cut (shield does NOT block decoy)
      resetCombo();
      addFever(12);

      setMiss(state.miss + 1);
      setScore(Math.max(0, state.score - (state.rageOn ? 18 : 14)));
      updateGoalsOnMiss();

      emit('hha:judge', { label:'TRAP!', x:px, y:py });
      fxBurst(px,py,'bad');
      fxScorePop(px,py,'TRAP');
      bodyPulse('gj-decoy-hit', 220);
    }

    setMiniText();
    removeTarget(tObj);

    // end conditions
    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // cVR shooting (crosshair center) — uses last known target x/y
  function shootCrosshair(){
    if(state.ended) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    const R = 86;
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
      emit('hha:judge', { label:'WHIFF', x:cx, y:cy });
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
          setMiss(state.miss + 1);
          updateGoalsOnMiss();

          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          fxBurst(tObj.x, tObj.y, 'bad');
          fxScorePop(tObj.x, tObj.y, 'MISS');
          emit('hha:judge', { label:'MISS!', x:tObj.x, y:tObj.y });
          bodyPulse('gj-good-expire', 160);

          if(state.miss >= DIFF.missLimit){
            removeTarget(tObj);
            endGame('miss-limit');
            return;
          }
        }

        // boss core expired: allow it to despawn (player has to wait next spawn)
        if(kind === 'boss'){
          if(state.boss.aliveBossId === tObj.id) state.boss.aliveBossId = null;
          emit('hha:judge', { label:'BOSS ESCAPE!', x:tObj.x, y:tObj.y });
        }

        removeTarget(tObj);
      }
    }
  }

  // ----------------------- spawn scheduler -----------------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = Math.max(0, Math.min(1, (state.miss / DIFF.missLimit)));
      const comboBoost = Math.max(0, Math.min(1, state.combo / 18));
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);

      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.15;
    }

    // STORM/BOSS/RAGE multipliers
    const dyn = dynamicRates();
    r *= dyn.spawnMul;

    return Math.max(0.8, Math.min(2.25, r));
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
    // If your HTML already has #endOverlay and you want aria-hidden control,
    // keep this lightweight overlay. Otherwise this custom card is fine.
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

    // clear phase visuals
    emit('hha:phase', { phase:'clear' });

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

    if(state.goal && state.goal.type==='survive' && !state.goal.done){
      if(state.miss <= DIFF.missLimit){
        state.goal.done = true;
        state.goalsCleared++;
      }
      setGoalText();
    }
    state.goalsCleared = Math.max(0, Math.min(state.goalsTotal, state.goalsCleared));

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
      grade,
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

    // time
    state.timeLeftSec -= dt;
    if(state.timeLeftSec < 0) state.timeLeftSec = 0;
    setTimeLeft(state.timeLeftSec);
    updateLowTimeFx();

    // ✅ STORM trigger (≤30s)
    if(!state.stormOn && state.timeLeftSec <= 30){
      state.stormOn = true;
      emit('hha:phase', { phase:'storm', ttlMs: 1800 });
      emit('hha:judge', { label:'STORM!', x: innerWidth*0.5, y: innerHeight*0.40 });
    }

    // ✅ BOSS/RAGE triggers
    if(!state.boss.active && state.miss >= 4){
      bossStart();
    }
    if(!state.rageOn && state.miss >= 5){
      state.rageOn = true;
      emit('hha:phase', { phase:'rage', ttlMs: 1800 });
      emit('hha:judge', { label:'RAGE!', x: innerWidth*0.5, y: innerHeight*0.40 });
      bodyPulse('gj-rage', 240);
    }

    // mini tick
    tickMini(dt);

    // boss spawner
    bossMaybeSpawn(dt);

    // spawn normal targets
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.12) spawnOne();
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

    // quest init
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
      msg: 'ทริค: อย่าแตะขยะ! ⭐ ลด MISS, 🛡️ กันขยะ (กันแล้วไม่เป็น MISS) — ถ้า MISS เยอะจะเจอ BOSS/RAGE!',
      kind: 'tip'
    });

    requestAnimationFrame(tick);
  }

  start();

  // ----------------------- visibility helpers -----------------------
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