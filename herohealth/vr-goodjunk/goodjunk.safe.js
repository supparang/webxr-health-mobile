// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// Step D:
// ✅ Final Sprint HARD (last 8s): spawn faster + more junk + lock pulse each 1s
// ✅ STUN power:
//    - FEVER reaches 100 -> STUN (slow motion) + junk auto-break near aim
//    - 🧲 Magnet -> STUN field (same mechanic) + counts stunBreaks
// ✅ Fever decays (no more stuck at 100)
// ✅ Strong shake scales with fever% (and heavier while STUN)
// ✅ FX guaranteed: burst + score pop + judgment pop (fallback if Particles missing)
// ✅ End emits hha:end (summary always shows)

'use strict';

function clamp(v, min, max){
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
function now(){ return performance.now(); }

function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

/* ----------------------- FX (robust) ----------------------- */
const ROOT = (typeof window !== 'undefined') ? window : globalThis;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt(){}, scorePop(){}, floatScore(){}, toast(){}, celebrate(){} };

function ensureFxLayer(){
  let layer = document.querySelector('.gj-fx-layer');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'gj-fx-layer';
  Object.assign(layer.style, {
    position:'fixed', inset:'0', pointerEvents:'none', zIndex:'660'
  });
  document.body.appendChild(layer);
  return layer;
}
const FXL = ensureFxLayer();

function fxPop(x, y, text, kind='good'){
  // try particle module first
  try{
    if (Particles && typeof Particles.scorePop === 'function'){
      Particles.scorePop(x, y, text, kind);
      return;
    }
  }catch(_){}

  // fallback DOM pop
  const el = document.createElement('div');
  el.textContent = String(text || '');
  Object.assign(el.style, {
    position:'absolute',
    left:(x|0)+'px',
    top:(y|0)+'px',
    transform:'translate(-50%,-50%)',
    fontWeight:'950',
    fontSize:'14px',
    letterSpacing:'.04em',
    padding:'6px 10px',
    borderRadius:'999px',
    border:'1px solid rgba(148,163,184,0.25)',
    background:'rgba(15,23,42,0.86)',
    color:(kind==='bad') ? '#fdba74' : (kind==='gold' ? '#fde68a' : '#a7f3d0'),
    boxShadow:'0 18px 40px rgba(15,23,42,0.55)',
    opacity:'0'
  });
  FXL.appendChild(el);
  requestAnimationFrame(()=>{
    el.style.transition = 'transform .55s ease-out, opacity .12s ease-out';
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-80%)';
  });
  setTimeout(()=>{
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-110%)';
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 260);
  }, 420);
}

function fxBurst(x, y, kind='good'){
  try{
    if (Particles && typeof Particles.burstAt === 'function'){
      Particles.burstAt(x, y, kind);
      return;
    }
  }catch(_){}
}

/* ----------------------- DOM World Mapper ----------------------- */
const WORLD_SCALE = 2.05;
const Y_PITCH_GAIN = 0.75;
const WRAP_PAD = 140;

function wrapRad(a){
  a = Number(a) || 0;
  const TWO = Math.PI * 2;
  a = a % TWO;
  if (a < 0) a += TWO;
  return a;
}
function getLookRad(cameraEl){
  try{
    const r = cameraEl?.object3D?.rotation;
    if (r) return { yaw: wrapRad(r.y), pitch: clamp(r.x, -1.2, 1.2) };
  }catch(_){}
  return { yaw: 0, pitch: 0 };
}
function computeWorldSize(){
  const W = window.innerWidth, H = window.innerHeight;
  return { W, H, worldW: W * WORLD_SCALE, worldH: H * WORLD_SCALE };
}
function worldToScreen(wx, wy, look, sizes){
  const { W, H, worldW, worldH } = sizes;

  const vx = (look.yaw / (Math.PI * 2)) * worldW;
  const vy = (look.pitch / (Math.PI)) * worldH * Y_PITCH_GAIN;

  let x = (wx - vx) + W * 0.5;
  let y = (wy - vy) + H * 0.5;

  const minX = -WRAP_PAD, maxX = W + WRAP_PAD;
  const minY = -WRAP_PAD, maxY = H + WRAP_PAD;

  while (x < minX) x += worldW;
  while (x > maxX) x -= worldW;
  while (y < minY) y += worldH;
  while (y > maxY) y -= worldH;

  return { x, y };
}

