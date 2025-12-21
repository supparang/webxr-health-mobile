// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — DOM Emoji Engine (PRODUCTION)
// ✅ Targets are DOM but behave like VR: world-space + follow camera WORLD yaw/pitch
// ✅ Sticker style + fade-in/out
// ✅ Clamp safe zone: avoid overlapping HUD/cards
// ✅ Fever decay + STUN hero power (fire + slow + junk pops near aim)
// ✅ Magnet -> STUN (🧲 triggers stun; good attracted, junk breaks near center)
// Emits:
// - hha:time {sec}
// - hha:score {score, goodHits, misses, comboMax, challenge}
// - hha:judge {label}
// - hha:fever {fever, shield, stunActive}
// - quest:goodHit / quest:badHit / quest:block / quest:power / quest:bossClear
// - quest:miniStart (from director)

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
const WORLD_SCALE = 2.10;     // VR-feel: wider world -> more parallax when looking
const Y_PITCH_GAIN = 0.80;   // vertical strength
const WRAP_PAD = 160;

function wrapRad(a){
  a = Number(a) || 0;
  const TWO = Math.PI * 2;
  a = a % TWO;
  if (a < 0) a += TWO;
  return a;
}

function getLookRad(cameraEl){
  // IMPORTANT: use WORLD rotation (rig + camera)
  try{
    const THREE = window.THREE;
    if (cameraEl && cameraEl.object3D && THREE){
      const q = new THREE.Quaternion();
      cameraEl.object3D.getWorldQuaternion(q);
      const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
      return { yaw: wrapRad(e.y), pitch: clamp(e.x, -1.2, 1.2) };
    }
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
    easy:   { spawnMs: 860, ttlMs: 2200, maxActive: 5, goodRatio: 0.72, scoreGood: 12, scoreGold: 28, feverGain: 10, feverLoss: 18, feverDecayPerSec: 2.0 },
    normal: { spawnMs: 720, ttlMs: 1900, maxActive: 6, goodRatio: 0.66, scoreGood: 14, scoreGold: 32, feverGain: 11, feverLoss: 20, feverDecayPerSec: 2.3 },
    hard:   { spawnMs: 590, ttlMs: 1650, maxActive: 7, goodRatio: 0.60, scoreGood: 16, scoreGold: 36, feverGain: 12, feverLoss: 22, feverDecayPerSec: 2.7 }
  };
  return base[diff] || base.normal;
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
    misses: 0,
    combo: 0,
    comboMax: 0,

    fever: 0,        // 0..100
    shield: 0,       // charges

    // STUN
    stunActive: false,
    stunEndsAt: 0,

    bossCleared: false,

    lastTickSec: -1,
    lastUpdateAt: now(),

    // for adaptive spawn scheduling
    spawnTimer: 0
  };

  const ACTIVE = new Set();
  let rafId = 0;

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

  function addFever(v){
    state.fever = clamp(state.fever + v, 0, 100);
  }

  function spendShield(){
    if (state.shield > 0){
      state.shield = Math.max(0, (state.shield|0) - 1);
      return true;
    }
    return false;
  }

  function getAimPoint(){
    const ap = window.__GJ_AIM_POINT__;
    if (ap && typeof ap.x === 'number' && typeof ap.y === 'number'){
      return { x: ap.x, y: ap.y };
    }
    return { x: window.innerWidth*0.5, y: window.innerHeight*0.62 };
  }

  function startStun(ms, reason='FEVER'){
    const tNow = now();
    state.stunActive = true;
    state.stunEndsAt = tNow + Math.max(1200, ms|0);

    // ลด fever ลงหลังเปิด (กันค้าง 100)
    state.fever = clamp(72, 0, 100);

    setJudge('STUN!');
    emit('quest:power', { x: getAimPoint().x, y: getAimPoint().y, power: 'stun', reason });

    syncHUD();
  }

  function mkEl(kind, emoji){
    const el = document.createElement('div');
    el.className = 'gj-target';
    el.textContent = emoji;

    if (kind === 'junk') el.classList.add('gj-junk');
    if (kind === 'gold') el.classList.add('gj-gold');
    if (kind === 'power') el.classList.add('gj-power');
    if (kind === 'boss') el.classList.add('gj-boss');

    // sticker rotation random
    const rot = (Math.random()*10 - 5).toFixed(2);
    el.style.setProperty('--tRot', rot + 'deg');

    layerEl.appendChild(el);

    // fade in next tick
    requestAnimationFrame(()=>{ try{ el.classList.add('in'); }catch(_){} });

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
    const POWER = ['🛡️','🧲','⏱️']; // shield / STUN / time
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
      bornAt: now(),
      ttlMs: (kind === 'boss') ? (CFG.ttlMs + 900) : CFG.ttlMs,
      dead: false,
      bossHp: (kind === 'boss') ? 3 : 1
    };

    const scale =
      (kind === 'boss') ? 1.22 :
      (kind === 'gold') ? 1.05 :
      (kind === 'power') ? 1.00 :
      1.00;
    el.style.setProperty('--tScale', String(scale));

    const s = worldToScreen(t.wx, t.wy, look, SIZES);
    el.style.left = s.x + 'px';
    el.style.top  = s.y + 'px';

    const onDown = (ev)=>{
      // ถ้ากำลัง STUN: ให้ยังคลิกได้ตามปกติ
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

  function handleExpire(t){
    if (!t || t.dead) return;

    // MISS rule: good/gold/power/boss expired counts as miss
    if (t.kind === 'good' || t.kind === 'gold' || t.kind === 'power' || t.kind === 'boss'){
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      setJudge('MISS');
      syncHUD();
    }
    killTarget(t, true);
  }

  function hitTarget(t, x, y){
    if (!t || t.dead || !state.running) return;

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
      // decide power by emoji
      let p = 'shield';
      if (t.emoji === '🧲') p = 'stun'; // ✅ magnet -> STUN
      if (t.emoji === '⏱️') p = 'time';

      if (p === 'shield'){
        state.shield = clamp((state.shield|0) + 1, 0, 9);
      }
      if (p === 'time'){
        state.endAt = state.endAt + 2500;
      }
      if (p === 'stun'){
        // instant stun (shorter than fever-stun)
        const ms = (diff === 'easy') ? 5200 : (diff === 'hard' ? 4200 : 4700);
        startStun(ms, 'MAGNET');
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
      // ✅ ให้ mini m2 ผ่านแน่: ยิง quest:power gold
      emit('quest:power', { x, y, power: 'gold' });
      emit('quest:goodHit', { x, y, judgment:'perfect' });
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

  // STUN mechanics per-frame:
  // - slow game: spawn delay increased; TTL multiplier applied
  // - good attracted to aim
  // - junk auto-pop near aim (no miss)
  function applyStunBehavior(look){
    if (!state.stunActive) return;

    const ap = getAimPoint();
    const aim = { x: ap.x, y: ap.y };

    // attraction strength
    const ATTR = 0.035; // gentle but visible
    const POP_R = 86;   // junk pop radius

    // Convert aim screen -> world reference (approx at current look)
    const aimW = screenToWorldPoint(aim, look);

    for (const t of ACTIVE){
      if (!t || t.dead) continue;

      // compute current screen pos for junk pop check
      const s = worldToScreen(t.wx, t.wy, look, SIZES);

      if (t.kind === 'junk'){
        const dx = s.x - aim.x;
        const dy = s.y - aim.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= POP_R){
          // junk breaks itself (no miss)
          emit('quest:power', { x: s.x, y: s.y, power: 'stunpop' });
          // small reward
          state.score += 2;
          syncHUD();
          killTarget(t, true);
          continue;
        }
      } else {
        // pull good/gold/power/boss toward aim world
        t.wx = t.wx + (aimW.wx - t.wx) * ATTR;
        t.wy = t.wy + (aimW.wy - t.wy) * ATTR;
      }
    }
  }

  function updateTargetsFollowLook(){
    if (!state.running) return;

    const look = getLookRad(cameraEl);
    const tNow = now();

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

      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
      return;
    }

    // fever decay + stun lifecycle
    const dt = Math.max(0, (tNow - state.lastUpdateAt) / 1000);
    state.lastUpdateAt = tNow;

    if (state.stunActive){
      if (tNow >= state.stunEndsAt){
        state.stunActive = false;
        setJudge(' ');
        syncHUD();
      }
    } else {
      // decay
      if (state.fever > 0){
        state.fever = clamp(state.fever - (CFG.feverDecayPerSec * dt), 0, 100);
        syncHUD();
      }
      // fever full => stun
      if (state.fever >= 100){
        const ms = (diff === 'easy') ? 6200 : (diff === 'hard' ? 5200 : 5700);
        startStun(ms, 'FEVER');
      }
    }

    // apply STUN behavior before render
    applyStunBehavior(look);

    // move all targets (follow look)
    for (const t of ACTIVE){
      if (!t || t.dead || !t.el || !t.el.isConnected) continue;

      // TTL multiplier while stun (slow feel)
      const ttlMul = state.stunActive ? 1.38 : 1.0;

      if ((tNow - t.bornAt) >= (t.ttlMs * ttlMul)){
        handleExpire(t);
        continue;
      }

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      t.el.style.left = s.x + 'px';
      t.el.style.top  = s.y + 'px';
    }

    rafId = requestAnimationFrame(updateTargetsFollowLook);
  }

  // spawn scheduling (dynamic, to support “slow” during STUN)
  function scheduleSpawn(){
    if (!state.running) return;
    const base = CFG.spawnMs;
    const slowMul = state.stunActive ? 1.35 : 1.0;
    const jitter = (Math.random()*60 - 30);
    const delay = Math.max(240, (base * slowMul + jitter) | 0);

    state.spawnTimer = setTimeout(()=>{
      if (!state.running) return;
      spawnOne();
      scheduleSpawn();
    }, delay);
  }

  // init
  emit('hha:time', { sec: durationSec });
  syncHUD();
  setJudge(' ');

  scheduleSpawn();
  rafId = requestAnimationFrame(updateTargetsFollowLook);

  return {
    stop(){
      state.running = false;
      try{ clearTimeout(state.spawnTimer); }catch(_){}
      try{ cancelAnimationFrame(rafId); }catch(_){}
      try{ window.removeEventListener('resize', onResize); }catch(_){}
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
    },
    getState(){ return { ...state, active: ACTIVE.size }; }
  };
}
