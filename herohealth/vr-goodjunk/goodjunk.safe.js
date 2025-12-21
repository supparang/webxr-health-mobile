// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — DOM Emoji Engine (PRODUCTION)
// ✅ Targets are DOM but behave like VR: world-space + follow camera yaw/pitch
// ✅ Clamp safe zone: avoid overlapping HUD/cards
// ✅ TimeScale (Slow-Motion) จริง: spawn/TTL/time เดินด้วย dtGame
// ✅ FEVER:
//    - เพิ่ม/ลดจากการเล่น + decay เอง (ไม่ค้าง 100%)
//    - ถึง 100% เข้า FEVER MODE (ไฟลุกท่วมจอ) ~6s แล้วลดลงจนหมด
// ✅ STUN (Final Sprint โหดแบบเกมจริง):
//    - ถ้า “พลาด/โดน junk” ใน 8 วิสุดท้าย -> STUN 1s + Slow-Motion + ยิงไม่ติด
// Emits:
//    - hha:time {sec}
//    - hha:score {score, goodHits, misses, comboMax, challenge}
//    - hha:judge {label}
//    - hha:fever {fever, shield, active}
//    - hha:lock {ms}  (ใช้กับ FX + HUD STUN)
//    - hha:stun {ms}  (สำรอง)
//    - quest:goodHit / quest:badHit / quest:block / quest:power / quest:bossClear
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

  const cameraEl = document.querySelector('#gj-camera');
  let SIZES = computeWorldSize();
  const onResize = ()=>{ SIZES = computeWorldSize(); };
  window.addEventListener('resize', onResize);

  const CFG = diffCfg(diff);

  // --- time system (dtGame = dtReal * timeScale)
  const state = {
    running: true,

    // game time (scaled)
    timeScale: 1.0,
    gameTime: 0,
    lastRealAt: now(),
    spawnAcc: 0,

    // remaining in "game ms"
    remainingMs: durationSec * 1000,

    score: 0,
    goodHits: 0,
    goldHits: 0,
    misses: 0,
    combo: 0,
    comboMax: 0,

    fever: 0,        // 0..100
    shield: 0,

    feverActive: false,
    feverActiveLeftMs: 0,

    lockedUntilReal: 0,   // ยิงไม่ติดช่วง STUN (ใช้ real time)
    slowUntilReal: 0,     // slow-motion window (real time)

    bossCleared: false,

    lastTickSec: -1,
    lastFeverEmitAt: 0
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
      active: !!state.feverActive
    });
  }

  // ------- FEVER behavior -------
  const FEVER_DECAY_PER_SEC = 2.8;   // ไม่ให้ค้าง 100% (เวลานิ่ง ๆ จะค่อย ๆ ลด)
  const FEVER_MODE_MS = 6000;        // โหมดไฟลุก
  const FEVER_SCORE_MULT = 1.35;     // ช่วง fever ให้สะใจขึ้น

  function addFever(v){
    state.fever = clamp(state.fever + v, 0, 100);

    // เข้า FEVER MODE เมื่อถึง 100% (ครั้งแรก)
    if (!state.feverActive && state.fever >= 100){
      state.feverActive = true;
      state.feverActiveLeftMs = FEVER_MODE_MS;
      // “รางวัล” เล็ก ๆ ให้รู้สึกเท่
      state.shield = clamp((state.shield|0) + 1, 0, 9);
      emit('hha:fever', { fever: 100, shield: state.shield|0, active: true });
    }
  }

  function feverTick(dtGameMs){
    // ระหว่าง FEVER MODE: ลดลงจนหมด
    if (state.feverActive){
      state.feverActiveLeftMs = Math.max(0, state.feverActiveLeftMs - dtGameMs);
      const pct = (state.feverActiveLeftMs / FEVER_MODE_MS);
      state.fever = clamp(Math.round(100 * pct), 0, 100);
      if (state.feverActiveLeftMs <= 0){
        state.feverActive = false;
        // จบ fever ให้เหลือไฟ 15% (ยังรู้สึกต่อเนื่อง)
        state.fever = Math.min(state.fever, 15);
      }
      return;
    }

    // นอก FEVER MODE: decay เอง
    const dec = FEVER_DECAY_PER_SEC * (dtGameMs/1000);
    if (dec > 0){
      state.fever = clamp(state.fever - dec, 0, 100);
    }
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

    if (kind === 'junk') el.classList.add('gj-junk');
    if (kind === 'gold') el.classList.add('gj-gold');
    if (kind === 'fake') el.classList.add('gj-fake');
    if (kind === 'power') el.classList.add('gj-power');
    if (kind === 'boss') el.classList.add('gj-boss');

    layerEl.appendChild(el);
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
    if (ACTIVE.size >= CFG.maxActive) return;

    const kind = chooseSpawnKind();
    const emoji = chooseEmoji(kind);
    const el = mkEl(kind, emoji);

    const look = getLookRad(cameraEl);
    const safePt = pickScreenPointSafe(SIZES, 18);
    const w = screenToWorldPoint(safePt, look);

    const ttl = (kind === 'boss') ? (CFG.ttlMs + 900) : CFG.ttlMs;

    const t = {
      id: Math.random().toString(16).slice(2),
      kind,
      emoji,
      el,
      wx: w.wx,
      wy: w.wy,
      bornGame: state.gameTime,
      ttlMs: ttl,
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
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 110);
    }
  }

  // ---------- STUN + Slow-Motion (Final Sprint) ----------
  function triggerStun(ms=1000){
    const tNow = now();
    state.lockedUntilReal = Math.max(state.lockedUntilReal, tNow + ms);
    state.slowUntilReal   = Math.max(state.slowUntilReal, tNow + ms);

    emit('hha:lock', { ms });
    emit('hha:stun', { ms });
  }

  function isFinalSprint(){
    // 8 วิสุดท้ายตามเวลาเกม (remainingMs)
    return state.remainingMs <= 8000;
  }

  function handleExpire(t){
    if (!t || t.dead) return;

    // MISS rule: good expired counts as miss
    if (t.kind === 'good' || t.kind === 'gold' || t.kind === 'power' || t.kind === 'boss'){
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      // Final Sprint โหดแบบเกมจริง: พลาดใน 8 วิสุดท้าย -> STUN 1 วิ + slow
      if (isFinalSprint()) triggerStun(1000);

      setJudge('MISS');
      syncHUD();
    }
    killTarget(t, true);
  }

  function hitTarget(t, x, y){
    if (!t || t.dead || !state.running) return;

    // ถ้า STUN อยู่ -> ยิงไม่ติด (ชัด ๆ)
    if (now() < state.lockedUntilReal){
      setJudge('STUN!');
      // ปล่อยให้เป้าอยู่ต่อ (ไม่ kill) เพื่อ “เจ็บจริง”
      return;
    }

    // boss: ต้องตีหลายที
    if (t.kind === 'boss'){
      t.bossHp = (t.bossHp|0) - 1;
      if (t.bossHp > 0){
        setJudge('HIT!');
        emit('quest:goodHit', { x, y, judgment:'good', kind:'boss' });

        const mult = state.feverActive ? FEVER_SCORE_MULT : 1;
        state.score += Math.round((CFG.scoreGood|0) * mult);
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
      emit('quest:goodHit', { x, y, judgment:'perfect', kind:'boss' });

      const mult = state.feverActive ? FEVER_SCORE_MULT : 1;
      state.score += Math.round(90 * mult);
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
        emit('quest:block', { x, y, kind:'junk' });
        syncHUD();
        killTarget(t, true);
        return;
      }

      // junk hit = miss
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      // Final Sprint โหด: โดน junk ใน 8 วิสุดท้าย -> STUN 1 วิ + slow
      if (isFinalSprint()) triggerStun(1000);

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
        state.remainingMs = Math.min(state.remainingMs + 2500, (durationSec*1000 + 12000));
      }

      setJudge(String(p).toUpperCase());
      emit('quest:power', { x, y, power: p, kind:'power' });

      const mult = state.feverActive ? FEVER_SCORE_MULT : 1;
      state.score += Math.round(18 * mult);
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
      emit('quest:goodHit', { x, y, judgment:'perfect', kind:'gold' });

      const mult = state.feverActive ? FEVER_SCORE_MULT : 1;
      state.score += Math.round((CFG.scoreGold|0) * mult);
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
      emit('quest:goodHit', { x, y, judgment: perfect ? 'perfect' : 'good', kind:'good' });

      const mult = state.feverActive ? FEVER_SCORE_MULT : 1;
      state.score += Math.round(((CFG.scoreGood|0) + (perfect ? 6 : 0)) * mult);
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);

      addFever(+CFG.feverGain + (perfect ? 3 : 0));
      syncHUD();
      killTarget(t, true);
    }
  }

  function updateLoop(){
    if (!state.running) return;

    const tNow = now();
    const dtReal = Math.max(0, tNow - state.lastRealAt);
    state.lastRealAt = tNow;

    // Slow-Motion window: เวลา real อยู่ใน slowUntilReal -> timeScale ลด
    if (tNow < state.slowUntilReal){
      state.timeScale = 0.55; // ✅ slow ทั้งเกม (spawn/เวลา/ttl)
    } else {
      state.timeScale = 1.0;
    }

    const dtGame = dtReal * state.timeScale;
    state.gameTime += dtGame;
    state.remainingMs = Math.max(0, state.remainingMs - dtGame);

    // FEVER tick (ลดเอง + โหมดไฟลุก)
    feverTick(dtGame);

    // time tick
    const secLeft = Math.max(0, Math.ceil(state.remainingMs/1000));
    if (secLeft !== state.lastTickSec){
      state.lastTickSec = secLeft;
      emit('hha:time', { sec: secLeft });
    }

    // emit fever frequently แต่ไม่ spam
    if ((tNow - state.lastFeverEmitAt) > 180){
      state.lastFeverEmitAt = tNow;
      emit('hha:fever', { fever: state.fever|0, shield: state.shield|0, active: !!state.feverActive });
    }

    // end
    if (state.remainingMs <= 0){
      state.running = false;
      emit('hha:time', { sec: 0 });
      syncHUD();
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
      return;
    }

    // spawn via accumulator (dtGame)
    state.spawnAcc += dtGame;

    // Final Sprint (8 วิสุดท้าย) “โหดขึ้น”: spawn เร็วขึ้นนิด + junk เพิ่ม
    const inFinal = (state.remainingMs <= 8000);

    const spawnMs = inFinal ? Math.max(220, CFG.spawnMs * 0.72) : CFG.spawnMs;

    while (state.spawnAcc >= spawnMs){
      state.spawnAcc -= spawnMs;
      // ช่วง Final ให้มีโอกาส junk เพิ่มนิด (ไม่แก้ CFG ตรง ๆ)
      if (inFinal && Math.random() < 0.14){
        // spawn junk เพิ่ม 1 ตัว ถ้าพื้นที่พอ
        if (ACTIVE.size < CFG.maxActive) {
          const el = mkEl('junk', chooseEmoji('junk'));
          const look = getLookRad(cameraEl);
          const safePt = pickScreenPointSafe(SIZES, 18);
          const w = screenToWorldPoint(safePt, look);
          const t = {
            id: Math.random().toString(16).slice(2),
            kind:'junk',
            emoji: el.textContent,
            el,
            wx:w.wx, wy:w.wy,
            bornGame: state.gameTime,
            ttlMs: CFG.ttlMs,
            dead:false,
            bossHp:1
          };
          el.style.setProperty('--tScale','1.0');
          const s = worldToScreen(t.wx, t.wy, look, SIZES);
          el.style.left = s.x + 'px';
          el.style.top  = s.y + 'px';
          const onDown = (ev)=>{
            ev.preventDefault?.(); ev.stopPropagation?.();
            const x = (ev?.clientX ?? (ev?.touches?.[0]?.clientX)) ?? s.x;
            const y = (ev?.clientY ?? (ev?.touches?.[0]?.clientY)) ?? s.y;
            hitTarget(t, x, y);
          };
          el.addEventListener('pointerdown', onDown, { passive:false });
          el.addEventListener('touchstart', onDown, { passive:false });
          ACTIVE.add(t);
        }
      }

      spawnOne();
    }

    // move all targets
    const look = getLookRad(cameraEl);
    for (const t of ACTIVE){
      if (!t || t.dead || !t.el || !t.el.isConnected) continue;

      // expire by gameTime (timeScale มีผลจริง)
      if ((state.gameTime - t.bornGame) >= t.ttlMs){
        handleExpire(t);
        continue;
      }

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      t.el.style.left = s.x + 'px';
      t.el.style.top  = s.y + 'px';
    }

    rafId = requestAnimationFrame(updateLoop);
  }

  // init
  emit('hha:time', { sec: durationSec });
  syncHUD();
  setJudge(' ');

  rafId = requestAnimationFrame(updateLoop);

  const api = {
    stop(){
      state.running = false;
      try{ cancelAnimationFrame(rafId); }catch(_){}
      try{ window.removeEventListener('resize', onResize); }catch(_){}
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
    },
    getState(){ return { ...state, active: ACTIVE.size }; }
  };

  return api;
}