/* ----------------------- Safe Zone (avoid HUD) ----------------------- */
function getHudRects(){
  const rects = [];
  const els = Array.from(document.querySelectorAll('.hud-card, #coach-bubble'));
  for (const el of els){
    if (!el || !el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    rects.push({ x:r.left-10, y:r.top-10, w:r.width+20, h:r.height+20 });
  }
  return rects;
}
function pointInRect(x,y,r){
  return x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h;
}
function pickScreenPointSafe(sizes, margin=18){
  const { W, H } = sizes;
  const rects = getHudRects();
  for (let i=0;i<110;i++){
    const x = margin + Math.random()*(W-2*margin);
    const y = margin + Math.random()*(H-2*margin);
    let bad = false;
    for (const r of rects){
      if (pointInRect(x,y,r)) { bad=true; break; }
    }
    if (!bad) return { x, y };
  }
  return { x: W*0.5, y: H*0.62 };
}

/* ----------------------- Difficulty presets ----------------------- */
function diffCfg(diff='normal'){
  diff = String(diff||'normal').toLowerCase();
  const base = {
    easy:   { spawnMs: 860, ttlMs: 2100, maxActive: 5, goodRatio: 0.72, scoreGood: 12, scoreGold: 28, feverGain: 10, feverLoss: 18 },
    normal: { spawnMs: 720, ttlMs: 1850, maxActive: 6, goodRatio: 0.66, scoreGood: 14, scoreGold: 32, feverGain: 11, feverLoss: 20 },
    hard:   { spawnMs: 590, ttlMs: 1600, maxActive: 7, goodRatio: 0.60, scoreGood: 16, scoreGold: 36, feverGain: 12, feverLoss: 22 }
  };
  return base[diff] || base.normal;
}

/* ----------------------- Helpers ----------------------- */
function getAimPoint(){
  const ap = window.__GJ_AIM_POINT__;
  if (ap && typeof ap.x === 'number' && typeof ap.y === 'number'){
    return { x: ap.x, y: ap.y };
  }
  return { x: window.innerWidth*0.5, y: window.innerHeight*0.62 };
}

function dist2(ax,ay,bx,by){
  const dx = ax-bx, dy = ay-by;
  return dx*dx + dy*dy;
}

function beep(freq=880, ms=70, gain=0.035){
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(()=>{ try{o.stop();}catch(_){} try{ctx.close();}catch(_){} }, ms);
  }catch(_){}
}

