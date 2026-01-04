// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR Engine — PRODUCTION SAFE (HUD-safe play area + Quest sync)
// ✅ 1) HUD-safe spawn: compute dynamic stage rect from real DOM (hud + fever + controls)
// ✅ 2) Goal/Mini always render: quest director emits + engine mirrors to HUD + peek
// ✅ Works: PC / Mobile / VR / cVR (cVR uses hha:shoot)
// ✅ Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:end, hha:log
// ✅ Miss definition: miss = good expired + junk hit (shield blocks junk -> no miss)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v,min,max){
  v = Number(v)||0;
  return v < min ? min : (v > max ? max : v);
}
function nowMs(){ try{ return performance.now(); }catch{ return Date.now(); } }
function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }
function safeNum(x, def=0){
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}
function safeStr(x, def=''){
  try{ return (x==null)?def:String(x); }catch{ return def; }
}
function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='pc') return 'pc';
  if(v==='vr') return 'vr';
  if(v==='cvr') return 'cvr';
  return 'mobile';
}

function defaultSeed(){
  // deterministic-ish if not given: time-based
  return String(Date.now());
}

// ------------------ DOM refs ------------------
function $(id){ return DOC.getElementById(id); }

function getRefs(){
  return {
    hud: $('hud'),
    hudGoal: $('hud-goal'),
    hudGoalCur: $('hud-goal-cur'),
    hudGoalTarget: $('hud-goal-target'),
    hudMini: $('hud-mini'),
    miniTimer: $('miniTimer'),
    goalDesc: $('goalDesc'),
    hudScore: $('hud-score'),
    hudTime: $('hud-time'),
    hudMiss: $('hud-miss'),
    hudGrade: $('hud-grade'),

    feverBox: $('feverBox'),
    feverFill: $('feverFill'),
    feverText: $('feverText'),
    shieldPills: $('shieldPills'),

    stage: $('gj-stage'),
    layerL: $('gj-layer'),
    layerR: $('gj-layer-r'),

    btnShoot: $('btnShoot'),

    lowTimeOverlay: $('lowTimeOverlay'),
    lowTimeNum: $('gj-lowtime-num'),

    peek: $('peek'),
    peekGoal: $('peekGoal'),
    peekMini: $('peekMini'),
  };
}

// ------------------ RNG (seeded) ------------------
function makeRng(seedStr){
  // xmur3 + sfc32 (simple + stable)
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
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
  const seed = String(seedStr ?? '');
  const gen = xmur3(seed);
  const rng = sfc32(gen(), gen(), gen(), gen());
  return {
    next(){ return rng(); },
    int(min,max){
      const r = rng();
      return Math.floor(min + r*(max-min+1));
    },
    pick(arr){
      if(!arr || !arr.length) return null;
      return arr[Math.floor(rng()*arr.length)];
    }
  };
}

// ------------------ Assets (simple emoji fallback) ------------------
const EMOJI_GOOD = ['🍎','🍊','🥦','🥕','🍌','🍇','🍉','🥝','🍍','🥬','🥑'];
const EMOJI_JUNK = ['🍫','🍪','🍩','🍟','🍔','🥤','🍬','🧁'];

function makeTargetEl(kind, sizePx, content){
  const el = DOC.createElement('div');
  el.className = 'gj-target ' + kind;
  el.style.setProperty('--s', `${sizePx}px`);
  // image preferred, but fallback to emoji text
  if(content && content.url){
    const img = DOC.createElement('img');
    img.src = content.url;
    img.alt = content.alt || kind;
    el.appendChild(img);
  } else {
    el.textContent = content && content.emoji ? content.emoji : (kind==='good'? '🍎':'🍫');
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = `${Math.max(28, Math.floor(sizePx*0.55))}px`;
  }
  return el;
}

