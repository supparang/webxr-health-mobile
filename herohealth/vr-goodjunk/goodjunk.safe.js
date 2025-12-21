// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — DOM Emoji Engine (PRODUCTION, VR-FEEL PACK)
// ✅ Targets: DOM emoji sticker + fade in/out
// ✅ VR-feel look controller:
//    - drag-to-look + inertia
//    - deviceorientation-to-look (mobile) if permitted
// ✅ tap-anywhere near target to hit (VR-like)
// ✅ Clamp safe zone: avoid overlapping HUD/cards
// ✅ Events:
//    - hha:time {sec}
//    - hha:score {score, goodHits, misses, comboMax, challenge}
//    - hha:judge {label}
//    - hha:fever {fever, shield, active}
//    - hha:final8 {enter|inc|reset}
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
const WORLD_SCALE = 2.05;
const Y_PITCH_GAIN = 0.78;
const WRAP_PAD = 140;

function wrapRad(a){
  a = Number(a) || 0;
  const TWO = Math.PI * 2;
  a = a % TWO;
  if (a < 0) a += TWO;
  return a;
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

/* ----------------------- VR-FEEL Look Controller ----------------------- */
function createLookController(layerEl, opts = {}){
  const S = {
    yaw: 0,
    pitch: 0,
    vyaw: 0,
    vpitch: 0,

    dragOn: false,
    lastX: 0,
    lastY: 0,

    dragYawOff: 0,
    dragPitchOff: 0,

    gyroOn: !!opts.gyro,
    gyroYaw: 0,
    gyroPitch: 0,

    sensitivity: Number(opts.sensitivity ?? 0.0064),
    friction: Number(opts.friction ?? 0.86), // inertia damping
    maxPitch: 1.10
  };

  // drag
  function onDown(ev){
    const pt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    S.dragOn = true;
    S.lastX = pt.clientX || 0;
    S.lastY = pt.clientY || 0;
    S.vyaw = 0; S.vpitch = 0;
  }
  function onMove(ev){
    if (!S.dragOn) return;
    const pt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;

    const x = pt.clientX || 0;
    const y = pt.clientY || 0;

    const dx = x - S.lastX;
    const dy = y - S.lastY;

    S.lastX = x; S.lastY = y;

    const yawDelta = -dx * S.sensitivity;
    const pitchDelta = -dy * (S.sensitivity * 0.78);

    S.dragYawOff = wrapRad(S.dragYawOff + yawDelta);
    S.dragPitchOff = clamp(S.dragPitchOff + pitchDelta, -S.maxPitch, S.maxPitch);

    // velocity for inertia
    S.vyaw = yawDelta;
    S.vpitch = pitchDelta;

    ev.preventDefault?.();
  }
  function onUp(){
    S.dragOn = false;
  }

  layerEl.addEventListener('pointerdown', onDown, { passive:false });
  layerEl.addEventListener('pointermove', onMove, { passive:false });
  layerEl.addEventListener('pointerup', onUp, { passive:true });
  layerEl.addEventListener('pointercancel', onUp, { passive:true });

  layerEl.addEventListener('touchstart', onDown, { passive:false });
  layerEl.addEventListener('touchmove', onMove, { passive:false });
  layerEl.addEventListener('touchend', onUp, { passive:true });

  // gyro (simple mapping)
  function onOri(e){
    if (!S.gyroOn) return;
    const a = Number(e.alpha); // 0..360 yaw-ish
    const b = Number(e.beta);  // -180..180 pitch-ish
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;

    const yaw = wrapRad((a * Math.PI) / 180);
    const pitch = clamp((b * Math.PI) / 180, -S.maxPitch, S.maxPitch);

    // smooth
    S.gyroYaw = wrapRad(S.gyroYaw * 0.92 + yaw * 0.08);
    S.gyroPitch = S.gyroPitch * 0.92 + pitch * 0.08;
  }

  if (S.gyroOn){
    window.addEventListener('deviceorientation', onOri, true);
  }

  let lastT = now();
  function step(){
    const t = now();
    const dt = Math.max(0.001, Math.min(0.06, (t-lastT)/1000));
    lastT = t;

    // inertia when not dragging
    if (!S.dragOn){
      S.vyaw *= Math.pow(S.friction, dt*60);
      S.vpitch *= Math.pow(S.friction, dt*60);

      if (Math.abs(S.vyaw) < 0.00002) S.vyaw = 0;
      if (Math.abs(S.vpitch) < 0.00002) S.vpitch = 0;

      S.dragYawOff = wrapRad(S.dragYawOff + S.vyaw);
      S.dragPitchOff = clamp(S.dragPitchOff + S.vpitch, -S.maxPitch, S.maxPitch);
    }

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  return {
    getLook(){
      const baseYaw = S.gyroOn ? S.gyroYaw : 0;
      const basePitch = S.gyroOn ? S.gyroPitch : 0;
      return {
        yaw: wrapRad(baseYaw + S.dragYawOff),
        pitch: clamp(basePitch + S.dragPitchOff, -S.maxPitch, S.maxPitch)
      };
    },
    destroy(){
      try{ window.removeEventListener('deviceorientation', onOri, true); }catch(_){}
    }
  };
}

/* ----------------------- Engine ----------------------- */
export function boot(opts = {}){
  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  if (!layerEl){
    console.error('[GoodJunk] layerEl missing');
    return null;
  }

  const diff = String(opts.diff || 'normal').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();
  const durationSec = clamp(opts.time ?? 60, 20, 180);

  let SIZES = computeWorldSize();
  const onResize = ()=>{ SIZES = computeWorldSize(); };
  window.addEventListener('resize', onResize);

  const CFG = diffCfg(diff);

  // ✅ look controller (drag + gyro + inertia)
  const LOOK = createLookController(layerEl, {
    gyro: !!opts.gyro
  });

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

    bossCleared: false,

    // time + final8
    timeLeftSec: durationSec,
    final8Count: 0,
    final8Armed: false,

    lastTickSec: -1
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
      active: state.fever >= 100
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

  function mkEl(kind, emoji){
    const el = document.createElement('div');
    el.className = 'gj-target spawn';
    el.textContent = emoji;

    if (kind === 'junk') el.classList.add('gj-junk');
    if (kind === 'gold') el.classList.add('gj-gold');
    if (kind === 'power') el.classList.add('gj-power');
    if (kind === 'boss') el.classList.add('gj-boss');

    layerEl.appendChild(el);

    // fade-in (next tick)
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

  function final8Enter(secLeft){
    state.final8Armed = true;
    state.final8Count = 0;
    emit('hha:final8', { enter:true, secLeft: secLeft|0, total:0 });
  }

  function final8Reset(reason, x, y){
    if (!state.final8Armed) return;
    if ((state.timeLeftSec|0) > 8) return;
    state.final8Count = 0;
    emit('hha:final8', { reset:true, reason: String(reason||''), x, y, total:0, secLeft: state.timeLeftSec|0 });
  }

  function final8Inc(x, y){
    if (!state.final8Armed) return;
    if ((state.timeLeftSec|0) > 8) return;
    state.final8Count = (state.final8Count|0) + 1;
    emit('hha:final8', { inc:1, total: state.final8Count|0, x, y, secLeft: state.timeLeftSec|0 });
  }

  function spawnOne(){
    if (!state.running) return;
    if (ACTIVE.size >= CFG.maxActive) return;

    const kind = chooseSpawnKind();
    const emoji = chooseEmoji(kind);
    const el = mkEl(kind, emoji);

    const look = LOOK.getLook();
    const safePt = pickScreenPointSafe(SIZES, 18);
    const w = screenToWorldPoint(safePt, look);

    // ✅ Final Sprint โหด: ช่วง 8 วิท้าย เป้าหายไวขึ้น
    const inFinal8 = state.final8Armed && (state.timeLeftSec|0) <= 8;
    const ttlMult = inFinal8 ? 0.82 : 1.0;

    const t = {
      id: Math.random().toString(16).slice(2),
      kind,
      emoji,
      el,
      wx: w.wx,
      wy: w.wy,
      bornAt: now(),
      ttlMs: Math.max(520, ((kind === 'boss') ? (CFG.ttlMs + 900) : CFG.ttlMs) * ttlMult),
      dead: false,
      bossHp: (kind === 'boss') ? 3 : 1,
      sx: safePt.x,
      sy: safePt.y
    };

    const scale =
      (kind === 'boss') ? 1.25 :
      (kind === 'gold') ? 1.05 :
      (kind === 'power') ? 1.0 :
      1.0;

    el.style.setProperty('--tScale', String(scale));

    const s = worldToScreen(t.wx, t.wy, look, SIZES);
    t.sx = s.x; t.sy = s.y;
    el.style.left = s.x + 'px';
    el.style.top  = s.y + 'px';

    const onDown = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      const pt = (ev?.touches?.[0]) || ev;
      const x = (pt?.clientX ?? s.x);
      const y = (pt?.clientY ?? s.y);
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

    // MISS rule: good/gold/power/boss expire counts as miss
    if (t.kind === 'good' || t.kind === 'gold' || t.kind === 'power' || t.kind === 'boss'){
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      // ✅ Final Sprint โหด: พลาด (expire) ในช่วง 8 วิท้าย → รีเซ็ต
      if (state.final8Armed && (state.timeLeftSec|0) <= 8){
        final8Reset('expire', t.sx, t.sy);
      }

      setJudge('MISS');
      syncHUD();
    }
    killTarget(t, true);
  }

  function hitTarget(t, x, y){
    if (!t || t.dead || !state.running) return;

    // boss: ต้องตีหลายที
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
        final8Inc(x, y);

        syncHUD();
        return;
      }

      state.bossCleared = true;
      setJudge('BOSS!');
      emit('quest:bossClear', {});
      emit('quest:goodHit', { x, y, judgment:'perfect', kind:'boss' });

      state.score += 90;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+18);
      final8Inc(x, y);

      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'junk'){
      // shield block?
      if (spendShield()){
        setJudge('BLOCK');
        emit('quest:block', { x, y });

        // ✅ block ไม่ใช่ miss และไม่รีเซ็ต final8
        syncHUD();
        killTarget(t, true);
        return;
      }

      // junk hit = miss
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      // ✅ Final Sprint โหด: โดน junk ในช่วง 8 วิท้าย → รีเซ็ต
      if (state.final8Armed && (state.timeLeftSec|0) <= 8){
        final8Reset('junk', x, y);
      }

      setJudge('JUNK!');
      emit('quest:badHit', { x, y, judgment:'junk', kind:'junk' });
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'power'){
      let p = 'shield';
      if (t.emoji === '🧲') p = 'magnet';
      if (t.emoji === '⏱️') p = 'time';

      if (p === 'shield'){
        state.shield = clamp((state.shield|0) + 1, 0, 9);
      }
      if (p === 'time'){
        state.endAt = state.endAt + 2500;
      }

      setJudge(String(p).toUpperCase());
      emit('quest:power', { x, y, power: p, kind:'power' });

      state.score += 18;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+8);
      final8Inc(x, y);

      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'gold'){
      setJudge('GOLD!');
      emit('quest:goodHit', { x, y, judgment:'perfect', kind:'gold' });

      state.score += (CFG.scoreGold|0);
      state.goldHits++;
      state.goodHits++;
      state.combo += 2;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+14);
      final8Inc(x, y);

      syncHUD();
      killTarget(t, true);
      return;
    }

    // normal good
    {
      const perfect = (Math.random() < 0.20);
      setJudge(perfect ? 'PERFECT!' : 'GOOD!');
      emit('quest:goodHit', { x, y, judgment: perfect ? 'perfect' : 'good', kind:'good' });

      state.score += (CFG.scoreGood|0) + (perfect ? 6 : 0);
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);

      addFever(+CFG.feverGain + (perfect ? 3 : 0));
      final8Inc(x, y);

      syncHUD();
      killTarget(t, true);
    }
  }

  // ✅ tap-anywhere (near target)
  const TAP_RADIUS = 120;
  function dist2(ax, ay, bx, by){
    const dx = ax-bx, dy = ay-by;
    return dx*dx + dy*dy;
  }
  function findNearestTarget(x, y){
    let best = null;
    let bestD = TAP_RADIUS*TAP_RADIUS;
    for (const t of ACTIVE){
      if (!t || t.dead) continue;
      const d = dist2(x, y, t.sx||0, t.sy||0);
      if (d <= bestD){
        bestD = d;
        best = t;
      }
    }
    return best;
  }
  layerEl.addEventListener('pointerdown', (ev)=>{
    // ถ้ากดโดน target อยู่แล้ว ให้ handler ของ target ทำงาน
    const targetEl = ev.target;
    if (targetEl && targetEl.classList && targetEl.classList.contains('gj-target')) return;

    const x = ev.clientX ?? (ev.touches?.[0]?.clientX);
    const y = ev.clientY ?? (ev.touches?.[0]?.clientY);
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const t = findNearestTarget(x, y);
    if (t) hitTarget(t, x, y);
  }, { passive:false });

  function updateTargetsFollowLook(){
    if (!state.running) return;

    const look = LOOK.getLook();
    const tNow = now();

    // time tick
    const secLeft = Math.max(0, Math.ceil((state.endAt - tNow)/1000));
    state.timeLeftSec = secLeft|0;

    if (secLeft !== state.lastTickSec){
      const prev = state.lastTickSec;
      state.lastTickSec = secLeft;

      emit('hha:time', { sec: secLeft });

      // ✅ Final8 enter
      if ((prev > 8) && (secLeft <= 8)){
        final8Enter(secLeft);
      }
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

    // move all targets
    for (const t of ACTIVE){
      if (!t || t.dead || !t.el || !t.el.isConnected) continue;

      // expire
      if ((tNow - t.bornAt) >= t.ttlMs){
        handleExpire(t);
        continue;
      }

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      t.sx = s.x; t.sy = s.y;
      t.el.style.left = s.x + 'px';
      t.el.style.top  = s.y + 'px';
    }

    rafId = requestAnimationFrame(updateTargetsFollowLook);
  }

  function startSpawning(){
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(()=>{
      if (!state.running) return;
      spawnOne();
    }, CFG.spawnMs);
  }

  // init
  emit('hha:time', { sec: durationSec });
  syncHUD();
  setJudge(' ');

  startSpawning();
  rafId = requestAnimationFrame(updateTargetsFollowLook);

  const api = {
    stop(){
      state.running = false;
      try{ clearInterval(spawnTimer); }catch(_){}
      try{ cancelAnimationFrame(rafId); }catch(_){}
      try{ window.removeEventListener('resize', onResize); }catch(_){}
      try{ LOOK && LOOK.destroy && LOOK.destroy(); }catch(_){}
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
    },
    getState(){ return { ...state, active: ACTIVE.size }; }
  };

  return api;
}