/* ----------------------- Engine ----------------------- */
export function boot(opts = {}){
  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  if (!layerEl){
    console.error('[GoodJunk] layerEl missing');
    return null;
  }

  const diff = String(opts.diff || 'normal').toLowerCase();
  const runMode = String(opts.run || 'play').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();
  const durationSec = clamp(opts.time ?? 60, 20, 180);

  const cameraEl = document.querySelector('#gj-camera');
  let SIZES = computeWorldSize();
  const onResize = ()=>{ SIZES = computeWorldSize(); };
  window.addEventListener('resize', onResize);

  const CFG = diffCfg(diff);

  const state = {
    diff, runMode, challenge,
    startedAt: now(),
    endAt: now() + durationSec*1000,
    running: true,

    score: 0,
    goodHits: 0,
    goldHits: 0,
    misses: 0,       // miss = good expired + junk hit (blocked doesn't count)
    combo: 0,
    comboMax: 0,

    fever: 0,        // 0..100
    shield: 0,       // charges

    // Step D
    stunActive: false,
    stunUntil: 0,
    stunReason: '',
    timeScale: 1.0,      // 1 normal, <1 slow-mo
    stunBreaks: 0,

    finalMode: false,    // last 8s
    lastTickSec: -1,
    lastFrameAt: now(),
    lastFeverGainAt: 0,

    bossCleared: false
  };

  const ACTIVE = new Set();
  let rafId = 0;
  let spawnTimer = 0;

  function setJudge(label){
    emit('hha:judge', { label: String(label||'') });
  }

  function syncHUD(extra={}){
    emit('hha:score', {
      score: state.score|0,
      goodHits: state.goodHits|0,
      misses: state.misses|0,
      comboMax: state.comboMax|0,
      challenge
    });

    emit('hha:fever', {
      fever: Math.round(state.fever),
      shield: state.shield|0,
      stunActive: !!state.stunActive,
      slow: state.timeScale
    });

    if (extra && extra.finalPulse){
      emit('hha:finalPulse', { secLeft: extra.secLeft|0 });
    }
  }

  function addFever(v){
    state.fever = clamp(state.fever + v, 0, 100);
    if (v > 0) state.lastFeverGainAt = now();

    // auto STUN when full
    if (!state.stunActive && state.fever >= 100){
      startStun('fever', 5200);
      // drain starts immediately
    }
  }

  function decayFever(dtMs){
    // don't decay immediately after gain (feels better)
    const tNow = now();
    const sinceGain = tNow - (state.lastFeverGainAt || 0);
    if (state.stunActive){
      // during STUN drain fast to guarantee it ends
      state.fever = clamp(state.fever - (dtMs/1000)*28, 0, 100);
      if (state.fever <= 1) state.fever = 0;
      return;
    }
    if (sinceGain < 900) return;
    state.fever = clamp(state.fever - (dtMs/1000)*4.6, 0, 100);
  }

  function startStun(reason, durMs){
    const tNow = now();
    state.stunActive = true;
    state.stunReason = String(reason||'stun');
    state.stunUntil = tNow + clamp(durMs||4800, 2500, 9000);

    // slow-mo factor
    state.timeScale = 0.55;

    // show effect
    setJudge('STUN!');
    fxPop(window.innerWidth*0.5, window.innerHeight*0.35, '⚡ STUN MODE!', 'gold');
    beep(960, 90, 0.04);
    syncHUD();
  }

  function stopStun(){
    state.stunActive = false;
    state.stunReason = '';
    state.timeScale = 1.0;
    // keep fever low (already drained)
    syncHUD();
  }

  function spendShield(){
    if (state.shield > 0){
      state.shield = Math.max(0, (state.shield|0) - 1);
      return true;
    }
    return false;
  }

  function mkEl(kind, emoji){
    const el = document.createElement('div');
    el.className = 'gj-target gj-sticker spawn';
    el.textContent = emoji;

    // random sticker rotation (tiny)
    const rot = ((Math.random()*10) - 5).toFixed(2);
    el.style.setProperty('--tRot', rot + 'deg');

    if (kind === 'junk') el.classList.add('gj-junk');
    if (kind === 'gold') el.classList.add('gj-gold');
    if (kind === 'fake') el.classList.add('gj-fake');
    if (kind === 'power') el.classList.add('gj-power');
    if (kind === 'boss') el.classList.add('gj-boss');

    layerEl.appendChild(el);
    // ensure fade-in
    requestAnimationFrame(()=> el.classList.add('spawn'));
    return el;
  }

  function chooseSpawnKind(secLeft){
    // Step D: final sprint makes it meaner
    let goodRatio = CFG.goodRatio;

    if (challenge === 'survival'){
      goodRatio = Math.max(0.52, goodRatio - 0.08);
    }

    // Final 8s: more junk, more power, more pressure
    if (secLeft <= 8){
      goodRatio = Math.max(0.48, goodRatio - 0.16);
      // boss chance tiny even in rush (spice)
      if (Math.random() < 0.08) return 'boss';
    }

    if (challenge === 'boss'){
      if (!state.bossCleared && Math.random() < 0.12) return 'boss';
    }

    const r = Math.random();
    if (secLeft <= 8){
      if (r < 0.12) return 'power';
      if (r < 0.22) return 'gold';
      return (Math.random() < goodRatio) ? 'good' : 'junk';
    }

    if (r < 0.08) return 'power';
    if (r < 0.14) return 'gold';
    return (Math.random() < goodRatio) ? 'good' : 'junk';
  }

  function chooseEmoji(kind){
    const GOOD = ['🥦','🥕','🍎','🍌','🥛','🍇','🍊','🥬'];
    const JUNK = ['🍟','🍔','🍕','🍩','🍰','🍿','🥤','🍗'];
    const GOLD = ['🌟','✨','🏅','💎'];
    // Step D: magnet = STUN field
    const POWER = ['🛡️','🧲','⏱️'];
    const BOSS = ['👾','😈','🦖','💀'];

    if (kind === 'good') return GOOD[(Math.random()*GOOD.length)|0];
    if (kind === 'junk') return JUNK[(Math.random()*JUNK.length)|0];
    if (kind === 'gold') return GOLD[(Math.random()*GOLD.length)|0];
    if (kind === 'power') return POWER[(Math.random()*POWER.length)|0];
    if (kind === 'boss') return BOSS[(Math.random()*BOSS.length)|0];
    return '❓';
  }

  function screenToWorldPoint(screenPt, look){
    const vx = (look.yaw / (Math.PI * 2)) * SIZES.worldW;
    const vy = (look.pitch / (Math.PI)) * SIZES.worldH * Y_PITCH_GAIN;

    const wx = (screenPt.x - SIZES.W*0.5) + vx;
    const wy = (screenPt.y - SIZES.H*0.5) + vy;
    return { wx, wy };
  }

  function spawnOne(secLeft){
    if (!state.running) return;
    if (ACTIVE.size >= CFG.maxActive) return;

    const kind = chooseSpawnKind(secLeft);
    const emoji = chooseEmoji(kind);
    const el = mkEl(kind, emoji);

    const look = getLookRad(cameraEl);
    const safePt = pickScreenPointSafe(SIZES, 18);
    const w = screenToWorldPoint(safePt, look);

    const t = {
      id: Math.random().toString(16).slice(2),
      kind,
      emoji,
      el,
      wx: w.wx,
      wy: w.wy,

      lifeMs: 0,
      ttlMs: (kind === 'boss') ? (CFG.ttlMs + 900) : CFG.ttlMs,

      dead: false,
      bossHp: (kind === 'boss') ? 3 : 1
    };

    const scale =
      (kind === 'boss') ? 1.25 :
      (kind === 'gold') ? 1.08 :
      (kind === 'power') ? 1.02 :
      1.0;

    el.style.setProperty('--tScale', String(scale));

    const s = worldToScreen(t.wx, t.wy, look, SIZES);
    el.style.left = s.x + 'px';
    el.style.top  = s.y + 'px';

    const onDown = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      const cx = (ev?.clientX ?? (ev?.touches?.[0]?.clientX)) ?? s.x;
      const cy = (ev?.clientY ?? (ev?.touches?.[0]?.clientY)) ?? s.y;
      hitTarget(t, cx, cy);
    };
    el.addEventListener('pointerdown', onDown, { passive:false });
    el.addEventListener('touchstart', onDown, { passive:false });

    ACTIVE.add(t);
  }

  function killTarget(t, gone=true){
    if (!t || t.dead) return;
    t.dead = true;
    ACTIVE.delete(t);
    const el = t.el;
    if (el && el.isConnected){
      if (gone) el.classList.add('gone');
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 120);
    }
  }

  function handleExpire(t){
    if (!t || t.dead) return;

    // MISS rule: good/gold/power/boss expired counts as miss
    if (t.kind === 'good' || t.kind === 'gold' || t.kind === 'power' || t.kind === 'boss'){
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      setJudge('MISS');
      fxPop(window.innerWidth*0.5, window.innerHeight*0.22, 'MISS', 'bad');
      syncHUD();
    }
    killTarget(t, true);
  }

  function scoreHit(x,y,pts,label,kind){
    fxBurst(x,y,kind);
    fxPop(x,y,`${label} +${pts}`, kind);
  }

  function hitTarget(t, x, y){
    if (!t || t.dead || !state.running) return;

    // boss multi-hit
    if (t.kind === 'boss'){
      t.bossHp = (t.bossHp|0) - 1;

      if (t.bossHp > 0){
        setJudge('HIT!');
        emit('quest:goodHit', { x, y, judgment:'good', kind:'boss' });
        state.score += (CFG.scoreGood|0);
        state.goodHits++;
        state.combo++;
        state.comboMax = Math.max(state.comboMax, state.combo);
        addFever(+CFG.feverGain);
        scoreHit(x,y,CFG.scoreGood,'HIT', 'gold');
        syncHUD();
        return;
      }

      // boss cleared
      state.bossCleared = true;
      setJudge('BOSS!');
      emit('quest:bossClear', {});
      emit('quest:goodHit', { x, y, judgment:'perfect', kind:'boss' });

      state.score += 90;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+18);

      scoreHit(x,y,90,'BOSS', 'gold');
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'junk'){
      if (spendShield()){
        setJudge('BLOCK');
        emit('quest:block', { x, y });
        scoreHit(x,y,2,'BLOCK','gold');
        syncHUD();
        killTarget(t, true);
        return;
      }

      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      setJudge('JUNK!');
      emit('quest:badHit', { x, y, judgment:'junk' });
      scoreHit(x,y,0,'JUNK','bad');
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'power'){
      // decide power by emoji
      let p = 'shield';
      if (t.emoji === '🧲') p = 'magnet';
      if (t.emoji === '⏱️') p = 'time';

      if (p === 'shield'){
        state.shield = clamp((state.shield|0) + 1, 0, 9);
        setJudge('SHIELD!');
        emit('quest:power', { x, y, power: 'shield' });
        state.score += 10;
        state.goodHits++;
        state.combo++;
        state.comboMax = Math.max(state.comboMax, state.combo);
        addFever(+6);
        scoreHit(x,y,10,'SHIELD','good');
        syncHUD();
        killTarget(t, true);
        return;
      }

      if (p === 'time'){
        state.endAt = state.endAt + 2500;
        setJudge('TIME+');
        emit('quest:power', { x, y, power: 'time' });
        state.score += 12;
        state.goodHits++;
        state.combo++;
        state.comboMax = Math.max(state.comboMax, state.combo);
        addFever(+6);
        scoreHit(x,y,12,'TIME+','good');
        syncHUD();
        killTarget(t, true);
        return;
      }

      // Step D: Magnet -> STUN field (center is aim point)
      if (p === 'magnet'){
        emit('quest:power', { x, y, power: 'magnet' });
        startStun('magnet', 4200);
        state.score += 14;
        state.goodHits++;
        state.combo++;
        state.comboMax = Math.max(state.comboMax, state.combo);
        addFever(+8);
        scoreHit(x,y,14,'MAGNET','gold');
        syncHUD();
        killTarget(t, true);
        return;
      }
    }

    if (t.kind === 'gold'){
      setJudge('GOLD!');
      emit('quest:gold', { x, y });
      emit('quest:goodHit', { x, y, judgment:'perfect', kind:'gold' });

      state.score += (CFG.scoreGold|0);
      state.goldHits++;
      state.goodHits++;
      state.combo += 2;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+14);

      scoreHit(x,y,CFG.scoreGold,'GOLD','gold');
      syncHUD();
      killTarget(t, true);
      return;
    }

    // normal good
    {
      const perfect = (Math.random() < 0.20);
      const pts = (CFG.scoreGood|0) + (perfect ? 6 : 0);

      setJudge(perfect ? 'PERFECT!' : 'GOOD!');
      emit('quest:goodHit', { x, y, judgment: perfect ? 'perfect' : 'good', kind:'good' });

      state.score += pts;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+CFG.feverGain + (perfect ? 3 : 0));

      scoreHit(x,y,pts, perfect ? 'PERFECT' : 'GOOD', perfect ? 'gold' : 'good');
      syncHUD();
      killTarget(t, true);
    }
  }

  function currentSpawnDelayMs(secLeft){
    // Base + slow motion scale
    let base = CFG.spawnMs;

    // Final Sprint: spawn faster (more pressure)
    if (secLeft <= 8){
      base = Math.max(240, base * 0.62);
    }

    // STUN slow-mo: everything slower => interval longer in real time
    return Math.max(120, base / Math.max(0.45, state.timeScale));
  }

  function scheduleSpawn(){
    if (!state.running) return;
    clearTimeout(spawnTimer);

    const secLeft = Math.max(0, Math.ceil((state.endAt - now())/1000));
    const delay = currentSpawnDelayMs(secLeft);

    spawnTimer = setTimeout(()=>{
      if (!state.running) return;
      spawnOne(secLeft);
      scheduleSpawn();
    }, delay);
  }

  function applyShake(feverPct, dtMs){
    // heavy shake scales with fever%, even heavier in STUN and final sprint
    const layer = layerEl;
    if (!layer) return;

    const k = Math.max(0, Math.min(1, feverPct/100));
    const stunBoost = state.stunActive ? 1.55 : 1.0;
    const finalBoost = state.finalMode ? 1.25 : 1.0;
    const amp = (2 + 14*k) * stunBoost * finalBoost;

    // small random jitter
    const dx = ((Math.random()*2)-1) * amp;
    const dy = ((Math.random()*2)-1) * amp;
    const rot = ((Math.random()*2)-1) * (0.35 + 1.15*k) * stunBoost;

    // layer shake
    layer.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;

    // also shake border if present (user asked)
    const border = document.getElementById('stun-border');
    if (border && border.classList.contains('show')){
      border.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    }

    // recover if calm
    if (!state.stunActive && !state.finalMode && k < 0.12){
      layer.style.transform = '';
      if (border) border.style.transform = '';
    }
  }

  function updateTargetsFollowLook(){
    if (!state.running) return;

    const tNow = now();
    const dt = Math.max(1, tNow - (state.lastFrameAt || tNow));
    state.lastFrameAt = tNow;

    // fever decay (fix "เต็มแล้วไม่ลด")
    decayFever(dt);

    // time tick
    const secLeft = Math.max(0, Math.ceil((state.endAt - tNow)/1000));
    if (secLeft !== state.lastTickSec){
      // Step D: Final lock pulse each 1s in last 8s
      if (secLeft <= 8 && secLeft > 0){
        emit('hha:finalPulse', { secLeft });
        beep(840, 55, 0.03);
      }
      state.lastTickSec = secLeft;
      emit('hha:time', { sec: secLeft });
    }

    // Final mode toggle
    state.finalMode = (secLeft <= 8);

    // STUN timeout
    if (state.stunActive && tNow >= state.stunUntil){
      stopStun();
    }

    // apply shake based on fever%
    applyShake(state.fever, dt);

    // end game
    if (tNow >= state.endAt){
      state.running = false;
      emit('hha:time', { sec: 0 });
      syncHUD();

      // clear targets
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();

      // restore transform
      try{ layerEl.style.transform = ''; }catch(_){}
      try{
        const border = document.getElementById('stun-border');
        if (border) border.style.transform = '';
      }catch(_){}

      // ✅ IMPORTANT: emit end (summary guaranteed)
      emit('hha:end', {
        diff: state.diff,
        challenge: state.challenge,
        runMode: state.runMode,
        durationSec: durationSec|0,
        score: state.score|0,
        goodHits: state.goodHits|0,
        misses: state.misses|0,
        comboMax: state.comboMax|0
      });

      return;
    }

    const look = getLookRad(cameraEl);
    const aim = getAimPoint();
    const stunRadius = 120;               // feel radius
    const stunR2 = stunRadius * stunRadius;

    // move all targets
    for (const t of Array.from(ACTIVE)){
      if (!t || t.dead || !t.el || !t.el.isConnected) continue;

      // timeScale affects ttl progression
      t.lifeMs += dt * (state.timeScale || 1);

      // expire
      if (t.lifeMs >= t.ttlMs){
        handleExpire(t);
        continue;
      }

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      t.el.style.left = s.x + 'px';
      t.el.style.top  = s.y + 'px';

      // Step D: STUN auto-break junk when near aim point
      if (state.stunActive && t.kind === 'junk'){
        if (dist2(s.x, s.y, aim.x, aim.y) <= stunR2){
          // shatter junk without miss
          state.stunBreaks = (state.stunBreaks|0) + 1;
          emit('quest:stunBreak', { x: s.x, y: s.y });
          fxBurst(s.x, s.y, 'gold');
          fxPop(s.x, s.y, 'SHATTER', 'gold');
          killTarget(t, true);
        }
      }
    }

    // keep HUD in sync (fever drift + stun state)
    syncHUD();

    rafId = requestAnimationFrame(updateTargetsFollowLook);
  }

  // init
  emit('hha:time', { sec: durationSec });
  syncHUD();
  setJudge(' ');

  scheduleSpawn();
  rafId = requestAnimationFrame(updateTargetsFollowLook);

  const api = {
    stop(){
      state.running = false;
      try{ clearTimeout(spawnTimer); }catch(_){}
      try{ cancelAnimationFrame(rafId); }catch(_){}
      try{ window.removeEventListener('resize', onResize); }catch(_){}
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
    },
    getState(){ return { ...state, active: ACTIVE.size }; }
  };

  return api;
}