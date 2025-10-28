// === Hero Health Academy — game/modes/goodjunk.js
// (2025-10-28) DOM-spawn version compatible with main.js factory pattern
// - Click the healthy foods (GOOD), avoid the junk (JUNK)
// - Anti-repeat emoji, soft penalty (combo reset + screen flash), golden items
// - Dynamic spawn & lifetime, end-phase speedup, freeze-on-bad 300ms
// - Uses #spawnHost inside #gameLayer; respects global HUD click-through patches

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

// Factory expected by main.js
export function create({ engine, hud, coach }) {
  const host = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running: false,
    items: [],             // { el, x, y, born, life, meta }
    spawnCd: 0,            // time until next spawn (s)
    baseSpawn: 0.85,       // base spawn interval (s)
    lifeMs: { min: 950, max: 1700 },
    freezeUntil: 0,        // performance.now() when freeze ends
    stats: { good:0, perfect:0, bad:0, miss:0 },
    _bus: null,            // set on update(dt, Bus)
    _endSpeedApplied: false
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

    // Apply end-phase speed up (last 15s): slightly faster spawns & shorter lives once
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

    // Spawn logic (skip while frozen)
    if (!frozen){
      state.spawnCd -= dt;
      if (state.spawnCd <= 0) {
        spawnOne();
        // dynamic spawn based on very rough “heat” (fever bar ~ via recent clicks)
        const heat = 0.5; // could be mapped from App.fever via Bus.hud later
        const jitter = (Math.random()*0.25);
        state.spawnCd = clamp(state.baseSpawn - heat*0.12 + jitter, 0.38, 1.2);
      }
    }

    // Tick life & cull
    const toRemove = [];
    const rect = layer.getBoundingClientRect();
    for (const it of state.items){
      if (now - it.born > it.life) {
        // timed out → miss if it was GOOD (we missed a healthy choice)
        toRemove.push(it);
        if (it.meta.good) {
          Bus?.miss?.();
          state.stats.miss++;
        }
        try { it.el.remove(); } catch {}
      } else {
        // soft idle animation optional (skip for perf)
        // it.el.style.translate = `0 ${Math.sin((now-it.born)/220)*2}px`;
      }
    }
    // purge
    if (toRemove.length){
      state.items = state.items.filter(x=>!toRemove.includes(x));
    }

    // Keep items inside gameplay bounds (defensive on resize)
    for (const it of state.items){
      // if parent layout changed, clamp positions
      const w = rect.width, h = rect.height;
      const pad = 24;
      if (it.x < pad || it.x > w-pad || it.y < pad || it.y > h-pad){
        it.x = clamp(it.x, pad, w-pad);
        it.y = clamp(it.y, pad, h-pad);
        it.el.style.left = it.x + 'px';
        it.el.style.top  = it.y + 'px';
      }
    }
  }

  function onClick(x, y){ /* mode handles per-item clicks via button listeners */ }

  /* ---------------- internals ---------------- */

  function spawnOne(){
    if (!host) return;
    const rect = layer.getBoundingClientRect();
    const pad = 32;
    const x = Math.round(pad + Math.random()*(rect.width - pad*2));
    const y = Math.round(pad + Math.random()*(rect.height - pad*2));

    // 60% good, 40% junk
    const isGood = Math.random() < 0.60;
    const char = isGood ? pickNonRepeat(GOOD) : pickNonRepeat(JUNK);
    const golden = isGood && Math.random() < 0.06;

    const life = clamp( Math.round(rand(state.lifeMs.min, state.lifeMs.max)), 650, 2600 );

    const b = document.createElement('button');
    b.className = 'spawn-emoji';
    b.type = 'button';
    b.style.left = x + 'px';
    b.style.top  = y + 'px';
    b.textContent = char;
    if (golden) {
      b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.85))';
      b.setAttribute('aria-label', 'Golden Healthy');
    } else {
      b.setAttribute('aria-label', isGood ? 'Healthy' : 'Junk');
    }

    // Click handler
    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();

      const ui = { x: ev.clientX, y: ev.clientY };
      if (isGood){
        // base points + golden bonus
        const pts = golden ? 20 : 10;
        state.stats[ golden ? 'perfect' : 'good' ]++;
        // FEEDBACK
        engine.fx.spawnShards(ui.x, ui.y, { count: golden ? 42 : 26 });
        engine.fx.popText(`+${pts}${golden?' ✨':''}`, { x: ui.x, y: ui.y, ms: 700 });
        // Coach
        if (golden) coach.onPerfect(); else coach.onGood();
        // Score via bus
        state._bus?.hit?.({ kind: golden ? 'perfect' : 'good', points: pts, ui });
      } else {
        // BAD: soft penalty (reset combo handled in bus.miss), short freeze
        state.stats.bad++;
        document.body.classList.add('flash-danger');
        setTimeout(()=> document.body.classList.remove('flash-danger'), 160);
        state.freezeUntil = Math.max(state.freezeUntil, performance.now() + 300);
        coach.onBad();
        state._bus?.miss?.();
      }

      // remove clicked
      try { b.remove(); } catch {}
      const idx = state.items.findIndex(it=>it.el===b);
      if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });

    host.appendChild(b);

    // track
    state.items.push({
      el: b,
      x, y,
      born: performance.now(),
      life,
      meta: { good: isGood, golden, char }
    });
  }

  function clearAll(){
    // remove DOM elements
    try {
      for (const it of state.items) it.el.remove();
    } catch {}
    state.items.length = 0;
  }

  function cleanup(){
    clearAll();
    state.freezeUntil = 0;
  }

  function rand(a,b){ return a + Math.random()*(b-a); }

  // Public mode surface
  return { start, stop, update, onClick, cleanup };
}
