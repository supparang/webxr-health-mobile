// === Hero Health Academy — game/modes/goodjunk.js
// (2025-10-29) DOM-spawn version — safe bounds + preflight + 3D tilt hook
// - Click healthy foods (GOOD), avoid JUNK
// - Anti-repeat, soft penalty (flash + short freeze), golden items
// - End-phase speedup (≤15s), spawn bound to #gameLayer, items live inside frame

export const name = 'goodjunk';

// Pools
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🍜','🍝🧈','🍧','🍨','🍮','🥓','🍗🧈','🍞🍯','🧂'];

let _lastEmoji = null;
function pickNonRepeat(pool){
  let e, tries=0;
  do { e = pool[(Math.random()*pool.length)|0]; } while (e===_lastEmoji && tries++<3);
  _lastEmoji = e; return e;
}
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const rand  = (a,b)=> a + Math.random()*(b-a);

// Factory expected by main.js
export function create({ engine, hud, coach }) {
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running: false,
    items: [],             // { el, x, y, born, life, meta }
    spawnCd: 0,
    baseSpawn: 0.85,
    lifeMs: { min: 980, max: 1700 },
    freezeUntil: 0,
    stats: { good:0, perfect:0, bad:0, miss:0 },
    _bus: null,
    _endSpeedApplied: false
  };

  // ---- helpers ----
  const safeRect = ()=> {
    const r = layer?.getBoundingClientRect?.() || { width:0, height:0, left:0, top:0 };
    return (r.width>=50 && r.height>=50) ? r : null;
  };

  function start(opts={}){
    cleanup(); // ensure clean
    state.running = true;
    state.items.length = 0;
    state.spawnCd = 0.2;
    state.baseSpawn = 0.85;
    state.lifeMs = { min: 980, max: 1700 };
    state.freezeUntil = 0;
    state.stats = { good:0, perfect:0, bad:0, miss:0 };
    state._endSpeedApplied = false;

    // Ensure host layout (click-through on host; targets clickable)
    if (host){
      host.style.position = 'absolute';
      host.style.inset = '0';
      host.style.pointerEvents = 'none';
      host.style.zIndex = '28';
    }

    // Preflight: wait one frame if play area not measurable yet
    if (!safeRect()){
      requestAnimationFrame(()=>{ state.spawnCd = 0.05; });
    }

    // HUD cues
    hud.setTarget('—');
    hud.hidePills();
    coach.sayKey?.('start');
  }

  function stop(){
    state.running = false;
    clearAll();
  }

  function update(dt, Bus){
    if (!state.running) return;
    state._bus = Bus;

    // End-phase speed up (last 15s)
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    if (!state._endSpeedApplied && timeLeft <= 15) {
      state._endSpeedApplied = true;
      state.baseSpawn = Math.max(0.55, state.baseSpawn - 0.18);
      state.lifeMs.min = Math.max(750, state.lifeMs.min - 150);
      state.lifeMs.max = Math.max(1200, state.lifeMs.max - 220);
    }

    // Freeze short pause after bad click
    const now = performance.now();
    const frozen = now < state.freezeUntil;

    // Spawn logic (skip while frozen / when playarea invalid)
    if (!frozen){
      state.spawnCd -= dt;
      if (state.spawnCd <= 0) {
        if (safeRect()){
          spawnOne();
          // dynamic spawn cadence
          const heat = 0.5; // TODO: map from fever in Bus if available
          const jitter = (Math.random()*0.25);
          state.spawnCd = clamp(state.baseSpawn - heat*0.12 + jitter, 0.38, 1.2);
        } else {
          state.spawnCd = 0.08; // retry soon after layout settles
        }
      }
    }

    // Tick life & cull
    const r = safeRect();
    const now2 = performance.now();
    const toRemove = [];
    for (const it of state.items){
      if (now2 - it.born > it.life) {
        toRemove.push(it);
        if (it.meta.good) {
          state.stats.miss++;
          state._bus?.miss?.();
        }
        try { it.el.remove(); } catch {}
      } else if (r) {
        // keep items inside bounds if container resized
        const pad = 24;
        if (it.x < pad || it.x > r.width-pad || it.y < pad || it.y > r.height-pad){
          it.x = clamp(it.x, pad, r.width - pad);
          it.y = clamp(it.y, pad, r.height - pad);
          it.el.style.left = it.x + 'px';
          it.el.style.top  = it.y + 'px';
        }
      }
    }
    if (toRemove.length){
      state.items = state.items.filter(x=>!toRemove.includes(x));
    }
  }

  function onClick(x, y){ /* per-item buttons handle clicks */ }

  /* ---------------- internals ---------------- */

  function spawnOne(){
    if (!host) return;
    const rect = safeRect();
    if (!rect){ state.spawnCd = 0.08; return; }

    const pad = 32;
    const x = Math.round(pad + Math.random()*(rect.width  - pad*2));
    const y = Math.round(pad + Math.random()*(rect.height - pad*2));

    // 60% good, 40% junk
    const isGood = Math.random() < 0.60;
    const char = isGood ? pickNonRepeat(GOOD) : pickNonRepeat(JUNK);
    const golden = isGood && Math.random() < 0.06;

    const life = clamp(Math.round(rand(state.lifeMs.min, state.lifeMs.max)), 650, 2600);

    const b = document.createElement('button');
    b.className = 'spawn-emoji';
    b.type = 'button';
    b.style.left = x + 'px';
    b.style.top  = y + 'px';
    b.style.pointerEvents = 'auto';
    b.style.transform = 'translateZ(0)'; // ensure in 3D plane
    b.textContent = char;
    if (golden) {
      b.style.filter = 'drop-shadow(0 0 12px rgba(255,215,0,.9))';
      b.setAttribute('aria-label', 'Golden Healthy');
    } else {
      b.setAttribute('aria-label', isGood ? 'Healthy' : 'Junk');
    }

    // Optional: 3D tilt if fx module present
    try { window?.HHA_FX?.add3DTilt?.(b, { maxTilt: 10 }); } catch {}

    // Click handler
    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();

      const ui = { x: ev.clientX, y: ev.clientY };
      if (isGood){
        const pts = golden ? 20 : 10;
        state.stats[ golden ? 'perfect' : 'good' ]++;

        // FX
        try { engine.fx.spawnShards(ui.x, ui.y, { count: golden ? 42 : 26 }); } catch {}
        try { engine.fx.popText(`+${pts}${golden?' ✨':''}`, { x: ui.x, y: ui.y, ms: 720 }); } catch {}

        // Bus / Coach
        state._bus?.hit?.({ kind: golden ? 'perfect' : 'good', points: pts, ui });
        try { golden ? coach.onPerfect?.() : coach.onGood?.(); } catch {}
      } else {
        // BAD
        state.stats.bad++;
        document.body.classList.add('flash-danger');
        setTimeout(()=> document.body.classList.remove('flash-danger'), 160);
        state.freezeUntil = Math.max(state.freezeUntil, performance.now() + 300);
        state._bus?.miss?.();
        try { coach.onBad?.(); } catch {}
      }

      // remove clicked
      try { b.remove(); } catch {}
      const idx = state.items.findIndex(it=>it.el===b);
      if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });

    host.appendChild(b);

    // track
    state.items.push({
      el: b, x, y,
      born: performance.now(),
      life,
      meta: { good: isGood, golden, char }
    });
  }

  function clearAll(){
    try { for (const it of state.items) it.el.remove(); } catch {}
    state.items.length = 0;
  }

  function cleanup(){
    clearAll();
    state.freezeUntil = 0;
  }

  // Public surface
  return { start, stop, update, onClick, cleanup };
}
