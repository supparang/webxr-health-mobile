// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — DOM Emoji Engine (PRODUCTION)
// ✅ Targets behave like VR: world-space + follow camera yaw/pitch
// ✅ Clamp safe zone: avoid overlapping HUD/cards
// ✅ FX: burst + score pop + judge
// ✅ Fever decay + STUN (slow + junk auto-break near aim point)
// ✅ Emit hha:end for summary

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

// ---- FX bridge (Particles.js IIFE) ----
const Particles =
  (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
  window.Particles ||
  {
    burstAt(){},
    scorePop(){},
    judge(){},
    celebrate(){}
  };

function fxBurst(x, y, kind){
  try{ Particles.burstAt && Particles.burstAt(x, y, { kind }); }catch(_){}
}
function fxScore(x, y, text, kind){
  try{ Particles.scorePop && Particles.scorePop(x, y, text, kind); }catch(_){}
}
function fxJudge(text, kind){
  try{ Particles.judge && Particles.judge(text, kind); }catch(_){}
}

// ----------------------- DOM World Mapper -----------------------
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

// ----------------------- Safe Zone (avoid HUD) -----------------------
function getHudRects(){
  const rects = [];
  const els = Array.from(document.querySelectorAll('.hud-card, #coach-bubble'));
  for (const el of els){
    if (!el || !el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    rects.push({ x:r.left-8, y:r.top-8, w:r.width+16, h:r.height+16 });
  }
  return rects;
}
function pointInRect(x,y,r){
  return x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h;
}
function pickScreenPointSafe(sizes, margin=18){
  const { W, H } = sizes;
  const rects = getHudRects();
  for (let i=0;i<90;i++){
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

// ----------------------- Difficulty presets -----------------------
function diffCfg(diff='normal'){
  diff = String(diff||'normal').toLowerCase();
  const base = {
    easy:   { spawnMs: 860, ttlMs: 2100, maxActive: 5, goodRatio: 0.72, scoreGood: 12, scoreGold: 28, feverGain: 10, feverLoss: 18 },
    normal: { spawnMs: 720, ttlMs: 1850, maxActive: 6, goodRatio: 0.66, scoreGood: 14, scoreGold: 32, feverGain: 11, feverLoss: 20 },
    hard:   { spawnMs: 590, ttlMs: 1600, maxActive: 7, goodRatio: 0.60, scoreGood: 16, scoreGold: 36, feverGain: 12, feverLoss: 22 }
  };
  return base[diff] || base.normal;
}

// ----------------------- Engine -----------------------
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

    bossCleared: false,

    // stun
    stunActive: false,
    stunUntil: 0,

    // time step
    lastFrameAt: now(),
    lastTickSec: -1,

    // spawning accumulator
    spawnAcc: 0
  };

  const ACTIVE = new Set();
  let rafId = 0;

  function setJudge(label){
    emit('hha:judge', { label: String(label||'') });
  }

  // emit hha:score + hha:fever
  function syncHUD(){
    emit('hha:score', {
      score: state.score|0,
      goodHits: state.goodHits|0,
      misses: state.misses|0,
      comboMax: state.comboMax|0,
      challenge
    });

    emit('hha:fever', {
      fever: state.fever|0,
      shield: state.shield|0,
      active: state.fever >= 100,
      stunActive: !!state.stunActive
    });
  }

  function addFever(v){
    state.fever = clamp(state.fever + v, 0, 100);
    if (state.fever >= 100 && !state.stunActive){
      startStun(4200, 'fever');
    }
  }

  function startStun(ms=3500, source='magnet'){
    state.stunActive = true;
    state.stunUntil = now() + ms;
    // ขึ้นข้อความแรง ๆ
    setJudge('STUN!');
    fxJudge('STUN!', 'stun');
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
    el.className = 'gj-target';
    el.textContent = emoji;

    // small random tilt (sticker vibe)
    const rot = (Math.random()*10 - 5).toFixed(1) + 'deg';
    el.style.setProperty('--tRot', rot);

    if (kind === 'junk') el.classList.add('gj-junk');
    if (kind === 'gold') el.classList.add('gj-gold');
    if (kind === 'power') el.classList.add('gj-power');
    if (kind === 'boss') el.classList.add('gj-boss');

    layerEl.appendChild(el);
    // fade-in next frame
    requestAnimationFrame(()=> el.classList.add('in'));
    return el;
  }

  function chooseSpawnKind(){
    let goodRatio = CFG.goodRatio;

    if (challenge === 'survival'){
      goodRatio = Math.max(0.52, goodRatio - 0.08);
    }
    if (challenge === 'boss'){
      if (!state.bossCleared && Math.random() < 0.10) return 'boss';
    }

    const r = Math.random();
    if (r < 0.08) return 'power';
    if (r < 0.14) return 'gold';

    return (Math.random() < goodRatio) ? 'good' : 'junk';
  }

  function chooseEmoji(kind){
    const GOOD = ['🥦','🥕','🍎','🍌','🥛','🍇','🍊','🥬'];
    const JUNK = ['🍟','🍔','🍕','🍩','🍰','🍿','🥤','🍗'];
    const GOLD = ['🌟','✨','🏅','💎'];
    // ✅ magnet = STUN power, time, shield
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

  function spawnOne(){
    if (!state.running) return;
    if (ACTIVE.size >= CFG.maxActive) return;

    const kind = chooseSpawnKind();
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
      ageMs: 0,
      ttlMs: (kind === 'boss') ? (CFG.ttlMs + 900) : CFG.ttlMs,
      dead: false,
      bossHp: (kind === 'boss') ? 3 : 1
    };

    const scale =
      (kind === 'boss') ? 1.25 :
      (kind === 'gold') ? 1.05 :
      1.0;

    el.style.setProperty('--tScale', String(scale));

    const s = worldToScreen(t.wx, t.wy, look, SIZES);
    el.style.left = s.x + 'px';
    el.style.top  = s.y + 'px';

    const onDown = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      const x = (ev?.clientX ?? (ev?.touches?.[0]?.clientX)) ?? s.x;
      const y = (ev?.clientY ?? (ev?.touches?.[0]?.clientY)) ?? s.y;
      hitTarget(t, x, y);
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

  function handleExpire(t, screenX, screenY){
    if (!t || t.dead) return;

    // miss rule: good/gold/power/boss expired => miss
    if (t.kind === 'good' || t.kind === 'gold' || t.kind === 'power' || t.kind === 'boss'){
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      setJudge('MISS');
      fxJudge('MISS', 'miss');
      fxBurst(screenX, screenY, 'miss');
      syncHUD();
    }
    killTarget(t, true);
  }

  function hitTarget(t, x, y){
    if (!t || t.dead || !state.running) return;

    // Boss multi-hit
    if (t.kind === 'boss'){
      t.bossHp = (t.bossHp|0) - 1;
      fxBurst(x, y, 'boss');
      if (t.bossHp > 0){
        setJudge('HIT!');
        emit('quest:goodHit', { x, y, judgment:'good' });
        state.score += (CFG.scoreGood|0);
        state.goodHits++;
        state.combo++;
        state.comboMax = Math.max(state.comboMax, state.combo);
        addFever(+CFG.feverGain);
        fxScore(x, y, `+${CFG.scoreGood|0}`, 'good');
        syncHUD();
        return;
      }
      state.bossCleared = true;
      setJudge('BOSS!');
      emit('quest:bossClear', {});
      emit('quest:goodHit', { x, y, judgment:'perfect' });
      state.score += 90;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+18);
      fxScore(x, y, '+90', 'boss');
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'junk'){
      if (spendShield()){
        setJudge('BLOCK');
        emit('quest:block', { x, y });
        fxBurst(x, y, 'block');
        fxScore(x, y, 'BLOCK', 'block');
        syncHUD();
        killTarget(t, true);
        return;
      }

      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      setJudge('JUNK!');
      emit('quest:badHit', { x, y, judgment:'junk' });
      fxBurst(x, y, 'junk');
      fxScore(x, y, 'JUNK', 'junk');
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'power'){
      // ✅ magnet => STUN power (ไม่ดูดเฉพาะดีแล้ว)
      let p = 'shield';
      if (t.emoji === '🧲') p = 'magnet';
      if (t.emoji === '⏱️') p = 'time';

      if (p === 'shield'){
        state.shield = clamp((state.shield|0) + 1, 0, 9);
      }
      if (p === 'time'){
        state.endAt = state.endAt + 2500;
      }
      if (p === 'magnet'){
        startStun(3500, 'magnet');
      }

      setJudge(String(p).toUpperCase());
      emit('quest:power', { x, y, power: p });
      state.score += 18;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+8);

      fxBurst(x, y, p);
      fxScore(x, y, '+18', 'power');
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'gold'){
      setJudge('GOLD!');
      // ✅ FIX: ให้ mini m2 ผ่านจริง
      emit('quest:power', { x, y, power:'gold' });
      emit('quest:goodHit', { x, y, judgment:'perfect' });

      state.score += (CFG.scoreGold|0);
      state.goldHits++;
      state.goodHits++;
      state.combo += 2;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+14);

      fxBurst(x, y, 'gold');
      fxScore(x, y, `+${CFG.scoreGold|0}`, 'gold');
      syncHUD();
      killTarget(t, true);
      return;
    }

    // normal good
    const perfect = (Math.random() < 0.20);
    setJudge(perfect ? 'PERFECT!' : 'GOOD!');
    emit('quest:goodHit', { x, y, judgment: perfect ? 'perfect' : 'good' });

    const add = (CFG.scoreGood|0) + (perfect ? 6 : 0);
    state.score += add;
    state.goodHits++;
    state.combo++;
    state.comboMax = Math.max(state.comboMax, state.combo);

    addFever(+CFG.feverGain + (perfect ? 3 : 0));
    fxBurst(x, y, perfect ? 'perfect' : 'good');
    fxScore(x, y, `+${add}`, perfect ? 'perfect' : 'good');
    syncHUD();
    killTarget(t, true);
  }

  function getAimPoint(){
    const ap = window.__GJ_AIM_POINT__;
    if (ap && typeof ap.x === 'number' && typeof ap.y === 'number'){
      return { x: ap.x, y: ap.y };
    }
    return { x: SIZES.W*0.5, y: SIZES.H*0.62 };
  }

  function applyShake(feverPct){
    // shake only scene + target layer (HUD stays readable)
    const scene = document.querySelector('a-scene');
    const amp = Math.max(0, Math.min(1, feverPct/100));
    if (!scene) return;

    // stronger curve near high fever
    const k = amp*amp;
    const t = now()*0.02;
    const dx = (Math.sin(t*1.7) * 6 + Math.sin(t*3.1) * 3) * k;
    const dy = (Math.cos(t*1.5) * 6 + Math.cos(t*2.7) * 3) * k;
    const rot = (Math.sin(t*1.2) * 0.8) * k;

    scene.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    layerEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
  }

  function endGame(){
    if (!state.running) return;
    state.running = false;

    // cleanup targets
    for (const t of Array.from(ACTIVE)) killTarget(t, false);
    ACTIVE.clear();

    // reset transforms
    const scene = document.querySelector('a-scene');
    if (scene) scene.style.transform = '';
    layerEl.style.transform = '';

    syncHUD();

    // ✅ Emit end for summary
    emit('hha:end', {
      mode: 'GoodJunkVR',
      diff,
      runMode,
      challenge,
      score: state.score|0,
      goodHits: state.goodHits|0,
      misses: state.misses|0,
      comboMax: state.comboMax|0
    });

    try{ Particles.celebrate && Particles.celebrate('END'); }catch(_){}
  }

  function updateLoop(){
    if (!state.running) return;

    const tNow = now();
    const dt = Math.max(0, tNow - state.lastFrameAt);
    state.lastFrameAt = tNow;

    // time left tick
    const secLeft = Math.max(0, Math.ceil((state.endAt - tNow)/1000));
    if (secLeft !== state.lastTickSec){
      state.lastTickSec = secLeft;
      emit('hha:time', { sec: secLeft });
    }

    // end
    if (tNow >= state.endAt){
      emit('hha:time', { sec: 0 });
      endGame();
      return;
    }

    // ---- STUN state + fever decay ----
    const inStun = state.stunActive && (tNow < state.stunUntil);
    if (state.stunActive && !inStun){
      state.stunActive = false;
    }

    // fever decay (มีลดจริง)
    const decayBase = 3.2;             // per sec
    const decayStun = 16.0;            // per sec during stun
    const decay = (inStun ? decayStun : decayBase) * (dt/1000);
    state.fever = clamp(state.fever - decay, 0, 100);

    // slow during stun
    const timeScale = inStun ? 0.55 : 1.0;

    // shake scaling with fever%
    applyShake(state.fever);

    // spawn using accumulator (respect timescale)
    state.spawnAcc += dt;
    const spawnMs = (CFG.spawnMs / timeScale);
    while (state.spawnAcc >= spawnMs){
      state.spawnAcc -= spawnMs;
      spawnOne();
    }

    // STUN: junk breaks near aim point
    const aim = getAimPoint();
    const stunRadius = 120;

    // update all targets
    const look = getLookRad(cameraEl);

    for (const t of Array.from(ACTIVE)){
      if (!t || t.dead || !t.el || !t.el.isConnected) continue;

      // progress TTL using timescale (slow in stun)
      t.ageMs += dt * timeScale;

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      t.el.style.left = s.x + 'px';
      t.el.style.top  = s.y + 'px';

      // STUN auto-break junk near aim point
      if (inStun && t.kind === 'junk'){
        const dx = s.x - aim.x, dy = s.y - aim.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= stunRadius){
          // junk แตกเอง ไม่เป็น miss
          fxBurst(s.x, s.y, 'stun');
          fxScore(s.x, s.y, '💥', 'stun');
          killTarget(t, true);
          continue;
        }
      }

      // expire
      if (t.ageMs >= t.ttlMs){
        handleExpire(t, s.x, s.y);
        continue;
      }
    }

    // sync fever/stun to HUD occasionally
    syncHUD();

    rafId = requestAnimationFrame(updateLoop);
  }

  // init
  emit('hha:time', { sec: durationSec });
  syncHUD();
  setJudge(' ');

  rafId = requestAnimationFrame(updateLoop);

  return {
    stop(){
      state.running = false;
      try{ cancelAnimationFrame(rafId); }catch(_){}
      try{ window.removeEventListener('resize', onResize); }catch(_){}
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
      const scene = document.querySelector('a-scene');
      if (scene) scene.style.transform = '';
      layerEl.style.transform = '';
    },
    getState(){ return { ...state, active: ACTIVE.size }; }
  };
}