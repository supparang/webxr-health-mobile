// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — DOM Emoji Engine (PRODUCTION)
// ✅ VR feel: อ่าน yaw/pitch จาก A-Frame look-controls (drag / deviceorientation)
// ✅ STUN (Hero power): เมื่อ FEVER เต็ม → เข้า STUN สโลว์เกม + junk แตกเองเมื่อเข้าใกล้ศูนย์กลาง
// ✅ Magnet (🧲 power-up): ดูด “เฉพาะของดี (kind===good)” เท่านั้น (ไม่ดูด junk)
// ✅ Events:
//    - hha:time {sec}
//    - hha:score {score, goodHits, misses, comboMax, challenge}
//    - hha:judge {label}
//    - hha:fever {fever, shield, stunActive}
//    - quest:goodHit / quest:badHit / quest:block / quest:power / quest:bossClear
//    - quest:stunPop (junk แตกเองช่วง STUN)

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

// ✅ สำคัญ: A-Frame look-controls ไม่ได้เขียน rotation ลง entity ตรง ๆ เสมอ
// ต้องอ่านจาก look-controls component (yawObject/pitchObject)
function getLookRad(cameraEl){
  try{
    const lc = cameraEl?.components?.['look-controls'];
    if (lc && lc.yawObject && lc.pitchObject){
      const yaw = wrapRad(lc.yawObject.rotation.y);
      const pitch = clamp(lc.pitchObject.rotation.x, -1.2, 1.2);
      return { yaw, pitch };
    }
  }catch(_){}

  // fallback
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
  const runMode = String(opts.run || 'play').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();
  const durationSec = clamp(opts.time ?? 60, 20, 180);

  const cameraEl = document.querySelector('#gj-camera');
  let SIZES = computeWorldSize();
  const onResize = ()=>{ SIZES = computeWorldSize(); };
  window.addEventListener('resize', onResize);

  const CFG = diffCfg(diff);

  // --- STUN tuning (Hero power) ---
  const STUN_MS = 6000;                 // ระยะเวลา STUN
  const STUN_SLOW = 0.55;               // slow ทั้งเกมช่วง STUN
  const STUN_KILL_RADIUS_RATIO = 0.18;  // ใกล้ศูนย์กลางเท่านี้ junk แตกเอง
  const STUN_SCORE_PER_JUNK = 4;        // ให้คะแนนตอน junk แตกเอง

  // --- FEVER decay ---
  const FEVER_DECAY_PER_SEC = 3.5;      // ลดเรื่อย ๆ แม้ไม่เข้า STUN (ทำให้เกม “มีจังหวะ”)

  // --- Magnet (🧲) tuning ---
  const MAGNET_MS = 5200;
  const MAGNET_PULL_PX_PER_SEC = 420;   // ดึงเฉพาะของดีเข้าใกล้ศูนย์กลาง

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

    // ✅ STUN state
    stunActive: false,
    stunUntil: 0,

    // ✅ Magnet state (ดูดเฉพาะของดี)
    magnetActive: false,
    magnetUntil: 0,

    bossCleared: false,

    lastSpawnAt: 0,
    lastTickSec: -1,
    lastFrameAt: now()
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
      fever: Math.round(state.fever|0),
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
      (kind === 'boss') ? 1.25 :
      (kind === 'gold') ? 1.05 :
      (kind === 'power') ? 1.0 :
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
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 90);
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

  function activateStun(){
    state.stunActive = true;
    state.stunUntil = now() + STUN_MS;
    // ตอนเข้า STUN ให้ FEVER เต็ม
    state.fever = 100;
    setJudge('STUN!');
    syncHUD();
  }

  function activateMagnet(){
    state.magnetActive = true;
    state.magnetUntil = now() + MAGNET_MS;
    // แจ้ง quest/mini ว่าใช้ magnet แล้ว
    emit('quest:power', { x: SIZES.W*0.5, y: SIZES.H*0.58, power: 'magnet' });
    syncHUD();
  }

  function hitTarget(t, x, y){
    if (!t || t.dead || !state.running) return;

    // boss multi-hit
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
        if (!state.stunActive && state.fever >= 100) activateStun();
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
      if (!state.stunActive && state.fever >= 100) activateStun();
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'junk'){
      if (spendShield()){
        setJudge('BLOCK');
        emit('quest:block', { x, y });
        syncHUD();
        killTarget(t, true);
        return;
      }

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
      let p = 'shield';
      if (t.emoji === '🧲') p = 'magnet';
      if (t.emoji === '⏱️') p = 'time';

      if (p === 'shield'){
        state.shield = clamp((state.shield|0) + 1, 0, 9);
        emit('quest:power', { x, y, power: 'shield' });
      }
      if (p === 'time'){
        state.endAt = state.endAt + 2500;
        emit('quest:power', { x, y, power: 'time' });
      }
      if (p === 'magnet'){
        // ✅ Magnet = ดูดเฉพาะของดี
        activateMagnet();
      }

      setJudge(String(p).toUpperCase());
      state.score += 18;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+8);
      if (!state.stunActive && state.fever >= 100) activateStun();
      syncHUD();
      killTarget(t, true);
      return;
    }

    if (t.kind === 'gold'){
      setJudge('GOLD!');
      emit('quest:power', { x, y, power:'gold' });
      emit('quest:goodHit', { x, y, judgment:'perfect' });
      state.score += (CFG.scoreGold|0);
      state.goldHits++;
      state.goodHits++;
      state.combo += 2;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+14);
      if (!state.stunActive && state.fever >= 100) activateStun();
      syncHUD();
      killTarget(t, true);
      return;
    }

    // normal good
    const perfect = (Math.random() < 0.20);
    setJudge(perfect ? 'PERFECT!' : 'GOOD!');
    emit('quest:goodHit', { x, y, judgment: perfect ? 'perfect' : 'good' });

    state.score += (CFG.scoreGood|0) + (perfect ? 6 : 0);
    state.goodHits++;
    state.combo++;
    state.comboMax = Math.max(state.comboMax, state.combo);

    addFever(+CFG.feverGain + (perfect ? 3 : 0));
    if (!state.stunActive && state.fever >= 100) activateStun();
    syncHUD();
    killTarget(t, true);
  }

  function applyMagnetPull(look, dtSec){
    if (!state.magnetActive) return;

    const tNow = now();
    if (tNow >= state.magnetUntil){
      state.magnetActive = false;
      return;
    }

    const cx = SIZES.W * 0.5;
    const cy = SIZES.H * 0.5;
    const pull = MAGNET_PULL_PX_PER_SEC * dtSec;

    for (const t of ACTIVE){
      if (!t || t.dead) continue;
      // ✅ ดูดเฉพาะ “ของดีจริง ๆ”
      if (t.kind !== 'good') continue;

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      const dx = (cx - s.x);
      const dy = (cy - s.y);
      const dist = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / dist;
      const ny = dy / dist;

      // world units ~ screen units ใน mapping นี้ (พอสำหรับ feel)
      t.wx += nx * pull;
      t.wy += ny * pull;
    }
  }

  function applyStunAutoPopJunk(look, dtSec){
    if (!state.stunActive) return;

    const tNow = now();
    const cx = SIZES.W * 0.5;
    const cy = SIZES.H * 0.5;
    const killR = Math.min(SIZES.W, SIZES.H) * STUN_KILL_RADIUS_RATIO;

    // ✅ FEVER ระหว่าง STUN: ลดลงตามเวลา (ให้รู้สึก “หมดพลัง”)
    const left = Math.max(0, state.stunUntil - tNow);
    const pct = (left / STUN_MS) * 100;
    state.fever = clamp(pct, 0, 100);

    for (const t of Array.from(ACTIVE)){
      if (!t || t.dead) continue;
      if (t.kind !== 'junk') continue;

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      const dist = Math.hypot(s.x - cx, s.y - cy);

      // ✅ เงื่อนไขผู้ใช้: “junk แตกเองเมื่อเข้าใกล้ศูนย์กลาง”
      if (dist <= killR){
        state.score += STUN_SCORE_PER_JUNK;
        // pop FX (ไม่ถือเป็น miss)
        emit('quest:stunPop', { x: s.x, y: s.y });
        killTarget(t, true);
      }
    }

    if (tNow >= state.stunUntil){
      state.stunActive = false;
      state.fever = 0;
      syncHUD();
    }
  }

  function updateTargetsFollowLook(){
    if (!state.running) return;

    const tNow = now();
    const dtSec = Math.max(0.001, Math.min(0.05, (tNow - state.lastFrameAt) / 1000));
    state.lastFrameAt = tNow;

    // ✅ เฟรมนี้ slow ทั้งเกมช่วง STUN
    const timeScale = state.stunActive ? STUN_SLOW : 1.0;

    const look = getLookRad(cameraEl);

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

    // ✅ FEVER decay (เมื่อไม่อยู่ STUN)
    if (!state.stunActive){
      state.fever = clamp(state.fever - (FEVER_DECAY_PER_SEC * dtSec * 100) / 100, 0, 100);
    }

    // ✅ Magnet (ดูดของดีเท่านั้น)
    applyMagnetPull(look, dtSec * timeScale);

    // ✅ STUN (junk แตกเองใกล้ศูนย์กลาง)
    applyStunAutoPopJunk(look, dtSec * timeScale);

    // move + expire
    for (const t of Array.from(ACTIVE)){
      if (!t || t.dead || !t.el || !t.el.isConnected) continue;

      // expire (ช่วง STUN ให้ “ช้าลง” → นานขึ้นเล็กน้อย)
      const ttl = state.stunActive ? (t.ttlMs / STUN_SLOW) : t.ttlMs;
      if ((tNow - t.bornAt) >= ttl){
        handleExpire(t);
        continue;
      }

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      t.el.style.left = s.x + 'px';
      t.el.style.top  = s.y + 'px';
    }

    // update HUD fever/shield/stun
    syncHUD();

    rafId = requestAnimationFrame(updateTargetsFollowLook);
  }

  function startSpawning(){
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(()=>{
      if (!state.running) return;

      // ✅ ช่วง STUN “สโลว์เกม” = ลดการ spawn
      if (state.stunActive){
        if (Math.random() < 0.55) return; // เบรกบาง tick
      }

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
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
    },
    getState(){ return { ...state, active: ACTIVE.size }; }
  };

  return api;
}
