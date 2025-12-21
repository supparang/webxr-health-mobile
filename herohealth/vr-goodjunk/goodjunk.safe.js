// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — DOM Emoji Engine (PRODUCTION)
// ✅ Targets are DOM but behave like VR: world-space + follow camera yaw/pitch
// ✅ Clamp safe zone: avoid overlapping HUD/cards
// ✅ Sticker emoji targets + fade-in/out
// ✅ Fever rises & decays; at 100 => STUN (slow game + junk shatter near aim point)
// ✅ Emits:
//    - hha:time {sec}
//    - hha:score {score, goodHits, misses, comboMax, challenge}
//    - hha:judge {label}
//    - hha:fever {fever, shield, stunActive}
//    - hha:end {score, goodHits, misses, comboMax}
//    - quest:goodHit / quest:badHit / quest:block / quest:power / quest:bossClear
//    - quest:miniStart (optional from director)
// MISS rule (GoodJunk): miss = good expired + junk hit (if shield blocks → NOT miss)

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

/* ----------------------- DOM World Mapper ----------------------- */
const WORLD_SCALE = 2.10;     // feel like VR
const Y_PITCH_GAIN = 0.78;    // vertical gain
const WRAP_PAD = 150;         // edge wrap pad

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
    easy:   { spawnMs: 860, ttlMs: 2200, maxActive: 5, goodRatio: 0.72, scoreGood: 12, scoreGold: 28, feverGain: 10, feverLoss: 18 },
    normal: { spawnMs: 720, ttlMs: 1900, maxActive: 6, goodRatio: 0.66, scoreGood: 14, scoreGold: 32, feverGain: 11, feverLoss: 20 },
    hard:   { spawnMs: 590, ttlMs: 1650, maxActive: 7, goodRatio: 0.60, scoreGood: 16, scoreGold: 36, feverGain: 12, feverLoss: 22 }
  };
  return base[diff] || base.normal;
}

