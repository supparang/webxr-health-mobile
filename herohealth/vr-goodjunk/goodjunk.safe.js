// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (CLEAN + Boss++ A+B+C)
// ✅ Uses existing HTML overlays (aria-hidden only): #endOverlay, #lowTimeOverlay, #missionsPeek
// ✅ HUD-safe spawn via CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as Miss
// ✅ Storm: timeLeft<=30s => ON once; ends when boss ends OR game ends
// ✅ Boss: miss>=4 => ON (HP by diff: 10/12/14); Phase2 lasts 6s then back to P1 if not cleared
// ✅ Rage: miss>=5 => ON until end
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:storm, hha:boss, hha:end, hha:celebrate
// ✅ End summary saved to localStorage HHA_LAST_SUMMARY + back HUB

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

  // particles adapter (supports both minimal and ultra)
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
  const baseView = String(payload.view || qs('view','mobile') || 'mobile').toLowerCase();
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

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-15_CLEAN';
  const PROJECT_TAG = 'GoodJunkVR';

  const rng = makeSeededRng(String(seed));

  const view = (DOC.body?.dataset?.view || baseView || 'mobile').toLowerCase(); // boot may set dataset.view
  const isVR  = (view === 'vr');
  const isCVR = (view === 'cvr');

  // difficulty tuning (balanced for ป.5: not “หายแว๊บๆ” จนหงุดหงิด)
  const DIFF = (() => {
    if(diff==='easy') return {
      spawnPerSec: 1.05,
      junkRate: 0.22,
      starRate: 0.085,
      shieldRate: 0.065,
      diamondRate: 0.015,
      goodLifeMs: 2200,
      junkPenaltyMiss: 1,
      goodScore: 12,
      junkPenaltyScore: -10,
      missLimit: 12,
      bossHpMax: 10,
    };
    if(diff==='hard') return {
      spawnPerSec: 1.55,
      junkRate: 0.32,
      starRate: 0.065,
      shieldRate: 0.05,
      diamondRate: 0.012,
      goodLifeMs: 1600,
      junkPenaltyMiss: 1,
      goodScore: 14,
      junkPenaltyScore: -14,
      missLimit: 9,
      bossHpMax: 14,
    };
    return { // normal
      spawnPerSec: 1.25,
      junkRate: 0.27,
      starRate: 0.075,
      shieldRate: 0.058,
      diamondRate: 0.013,
      goodLifeMs: 1900,
      junkPenaltyMiss: 1,
      goodScore: 13,
      junkPenaltyScore: -12,
      missLimit: 10,
      bossHpMax: 12,
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

    // END overlay fields (existing HTML)
    endOverlay: byId('endOverlay'),
    endTitle: byId('endTitle'),
    endSub: byId('endSub'),
    endGrade: byId('endGrade'),
    endScore: byId('endScore'),
    endMiss: byId('endMiss'),
    endTime: byId('endTime'),
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
    timeLeftSec: durationPlannedSec,

    score: 0,
    combo: 0,
    comboMax: 0,

    // misses: good expired + junk hit (shield-blocked junk NOT miss)
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
    rtGood: [], // ms

    // fever / shield
    fever: 0,
    shield: 0,

    // quest
    goals: [],
    goalIndex: 0,
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
    targets: new Map(), // id -> obj

    // A+B+C
    stormOn: false,
    bossOn: false,
    rageOn: false,

    bossHp: 0,
    bossHpMax: DIFF.bossHpMax,
    bossPhase: 0,         // 0 none, 1 phase1, 2 phase2
    bossPhase2Sec: 6,
    bossPhase2Until: 0,

    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  // ----------------------- quest config -----------------------
  function fastCfgByView(view2){
    if(view2==='pc')  return { thrMs: 440, target: 2, timeLimitSec: 10 };
    if(view2==='cvr') return { thrMs: 460, target: 2, timeLimitSec: 10 };
    if(view2==='vr')  return { thrMs: 480, target: 2, timeLimitSec: 10 };
    return { thrMs: 470, target: 2, timeLimitSec: 10 };
  }

  function pickMiniSequence(view2='mobile'){
    const fast = fastCfgByView(view2);
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
    if(m.type === 'avoid_junk'){
      m.cur = 0;
    }
  }

  function makeGoals(){
    return [
      { type:'survive', title:'เอาตัวรอด', target: DIFF.missLimit, cur:0, done:false, desc:`MISS ต้องไม่เกิน ${DIFF.missLimit}` },
      { type:'score', title:'ทำคะแนน', target: (diff==='easy'? 420 : diff==='hard'? 520 : 470), cur:0, done:false, desc:`เก็บของดีเพื่อทำคะแนน` },
      { type:'minis', title:'ทำ MINI', target: 2, cur:0, done:false, desc:`ผ่าน MINI ให้ได้ 2 ครั้ง` }
    ];
  }

  function syncQuestUI(){
    const g = state.goal;
    const m = state.mini;

    if(g){
      HUD.goal && (HUD.goal.textContent = g.title || '—');
      HUD.goalTarget && (HUD.goalTarget.textContent = String(g.target ?? 0));
      HUD.goalCur && (HUD.goalCur.textContent = String(g.cur ?? 0));
      HUD.goalDesc && (HUD.goalDesc.textContent = g.desc || '—');
    }

    if(m){
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
        else if(m.type==='avoid_junk') HUD.miniTimer.textContent = `${Math.ceil(Math.max(0, m.target - m.cur))}s`;
        else HUD.miniTimer.textContent = '—';
      }
    }else{
      HUD.mini && (HUD.mini.textContent = '—');
      HUD.miniTimer && (HUD.miniTimer.textContent = '—');
    }

    emit('quest:update', { goal: g || null, mini: m || null });
  }

  function nextMini(){
    state.miniIndex = (state.miniIndex + 1) % state.miniSeq.length;
    state.mini = state.miniSeq[state.miniIndex];
    resetMini(state.mini);
    syncQuestUI();
  }

  function markMiniCleared(){
    state.miniCleared++;

    // minis goal progress
    if(state.goal && state.goal.type==='minis'){
      state.goal.cur = clamp(state.miniCleared, 0, state.goal.target);
      if(state.goal.cur >= state.goal.target && !state.goal.done){
        state.goal.done = true;
        state.goalsCleared++;
        emit('hha:judge', { type:'perfect', label:'GOAL!' });
      }
    }

    emit('hha:judge', { type:'perfect', label:'MINI CLEAR!' });
    emit('hha:celebrate', { kind:'mini' });
    bodyPulse('gj-mini-clear', 240);
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
        syncQuestUI();
      }
      return;
    }

    if(m.type==='fast_hits'){
      m.leftSec = Math.max(0, (Number(m.leftSec)||0) - dtSec);
      if(m.leftSec <= 0 && !m.done){
        resetMini(m);
      }
      syncQuestUI();
      return;
    }
  }

  // ----------------------- HUD setters -----------------------
  function setScore(v, meta=null){
    state.score = Math.max(0, Math.floor(v));
    HUD.score && (HUD.score.textContent = String(state.score));
    emit('hha:score', Object.assign({ score: state.score }, meta||{}));

    // score goal
    const g = state.goal;
    if(g && !g.done && g.type==='score'){
      g.cur = clamp(state.score, 0, g.target);
      if(g.cur >= g.target){
        g.done = true;
        state.goalsCleared++;
        emit('hha:judge', { type:'perfect', label:'GOAL!' });
      }
      syncQuestUI();
    }
  }

  function setMiss(v, meta=null){
    state.miss = Math.max(0, Math.floor(v));
    HUD.miss && (HUD.miss.textContent = String(state.miss));
    emit('hha:miss', Object.assign({ miss: state.miss }, meta||{}));

    // survive goal
    const g = state.goal;
    if(g && !g.done && g.type==='survive'){
      g.cur = clamp(state.miss, 0, g.target);
      syncQuestUI();
    }
  }

  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    HUD.time && (HUD.time.textContent = String(Math.ceil(state.timeLeftSec)));
    emit('hha:time', { timeLeftSec: state.timeLeftSec });
  }

  function setGradeText(txt){
    HUD.grade && (HUD.grade.textContent = txt);
  }

  function addFever(delta){
    state.fever = clamp(state.fever + (Number(delta)||0), 0, 100);
    HUD.feverFill && (HUD.feverFill.style.width = `${state.fever}%`);
    HUD.feverText && (HUD.feverText.textContent = `${Math.round(state.fever)}%`);
  }

  function renderShield(){
    if(!HUD.shieldPills) return;
    const pills = [];
    for(let i=0;i<state.shield;i++) pills.push('🛡️');
    HUD.shieldPills.textContent = pills.length ? pills.join(' ') : '—';
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

  function updateLowTimeFx(){
    const t = state.timeLeftSec;
    DOC.body.classList.remove('gj-lowtime','gj-lowtime5','gj-tick');

    if(t <= 10){
      DOC.body.classList.add('gj-lowtime');
      if(t <= 5) DOC.body.classList.add('gj-lowtime5');

      if(HUD.lowTimeOverlay){
        HUD.lowTimeOverlay.setAttribute('aria-hidden', (t<=5) ? 'false' : 'true');
      }
      if(HUD.lowTimeNum && t<=5){
        HUD.lowTimeNum.textContent = String(Math.ceil(t));
        DOC.body.classList.add('gj-tick');
        setTimeout(()=>DOC.body.classList.remove('gj-tick'), 120);
      }
    }else{
      HUD.lowTimeOverlay && HUD.lowTimeOverlay.setAttribute('aria-hidden','true');
    }
  }

  // ----------------------- safe spawn rect -----------------------
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
    const topSafe = readRootPxVar('--gj-top-safe', 150 + sat);
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
  };

  function makeTargetKind(){
    // base weights
    let junkW = DIFF.junkRate;
    let starW = DIFF.starRate;
    let shieldW = DIFF.shieldRate;
    let diamondW = DIFF.diamondRate;

    // A+B+C modifiers
    if(state.stormOn) junkW += 0.03;
    if(state.bossOn)  junkW += (state.bossPhase===2 ? 0.08 : 0.05);
    if(state.rageOn)  junkW += 0.06;

    // fair compensation: small extra helps
    if(state.bossOn)  starW += 0.01;
    if(state.bossOn)  shieldW += 0.01;

    junkW = clamp(junkW, 0.10, 0.55);
    starW = clamp(starW, 0.03, 0.15);
    shieldW = clamp(shieldW, 0.03, 0.15);
    diamondW = clamp(diamondW, 0.008, 0.02);

    const goodW = Math.max(0.20, 1 - (junkW + starW + shieldW + diamondW));

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

    // life / size modifiers (phase2 shorter but not unfair)
    const baseLife =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.10) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.20) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.20) :
      Math.round(DIFF.goodLifeMs * 1.28);

    const bossLifeMul = state.bossOn ? (state.bossPhase===2 ? 0.88 : 0.95) : 1.0;
    const rageLifeMul = state.rageOn ? 0.94 : 1.0;
    const stormLifeMul = state.stormOn ? 0.96 : 1.0;

    const lifeAdj = clamp(Math.round(baseLife * bossLifeMul * rageLifeMul * stormLifeMul), 950, 3200);

    // size scaling
    const baseSize = (kind==='good') ? 54 : (kind==='junk') ? 56 : 50;
    const bossSizeMul = state.bossOn ? 0.96 : 1.0;
    const rageSizeMul = state.rageOn ? 0.95 : 1.0;
    const size = clamp((baseSize + randIn(rng, -4, 10)) * bossSizeMul * rageSizeMul, 44, 74);

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
    const tObj = { id, kind, bornAt, lifeMs: lifeAdj, x,y, elL, elR, hit:false };

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

  // ----------------------- RT helpers -----------------------
  function recordRt(ms){
    if(ms == null) return;
    const v = Math.max(0, Math.floor(ms));
    state.rtGood.push(v);
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

  // ----------------------- A+B+C: Storm/Boss/Rage -----------------------
  function setStorm(on){
    on = !!on;
    if(on === state.stormOn) return;
    state.stormOn = on;

    emit('hha:storm', { on, t: state.timeLeftSec });
    emit('hha:judge', { type: on ? 'perfect' : 'good', label: on ? 'STORM!' : 'STORM CLEAR' });

    if(on){
      DOC.body.classList.add('gj-storm');
      fxRing(innerWidth/2, innerHeight*0.28, 'star', { size: 220 });
      fxPop(innerWidth/2, innerHeight*0.25, 'STORM!', 'warn', { size: 22 });
    }else{
      DOC.body.classList.remove('gj-storm');
    }
  }

  function setRage(on){
    on = !!on;
    if(on === state.rageOn) return;
    state.rageOn = on;

    emit('hha:boss', { on: state.bossOn, hp: state.bossHp, hpMax: state.bossHpMax, phase: state.bossPhase, rage: state.rageOn, phase2Sec: state.bossPhase2Sec });
    emit('hha:judge', { type:'bad', label: on ? 'RAGE!' : 'RAGE OFF' });

    if(on){
      DOC.body.classList.add('gj-rage');
      fxRing(innerWidth/2, innerHeight*0.30, 'bad', { size: 280 });
      fxPop(innerWidth/2, innerHeight*0.25, 'RAGE!', 'bad', { size: 24 });
      bodyPulse('gj-rage', 520);
    }
  }

  function setBoss(on){
    on = !!on;
    if(on === state.bossOn) return;

    state.bossOn = on;

    if(on){
      state.bossHpMax = DIFF.bossHpMax; // 10/12/14
      state.bossHp = state.bossHpMax;
      state.bossPhase = 1;
      state.bossPhase2Until = 0;

      DOC.body.classList.add('gj-boss');

      emit('hha:boss', { on:true, hp: state.bossHp, hpMax: state.bossHpMax, phase: state.bossPhase, rage: state.rageOn, phase2Sec: state.bossPhase2Sec });
      emit('hha:judge', { type:'bad', label:`BOSS! HP ${state.bossHpMax}` });

      fxRing(innerWidth/2, innerHeight*0.32, 'violet', { size: 260 });
      fxPop(innerWidth/2, innerHeight*0.26, `BOSS! HP ${state.bossHpMax}`, 'violet', { size: 22 });
      bodyPulse('gj-boss', 520);
    }else{
      DOC.body.classList.remove('gj-boss','gj-phase2');
      emit('hha:boss', { on:false, hp: 0, hpMax: state.bossHpMax, phase: 0, rage: state.rageOn, phase2Sec: state.bossPhase2Sec });
      emit('hha:celebrate', { kind:'boss' });
      fxCelebrate('boss', { count: 22 });

      // Storm ends when boss ends (per spec)
      if(state.stormOn) setStorm(false);
    }
  }

  function bossTryEnterPhase2(){
    if(!state.bossOn) return;
    if(state.bossPhase === 2) return;

    const half = Math.ceil(state.bossHpMax * 0.5);
    if(state.bossHp <= half){
      state.bossPhase = 2;
      state.bossPhase2Until = now() + (state.bossPhase2Sec * 1000);

      DOC.body.classList.add('gj-phase2');

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

      DOC.body.classList.remove('gj-phase2');

      emit('hha:boss', { on:true, hp: state.bossHp, hpMax: state.bossHpMax, phase: 1, rage: state.rageOn, phase2Sec: state.bossPhase2Sec });
      fxPop(innerWidth/2, innerHeight*0.26, 'BACK TO P1', 'warn', { size: 16 });
    }
  }

  function bossHpDelta(delta, why=''){
    if(!state.bossOn) return;

    const before = state.bossHp;
    state.bossHp = clamp(state.bossHp + (Number(delta)||0), 0, state.bossHpMax);

    if(state.bossHp !== before){
      emit('hha:boss', { on:true, hp: state.bossHp, hpMax: state.bossHpMax, phase: state.bossPhase, rage: state.rageOn, why, phase2Sec: state.bossPhase2Sec });
      fxPop(innerWidth/2, innerHeight*0.33, `HP ${state.bossHp}/${state.bossHpMax}`, delta<0 ? 'good' : 'bad', { size: 14 });
    }

    bossTryEnterPhase2();

    if(state.bossHp <= 0){
      emit('hha:judge', { type:'perfect', label:'BOSS DOWN!' });
      fxPop(innerWidth/2, innerHeight*0.26, 'BOSS DOWN!', 'good', { size: 22 });
      setBoss(false);
    }
  }

  // ----------------------- hit logic -----------------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){ state.combo = 0; }

  function miniOnGoodHit(rtMs){
    const m = state.mini;
    if(!m || m.done) return;

    if(m.type==='streak_good'){
      m.cur++;
      if(m.cur >= m.target){
        m.done = true;
        markMiniCleared();
      }else{
        syncQuestUI();
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
          syncQuestUI();
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
      syncQuestUI();
    }
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

      const bossBonus = state.bossOn ? (state.bossPhase===2 ? 2 : 1) : 0;
      const delta = DIFF.goodScore + Math.min(6, Math.floor(state.combo/5)) + bossBonus;

      setScore(state.score + delta, { delta, x:px, y:py });
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

      fxBurst(px,py,'diamond');
      fxRing(px,py,'violet',{ size: 180 });
      emit('hha:judge', { type:'perfect', label:'DIAMOND!', x:px, y:py, miss: state.miss });

      if(state.bossOn) bossHpDelta(-3, 'diamond');
    }

    removeTarget(tObj);

    // A+B+C triggers
    if(!state.bossOn && state.miss >= 4) setBoss(true);
    if(!state.rageOn && state.miss >= 5) setRage(true);

    if(state.miss >= DIFF.missLimit){
      endGame('missLimit');
      return;
    }

    syncQuestUI();
  }

  // cVR/VR shooting (aim from center screen)
  function shootCrosshair(){
    if(state.ended) return;

    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    // radius: make it kid-friendly but not auto-win
    const R = (isCVR || isVR) ? 86 : 72;

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

  // prevent duplicate listener
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

        if(tObj.kind === 'good'){
          state.nExpireGood++;
          resetCombo();
          addFever(6);

          const x = tObj.x, y = tObj.y;

          setMiss(state.miss + 1, { x, y, deltaMiss: 1 });
          miniOnJunkHit(); // treat as failure for streak/avoid rules

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

  // ----------------------- goal routing (optional progression) -----------------------
  function tryAdvanceGoal(){
    const g = state.goal;
    if(!g || !g.done) return;

    // advance to next goal if exists
    if(state.goalIndex < state.goals.length - 1){
      state.goalIndex++;
      state.goal = state.goals[state.goalIndex];
      syncQuestUI();
      emit('hha:coach', { kind:'tip', msg:`เปลี่ยน GOAL: ${state.goal.title}` });
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

  // ✅ IMPORTANT: use existing #endOverlay (aria-hidden)
  function showEndOverlay(summary){
    if(HUD.endOverlay){
      HUD.endOverlay.setAttribute('aria-hidden','false');
      HUD.endTitle && (HUD.endTitle.textContent = (summary.grade === 'D' ? 'Try Again' : 'Completed'));
      HUD.endSub && (HUD.endSub.textContent = `reason=${summary.reason} · run=${summary.runMode} · diff=${summary.diff}`);
      HUD.endGrade && (HUD.endGrade.textContent = summary.grade || '—');
      HUD.endScore && (HUD.endScore.textContent = String(summary.scoreFinal ?? 0));
      HUD.endMiss && (HUD.endMiss.textContent = String(summary.misses ?? 0));
      HUD.endTime && (HUD.endTime.textContent = String(summary.durationPlayedSec ?? 0));
      return;
    }

    // fallback minimal (should not happen if HTML has endOverlay)
    alert(`END: grade=${summary.grade} score=${summary.scoreFinal} miss=${summary.misses}`);
  }

  // ----------------------- end game -----------------------
  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    // clear flags for listeners
    if(state.stormOn) emit('hha:storm', { on:false, t: state.timeLeftSec });
    if(state.bossOn)  emit('hha:boss', { on:false, hp: state.bossHp, hpMax: state.bossHpMax, phase: state.bossPhase, rage: state.rageOn, phase2Sec: state.bossPhase2Sec });

    DOC.body.classList.remove('gj-storm','gj-boss','gj-phase2');

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

    // complete survive goal if still active and not exceeded
    if(state.goal && state.goal.type==='survive' && !state.goal.done){
      if(state.miss <= DIFF.missLimit){
        state.goal.done = true;
        state.goalsCleared++;
      }
      syncQuestUI();
    }

    state.startTimeIso = state.startTimeIso || new Date().toISOString();
    state.endTimeIso = new Date().toISOString();

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

    const summary = {
      projectTag: PROJECT_TAG,
      gameVersion: GAME_VERSION,
      device: deviceLabel(view),
      view,
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

      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,

      grade,
      studyId,
      phase,
      conditionGroup,
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}

    emit('hha:end', Object.assign({}, summary));
    emit('hha:celebrate', { kind:'end', grade });

    fxCelebrate('win', { count: 18 });
    bodyPulse('gj-end', 520);

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

    // time
    state.timeLeftSec -= dt;
    if(state.timeLeftSec < 0) state.timeLeftSec = 0;
    setTimeLeft(state.timeLeftSec);
    updateLowTimeFx();

    // STORM at <=30s once
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

      // fun bursts (kept reasonable)
      if(adaptiveOn && state.timeLeftSec <= 8 && rng() < 0.10) spawnOne();
      if(state.bossOn && state.bossPhase===2 && rng() < 0.16) spawnOne();
      if(state.rageOn && rng() < 0.08) spawnOne();
    }

    // expiry
    expireTargets();

    // end by time
    if(state.timeLeftSec <= 0){
      endGame('timeup');
      return;
    }

    // try goal advance
    tryAdvanceGoal();

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
    state.goalIndex = 0;
    state.goal = state.goals[state.goalIndex];

    state.miniSeq = pickMiniSequence(view);
    state.miniIndex = 0;
    state.mini = state.miniSeq[state.miniIndex];
    resetMini(state.mini);

    syncQuestUI();
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

  // expose debug
  ROOT.__GJ_STATE__ = state;
}