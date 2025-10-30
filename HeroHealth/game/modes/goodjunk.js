// === Hero Health Academy — game/modes/goodjunk.js (2025-10-30)
// DOM-spawn ภายใน #gameLayer/#spawnHost | ใช้ FX จาก core/fx.js ผ่าน engine.fx
// - เป้าดี/เป้าขยะ + golden
// - คลิกแล้วแตกกระจาย + popText คะแนน
// - ไม่ลอยออกนอกกรอบเกม, หมดเวลาแล้วลบเอง

export const name = 'goodjunk';

// Pools
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍬','🍫','🧁','🥓','🍨','🍿','🥮','🥠','🍭','🥯','🧈'];

const RATIO_GOOD = 0.62;     // โอกาสเกิดของฝั่งดี
const GOLDEN_CHANCE = 0.08;  // โอกาสทอง
const LIFE_MS = 1850;        // อายุของไอคอนแต่ละตัว

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

export function create({ engine, hud, coach }) {
  const layer = document.getElementById('gameLayer');
  const host  = document.getElementById('spawnHost');

  const state = {
    running:false,
    items:[], // { el, born, life, meta:{char,good,golden,aria} }
    stats:{ good:0, perfect:0, bad:0, miss:0 },
  };

  function start() {
    stop();
    state.running = true;
    state.items.length = 0;
    coach?.onStart?.();
  }

  function stop() {
    state.running = false;
    try { for (const it of state.items) it.el.remove(); } catch {}
    state.items.length = 0;
  }

  function update(dt, Bus){
    if (!state.running || !layer) return;

    const now  = performance.now();
    const rect = layer.getBoundingClientRect();

    // spawn cadence
    if (!state._cd) state._cd = 0.18;
    state._cd -= dt;
    const bias = (Number(document.getElementById('time')?.textContent||'0')|0) <= 15 ? 0.14 : 0;
    if (state._cd <= 0){
      spawnOne(rect, Bus);
      state._cd = clamp(0.40 - bias + Math.random()*0.22, 0.26, 0.95);
    }

    // expiry (นับ miss เฉพาะเป้าที่เป็นฝั่งดี)
    const gone=[];
    for (const it of state.items){
      if (now - it.born > it.life){
        if (it.meta.good){ Bus?.miss?.({ meta:{ reason:'expire' } }); state.stats.miss++; }
        try{ it.el.remove(); }catch{}
        gone.push(it);
      }
    }
    if (gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(rect, Bus){
    const isGood = Math.random() < RATIO_GOOD;
    const pool   = isGood ? GOOD : JUNK;
    const char   = pool[(Math.random()*pool.length)|0];
    const golden = isGood && Math.random() < GOLDEN_CHANCE;

    // พิกัดกลางใน host (ไม่ลอยนอกกรอบ)
    const pad = 30;
    const w = Math.max(2*pad + 1, (host?.clientWidth  || rect.width  || 0));
    const h = Math.max(2*pad + 1, (host?.clientHeight || rect.height || 0));
    const cx = Math.round(pad + Math.random() * (w - 2*pad));
    const cy = Math.round(pad + Math.random() * (h - 2*pad));

    const b = document.createElement('button');
    b.className = 'spawn-emoji';
    b.type = 'button';
    // ใช้ left/top = จุดกลาง + translate(-50%,-50%) ใน CSS
    b.style.left = cx + 'px';
    b.style.top  = cy + 'px';
    b.textContent = char;
    b.setAttribute('aria-label', isGood ? 'Good' : 'Junk');
    if (golden) b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.85))';

    // 3D tilt โดยใช้ engine.fx (เรียก core/fx.js)
    try { engine?.fx?.add3DTilt?.(b); } catch {}

    (host||layer)?.appendChild?.(b);

    const meta = { char, good:isGood, golden, aria: isGood?'Good':'Junk' };
    const item = { el:b, born: performance.now(), life: LIFE_MS, meta };
    state.items.push(item);

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };

      if (meta.good){
        const kind   = meta.golden ? 'perfect' : 'good';
        const points = meta.golden ? 18 : 10;

        engine?.fx?.popText?.(`+${points}${meta.golden?' ✨':''}`, { x: ui.x, y: ui.y, ms: 720 });
        engine?.fx?.shatter3D?.(ui.x, ui.y);

        state.stats[kind] = (state.stats[kind]||0) + 1;
        Bus?.hit?.({ kind, points, ui, meta });
        if (meta.golden) coach?.onPerfect?.(); else coach?.onGood?.();
      } else {
        // junk → bad (ไม่คิดคะแนน, คอมโบ reset โดย Bus.miss ใน main)
        document.body.classList.add('flash-danger');
        setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        state.stats.bad++;
        Bus?.miss?.({ meta });
        coach?.onBad?.();
      }

      try{ b.remove(); }catch{}
      const idx = state.items.findIndex(it=>it.el===b);
      if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });
  }

  function cleanup(){ stop(); }

  return { start, stop, update, cleanup };
}