// ------------------ Layout / Safe play rect ------------------
// We compute real screen rectangles and then:
// 1) set CSS vars --gj-top-dyn/--gj-bot-dyn so stage never overlaps UI
// 2) use stage client rect for spawn positions (so targets never appear under HUD)
function computeAndApplyDynamicStagePadding(refs){
  const hud = refs.hud;
  const fever = refs.feverBox;
  const controls = DOC.querySelector('.hha-controls');
  const stage = refs.stage;

  const vw = Math.max(320, DOC.documentElement.clientWidth || 360);
  const vh = Math.max(480, DOC.documentElement.clientHeight || 640);

  // measure
  let hudBottom = 0;
  try{
    if(hud){
      const r = hud.getBoundingClientRect();
      // include quest area if visible (hud includes it)
      hudBottom = Math.max(0, r.bottom);
    }
  }catch(_){}

  let bottomTop = vh;
  try{
    const candidates = [];
    if(fever){
      const r = fever.getBoundingClientRect();
      candidates.push(r.top);
    }
    if(controls){
      const r = controls.getBoundingClientRect();
      candidates.push(r.top);
    }
    bottomTop = candidates.length ? Math.min(...candidates) : vh;
  }catch(_){ bottomTop = vh; }

  // extra breathing room so targets don't touch UI
  const topPad = Math.round(Math.max(80, hudBottom + 14));
  const botPad = Math.round(Math.max(120, (vh - bottomTop) + 14));

  // apply to root as CSS vars (stage uses them)
  try{
    DOC.documentElement.style.setProperty('--gj-top-dyn', `${topPad}px`);
    DOC.documentElement.style.setProperty('--gj-bot-dyn', `${botPad}px`);
  }catch(_){}

  // if stage exists, return safe rect (within stage)
  let rect = { left:0, top: topPad, right: vw, bottom: vh - botPad, width: vw, height: vh - topPad - botPad };
  try{
    if(stage){
      const r = stage.getBoundingClientRect();
      rect = { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
    }
  }catch(_){}
  return rect;
}

function startDynamicLayoutLoop(refs, state){
  // keep updating until stable, then occasionally
  let ticks = 0;
  const run = ()=>{
    const rect = computeAndApplyDynamicStagePadding(refs);
    state.playRect = rect;

    // stop heavy loop after a bit
    ticks++;
    if(ticks < 20){
      requestAnimationFrame(run);
    } else {
      // keepalive every 500ms (handles HUD hide/show, rotation, etc.)
      state._layoutTimer = setInterval(()=>{
        state.playRect = computeAndApplyDynamicStagePadding(refs);
      }, 500);
    }
  };
  requestAnimationFrame(run);

  // update on resize/orientation
  ROOT.addEventListener('resize', ()=>{
    state.playRect = computeAndApplyDynamicStagePadding(refs);
  }, { passive:true });
  ROOT.addEventListener('orientationchange', ()=>{
    setTimeout(()=> state.playRect = computeAndApplyDynamicStagePadding(refs), 120);
  }, { passive:true });
}

// ------------------ Quest Director (minimal) ------------------
// We keep it self-contained here so GoodJunk works even if external quest files differ.
function makeQuestDirector(rng, runMode){
  // goal + mini templates
  const goals = [
    { id:'collectGood', title:'เก็บของดี', target: 10 },
    { id:'keepFeverLow', title:'คุม FEVER', target: 1 }, // special: handled by engine (pass if fever stayed under threshold)
    { id:'combo', title:'คอมโบให้ได้', target: 8 },
  ];
  const minis = [
    { id:'noJunk', title:'อย่าโดนขยะ', sec: 12, forbidJunk:true },
    { id:'fastGood', title:'ยิงของดีให้ไว', sec: 12, requireFast:true },
    { id:'cleanStreak', title:'สตรีคของดี', sec: 12, requireStreak:true },
  ];

  const Q = {
    activeGoal: null,
    activeMini: null,
    goalsCleared: 0,
    miniCleared: 0,
    goalsTotal: 3,
    miniTotal: 3,
    _goalIdx: 0,
    _miniIdx: 0,
    _miniEndsAt: 0,
    _miniDone: false,
    _miniFail: false,
  };

  function nextGoal(){
    const g = goals[Q._goalIdx % goals.length];
    Q._goalIdx++;
    Q.activeGoal = {
      id: g.id,
      title: g.title,
      target: g.target,
      cur: 0,
      done: false
    };
    emitUpdate('goal');
  }
  function nextMini(nowMs){
    const m = minis[Q._miniIdx % minis.length];
    Q._miniIdx++;
    Q.activeMini = {
      id: m.id,
      title: m.title,
      sec: m.sec,
      forbidJunk: !!m.forbidJunk,
      requireFast: !!m.requireFast,
      requireStreak: !!m.requireStreak,
      done: false,
      fail: false
    };
    Q._miniEndsAt = nowMs + m.sec*1000;
    Q._miniDone = false;
    Q._miniFail = false;
    emitUpdate('mini');
  }

  function emitUpdate(kind){
    const g = Q.activeGoal;
    const m = Q.activeMini;
    emit('quest:update', {
      kind,
      goal: g ? { title:g.title, cur:g.cur, target:g.target, done:g.done } : null,
      mini: m ? { title:m.title, sec:m.sec, endsAt:Q._miniEndsAt, done:m.done, fail:m.fail } : null,
      goalsCleared: Q.goalsCleared,
      goalsTotal: Q.goalsTotal,
      miniCleared: Q.miniCleared,
      miniTotal: Q.miniTotal
    });
  }

  function start(nowMs){
    nextGoal();
    nextMini(nowMs);
  }

  function setGoalProgress(cur, target, done=false){
    const g = Q.activeGoal;
    if(!g || g.done) return;
    g.target = Math.max(1, safeNum(target, g.target));
    g.cur = clamp(cur, 0, g.target);
    if(done && !g.done){
      g.done = true;
      Q.goalsCleared++;
      emitUpdate('goal-done');
      if(Q.goalsCleared < Q.goalsTotal){
        nextGoal();
      }
    } else {
      emitUpdate('goal');
    }
  }

  function tick(nowMs){
    const m = Q.activeMini;
    if(!m) return;
    if(m.done || m.fail) return;
    if(nowMs >= Q._miniEndsAt){
      // if not failed, mark done
      m.done = true;
      Q.miniCleared++;
      emitUpdate('mini-done');
      if(Q.miniCleared < Q.miniTotal){
        nextMini(nowMs);
      }
    } else {
      emitUpdate('mini');
    }
  }

  function failMini(reason){
    const m = Q.activeMini;
    if(!m || m.done || m.fail) return;
    m.fail = true;
    Q._miniFail = true;
    emitUpdate('mini-fail');
    // mini fail: immediately rotate to next mini (keeps game lively)
    if(Q.miniCleared < Q.miniTotal){
      nextMini(nowMs());
    }
  }

  return { Q, start, tick, setGoalProgress, failMini };
}

// ------------------ Game State ------------------
function makeState(payload){
  const view = normalizeView(payload.view);
  const runMode = String(payload.run||payload.runMode||'play').toLowerCase(); // play/research
  const diff = String(payload.diff||'normal').toLowerCase();

  const timeTotal = clamp(payload.time ?? payload.durationPlannedSec ?? 80, 20, 240);
  const seed = payload.seed != null ? String(payload.seed) : defaultSeed();

  const rng = makeRng(seed);

  // difficulty knobs
  const cfg = {
    view, runMode, diff, timeTotal, seed,
    // spawn rate + sizes
    spawnPerSec: (diff==='easy') ? 1.05 : (diff==='hard') ? 1.75 : 1.35,
    junkChance: (diff==='easy') ? 0.22 : (diff==='hard') ? 0.34 : 0.28,
    specialChance: 0.08,
    sizeMin: (diff==='easy') ? 88 : (diff==='hard') ? 76 : 82,
    sizeMax: (diff==='easy') ? 120 : (diff==='hard') ? 102 : 112,

    // miss rules
    missLimit: (diff==='easy') ? 10 : (diff==='hard') ? 6 : 8,
    // fever rules
    feverUpJunk: (diff==='easy') ? 10 : (diff==='hard') ? 16 : 12,
    feverDownGood: 6,
    feverDownIdle: 2.5,
    // shield
    shieldMax: 3,
  };

  return {
    cfg, rng,
    started: false,
    ended: false,

    // session
    startIso: null,
    endIso: null,
    t0: 0,
    lastTick: 0,

    // runtime
    timeLeft: timeTotal,
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    // spawn/hit counters
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,
    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    // reaction times
    rtGood: [],
    rtBreakdown: { fast:0, mid:0, slow:0 },

    // fever/shield
    fever: 0,
    shield: 0,

    // layout
    playRect: null,
    _layoutTimer: null,

    // targets
    targets: new Map(), // id -> {el, kind, bornMs, expiresMs, x,y,size, isGood}
    nextId: 1,

    // quest
    quest: null,

    // goal trackers
    goalGoodTarget: 10,
    goalGoodHit: 0,

    // streak for mini
    goodStreak: 0,
    fastHitWindowMs: 520,
  };
}

// ------------------ HUD render ------------------
function setText(el, txt){
  try{ if(el) el.textContent = String(txt); }catch(_){}
}

function gradeFromScore(score, miss, diff){
  // simple grading: punish miss
  const s = safeNum(score,0);
  const m = safeNum(miss,0);
  const base = s - m*80;
  if(base >= 1200) return 'SS';
  if(base >= 900) return 'S';
  if(base >= 700) return 'A';
  if(base >= 520) return 'B';
  if(base >= 340) return 'C';
  return 'D';
}

function renderHud(refs, st){
  setText(refs.hudScore, st.score);
  setText(refs.hudTime, Math.max(0, Math.ceil(st.timeLeft)));
  setText(refs.hudMiss, st.misses);
  setText(refs.hudGrade, gradeFromScore(st.score, st.misses, st.cfg.diff));

  // fever
  if(refs.feverFill){
    const p = clamp(st.fever, 0, 100);
    refs.feverFill.style.width = `${p}%`;
  }
  setText(refs.feverText, `${clamp(st.fever,0,100)}%`);

  // shield pills
  if(refs.shieldPills){
    const n = clamp(st.shield, 0, st.cfg.shieldMax);
    refs.shieldPills.textContent = n ? ('🛡️'.repeat(n)) : '—';
  }
}

function renderQuestToHud(refs, qDetail){
  // qDetail shape from quest:update
  if(!qDetail) return;

  try{
    const g = qDetail.goal;
    if(g){
      setText(refs.hudGoal, g.title || '—');
      setText(refs.hudGoalCur, g.cur ?? 0);
      setText(refs.hudGoalTarget, g.target ?? 0);
      // optional desc line
      if(refs.goalDesc){
        refs.goalDesc.textContent = (g.done ? '✅ สำเร็จ' : 'ทำให้ครบตามเป้า');
      }
    }
    const m = qDetail.mini;
    if(m){
      setText(refs.hudMini, m.title || '—');
      // timer
      if(refs.miniTimer){
        const left = m.endsAt ? Math.max(0, Math.ceil((m.endsAt - nowMs())/1000)) : null;
        refs.miniTimer.textContent = (left!=null) ? `${left}s` : '—';
      }
    }
    // mirror to peek (for Missions button)
    if(refs.peekGoal){
      const gc = refs.hudGoalCur?.textContent || '0';
      const gt = refs.hudGoalTarget?.textContent || '0';
      refs.peekGoal.textContent = `${refs.hudGoal?.textContent || '—'} ${gc}/${gt}`;
    }
    if(refs.peekMini){
      refs.peekMini.textContent = refs.hudMini?.textContent || '—';
    }
  }catch(_){}
}

// ------------------ Spawn helpers ------------------
function pickSpawnXY(st, size){
  const r = st.playRect;
  const pad = 10;
  const left = (r ? r.left : 0) + size/2 + pad;
  const right= (r ? r.right: (DOC.documentElement.clientWidth||360)) - size/2 - pad;
  const top  = (r ? r.top  : 200) + size/2 + pad;
  const bot  = (r ? r.bottom:(DOC.documentElement.clientHeight||640)) - size/2 - pad;

  // safety fallback: if too tight, relax
  const L = Math.min(left, right-30);
  const R = Math.max(right, left+30);
  const T = Math.min(top, bot-30);
  const B = Math.max(bot, top+30);

  const x = L + st.rng.next() * (R - L);
  const y = T + st.rng.next() * (B - T);

  // convert to stage-local % (since targets use % positioning)
  const stage = DOC.getElementById('gj-stage');
  if(stage){
    const sr = stage.getBoundingClientRect();
    const px = clamp((x - sr.left) / Math.max(1, sr.width), 0.02, 0.98);
    const py = clamp((y - sr.top ) / Math.max(1, sr.height), 0.04, 0.96);
    return { xPct: px*100, yPct: py*100 };
  }
  const vw = DOC.documentElement.clientWidth||360;
  const vh = DOC.documentElement.clientHeight||640;
  return { xPct: clamp(x/vw,0.03,0.97)*100, yPct: clamp(y/vh,0.06,0.94)*100 };
}

function spawnTarget(refs, st){
  const cfg = st.cfg;

  // choose kind
  const r = st.rng.next();
  let kind = 'good';
  let special = null;

  if(r < cfg.junkChance){
    kind = 'junk';
  } else if(r > (1 - cfg.specialChance)){
    // specials: star/diamond/shield
    const pick = st.rng.pick(['star','diamond','shield']);
    kind = pick || 'star';
    special = kind;
    kind = (kind==='shield') ? 'shield' : kind;
  } else {
    kind = 'good';
  }

  // size
  const size = st.rng.int(cfg.sizeMin, cfg.sizeMax);

  // content
  let content = null;
  if(kind==='good') content = { emoji: st.rng.pick(EMOJI_GOOD) };
  else if(kind==='junk') content = { emoji: st.rng.pick(EMOJI_JUNK) };
  else if(kind==='star') content = { emoji:'⭐' };
  else if(kind==='diamond') content = { emoji:'💎' };
  else if(kind==='shield') content = { emoji:'🛡️' };

  const el = makeTargetEl(kind, size, content);

  const { xPct, yPct } = pickSpawnXY(st, size);
  el.style.setProperty('--x', `${xPct}%`);
  el.style.setProperty('--y', `${yPct}%`);

  const id = st.nextId++;
  el.dataset.tid = String(id);
  el.dataset.kind = kind;

  const born = nowMs();
  const lifeMs =
    (cfg.diff==='easy') ? 2100 :
    (cfg.diff==='hard') ? 1500 : 1800;

  const expires = born + lifeMs;

  // counters
  if(kind==='good') st.nTargetGoodSpawned++;
  else if(kind==='junk') st.nTargetJunkSpawned++;
  else if(kind==='star') st.nTargetStarSpawned++;
  else if(kind==='diamond') st.nTargetDiamondSpawned++;
  else if(kind==='shield') st.nTargetShieldSpawned++;

  // add to DOM
  const layer = refs.layerL || DOC.getElementById('gj-layer');
  if(layer) layer.appendChild(el);

  // register
  st.targets.set(id, { id, el, kind, bornMs: born, expiresMs: expires, isGood: (kind==='good') });

  // direct tap (mobile/pc)
  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    onShootAtTarget(refs, st, id, 'tap');
  }, { passive:false });

  return id;
}

