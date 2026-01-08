// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + STORM/BOSS/RAGE + Boss++)

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
    try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function log(detail){ emit('hha:log', detail); }

  // rng deterministic
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
      else if(P && typeof P.burst==='function') P.burst(x,y,{r:52});
    }catch(_){}
  }
  function bodyPulse(cls, ms=180){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms);
    }catch(_){}
  }

  // ---------------- config ----------------
  const view = String(payload.view || qs('view','mobile') || 'mobile').toLowerCase();
  const diff = String(payload.diff || qs('diff','normal') || 'normal').toLowerCase();
  const runMode = String(payload.run || qs('run','play') || 'play').toLowerCase(); // play | research
  const durationPlannedSec = clamp(Number(payload.time ?? qs('time','80') ?? 80) || 80, 20, 300);
  const hub = payload.hub ?? qs('hub', null);
  const seedParam = (payload.seed ?? qs('seed', null));
  const seed = (runMode === 'research')
    ? (seedParam ?? (payload.ts ?? qs('ts', null) ?? 'RESEARCH-SEED'))
    : (seedParam ?? String(Date.now()));

  const studyId = payload.studyId ?? qs('studyId', qs('study', null));
  const phase = payload.phase ?? qs('phase', null);
  const conditionGroup = payload.conditionGroup ?? qs('conditionGroup', qs('cond', null));

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-08a';
  const PROJECT_TAG = 'GoodJunkVR';

  const rng = makeSeededRng(String(seed));
  const isVR  = (view === 'vr');
  const isCVR = (view === 'cvr');
  const adaptiveOn = (runMode !== 'research');

  const DIFF = (() => {
    if(diff==='easy') return {
      spawnPerSec: 1.10,
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
      spawnPerSec: 1.60,
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
    return {
      spawnPerSec: 1.30,
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

  // thresholds requested
  const TH = {
    stormSec: 30,
    bossMiss: 4,
    rageMiss: 5,
  };

  // boss tuning (requested)
  const BOSS = {
    hp: DIFF.bossHp,          // 10/12/14
    phase2Sec: 6,             // fixed
    weakChance: 0.62,         // mostly weak targets during boss (fair)
    decoyChance: 0.34,        // some decoys
    // punish decoy hit (fair)
    decoyPenaltyScore: -8,
    decoyFever: +7,
  };

  // ---------------- UI refs ----------------
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

  // ---------------- state ----------------
  const state = {
    started:false,
    ended:false,
    tStart:0,
    tNow:0,
    timeLeftSec: durationPlannedSec,

    score:0,
    combo:0,
    comboMax:0,
    miss:0,

    nTargetGoodSpawned:0,
    nTargetJunkSpawned:0,
    nTargetStarSpawned:0,
    nTargetShieldSpawned:0,
    nTargetDiamondSpawned:0,

    nHitGood:0,
    nHitJunk:0,
    nHitJunkGuard:0,
    nExpireGood:0,

    rtGood:[],
    rtBreakdown:{ lt300:0, lt450:0, lt700:0, ge700:0 },

    fever:0,
    shield:0,

    goals: null,
    goal: null,
    goalsCleared: 0,
    goalsTotal: 3,

    mini: null,
    miniCleared: 0,
    miniTotal: 3,
    miniSeq: [],
    miniIndex: 0,

    spawnAcc:0,
    targets: new Map(),

    // boss/states
    storm:false,
    boss:false,
    rage:false,

    bossHp: BOSS.hp,
    bossPhase2Left: 0, // seconds remaining in phase2
    bossActive: false,

    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  // ---------------- fast mini config ----------------
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

  // ---------------- quests ----------------
  function makeGoals(){
    return [
      { type:'survive', title:'เอาตัวรอด', target: DIFF.missLimit, cur:0, done:false, desc:`MISS ต้องไม่เกิน ${DIFF.missLimit}` },
      { type:'score', title:'ทำคะแนน', target: (diff==='easy'? 420 : diff==='hard'? 520 : 470), cur:0, done:false, desc:`เก็บของดีเพื่อทำคะแนน` },
      { type:'minis', title:'ทำ MINI', target: 2, cur:0, done:false, desc:`ผ่าน MINI ให้ได้ 2 ครั้ง` }
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
        emit('hha:judge', { label:'GOAL!' , type:'good' });
      }
      setGoalText();
    }
    emit('hha:judge', { label:'MINI CLEAR!' , type:'good' });
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

  // ---------------- HUD helpers ----------------
  function setScore(v){
    state.score = Math.max(0, Math.floor(v));
    if(HUD.score) HUD.score.textContent = String(state.score);
    emit('hha:score', { score: state.score, x: innerWidth/2, y: innerHeight/2 });
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

  // ---------------- state flags (storm/boss/rage) ----------------
  function updateModes(){
    const body = DOC.body;

    // STORM
    const storm = (state.timeLeftSec <= TH.stormSec);
    if(storm !== state.storm){
      state.storm = storm;
      body.classList.toggle('gj-storm', storm);
    }

    // BOSS
    const boss = (state.miss >= TH.bossMiss);
    if(boss && !state.boss){
      state.boss = true;
      state.bossActive = true;
      state.bossHp = BOSS.hp;
      state.bossPhase2Left = 0;
      body.classList.add('gj-boss');
      emit('hha:coach', { msg:`บอสมาแล้ว! ต้องยิง "วงเขียว" (Weakpoint) เท่านั้น! HP ${state.bossHp}`, kind:'warn' });
      emit('hha:judge', { label:'BOSS!', type:'bad' });
    }
    // RAGE
    const rage = (state.miss >= TH.rageMiss);
    if(rage !== state.rage){
      state.rage = rage;
      body.classList.toggle('gj-rage', rage);
      if(rage){
        emit('hha:coach', { msg:'RAGE! เป้าจะไวขึ้น แต่ยังแฟร์—มองหา Weakpoint!', kind:'warn' });
      }
    }

    // Boss Phase2 timer class
    const p2 = state.bossPhase2Left > 0;
    body.classList.toggle('gj-boss-p2', p2);
  }

  // ---------------- spawn safe rect ----------------
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

  // ---------------- targets ----------------
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

  function bossMark(kind){
    // during boss: decorate GOOD targets into weak/decoy with probabilities
    if(!state.bossActive) return { weak:false, decoy:false };

    // decoys are also "good" emoji but punish if hit (fairly)
    const decoy = (rng() < BOSS.decoyChance);
    const weak  = (!decoy) && (rng() < BOSS.weakChance);
    return { weak, decoy };
  }

  function spawnOne(){
    if(state.ended) return;

    let kind = makeTargetKind();

    // boss: we bias towards GOOD (more skill-based)
    if(state.bossActive){
      const bossBias = (state.rage ? 0.82 : 0.72);
      if(rng() < bossBias) kind = 'good';
    }

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

    let lifeMs = baseLife;

    // rage makes everything feel faster (fair)
    if(state.rage) lifeMs = Math.round(lifeMs * 0.88);
    if(state.bossPhase2Left > 0) lifeMs = Math.round(lifeMs * 0.84);

    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));

    // size
    const baseSize = (kind==='good') ? 54 : (kind==='junk') ? 56 : 50;
    let size = clamp(baseSize + randIn(rng, -4, 10), 44, 72);
    if(state.bossActive && kind==='good') size = clamp(size + 6, 48, 76);

    const elL = DOC.createElement('div');
    elL.className = 'gj-target spawn';
    elL.dataset.id = id;
    elL.dataset.kind = kind;
    elL.textContent = pickEmoji(kind);
    elL.style.left = `${x}px`;
    elL.style.top  = `${y}px`;
    elL.style.fontSize = `${size}px`;

    // boss decorations for GOOD
    let weak = false, decoy = false;
    if(kind==='good' && state.bossActive){
      const mark = bossMark(kind);
      weak = mark.weak;
      decoy = mark.decoy;

      if(weak) elL.dataset.weak = '1';
      if(decoy) elL.dataset.decoy = '1';

      // phase2: jitter a bit (visual + challenge)
      if(state.bossPhase2Left > 0){
        elL.classList.add('jitter');
        elL.style.setProperty('--jx', `${Math.round(randIn(rng,-1.2,1.2))}px`);
        elL.style.setProperty('--jy', `${Math.round(randIn(rng,-1.2,1.2))}px`);
      }
    }

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
      weak,
      decoy,
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

  // ---------------- scoring / RT ----------------
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

  // ---------------- mini handlers ----------------
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
          emit('hha:judge', { label:'FAST PASS!', type:'perfect' });
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

  // ---------------- goals updates ----------------
  function updateGoalsOnScore(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='score'){
      g.cur = clamp(state.score, 0, g.target);
      if(g.cur >= g.target){
        g.done = true;
        state.goalsCleared++;
        emit('hha:judge', { label:'GOAL!', type:'good' });
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

  // ---------------- hit logic ----------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){ state.combo = 0; }

  function bossOnCorrectWeakHit(px,py){
    // only weak hits reduce HP
    state.bossHp = Math.max(0, state.bossHp - 1);
    fxBurst(px,py,'good');
    emit('hha:judge', { label:`WEAK! -1 (HP ${state.bossHp})`, type:'perfect', x:px, y:py, combo: state.combo });

    // enter phase2 when hp drops to about half (once)
    const half = Math.ceil(BOSS.hp/2);
    if(state.bossHp === half && state.bossPhase2Left <= 0){
      state.bossPhase2Left = BOSS.phase2Sec;
      emit('hha:coach', { msg:`Phase 2! (6s) เป้าจะส่าย/ไวขึ้น`, kind:'warn' });
    }

    // boss defeated
    if(state.bossHp <= 0){
      state.bossActive = false;
      DOC.body.classList.remove('gj-boss','gj-boss-p2');
      emit('hha:coach', { msg:'ชนะบอส! กลับสู่โหมดปกติ', kind:'tip' });
      emit('hha:celebrate', { kind:'boss-clear' });
      // reward: shield +2 and miss -1 (fair)
      addShield(2);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();
      fxScorePop(px,py,'BOSS CLEAR!');
    }
  }

  function bossOnWrongHit(px,py,label){
    // punish but fair: no extra miss, just score/fever pressure
    resetCombo();
    addFever(BOSS.decoyFever);
    setScore(state.score + BOSS.decoyPenaltyScore);
    fxBurst(px,py,'bad');
    fxScorePop(px,py,String(BOSS.decoyPenaltyScore));
    emit('hha:judge', { label: label || 'FAKE!', type:'bad', x:px, y:py });
    bodyPulse('gj-decoy-hit', 240);
  }

  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    tObj.hit = true;

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

    const px = meta.clientX ?? tObj.x;
    const py = meta.clientY ?? tObj.y;

    // boss rules only for GOOD targets
    if(state.bossActive && kind==='good'){
      // decoy hit
      if(tObj.decoy){
        bossOnWrongHit(px,py,'FAKE!');
        removeTarget(tObj);
        return;
      }
      // weakpoint required
      if(!tObj.weak){
        bossOnWrongHit(px,py,'NO WEAK!');
        removeTarget(tObj);
        return;
      }
      // correct weak hit: also counts as normal good hit scoring
      state.nHitGood++;
      addCombo();
      addFever(2.4);
      const delta = DIFF.goodScore + Math.min(7, Math.floor(state.combo/4));
      setScore(state.score + delta);
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);
      bossOnCorrectWeakHit(px,py);
      removeTarget(tObj);
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
      fxScorePop(px,py,`+${delta}`);
      emit('hha:judge', { label:'GOOD!', type:'good', x:px, y:py, combo: state.combo });

    } else if(kind==='junk'){
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);
        fxBurst(px,py,'block');
        fxScorePop(px,py,'BLOCK');
        emit('hha:judge', { label:'BLOCK!', type:'block', x:px, y:py });
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
        emit('hha:judge', { label:'OOPS!', type:'bad', x:px, y:py });
        bodyPulse('gj-junk-hit', 220);
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();
      fxBurst(px,py,'star');
      fxScorePop(px,py,'MISS -1');
      emit('hha:judge', { label:'STAR!', type:'good', x:px, y:py });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      fxBurst(px,py,'shield');
      fxScorePop(px,py,'SHIELD +1');
      emit('hha:judge', { label:'SHIELD!', type:'good', x:px, y:py });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();
      fxBurst(px,py,'diamond');
      fxScorePop(px,py,`+${bonus}`);
      emit('hha:judge', { label:'DIAMOND!', type:'perfect', x:px, y:py });
    }

    setMiniText();
    removeTarget(tObj);

    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // shoot from center (cVR/VR)
  function shootCrosshair(){
    if(state.ended) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);
    const R = (isCVR || isVR) ? 84 : 70;

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
      emit('hha:judge', { label:'MISS SHOT', type:'miss', x:cx, y:cy });
    }
  }
  ROOT.addEventListener('hha:shoot', shootCrosshair, { passive:true });

  // expiry tick
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
          emit('hha:judge', { label:'MISS!', type:'miss', x:tObj.x, y:tObj.y });
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

  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);
      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.15;
    }

    // boss/rage increase pressure but clamp
    if(state.bossActive) r *= (state.rage ? 1.18 : 1.12);
    if(state.bossPhase2Left > 0) r *= 1.16;

    return clamp(r, 0.85, 2.15);
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
    if(miss <= 1 && score >= 620) return 'SSS';
    if(miss <= 2 && score >= 560) return 'SS';
    if(miss <= 3 && score >= 520) return 'S';
    if(miss <= 4 && score >= 460) return 'A';
    if(miss <= 6 && score >= 380) return 'B';
    if(miss <= 8 && score >= 300) return 'C';
    return 'D';
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
  }

  // main loop
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

    // phase2 countdown
    if(state.bossPhase2Left > 0){
      state.bossPhase2Left = Math.max(0, state.bossPhase2Left - dt);
    }

    // modes
    updateLowTimeFx();
    updateModes();

    // mini
    tickMini(dt);

    // spawn
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.12) spawnOne();
      if(state.bossPhase2Left > 0 && rng() < 0.10) spawnOne();
    }

    expireTargets();

    if(state.timeLeftSec <= 0){
      endGame('timeup');
      return;
    }

    requestAnimationFrame(tick);
  }

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
      msg: 'ทริค: ⭐ ลด MISS, 🛡️ กันขยะ (กันแล้วไม่เป็น MISS). เวลาเหลือ 30s = STORM | MISS≥4 = BOSS | MISS≥5 = RAGE',
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