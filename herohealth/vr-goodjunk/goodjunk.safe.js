// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + THREAT MODES)
// ✅ Mobile / PC / VR(Cardboard) / cVR
// ✅ HUD-safe spawn via --gj-top-safe / --gj-bottom-safe
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as miss
// ✅ Storm/Boss/Rage: time<=30 => storm, miss>=4 => boss, miss>=5 => rage (fair)
// ✅ Emits: hha:score(delta+x+y), hha:judge(type+x+y+combo), hha:miss, hha:end, hha:celebrate
// ✅ End summary + save last summary (HHA_LAST_SUMMARY)

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
  function fx(){ return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles || null; }
  function fxPop(x,y,text,cls){
    const P = fx();
    try{ P?.popText?.(x,y,text,cls); }catch(_){}
  }
  function fxBurst(x,y,r){
    const P = fx();
    try{ P?.burst?.(x,y,{r}); }catch(_){}
  }
  function fxShock(x,y,r){
    const P = fx();
    try{ P?.shockwave?.(x,y,{r}); }catch(_){ fxBurst(x,y,r); }
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

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-07_fxBossRage';
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

    // misses
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

    // threat modes
    threat: { storm:false, boss:false, rage:false },
    bossSpawnAcc: 0,

    // session
    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  // ----------------------- THREAT FX (ตามที่คุณกำหนด) -----------------------
  function updateThreatFx(){
    const storm = (state.timeLeftSec <= 30);
    const boss  = (state.miss >= 4);
    const rage  = (state.miss >= 5);

    state.threat.storm = storm;
    state.threat.boss  = boss;
    state.threat.rage  = rage;

    const b = DOC.body;
    b.classList.toggle('fx-storm', storm);
    b.classList.toggle('fx-boss', boss);
    b.classList.toggle('fx-rage', rage);
  }

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
      { type:'survive', title:'เอาตัวรอด', target: DIFF.missLimit, cur:0, done:false, desc:`MISS ต้องไม่เกิน ${DIFF.missLimit}` },
      { type:'score',   title:'ทำคะแนน', target: (diff==='easy'? 420 : diff==='hard'? 520 : 470), cur:0, done:false, desc:`เก็บของดีเพื่อทำคะแนน` },
      { type:'minis',   title:'ทำ MINI', target: 2, cur:0, done:false, desc:`ผ่าน MINI ให้ได้ 2 ครั้ง` }
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
        emit('hha:judge', { type:'good', label:'GOAL!', x: innerWidth/2, y: innerHeight*0.35 });
      }
      setGoalText();
    }

    emit('hha:judge', { type:'perfect', label:'MINI CLEAR!', x: innerWidth/2, y: innerHeight*0.35 });
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
    }
  }

  // ----------------------- HUD / fever / shield -----------------------
  function setScore(v){
    state.score = Math.max(0, Math.floor(v));
    HUD.score && (HUD.score.textContent = String(state.score));
  }
  function addScore(delta, x, y){
    delta = Math.floor(Number(delta)||0);
    if(delta === 0) return;
    setScore(state.score + delta);
    emit('hha:score', { delta, x, y });
  }

  function setMiss(v){
    state.miss = Math.max(0, Math.floor(v));
    HUD.miss && (HUD.miss.textContent = String(state.miss));
    updateThreatFx();
  }

  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    HUD.time && (HUD.time.textContent = String(Math.ceil(state.timeLeftSec)));
    emit('hha:time', { t: state.timeLeftSec });
    updateThreatFx();
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
    boss: ['👾','💀','🔥'],
    decoy: ['🍏','🥦','🍌','🥕'], // looks "good-ish" but is trap in boss phase
  };

  function makeTargetKind(){
    // base weights
    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    const starW = DIFF.starRate;
    const shieldW = DIFF.shieldRate;

    // boss/rage adds decoy a bit (fair)
    const decoyW = (state.threat.rage ? 0.06 : state.threat.boss ? 0.035 : 0);
    const junkW  = clamp(DIFF.junkRate + (state.threat.storm ? 0.03 : 0) + (state.threat.rage ? 0.04 : state.threat.boss ? 0.02 : 0), 0.10, 0.60);

    const goodW = Math.max(0.01, 1 - (junkW + starW + shieldW + diamondW + decoyW));
    return pickWeighted(rng, [
      {k:'good', w:goodW},
      {k:'junk', w:junkW},
      {k:'star', w:starW},
      {k:'shield', w:shieldW},
      {k:'diamond', w:diamondW},
      {k:'decoy', w:decoyW},
    ]);
  }

  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  function spawnTarget(kind, opts={}){
    if(state.ended) return;

    // count spawned
    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;

    const id = `t${++targetSeq}`;

    // life tweaks (rage slightly shorter but fair)
    const baseLife =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='diamond') ? Math.round(DIFF.goodLifeMs * 1.25) :
      (kind==='decoy') ? Math.round(DIFF.goodLifeMs * 1.00) :
      (kind==='boss') ? Math.round(DIFF.goodLifeMs * 1.55) :
      Math.round(DIFF.goodLifeMs * 1.10);

    const lifeMs = Math.round(baseLife * (state.threat.rage ? 0.90 : 1.0));

    // size scaling
    let baseSize = 54;
    if(kind==='junk') baseSize = 56;
    if(kind==='star' || kind==='shield') baseSize = 50;
    if(kind==='diamond') baseSize = 52;
    if(kind==='decoy') baseSize = 58;
    if(kind==='boss')  baseSize = 74;

    const size = clamp(baseSize + randIn(rng, -4, 10), 44, 86);

    const rect = getSafeRect();
    const x = Math.floor(opts.x ?? randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(opts.y ?? randIn(rng, rect.yMin, rect.yMax));

    const elL = DOC.createElement('div');
    elL.className = 'gj-target spawn';
    elL.dataset.id = id;
    elL.dataset.kind = kind;
    elL.textContent = pickEmoji(kind);
    elL.style.left = `${x}px`;
    elL.style.top  = `${y}px`;
    elL.style.fontSize = `${size}px`;

    // clone for right eye
    let elR = null;
    if(LAYER_R){
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
    }

    const bornAt = now();
    const tObj = {
      id, kind, bornAt, lifeMs, x,y,
      elL, elR,
      hit:false,
      // boss armor
      hp: (kind==='boss') ? (state.threat.rage ? 4 : 3) : 1,
    };

    // click/tap handling (mobile/pc direct)
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
          emit('hha:judge', { type:'perfect', label:'FAST PASS!', x: innerWidth/2, y: innerHeight*0.35 });
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
        emit('hha:judge', { type:'perfect', label:'GOAL!', x: innerWidth/2, y: innerHeight*0.35 });
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
  function addCombo(){ state.combo++; if(state.combo > state.comboMax) state.comboMax = state.combo; }
  function resetCombo(){ state.combo = 0; }

  function judge(type, x, y, extra={}){
    emit('hha:judge', Object.assign({ type, x, y, combo: state.combo }, extra));
  }

  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

    const px = meta.clientX ?? tObj.x;
    const py = meta.clientY ?? tObj.y;

    // BOSS armor
    if(kind==='boss'){
      tObj.hp = Math.max(0, (tObj.hp|0) - 1);
      fxShock(px,py, 86);
      bodyPulse('gj-boss-hit', 140);

      if(tObj.hp > 0){
        // partial hit feedback (fair)
        addCombo();
        addFever(2.0);
        addScore(8, px, py);
        judge('good', px, py, { label:`BOSS ${tObj.hp}` });
        return; // keep target alive
      }

      // boss down
      tObj.hit = true;
      addCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1)); // reward: reduce miss by 1 (fair)
      const bonus = state.threat.rage ? 65 : 50;
      addScore(bonus, px, py);
      judge('perfect', px, py, { label:'BOSS DOWN!' });
      emit('hha:celebrate', { kind:'boss' });
      removeTarget(tObj);
      return;
    }

    tObj.hit = true;

    if(kind==='good'){
      state.nHitGood++;
      addCombo();
      addFever(3.2);

      const delta = DIFF.goodScore + Math.min(6, Math.floor(state.combo/5));
      addScore(delta, px, py);

      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);

      fxShock(px,py, 58);
      judge('good', px, py, { label:'GOOD!' });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);
        fxBurst(px,py, 44);
        fxPop(px,py,'BLOCK','big');
        judge('block', px, py, { label:'BLOCK!' });
      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1));
        addScore((DIFF.junkPenaltyScore||-10), px, py);
        updateGoalsOnMiss();
        miniOnJunkHit();

        fxShock(px,py, 66);
        judge('bad', px, py, { label:'OOPS!' });
        bodyPulse('gj-junk-hit', 220);

        emit('hha:miss', { x:px, y:py, reason:'junk' });
      }

    } else if(kind==='decoy'){
      // decoy is a trap (boss phase) but FAIR: penalty lighter than junk
      resetCombo();
      addFever(6.5);
      setMiss(state.miss + 1);
      addScore(-8, px, py);
      updateGoalsOnMiss();
      miniOnJunkHit();

      fxShock(px,py, 62);
      judge('bad', px, py, { label:'DECOY!' });
      emit('hha:miss', { x:px, y:py, reason:'decoy' });

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();
      fxShock(px,py, 60);
      fxPop(px,py,'MISS -1','big');
      judge('good', px, py, { label:'STAR!' });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      fxBurst(px,py, 50);
      fxPop(px,py,'SHIELD +1','big');
      judge('good', px, py, { label:'SHIELD!' });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      addScore(bonus, px, py);
      updateGoalsOnScore();
      fxShock(px,py, 76);
      judge('perfect', px, py, { label:'DIAMOND!' });
    }

    setMiniText();
    removeTarget(tObj);

    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // cVR/VR shooting (crosshair center)
  function shootCrosshair(){
    if(state.ended) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    const R = (isCVR || isVR) ? 92 : 70;
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

    if(best) onTargetHit(best, { via:'shoot', clientX: cx, clientY: cy });
    else bodyPulse('gj-miss-shot', 120);
  }

  ROOT.addEventListener('hha:shoot', shootCrosshair, { passive:true });

  // ----------------------- expiry tick -----------------------
  function expireTargets(){
    const t = now();
    for(const tObj of state.targets.values()){
      if(tObj.hit) continue;
      const age = t - tObj.bornAt;
      if(age < tObj.lifeMs) continue;

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

        fxBurst(tObj.x, tObj.y, 64);
        judge('miss', tObj.x, tObj.y, { label:'MISS!' });
        bodyPulse('gj-good-expire', 160);
        emit('hha:miss', { x:tObj.x, y:tObj.y, reason:'expire-good' });

        removeTarget(tObj);

        if(state.miss >= DIFF.missLimit){
          endGame('miss-limit');
          return;
        }
        continue;
      }

      if(kind === 'boss'){
        // fair but scary: boss timeout adds 1 miss (pressure)
        resetCombo();
        addFever(7);
        setMiss(state.miss + 1);
        addScore(-10, tObj.x, tObj.y);
        updateGoalsOnMiss();
        judge('miss', tObj.x, tObj.y, { label:'BOSS ESCAPED!' });
        emit('hha:miss', { x:tObj.x, y:tObj.y, reason:'boss-escape' });
        removeTarget(tObj);

        if(state.miss >= DIFF.missLimit){
          endGame('miss-limit');
          return;
        }
        continue;
      }

      // other kinds expire: remove only
      removeTarget(tObj);
    }
  }

  // ----------------------- spawn scheduler -----------------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);

      // storm boosts excitement (fair)
      if(state.timeLeftSec <= 30) r *= 1.12;
      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.12;
    }

    if(state.threat.rage) r *= 1.10;
    return clamp(r, 0.8, 2.15);
  }

  // Boss spawner (miss>=4)
  function tickBossSpawner(dt){
    if(!state.threat.boss) return;

    // boss cadence: boss mode every ~6.5s, rage every ~4.8s (fair but intense)
    const perSec = state.threat.rage ? 1/4.8 : 1/6.5;
    state.bossSpawnAcc += dt * perSec;

    while(state.bossSpawnAcc >= 1){
      state.bossSpawnAcc -= 1;
      // spawn boss center-ish
      const rect = getSafeRect();
      const x = Math.floor(randIn(rng, rect.xMin + rect.W*0.18, rect.xMax - rect.W*0.18));
      const y = Math.floor(randIn(rng, rect.yMin + rect.H*0.10, rect.yMax - rect.H*0.10));
      spawnTarget('boss',{ x, y });

      // add a couple decoys around boss (rage more)
      const k = state.threat.rage ? 2 : 1;
      for(let i=0;i<k;i++){
        spawnTarget('decoy',{
          x: clamp(x + randIn(rng,-140,140), rect.xMin, rect.xMax),
          y: clamp(y + randIn(rng,-120,120), rect.yMin, rect.yMax),
        });
      }

      // cue
      fxShock(x,y, 96);
      judge('bad', x, y, { label:'BOSS!' });
    }
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
    const ov = DOC.getElementById('endOverlay');
    if(ov){
      try{
        byId('endTitle').textContent = (summary.reason === 'miss-limit') ? 'Game Over' : 'Completed';
        byId('endSub').textContent = `reason=${summary.reason} | mode=${summary.runMode} | view=${summary.device}`;
        byId('endGrade').textContent = summary.grade || '—';
        byId('endScore').textContent = String(summary.scoreFinal ?? 0);
        byId('endMiss').textContent  = String(summary.misses ?? 0);
        byId('endTime').textContent  = String(Math.round(Number(summary.durationPlayedSec||0)));
        ov.style.display = 'flex';
        ov.setAttribute('aria-hidden','false');
      }catch(_){}
      return;
    }

    // fallback: create minimal if page doesn't have endOverlay
    const wrap = DOC.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:220;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.86);backdrop-filter:blur(10px);';
    const card = DOC.createElement('div');
    card.style.cssText = 'width:min(720px,94vw);border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.78);border-radius:22px;padding:16px;color:#e5e7eb;';
    card.innerHTML = `
      <div style="font-size:22px;font-weight:1300;">สรุปผล — GoodJunkVR</div>
      <div style="margin-top:6px;color:#94a3b8;font-weight:900;font-size:12px;">reason=${summary.reason} | view=${summary.device}</div>
      <div style="margin-top:10px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
        <div style="padding:10px;border:1px solid rgba(148,163,184,.20);border-radius:16px;background:rgba(15,23,42,.55);"><span style="color:#94a3b8;font-weight:1000;font-size:11px;">GRADE</span><div style="font-size:34px;font-weight:1300;">${summary.grade}</div></div>
        <div style="padding:10px;border:1px solid rgba(148,163,184,.20);border-radius:16px;background:rgba(15,23,42,.55);"><span style="color:#94a3b8;font-weight:1000;font-size:11px;">SCORE</span><div style="font-size:28px;font-weight:1300;">${summary.scoreFinal}</div></div>
      </div>
    `;
    wrap.appendChild(card);
    DOC.body.appendChild(wrap);
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
    }, summary));

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

    // mini tick
    tickMini(dt);

    // boss tick
    tickBossSpawner(dt);

    // spawn
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnTarget(makeTargetKind());

      // storm burst feel (fair)
      if(adaptiveOn && state.threat.storm && rng() < 0.10) spawnTarget(makeTargetKind());
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.12) spawnTarget(makeTargetKind());
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

    updateThreatFx();
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
      msg: 'ทริค: อย่าโดนขยะ! ⭐ ลด MISS และ 🛡️ กันขยะได้ (กันได้ = ไม่เป็น MISS)',
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