// ------------------ Hit / Miss rules ------------------
function addScore(st, delta){
  st.score = Math.max(0, st.score + delta);
}
function addCombo(st){
  st.combo++;
  if(st.combo > st.comboMax) st.comboMax = st.combo;
}
function breakCombo(st){
  st.combo = 0;
}
function addMiss(st){
  st.misses++;
}
function addFever(st, delta){
  st.fever = clamp(st.fever + delta, 0, 100);
}

function giveShield(st, n=1){
  st.shield = clamp(st.shield + n, 0, st.cfg.shieldMax);
}
function consumeShield(st){
  if(st.shield > 0){
    st.shield--;
    return true;
  }
  return false;
}

function expireTargets(refs, st){
  const t = nowMs();
  for(const [id, it] of st.targets.entries()){
    if(t >= it.expiresMs){
      // expired
      st.targets.delete(id);
      try{ it.el.remove(); }catch(_){}
      if(it.isGood){
        // MISS: good expired counts
        st.nExpireGood++;
        addMiss(st);
        breakCombo(st);
        emit('hha:judge', { type:'miss-expire-good', misses: st.misses });
      }
    }
  }
}

// ------------------ Shooting (tap / cVR) ------------------
function findTargetUnderCrosshair(refs, st){
  // For cVR: choose closest target to center in stage coords
  const stage = refs.stage || DOC.getElementById('gj-stage');
  if(!stage) return null;
  const sr = stage.getBoundingClientRect();
  const cx = sr.left + sr.width/2;
  const cy = sr.top + sr.height/2;

  let best = null;
  let bestD = Infinity;
  for(const it of st.targets.values()){
    const r = it.el.getBoundingClientRect();
    const tx = r.left + r.width/2;
    const ty = r.top + r.height/2;
    const dx = tx - cx;
    const dy = ty - cy;
    const d = Math.hypot(dx,dy);
    if(d < bestD){
      bestD = d;
      best = it;
    }
  }

  // aim assist threshold (px)
  const lockPx = (st.cfg.view==='cvr') ? 140 : 90;
  if(best && bestD <= lockPx) return best.id;
  return null;
}

