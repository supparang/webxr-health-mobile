// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (BOSS++ + STORM + RAGE + TELEGRAPH)
// FULL v20260220-fxHARDEN
// ✅ FIX: coordinate space unified to #gj-layer rect (shoot/tap/FX)
// ✅ FIX: crosshair hit uses real DOMRect centers (robust on short screens/HUD)
// ✅ FIX: cVR right-eye clone also gets pointer listener (optional)
// ✅ FX: tuned per target type (GOOD/STAR/SHIELD/DIAMOND/JUNK block vs hit/💣/💀)
// ✅ Hardened FX: ensure #gj-fx exists (recreate if layer re-rendered/cleared) every hit/shoot

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

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-02-20_FXHARDEN';
  const PROJECT_TAG = 'GoodJunkVR';

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

  // ---------------- FX HARDENED ----------------
  function ensureFxLayer(){
    try{
      let fx = DOC.getElementById('gj-fx');
      const needRecreate = (!fx || !fx.isConnected || (fx.parentElement !== LAYER_L));
      if(needRecreate){
        try{ fx && fx.remove(); }catch(_){}
        fx = DOC.createElement('div');
        fx.id = 'gj-fx';
        fx.setAttribute('aria-hidden','true');
        fx.style.position = 'absolute';
        fx.style.left = '0';
        fx.style.top = '0';
        fx.style.right = '0';
        fx.style.bottom = '0';
        fx.style.pointerEvents = 'none';
        fx.style.zIndex = '140';
        if(!LAYER_L.style.position) LAYER_L.style.position = 'relative';
        LAYER_L.appendChild(fx);
      }
      return fx;
    }catch(_){
      return null;
    }
  }

  function addFxEl(el, ttlMs){
    const fx = ensureFxLayer();
    if(!fx || !el) return;
    try{
      fx.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, Math.max(60, ttlMs|0));
    }catch(_){}
  }

  function screenPulse(cls, ms=160){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms);
    }catch(_){}
  }

  function fxText(x,y,txt, cls=''){
    try{
      ensureFxLayer();
      const r = layerRect();
      const lx = x - r.left;
      const ly = y - r.top;

      const el = DOC.createElement('div');
      el.className = (`gj-fx-text ${cls}`).trim();
      el.textContent = String(txt);

      el.style.position = 'absolute';
      el.style.left = `${Math.round(lx)}px`;
      el.style.top  = `${Math.round(ly)}px`;
      el.style.transform = 'translate(-50%,-70%)';
      el.style.fontWeight = '1000';
      el.style.letterSpacing = '.2px';
      el.style.textShadow = '0 8px 22px rgba(0,0,0,.55)';
      el.style.willChange = 'transform, opacity, filter';
      el.style.opacity = '0';

      requestAnimationFrame(()=>{
        el.style.transition = 'transform 520ms ease, opacity 140ms ease';
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%,-115%) scale(1.02)';
      });
      setTimeout(()=>{
        el.style.transition = 'transform 340ms ease, opacity 260ms ease';
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-160%) scale(.96)';
      }, 320);

      addFxEl(el, 760);
    }catch(_){}
  }

  function fxDotBurst(x,y, cfg={}){
    try{
      ensureFxLayer();
      const r = layerRect();
      const lx = x - r.left;
      const ly = y - r.top;

      const n = cfg.n ?? 10;
      const ttl = cfg.ttl ?? 520;
      const spread = cfg.spread ?? 42;
      const scale0 = cfg.scale0 ?? 1.0;
      const scale1 = cfg.scale1 ?? 0.2;

      for(let i=0;i<n;i++){
        const a = (Math.PI*2) * (i/n) + randIn(rng, -0.25, 0.25);
        const d = randIn(rng, spread*0.55, spread*1.08);
        const dx = Math.cos(a)*d;
        const dy = Math.sin(a)*d;

        const dot = DOC.createElement('div');
        dot.className = (`gj-fx-dot ${cfg.cls||''}`).trim();

        dot.style.position='absolute';
        dot.style.left = `${Math.round(lx)}px`;
        dot.style.top  = `${Math.round(ly)}px`;
        dot.style.width = `${cfg.size ?? 6}px`;
        dot.style.height= `${cfg.size ?? 6}px`;
        dot.style.borderRadius='999px';
        dot.style.background = cfg.bg ?? 'rgba(255,255,255,.85)';
        dot.style.boxShadow = cfg.shadow ?? '0 10px 28px rgba(0,0,0,.35)';
        dot.style.opacity='0';
        dot.style.transform = `translate(-50%,-50%) scale(${scale0})`;
        dot.style.willChange='transform, opacity, filter';

        requestAnimationFrame(()=>{
          dot.style.transition = `transform ${ttl}ms cubic-bezier(.16,.9,.22,1), opacity 90ms ease`;
          dot.style.opacity = '1';
          dot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale1})`;
        });

        setTimeout(()=>{ try{ dot.style.opacity='0'; }catch(_){ } }, Math.max(110, ttl-120));
        addFxEl(dot, ttl+220);
      }
    }catch(_){}
  }

  function fxRing(x,y, cfg={}){
    try{
      ensureFxLayer();
      const r = layerRect();
      const lx = x - r.left;
      const ly = y - r.top;

      const ring = DOC.createElement('div');
      ring.className = (`gj-fx-ring ${cfg.cls||''}`).trim();
      ring.style.position='absolute';
      ring.style.left = `${Math.round(lx)}px`;
      ring.style.top  = `${Math.round(ly)}px`;
      ring.style.transform='translate(-50%,-50%) scale(.35)';
      ring.style.width = `${cfg.size ?? 42}px`;
      ring.style.height= `${cfg.size ?? 42}px`;
      ring.style.borderRadius='999px';
      ring.style.border = cfg.border ?? '2px solid rgba(255,255,255,.55)';
      ring.style.boxShadow = cfg.shadow ?? '0 14px 40px rgba(0,0,0,.35)';
      ring.style.opacity='0';
      ring.style.willChange='transform, opacity, filter';

      const ttl = cfg.ttl ?? 520;
      requestAnimationFrame(()=>{
        ring.style.transition = `transform ${ttl}ms cubic-bezier(.12,.9,.22,1), opacity 120ms ease`;
        ring.style.opacity='1';
        ring.style.transform='translate(-50%,-50%) scale(1.08)';
      });
      setTimeout(()=>{
        ring.style.transition = 'opacity 240ms ease';
        ring.style.opacity='0';
      }, Math.max(160, ttl-160));

      addFxEl(ring, ttl+260);
    }catch(_){}
  }

  function playFx(kind, x, y){
    ensureFxLayer();

    if(kind === 'good'){
      fxDotBurst(x,y,{ n:10, spread:40, ttl:520, size:6, bg:'rgba(34,211,238,.95)', shadow:'0 14px 34px rgba(34,211,238,.18)' });
      fxRing(x,y,{ size:46, ttl:520, border:'2px solid rgba(34,211,238,.55)', shadow:'0 16px 42px rgba(34,211,238,.12)' });
      return;
    }

    if(kind === 'junk_block'){
      fxRing(x,y,{ size:56, ttl:360, border:'2px solid rgba(56,189,248,.62)', shadow:'0 14px 38px rgba(56,189,248,.18)', cls:'soft' });
      fxDotBurst(x,y,{ n:8, spread:26, ttl:320, size:5, bg:'rgba(56,189,248,.92)', shadow:'0 12px 30px rgba(56,189,248,.12)' });
      screenPulse('gj-block', 120);
      return;
    }

    if(kind === 'junk_hit'){
      fxRing(x,y,{ size:64, ttl:520, border:'2px solid rgba(248,113,113,.70)', shadow:'0 18px 52px rgba(248,113,113,.22)' });
      fxDotBurst(x,y,{ n:14, spread:48, ttl:560, size:6, bg:'rgba(248,113,113,.95)', shadow:'0 18px 52px rgba(248,113,113,.18)' });
      fxDotBurst(x,y,{ n:10, spread:34, ttl:520, size:4, bg:'rgba(255,255,255,.75)', shadow:'0 18px 52px rgba(0,0,0,.25)' });
      screenPulse('gj-junk-hit', 220);
      screenPulse('gj-hurt', 180);
      return;
    }

    if(kind === 'star'){
      fxRing(x,y,{ size:54, ttl:520, border:'2px solid rgba(250,204,21,.62)', shadow:'0 18px 52px rgba(250,204,21,.16)' });
      fxDotBurst(x,y,{ n:12, spread:44, ttl:560, size:5, bg:'rgba(250,204,21,.92)', shadow:'0 18px 52px rgba(250,204,21,.12)' });
      screenPulse('gj-star', 160);
      return;
    }

    if(kind === 'shield'){
      fxRing(x,y,{ size:58, ttl:520, border:'2px solid rgba(52,211,153,.62)', shadow:'0 18px 52px rgba(52,211,153,.14)' });
      fxDotBurst(x,y,{ n:11, spread:40, ttl:540, size:5, bg:'rgba(52,211,153,.92)', shadow:'0 18px 52px rgba(52,211,153,.12)' });
      screenPulse('gj-shield', 160);
      return;
    }

    if(kind === 'diamond'){
      fxRing(x,y,{ size:62, ttl:560, border:'2px solid rgba(167,139,250,.70)', shadow:'0 18px 52px rgba(167,139,250,.18)' });
      fxDotBurst(x,y,{ n:14, spread:50, ttl:620, size:5, bg:'rgba(167,139,250,.92)', shadow:'0 18px 52px rgba(167,139,250,.14)' });
      fxDotBurst(x,y,{ n:8, spread:28, ttl:520, size:4, bg:'rgba(255,255,255,.72)', shadow:'0 18px 52px rgba(0,0,0,.22)' });
      screenPulse('gj-diamond', 170);
      return;
    }

    if(kind === 'skull'){
      fxRing(x,y,{ size:70, ttl:580, border:'2px solid rgba(148,163,184,.58)', shadow:'0 20px 60px rgba(0,0,0,.35)' });
      fxDotBurst(x,y,{ n:16, spread:54, ttl:620, size:6, bg:'rgba(148,163,184,.92)', shadow:'0 20px 60px rgba(148,163,184,.10)' });
      fxDotBurst(x,y,{ n:10, spread:34, ttl:520, size:4, bg:'rgba(255,255,255,.62)', shadow:'0 20px 60px rgba(0,0,0,.28)' });
      screenPulse('gj-skull-hit', 240);
      screenPulse('gj-hurt', 200);
      return;
    }

    if(kind === 'bomb'){
      fxRing(x,y,{ size:78, ttl:620, border:'2px solid rgba(251,146,60,.72)', shadow:'0 22px 70px rgba(251,146,60,.20)' });
      fxDotBurst(x,y,{ n:18, spread:62, ttl:700, size:6, bg:'rgba(251,146,60,.95)', shadow:'0 22px 70px rgba(251,146,60,.16)' });
      fxDotBurst(x,y,{ n:12, spread:40, ttl:620, size:4, bg:'rgba(255,255,255,.70)', shadow:'0 22px 70px rgba(0,0,0,.30)' });
      screenPulse('gj-bomb', 320);
      screenPulse('gj-hurt', 240);
      return;
    }

    fxDotBurst(x,y,{ n:8, spread:34, ttl:420, size:5, bg:'rgba(255,255,255,.8)', shadow:'0 14px 34px rgba(0,0,0,.28)' });
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

  // ---------------- safe spawn rect ----------------
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
    fxText(px,py,`-HP ${dmg}`, 'boss');
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
      screenPulse('gj-boss-down', 260);

      updateBossUI();
      recomputeQuest();
    }
  }

  // ---------------- hit logic ----------------
  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    tObj.hit = true;

    ensureFxLayer();

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

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
      playFx('good', px, py);
      fxText(px,py,`+${delta}`, 'good');
      emit('hha:judge', { label:'GOOD!' });

    } else if(kind==='junk'){
      const blocked = useShield();
      resetCombo();

      if(blocked){
        state.nHitJunkGuard++;
        addFever(-6);
        playFx('junk_block', px, py);
        fxText(px,py,'BLOCK', 'block');
        emit('hha:judge', { label:'BLOCK!' });
      }else{
        state.nHitJunk++;
        addFever(10);
        setMiss(state.miss + 1);
        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        playFx('junk_hit', px, py);
        fxText(px,py,'-', 'hurt');
        emit('hha:judge', { label:'OOPS!' });
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      playFx('star', px, py);
      fxText(px,py,'MISS -1', 'star');
      emit('hha:judge', { label:'STAR!' });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      playFx('shield', px, py);
      fxText(px,py,'SHIELD +1', 'shield');
      emit('hha:judge', { label:'SHIELD!' });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      playFx('diamond', px, py);
      fxText(px,py,`+${bonus}`, 'diamond');
      emit('hha:judge', { label:'DIAMOND!' });

    } else if(kind==='skull'){
      resetCombo();
      addFever(14);
      setMiss(state.miss + 1);
      setScore(state.score - 8);
      playFx('skull', px, py);
      fxText(px,py,'💀', 'skull');
      emit('hha:judge', { label:'SKULL!' });

      if(state.boss.active && state.boss.phase===2){
        state.boss.stompCooldown = Math.max(state.boss.stompCooldown, 0.9);
      }

    } else if(kind==='bomb'){
      const blocked = useShield();
      resetCombo();

      if(blocked){
        addFever(-8);
        playFx('junk_block', px, py);
        fxText(px,py,'DEFUSE', 'block');
        emit('hha:judge', { label:'DEFUSED!' });
      }else{
        addFever(20);
        setMiss(state.miss + 2);
        setScore(state.score - 22);
        playFx('bomb', px, py);
        fxText(px,py,'BOOM', 'bomb');
        emit('hha:judge', { label:'BOOM!' });

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

  // ---------------- VR/cVR shoot center ----------------
  function shootCrosshair(ev){
    if(state.ended) return;
    ensureFxLayer();

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
      screenPulse('gj-miss-shot', 120);
      fxText(cx,cy,'…', 'miss');
      playFx('miss', cx, cy);
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
          playFx('good', c.x, c.y);
          fxText(c.x,c.y,'MISS', 'miss');

          emit('hha:judge', { label:'MISS!' });
          screenPulse('gj-good-expire', 160);

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
      fxText(DOC.documentElement.clientWidth/2, 80, '⚡ STORM', 'storm');
      screenPulse('gj-storm', 240);
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
      fxText(DOC.documentElement.clientWidth/2, 110, '👹 BOSS', 'boss');
      screenPulse('gj-boss', 280);

      for(let i=0;i<3;i++) spawnOne();
    }

    const wantRage = (state.miss >= 5);
    if(wantRage && !state.rageOn){
      state.rageOn = true;
      emit('hha:judge', { label:'RAGE!!' });
      fxText(DOC.documentElement.clientWidth/2, 140, '🔥 RAGE', 'rage');
      screenPulse('gj-rage', 320);
    }

    setModeClass();
  }

  // ---------------- boss tick ----------------
  function bossTelegraphStart(label){
    state.boss.teleOn = true;
    state.boss.teleTimer = 0;
    emit('hha:judge', { label: `⚠️ ${label}` });
    fxText(DOC.documentElement.clientWidth/2, 168, '⚠️ INCOMING', 'tele');
    screenPulse('gj-tele', 180);
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
        playFx('skull', c.x, c.y);
        fxText(c.x,c.y,'STOMP', 'stomp');

        removeTarget(tObj);
        popped++;
      }
    }
    emit('hha:judge', { label:'STOMP!' });
    screenPulse('gj-stomp', 240);
    updateModeThresholds();
    updateBossUI();
    recomputeQuest();
  }

  function bossDoBurst(){
    const n = state.rageOn ? 4 : 3;
    for(let i=0;i<n;i++) spawnOne();
    emit('hha:judge', { label:'BURST!' });
    fxText(DOC.documentElement.clientWidth/2, 190, '💥 BURST', 'burst');
    screenPulse('gj-burst', 240);
  }

  function tickBoss(dt){
    if(!state.boss.active) return;
    const b = state.boss;

    b.phaseTimer += dt;
    if(b.phaseTimer >= b.phaseEverySec){
      b.phaseTimer = 0;
      b.phase = (b.phase === 1) ? 2 : 1;
      emit('hha:judge', { label: (b.phase===2 ? 'PHASE 2!' : 'PHASE 1') });
      fxText(DOC.documentElement.clientWidth/2, 165, b.phase===2 ? '⚔️ PHASE 2' : '🛡️ PHASE 1', 'phase');
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