/* ----------------------- Particles (optional) ----------------------- */
function getParticles(){
  return (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
}
function fxBurst(x,y,good=true,count=14){
  const P = getParticles(); if (!P || !P.burstAt) return;
  try{ P.burstAt(x, y, { count, good: !!good }); }catch(_){}
}
function fxPop(x,y,label){
  const P = getParticles(); if (!P || !P.scorePop) return;
  try{ P.scorePop(x, y, '', String(label||''), { plain:true }); }catch(_){}
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

    // STUN mode
    stunActive: false,
    stunUntil: 0,

    // magnet (pull ONLY good)
    magnetUntil: 0,

    bossCleared: false,

    // internal
    lastTickSec: -1,
    lastFeverDecayAt: now(),
    lastShakeAt: now()
  };

  const ACTIVE = new Set();
  let rafId = 0;
  let spawnTimer = 0;

  function setJudge(label){
    emit('hha:judge', { label: String(label||'') });
  }

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
      stunActive: !!state.stunActive
    });
  }

  // ✅ Shake intensity based on fever% (stronger)
  function applyShake(){
    const f = clamp(state.fever, 0, 100) / 100;
    const base = state.stunActive ? 10 : 5; // px
    const amp = base * (0.2 + f * 0.95);

    const t = now() * 0.001;
    const sx = (Math.sin(t*19.0) + Math.sin(t*31.0)*0.6) * amp * 0.55;
    const sy = (Math.cos(t*23.0) + Math.cos(t*37.0)*0.6) * amp * 0.55;

    document.documentElement.style.setProperty('--shake-x', sx.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--shake-y', sy.toFixed(2) + 'px');
  }

  function addFever(v){
    state.fever = clamp(state.fever + v, 0, 100);
    if (state.fever >= 100 && !state.stunActive){
      startStun();
    }
  }

  function decayFever(){
    const t = now();
    const dt = Math.max(0, t - state.lastFeverDecayAt);
    if (dt < 220) return;

    // decay per second: normal = 4/s, stun = 10/s
    const perSec = state.stunActive ? 10 : 4;
    const dec = (dt/1000) * perSec;

    state.fever = clamp(state.fever - dec, 0, 100);
    state.lastFeverDecayAt = t;

    // end stun early if fever drops below 40 or time reached
    if (state.stunActive && (t >= state.stunUntil || state.fever <= 40)){
      state.stunActive = false;
      state.stunUntil = 0;
    }
  }

  function startStun(){
    state.stunActive = true;
    state.stunUntil = now() + 6000; // 6s stun window
    setJudge('STUN!');
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
    el.className = 'gj-target in';
    el.textContent = emoji;

    if (kind === 'junk') el.classList.add('gj-junk');
    if (kind === 'gold') el.classList.add('gj-gold');
    if (kind === 'fake') el.classList.add('gj-fake');
    if (kind === 'power') el.classList.add('gj-power');
    if (kind === 'boss') el.classList.add('gj-boss');

    layerEl.appendChild(el);
    // fade-in
    requestAnimationFrame(()=>{ try{ el.classList.remove('in'); }catch(_){} });
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

    // power/gold occasionally
    const r = Math.random();
    if (r < 0.08) return 'power';
    if (r < 0.14) return 'gold';

    return (Math.random() < goodRatio) ? 'good' : 'junk';
  }

  function chooseEmoji(kind){
    const GOOD = ['🥦','🥕','🍎','🍌','🥛','🍇','🍊','🥬'];
    const JUNK = ['🍟','🍔','🍕','🍩','🍰','🍿','🥤','🍗'];
    const GOLD = ['🌟','✨','🏅','💎'];
    const POWER = ['🛡️','🧲','⏱️']; // shield / magnet / time
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

    // slow game while stun
    const slow = state.stunActive ? 0.55 : 1.0;

    if (ACTIVE.size >= Math.round(CFG.maxActive * (state.stunActive ? 0.8 : 1.0))) return;

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
      bornAt: now(),
      ttlMs: (kind === 'boss') ? (CFG.ttlMs + 900) : CFG.ttlMs,
      dead: false,
      bossHp: (kind === 'boss') ? 3 : 1
    };

    // scale tuning
    const scale =
      (kind === 'boss') ? 1.25 :
      (kind === 'gold') ? 1.05 :
      (kind === 'power') ? 1.0 :
      1.0;

    el.style.setProperty('--tScale', String(scale));

    // initial render
    const s = worldToScreen(t.wx, t.wy, look, SIZES);
    el.style.left = s.x + 'px';
    el.style.top  = s.y + 'px';

    // click/tap
    const onDown = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();

      const x = (ev?.clientX ?? (ev?.touches?.[0]?.clientX)) ?? s.x;
      const y = (ev?.clientY ?? (ev?.touches?.[0]?.clientY)) ?? s.y;
      hitTarget(t, x, y);
    };
    el.addEventListener('pointerdown', onDown, { passive:false });

    // stun slow: slightly longer ttl
    if (state.stunActive) t.ttlMs = t.ttlMs / slow;

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

    // MISS rule: good/gold/power/boss expired counts as miss (junk expiry does nothing)
    if (t.kind === 'good' || t.kind === 'gold' || t.kind === 'power' || t.kind === 'boss'){
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      setJudge('MISS');
      syncHUD();
    }
    killTarget(t, true);
  }

  // ✅ STUN: junk breaks itself near aim point center
  function stunAutoShatter(){
    if (!state.stunActive) return;
    const ap = window.__GJ_AIM_POINT__;
    if (!ap) return;

    const look = getLookRad(cameraEl);
    const R = 120; // radius px
    const tNow = now();

    for (const t of ACTIVE){
      if (!t || t.dead) continue;
      if (t.kind !== 'junk') continue;

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      const dx = s.x - ap.x;
      const dy = s.y - ap.y;
      const d2 = dx*dx + dy*dy;

      if (d2 <= R*R){
        // smash without miss
        state.score += 6;
        fxBurst(s.x, s.y, true, 10);
        fxPop(s.x, s.y, 'SMASH!');
        killTarget(t, true);
      }

      // safety: if stun ends mid-loop
      if (!state.stunActive && tNow > state.stunUntil) break;
    }
  }

  // ✅ Magnet: pull ONLY good toward aim point
  function magnetPullGoods(){
    const tNow = now();
    if (tNow > state.magnetUntil) return;

    const ap = window.__GJ_AIM_POINT__;
    if (!ap) return;

    const look = getLookRad(cameraEl);

    for (const t of ACTIVE){
      if (!t || t.dead) continue;
      if (t.kind !== 'good' && t.kind !== 'gold' && t.kind !== 'power') continue;

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      const dx = ap.x - s.x;
      const dy = ap.y - s.y;

      // move world position slightly toward aim
      t.wx += dx * 0.05;
      t.wy += dy * 0.05;
    }
  }

  function hitTarget(t, x, y){
    if (!t || t.dead || !state.running) return;

    // boss: multi hit
    if (t.kind === 'boss'){
      t.bossHp = (t.bossHp|0) - 1;
      if (t.bossHp > 0){
        setJudge('HIT!');
        emit('quest:goodHit', { x, y, judgment:'good' });
        state.score += (CFG.scoreGood|0);
        state.goodHits++;
        state.combo++;
        state.comboMax = Math.max(state.comboMax, state.combo);
        addFever(+CFG.feverGain);
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
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'junk'){
      // shield block?
      if (spendShield()){
        setJudge('BLOCK');
        emit('quest:block', { x, y });
        syncHUD();
        killTarget(t, true);
        return;
      }

      // junk hit = miss
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      setJudge('JUNK!');
      emit('quest:badHit', { x, y, judgment:'junk' });
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'power'){
      // decide power
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
        // 4 seconds pull-only-good
        state.magnetUntil = now() + 4000;
      }

      setJudge(String(p).toUpperCase());
      emit('quest:power', { x, y, power: p });
      state.score += 18;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+8);
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'gold'){
      setJudge('GOLD!');
      // ✅ important: tag kind='gold' so boot can set goldHitsThisMini
      emit('quest:goodHit', { x, y, judgment:'perfect', kind:'gold' });
      // also emit quest:power 'gold' as extra compatibility
      emit('quest:power', { x, y, power:'gold' });

      state.score += (CFG.scoreGold|0);
      state.goldHits++;
      state.goodHits++;
      state.combo += 2;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+14);
      syncHUD();
      killTarget(t, true);
      return;
    }

    // normal good
    {
      const perfect = (Math.random() < 0.20);
      setJudge(perfect ? 'PERFECT!' : 'GOOD!');
      emit('quest:goodHit', { x, y, judgment: perfect ? 'perfect' : 'good' });

      state.score += (CFG.scoreGood|0) + (perfect ? 6 : 0);
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);

      addFever(+CFG.feverGain + (perfect ? 3 : 0));
      syncHUD();
      killTarget(t, true);
    }
  }

  function updateTargetsFollowLook(){
    if (!state.running) return;

    const look = getLookRad(cameraEl);
    const tNow = now();

    // fever decay + shake
    decayFever();
    applyShake();

    // time tick
    const secLeft = Math.max(0, Math.ceil((state.endAt - tNow)/1000));
    if (secLeft !== state.lastTickSec){
      state.lastTickSec = secLeft;
      emit('hha:time', { sec: secLeft });
    }

    // end
    if (tNow >= state.endAt){
      state.running = false;
      emit('hha:time', { sec: 0 });
      syncHUD();

      // cleanup
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();

      // ✅ end summary event
      emit('hha:end', {
        score: state.score|0,
        goodHits: state.goodHits|0,
        misses: state.misses|0,
        comboMax: state.comboMax|0,
        diff,
        challenge,
        runMode
      });

      return;
    }

    // STUN smash + magnet pull
    stunAutoShatter();
    magnetPullGoods();

    // move all targets
    for (const t of ACTIVE){
      if (!t || t.dead || !t.el || !t.el.isConnected) continue;

      // expire
      if ((tNow - t.bornAt) >= t.ttlMs){
        handleExpire(t);
        continue;
      }

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      t.el.style.left = s.x + 'px';
      t.el.style.top  = s.y + 'px';
    }

    rafId = requestAnimationFrame(updateTargetsFollowLook);
  }

  function startSpawning(){
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(()=>{
      if (!state.running) return;

      // slow spawn when stun
      const slow = state.stunActive ? 1.75 : 1.0;

      // probabilistic spawn to mimic slowed world
      if (state.stunActive && Math.random() < 0.45) return;

      spawnOne();

      // optional small extra pop of good during magnet
      if (now() < state.magnetUntil && Math.random() < 0.28){
        spawnOne();
      }
    }, CFG.spawnMs);
  }

  // init
  emit('hha:time', { sec: durationSec });
  syncHUD();
  setJudge(' ');

  startSpawning();
  rafId = requestAnimationFrame(updateTargetsFollowLook);

  // public api
  const api = {
    stop(){
      state.running = false;
      try{ clearInterval(spawnTimer); }catch(_){}
      try{ cancelAnimationFrame(rafId); }catch(_){}
      try{ window.removeEventListener('resize', onResize); }catch(_){}
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();

      // clear shake
      document.documentElement.style.setProperty('--shake-x','0px');
      document.documentElement.style.setProperty('--shake-y','0px');
    },
    getState(){ return { ...state, active: ACTIVE.size }; }
  };

  return api;
}