function onShootAtTarget(refs, st, id, how){
  if(st.ended) return;
  const it = st.targets.get(id);
  if(!it) return;

  st.targets.delete(id);

  // FX (optional)
  try{
    const P = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles;
    if(P && typeof P.burstAt === 'function'){
      const r = it.el.getBoundingClientRect();
      P.burstAt(r.left + r.width/2, r.top + r.height/2);
    }
  }catch(_){}

  // remove element
  try{
    it.el.classList.add('hit');
    setTimeout(()=>{ try{ it.el.remove(); }catch(_){ } }, 60);
  }catch(_){}

  const tNow = nowMs();
  const rt = Math.max(0, tNow - it.bornMs);

  if(it.kind === 'good'){
    st.nHitGood++;
    st.goalGoodHit++;
    addCombo(st);

    // score
    const bonus = Math.min(180, 60 + st.combo*6);
    addScore(st, 50 + bonus);

    // fever down
    addFever(st, -st.cfg.feverDownGood);

    // RT tracking
    st.rtGood.push(rt);
    if(rt <= st.fastHitWindowMs) st.rtBreakdown.fast++;
    else if(rt <= 900) st.rtBreakdown.mid++;
    else st.rtBreakdown.slow++;

    emit('hha:judge', { type:'hit-good', rtMs: rt, combo: st.combo });

  } else if(it.kind === 'junk'){
    st.nHitJunk++;
    breakCombo(st);

    // if shield active: block and NO miss
    if(consumeShield(st)){
      st.nHitJunkGuard++;
      addFever(st, -6);
      addScore(st, 10);
      emit('hha:judge', { type:'block-junk', shield: st.shield });
    } else {
      // MISS: junk hit counts
      addMiss(st);
      addFever(st, +st.cfg.feverUpJunk);
      addScore(st, -40);
      emit('hha:judge', { type:'hit-junk', misses: st.misses });
      // mini fail if forbids junk
      try{
        const m = st.quest?.Q?.activeMini;
        if(m && m.forbidJunk) st.quest.failMini('hit-junk');
      }catch(_){}
    }

  } else if(it.kind === 'shield'){
    giveShield(st, 1);
    addScore(st, 60);
    emit('hha:judge', { type:'pickup-shield', shield: st.shield });

  } else if(it.kind === 'star'){
    // star = time boost
    st.timeLeft = Math.min(st.cfg.timeTotal, st.timeLeft + 4);
    addScore(st, 80);
    emit('hha:judge', { type:'pickup-star' });

  } else if(it.kind === 'diamond'){
    // diamond = big score + fever down
    addScore(st, 140);
    addFever(st, -10);
    emit('hha:judge', { type:'pickup-diamond' });
  }

  // update goal progress: collectGood target
  try{
    const g = st.quest?.Q?.activeGoal;
    if(g && g.id === 'collectGood'){
      const target = g.target || st.goalGoodTarget;
      const cur = st.goalGoodHit;
      st.quest.setGoalProgress(cur, target, cur >= target);
    }
    if(g && g.id === 'combo'){
      const cur = st.comboMax;
      const target = g.target || 8;
      st.quest.setGoalProgress(cur, target, cur >= target);
    }
    if(g && g.id === 'keepFeverLow'){
      // pass only at end, handled in end()
      st.quest.setGoalProgress(0, 1, false);
    }
  }catch(_){}
}

