// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + FX Director + Storm/Boss/Rage)
// ✅ Mobile / PC / VR(Cardboard) / cVR
// ✅ HUD-safe spawn via CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as miss
// ✅ Mini "เก็บให้ไว" -> instant pass
// ✅ FX: Emits hha:judge/hha:score/hha:miss + hha:phase(storm|boss|rage)
// ✅ Storm: timeLeft <= 30s
// ✅ Boss: miss >= 4 (harder++), Rage: miss >= 5 (boss phase2 6s)
// ✅ Boss HP (easy/normal/hard): 10 / 12 / 14, Phase2 duration: 6s
// ✅ Emits: hha:start, hha:time, quest:update, hha:coach, hha:judge, hha:score, hha:miss, hha:phase, hha:end, hha:celebrate
// ✅ End summary + back-to-HUB + save last summary (HHA_LAST_SUMMARY)
// ✅ Logger compatible with hha-cloud-logger.js

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
    try{
      // FX director listens on document; other systems might listen on window
      DOC.dispatchEvent(new CustomEvent(name, { detail }));
      ROOT.dispatchEvent(new CustomEvent(name, { detail }));
    }catch(_){}
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
      bossHP: 10
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
      bossHP: 14
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
      bossHP: 12
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
    fever: 0, // 0-100
    shield: 0, // 0..5

    // quest
    goals: null,
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

    // phases
    stormOn: false,

    // boss
    boss: {
      active: false,
      rage: false,
      hp: 0,
      hpMax: 0,
      bornAt: 0,
      phase2At: 0,       // when rage starts
      phase2Sec: 6,      // requested
      moveEveryMs: 520,  // how often boss jumps position
      lastMoveAt: 0,
      timeoutSec: 18,    // fail if not killed in time (fair but tense)
      bossElL: null,
      bossElR: null,
      x: 0,
      y: 0,
      size: 92,
      id: 'boss'
    },

    // session
    sessionId: null,
    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
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

    // update minis-goal
    if(state.goal && state.goal.type==='minis'){
      state.goal.cur = clamp(state.miniCleared, 0, state.goal.target);
      if(state.goal.cur >= state.goal.target && !state.goal.done){
        state.goal.done = true;
        state.goalsCleared++;
        emit('hha:judge', { type:'good', label:'GOAL!', x: innerWidth*0.5, y: innerHeight*0.22 });
      }
      setGoalText();
    }

    emit('hha:judge', { type:'perfect', label:'MINI CLEAR!', x: innerWidth*0.5, y: innerHeight*0.30 });
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
    const old = state.score;
    state.score = Math.max(0, Math.floor(v));
    if(HUD.score) HUD.score.textContent = String(state.score);
    const delta = state.score - old;
    emit('hha:score', { score: state.score, delta, x: innerWidth*0.5, y: innerHeight*0.24 });
  }
  function setMiss(v){
    const old = state.miss;
    state.miss = Math.max(0, Math.floor(v));
    if(HUD.miss) HUD.miss.textContent = String(state.miss);
    if(state.miss > old){
      emit('hha:miss', { miss: state.miss, x: innerWidth*0.5, y: innerHeight*0.28 });
    }
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
    // during boss: reduce random spawns a bit so boss is readable
    const bossActive = state.boss.active;

    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    const starW = DIFF.starRate * (bossActive ? 0.75 : 1);
    const shieldW = DIFF.shieldRate * (bossActive ? 0.75 : 1);
    const junkW = DIFF.junkRate * (bossActive ? 0.90 : 1);

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

    const elL = DOC.createElement('div');
    elL.className = 'gj-target';
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
          emit('hha:judge', { type:'perfect', label:'FAST PASS!', x: innerWidth*0.5, y: innerHeight*0.33 });
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
        emit('hha:judge', { type:'perfect', label:'GOAL!', x: innerWidth*0.5, y: innerHeight*0.20 });
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

  // ----------------------- combos -----------------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){
    state.combo = 0;
  }

  // ----------------------- PHASE: Storm/Boss/Rage triggers -----------------------
  function setStorm(on){
    if(!!on === !!state.stormOn) return;
    state.stormOn = !!on;
    emit('hha:phase', { phase: on ? 'storm' : 'clear' });
  }

  function bossStart(){
    if(state.boss.active || state.ended) return;

    state.boss.active = true;
    state.boss.rage = false;
    state.boss.hpMax = DIFF.bossHP;
    state.boss.hp = DIFF.bossHP;
    state.boss.bornAt = now();
    state.boss.phase2At = state.boss.bornAt + (Math.max(1, state.boss.timeoutSec - state.boss.phase2Sec) * 1000); // enters phase2 near end
    state.boss.lastMoveAt = 0;

    spawnBossEl();
    emit('hha:phase', { phase:'boss', hp: state.boss.hp, hpMax: state.boss.hpMax });
    emit('hha:coach', { kind:'warn', msg:'⚠️ BOSS มาแล้ว! ยิง/แตะบอสให้แตกก่อนหมดเวลา!' });
  }

  function bossSetRage(on){
    if(!state.boss.active) return;
    if(!!on === !!state.boss.rage) return;
    state.boss.rage = !!on;
    emit('hha:phase', { phase: on ? 'rage' : 'boss', hp: state.boss.hp, hpMax: state.boss.hpMax });
    if(on) emit('hha:coach', { kind:'warn', msg:'🔥 RAGE! บอสเร็วขึ้น + โหดขึ้น!' });
  }

  function bossEnd(result){ // 'win' | 'fail'
    if(!state.boss.active) return;
    despawnBossEl();

    if(result === 'win'){
      // reward: bonus score + reduce miss + shields
      const bonus = (diff==='hard') ? 120 : 95;
      setScore(state.score + bonus);
      setMiss(Math.max(0, state.miss - 2));
      addShield(1);

      emit('hha:judge', { type:'perfect', label:'BOSS DOWN!', x: innerWidth*0.5, y: innerHeight*0.34 });
      emit('hha:celebrate', { kind:'boss' });
      emit('hha:coach', { kind:'tip', msg:'✅ เก่งมาก! บอสแตกแล้ว ได้โบนัส + ลด MISS' });
    } else {
      // fail: penalty (fair but tense)
      setMiss(state.miss + 2);
      addFever(10);
      emit('hha:judge', { type:'bad', label:'BOSS FAIL!', x: innerWidth*0.5, y: innerHeight*0.34 });
      emit('hha:coach', { kind:'warn', msg:'❌ บอสหนีไป! ระวัง MISS เพิ่ม' });
    }

    state.boss.active = false;
    state.boss.rage = false;
    emit('hha:phase', { phase:'clear' });
  }

  // ----------------------- BOSS DOM -----------------------
  function spawnBossEl(){
    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

    state.boss.x = x;
    state.boss.y = y;

    const elL = DOC.createElement('div');
    elL.className = 'gj-target gj-boss';
    elL.dataset.id = state.boss.id;
    elL.dataset.kind = 'boss';
    elL.textContent = '👹🍔';
    elL.style.left = `${x}px`;
    elL.style.top  = `${y}px`;
    elL.style.fontSize = `${state.boss.size}px`;

    // hp badge (inline, no CSS dependency)
    const badge = DOC.createElement('div');
    badge.className = 'gj-boss-hp';
    badge.style.cssText = `
      position:absolute; left:50%; top:-18px; transform:translateX(-50%);
      padding:4px 10px; border-radius:999px;
      background: rgba(2,6,23,.78);
      border:1px solid rgba(148,163,184,.28);
      color:#e5e7eb; font: 900 12px/1 system-ui;
      pointer-events:none;
    `;
    badge.textContent = `HP ${state.boss.hp}/${state.boss.hpMax}`;
    elL.appendChild(badge);

    let elR = null;
    if(LAYER_R){
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
    }

    function updateBadge(){
      try{
        const b1 = elL.querySelector('.gj-boss-hp');
        if(b1) b1.textContent = `HP ${state.boss.hp}/${state.boss.hpMax}`;
        const b2 = elR ? elR.querySelector('.gj-boss-hp') : null;
        if(b2) b2.textContent = `HP ${state.boss.hp}/${state.boss.hpMax}`;
      }catch(_){}
    }

    elL.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      bossOnHit({ clientX: ev.clientX, clientY: ev.clientY });
      updateBadge();
    }, { passive:false });

    // keep a handle for updates
    state.boss.bossElL = elL;
    state.boss.bossElR = elR;

    LAYER_L.appendChild(elL);
    if(elR && LAYER_R) LAYER_R.appendChild(elR);
  }

  function despawnBossEl(){
    try{
      state.boss.bossElL?.remove();
      state.boss.bossElR?.remove();
    }catch(_){}
    state.boss.bossElL = null;
    state.boss.bossElR = null;
  }

  function bossMove(){
    if(!state.boss.active) return;
    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));
    state.boss.x = x; state.boss.y = y;
    try{
      if(state.boss.bossElL){
        state.boss.bossElL.style.left = `${x}px`;
        state.boss.bossElL.style.top  = `${y}px`;
      }
      if(state.boss.bossElR){
        state.boss.bossElR.style.left = `${x}px`;
        state.boss.bossElR.style.top  = `${y}px`;
      }
    }catch(_){}
  }

  function bossOnHit(meta={}){
    if(!state.boss.active || state.ended) return;

    // boss hit reduces hp
    const px = meta.clientX ?? state.boss.x;
    const py = meta.clientY ?? state.boss.y;

    // phase2 / rage speed: hits count the same but boss relocates faster and spawns more junk
    state.boss.hp = Math.max(0, state.boss.hp - 1);

    emit('hha:judge', { type:'good', label:'HIT BOSS!', x:px, y:py, combo: state.combo });
    emit('hha:score', { delta: 8, x:px, y:py });

    // tiny score for each hit (keeps kids motivated)
    setScore(state.score + 8);

    // move instantly sometimes (rage -> always)
    if(state.boss.rage || rng() < 0.45) bossMove();

    if(state.boss.hp <= 0){
      bossEnd('win');
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

      emit('hha:judge', { type:'good', label:'GOOD!', x:px, y:py, combo: state.combo });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);

        emit('hha:judge', { type:'block', label:'BLOCK!', x:px, y:py, combo: state.combo });

      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1));
        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        updateGoalsOnMiss();
        miniOnJunkHit();

        emit('hha:judge', { type:'bad', label:'OOPS!', x:px, y:py, combo: state.combo });
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();

      emit('hha:judge', { type:'perfect', label:'STAR!', x:px, y:py });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);

      emit('hha:judge', { type:'perfect', label:'SHIELD!', x:px, y:py });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();

      emit('hha:judge', { type:'perfect', label:'DIAMOND!', x:px, y:py });
    }

    setMiniText();
    removeTarget(tObj);

    // trigger boss/rage gates (your spec)
    // miss >=4 => boss, miss >=5 => rage
    if(!state.boss.active && state.miss >= 4){
      bossStart();
    }
    if(state.boss.active && !state.boss.rage && state.miss >= 5){
      bossSetRage(true);
    }

    // end condition by missLimit
    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // cVR shooting (crosshair center)
  function shootCrosshair(){
    if(state.ended) return;

    // boss first priority if present and near crosshair
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);
    const Rb = (isCVR || isVR) ? 120 : 110;

    if(state.boss.active){
      const dxB = (state.boss.x - cx);
      const dyB = (state.boss.y - cy);
      const dB = Math.hypot(dxB,dyB);
      if(dB < Rb){
        bossOnHit({ clientX: cx, clientY: cy });
        return;
      }
    }

    const R = (isCVR || isVR) ? 82 : 70;
    let best = null, bestD = 1e9;

    for(const t of state.targets.values()){
      if(t.hit) continue;
      const dx = (t.x - cx);
      const dy = (t.y - cy);
      const d = Math.hypot(dx,dy);
      if(d < R && d < bestD){
        bestD = d; best = t;
      }
    }

    if(best){
      onTargetHit(best, { via:'shoot', clientX: cx, clientY: cy });
    }else{
      // miss shot feedback
      emit('hha:judge', { type:'miss', label:'MISS SHOT', x:cx, y:cy });
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

          // reset streak_good on expire
          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          emit('hha:judge', { type:'miss', label:'MISS!', x:tObj.x, y:tObj.y });

          if(!state.boss.active && state.miss >= 4) bossStart();
          if(state.boss.active && !state.boss.rage && state.miss >= 5) bossSetRage(true);

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
    }

    // storm excitement
    if(state.stormOn) r *= 1.18;

    // boss pressure (more targets -> chaos, but still fair)
    if(state.boss.active){
      r *= state.boss.rage ? 1.35 : 1.18;
    }

    return clamp(r, 0.8, 2.2);
  }

  // extra spawn during rage: inject more junk (but still avoid impossible)
  function maybeSpawnRageJunk(){
    if(!state.boss.active || !state.boss.rage) return;
    if(rng() < 0.28){
      // force spawn junk
      const rect = getSafeRect();
      const id = `t${++targetSeq}`;
      const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
      const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

      state.nTargetJunkSpawned++;

      const elL = DOC.createElement('div');
      elL.className = 'gj-target';
      elL.dataset.id = id;
      elL.dataset.kind = 'junk';
      elL.textContent = pickEmoji('junk');
      elL.style.left = `${x}px`;
      elL.style.top  = `${y}px`;
      elL.style.fontSize = `${clamp(58 + randIn(rng,-4,8), 46, 76)}px`;

      let elR = null;
      if(LAYER_R){
        elR = elL.cloneNode(true);
        elR.dataset.eye = 'r';
      }

      const tObj = { id, kind:'junk', bornAt: now(), lifeMs: Math.round(DIFF.goodLifeMs*0.95), x,y, elL, elR, hit:false };
      elL.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        onTargetHit(tObj, { via:'tap', clientX: ev.clientX, clientY: ev.clientY });
      }, { passive:false });

      LAYER_L.appendChild(elL);
      if(elR && LAYER_R) LAYER_R.appendChild(elR);

      state.targets.set(id, tObj);
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
    const ov = DOC.getElementById('endOverlay') || null;
    if(ov){
      // if your HTML binds endOverlay, prefer aria-hidden
      try{
        ov.setAttribute('aria-hidden','false');
        ov.style.display = 'flex';
        // if your HTML has fields:
        const set = (id,val)=>{ const el=byId(id); if(el) el.textContent = String(val ?? '—'); };
        set('endTitle', (summary.reason === 'miss-limit') ? 'Game Over' : 'Completed');
        set('endSub', `reason=${summary.reason} | run=${summary.runMode} | view=${summary.device}`);
        set('endGrade', summary.grade);
        set('endScore', summary.scoreFinal);
        set('endMiss', summary.misses);
        set('endTime', summary.durationPlayedSec);
      }catch(_){}
      return;
    }

    // fallback overlay (in case HTML doesn't have endOverlay)
    const div = DOC.createElement('div');
    div.style.cssText = `position:fixed; inset:0; z-index:220; display:flex; align-items:center; justify-content:center;
      background: rgba(2,6,23,.86); backdrop-filter: blur(10px); padding: 18px;`;
    const card = DOC.createElement('div');
    card.style.cssText = `width:min(760px, 94vw); background: rgba(2,6,23,.84);
      border:1px solid rgba(148,163,184,.22); border-radius: 22px; padding:18px; color:#e5e7eb;
      font-family: system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;`;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;">
        <div>
          <div style="font-size:22px;font-weight:1200;">สรุปผล — GoodJunkVR</div>
          <div style="margin-top:6px;color:#94a3b8;font-weight:900;font-size:12px;">
            view=${deviceLabel(view)} | run=${runMode} | diff=${diff}
          </div>
        </div>
        <div style="font-size:56px;font-weight:1300;line-height:1;">${summary.grade || '-'}</div>
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
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="btnReplay" type="button" style="flex:1;min-width:220px;height:54px;border-radius:16px;
          border:1px solid rgba(34,197,94,.35);background: rgba(34,197,94,.16); color:#eafff3;
          font-weight:1200;font-size:16px;cursor:pointer;">เล่นอีกครั้ง</button>
        <button id="btnBackHub" type="button" style="flex:1;min-width:220px;height:54px;border-radius:16px;
          border:1px solid rgba(148,163,184,.22);background: rgba(2,6,23,.55); color:#e5e7eb;
          font-weight:1200;font-size:16px;cursor:pointer;">กลับ HUB</button>
      </div>
    `;
    div.appendChild(card);
    DOC.body.appendChild(div);

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

    // clean phases + boss
    setStorm(false);
    if(state.boss.active) bossEnd('fail');

    for(const tObj of state.targets.values()){
      removeTarget(tObj);
    }
    state.targets.clear();

    // survive goal completes if miss <= limit
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

    // STORM trigger at 30s
    if(state.timeLeftSec <= 30) setStorm(true);

    // mini tick
    tickMini(dt);

    // boss tick (movement + timer + phase2)
    if(state.boss.active){
      const ageSec = (t - state.boss.bornAt)/1000;

      // phase2 / rage: your spec says miss>=5 => rage
      // additionally: near end of boss time, force phase2 (still fair)
      if(!state.boss.rage){
        const nearing = (t >= state.boss.phase2At);
        if(nearing) bossSetRage(true);
      }

      // movement speed
      const moveMs = state.boss.rage ? 360 : state.boss.moveEveryMs;
      if((t - state.boss.lastMoveAt) >= moveMs){
        state.boss.lastMoveAt = t;
        bossMove();
      }

      // rage inject junk spawns
      maybeSpawnRageJunk();

      // timeout -> fail boss
      if(ageSec >= state.boss.timeoutSec){
        bossEnd('fail');
      }
    }

    // spawn
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();
      // late game burst
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
      msg: 'ทริค: อย่าแตะขยะ! ⭐ ลด MISS และ 🛡️ กันขยะ (กันแล้วไม่เป็น MISS) — ช่วงท้ายจะมี STORM และ BOSS!',
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