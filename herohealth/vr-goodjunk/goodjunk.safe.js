// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// PATCH: Cardboard Stereo (2-eye) — spawn paired targets + dual crosshair shooting

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
}
function qs(name, def){
  try{ return (new URL(ROOT.location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}
function xmur3(str){
  str = String(str || '');
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= (h >>> 16);
    return h >>> 0;
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
function makeRng(seed){
  const g = xmur3(String(seed || 'seed'));
  return sfc32(g(), g(), g(), g());
}
function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

function isMobileLike(){
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const coarse = (ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles || { scorePop(){}, burstAt(){}, celebrate(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI || { set(){}, setShield(){} };

function rankFromAcc(acc){
  if (acc >= 95) return 'SSS';
  if (acc >= 90) return 'SS';
  if (acc >= 85) return 'S';
  if (acc >= 75) return 'A';
  if (acc >= 60) return 'B';
  return 'C';
}
function diffBase(diff){
  diff = String(diff||'normal').toLowerCase();
  if (diff === 'easy')  return { spawnMs: 980, ttlMs: 2300, size: 1.08, junk: 0.12, power: 0.035, maxT: 7 };
  if (diff === 'hard')  return { spawnMs: 720, ttlMs: 1650, size: 0.94, junk: 0.18, power: 0.025, maxT: 9 };
  return { spawnMs: 840, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.030, maxT: 8 };
}

function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;
  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    #gj-layer, #gj-layerL, #gj-layerR { position:absolute; inset:0; pointer-events:auto; }
    .gj-target{
      position:absolute; transform: translate(-50%,-50%) scale(var(--s,1));
      width:74px; height:74px; border-radius:999px;
      display:flex; align-items:center; justify-content:center;
      font-size:38px; line-height:1;
      user-select:none; -webkit-user-select:none;
      pointer-events:auto; touch-action: manipulation;
      background: rgba(2,6,23,.55);
      border: 1px solid rgba(148,163,184,.22);
    }
    .gj-target.spawn{ transform: translate(-50%,-50%) scale(.25); opacity:0; }
    .gj-target.gone{ transform: translate(-50%,-50%) scale(.85); opacity:0; }
  `;
  DOC.head.appendChild(st);
}

function setXY(el, x, y){
  const px = x.toFixed(1) + 'px';
  const py = y.toFixed(1) + 'px';
  el.style.left = px;
  el.style.top  = py;
}

function getCenter(el){
  if (!el) return { x:(innerWidth||360)*0.5, y:(innerHeight||640)*0.5 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width/2, y: r.top + r.height/2 };
}
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

function findTargetNear(layerEl, cx, cy, radiusPx){
  const r2max = radiusPx * radiusPx;
  const list = layerEl.querySelectorAll('.gj-target');
  let best = null, bestD2 = 1e18;
  list.forEach(el=>{
    const r = el.getBoundingClientRect();
    const tx = r.left + r.width/2;
    const ty = r.top + r.height/2;
    const d2 = dist2(cx,cy,tx,ty);
    if (d2 <= r2max && d2 < bestD2){ best = el; bestD2 = d2; }
  });
  return best;
}

const GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS = ['⭐','💎'];
const SHIELD = '🛡️';

export function boot(opts = {}){
  const DOC = ROOT.document;
  if (!DOC) return;

  ensureTargetStyles();

  const view = (DOC.body && DOC.body.dataset && DOC.body.dataset.view) ? String(DOC.body.dataset.view) : '';
  const wantStereo = (view === 'cardboard');

  const layerEl  = opts.layerEl  || DOC.getElementById('gj-layer');
  const crossEl  = opts.crosshairEl || DOC.getElementById('gj-crosshair');

  const layerElL = opts.layerElL || DOC.getElementById('gj-layerL');
  const layerElR = opts.layerElR || DOC.getElementById('gj-layerR');
  const crossElL = opts.crosshairElL || DOC.getElementById('gj-crosshairL');
  const crossElR = opts.crosshairElR || DOC.getElementById('gj-crosshairR');

  const stereo = !!(wantStereo && layerElL && layerElR);

  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';
  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;
  const endPolicy = String(opts.endPolicy || qs('end','time')).toLowerCase();

  const sessionId = String(opts.sessionId || qs('sessionId', qs('sid','')) || '');
  const ts = String(qs('ts', Date.now()));
  const seed = String(opts.seed || qs('seed', null) || (sessionId ? (sessionId + '|' + ts) : ts));

  const base = diffBase(diff);

  const S = {
    running:false, ended:false,
    diff, runMode, timeSec, seed,
    rng: makeRng(seed),

    tStart:0, left: timeSec,

    score:0, combo:0, comboMax:0,
    misses:0, hitAll:0, hitGood:0, hitJunk:0, hitJunkGuard:0, expireGood:0,
    fever:0, shield:0,

    goalsCleared:0, goalsTotal:2,
    miniCleared:0, miniTotal:7,

    warmupUntil:0,
    spawnTimer:0, tickTimer:0,

    spawnMs: base.spawnMs,
    ttlMs:   base.ttlMs,
    size:    base.size,
    junkP:   base.junk,
    powerP:  base.power,
    maxTargets: base.maxT,

    stereo,
    idSeq: 0,
    pairMap: new Map(), // id -> { L, R, type, emoji }
  };

  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.12, S.size + 0.03);
  }

  function updateFever(){
    try{
      FeverUI.set({ value: clamp(S.fever,0,100), shield: clamp(S.shield,0,9) });
      if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(S.shield,0,9));
    }catch(_){}
  }

  function updateScore(){
    emit('hha:score', { score:S.score|0, combo:S.combo|0, comboMax:S.comboMax|0, misses:S.misses|0, shield:S.shield|0 });
    const acc = S.hitAll > 0 ? Math.round((S.hitGood/S.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }
  function updateTime(){ emit('hha:time', { left: Math.max(0, S.left|0) }); }
  function updateQuest(){
    emit('quest:update', {
      goalTitle: `Goal: เก็บของดีให้ครบ`,
      goalNow: S.goalsCleared, goalTotal: S.goalsTotal,
      miniTitle: `Mini: คอมโบมาแล้ว!`,
      miniNow: S.miniCleared, miniTotal: S.miniTotal,
      miniLeftMs: 0
    });
    emit('quest:progress', {
      goalsCleared: S.goalsCleared, goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared, miniTotal: S.miniTotal
    });
  }

  function countTargets(){
    if (!S.stereo) return layerEl ? layerEl.querySelectorAll('.gj-target').length : 0;
    return layerElL.querySelectorAll('.gj-target').length; // count by left
  }

  function removePair(id){
    const p = S.pairMap.get(id);
    if (!p) return;
    try{ clearTimeout(p.L?._ttl); }catch(_){}
    try{ clearTimeout(p.R?._ttl); }catch(_){}
    try{ p.L?.classList.add('gone'); }catch(_){}
    try{ p.R?.classList.add('gone'); }catch(_){}
    setTimeout(()=>{
      try{ p.L?.remove(); }catch(_){}
      try{ p.R?.remove(); }catch(_){}
    }, 160);
    S.pairMap.delete(id);
  }

  function burstAt(el, kind){
    try{
      const r = el.getBoundingClientRect();
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, kind || '');
    }catch(_){}
  }

  function expireTargetId(id){
    const p = S.pairMap.get(id);
    if (!p) return;
    if (p.type === 'good'){
      S.misses++;
      S.expireGood++;
      S.combo = 0;
      S.fever = clamp(S.fever + 7, 0, 100);
      updateFever();
      emit('hha:judge', { kind:'warn', text:'MISS (หมดเวลา)!' });
      updateScore(); updateQuest();
    }
    removePair(id);
  }

  function makeDom(type, emoji, x, y, s, id, side){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type} gj-${type} spawn`;
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');
    el.dataset.tid = String(id);
    el.textContent = String(emoji||'✨');

    el.style.pointerEvents = 'auto';
    el.style.position = 'absolute';
    el.style.zIndex = '30';
    el.style.setProperty('--s', String(Number(s||1).toFixed(3)));

    setXY(el, x, y);
    requestAnimationFrame(()=>{ try{ el.classList.remove('spawn'); }catch(_){} });

    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      hitById(id);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });
    return el;
  }

  // ===== hit logic by id (so L/R stay synced) =====
  function scoreGood(){
    const mult = 1 + clamp(S.combo/40, 0, 0.6);
    const pts = Math.round(90 * mult);
    S.score += pts;
    return pts;
  }

  function hitById(id){
    if (!S.running || S.ended) return;
    const p = S.pairMap.get(id);
    if (!p) return;

    const tp = p.type;

    if (tp === 'good'){
      S.hitAll++; S.hitGood++;
      S.combo = clamp(S.combo + 1, 0, 9999);
      S.comboMax = Math.max(S.comboMax, S.combo);

      S.fever = clamp(S.fever - 2.2, 0, 100);
      updateFever();

      const pts = scoreGood();
      emit('hha:judge', { kind:'good', text:`+${pts}` });

      // burst on whichever exists
      burstAt(p.L || p.R, 'good');

      updateScore(); updateQuest();

      // mini by combo
      if (S.miniCleared < S.miniTotal){
        const needCombo = 4 + (S.miniCleared * 2);
        if (S.combo >= needCombo){
          S.miniCleared++;
          emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! ${S.miniCleared}/${S.miniTotal}` });
          updateQuest();
        }
      }
      // goal by total good hits
      if (S.goalsCleared < S.goalsTotal){
        const needGood = 10 + (S.goalsCleared * 8);
        if (S.hitGood >= needGood){
          S.goalsCleared++;
          emit('hha:celebrate', { kind:'goal', title:`Goal ผ่าน! ${S.goalsCleared}/${S.goalsTotal}` });
          updateQuest();
        }
      }

      removePair(id);
      return;
    }

    if (tp === 'shield'){
      S.hitAll++;
      S.combo = clamp(S.combo + 1, 0, 9999);
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.shield = clamp(S.shield + 1, 0, 9);
      S.score += 70;
      updateFever();
      emit('hha:judge', { kind:'good', text:'SHIELD +1' });
      burstAt(p.L || p.R, 'shield');
      updateScore(); updateQuest();
      removePair(id);
      return;
    }

    if (tp === 'star'){
      S.hitAll++;
      S.combo = clamp(S.combo + 1, 0, 9999);
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.score += 140;
      emit('hha:judge', { kind:'good', text:'BONUS +140' });
      burstAt(p.L || p.R, 'star');
      updateScore(); updateQuest();
      removePair(id);
      return;
    }

    if (tp === 'junk'){
      S.hitAll++;

      if (S.shield > 0){
        S.shield = Math.max(0, S.shield - 1);
        S.hitJunkGuard++;
        updateFever();
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        burstAt(p.L || p.R, 'guard');
        updateScore(); updateQuest();
        removePair(id);
        return;
      }

      S.hitJunk++;
      S.misses++;
      S.combo = 0;
      S.score = Math.max(0, S.score - 170);
      S.fever = clamp(S.fever + 12, 0, 100);
      updateFever();
      emit('hha:judge', { kind:'bad', text:'JUNK! -170' });
      burstAt(p.L || p.R, 'junk');
      updateScore(); updateQuest();
      removePair(id);
      return;
    }
  }

  // ===== spawn =====
  function randPosSingle(){
    const W = ROOT.innerWidth || 360;
    const H = ROOT.innerHeight || 640;
    const m = opts.safeMargins || { top: 128, bottom: 170, left: 26, right: 26 };
    const x = m.left + S.rng() * (W - m.left - m.right);
    const y = m.top  + S.rng() * (H - m.top  - m.bottom);
    return { x, y };
  }

  function randPosStereo(){
    const W = (ROOT.innerWidth || 360) * 0.5;
    const H = (ROOT.innerHeight || 640);
    const m = opts.safeMargins || { top: 128, bottom: 170, left: 26, right: 26 };

    // ใช้ top/bottom เป็นหลัก (hud-mid ถูกซ่อนแล้ว)
    const x = m.left + S.rng() * (W - m.left - m.right);
    const y = m.top  + S.rng() * (H - m.top  - m.bottom);
    return { x, y, W, H };
  }

  function spawnOne(){
    if (!S.running || S.ended) return;
    if (countTargets() >= S.maxTargets) return;

    const t = now();
    const inWarm = (t < S.warmupUntil);

    // type roll
    let tp = 'good';
    const r = S.rng();
    const powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
    const junkP  = inWarm ? (S.junkP * 0.55)  : S.junkP;

    if (r < powerP) tp = 'shield';
    else if (r < powerP + 0.035) tp = 'star';
    else if (r < powerP + 0.035 + junkP) tp = 'junk';
    else tp = 'good';

    const size = (inWarm ? (S.size * 1.06) : S.size);

    const id = (++S.idSeq) + '_' + Math.floor(S.rng()*1e9).toString(16);

    if (!S.stereo){
      const p = randPosSingle();
      const emoji =
        (tp === 'good') ? pick(S.rng, GOOD) :
        (tp === 'junk') ? pick(S.rng, JUNK) :
        (tp === 'shield') ? SHIELD : pick(S.rng, STARS);

      const el = makeDom(tp, emoji, p.x, p.y, size, id, 'S');
      el._ttl = setTimeout(()=>expireTargetId(id), S.ttlMs);
      layerEl.appendChild(el);
      S.pairMap.set(id, { L: el, R: null, type: tp, emoji });
      return;
    }

    // stereo: paired dom (parallax)
    const pp = randPosStereo();
    const par = clamp(pp.W * 0.06, 10, 18); // parallax px inside each eye
    const emoji =
      (tp === 'good') ? pick(S.rng, GOOD) :
      (tp === 'junk') ? pick(S.rng, JUNK) :
      (tp === 'shield') ? SHIELD : pick(S.rng, STARS);

    const xL = clamp(pp.x + par, 14, pp.W - 14);
    const xR = clamp(pp.x - par, 14, pp.W - 14);

    const elL = makeDom(tp, emoji, xL, pp.y, size, id, 'L');
    const elR = makeDom(tp, emoji, xR, pp.y, size, id, 'R');

    elL._ttl = setTimeout(()=>expireTargetId(id), S.ttlMs);
    elR._ttl = elL._ttl;

    layerElL.appendChild(elL);
    layerElR.appendChild(elR);

    S.pairMap.set(id, { L: elL, R: elR, type: tp, emoji });
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;
    spawnOne();

    const t = now();
    const inWarm = (t < S.warmupUntil);
    let nextMs = S.spawnMs;
    if (inWarm) nextMs = Math.max(980, S.spawnMs + 240);

    clearTimeout(S.spawnTimer);
    S.spawnTimer = setTimeout(loopSpawn, clamp(nextMs, 380, 1400));
  }

  function adaptiveTick(){
    if (!S.running || S.ended) return;

    S.left = Math.max(0, S.left - 0.14);
    updateTime();
    if (S.left <= 0){ endGame('time'); return; }

    if (S.runMode === 'play'){
      const elapsed = (now() - S.tStart) / 1000;
      const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0;
      const comboHeat = clamp(S.combo / 18, 0, 1);

      const timeRamp = clamp((elapsed - 3) / 10, 0, 1);
      const skill = clamp((acc - 0.65) * 1.2 + comboHeat * 0.8, 0, 1);
      const heat = clamp(timeRamp * 0.55 + skill * 0.75, 0, 1);

      S.spawnMs = clamp(base.spawnMs - heat * 320, 420, 1200);
      S.ttlMs   = clamp(base.ttlMs   - heat * 420, 1180, 2600);
      S.size    = clamp(base.size    - heat * 0.14, 0.86, 1.12);
      S.junkP   = clamp(base.junk    + heat * 0.07, 0.08, 0.25);
      S.powerP  = clamp(base.power   + heat * 0.012, 0.01, 0.06);

      const maxBonus = Math.round(heat * 4);
      S.maxTargets = clamp(base.maxT + maxBonus, 5, isMobileLike() ? 11 : 13);

      if (S.fever >= 70){
        S.junkP = clamp(S.junkP - 0.03, 0.08, 0.22);
        S.size  = clamp(S.size + 0.03, 0.86, 1.15);
      }
    } else {
      S.spawnMs = base.spawnMs;
      S.ttlMs   = base.ttlMs;
      S.size    = base.size;
      S.junkP   = base.junk;
      S.powerP  = base.power;
      S.maxTargets = base.maxT;
    }

    clearTimeout(S.tickTimer);
    S.tickTimer = setTimeout(adaptiveTick, 140);
  }

  // ยิงกลาง: single = legacy crosshair, stereo = เลือก L/R ที่ใกล้กว่า
  function shootAtCrosshair(){
    if (!S.running || S.ended) return;

    if (!S.stereo){
      const c = getCenter(crossEl);
      const r = isMobileLike() ? 62 : 52;
      const el = findTargetNear(layerEl, c.x, c.y, r);
      if (el) hitById(String(el.dataset.tid||''));
      else { if (S.combo > 0) S.combo = Math.max(0, S.combo - 1); updateScore(); }
      return;
    }

    const cL = getCenter(crossElL);
    const cR = getCenter(crossElR);
    const r = isMobileLike() ? 62 : 52;

    const tL = findTargetNear(layerElL, cL.x, cL.y, r);
    const tR = findTargetNear(layerElR, cR.x, cR.y, r);

    if (tL && !tR) return hitById(String(tL.dataset.tid||''));
    if (tR && !tL) return hitById(String(tR.dataset.tid||''));

    if (tL && tR){
      // pick closer
      const rl = tL.getBoundingClientRect();
      const rr = tR.getBoundingClientRect();
      const dl = dist2(cL.x,cL.y, rl.left+rl.width/2, rl.top+rl.height/2);
      const dr = dist2(cR.x,cR.y, rr.left+rr.width/2, rr.top+rr.height/2);
      return hitById(String((dl <= dr ? tL : tR).dataset.tid||''));
    }

    if (S.combo > 0) S.combo = Math.max(0, S.combo - 1);
    updateScore();
  }

  function bindInputs(){
    if (shootEl){
      shootEl.addEventListener('click', (e)=>{ e.preventDefault?.(); shootAtCrosshair(); });
      shootEl.addEventListener('pointerdown', (e)=>{ e.preventDefault?.(); }, { passive:false });
    }
    DOC.addEventListener('keydown', (e)=>{
      const k = String(e.key||'').toLowerCase();
      if (k === ' ' || k === 'spacebar' || k === 'enter'){ e.preventDefault?.(); shootAtCrosshair(); }
    });
    const stage = DOC.getElementById('gj-stage');
    if (stage){
      stage.addEventListener('click', ()=>{
        if (isMobileLike()) return;
        shootAtCrosshair();
      });
    }
  }

  function clearAll(){
    clearTimeout(S.spawnTimer);
    clearTimeout(S.tickTimer);
    S.pairMap.forEach((_, id)=> removePair(id));
    S.pairMap.clear();
  }

  async function endGame(reason){
    if (S.ended) return;
    S.ended = true; S.running = false;
    clearAll();

    const acc = S.hitAll > 0 ? Math.round((S.hitGood / S.hitAll) * 100) : 0;
    const summary = {
      reason: String(reason||'end'),
      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,
      accuracyGoodPct: acc|0,
      grade: rankFromAcc(acc),
      feverEnd: Math.round(S.fever)|0,
      shieldEnd: S.shield|0,
      diff: S.diff,
      runMode: S.runMode,
      seed: S.seed,
      durationPlayedSec: Math.round((now() - S.tStart)/1000)
    };

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('hha_last_summary', JSON.stringify(summary));
    }catch(_){}

    emit('hha:end', summary);
    emit('hha:celebrate', { kind:'end', title:'จบเกม!' });

    // fallback end overlay
    try{
      const host = DOC.getElementById('end-summary');
      if (host){
        host.innerHTML = '';
        host.style.position='fixed'; host.style.inset='0'; host.style.zIndex='998';
        host.style.display='flex'; host.style.alignItems='center'; host.style.justifyContent='center';
        host.style.padding='18px'; host.style.background='rgba(2,6,23,.86)';
        const card = DOC.createElement('div');
        card.style.width='min(560px,92vw)'; card.style.borderRadius='22px';
        card.style.border='1px solid rgba(148,163,184,.22)';
        card.style.background='rgba(2,6,23,.94)';
        card.style.boxShadow='0 22px 70px rgba(0,0,0,.42)';
        card.style.padding='16px';
        card.style.color='#e5e7eb';
        card.innerHTML = `
          <div style="font-size:22px;font-weight:1000">สรุปผล GoodJunkVR</div>
          <div style="margin-top:8px;color:#94a3b8;font-size:13px">เหตุผลจบ: ${summary.reason} • diff=${summary.diff} • run=${summary.runMode}</div>
          <div style="margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
            <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(15,23,42,.70);padding:10px 12px">
              <div style="font-size:12px;color:#94a3b8">Score</div><div style="font-size:18px;font-weight:1000;margin-top:2px">${summary.scoreFinal}</div>
            </div>
            <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(15,23,42,.70);padding:10px 12px">
              <div style="font-size:12px;color:#94a3b8">Grade</div><div style="font-size:18px;font-weight:1000;margin-top:2px">${summary.grade}</div>
            </div>
            <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(15,23,42,.70);padding:10px 12px">
              <div style="font-size:12px;color:#94a3b8">Accuracy</div><div style="font-size:18px;font-weight:1000;margin-top:2px">${summary.accuracyGoodPct}%</div>
            </div>
            <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(15,23,42,.70);padding:10px 12px">
              <div style="font-size:12px;color:#94a3b8">Miss</div><div style="font-size:18px;font-weight:1000;margin-top:2px">${summary.misses}</div>
            </div>
          </div>
          <div style="margin-top:14px;display:flex;gap:10px">
            <button id="btnReplay2" style="flex:1;height:52px;border-radius:18px;border:1px solid rgba(148,163,184,.22);background:rgba(34,197,94,.16);color:#fff;font-weight:1000;font-size:16px">เล่นอีกครั้ง</button>
            <button id="btnHub2" style="flex:1;height:52px;border-radius:18px;border:1px solid rgba(148,163,184,.22);background:rgba(96,165,250,.14);color:#fff;font-weight:1000;font-size:16px">กลับ HUB</button>
          </div>
        `;
        host.appendChild(card);
        const hub = qs('hub','../hub.html');
        DOC.getElementById('btnReplay2')?.addEventListener('click', ()=>{
          try{ const u = new URL(location.href); u.searchParams.set('ts', String(Date.now())); location.href = u.toString(); }catch(_){ location.reload(); }
        });
        DOC.getElementById('btnHub2')?.addEventListener('click', ()=>{
          location.href = hub;
        });
      }
    }catch(_){}
  }

  // ===== start =====
  function start(){
    S.running = true; S.ended = false;
    S.tStart = now(); S.left = timeSec;
    S.score=0; S.combo=0; S.comboMax=0;
    S.misses=0; S.hitAll=0; S.hitGood=0; S.hitJunk=0; S.hitJunkGuard=0; S.expireGood=0;
    S.fever=0; S.shield=0;
    S.goalsCleared=0; S.miniCleared=0;
    updateFever(); updateScore(); updateTime(); updateQuest();

    S.warmupUntil = now() + 3000;
    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    loopSpawn();
    adaptiveTick();
  }

  bindInputs();
  start();

  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.endGame = endGame;
    ROOT.GoodJunkVR.shoot = shootAtCrosshair;
  }catch(_){}
}