function onShoot(refs, st){
  if(st.ended) return;
  // cVR/VR: pick target by crosshair
  if(st.cfg.view === 'cvr' || st.cfg.view === 'vr'){
    const id = findTargetUnderCrosshair(refs, st);
    if(id != null) onShootAtTarget(refs, st, id, 'cvr');
  }
}

// ------------------ End summary + logger payload ------------------
function computeMetrics(st){
  const goodSpawn = st.nTargetGoodSpawned || 0;
  const hitGood = st.nHitGood || 0;
  const hitJunk = st.nHitJunk || 0;
  const expGood = st.nExpireGood || 0;

  const accuracyGoodPct = goodSpawn ? (hitGood / goodSpawn * 100) : null;
  const junkErrorPct = (hitGood + hitJunk) ? (hitJunk / (hitGood + hitJunk) * 100) : null;

  let avgRt = null, medRt = null, fastRate = null;
  if(st.rtGood.length){
    const arr = st.rtGood.slice().sort((a,b)=>a-b);
    const sum = arr.reduce((a,b)=>a+b,0);
    avgRt = sum / arr.length;
    medRt = arr[Math.floor(arr.length/2)];
    fastRate = (st.rtBreakdown.fast / arr.length) * 100;
  }
  return { accuracyGoodPct, junkErrorPct, avgRtGoodMs: avgRt, medianRtGoodMs: medRt, fastHitRatePct: fastRate };
}

