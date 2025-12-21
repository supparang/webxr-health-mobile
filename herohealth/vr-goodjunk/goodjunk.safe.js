// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — DOM Emoji Engine (PRODUCTION)
// Step 1+2: VR-feel targets follow camera yaw/pitch + sticker + fade + tap-anywhere
// Step 3: DOM FX burst + float score + judgment near target + include kind/delta in events
// Step 4: FEVER drains + FEVER->STUN slow-mo + fire overlay hooks (via hha:fever active) + hha:stun

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

/* ----------------------- DOM FX ----------------------- */
function ensureFxStyle(){
  if (document.getElementById('gj-fx-style')) return;
  const st = document.createElement('style');
  st.id = 'gj-fx-style';
  st.textContent = `
  @keyframes gjFloatUp{
    0%{ transform:translate(-50%,-50%) scale(.96); opacity:0; }
    12%{ opacity:1; transform:translate(-50%,-55%) scale(1); }
    100%{ transform:translate(-50%,-110%) scale(1.04); opacity:0; }
  }
  @keyframes gjShard{
    0%{ transform:translate(-50%,-50%) scale(.7); opacity:1; }
    100%{ transform:translate(var(--dx), var(--dy)) scale(.9); opacity:0; }
  }`;
  document.head.appendChild(st);
}
function fxLayer(){
  let el = document.getElementById('gj-fx-layer');
  if (!el){
    el = document.createElement('div');
    el.id = 'gj-fx-layer';
    Object.assign(el.style, { position:'fixed', inset:'0', pointerEvents:'none', zIndex:'660', overflow:'hidden' });
    document.body.appendChild(el);
  }
  ensureFxStyle();
  return el;
}
function fxFloat(x, y, text, tone='good'){
  const layer = fxLayer();
  const div = document.createElement('div');
  div.textContent = text || '';
  Object.assign(div.style, {
    position:'fixed',
    left: (x|0) + 'px',
    top: (y|0) + 'px',
    transform:'translate(-50%,-50%)',
    fontWeight:'950',
    letterSpacing:'0.02em',
    fontSize:'13px',
    padding:'6px 10px',
    borderRadius:'999px',
    border:'1px solid rgba(148,163,184,0.25)',
    background:'rgba(2,6,23,0.68)',
    boxShadow:'0 16px 40px rgba(0,0,0,0.55)',
    color: tone==='bad' ? '#fdba74' : tone==='gold' ? '#fde68a' : tone==='block' ? '#bfdbfe' : '#bbf7d0',
    textShadow:'0 8px 18px rgba(0,0,0,0.75)',
    animation:'gjFloatUp .85s ease-out forwards'
  });
  layer.appendChild(div);
  setTimeout(()=>{ try{ div.remove(); }catch(_){} }, 950);
}
function fxBurst(x, y, tone='good'){
  const layer = fxLayer();
  const N = (tone==='gold') ? 16 : (tone==='bad') ? 12 : 14;
  for (let i=0;i<N;i++){
    const s = document.createElement('div');
    const a = Math.random()*Math.PI*2;
    const r = (tone==='bad') ? (36 + Math.random()*56) : (42 + Math.random()*70);
    const dx = Math.cos(a)*r;
    const dy = Math.sin(a)*r - (tone==='good' ? 10 : 0);
    s.textContent = (tone==='bad') ? '✖' : (tone==='gold') ? '✦' : '•';
    Object.assign(s.style, {
      position:'fixed',
      left:(x|0)+'px',
      top:(y|0)+'px',
      transform:'translate(-50%,-50%)',
      fontSize: (tone==='gold') ? '14px' : '12px',
      fontWeight:'900',
      opacity:'1',
      color: tone==='bad' ? '#fb923c' : tone==='gold' ? '#facc15' : '#22c55e',
      textShadow:'0 10px 22px rgba(0,0,0,0.75)',
      '--dx': dx.toFixed(1)+'px',
      '--dy': dy.toFixed(1)+'px',
      animation:'gjShard .48s ease-out forwards'
    });
    layer.appendChild(s);
    setTimeout(()=>{ try{ s.remove(); }catch(_){} }, 520);
  }
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
  const runMode = String(opts.run || 'play').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();
  const durationSec = clamp(opts.time ?? 60, 20, 180);

  const cameraEl = document.querySelector('#gj-camera');
  let SIZES = computeWorldSize();
  const onResize = ()=>{ SIZES = computeWorldSize(); };
  window.addEventListener('resize', onResize);

  const CFG = diffCfg(diff);

  // --- Step 4 tuning ---
  const FEVER_DECAY_PER_SEC = 3.2;       // ปกติค่อย ๆ ลด
  const STUN_DUR_MS = 4200;              // ช่วง slow-mo
  const STUN_SLOW_SCALE = 0.55;          // ยิ่งน้อยยิ่งช้าลง
  const STUN_FEVER_DRAIN_PER_SEC = 22.0; // ตอน STUN ให้ลดเร็ว → จบเองแน่นอน

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

    fever: 0,        // 0..100 (มีลด)
    shield: 0,

    // STUN (slow-mo)
    stunActive: false,
    stunUntil: 0,
    stunDurMs: STUN_DUR_MS,

    bossCleared: false,

    lastTickSec: -1,
    lastFrameAt: now(),
    lastSpawnAt: 0
  };

  const ACTIVE = new Set();
  let rafId = 0;

  function isStun(){
    return state.stunActive && now() < state.stunUntil;
  }
  function stunLeftMs(){
    if (!state.stunActive) return 0;
    return Math.max(0, state.stunUntil - now());
  }

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

    // FEVER active => ใช้ STUN เป็นตัวเปิดเอฟเฟกต์ไฟ
    emit('hha:fever', {
      fever: state.fever|0,
      shield: state.shield|0,
      active: isStun()
    });

    emit('hha:stun', {
      active: isStun(),
      leftMs: stunLeftMs(),
      durMs: state.stunDurMs|0
    });
  }

  function addFever(v){
    state.fever = clamp(state.fever + v, 0, 100);

    // ✅ Step 4: FEVER เต็ม → เข้า STUN (slow-mo) + ไฟลุก
    if (state.fever >= 100 && !state.stunActive){
      state.stunActive = true;
      state.stunUntil = now() + state.stunDurMs;

      setJudge('FEVER!');
      fxBurst(window.innerWidth*0.5, window.innerHeight*0.52, 'gold');
      fxFloat(window.innerWidth*0.5, window.innerHeight*0.52, '🔥 FEVER → STUN!', 'gold');

      syncHUD();
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
    el.className = 'gj-target spawn';
    el.textContent = emoji;

    if (kind === 'junk') el.classList.add('gj-junk');
    if (kind === 'gold') el.classList.add('gj-gold');
    if (kind === 'fake') el.classList.add('gj-fake');
    if (kind === 'power') el.classList.add('gj-power');
    if (kind === 'boss') el.classList.add('gj-boss');

    layerEl.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('in'));
    return el;
  }

  function chooseSpawnKind(){
    // ✅ Step 4: ระหว่าง STUN ให้ “ยุติธรรม/มันส์” ขึ้น
    let goodRatio = CFG.goodRatio + (isStun() ? 0.12 : 0);

    if (challenge === 'survival') goodRatio = Math.max(0.52, goodRatio - 0.08);
    if (challenge === 'boss'){
      if (!state.bossCleared && Math.random() < (isStun() ? 0.06 : 0.10)) return 'boss';
    }

    const r = Math.random();
    const powerP = isStun() ? 0.11 : 0.08;
    const goldP  = isStun() ? 0.12 : 0.06;

    if (r < powerP) return 'power';
    if (r < powerP + goldP) return 'gold';

    return (Math.random() < clamp(goodRatio, 0.35, 0.92)) ? 'good' : 'junk';
  }

  function chooseEmoji(kind){
    const GOOD = ['🥦','🥕','🍎','🍌','🥛','🍇','🍊','🥬'];
    const JUNK = ['🍟','🍔','🍕','🍩','🍰','🍿','🥤','🍗'];
    const GOLD = ['🌟','✨','🏅','💎'];
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

  function effectiveSpawnMs(){
    const slow = isStun() ? STUN_SLOW_SCALE : 1.0;
    return CFG.spawnMs / slow; // slow=0.55 => interval ใหญ่ขึ้น (ช้าลง)
  }
  function effectiveTtlMs(baseTtl){
    const slow = isStun() ? STUN_SLOW_SCALE : 1.0;
    return baseTtl / slow; // expire ช้าลง
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

    const baseTtl = (kind === 'boss') ? (CFG.ttlMs + 900) : CFG.ttlMs;
    const t = {
      id: Math.random().toString(16).slice(2),
      kind,
      emoji,
      el,
      wx: w.wx,
      wy: w.wy,
      sx: safePt.x,
      sy: safePt.y,
      bornAt: now(),
      ttlMs: effectiveTtlMs(baseTtl),
      dead: false,
      bossHp: (kind === 'boss') ? 3 : 1
    };

    const scale =
      (kind === 'boss') ? 1.25 :
      (kind === 'gold') ? 1.05 :
      (kind === 'power') ? 1.0 : 1.0;
    el.style.setProperty('--tScale', String(scale));

    const s = worldToScreen(t.wx, t.wy, look, SIZES);
    t.sx = s.x; t.sy = s.y;
    el.style.left = s.x + 'px';
    el.style.top  = s.y + 'px';

    const onDown = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      const x = (ev?.clientX ?? (ev?.touches?.[0]?.clientX)) ?? t.sx;
      const y = (ev?.clientY ?? (ev?.touches?.[0]?.clientY)) ?? t.sy;
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

    // ✅ Step 4: ระหว่าง STUN ให้ “ของดีหมดอายุ” ไม่เป็น MISS (ไม่ทำลาย feeling)
    if (isStun()){
      killTarget(t, true);
      return;
    }

    if (t.kind === 'good' || t.kind === 'gold' || t.kind === 'power' || t.kind === 'boss'){
      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      setJudge('MISS');
      fxBurst(t.sx, t.sy, 'bad');
      fxFloat(t.sx, t.sy, 'MISS', 'bad');
      syncHUD();
    }

    killTarget(t, true);
  }

  function hitTarget(t, x, y){
    if (!t || t.dead || !state.running) return;

    // boss
    if (t.kind === 'boss'){
      t.bossHp = (t.bossHp|0) - 1;
      if (t.bossHp > 0){
        const delta = (CFG.scoreGood|0);
        state.score += delta;
        state.goodHits++;
        state.combo++;
        state.comboMax = Math.max(state.comboMax, state.combo);
        addFever(+CFG.feverGain);

        setJudge('HIT!');
        fxBurst(x,y,'good');
        fxFloat(x,y,`+${delta} HIT!`,'good');

        emit('quest:goodHit', { x, y, judgment:'good', kind:'boss', delta, label:'HIT!' });
        syncHUD();
        return;
      }

      state.bossCleared = true;
      const delta = 90;
      state.score += delta;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+18);

      setJudge('BOSS!');
      fxBurst(x,y,'gold');
      fxFloat(x,y,`+${delta} BOSS!`,'gold');

      emit('quest:bossClear', {});
      emit('quest:goodHit', { x, y, judgment:'perfect', kind:'boss', delta, label:'BOSS!' });
      syncHUD();
      killTarget(t, true);
      return;
    }

    // junk
    if (t.kind === 'junk'){
      if (spendShield()){
        setJudge('BLOCK');
        fxBurst(x,y,'block');
        fxFloat(x,y,'BLOCK!','block');
        emit('quest:block', { x, y });
        syncHUD();
        killTarget(t, true);
        return;
      }

      state.misses = (state.misses|0) + 1;
      state.combo = 0;
      addFever(-CFG.feverLoss);

      setJudge('JUNK!');
      fxBurst(x,y,'bad');
      fxFloat(x,y,'JUNK!','bad');

      emit('quest:badHit', { x, y, judgment:'junk', kind:'junk', delta:0, label:'JUNK!' });
      syncHUD();
      killTarget(t, true);
      return;
    }

    // power
    if (t.kind === 'power'){
      let p = 'shield';
      if (t.emoji === '🧲') p = 'magnet';
      if (t.emoji === '⏱️') p = 'time';

      if (p === 'shield') state.shield = clamp((state.shield|0) + 1, 0, 9);
      if (p === 'time') state.endAt = state.endAt + 2500;

      const delta = 18;
      state.score += delta;
      state.goodHits++;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+8);

      const label = String(p).toUpperCase();
      setJudge(label);
      fxBurst(x,y,'good');
      fxFloat(x,y,`+${delta} ${label}`,'good');

      emit('quest:power', { x, y, power: p });
      emit('quest:goodHit', { x, y, judgment:'good', kind:'power', delta, label });
      syncHUD();
      killTarget(t, true);
      return;
    }

    // gold
    if (t.kind === 'gold'){
      const delta = (CFG.scoreGold|0);
      state.score += delta;
      state.goldHits++;
      state.goodHits++;
      state.combo += 2;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(+14);

      setJudge('GOLD!');
      fxBurst(x,y,'gold');
      fxFloat(x,y,`+${delta} GOLD!`,'gold');

      emit('quest:goodHit', { x, y, judgment:'perfect', kind:'gold', delta, label:'GOLD!' });
      syncHUD();
      killTarget(t, true);
      return;
    }

    // normal good
    const perfect = (Math.random() < 0.20);
    const delta = (CFG.scoreGood|0) + (perfect ? 6 : 0);

    state.score += delta;
    state.goodHits++;
    state.combo++;
    state.comboMax = Math.max(state.comboMax, state.combo);
    addFever(+CFG.feverGain + (perfect ? 3 : 0));

    setJudge(perfect ? 'PERFECT!' : 'GOOD!');
    fxBurst(x,y,'good');
    fxFloat(x,y,`+${delta} ${perfect?'PERFECT!':'GOOD!'}`,'good');

    emit('quest:goodHit', { x, y, judgment: perfect ? 'perfect' : 'good', kind:'good', delta, label:(perfect?'PERFECT!':'GOOD!') });
    syncHUD();
    killTarget(t, true);
  }

  // Tap-anywhere assist
  function findClosestTarget(x, y, maxDist=110){
    let best = null;
    let bestD2 = maxDist*maxDist;
    for (const t of ACTIVE){
      if (!t || t.dead) continue;
      const dx = (t.sx - x);
      const dy = (t.sy - y);
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2){
        bestD2 = d2;
        best = t;
      }
    }
    return best;
  }
  function onLayerDown(ev){
    if (ev.target && ev.target !== layerEl) return;
    const x = ev.clientX ?? (ev.touches?.[0]?.clientX);
    const y = ev.clientY ?? (ev.touches?.[0]?.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const t = findClosestTarget(x,y,110);
    if (t) hitTarget(t, x, y);
    ev.preventDefault?.();
  }
  layerEl.addEventListener('pointerdown', onLayerDown, { passive:false });
  layerEl.addEventListener('touchstart', onLayerDown, { passive:false });

  function updateLoop(){
    if (!state.running) return;

    const tNow = now();
    const dt = Math.max(0, (tNow - state.lastFrameAt));
    state.lastFrameAt = tNow;
    const dtSec = dt / 1000;

    // ✅ Step 4: FEVER decay (ตลอดเวลา)
    const inStun = isStun();

    if (inStun){
      // drain เร็วเพื่อจบเอง + ทำให้ไฟดับ
      state.fever = clamp(state.fever - STUN_FEVER_DRAIN_PER_SEC * dtSec, 0, 100);
      if (tNow >= state.stunUntil){
        state.stunActive = false;
      }
    }else{
      state.fever = clamp(state.fever - FEVER_DECAY_PER_SEC * dtSec, 0, 100);
    }

    // time tick
    const secLeft = Math.max(0, Math.ceil((state.endAt - tNow)/1000));
    if (secLeft !== state.lastTickSec){
      state.lastTickSec = secLeft;
      emit('hha:time', { sec: secLeft });
      // sync status more often
      syncHUD();
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

    // spawn (rAF-based so we can slow-mo)
    const needSpawn = (tNow - state.lastSpawnAt) >= effectiveSpawnMs();
    if (needSpawn){
      state.lastSpawnAt = tNow;
      spawnOne();
    }

    // update all targets (follow look + expiry)
    const look = getLookRad(cameraEl);
    for (const t of ACTIVE){
      if (!t || t.dead || !t.el || !t.el.isConnected) continue;

      // refresh ttl while stun toggles (ให้รู้สึกว่า slow มีผลจริง)
      // (เราจะไม่เปลี่ยน bornAt แค่ขยาย ttl ตอนที่ STUN เริ่ม)
      if (inStun && t.ttlMs < (CFG.ttlMs / STUN_SLOW_SCALE)){
        // bump ttl onceเล็ก ๆ เพื่อให้ของบนจอ “อยู่นานขึ้น”
        t.ttlMs = Math.max(t.ttlMs, effectiveTtlMs(t.ttlMs));
      }

      if ((tNow - t.bornAt) >= t.ttlMs){
        handleExpire(t);
        continue;
      }

      const s = worldToScreen(t.wx, t.wy, look, SIZES);
      t.sx = s.x; t.sy = s.y;
      t.el.style.left = s.x + 'px';
      t.el.style.top  = s.y + 'px';
    }

    rafId = requestAnimationFrame(updateLoop);
  }

  // init
  emit('hha:time', { sec: durationSec });
  syncHUD();
  setJudge(' ');

  // prime spawn timer
  state.lastSpawnAt = now() - effectiveSpawnMs()*0.85;
  rafId = requestAnimationFrame(updateLoop);

  return {
    stop(){
      state.running = false;
      try{ cancelAnimationFrame(rafId); }catch(_){}
      try{ window.removeEventListener('resize', onResize); }catch(_){}
      try{
        layerEl.removeEventListener('pointerdown', onLayerDown);
        layerEl.removeEventListener('touchstart', onLayerDown);
      }catch(_){}
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
    },
    getState(){ return { ...state, active: ACTIVE.size }; }
  };
}
