// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (BOSS++ + STORM + RAGE + TELEGRAPH + FX+COACH HARDEN)
// FULL v20260224-safe-pathfix+fxroot+coachwire
// ✅ FIX: expects CSS ./goodjunk-vr.css and HTML has #gj-fx + coach listener in run html
// ✅ FX hardened: uses existing #gj-fx if present; recreates only if missing
// ✅ Coach emits: hha:coach (tip/warn) rate-limited
// ✅ End events compat: emits both 'hha:end' and 'hha:game-ended'
'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ---------- helpers ----------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function safeText(x){ return (x==null) ? '—' : String(x); }

  // ---------- config ----------
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

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-02-24_FXROOT_COACH';
  const PROJECT_TAG = 'GoodJunkVR';

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

  // ---------- seeded RNG ----------
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
    const seedS = String(seedStr ?? '');
    const gen = xmur3(seedS || String(Date.now()));
    return sfc32(gen(), gen(), gen(), gen());
  }
  const rng = makeSeededRng(String(seed));
  function randIn(a, b){ return a + (b-a) * rng(); }

  function pickWeighted(items){
    let sum = 0;
    for(const it of items) sum += (Number(it.w)||0);
    let r = rng() * sum;
    for(const it of items){
      r -= (Number(it.w)||0);
      if(r <= 0) return it.k;
    }
    return items[items.length-1]?.k;
  }

  function deviceLabel(v){
    if(v==='pc') return 'pc';
    if(v==='vr') return 'vr';
    if(v==='cvr') return 'cvr';
    return 'mobile';
  }

  // ---------- difficulty ----------
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

  // ---------- coordinate helpers ----------
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

  // ---------- FX HARDEN (uses existing #gj-fx from HTML) ----------
  function ensureFxLayer(){
    try{
      let fx = DOC.getElementById('gj-fx');

      // If missing, recreate inside gj-layer
      if(!fx){
        fx = DOC.createElement('div');
        fx.id = 'gj-fx';
        fx.setAttribute('aria-hidden','true');
        fx.style.position = 'absolute';
        fx.style.inset = '0';
        fx.style.pointerEvents = 'none';
        fx.style.overflow = 'hidden';
        fx.style.zIndex = '140';
        LAYER_L.appendChild(fx);
      }else{
        // Ensure positioned correctly
        fx.style.position = fx.style.position || 'absolute';
        fx.style.inset = fx.style.inset || '0';
        fx.style.pointerEvents = 'none';
        fx.style.overflow = 'hidden';
        fx.style.zIndex = fx.style.zIndex || '140';
      }
      return fx;
    }catch(_){
      return null;
    }
  }

  function popBurst(kind, clientX, clientY, opts={}){
    const fx = ensureFxLayer();
    if(!fx) return;

    const { x, y } = toLayerLocal(clientX, clientY);
    const el = DOC.createElement('div');
    el.className = `gj-fx gj-fx-${kind}`;

    const size = Number(opts.size || 90);
    const life = Number(opts.life || 340);

    // anti-flash
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    el.style.setProperty('--life', `${life}ms`);

    fx.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, Math.max(60, life+80));
  }

  function popShards(kind, clientX, clientY, opts={}){
    const fx = ensureFxLayer();
    if(!fx) return;

    const { x, y } = toLayerLocal(clientX, clientY);
    const n = clamp(Number(opts.n||10), 4, 22);
    const spread = Number(opts.spread||90);
    const life = Number(opts.life||520);
    const sizeMin = Number(opts.sizeMin||6);
    const sizeMax = Number(opts.sizeMax||14);

    const wrap = DOC.createElement('div');
    wrap.className = `gj-fx-shards`;
    wrap.style.left = `${Math.round(x)}px`;
    wrap.style.top  = `${Math.round(y)}px`;
    wrap.style.setProperty('--life', `${life}ms`);

    for(let i=0;i<n;i++){
      const s = DOC.createElement('i');
      s.className = 'gj-shard';
      const a = rng()*Math.PI*2;
      const d = spread*(0.35 + 0.65*rng());
      const tx = Math.cos(a)*d;
      const ty = Math.sin(a)*d*0.85;
      const sz = sizeMin + (sizeMax-sizeMin)*rng();
      s.style.width = `${sz}px`;
      s.style.height= `${sz}px`;
      s.style.transform = `translate(0,0) scale(1)`;
      s.style.setProperty('--tx', `${tx.toFixed(1)}px`);
      s.style.setProperty('--ty', `${ty.toFixed(1)}px`);
      wrap.appendChild(s);
    }

    fx.appendChild(wrap);
    setTimeout(()=>{ try{ wrap.remove(); }catch(_){} }, Math.max(80, life+120));
  }

  function fxText(clientX, clientY, txt, cls=''){
    const fx = ensureFxLayer();
    if(!fx) return;

    const { x, y } = toLayerLocal(clientX, clientY);
    const t = DOC.createElement('div');
    t.className = `gj-fx-text ${cls||''}`.trim();
    t.textContent = String(txt || '');
    t.style.left = `${Math.round(x)}px`;
    t.style.top  = `${Math.round(y)}px`;
    fx.appendChild(t);

    setTimeout(()=>{ try{ t.remove(); }catch(_){} }, 640);
  }

  function bodyPulse(cls, ms=160){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms);
    }catch(_){}
  }

  function fxByKind(kind, clientX, clientY, meta={}){
    if(kind==='good'){
      popBurst('good', clientX, clientY, { size: 88, life: 320 });
      popShards('good', clientX, clientY, { n: 8, spread: 76, life: 500, sizeMin: 6, sizeMax: 12 });
      return;
    }
    if(kind==='junk'){
      if(meta.blocked){
        popBurst('block', clientX, clientY, { size: 96, life: 220 });
        popShards('block', clientX, clientY, { n: 7, spread: 64, life: 360, sizeMin: 5, sizeMax: 10 });
        bodyPulse('gj-pulse-block', 110);
      }else{
        popBurst('junk', clientX, clientY, { size: 126, life: 420 });
        popShards('junk', clientX, clientY, { n: 14, spread: 118, life: 620, sizeMin: 6, sizeMax: 14 });
        bodyPulse('gj-pulse-hurt', 220);
      }
      return;
    }
    if(kind==='star'){
      popBurst('star', clientX, clientY, { size: 98, life: 320 });
      popShards('star', clientX, clientY, { n: 9, spread: 90, life: 520, sizeMin: 5, sizeMax: 12 });
      bodyPulse('gj-pulse-star', 120);
      return;
    }
    if(kind==='shield'){
      popBurst('shield', clientX, clientY, { size: 104, life: 340 });
      popShards('shield', clientX, clientY, { n: 10, spread: 88, life: 520, sizeMin: 5, sizeMax: 12 });
      bodyPulse('gj-pulse-shield', 120);
      return;
    }
    if(kind==='diamond'){
      popBurst('diamond', clientX, clientY, { size: 112, life: 360 });
      popShards('diamond', clientX, clientY, { n: 12, spread: 102, life: 560, sizeMin: 6, sizeMax: 14 });
      bodyPulse('gj-pulse-diamond', 140);
      return;
    }
    if(kind==='skull'){
      popBurst('skull', clientX, clientY, { size: 136, life: 460 });
      popShards('skull', clientX, clientY, { n: 16, spread: 126, life: 680, sizeMin: 6, sizeMax: 15 });
      bodyPulse('gj-pulse-danger', 260);
      return;
    }
    if(kind==='bomb'){
      if(meta.blocked){
        popBurst('defuse', clientX, clientY, { size: 118, life: 320 });
        popShards('defuse', clientX, clientY, { n: 12, spread: 110, life: 520, sizeMin: 6, sizeMax: 14 });
        bodyPulse('gj-pulse-defuse', 160);
      }else{
        popBurst('bomb', clientX, clientY, { size: 158, life: 520 });
        popShards('bomb', clientX, clientY, { n: 18, spread: 150, life: 760, sizeMin: 7, sizeMax: 16 });
        bodyPulse('gj-pulse-explode', 360);
      }
      return;
    }
    popBurst('good', clientX, clientY, { size: 90, life: 320 });
  }

  // ---------- UI refs ----------
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

  // ---------- state ----------
  const state = {
    started: false,
    ended: false,

    timeLeftSec: durationPlannedSec,

    score: 0,
    combo: 0,
    comboMax: 0,

    missGoodExpired: 0,
    missJunkHit: 0,

    rtGood: [],

    fever: 0,
    shield: 0,

    goalObj: null,
    miniObj: null,
    lastQuestEmitAt: 0,

    spawnAcc: 0,
    targets: new Map(),

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

    coachLastAt: 0,
  };

  function missTotal(){ return Math.max(0, (state.missGoodExpired|0) + (state.missJunkHit|0)); }

  function setModeClass(){
    const b = DOC.body;
    b.classList.toggle('storm', !!state.stormOn);
    b.classList.toggle('boss',  !!state.bossOn);
    b.classList.toggle('rage',  !!state.rageOn);
  }

  // ---------- HUD setters ----------
  function setScore(v){
    state.score = Math.max(0, Math.floor(v));
    if(HUD.score) HUD.score.textContent = String(state.score);
    emit('hha:score', { score: state.score });
  }

  function renderMiss(){
    const g = (state.missGoodExpired|0);
    const j = (state.missJunkHit|0);
    const t = Math.max(0, g + j);

    if(HUD.miss){
      const W = (LAYER_L && LAYER_L.getBoundingClientRect) ? (LAYER_L.getBoundingClientRect().width||0) : 0;
      const showBreakdown = (W >= 360);
      HUD.miss.textContent = showBreakdown ? `${t} (G${g}/J${j})` : String(t);
    }
  }
  function addMissGood(n=1){ state.missGoodExpired = Math.max(0, (state.missGoodExpired|0) + (n|0)); renderMiss(); }
  function addMissJunk(n=1){ state.missJunkHit = Math.max(0, (state.missJunkHit|0) + (n|0)); renderMiss(); }
  function reduceMiss(n=1){
    let k = Math.max(0, n|0);
    while(k-- > 0){
      if(state.missGoodExpired > 0) state.missGoodExpired--;
      else if(state.missJunkHit > 0) state.missJunkHit--;
      else break;
    }
    renderMiss();
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

  function updateProgressUI(){
    if(!HUD.progressFill) return;
    const pct = clamp(1 - (state.timeLeftSec / Math.max(1, durationPlannedSec)), 0, 1);
    HUD.progressFill.style.width = `${Math.round(pct * 100)}%`;
  }

  // ---------- coach helper (rate limit) ----------
  function coach(msg, kind='tip'){
    const t = now();
    if(t - (state.coachLastAt||0) < 550) return;
    state.coachLastAt = t;
    emit('hha:coach', { msg: String(msg||''), kind: String(kind||'tip') });
  }

  // ---------- safe spawn rect ----------
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

  // ---------- targets ----------
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

    return pickWeighted([
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

    const size = clamp(baseSize + randIn(-4, 12), 44, 78);

    const rect = getSafeRect();
    const x = Math.floor(randIn(rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rect.yMin, rect.yMax));

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
    if(elR) elR.addEventListener('pointerdown', onPointer, { passive:false });

    // insert below FX layer if present
    const fx = DOC.getElementById('gj-fx');
    if(fx && fx.parentElement){
      try{
        fx.parentElement.insertBefore(elL, fx);
      }catch(_){
        LAYER_L.appendChild(elL);
      }
    }else{
      LAYER_L.appendChild(elL);
    }
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

  // ---------- boss UI ----------
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

  // ---------- quests (lightweight) ----------
  function setQuestUI(goalObj, miniObj){
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
    if(t - (state.lastQuestEmitAt||0) >= 220){
      state.lastQuestEmitAt = t;
      emit('quest:update', { goal: g || null, mini: m || null });
    }
  }

  function recomputeQuest(){
    const goal = {
      title: 'Survive',
      cur: missTotal(),
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
    setQuestUI(goal, mini);
  }

  // ---------- boss damage ----------
  function bossTakeDamage(dmg, cx, cy){
    if(!state.boss.active) return;
    const b = state.boss;
    b.hp = Math.max(0, b.hp - Math.max(1, dmg|0));
    fxText(cx,cy,`-HP ${dmg}`, 't-danger');
    updateBossUI();

    if(b.hp <= 0){
      state.boss.active = false;
      state.bossOn = false;
      state.rageOn = false;
      b.phase = 1; b.phaseTimer = 0; b.stompCooldown = 0; b.rageBoost = 0; b.teleOn = false; b.teleTimer = 0;

      setModeClass();

      const bonus = 120;
      setScore(state.score + bonus);
      addFever(-20);
      addShield(2);

      bodyPulse('gj-boss-down', 260);
      popBurst('victory', cx, cy, { size: 160, life: 420 });
      popShards('victory', cx, cy, { n: 16, spread: 150, life: 700, sizeMin: 6, sizeMax: 16 });
      coach('บอสล้มแล้ว! ได้โบนัส +SHIELD', 'tip');

      updateBossUI();
      recomputeQuest();
    }
  }

  // ---------- hit logic ----------
  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    tObj.hit = true;

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

    const c = centerOfTarget(tObj);
    const px = meta.clientX ?? c.x;
    const py = meta.clientY ?? c.y;

    if(kind==='good'){
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
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

      fxByKind('good', px, py);
      fxText(px, py, `+${delta}`, 't-good');

    } else if(kind==='junk'){
      const blocked = useShield();
      state.combo = 0;

      if(blocked){
        addFever(-6);
        fxByKind('junk', px, py, { blocked:true });
        fxText(px, py, 'BLOCK', 't-block');
      }else{
        addFever(10);
        addMissJunk(1);
        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        fxByKind('junk', px, py, { blocked:false });
        fxText(px, py, '-', 't-bad');
        coach('โดนของไม่ดี! ระวัง MISS (JUNK)', 'warn');
      }

    } else if(kind==='star'){
      state.combo = 0;
      addFever(-10);
      reduceMiss(1);
      fxByKind('star', px, py);
      fxText(px, py, 'MISS -1', 't-star');

    } else if(kind==='shield'){
      state.combo = 0;
      addFever(-8);
      addShield(1);
      fxByKind('shield', px, py);
      fxText(px, py, 'SHIELD +1', 't-shield');

    } else if(kind==='diamond'){
      state.combo = 0;
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      fxByKind('diamond', px, py);
      fxText(px, py, `+${bonus}`, 't-diamond');

    } else if(kind==='skull'){
      state.combo = 0;
      addFever(14);
      setScore(state.score - 8);
      fxByKind('skull', px, py);
      fxText(px, py, '💀', 't-danger');

    } else if(kind==='bomb'){
      const blocked = useShield();
      state.combo = 0;

      if(blocked){
        addFever(-8);
        fxByKind('bomb', px, py, { blocked:true });
        fxText(px, py, 'DEFUSE', 't-defuse');
      }else{
        addFever(20);
        setScore(state.score - 22);
        fxByKind('bomb', px, py, { blocked:false });
        fxText(px, py, 'BOOM', 't-bomb');
        coach('บึ้ม! ระวัง FEVER พุ่ง', 'danger');
      }
    }

    removeTarget(tObj);

    updateModeThresholds();
    updateBossUI();
    recomputeQuest();

    if(missTotal() >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // ---------- VR/cVR shoot center ----------
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
      popBurst('miss', cx, cy, { size: 70, life: 220 });
      fxText(cx, cy, '…', 't-miss');
      bodyPulse('gj-miss-shot', 120);
    }
  }
  ROOT.addEventListener('hha:shoot', shootCrosshair, { passive:true });

  // ---------- expiry ----------
  function expireTargets(){
    const t = now();
    for(const tObj of state.targets.values()){
      if(tObj.hit) continue;
      const age = t - tObj.bornAt;
      if(age >= tObj.lifeMs){
        tObj.hit = true;

        if(tObj.kind === 'good'){
          state.combo = 0;
          addFever(6);
          addMissGood(1);

          const c = centerOfTarget(tObj);
          popBurst('expire', c.x, c.y, { size: 92, life: 320 });
          fxText(c.x, c.y, 'MISS', 't-bad');

          updateModeThresholds();
          updateBossUI();
          recomputeQuest();

          if(missTotal() >= DIFF.missLimit){
            removeTarget(tObj);
            endGame('miss-limit');
            return;
          }
        }

        removeTarget(tObj);
      }
    }
  }

  // ---------- thresholds ----------
  function updateModeThresholds(){
    const m = missTotal();

    const wantStorm = (state.timeLeftSec <= 30);
    if(wantStorm && !state.stormOn){
      state.stormOn = true;
      popBurst('storm', DOC.documentElement.clientWidth/2, 90, { size: 160, life: 420 });
      fxText(DOC.documentElement.clientWidth/2, 90, '⚡ STORM', 't-storm');
      bodyPulse('gj-storm', 240);
      coach('⚡ STORM มาแล้ว! เป้าออกถี่ขึ้น', 'warn');
    }

    const wantBoss = (m >= 4);
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

      popBurst('boss', DOC.documentElement.clientWidth/2, 120, { size: 180, life: 520 });
      fxText(DOC.documentElement.clientWidth/2, 120, '👹 BOSS', 't-danger');
      bodyPulse('gj-boss', 280);
      coach('👹 บอสมาแล้ว! ยิง GOOD เพื่อทำดาเมจ', 'danger');

      for(let i=0;i<3;i++) spawnOne();
    }

    const wantRage = (m >= 5);
    if(wantRage && !state.rageOn){
      state.rageOn = true;
      popBurst('rage', DOC.documentElement.clientWidth/2, 150, { size: 190, life: 520 });
      fxText(DOC.documentElement.clientWidth/2, 150, '🔥 RAGE', 't-danger');
      bodyPulse('gj-rage', 320);
      coach('🔥 RAGE! ระวัง 💣/💀 โผล่บ่อย', 'danger');
    }

    setModeClass();
  }

  // ---------- spawn rate ----------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((missTotal() / Math.max(1, DIFF.missLimit)), 0, 1);
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

  // ---------- grade + end ----------
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
      HUD.endSub && (HUD.endSub.textContent =
        `reason=${safeText(detail?.reason)} | mode=${safeText(detail?.runMode||runMode)} | view=${safeText(detail?.device||deviceLabel(view))}`
      );
      HUD.endGrade && (HUD.endGrade.textContent = detail?.grade || '—');
      HUD.endScore && (HUD.endScore.textContent = String(detail?.scoreFinal ?? 0));
      HUD.endMiss && (HUD.endMiss.textContent = String(detail?.missTotal ?? 0));
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
    const misses = missTotal();
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
      missTotal: misses,
      missGoodExpired: state.missGoodExpired,
      missJunkHit: state.missJunkHit,
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
      missTotal: misses,
      missGoodExpired: state.missGoodExpired,
      missJunkHit: state.missJunkHit,
      avgRtGoodMs,
      medianRtGoodMs,
      reason,
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,
      grade,
      summary,
    });

    // compat
    emit('hha:game-ended', summary);

    showEndOverlay({ ...summary });
    popBurst('end', DOC.documentElement.clientWidth/2, DOC.documentElement.clientHeight/2, { size: 220, life: 600 });
    popShards('end', DOC.documentElement.clientWidth/2, DOC.documentElement.clientHeight/2, { n: 18, spread: 170, life: 820, sizeMin: 7, sizeMax: 16 });

    coach(`จบเกมแล้ว! เกรด ${grade} • SCORE ${scoreFinal}`, 'tip');
  }

  // ---------- loop ----------
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

  // ---------- init/start ----------
  function initHud(){
    setScore(0);
    state.missGoodExpired = 0;
    state.missJunkHit = 0;
    renderMiss();

    setTimeLeft(durationPlannedSec);
    setGradeText('—');

    addFever(0);
    renderShield();

    updateProgressUI();
    updateBossUI();

    // ✅ ensure FX root exists early
    ensureFxLayer();

    // ✅ coach hello
    coach('โหมดโหดขึ้นแล้ว! ⚡เหลือ 30s = STORM | MISS ≥4 = BOSS | MISS ≥5 = RAGE (ระวัง 💣/💀)', 'tip');

    recomputeQuest();
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