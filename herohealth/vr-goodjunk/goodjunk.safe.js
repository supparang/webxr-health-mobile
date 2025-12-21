// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — DOM Emoji Engine (PRODUCTION)
// ✅ Targets are DOM but behave like VR: world-space + follow camera yaw/pitch
// ✅ Clamp safe zone: avoid overlapping HUD/cards
// ✅ FX: burst + score pop + judge
// ✅ Fever: decays + STUN window (junk near aim point auto-break)
// ✅ Screen shake strength scales with fever% (stronger) + edge flash
// ✅ Emits hha:end for summary

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

/* ----------------------- FX fallback ----------------------- */
const FX = (() => {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const P =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles ||
    root.GAME_MODULES?.particles ||
    {};

  function scorePop(x,y,text){
    if (typeof P.scorePop === 'function') { try{ P.scorePop(x,y,text); return; }catch(_){} }
    // fallback DOM
    const el = document.createElement('div');
    el.textContent = String(text||'');
    Object.assign(el.style,{
      position:'fixed', left:(x|0)+'px', top:(y|0)+'px',
      transform:'translate(-50%,-50%)',
      fontWeight:'950', fontSize:'14px',
      zIndex: 9999, pointerEvents:'none',
      color:'#fef9c3',
      textShadow:'0 10px 22px rgba(0,0,0,0.55)',
      opacity:'1',
      transition:'transform .6s ease-out, opacity .6s ease-out'
    });
    document.body.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.opacity='0';
      el.style.transform='translate(-50%,-50%) translateY(-32px) scale(1.06)';
    });
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 650);
  }

  function burstAt(x,y,kind){
    if (typeof P.burstAt === 'function') { try{ P.burstAt(x,y,kind); return; }catch(_){} }
    // fallback micro burst
    const n = 10;
    for (let i=0;i<n;i++){
      const d = document.createElement('div');
      Object.assign(d.style,{
        position:'fixed', left:(x|0)+'px', top:(y|0)+'px',
        width:'6px', height:'6px', borderRadius:'999px',
        background:'rgba(251,191,36,0.85)',
        zIndex:9998, pointerEvents:'none',
        transform:'translate(-50%,-50%)',
        opacity:'1'
      });
      document.body.appendChild(d);
      const ang = Math.random()*Math.PI*2;
      const dist = 40 + Math.random()*50;
      const tx = Math.cos(ang)*dist;
      const ty = Math.sin(ang)*dist;
      d.animate([
        { transform:'translate(-50%,-50%)', opacity:1 },
        { transform:`translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`, opacity:0 }
      ], { duration: 520, easing:'cubic-bezier(.2,.8,.2,1)' });
      setTimeout(()=>{ try{ d.remove(); }catch(_){} }, 560);
    }
  }

  function celebrate(label){
    if (typeof P.celebrate === 'function') { try{ P.celebrate(label); }catch(_){} }
    const big = document.getElementById('big-celebrate');
    if (big){ big.classList.add('show'); setTimeout(()=> big.classList.remove('show'), 1200); }
  }

  return { scorePop, burstAt, celebrate };
})();

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

  // Fever behavior
  const FEVER_DECAY_PER_SEC = 7;   // ✅ fever ลดเอง
  const STUN_DURATION_MS = 5200;   // โหมด STUN ช่วงสั้นแบบเกมจริง
  const STUN_RADIUS = 170;         // junk ใกล้ศูนย์กลางจะแตกเอง

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
    stunActive:false,
    stunUntil:0,

    // time / decay tracking
    lastTickSec: -1,
    lastDecayAt: 0,

    // spawn control (time-based)
    lastSpawnAt: 0
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
      active: state.fever >= 100,
      stunActive: !!state.stunActive
    });
  }

  function setEdgeFlash(alpha){
    const a = clamp(alpha, 0, 1);
    try{ document.documentElement.style.setProperty('--edgeAlpha', String(a)); }catch(_){}
  }

  // ✅ shake stronger with fever%
  function setShakeByFever(){
    const f = clamp(state.fever, 0, 100) / 100;
    const base = state.stunActive ? 1.0 : 0.55;
    const amp = (0.2 + Math.pow(f, 1.35) * 7.2) * base; // stronger
    const x = (Math.random()*2-1) * amp;
    const y = (Math.random()*2-1) * amp;
    const r = (Math.random()*2-1) * (amp * 0.08);
    try{
      document.documentElement.style.setProperty('--shx', x.toFixed(2)+'px');
      document.documentElement.style.setProperty('--shy', y.toFixed(2)+'px');
      document.documentElement.style.setProperty('--shrot', r.toFixed(3)+'deg');
    }catch(_){}
    // edge flash pulse when high fever/stun
    if (state.stunActive) setEdgeFlash(0.75);
    else if (state.fever >= 85) setEdgeFlash(0.25 + f*0.45);
    else setEdgeFlash(0);
  }

  function addFever(v){
    state.fever = clamp(state.fever + v, 0, 100);
    if (state.fever >= 100 && !state.stunActive){
      // enter STUN
      state.stunActive = true;
      state.stunUntil = now() + STUN_DURATION_MS;
      state.fever = 100;
      setJudge('STUN!');
      syncHUD();
      FX.celebrate('STUN');
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
    el.className = 'gj-target born';
    el.textContent = emoji;

    if (kind === 'junk') el.classList.add('gj-junk');
    if (kind === 'gold') el.classList.add('gj-gold');
    if (kind === 'fake') el.classList.add('gj-fake');
    if (kind === 'power') el.classList.add('gj-power');
    if (kind === 'boss') el.classList.add('gj-boss');

    layerEl.appendChild(el);

    // fade-in
    requestAnimationFrame(()=> el.classList.remove('born'));
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
    const POWER = ['🛡️','🧲','⏱️']; // shield / magnet (sets usedMagnet) / time+
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

    // effective maxActive & spawn pacing (slower in STUN)
    const maxAct = state.stunActive ? Math.max(2, CFG.maxActive - 1) : CFG.maxActive;
    if (ACTIVE.size >= maxAct) return;

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
      (kind === 'boss') ? 1.18 :
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
      FX.burstAt(window.innerWidth*0.5, window.innerHeight*0.5, 'miss');
      syncHUD();
    }
    killTarget(t, true);
  }

  // STUN: junk near aim point auto-break
  function tryStunBreakJunk(t, sx, sy){
    if (!state.stunActive) return false;
    if (t.kind !== 'junk') return false;

    const ap = window.__GJ_AIM_POINT__;
    if (!ap) return false;

    const dx = sx - ap.x;
    const dy = sy - ap.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist <= STUN_RADIUS){
      setJudge('STUN POP!');
      FX.burstAt(sx, sy, 'stun');
      FX.scorePop(sx, sy, '+2');
      state.score += 2;

      // IMPORTANT: not a shield block, not a miss
      emit('quest:stunPop', { x:sx, y:sy });
      killTarget(t, true);
      syncHUD();
      return true;
    }
    return false;
  }

  function hitTarget(t, x, y){
    if (!t || t.dead || !state.running) return;

    // boss: multi hit
    if (t.kind === 'boss'){
      t.bossHp = (t.bossHp|0) - 1;
      if (t.bossHp > 0){
        setJudge('HIT!');
        FX.burstAt(x,y,'boss');
        FX.scorePop(x,y,`+${CFG.scoreGood|0}`);
        emit('quest:goodHit', { x, y, judgment:'good' });

        state.score += (CFG.scoreGood|0);
        state.goodHits++;
        state.combo++;
        state.comboMax = Math.max(state.comboMax, state.combo);
        addFever(+CFG.feverGain);
        syncHUD();
        return;
      }
      // boss cleared
      state.bossCleared = true;
      setJudge('BOSS!');
      FX.celebrate('BOSS');
      FX.burstAt(x,y,'bossClear');
      FX.scorePop(x,y,'+90');

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
        FX.burstAt(x,y,'block');
        FX.scorePop(x,y,'0');
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
      FX.burstAt(x,y,'junk');
      FX.scorePop(x,y,'-');
      emit('quest:badHit', { x, y, judgment:'junk' });
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
      }
      if (p === 'time'){
        state.endAt = state.endAt + 2500;
      }

      setJudge(String(p).toUpperCase());
      FX.burstAt(x,y,'power');
      FX.scorePop(x,y,'+18');

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
      FX.burstAt(x,y,'gold');
      FX.scorePop(x,y,`+${CFG.scoreGold|0}`);

      // ✅ FIX: make Gold mini work (boot listens goldHitsThisMini on quest:power power:'gold')
      emit('quest:power', { x, y, power:'gold' });
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
      FX.burstAt(x,y, perfect ? 'perfect' : 'good');
      FX.scorePop(x,y, '+' + ((CFG.scoreGood|0) + (perfect ? 6 : 0)));

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

  function updateLoop(){
    if (!state.running) return;

    const look = getLookRad(cameraEl);
    const tNow = now();

    // time tick
    const secLeft = Math.max(0, Math.ceil((state.endAt - tNow)/1000));
    if (secLeft !== state.lastTickSec){
      state.lastTickSec = secLeft;
      emit('hha:time', { sec: secLeft });
    }

    // fever decay (per second-ish)
    if (!state.lastDecayAt) state.lastDecayAt = tNow;
    if (tNow - state.lastDecayAt >= 1000){
      state.lastDecayAt = tNow;

      // STUN window drains fever faster
      if (state.stunActive){
        const left = Math.max(0, state.stunUntil - tNow);
        const pct = (left / STUN_DURATION_MS);
        state.fever = clamp(Math.round(pct * 100), 0, 100);
        if (left <= 0){
          state.stunActive = false;
          // after stun ends, keep some fever but not full
          state.fever = clamp(state.fever, 0, 45);
        }
      } else {
        state.fever = clamp(state.fever - FEVER_DECAY_PER_SEC, 0, 100);
      }
      syncHUD();
    }

    // end
    if (tNow >= state.endAt){
      state.running = false;
      emit('hha:time', { sec: 0 });
      syncHUD();

      // ✅ emit end summary
      emit('hha:end', {
        projectTag: 'HeroHealth-GoodJunkVR',
        mode: 'GoodJunkVR',
        runMode,
        diff,
        challenge,
        score: state.score|0,
        goodHits: state.goodHits|0,
        goldHits: state.goldHits|0,
        misses: state.misses|0,
        comboMax: state.comboMax|0,
        shield: state.shield|0,
        fever: state.fever|0,
        bossCleared: !!state.bossCleared,
        endedAtMs: Date.now()
      });

      // cleanup targets
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();

      // reset shake/edge
      try{
        document.documentElement.style.setProperty('--shx', '0px');
        document.documentElement.style.setProperty('--shy', '0px');
        document.documentElement.style.setProperty('--shrot', '0deg');
        setEdgeFlash(0);
      }catch(_){}

      return;
    }

    // spawn pacing (dynamic: slower when STUN)
    const spawnEff = state.stunActive ? (CFG.spawnMs * 1.45) : CFG.spawnMs;
    if ((tNow - state.lastSpawnAt) >= spawnEff){
      state.lastSpawnAt = tNow;
      spawnOne();
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
      t.el.style.left = s.x + 'px';
      t.el.style.top  = s.y + 'px';

      // STUN auto-break junk near vortex
      tryStunBreakJunk(t, s.x, s.y);
    }

    // shake/edge pulse
    setShakeByFever();

    rafId = requestAnimationFrame(updateLoop);
  }

  // init
  emit('hha:time', { sec: durationSec });
  syncHUD();
  setJudge(' ');

  rafId = requestAnimationFrame(updateLoop);

  // public api
  const api = {
    stop(){
      state.running = false;
      try{ cancelAnimationFrame(rafId); }catch(_){}
      try{ window.removeEventListener('resize', onResize); }catch(_){}
      for (const t of Array.from(ACTIVE)) killTarget(t, false);
      ACTIVE.clear();
      try{
        document.documentElement.style.setProperty('--shx', '0px');
        document.documentElement.style.setProperty('--shy', '0px');
        document.documentElement.style.setProperty('--shrot', '0deg');
        setEdgeFlash(0);
      }catch(_){}
    },
    getState(){ return { ...state, active: ACTIVE.size }; }
  };

  return api;
}