function endGame(refs, st, reason){
  if(st.ended) return;
  st.ended = true;
  st.endIso = nowIso();

  // clear layout timer
  try{ if(st._layoutTimer) clearInterval(st._layoutTimer); }catch(_){}

  // goal: keepFeverLow pass if fever never exceeded 75 (simple)
  try{
    const g = st.quest?.Q?.activeGoal;
    if(g && g.id === 'keepFeverLow'){
      const pass = (st.fever <= 75);
      st.quest.setGoalProgress(pass ? 1 : 0, 1, pass);
    }
  }catch(_){}

  const grade = gradeFromScore(st.score, st.misses, st.cfg.diff);
  const metrics = computeMetrics(st);

  // emit end for cloud logger V21 (expects end row)
  const endPayload = {
    projectTag: 'GoodJunkVR',
    runMode: st.cfg.runMode,
    view: st.cfg.view,
    device: st.cfg.view,
    diff: st.cfg.diff,
    seed: st.cfg.seed,

    durationPlannedSec: st.cfg.timeTotal,
    durationPlayedSec: st.cfg.timeTotal - Math.max(0, st.timeLeft),

    scoreFinal: st.score,
    comboMax: st.comboMax,
    misses: st.misses,

    goalsCleared: st.quest?.Q?.goalsCleared ?? null,
    goalsTotal: st.quest?.Q?.goalsTotal ?? null,
    miniCleared: st.quest?.Q?.miniCleared ?? null,
    miniTotal: st.quest?.Q?.miniTotal ?? null,

    nTargetGoodSpawned: st.nTargetGoodSpawned,
    nTargetJunkSpawned: st.nTargetJunkSpawned,
    nTargetStarSpawned: st.nTargetStarSpawned,
    nTargetDiamondSpawned: st.nTargetDiamondSpawned,
    nTargetShieldSpawned: st.nTargetShieldSpawned,

    nHitGood: st.nHitGood,
    nHitJunk: st.nHitJunk,
    nHitJunkGuard: st.nHitJunkGuard,
    nExpireGood: st.nExpireGood,

    accuracyGoodPct: metrics.accuracyGoodPct,
    junkErrorPct: metrics.junkErrorPct,
    avgRtGoodMs: metrics.avgRtGoodMs,
    medianRtGoodMs: metrics.medianRtGoodMs,
    fastHitRatePct: metrics.fastHitRatePct,
    rtBreakdownJson: JSON.stringify(st.rtBreakdown),

    reason: reason || null,
    startTimeIso: st.startIso,
    endTimeIso: st.endIso,
    grade
  };

  emit('hha:end', endPayload);

  // Save last summary (HHA standard)
  try{
    const summary = Object.assign({}, endPayload);
    summary.sessionId = qs('sessionId', null) || null;
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    // history append
    const key = 'HHA_SUMMARY_HISTORY';
    const cur = JSON.parse(localStorage.getItem(key) || '[]');
    cur.push(summary);
    localStorage.setItem(key, JSON.stringify(cur.slice(-40)));
  }catch(_){}

  // show end screen if exists
  try{
    const overlay = DOC.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:210;
      display:flex; align-items:center; justify-content:center;
      background: rgba(2,6,23,.86); backdrop-filter: blur(12px);
      padding: 16px;
    `;
    const card = DOC.createElement('div');
    card.style.cssText = `
      width:min(720px,92vw);
      background: rgba(2,6,23,.82);
      border:1px solid rgba(148,163,184,.20);
      border-radius: 22px;
      padding:18px;
      box-shadow: 0 18px 60px rgba(0,0,0,.55);
    `;
    card.innerHTML = `
      <div style="font-size:22px;font-weight:1200;">Completed</div>
      <div style="margin-top:6px;color:#94a3b8;font-weight:1000;font-size:12px;">
        reason=${safeStr(reason,'end')} | mode=${safeStr(st.cfg.runMode)} | view=${safeStr(st.cfg.view)}
      </div>

      <div style="margin-top:12px;border-radius:18px;border:1px solid rgba(148,163,184,.16);overflow:hidden">
        <div style="padding:12px;display:flex;justify-content:space-between;background:rgba(15,23,42,.50)">
          <b>GRADE</b><b>${grade}</b>
        </div>
        <div style="padding:12px;display:flex;justify-content:space-between;border-top:1px solid rgba(148,163,184,.10)">
          <b>SCORE</b><b>${st.score}</b>
        </div>
        <div style="padding:12px;display:flex;justify-content:space-between;border-top:1px solid rgba(148,163,184,.10)">
          <b>MISS</b><b>${st.misses}</b>
        </div>
        <div style="padding:12px;display:flex;justify-content:space-between;border-top:1px solid rgba(148,163,184,.10)">
          <b>TIME</b><b>${st.cfg.timeTotal}</b>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
        <button id="gjBtnHub" style="
          flex:1; min-width:220px; height:54px; border-radius:16px;
          border:1px solid rgba(34,197,94,.38);
          background: rgba(34,197,94,.16); color:#eafff3;
          font-weight:1100; font-size:16px; cursor:pointer
        ">กลับ HUB</button>

        <button id="gjBtnReplay" style="
          flex:1; min-width:220px; height:54px; border-radius:16px;
          border:1px solid rgba(148,163,184,.20);
          background: rgba(2,6,23,.55); color:#e5e7eb;
          font-weight:1100; font-size:16px; cursor:pointer
        ">เล่นอีกครั้ง</button>
      </div>

      <div style="margin-top:10px;color:#94a3b8;font-weight:900;font-size:12px;">
        * ถ้าเปิดโหมด Research ให้ตรวจใน Google Sheet ว่ามี row start/end ครบ
      </div>
    `;
    overlay.appendChild(card);
    DOC.body.appendChild(overlay);

    const hub = qs('hub', null);
    card.querySelector('#gjBtnHub').addEventListener('click', ()=>{
      if(hub) location.href = hub;
      else location.href = '../hub.html';
    });
    card.querySelector('#gjBtnReplay').addEventListener('click', ()=>{
      location.reload();
    });
  }catch(_){}
}

// ------------------ Game loop ------------------
function tick(refs, st){
  if(st.ended) return;

  const t = nowMs();
  const dt = Math.min(0.05, (t - st.lastTick)/1000);
  st.lastTick = t;

  // time
  st.timeLeft -= dt;
  if(st.timeLeft <= 0){
    st.timeLeft = 0;
    endGame(refs, st, 'time');
    return;
  }

  // fever idle decay
  st.fever = clamp(st.fever - st.cfg.feverDownIdle*dt, 0, 100);

  // warn ring / low time overlay
  if(st.timeLeft <= 8){
    DOC.body.classList.add('lowtime');
    if(refs.lowTimeOverlay){
      refs.lowTimeOverlay.setAttribute('aria-hidden', 'false');
      if(refs.lowTimeNum) refs.lowTimeNum.textContent = String(Math.max(1, Math.ceil(st.timeLeft)));
    }
  } else {
    DOC.body.classList.remove('lowtime');
    if(refs.lowTimeOverlay){
      refs.lowTimeOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  // spawn
  const spawnChance = st.cfg.spawnPerSec * dt;
  if(st.rng.next() < spawnChance){
    spawnTarget(refs, st);
  }

  // expire
  expireTargets(refs, st);

  // quest tick
  try{
    st.quest.tick(t);
  }catch(_){}

  // render HUD
  renderHud(refs, st);

  // fail if miss limit reached (optional pressure)
  if(st.misses >= st.cfg.missLimit){
    endGame(refs, st, 'miss-limit');
    return;
  }

  requestAnimationFrame(()=> tick(refs, st));
}

// ------------------ Boot entry ------------------
export function boot(payload = {}){
  const refs = getRefs();

  // set body view class is done by boot.js; but safe here too
  const view = normalizeView(payload.view || qs('view','mobile'));
  try{
    DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    DOC.body.classList.add('view-'+view);
  }catch(_){}

  const run = String(payload.run || payload.runMode || qs('run','play') || 'play').toLowerCase();
  const diff= String(payload.diff || qs('diff','normal') || 'normal').toLowerCase();
  const time= safeNum(payload.time ?? qs('time','80'), 80);
  const seed= (payload.seed != null) ? payload.seed : qs('seed', null);

  const st = makeState({ view, run, diff, time, seed });

  // init quest
  st.quest = makeQuestDirector(st.rng, st.cfg.runMode);
  st.quest.start(nowMs());

  // listen quest updates -> HUD
  ROOT.addEventListener('quest:update', (ev)=>{
    renderQuestToHud(refs, ev?.detail);
  }, { passive:true });

  // layout loop (critical fix for "targets under HUD")
  startDynamicLayoutLoop(refs, st);

  // start session
  st.started = true;
  st.t0 = nowMs();
  st.lastTick = st.t0;
  st.startIso = nowIso();

  // emit start for logger V21
  emit('hha:start', {
    projectTag: 'GoodJunkVR',
    runMode: st.cfg.runMode,
    view: st.cfg.view,
    diff: st.cfg.diff,
    seed: st.cfg.seed,
    gameVersion: qs('v', qs('ver', null)),
    durationPlannedSec: st.cfg.timeTotal,
    startTimeIso: st.startIso,

    studyId: qs('study', qs('studyId', payload.studyId ?? null)),
    phase: qs('phase', payload.phase ?? null),
    conditionGroup: qs('cond', qs('conditionGroup', payload.conditionGroup ?? null)),
  });

  // controls: shoot button (always)
  if(refs.btnShoot){
    refs.btnShoot.addEventListener('click', ()=> onShoot(refs, st));
  }

  // cVR/VR: also listen to global event hha:shoot (from vr-ui.js)
  ROOT.addEventListener('hha:shoot', ()=> onShoot(refs, st), { passive:true });

  // pagehide/visibility flush end if not ended (safety)
  ROOT.addEventListener('pagehide', ()=>{
    if(!st.ended) endGame(refs, st, 'pagehide');
  }, { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden' && !st.ended) endGame(refs, st, 'hidden');
  }, { passive:true });

  // first render (quest)
  renderHud(refs, st);
  renderQuestToHud(refs, {
    goal: st.quest.Q.activeGoal ? {
      title: st.quest.Q.activeGoal.title,
      cur: st.quest.Q.activeGoal.cur,
      target: st.quest.Q.activeGoal.target,
      done: st.quest.Q.activeGoal.done
    } : null,
    mini: st.quest.Q.activeMini ? {
      title: st.quest.Q.activeMini.title,
      sec: st.quest.Q.activeMini.sec,
      endsAt: st.quest.Q._miniEndsAt,
      done: st.quest.Q.activeMini.done,
      fail: st.quest.Q.activeMini.fail
    } : null
  });

  // go!
  requestAnimationFrame(()=> tick(refs, st));
}