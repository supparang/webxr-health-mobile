// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + Boss++ A+B+C) — 2026-01-13b
// ✅ Mobile / PC / VR(Cardboard) / cVR
// ✅ HUD-safe spawn via CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as Miss
// ✅ Storm rule: timeLeft <= 30s => STORM ON (once), ends when boss ends or game ends
// ✅ Boss rule: miss >= 4 => BOSS ON (HP by diff: 10/12/14)
// ✅ Rage rule: miss >= 5 => RAGE ON (until end) — fair but tense
// ✅ Boss Phase2 lasts 6s (more pressure, then returns to Phase1 if not cleared)
// ✅ Emits (for FX director + logger):
//    hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge,
//    hha:storm, hha:boss, hha:end, hha:celebrate
// ✅ End summary: uses existing #endOverlay if present (aria-hidden ONLY) + HUB/Replay buttons
// ✅ Saves last summary (HHA_LAST_SUMMARY)

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ----------------------- helpers -----------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> (ROOT.performance && performance.now) ? performance.now() : Date.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
    try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function log(detail){
    // hha-cloud-logger listens to hha:log / hha:end (depending on your implementation)
    try{ emit('hha:log', detail); }catch(_){}
  }

  // ----------------------- rng (deterministic for research) -----------------------
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
  // NOTE: boot.js is STRICT AUTO and passes view; we do not rely on ?view= (but allow fallback)
  const view = String(payload.view || DOC.body?.dataset?.view || 'mobile').toLowerCase();
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

  // difficulty tuning (HP:10/12/14)
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
      bossHpMax: 10,
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
      bossHpMax: 14,
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
      bossHpMax: 12,
    };
  })();

  // play vs research (adaptive OFF in research)
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
    targets: new Map(), // id => targetObj

    // boss / storm / rage (A+B+C)
    stormOn: false,
    bossOn: false,
    rageOn: false,
    bossHp: 0,
    bossHpMax: DIFF.bossHpMax,
    bossPhase: 0,          // 0 none, 1 phase1, 2 phase2
    bossPhase2Sec: 6,
    bossPhase2Until: 0,

    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  // ----------------------- mini config -----------------------
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
      { type:'avoid_junk',  title:'อย่าโดนขยะ', target:6, cur:0, done:false }, // seconds survive
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
    // NOTE: goal 1-3 (ชัด + เด็กป.5 เล่นแล้วรู้สึก “ไปต่อ”)
    return [
      { type:'survive', title:'เอาตัวรอด', target: DIFF.missLimit, cur:0, done:false,
        desc:`MISS ต้องไม่เกิน ${DIFF.missLimit}` },

      { type:'score', title:'ทำคะแนน', target: (diff==='easy'? 420 : diff==='hard'? 520 : 470), cur:0, done:false,
        desc:`เก็บของดีเพื่อทำคะแนนให้ถึงเป้า` },

      { type:'minis', title:'ทำ MINI', target: 2, cur:0, done:false,
        desc:`ผ่าน MINI ให้ได้ 2 ครั้ง` },
    ];
  }

  function pushQuestUpdate(){
    emit('quest:update', { goal: state.goal, mini: state.mini });
  }

  function setGoalText(){
    const g = state.goal;
    if(!g) return;
    if(HUD.goal) HUD.goal.textContent = g.title || '—';
    if(HUD.goalTarget) HUD.goalTarget.textContent = String(g.target ?? 0);
    if(HUD.goalCur) HUD.goalCur.textContent = String(g.cur ?? 0);
    if(HUD.goalDesc) HUD.goalDesc.textContent = g.desc || '—';
    pushQuestUpdate();
  }

  function setMiniText(){
    const m = state.mini;
    if(!m){
      if(HUD.mini) HUD.mini.textContent = '—';
      if(HUD.miniTimer) HUD.miniTimer.textContent = '—';
      pushQuestUpdate();
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
    pushQuestUpdate();
  }

  function goalAdvanceIfDone(){
    // if current goal done, advance to next
    if(!state.goal || !state.goal.done) return;
    if(state.goalIndex >= state.goals.length - 1) return;
    state.goalIndex++;
    state.goal = state.goals[state.goalIndex];
    setGoalText();
    emit('hha:coach', { msg: `เยี่ยม! ไป GOAL ต่อ: ${state.goal.title}`, kind:'goal-next' });
    bodyPulse('gj-goal-next', 260);
  }

  function markGoalDone(g){
    if(!g || g.done) return;
    g.done = true;
    state.goalsCleared++;
    emit('hha:judge', { kind:'perfect', type:'perfect', label:'GOAL!', state:'goal' });
    emit('hha:celebrate', { kind:'goal' });
    bodyPulse('hha-goal-clear', 240);
    fxPop(innerWidth/2, innerHeight*0.24, 'GOAL ✅', 'good', { size: 18 });
    setGoalText();
    goalAdvanceIfDone();
  }

  function nextMini(){
    state.miniIndex = (state.miniIndex + 1) % state.miniSeq.length;
    state.mini = state.miniSeq[state.miniIndex];
    resetMini(state.mini);
    setMiniText();
  }

  function markMiniCleared(){
    state.miniCleared++;

    // goal type minis
    if(state.goal && state.goal.type==='minis' && !state.goal.done){
      state.goal.cur = clamp(state.miniCleared, 0, state.goal.target);
      if(state.goal.cur >= state.goal.target){
        markGoalDone(state.goal);
      }else{
        setGoalText();
      }
    }

    emit('hha:judge', { kind:'mini', type:'perfect', label:'MINI CLEAR!', state:'mini' });
    emit('hha:celebrate', { kind:'mini' });
    bodyPulse('gj-mini-clear', 220);
    fxPop(innerWidth/2, innerHeight*0.27, 'MINI ✅', 'warn', { size: 16 });

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
        // update occasionally
        if((Math.floor(m.cur * 2) % 2)===0) setMiniText();
      }
      return;
    }

    if(m.type==='fast_hits'){
      m.leftSec = Math.max(0, (Number(m.leftSec)||0) - dtSec);
      if(HUD.miniTimer) HUD.miniTimer.textContent = `${Math.ceil(m.leftSec)}s`;

      // time out => reset (เด็กป.5 ไม่ให้ “ตาย” mini)
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
    if(HUD.score) HUD.score.textContent = String(state.score);
    emit('hha:score', Object.assign({ score: state.score }, meta||{}));
  }
  function setMiss(v, meta=null){
    state.miss = Math.max(0, Math.floor(v));
    if(HUD.miss) HUD.miss.textContent = String(state.miss);
    emit('hha:miss', Object.assign({ miss: state.miss }, meta||{}));
  }
  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    if(HUD.time) HUD.time.textContent = String(Math.ceil(state.timeLeftSec));
    emit('hha:time', { t: state.timeLeftSec, timeLeftSec: state.timeLeftSec });
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
    const b = DOC.body;
    if(!b) return;

    // class hooks (CSS) + aria-hidden (overlay)
    if(t <= 10){
      b.classList.add('gj-lowtime');
      if(t <= 5) b.classList.add('gj-lowtime5');
      else b.classList.remove('gj-lowtime5');

      if(HUD.lowTimeOverlay){
        HUD.lowTimeOverlay.setAttribute('aria-hidden', (t<=5) ? 'false' : 'true');
      }
      if(HUD.lowTimeNum && t<=5){
        HUD.lowTimeNum.textContent = String(Math.ceil(t));
        b.classList.add('gj-tick');
        setTimeout(()=>b.classList.remove('gj-tick'), 120);
      }
    }else{
      b.classList.remove('gj-lowtime','gj-lowtime5','gj-tick');
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

    // give breathing room on sides (kid-friendly)
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
    const starW   = DIFF.starRate;
    const shieldW = DIFF.shieldRate;
    const junkW   = DIFF.junkRate;

    // Boss/Storm/Rage modifiers (A+B+C)
    let junkBoost = 0;
    let goodBoost = 0;

    if(state.stormOn) junkBoost += 0.03;
    if(state.bossOn)  junkBoost += (state.bossPhase===2 ? 0.08 : 0.05);
    if(state.rageOn)  junkBoost += 0.06;

    // keep it fair: give tiny good boost while boss is on so kids can recover
    if(state.bossOn)  goodBoost += 0.02;

    const junkAdj   = clamp(junkW + junkBoost, 0.08, 0.55);
    const starAdj   = clamp(starW + (state.bossOn?0.01:0), 0.02, 0.14);
    const shieldAdj = clamp(shieldW + (state.bossOn?0.01:0), 0.02, 0.14);

    let goodW = Math.max(0.01, 1 - (junkAdj + starAdj + shieldAdj + diamondW));
    goodW = clamp(goodW + goodBoost, 0.20, 0.85);

    return pickWeighted(rng, [
      {k:'good',   w:goodW},
      {k:'junk',   w:junkAdj},
      {k:'star',   w:starAdj},
      {k:'shield', w:shieldAdj},
      {k:'diamond',w:diamondW},
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

    // life modifiers
    const bossLifeMul = state.bossOn ? (state.bossPhase===2 ? 0.86 : 0.94) : 1.0;
    const rageLifeMul = state.rageOn ? 0.92 : 1.0;

    const lifeMs =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      Math.round(DIFF.goodLifeMs * 1.25);

    const lifeAdj = Math.round(lifeMs * bossLifeMul * rageLifeMul);

    // size scaling
    const baseSize = (kind==='good') ? 54 : (kind==='junk') ? 56 : 50;
    const bossSizeMul = state.bossOn ? 0.96 : 1.0;
    const rageSizeMul = state.rageOn ? 0.95 : 1.0;
    const size = clamp((baseSize + randIn(rng, -4, 10)) * bossSizeMul * rageSizeMul, 44, 72);

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
    const tObj = { id, kind, bornAt, lifeMs: lifeAdj, x,y, elL, elR, hit:false };

    // direct tap (pc/mobile) — in cVR your CSS disables pointer-events, so this won't fire (intended)
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
          emit('hha:judge', { type:'perfect', kind:'perfect', label:'FAST PASS!', state:'mini' });
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
        markGoalDone(g);
      }else{
        setGoalText();
      }
    }
  }
  function updateGoalsOnMiss(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='survive'){
      g.cur = clamp(state.miss, 0, g.target);
      // goal survive is "keep miss <= limit" (we don't auto-complete early; complete at end if not failed)
      setGoalText();
    }
  }

  // ----------------------- Boss / Storm / Rage (A+B+C) -----------------------
  function setStorm(on){
    on = !!on;
    if(on === state.stormOn) return;
    state.stormOn = on;

    // state tags for FX Director
    emit('hha:storm', { on, t: state.timeLeftSec, state: on?'storm':'', phase: on?1:0 });

    emit('hha:judge', {
      kind: on ? 'storm' : 'good',
      type: on ? 'bad' : 'good',
      label: on ? 'STORM!' : 'STORM CLEAR',
      state: on ? 'storm' : ''
    });

    if(on){
      DOC.body?.classList.add('gj-storm');
      bodyPulse('gj-storm', 420);
      fxRing(innerWidth/2, innerHeight*0.28, 'star', { size: 220 });
      fxPop(innerWidth/2, innerHeight*0.25, 'STORM!', 'warn', { size: 22 });
    }else{
      DOC.body?.classList.remove('gj-storm');
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

      DOC.body?.classList.add('gj-boss');

      emit('hha:boss', {
        on:true,
        hp: state.bossHp,
        hpMax: state.bossHpMax,
        phase: state.bossPhase,
        phase2Sec: state.bossPhase2Sec,
        rage: state.rageOn,
        state:'boss'
      });

      emit('hha:judge', { kind:'boss', type:'bad', label:'BOSS!', state:'boss' });
      bodyPulse('gj-boss', 520);
      fxRing(innerWidth/2, innerHeight*0.32, 'violet', { size: 260 });
      fxPop(innerWidth/2, innerHeight*0.26, `BOSS! HP ${state.bossHpMax}`, 'violet', { size: 22 });

    }else{
      DOC.body?.classList.remove('gj-boss');
      DOC.body?.classList.remove('gj-phase2');

      emit('hha:boss', {
        on:false,
        hp: 0,
        hpMax: state.bossHpMax,
        phase: 0,
        rage: state.rageOn,
        state:''
      });

      emit('hha:celebrate', { kind:'boss' });
      fxCelebrate('boss', { count: 22 });
    }
  }

  function setRage(on){
    on = !!on;
    if(on === state.rageOn) return;
    state.rageOn = on;

    if(on) DOC.body?.classList.add('gj-rage');
    else DOC.body?.classList.remove('gj-rage');

    // update boss event so HUD/FX knows rage toggled
    emit('hha:boss', {
      on: state.bossOn,
      hp: state.bossHp,
      hpMax: state.bossHpMax,
      phase: state.bossPhase,
      rage: state.rageOn,
      phase2Sec: state.bossPhase2Sec,
      state: state.bossOn ? 'boss' : (state.rageOn ? 'rage' : '')
    });

    emit('hha:judge', { kind:'rage', type:'bad', label: on ? 'RAGE!' : 'RAGE OFF', state:'rage' });

    if(on){
      bodyPulse('gj-rage', 620);
      fxRing(innerWidth/2, innerHeight*0.30, 'bad', { size: 280 });
      fxPop(innerWidth/2, innerHeight*0.25, 'RAGE!', 'bad', { size: 24 });
    }
  }

  function bossTryEnterPhase2(){
    if(!state.bossOn) return;
    if(state.bossPhase === 2) return;

    // Enter Phase2 when HP <= half
    const half = Math.ceil(state.bossHpMax * 0.5);
    if(state.bossHp <= half){
      state.bossPhase = 2;
      state.bossPhase2Until = now() + (state.bossPhase2Sec * 1000);

      DOC.body?.classList.add('gj-phase2');

      emit('hha:boss', {
        on:true,
        hp: state.bossHp,
        hpMax: state.bossHpMax,
        phase: 2,
        rage: state.rageOn,
        phase2Sec: state.bossPhase2Sec,
        state:'boss',
        tag:'phase2'
      });

      emit('hha:judge', { kind:'boss', type:'bad', label:'PHASE 2!', state:'boss', tag:'phase2' });
      fxRing(innerWidth/2, innerHeight*0.32, 'bad', { size: 300 });
      fxPop(innerWidth/2, innerHeight*0.26, 'PHASE 2!', 'bad', { size: 22 });
      bodyPulse('gj-phase2', 520);
    }
  }

  function bossTick(){
    if(!state.bossOn) return;

    if(state.bossPhase === 2 && state.bossPhase2Until > 0 && now() >= state.bossPhase2Until){
      // Phase2 ends => back to Phase1 (still boss fight)
      state.bossPhase = 1;
      state.bossPhase2Until = 0;
      DOC.body?.classList.remove('gj-phase2');

      emit('hha:boss', {
        on:true,
        hp: state.bossHp,
        hpMax: state.bossHpMax,
        phase: 1,
        rage: state.rageOn,
        phase2Sec: state.bossPhase2Sec,
        state:'boss',
        tag:'phase1'
      });

      fxPop(innerWidth/2, innerHeight*0.26, 'BACK TO P1', 'warn', { size: 16 });
    }
  }

  function bossHpDelta(delta, reason=''){
    if(!state.bossOn) return;
    const before = state.bossHp;
    state.bossHp = clamp(state.bossHp + (Number(delta)||0), 0, state.bossHpMax);

    if(state.bossHp !== before){
      emit('hha:boss', {
        on:true,
        hp: state.bossHp,
        hpMax: state.bossHpMax,
        phase: state.bossPhase,
        rage: state.rageOn,
        why: reason,
        phase2Sec: state.bossPhase2Sec,
        state:'boss'
      });

      fxPop(innerWidth/2, innerHeight*0.33, `HP ${state.bossHp}/${state.bossHpMax}`, delta<0 ? 'good' : 'bad', { size: 14 });
    }

    bossTryEnterPhase2();

    // boss cleared
    if(state.bossHp <= 0){
      setBoss(false);
      // storm ends when boss ends
      if(state.stormOn) setStorm(false);

      emit('hha:judge', { kind:'boss', type:'perfect', label:'BOSS DOWN!', state:'boss' });
      fxPop(innerWidth/2, innerHeight*0.26, 'BOSS DOWN!', 'good', { size: 22 });
    }
  }

  // ----------------------- hit logic -----------------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){
    state.combo = 0;
  }

  function addBossTriggersIfNeeded(){
    if(!state.bossOn && state.miss >= 4) setBoss(true);
    if(!state.rageOn && state.miss >= 5) setRage(true);
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

      setScore(state.score + delta, { delta, x:px, y:py, kind:'good' });
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);

      fxBurst(px,py,'good');
      fxRing(px,py,'good',{ size: 120 });

      emit('hha:judge', {
        kind:'good',
        type:'good',
        label:'GOOD!',
        x:px, y:py,
        combo: state.combo,
        miss: state.miss,
        state: state.bossOn ? 'boss' : (state.rageOn ? 'rage' : (state.stormOn ? 'storm' : ''))
      });

      // boss: good hits reduce HP (phase2 hits harder)
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

        emit('hha:judge', {
          kind:'block',
          type:'block',
          label:'BLOCK!',
          x:px, y:py,
          combo: state.combo,
          miss: state.miss,
          state:''
        });

      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1), { x:px, y:py, deltaMiss: (DIFF.junkPenaltyMiss||1) });
        setScore(state.score + (DIFF.junkPenaltyScore||-10), { delta: (DIFF.junkPenaltyScore||-10), x:px, y:py, kind:'junk' });

        updateGoalsOnMiss();
        miniOnJunkHit();

        fxBurst(px,py,'bad');
        fxRing(px,py,'bad',{ size: 150 });

        emit('hha:judge', {
          kind:'junk',
          type:'bad',
          label:'OOPS!',
          x:px, y:py,
          combo: state.combo,
          miss: state.miss,
          state: state.bossOn ? 'boss' : (state.rageOn ? 'rage' : (state.stormOn ? 'storm' : ''))
        });

        bodyPulse('gj-junk-hit', 220);

        // boss: junk heals HP slightly (pressure)
        if(state.bossOn){
          const heal = (state.bossPhase===2 ? 2 : 1);
          bossHpDelta(+heal, 'junk-hit');
        }

        addBossTriggersIfNeeded();

        if(state.miss >= DIFF.missLimit){
          endGame('missLimit');
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

      emit('hha:judge', { kind:'star', type:'perfect', label:'STAR!', x:px, y:py, miss: state.miss });

      if(state.bossOn) bossHpDelta(-1, 'star');

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);

      fxBurst(px,py,'shield');
      fxRing(px,py,'shield',{ size: 160 });
      fxPop(px,py,'SHIELD +1','cyan',{ size: 16 });

      emit('hha:judge', { kind:'shield', type:'perfect', label:'SHIELD!', x:px, y:py, miss: state.miss });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);

      const bonus = 35;
      setScore(state.score + bonus, { delta: bonus, x:px, y:py, kind:'diamond' });
      updateGoalsOnScore();

      fxBurst(px,py,'diamond');
      fxRing(px,py,'violet',{ size: 180 });

      emit('hha:judge', { kind:'diamond', type:'perfect', label:'DIAMOND!', x:px, y:py, miss: state.miss });

      if(state.bossOn) bossHpDelta(-3, 'diamond');
    }

    setMiniText();
    removeTarget(tObj);

    // Boss/Rage triggers after any miss-changing event
    addBossTriggersIfNeeded();

    // “Goal complete” progression check
    goalAdvanceIfDone();

    // If all goals done => you can end early (optional). We keep it as “win condition” to feel rewarding.
    if(state.goalsCleared >= state.goalsTotal){
      endGame('goalsComplete');
      return;
    }

    // missLimit fail-safe
    if(state.miss >= DIFF.missLimit){
      endGame('missLimit');
    }
  }

  // cVR/VR shooting (crosshair center)
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
      emit('hha:judge', { kind:'miss', type:'miss', label:'MISS', x:cx, y:cy, miss: state.miss });
    }
  }

  // avoid duplicate listeners
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
          updateGoalsOnMiss();

          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          fxBurst(x, y, 'bad');
          fxRing(x, y, 'bad', { size: 170 });
          fxPop(x, y, 'MISS', 'bad', { size: 16 });

          emit('hha:judge', {
            kind:'expire',
            type:'miss',
            label:'MISS!',
            x, y,
            miss: state.miss,
            state: state.bossOn ? 'boss' : (state.rageOn ? 'rage' : (state.stormOn ? 'storm' : ''))
          });

          bodyPulse('gj-good-expire', 160);

          addBossTriggersIfNeeded();

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

    // adaptive (off in research)
    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);
    }

    // time ramps
    if(state.timeLeftSec <= 18) r *= 1.10;
    if(state.timeLeftSec <= 10) r *= 1.15;

    // storm/boss/rage ramps
    if(state.stormOn) r *= 1.10;
    if(state.bossOn)  r *= (state.bossPhase===2 ? 1.30 : 1.18);
    if(state.rageOn)  r *= 1.18;

    return clamp(r, 0.8, 2.25);
  }

  // ----------------------- mini/goal bridging -----------------------
  function miniOnGoodHitBridge(rtMs){
    // (kept for readability) — calls real handler
    miniOnGoodHit(rtMs);
  }
  function miniOnGoodHit(rtMs){ miniOnGoodHitImpl(rtMs); }
  function miniOnGoodHitImpl(rtMs){
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
          emit('hha:judge', { kind:'mini', type:'perfect', label:'FAST PASS!', state:'mini' });
          markMiniCleared();
        }else{
          setMiniText();
        }
      }
      return;
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

  // ----------------------- end overlay (use existing DOM first) -----------------------
  function showEndOverlay(summary){
    // Preferred: existing overlay in HTML
    const endOverlay = byId('endOverlay');
    const endTitle = byId('endTitle');
    const endSub   = byId('endSub');
    const endGrade = byId('endGrade');
    const endScore = byId('endScore');
    const endMiss  = byId('endMiss');
    const endTime  = byId('endTime');

    const btnBack = byId('endBackHub') || byId('btnBackHub');
    const btnReplay = byId('endReplay') || byId('btnRestartEnd') || byId('btnReplay');

    function hardFlush(){
      try{ ROOT.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){}
    }
    function flushThenGo(url){
      hardFlush();
      setTimeout(()=>{ location.href = url; }, 260);
    }

    // bind once
    if(btnReplay && !btnReplay.__HHA_BOUND__){
      btnReplay.__HHA_BOUND__ = true;
      btnReplay.addEventListener('click', ()=> location.reload());
    }
    if(btnBack && !btnBack.__HHA_BOUND__){
      btnBack.__HHA_BOUND__ = true;
      btnBack.addEventListener('click', ()=>{
        if(hub) flushThenGo(hub);
        else alert('ไม่พบ hub ในพารามิเตอร์ URL (hub=...)');
      });
    }

    if(endOverlay){
      if(endTitle) endTitle.textContent = (summary.reason === 'missLimit') ? 'Game Over' : 'Completed';
      if(endSub){
        endSub.textContent =
          `reason=${summary.reason||'-'} | mode=${summary.runMode||runMode} | view=${summary.device||deviceLabel(view)} | diff=${diff}`;
      }
      if(endGrade) endGrade.textContent = summary.grade || '—';
      if(endScore) endScore.textContent = String(summary.scoreFinal ?? 0);
      if(endMiss)  endMiss.textContent  = String(summary.misses ?? 0);
      if(endTime)  endTime.textContent  = String(Math.round(Number(summary.durationPlayedSec||0)));

      endOverlay.setAttribute('aria-hidden','false');
      // allow CSS-only show; but safe fallback:
      endOverlay.style.display = 'flex';
      return;
    }

    // Fallback minimal overlay if HTML overlay missing
    const ov = DOC.createElement('div');
    ov.style.cssText = `
      position:fixed; inset:0; z-index:220;
      display:flex; align-items:center; justify-content:center;
      background: rgba(2,6,23,.86); backdrop-filter: blur(10px);
      padding: calc(18px + var(--sat)) 16px calc(18px + var(--sab));
      color:#e5e7eb;
      font-family: system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
    `;
    const card = DOC.createElement('div');
    card.style.cssText = `
      width:min(760px, 94vw);
      background: rgba(2,6,23,.84);
      border:1px solid rgba(148,163,184,.22);
      border-radius: 22px;
      padding:18px;
      box-shadow: 0 18px 55px rgba(0,0,0,.45);
    `;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;">
        <div>
          <div style="font-size:22px;font-weight:1200;">สรุปผล — GoodJunkVR</div>
          <div style="margin-top:6px;color:#94a3b8;font-weight:900;font-size:12px;">
            view=${deviceLabel(view)} | run=${runMode} | diff=${diff} | seed=${String(seed).slice(0,18)}
          </div>
        </div>
        <div style="font-size:56px;font-weight:1300;line-height:1;">${summary.grade || '—'}</div>
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

      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="__btnReplay" type="button" style="
          flex:1; min-width:220px; height:54px; border-radius:16px;
          border:1px solid rgba(34,197,94,.35);
          background: rgba(34,197,94,.16); color:#eafff3;
          font-weight:1200; font-size:16px; cursor:pointer;
        ">เล่นอีกครั้ง</button>

        <button id="__btnBack" type="button" style="
          flex:1; min-width:220px; height:54px; border-radius:16px;
          border:1px solid rgba(148,163,184,.22);
          background: rgba(2,6,23,.55); color:#e5e7eb;
          font-weight:1200; font-size:16px; cursor:pointer;
        ">กลับ HUB</button>
      </div>
    `;
    ov.appendChild(card);
    DOC.body.appendChild(ov);

    byId('__btnReplay')?.addEventListener('click', ()=> location.reload());
    byId('__btnBack')?.addEventListener('click', ()=>{
      if(hub) flushThenGo(hub);
      else alert('ไม่พบ hub ในพารามิเตอร์ URL (hub=...)');
    });
  }

  // ----------------------- end game -----------------------
  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    // stop states
    if(state.stormOn) emit('hha:storm', { on:false, t: state.timeLeftSec, state:'' });
    if(state.bossOn)  emit('hha:boss', { on:false, hp: state.bossHp, hpMax: state.bossHpMax, phase: state.bossPhase, rage: state.rageOn, state:'' });

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

    // survive goal completes at end if not failed
    if(state.goals?.length && state.goals[0]?.type === 'survive'){
      const g = state.goals[0];
      g.cur = clamp(state.miss, 0, g.target);
      if(state.miss < g.target && !g.done){
        markGoalDone(g);
      }else{
        setGoalText();
      }
    }

    const scoreFinal = state.score;
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
      comboMax: state.comboMax,
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
      reason,
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,
    }, summary));

    emit('hha:celebrate', { kind:'end', grade });

    // final FX
    fxCelebrate((reason === 'missLimit') ? 'lose' : 'win', { count: 18 });
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

    state.tNow = t;

    // time
    state.timeLeftSec -= dt;
    if(state.timeLeftSec < 0) state.timeLeftSec = 0;
    setTimeLeft(state.timeLeftSec);
    updateLowTimeFx();

    // STORM trigger at 30s (once)
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

      // extra bursts late/boss phase2 (fun but fair)
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

    // goals
    state.goals = makeGoals();
    state.goalIndex = 0;
    state.goal = state.goals[state.goalIndex];
    setGoalText();

    // minis
    state.miniSeq = pickMiniSequence(view);
    state.miniIndex = 0;
    state.mini = state.miniSeq[state.miniIndex];
    resetMini(state.mini);
    setMiniText();

    pushQuestUpdate();
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
        log({ type:'visibility', v:'hidden', t: new Date().toISOString(), projectTag: PROJECT_TAG });
      }
    }catch(_){}
  }, { passive:true });

  ROOT.addEventListener('pagehide', ()=>{
    try{
      if(!state.ended){
        log({ type:'pagehide', t: new Date().toISOString(), projectTag: PROJECT_TAG });
      }
    }catch(_){}
  }, { passive:true });

  // expose debug
  ROOT.__GJ_STATE__ = state;
}