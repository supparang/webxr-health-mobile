// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + STORM/BOSS/RAGE + SSS Rubric)
// ✅ STORM: timeLeft<=30s
// ✅ BOSS: miss>=4 (HP 10/12/14, Phase2 last 6s)
// ✅ RAGE: miss>=5
// ✅ Emits (robust): hha:judge(type,x,y,combo), hha:score(delta,x,y), hha:miss(x,y), hha:end, hha:celebrate
// ✅ Miss definition: miss = good expired + junk hit; Shield-blocked junk does NOT count as miss
// ✅ NEW: GradeTier SSS/SS/S/A/B/C + scoreNorm80 + rubricJson + insightsJson

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ----------------------- helpers -----------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emitBoth(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
    try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function log(detail){
    emitBoth('hha:log', detail);
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

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-10_SSS';
  const PROJECT_TAG = 'GoodJunkVR';

  const rng = makeSeededRng(String(seed));

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

    goals: null,
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

    startTimeIso: new Date().toISOString(),
    endTimeIso: null,

    // FX states
    storm: false,
    boss: null, // { active, hp, hpMax, endsAt, phase2At, elL, elR, x,y, lastMoveAt }
    rage: false,
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
    m.cur = 0; m.done = false;
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
        emitBoth('hha:judge', { type:'good', label:'GOAL!', x: innerWidth/2, y: innerHeight*0.2, combo: state.combo });
      }
      setGoalText();
    }

    emitBoth('hha:judge', { type:'perfect', label:'MINI CLEAR!', x: innerWidth/2, y: innerHeight*0.25, combo: state.combo });
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

  // ----------------------- HUD / fever / shield -----------------------
  function setScore(v, meta={}){
    const next = Math.max(0, Math.floor(v));
    const delta = next - state.score;
    state.score = next;
    HUD.score && (HUD.score.textContent = String(state.score));
    if(delta !== 0){
      emitBoth('hha:score', { delta, x: meta.x ?? innerWidth/2, y: meta.y ?? innerHeight/2 });
    }
  }
  function setMiss(v, meta={}){
    const next = Math.max(0, Math.floor(v));
    const delta = next - state.miss;
    state.miss = next;
    HUD.miss && (HUD.miss.textContent = String(state.miss));
    if(delta > 0){
      emitBoth('hha:miss', { x: meta.x ?? innerWidth/2, y: meta.y ?? innerHeight/2, miss: state.miss });
    }
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

  function updateFxStates(){
    // STORM: last 30s
    const storm = (state.timeLeftSec <= 30);
    if(storm !== state.storm){
      state.storm = storm;
      DOC.body.classList.toggle('gj-storm', storm);
      if(storm){
        emitBoth('hha:judge', { type:'good', label:'STORM!', x: innerWidth/2, y: innerHeight*0.18, combo: state.combo });
      }
    }

    // RAGE
    const rage = (state.miss >= 5);
    if(rage !== state.rage){
      state.rage = rage;
      DOC.body.classList.toggle('gj-rage', rage);
      if(rage){
        emitBoth('hha:judge', { type:'bad', label:'RAGE!', x: innerWidth/2, y: innerHeight*0.2, combo: state.combo });
      }
    }
  }

  function updateLowTimeFx(){
    // show big countdown only when <=5
    const t = state.timeLeftSec;
    if(t <= 5 && t > 0){
      DOC.body.classList.add('gj-show-countdown');
      HUD.lowTimeNum && (HUD.lowTimeNum.textContent = String(Math.ceil(t)));
    }else{
      DOC.body.classList.remove('gj-show-countdown');
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
    const diamondW = (diff==='hard') ? 0.012 : 0.015;
    const starW = DIFF.starRate;
    const shieldW = DIFF.shieldRate;

    // boss/rage -> เพิ่ม junk แบบแฟร์ (ยังมี good ให้ยิงแก้ตัว)
    const junkBase = DIFF.junkRate;
    const junkW = clamp(junkBase + (state.boss?.active ? 0.06 : 0) + (state.rage ? 0.05 : 0), 0.12, 0.48);

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
      // IMPORTANT: right eye should not be clickable (avoid double hits)
      elR.style.pointerEvents = 'none';
      elR.dataset.eye = 'r';
    }

    const bornAt = now();
    const tObj = { id, kind, bornAt, lifeMs, x,y, elL, elR, hit:false };

    elL.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      onTargetHit(tObj, { via:'tap', x: ev.clientX, y: ev.clientY });
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
          emitBoth('hha:judge', { type:'perfect', label:'FAST PASS!', x: innerWidth/2, y: innerHeight*0.25, combo: state.combo });
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
        emitBoth('hha:judge', { type:'good', label:'GOAL!', x: innerWidth/2, y: innerHeight*0.18, combo: state.combo });
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

  // ----------------------- combo -----------------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){ state.combo = 0; }

  // -----------------------
  // BOSS MODE (miss>=4)
  // -----------------------
  function bossActive(){ return !!state.boss?.active; }

  function ensureBoss(){
    if(state.ended) return;
    if(bossActive()) return;
    if(state.miss < 4) return;

    DOC.body.classList.add('gj-boss');

    const rect = getSafeRect();
    const x = Math.floor((rect.xMin + rect.xMax) / 2);
    const y = Math.floor(rect.yMin + 120);

    const hpMax = DIFF.bossHP;
    const totalBossSec = 18;        // บอสอยู่บนจอรวม
    const phase2Sec = 6;            // ช่วงท้าย 6s โหด++
    const endsAt = now() + totalBossSec*1000;
    const phase2At = endsAt - phase2Sec*1000;

    const elL = DOC.createElement('div');
    elL.className = 'gj-boss';
    elL.style.left = x + 'px';
    elL.style.top  = y + 'px';
    elL.innerHTML = `<div class="icon">👾</div><div class="hp"><i></i></div>`;

    let elR = null;
    if(LAYER_R){
      elR = elL.cloneNode(true);
      elR.style.pointerEvents = 'none';
      elR.dataset.eye = 'r';
    }

    const boss = {
      active:true,
      hp: hpMax,
      hpMax,
      x, y,
      endsAt,
      phase2At,
      lastMoveAt: now(),
      elL,
      elR,
      phase: 1,
      hitCdUntil: 0,
    };
    state.boss = boss;

    function renderHp(){
      const pct = Math.max(0, Math.min(100, (boss.hp / boss.hpMax) * 100));
      try{
        boss.elL.querySelector('.hp > i').style.width = pct + '%';
        if(boss.elR) boss.elR.querySelector('.hp > i').style.width = pct + '%';
      }catch(_){}
    }
    renderHp();

    function onBossHit(ev){
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      if(state.ended || !boss.active) return;
      const t = now();
      if(t < boss.hitCdUntil) return;
      boss.hitCdUntil = t + (boss.phase===2 ? 120 : 150);

      const px = ev?.clientX ?? boss.x;
      const py = ev?.clientY ?? boss.y;

      boss.hp = Math.max(0, boss.hp - 1);
      renderHp();

      const bonus = boss.phase===2 ? 18 : 14;
      setScore(state.score + bonus, { x:px, y:py });

      emitBoth('hha:judge', { type:'perfect', label:'BOSS HIT!', x:px, y:py, combo: state.combo });

      if(boss.hp <= 0){
        boss.active = false;
        DOC.body.classList.remove('gj-boss');
        emitBoth('hha:judge', { type:'perfect', label:'BOSS DOWN!', x: boss.x, y: boss.y, combo: state.combo });
        emitBoth('hha:celebrate', { kind:'boss' });

        try{ boss.elL.remove(); }catch(_){}
        try{ boss.elR?.remove(); }catch(_){}
        return;
      }
    }

    elL.addEventListener('pointerdown', onBossHit, { passive:false });

    LAYER_L.appendChild(elL);
    if(elR && LAYER_R) LAYER_R.appendChild(elR);

    emitBoth('hha:judge', { type:'bad', label:`BOSS 등장! HP ${hpMax}`, x, y, combo: state.combo });
  }

  function tickBoss(dt){
    if(!bossActive()) return;
    const boss = state.boss;
    const t = now();

    if(boss.phase === 1 && t >= boss.phase2At){
      boss.phase = 2;
      boss.elL.classList.add('phase2');
      boss.elR?.classList.add('phase2');
      emitBoth('hha:judge', { type:'bad', label:'PHASE 2!', x: boss.x, y: boss.y, combo: state.combo });
    }

    const moveEvery = (boss.phase===2) ? 0.55 : 0.85;
    if((t - boss.lastMoveAt) >= moveEvery*1000){
      boss.lastMoveAt = t;
      const rect = getSafeRect();
      const nx = Math.floor(randIn(rng, rect.xMin+40, rect.xMax-40));
      const ny = Math.floor(randIn(rng, rect.yMin+90, rect.yMax-140));
      boss.x = nx; boss.y = ny;
      boss.elL.style.left = nx + 'px';
      boss.elL.style.top  = ny + 'px';
      if(boss.elR){
        boss.elR.style.left = nx + 'px';
        boss.elR.style.top  = ny + 'px';
      }
    }

    if(t >= boss.endsAt){
      boss.active = false;
      DOC.body.classList.remove('gj-boss');

      try{ boss.elL.remove(); }catch(_){}
      try{ boss.elR?.remove(); }catch(_){}

      setMiss(state.miss + 1, { x: innerWidth/2, y: innerHeight*0.25 });
      updateGoalsOnMiss();
      emitBoth('hha:judge', { type:'miss', label:'BOSS ESCAPE!', x: innerWidth/2, y: innerHeight*0.25, combo: state.combo });
    }
  }

  // ----------------------- hit logic -----------------------
  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    tObj.hit = true;

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

    const px = meta.x ?? tObj.x;
    const py = meta.y ?? tObj.y;

    if(kind==='good'){
      state.nHitGood++;
      addCombo();
      addFever(3.2);

      const rageMul = state.rage ? 1.20 : 1.0;
      const delta = Math.round((DIFF.goodScore + Math.min(6, Math.floor(state.combo/5))) * rageMul);

      setScore(state.score + delta, { x:px, y:py });
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);

      emitBoth('hha:judge', { type:(rtMs<=fastCfgByView(view).thrMs ? 'perfect':'good'), label:'GOOD', x:px, y:py, combo: state.combo });

    } else if(kind==='junk'){
      const blocked = useShield();
      resetCombo();

      if(blocked){
        state.nHitJunkGuard++;
        addFever(-6);
        emitBoth('hha:judge', { type:'block', label:'BLOCK', x:px, y:py, combo: state.combo });
      }else{
        state.nHitJunk++;
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1), { x:px, y:py });
        setScore(state.score + (DIFF.junkPenaltyScore||-10), { x:px, y:py });
        updateGoalsOnMiss();
        miniOnJunkHit();

        emitBoth('hha:judge', { type:'bad', label:'OOPS', x:px, y:py, combo: state.combo });

        updateFxStates();
        ensureBoss();
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1), { x:px, y:py });
      updateGoalsOnMiss();
      emitBoth('hha:judge', { type:'good', label:'STAR', x:px, y:py, combo: state.combo });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      emitBoth('hha:judge', { type:'good', label:'SHIELD', x:px, y:py, combo: state.combo });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus, { x:px, y:py });
      updateGoalsOnScore();
      emitBoth('hha:judge', { type:'perfect', label:'DIAMOND', x:px, y:py, combo: state.combo });
    }

    setMiniText();
    removeTarget(tObj);

    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // ----------------------- expiry -----------------------
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

          setMiss(state.miss + 1, { x:tObj.x, y:tObj.y });
          updateGoalsOnMiss();

          if(state.mini && state.mini.type==='streak_good'){
            resetMini(state.mini);
            setMiniText();
          }

          emitBoth('hha:judge', { type:'miss', label:'EXPIRE', x:tObj.x, y:tObj.y, combo: state.combo });

          updateFxStates();
          ensureBoss();

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

  // ----------------------- spawn rate -----------------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);

      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);

      if(state.timeLeftSec <= 30) r *= 1.12;
      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.12;

      if(bossActive()) r *= (state.boss.phase===2 ? 1.22 : 1.12);
      if(state.rage) r *= 1.10;
    }

    return clamp(r, 0.8, 2.1);
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
    const thr = fastCfgByView(view).thrMs;
    const fast = state.rtGood.filter(x => x <= thr).length;
    return Math.round((fast / state.rtGood.length) * 1000) / 10;
  }

  // =========================
  // RUBRIC + GRADE (SSS/SS/S/A/B/C)
  // =========================
  function clamp01(x){ x = Number(x)||0; return x<0?0:(x>1?1:x); }
  function safeNum(x, def=null){
    const n = Number(x);
    return Number.isFinite(n) ? n : def;
  }

  function calcScoreNorm80(scoreFinal, durationPlannedSec){
    const d = Math.max(20, Number(durationPlannedSec)||80);
    const s = Math.max(0, Number(scoreFinal)||0);
    return Math.round(s * (80 / d));
  }

  function scorePerf01(scoreNorm80, diff){
    const cap =
      diff === 'easy' ? 560 :
      diff === 'hard' ? 660 : 610;
    return clamp01((Number(scoreNorm80)||0) / cap);
  }

  function safety01(misses, diff){
    const limit =
      diff === 'easy' ? 10 :
      diff === 'hard' ? 9 : 10;

    const m = Math.max(0, Number(misses)||0);
    const s = 1 - (m / (limit * 1.15));
    return clamp01(s);
  }

  function accuracy01(accuracyGoodPct, junkErrorPct){
    const acc = safeNum(accuracyGoodPct, 0) / 100;
    const je  = safeNum(junkErrorPct, 0) / 100;

    const jePenalty = clamp01(je / 0.25); // 0..1
    const a = clamp01(acc * (1 - 0.65 * jePenalty));
    return a;
  }

  function speed01(avgRtGoodMs, fastHitRatePct, view){
    const rt = safeNum(avgRtGoodMs, null);
    const fast = safeNum(fastHitRatePct, null);

    const rtGood =
      view === 'pc'  ? 520 :
      view === 'cvr' ? 560 :
      view === 'vr'  ? 580 : 560;

    let rtPart = 0.5;
    if(rt != null){
      const t = (rtGood * 1.6 - rt) / (rtGood * 0.6);
      rtPart = clamp01(t);
    }

    let fastPart = 0.5;
    if(fast != null){
      fastPart = clamp01((fast/100) / 0.35);
    }

    return clamp01(0.55*rtPart + 0.45*fastPart);
  }

  function rubricScores(summaryLike){
    const wPerf = 40;
    const wSafe = 25;
    const wAcc  = 20;
    const wSpd  = 15;

    const perf01 = scorePerf01(summaryLike.scoreNorm80, summaryLike.diff);
    const safe01v= safety01(summaryLike.misses, summaryLike.diff);
    const acc01v = accuracy01(summaryLike.accuracyGoodPct, summaryLike.junkErrorPct);
    const spd01v = speed01(summaryLike.avgRtGoodMs, summaryLike.fastHitRatePct, summaryLike.view);

    const perf = Math.round(wPerf * perf01);
    const safe = Math.round(wSafe * safe01v);
    const accuracy = Math.round(wAcc * acc01v);
    const speed = Math.round(wSpd * spd01v);

    const total = perf + safe + accuracy + speed;
    return { total, perf, safe, accuracy, speed };
  }

  function gradeTierFromRubric(total){
    if(total >= 92) return 'SSS';
    if(total >= 84) return 'SS';
    if(total >= 76) return 'S';
    if(total >= 66) return 'A';
    if(total >= 54) return 'B';
    return 'C';
  }

  function makeInsights(summaryLike, rubric){
    const tips = [];
    const miss = Number(summaryLike.misses)||0;
    const acc  = safeNum(summaryLike.accuracyGoodPct, null);
    const junk = safeNum(summaryLike.junkErrorPct, null);
    const avgRt= safeNum(summaryLike.avgRtGoodMs, null);
    const fast = safeNum(summaryLike.fastHitRatePct, null);

    if(miss >= 7) tips.push('MISS สูง: ชะลอมือ 0.2 วิ + เล็งก่อนยิง (ใช้ 🛡️ ให้คุ้ม)');
    else if(miss >= 4) tips.push('เริ่มดีแล้ว: ถ้าลด MISS ลงอีกนิด จะไต่ SS/SSS ง่ายมาก');

    if(junk != null && junk >= 18) tips.push('โดนขยะบ่อย: ฝึก “แยกของดี/ขยะ” ก่อน แล้วค่อยเพิ่มความเร็ว');
    if(acc != null && acc < 55) tips.push('เก็บของดีพลาดเยอะ: เล็งใกล้กลางจอ + รอเป้าโผล่เต็มก่อนแตะ');

    if(avgRt != null && avgRt >= 750) tips.push('ช้าไปนิด: ลองเล่น “เก็บให้ไว” ให้ผ่าน 2 ครั้งติด (ฝึกมือ)');
    if(fast != null && fast < 18) tips.push('อยากได้ S/SS: เน้นยิงให้เข้า “โซนเร็ว” (FAST HIT) เพิ่มขึ้น');

    const tier = rubric?.tier || 'C';
    if(tier === 'SSS') tips.unshift('สุดยอด! ได้ SSS แล้ว ลองเพิ่ม “ความแม่น + ไม่โดนขยะ” ให้คงที่ทุกครั้ง');
    else if(tier === 'SS') tips.unshift('โหดมาก! อีกนิดเดียวขึ้น SSS: ลด MISS หรือ Junk Error ลงเล็กน้อย');
    else if(tier === 'S') tips.unshift('เยี่ยม! ได้ S แล้ว ถ้าอยากขึ้น SS ให้คุม MISS + Junk Error ให้ต่ำ');
    else if(tier === 'A') tips.unshift('ดีมาก! ลองลด MISS ลง 1–2 ครั้ง แล้วคะแนนจะพุ่งขึ้น');
    else if(tier === 'B') tips.unshift('เริ่มเข้าที่แล้ว! โฟกัส “อย่าโดนขยะ” เป็นอันดับแรก');
    else tips.unshift('ไม่เป็นไร เริ่มใหม่ได้! ลองเล่น easy ก่อนเพื่อฝึกแยกของดี/ขยะ');

    return tips.slice(0,4);
  }

  function showEndOverlay(summary){
    const endOverlay = byId('endOverlay');
    if(endOverlay){
      try{
        byId('endTitle').textContent = (summary.reason === 'miss-limit') ? 'Game Over' : 'Completed';
        byId('endSub').textContent = `reason=${summary.reason} | mode=${summary.runMode} | view=${summary.device}`;
        byId('endGrade').textContent = summary.gradeTier || summary.grade || '—';
        byId('endScore').textContent = String(summary.scoreFinal ?? 0);
        byId('endMiss').textContent  = String(summary.misses ?? 0);
        byId('endTime').textContent  = String(Math.round(Number(summary.durationPlayedSec||0)));

        // optional extended ids
        const accEl = byId('endAcc');
        const junkEl= byId('endJunk');
        const rtEl  = byId('endAvgRt');
        const cmbEl = byId('endComboMax');
        if(accEl)  accEl.textContent  = (summary.accuracyGoodPct==null) ? '—' : `${summary.accuracyGoodPct}%`;
        if(junkEl) junkEl.textContent = (summary.junkErrorPct==null) ? '—' : `${summary.junkErrorPct}%`;
        if(rtEl)   rtEl.textContent   = (summary.avgRtGoodMs==null) ? '—' : `${summary.avgRtGoodMs}ms`;
        if(cmbEl)  cmbEl.textContent  = (summary.comboMax==null) ? '—' : String(summary.comboMax);

        endOverlay.style.display = 'flex';
        endOverlay.setAttribute('aria-hidden','false');
        return;
      }catch(_){}
    }
    alert(`END: score=${summary.scoreFinal} miss=${summary.misses} grade=${summary.gradeTier || summary.grade}`);
  }

  // ----------------------- end game -----------------------
  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

    if(state.boss?.active){
      try{ state.boss.elL?.remove(); }catch(_){}
      try{ state.boss.elR?.remove(); }catch(_){}
      state.boss.active = false;
    }
    DOC.body.classList.remove('gj-boss','gj-storm','gj-rage');

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

    const scoreNorm80 = calcScoreNorm80(scoreFinal, durationPlannedSec);

    const rubric = rubricScores({
      scoreNorm80,
      misses,
      diff,
      view,
      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs,
      fastHitRatePct,
    });
    rubric.tier = gradeTierFromRubric(rubric.total);

    const insights = makeInsights({
      misses,
      diff,
      view,
      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs,
      fastHitRatePct,
      scoreNorm80,
    }, rubric);

    const gradeTier = rubric.tier;
    setGradeText(gradeTier);

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
      scoreNorm80,
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

      grade: gradeTier,
      gradeTier,
      rubricJson: JSON.stringify({ total: rubric.total, perf: rubric.perf, safe: rubric.safe, accuracy: rubric.accuracy, speed: rubric.speed }),
      insightsJson: JSON.stringify(insights),

      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,
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
      scoreNorm80,
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

      grade: gradeTier,
      gradeTier,
      rubricJson: summary.rubricJson,
      insightsJson: summary.insightsJson,
    });

    emitBoth('hha:celebrate', { kind:'end', grade: gradeTier, gradeTier });
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

    state.timeLeftSec -= dt;
    if(state.timeLeftSec < 0) state.timeLeftSec = 0;
    setTimeLeft(state.timeLeftSec);
    updateLowTimeFx();

    updateFxStates();

    tickMini(dt);

    ensureBoss();
    tickBoss(dt);

    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();

      if(adaptiveOn){
        if(state.timeLeftSec <= 10 && rng() < 0.10) spawnOne();
        if(bossActive() && state.boss.phase===2 && rng() < 0.10) spawnOne();
      }
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

    emitBoth('quest:update', { goal: state.goal, mini: state.mini });
  }

  function start(){
    if(state.started) return;
    state.started = true;

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
      msg: 'ทริค: อย่าแตะขยะ! ⭐ ลด MISS และ 🛡️ บล็อกขยะ (ไม่เป็น MISS)',
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