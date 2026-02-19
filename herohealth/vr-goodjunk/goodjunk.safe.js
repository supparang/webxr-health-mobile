// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (BOSS++ + STORM + RAGE + TELEGRAPH)
// PATCH v20260219-fx+coords+junk
// ✅ FIX: coordinate space unified to #gj-layer rect (shoot/tap/FX)
// ✅ FIX: crosshair hit uses real DOMRect centers (robust on short screens/HUD)
// ✅ FIX: cVR right-eye clone also gets pointer listener (optional)
// ✅ FIX: Effects ALWAYS show (Particles optional; DOM fallback guaranteed)
// ✅ PATCH: JUNK case (BLOCK + HIT) has strong distinct FX

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ---------------- helpers ----------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ---------------- config ----------------
  const view = String(payload.view || qs('view','mobile') || 'mobile').toLowerCase();
  const diff = String(payload.diff || qs('diff','normal') || 'normal').toLowerCase();
  const runMode = String(payload.run || qs('run','play') || 'play').toLowerCase();
  const durationPlannedSec = clamp(Number(payload.time ?? qs('time','80') ?? 80) || 80, 20, 300);

  const seedParam = (payload.seed ?? qs('seed', null));
  const seed = (runMode === 'research')
    ? (seedParam ?? (qs('ts', null) ?? 'RESEARCH-SEED'))
    : (seedParam ?? String(Date.now()));

  const studyId = payload.studyId ?? qs('studyId', qs('study', null));
  const phase = payload.phase ?? qs('phase', null);
  const conditionGroup = payload.conditionGroup ?? qs('conditionGroup', qs('cond', null));

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-02-19_FX_COORDS_JUNK';
  const PROJECT_TAG = 'GoodJunkVR';

  // seeded RNG
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

  const rng = makeSeededRng(String(seed));
  const isVR  = (view === 'vr');
  const isCVR = (view === 'cvr');

  const LAYER_L = byId('gj-layer');
  const LAYER_R = byId('gj-layer-r');

  if(!LAYER_L){
    console.error('[GoodJunkVR] missing #gj-layer');
    return;
  }

  // show right eye only when cvr
  try{
    if(LAYER_R){
      LAYER_R.setAttribute('aria-hidden', (isCVR ? 'false' : 'true'));
      LAYER_R.style.display = isCVR ? 'block' : 'none';
    }
  }catch(_){}

  // ---------------- coordinate helpers (PATCH) ----------------
  function layerRect(){
    try{
      const r = LAYER_L.getBoundingClientRect();
      if(r && r.width > 10 && r.height > 10) return r;
    }catch(_){}
    return { left:0, top:0, width:DOC.documentElement.clientWidth, height:DOC.documentElement.clientHeight };
  }

  function centerOfTarget(tObj){
    try{
      const el = tObj?.elL;
      if(el){
        const r = el.getBoundingClientRect();
        if(r && r.width > 0 && r.height > 0){
          return { x: r.left + r.width/2, y: r.top + r.height/2 };
        }
      }
    }catch(_){}
    if(Number.isFinite(tObj?.ax) && Number.isFinite(tObj?.ay)) return { x: tObj.ax, y: tObj.ay };
    return { x: 0, y: 0 };
  }

  function toLayerLocal(clientX, clientY){
    const r = layerRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  // ---------------- difficulty ----------------
  const DIFF = (() => {
    if(diff==='easy') return {
      spawnPerSec: 1.15,
      junkRate: 0.22,
      starRate: 0.08,
      shieldRate: 0.06,
      diamondRate: 0.015,
      goodLifeMs: 2050,
      goodScore: 12,
      junkPenaltyScore: -10,
      missLimit: 12,
      bossHP: 10,
    };
    if(diff==='hard') return {
      spawnPerSec: 1.65,
      junkRate: 0.32,
      starRate: 0.06,
      shieldRate: 0.045,
      diamondRate: 0.012,
      goodLifeMs: 1500,
      goodScore: 14,
      junkPenaltyScore: -14,
      missLimit: 9,
      bossHP: 14,
    };
    return {
      spawnPerSec: 1.35,
      junkRate: 0.27,
      starRate: 0.07,
      shieldRate: 0.055,
      diamondRate: 0.014,
      goodLifeMs: 1820,
      goodScore: 13,
      junkPenaltyScore: -12,
      missLimit: 10,
      bossHP: 12,
    };
  })();

  const adaptiveOn = (runMode !== 'research');

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

    bossBar: byId('bossBar'),
    bossFill: byId('bossFill'),
    bossHint: byId('bossHint'),

    progressFill: byId('gjProgressFill'),

    endOverlay: byId('endOverlay'),
    endTitle: byId('endTitle'),
    endSub: byId('endSub'),
    endGrade: byId('endGrade'),
    endScore: byId('endScore'),
    endMiss: byId('endMiss'),
    endTime: byId('endTime'),
  };

  // ---------------- FX (Particles optional + DOM fallback) ----------------
  function fxParticles(){
    return ROOT.Particles || (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || null;
  }

  function ensureFxLayer(){
    let fx = DOC.getElementById('gj-fx');
    if(fx) return fx;

    fx = DOC.createElement('div');
    fx.id = 'gj-fx';
    fx.style.position = 'absolute';
    fx.style.left = '0';
    fx.style.top  = '0';
    fx.style.right= '0';
    fx.style.bottom='0';
    fx.style.pointerEvents = 'none';
    fx.style.zIndex = '80'; // above targets (targets often z < hud)
    fx.style.overflow = 'visible';

    // make sure container is positioned
    const cs = getComputedStyle(LAYER_L);
    if(cs.position === 'static'){
      LAYER_L.style.position = 'relative';
    }

    LAYER_L.appendChild(fx);
    return fx;
  }

  function fxText(clientX, clientY, txt, size=18){
    // 1) try particles module
    try{
      const P = fxParticles();
      if(P && typeof P.popText === 'function'){
        P.popText(clientX, clientY, txt);
        return;
      }
    }catch(_){}

    // 2) DOM fallback (guaranteed)
    try{
      const fx = ensureFxLayer();
      const p = toLayerLocal(clientX, clientY);

      const el = DOC.createElement('div');
      el.textContent = String(txt);
      el.style.position = 'absolute';
      el.style.left = `${Math.round(p.x)}px`;
      el.style.top  = `${Math.round(p.y)}px`;
      el.style.transform = 'translate(-50%,-50%)';
      el.style.fontWeight = '1000';
      el.style.fontSize = `${size}px`;
      el.style.letterSpacing = '.2px';
      el.style.textShadow = '0 2px 10px rgba(0,0,0,.55)';
      el.style.opacity = '0';
      el.style.transition = 'transform .36s ease, opacity .36s ease';
      fx.appendChild(el);

      requestAnimationFrame(()=>{
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%,-110%)';
      });

      setTimeout(()=>{ try{ el.style.opacity='0'; }catch(_){ } }, 240);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
    }catch(_){}
  }

  function fxBurst(clientX, clientY, n=10){
    // 1) try particles module
    try{
      const P = fxParticles();
      if(P && typeof P.burst === 'function'){
        P.burst(clientX, clientY, n);
        return;
      }
      if(P && typeof P.popBurst === 'function'){
        P.popBurst(clientX, clientY, n);
        return;
      }
    }catch(_){}

    // 2) DOM fallback
    try{
      const fx = ensureFxLayer();
      const p = toLayerLocal(clientX, clientY);

      for(let i=0;i<n;i++){
        const dot = DOC.createElement('div');
        dot.style.position='absolute';
        dot.style.left = `${Math.round(p.x)}px`;
        dot.style.top  = `${Math.round(p.y)}px`;
        dot.style.width='6px';
        dot.style.height='6px';
        dot.style.borderRadius='999px';
        dot.style.background='rgba(255,255,255,.75)';
        dot.style.boxShadow='0 4px 14px rgba(0,0,0,.35)';
        dot.style.transform='translate(-50%,-50%)';
        dot.style.opacity='1';
        dot.style.transition='transform .42s ease, opacity .42s ease';

        fx.appendChild(dot);

        const ang = rng() * Math.PI * 2;
        const sp  = 18 + rng()*34;
        const dx = Math.cos(ang) * sp;
        const dy = Math.sin(ang) * sp;

        requestAnimationFrame(()=>{
          dot.style.transform = `translate(${dx-3}px,${dy-3}px)`;
          dot.style.opacity = '0';
        });

        setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, 520);
      }
    }catch(_){}
  }

  function bodyPulse(cls, ms=160){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms);
    }catch(_){}
  }

  // ---------------- state ----------------
  const state = {
    started: false,
    ended: false,

    timeLeftSec: durationPlannedSec,

    score: 0,
    combo: 0,
    comboMax: 0,
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

    rtGood: [],

    fever: 0,
    shield: 0,

    // quests
    goalObj: null,
    miniObj: null,
    lastQuestEmitAt: 0,

    // spawn
    spawnAcc: 0,
    targets: new Map(),

    // modes
    stormOn: false,
    bossOn: false,
    rageOn: false,

    boss: {
      active:false,
      hp: DIFF.bossHP,
      hpMax: DIFF.bossHP,
      phase: 1,
      phaseEverySec: 6,
      phaseTimer: 0,
      teleOn: false,
      teleTimer: 0,
      teleDur: 0.75,
      stompCooldown: 0,
      rageBoost: 0,
    },

    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  function setModeClass(){
    const b = DOC.body;
    b.classList.toggle('storm', !!state.stormOn);
    b.classList.toggle('boss',  !!state.bossOn);
    b.classList.toggle('rage',  !!state.rageOn);
  }

  // ---------------- HUD setters ----------------
  function setScore(v){
    state.score = Math.max(0, Math.floor(v));
    if(HUD.score) HUD.score.textContent = String(state.score);
    emit('hha:score', { score: state.score });
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
    if(!HUD.lowTimeOverlay) return;
    if(t <= 5){
      HUD.lowTimeOverlay.setAttribute('aria-hidden','false');
      if(HUD.lowTimeNum) HUD.lowTimeNum.textContent = String(Math.ceil(t));
      DOC.body.classList.add('gj-tick');
      setTimeout(()=>DOC.body.classList.remove('gj-tick'), 120);
    }else{
      HUD.lowTimeOverlay.setAttribute('aria-hidden','true');
    }
  }

  // ---------------- QUEST ----------------
  function setQuestUI(goalObj, miniObj, forceEmit=false){
    state.goalObj = goalObj || state.goalObj;
    state.miniObj = miniObj || state.miniObj;

    const g = state.goalObj;
    const m = state.miniObj;

    if(HUD.goal) HUD.goal.textContent = g?.title ?? '—';
    if(HUD.goalCur) HUD.goalCur.textContent = String(g?.cur ?? 0);
    if(HUD.goalTarget) HUD.goalTarget.textContent = String(g?.target ?? 0);
    if(HUD.goalDesc) HUD.goalDesc.textContent = g?.desc ?? '—';

    if(HUD.mini) HUD.mini.textContent = m?.title ?? '—';
    if(HUD.miniTimer) HUD.miniTimer.textContent = (m?.timerText ?? '—');

    const t = now();
    const canEmit = forceEmit || (t - (state.lastQuestEmitAt||0) >= 220);
    if(canEmit){
      state.lastQuestEmitAt = t;
      emit('quest:update', { goal: g || null, mini: m || null });
    }
  }

  function recomputeQuest(){
    const goal = {
      title: 'Survive',
      cur: state.miss,
      target: DIFF.missLimit,
      desc: `ห้าม MISS ถึง ${DIFF.missLimit} (MISS ≥4 จะมี BOSS / ≥5 จะ RAGE)`,
    };

    const tLeft = Math.ceil(state.timeLeftSec);
    const tPassed = Math.max(0, Math.floor(durationPlannedSec - state.timeLeftSec));
    const toStorm = Math.max(0, Math.ceil(state.timeLeftSec - 30));

    let title = 'BOSS / STORM';
    let timerText = `⏱ ${tPassed}/${durationPlannedSec}s`;

    if(!state.stormOn){
      title = 'STORM incoming';
      timerText = `⚡อีก ${toStorm}s`;
    }else{
      title = state.boss.active ? (state.rageOn ? 'RAGE Boss' : 'Boss Battle') : 'STORM';
      timerText = `⏱ เหลือ ${tLeft}s`;
    }

    const mini = { title, cur: tPassed, target: durationPlannedSec, timerText };
    setQuestUI(goal, mini, false);
  }

  function updateBossUI(){
    if(!HUD.bossBar || !HUD.bossFill) return;

    if(state.boss.active){
      HUD.bossBar.setAttribute('aria-hidden','false');
      const pct = state.boss.hpMax ? clamp(state.boss.hp / state.boss.hpMax, 0, 1) : 0;
      HUD.bossFill.style.width = `${Math.round(pct * 100)}%`;

      if(HUD.bossHint){
        HUD.bossHint.textContent =
          `HP ${state.boss.hp}/${state.boss.hpMax} • Phase ${state.boss.phase}` +
          (state.rageOn ? ' • RAGE' : '') +
          (state.stormOn ? ' • STORM' : '') +
          (state.boss.teleOn ? ' • ⚠️ INCOMING' : '');
      }
    }else{
      HUD.bossBar.setAttribute('aria-hidden','true');
      HUD.bossFill.style.width = `0%`;
      if(HUD.bossHint) HUD.bossHint.textContent = '';
    }
  }

  function updateProgressUI(){
    if(!HUD.progressFill) return;
    const pct = clamp(1 - (state.timeLeftSec / Math.max(1, durationPlannedSec)), 0, 1);
    HUD.progressFill.style.width = `${Math.round(pct * 100)}%`;
  }

  // ---------------- safe spawn rect (PATCH: use layer rect) ----------------
  function readRootPxVar(name, fallbackPx){
    try{
      const cs = getComputedStyle(DOC.documentElement);
      const v = String(cs.getPropertyValue(name) || '').trim().replace('px','');
      const n = Number(v);
      return Number.isFinite(n) ? n : fallbackPx;
    }catch(_){ return fallbackPx; }
  }

  function getSafeRect(){
    const r = layerRect();
    const W = Math.floor(r.width);
    const H = Math.floor(r.height);

    const sat = readRootPxVar('--sat', 0);
    const topSafe = readRootPxVar('--gj-top-safe', 140 + sat);
    const botSafe = readRootPxVar('--gj-bottom-safe', 140);

    const xMin = Math.floor(W * 0.10);
    const xMax = Math.floor(W * 0.90);
    const yMin = Math.floor(Math.min(H-80, Math.max(20, topSafe)));
    const yMax = Math.floor(Math.max(yMin + 120, H - botSafe));

    return { W,H, xMin,xMax, yMin,yMax, left:r.left, top:r.top };
  }

  // ---------------- targets ----------------
  let targetSeq = 0;

  const EMOJI = {
    good: ['🥦','🍎','🥕','🍌','🍇','🥬','🍊','🍉'],
    junk: ['🍟','🍔','🍭','🍩','🧁','🥤','🍪','🍫'],
    star: ['⭐'],
    shield: ['🛡️'],
    diamond: ['💎'],
    bomb: ['💣'],
    skull: ['💀'],
  };

  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  function makeTargetKind(){
    const junkW   = DIFF.junkRate;
    const starW   = DIFF.starRate;
    const shieldW = DIFF.shieldRate;
    const diamondW= DIFF.diamondRate;

    const bossHazW = state.boss.active ? (state.rageOn ? 0.11 : 0.08) : 0;
    const bossBombW= state.boss.active ? (state.rageOn ? 0.06 : 0.045) : 0;

    const goodW = Math.max(0.01, 1 - (junkW+starW+shieldW+diamondW+bossHazW+bossBombW));

    return pickWeighted(rng, [
      {k:'good', w:goodW},
      {k:'junk', w:junkW},
      {k:'star', w:starW},
      {k:'shield', w:shieldW},
      {k:'diamond', w:diamondW},
      {k:'skull', w:bossHazW},
      {k:'bomb',  w:bossBombW},
    ]);
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

    const baseLife =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='diamond') ? Math.round(DIFF.goodLifeMs * 1.25) :
      (kind==='skull') ? Math.round(DIFF.goodLifeMs * 0.95) :
      Math.round(DIFF.goodLifeMs * 0.85);

    const stormMul = state.stormOn ? (state.rageOn ? 0.80 : 0.86) : 1;
    const lifeMs = Math.max(520, Math.round(baseLife * stormMul));

    const baseSize =
      (kind==='good') ? 54 :
      (kind==='junk') ? 56 :
      (kind==='skull')? 58 :
      (kind==='bomb') ? 58 : 50;

    const size = clamp(baseSize + randIn(rng, -4, 12), 44, 78);

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
    if(LAYER_R && isCVR){
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
    }

    const bornAt = now();

    // store absolute (client) positions
    const ax = rect.left + x;
    const ay = rect.top  + y;

    const tObj = { id, kind, bornAt, lifeMs, x, y, ax, ay, elL, elR, hit:false };

    function onPointer(ev){
      ev.preventDefault();
      onTargetHit(tObj, { via:'tap', clientX: ev.clientX, clientY: ev.clientY });
    }

    elL.addEventListener('pointerdown', onPointer, { passive:false });
    if(elR){
      elR.addEventListener('pointerdown', onPointer, { passive:false });
    }

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

  // ---------------- scoring / boss damage ----------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){ state.combo = 0; }

  function bossTakeDamage(dmg, px, py){
    if(!state.boss.active) return;
    const b = state.boss;
    b.hp = Math.max(0, b.hp - Math.max(1, dmg|0));

    fxText(px,py,`-HP ${dmg}`, 18);
    fxBurst(px,py,8);

    emit('hha:judge', { label:`BOSS HIT! (${b.hp}/${b.hpMax})` });
    updateBossUI();

    if(b.hp <= 0){
      state.boss.active = false;
      state.bossOn = false;
      state.rageOn = false;
      b.phase = 1;
      b.phaseTimer = 0;
      b.stompCooldown = 0;
      b.rageBoost = 0;
      b.teleOn = false;
      b.teleTimer = 0;

      setModeClass();

      const bonus = 120;
      setScore(state.score + bonus);
      addFever(-20);
      addShield(2);

      emit('hha:celebrate', { kind:'boss_clear' });
      emit('hha:judge', { label:'BOSS DOWN!' });

      bodyPulse('gj-boss-down', 260);

      updateBossUI();
      recomputeQuest();
    }
  }

  // ---------------- hit logic ----------------
  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    tObj.hit = true;

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

    // PATCH: prefer true center for fx/judge placement
    const c = centerOfTarget(tObj);
    const px = meta.clientX ?? c.x;
    const py = meta.clientY ?? c.y;

    if(kind==='good'){
      state.nHitGood++;
      addCombo();
      addFever(3.2);

      const phaseMul = state.boss.active ? (state.boss.phase===2 ? 1.35 : 1.15) : 1.0;
      const stormMul = state.stormOn ? (state.rageOn ? 1.22 : 1.12) : 1.0;

      const delta = Math.round((DIFF.goodScore + Math.min(7, Math.floor(state.combo/5))) * phaseMul * stormMul);
      setScore(state.score + delta);

      if(state.boss.active){
        const dmg = (state.boss.phase===2) ? 2 : 1;
        bossTakeDamage(dmg, px, py);
      }

      state.rtGood.push(rtMs);

      fxText(px,py,`+${delta}`, 20);
      fxBurst(px,py,10);

      emit('hha:judge', { label:'GOOD!' });

    } else if(kind==='junk'){
      // ✅ PATCH: JUNK (BLOCK + HIT) เอฟเฟกต์ชัด & ต่างกัน
      const blocked = useShield();
      resetCombo();

      if(blocked){
        state.nHitJunkGuard++;
        addFever(-6);

        fxText(px, py, '🛡️ BLOCK', 18);
        fxBurst(px, py, 8);
        bodyPulse('gj-block', 140);

        emit('hha:judge', { label:'BLOCK!' });
      }else{
        state.nHitJunk++;
        addFever(10);

        setMiss(state.miss + 1);
        const pen = (DIFF.junkPenaltyScore||-10);
        setScore(state.score + pen);

        fxText(px, py, `${pen}`, 20);   // เช่น -12
        fxBurst(px, py, 12);
        bodyPulse('gj-junk-hit', 240);

        emit('hha:judge', { label:'OOPS!' });
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));

      fxText(px,py,'MISS -1', 18);
      fxBurst(px,py,8);

      emit('hha:judge', { label:'STAR!' });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);

      fxText(px,py,'SHIELD +1', 18);
      fxBurst(px,py,9);

      emit('hha:judge', { label:'SHIELD!' });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);

      fxText(px,py,`+${bonus}`, 20);
      fxBurst(px,py,14);

      emit('hha:judge', { label:'DIAMOND!' });

    } else if(kind==='skull'){
      resetCombo();
      addFever(14);
      setMiss(state.miss + 1);
      setScore(state.score - 8);

      fxText(px,py,'💀', 22);
      fxBurst(px,py,10);

      emit('hha:judge', { label:'SKULL!' });
      bodyPulse('gj-skull-hit', 240);

      if(state.boss.active && state.boss.phase===2){
        state.boss.stompCooldown = Math.max(state.boss.stompCooldown, 0.9);
      }

    } else if(kind==='bomb'){
      const blocked = useShield();
      resetCombo();

      if(blocked){
        addFever(-8);

        fxText(px,py,'DEFUSE', 18);
        fxBurst(px,py,10);

        emit('hha:judge', { label:'DEFUSED!' });
      }else{
        addFever(20);
        setMiss(state.miss + 2);
        setScore(state.score - 22);

        fxText(px,py,'BOOM', 22);
        fxBurst(px,py,16);

        emit('hha:judge', { label:'BOOM!' });
        bodyPulse('gj-bomb', 320);

        if(state.boss.active) state.boss.rageBoost = Math.min(1.0, state.boss.rageBoost + 0.25);
      }
    }

    removeTarget(tObj);

    updateModeThresholds();
    updateBossUI();
    recomputeQuest();

    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // ---------------- VR/cVR shoot center (PATCH: real centers) ----------------
  function shootCrosshair(ev){
    if(state.ended) return;

    const cx = Math.floor(ev?.detail?.x ?? (DOC.documentElement.clientWidth/2));
    const cy = Math.floor(ev?.detail?.y ?? (DOC.documentElement.clientHeight/2));

    const R = (isCVR || isVR) ? 92 : 76;

    let best = null;
    let bestD = 1e9;

    for(const t of state.targets.values()){
      if(t.hit) continue;
      const c = centerOfTarget(t);
      const dx = (c.x - cx);
      const dy = (c.y - cy);
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
      fxText(cx,cy,'…', 16);
      fxBurst(cx,cy,5);
    }
  }
  ROOT.addEventListener('hha:shoot', shootCrosshair, { passive:true });

  // ---------------- expiry ----------------
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
          setMiss(state.miss + 1);

          const c = centerOfTarget(tObj);
          fxText(c.x,c.y,'MISS', 18);
          fxBurst(c.x,c.y,8);

          emit('hha:judge', { label:'MISS!' });
          bodyPulse('gj-good-expire', 160);

          updateModeThresholds();
          updateBossUI();
          recomputeQuest();

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

  // ---------------- mode thresholds ----------------
  function updateModeThresholds(){
    const wantStorm = (state.timeLeftSec <= 30);
    if(wantStorm && !state.stormOn){
      state.stormOn = true;
      emit('hha:judge', { label:'STORM!' });
      fxText(DOC.documentElement.clientWidth/2, 80, '⚡ STORM', 18);
      fxBurst(DOC.documentElement.clientWidth/2, 80, 8);
      bodyPulse('gj-storm', 240);
    }

    const wantBoss = (state.miss >= 4);
    if(wantBoss && !state.bossOn){
      state.bossOn = true;
      state.boss.active = true;

      state.boss.hpMax = DIFF.bossHP;
      state.boss.hp = DIFF.bossHP;

      state.boss.phase = 1;
      state.boss.phaseTimer = 0;

      state.boss.stompCooldown = 0;
      state.boss.rageBoost = 0;

      state.boss.teleOn = true;
      state.boss.teleTimer = 0;

      emit('hha:judge', { label:`BOSS! HP ${state.boss.hp}/${state.boss.hpMax}` });
      fxText(DOC.documentElement.clientWidth/2, 110, '👹 BOSS', 20);
      fxBurst(DOC.documentElement.clientWidth/2, 110, 10);
      bodyPulse('gj-boss', 280);

      for(let i=0;i<3;i++) spawnOne();
    }

    const wantRage = (state.miss >= 5);
    if(wantRage && !state.rageOn){
      state.rageOn = true;
      emit('hha:judge', { label:'RAGE!!' });
      fxText(DOC.documentElement.clientWidth/2, 140, '🔥 RAGE', 22);
      fxBurst(DOC.documentElement.clientWidth/2, 140, 12);
      bodyPulse('gj-rage', 320);
    }

    setModeClass();
  }

  // ---------------- boss tick ----------------
  function bossTelegraphStart(label){
    state.boss.teleOn = true;
    state.boss.teleTimer = 0;
    emit('hha:judge', { label: `⚠️ ${label}` });
    fxText(DOC.documentElement.clientWidth/2, 168, '⚠️ INCOMING', 18);
    fxBurst(DOC.documentElement.clientWidth/2, 168, 8);
    bodyPulse('gj-tele', 180);
    updateBossUI();
  }

  function bossDoStomp(){
    let popped = 0;
    for(const tObj of state.targets.values()){
      if(popped >= 2) break;
      if(!tObj.hit && tObj.kind === 'good'){
        tObj.hit = true;
        state.nExpireGood++;
        setMiss(state.miss + 1);

        const c = centerOfTarget(tObj);
        fxText(c.x,c.y,'STOMP', 18);
        fxBurst(c.x,c.y,10);

        removeTarget(tObj);
        popped++;
      }
    }
    emit('hha:judge', { label:'STOMP!' });
    bodyPulse('gj-stomp', 240);
    updateModeThresholds();
    updateBossUI();
    recomputeQuest();
  }

  function bossDoBurst(){
    const n = state.rageOn ? 4 : 3;
    for(let i=0;i<n;i++) spawnOne();
    emit('hha:judge', { label:'BURST!' });
    fxText(DOC.documentElement.clientWidth/2, 190, '💥 BURST', 18);
    fxBurst(DOC.documentElement.clientWidth/2, 190, 12);
    bodyPulse('gj-burst', 240);
  }

  function tickBoss(dt){
    if(!state.boss.active) return;
    const b = state.boss;

    b.phaseTimer += dt;
    if(b.phaseTimer >= b.phaseEverySec){
      b.phaseTimer = 0;
      b.phase = (b.phase === 1) ? 2 : 1;
      emit('hha:judge', { label: (b.phase===2 ? 'PHASE 2!' : 'PHASE 1') });
      fxText(DOC.documentElement.clientWidth/2, 165, b.phase===2 ? '⚔️ PHASE 2' : '🛡️ PHASE 1', 18);
      fxBurst(DOC.documentElement.clientWidth/2, 165, 10);

      if(b.phase===2){
        for(let i=0;i<2;i++) spawnOne();
      }
      updateBossUI();
      bossTelegraphStart(b.phase===2 ? 'Burst' : 'Stomp');
    }

    if(b.teleOn){
      b.teleTimer += dt;
      if(b.teleTimer >= b.teleDur){
        b.teleOn = false;
        b.teleTimer = 0;

        if(b.phase===2) bossDoBurst();
        else bossDoStomp();

        updateBossUI();
      }
    }

    if(b.stompCooldown > 0){
      b.stompCooldown = Math.max(0, b.stompCooldown - dt);
      if(b.stompCooldown <= 0){
        bossTelegraphStart('Stomp');
        b.phase = 1;
        b.phaseTimer = Math.min(b.phaseTimer, b.phaseEverySec - 0.2);
      }
    }
  }

  // ---------------- spawn rate ----------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / Math.max(1, DIFF.missLimit)), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);
    }

    if(state.stormOn) r *= (state.rageOn ? 1.35 : 1.22);

    if(state.boss.active){
      r *= (state.boss.phase===2 ? 1.25 : 1.12);
      r *= (1 + 0.18 * clamp(state.boss.rageBoost, 0, 1));
    }

    if(state.timeLeftSec <= 10) r *= 1.12;
    return clamp(r, 0.85, 2.25);
  }

  // ---------------- grading + end ----------------
  function avg(arr){
    if(!arr.length) return null;
    let s=0; for(const v of arr) s += v;
    return Math.round(s/arr.length);
  }
  function median(arr){
    if(!arr.length) return null;
    const a = arr.slice().sort((x,y)=>x-y);
    const mid = Math.floor(a.length/2);
    return (a.length%2) ? a[mid] : Math.round((a[mid-1]+a[mid]) / 2);
  }

  function gradeFrom(score, miss){
    if(miss <= 2 && score >= 560) return 'S';
    if(miss <= 4 && score >= 480) return 'A';
    if(miss <= 6 && score >= 400) return 'B';
    if(miss <= 8 && score >= 320) return 'C';
    return 'D';
  }

  function showEndOverlay(detail){
    try{
      if(!HUD.endOverlay) return;
      HUD.endTitle && (HUD.endTitle.textContent = (detail?.reason==='miss-limit') ? 'Game Over' : 'Completed');
      HUD.endSub && (HUD.endSub.textContent = `reason=${detail?.reason||'-'} | mode=${detail?.runMode||runMode} | view=${detail?.device||deviceLabel(view)}`);
      HUD.endGrade && (HUD.endGrade.textContent = detail?.grade || '—');
      HUD.endScore && (HUD.endScore.textContent = String(detail?.scoreFinal ?? 0));
      HUD.endMiss && (HUD.endMiss.textContent  = String(detail?.misses ?? 0));
      HUD.endTime && (HUD.endTime.textContent  = String(Math.round(Number(detail?.durationPlayedSec||0))));
      HUD.endOverlay.setAttribute('aria-hidden','false');
    }catch(_){}
  }

  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

    const scoreFinal = state.score;
    const comboMax = state.comboMax;
    const misses = state.miss;
    const avgRtGoodMs = avg(state.rtGood);
    const medianRtGoodMs = median(state.rtGood);
    const grade = gradeFrom(scoreFinal, misses);

    setGradeText(grade);
    state.endTimeIso = new Date().toISOString();

    const durationPlayedSec = Math.round(durationPlannedSec - state.timeLeftSec);

    const summary = {
      projectTag: PROJECT_TAG,
      gameVersion: GAME_VERSION,
      device: deviceLabel(view),
      runMode,
      diff,
      seed,
      reason,
      durationPlannedSec,
      durationPlayedSec,
      scoreFinal,
      comboMax,
      misses,
      avgRtGoodMs,
      medianRtGoodMs,
      bossDefeated: (!state.boss.active && state.bossOn),
      stormOn: state.stormOn,
      rageOn: state.rageOn,
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
      durationPlayedSec,
      scoreFinal,
      comboMax,
      misses,
      avgRtGoodMs,
      medianRtGoodMs,
      reason,
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,
      grade,
    });

    showEndOverlay({ ...summary });
    emit('hha:celebrate', { kind:'end', grade });
  }

  // ---------------- loop ----------------
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

    updateModeThresholds();
    updateLowTimeFx();

    tickBoss(dt);

    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();
      if(state.rageOn && rng() < 0.18) spawnOne();
      if(state.stormOn && state.timeLeftSec <= 8 && rng() < 0.14) spawnOne();
    }

    expireTargets();

    updateProgressUI();
    updateBossUI();
    recomputeQuest();

    if(state.timeLeftSec <= 0){
      endGame('timeup');
      return;
    }

    requestAnimationFrame(tick);
  }

  // ---------------- init/start ----------------
  function initHud(){
    setScore(0);
    setMiss(0);
    setTimeLeft(durationPlannedSec);
    setGradeText('—');

    addFever(0);
    renderShield();

    updateProgressUI();
    updateBossUI();

    emit('hha:coach', {
      msg: 'โหดขึ้นแล้ว! ⚡เหลือ 30s = STORM | MISS ≥4 = BOSS | MISS ≥5 = RAGE (ระวัง 💣/💀) — มี ⚠️ telegraph ให้หลบ/สวน',
      kind: 'tip'
    });

    recomputeQuest();
    setQuestUI(state.goalObj, state.miniObj, true);
  }

  function start(){
    if(state.started) return;
    state.started = true;

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

    requestAnimationFrame(tick);
  }

  start();

  ROOT.__GJ_STATE__ = state;
}