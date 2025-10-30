// === Hero Health Academy — game/modes/goodjunk.js (2025-10-30)
// 3D tilt on spawn, shatter on hit, score popText, FEVER, quests events,
// DOM-spawn factory adapter compatible with main.js

export const name = 'goodjunk';

// ---------- Safe FX bootstrap ----------
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
    (async () => {
      try {
        const m = await import('../core/fx.js').catch(()=>null);
        if (m) Object.assign(window.HHA_FX, m);
      } catch {}
    })();
  }
})();

// ---------- Pools ----------
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍬','🍫','🧈','🥓','🍨','🍦','🧁','🥠','🥮'];
const GOLDEN_CHANCE = 0.08;

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// ---------- Legacy-like logic ----------
export function pickMeta(diff={}, state={}){
  const goodPick = Math.random() < 0.68;
  const char = goodPick ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
  const golden = goodPick && (Math.random() < GOLDEN_CHANCE);
  const life   = clamp(Number(diff.life)||2000, 700, 4500);
  return { id:`${goodPick?'good':'junk'}_${Date.now().toString(36)}`, char, aria: goodPick?'Good':'Junk', good:goodPick, golden, life };
}

export function onHit(meta={}, systems={}, state={}, hud){
  if (!meta) return 'ok';
  // FEVER meter
  if (meta.good){
    state.fever.meter = Math.min(100, state.fever.meter + (meta.golden? 22 : 12));
    if (!state.fever.active && state.fever.meter>=100){
      state.fever.active = true; state.fever.until = performance.now() + 7000;
      try { window.HHA_QUESTS?.event?.('fever', { kind:'start' }); } catch {}
    }
    return meta.golden ? 'perfect' : 'good';
  }else{
    // soft reset
    state.fever.meter = Math.max(0, state.fever.meter - 18);
    return 'bad';
  }
}

export function tick(state={}, systems={}, hud){
  const now = performance.now();
  if (state.fever.active && now > state.fever.until){
    state.fever.active = false; state.fever.meter = 40;
    try { window.HHA_QUESTS?.event?.('fever', { kind:'end' }); } catch {}
  }
}

// ---------- Shared FX hooks ----------
export const fx = {
  onSpawn(el){ try{ (window?.HHA_FX?.add3DTilt||(()=>{}))(el); }catch{} },
  onHit(x,y){ try{ (window?.HHA_FX?.shatter3D||(()=>{}))(x,y); }catch{} }
};

// ============================================================================
// Factory Adapter (for main.js DOM-spawn flow) — DOM emoji spawner
// ============================================================================
export function create({ engine, hud, coach }){
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false, items:[],
    stats:{ good:0, perfect:0, bad:0, miss:0 },
    fever:{ active:false, meter:50, until:0 }
  };

  function start(){
    stop();
    state.running = true;
    state.items.length = 0;
    state.fever = { active:false, meter:50, until:0 };   // เริ่มที่ 50 (ตามที่ต้องการ)
    coach?.onStart?.();
  }

  function stop(){
    state.running = false;
    try{ for(const it of state.items) it.el.remove(); }catch{}
    state.items.length = 0;
  }

  function update(dt, Bus){
    if (!state.running || !layer) return;
    const now = performance.now();
    const rect = layer.getBoundingClientRect();

    // spawn cadence (+เร็วช่วงท้าย)
    if (!state._spawnCd) state._spawnCd = 0.16;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft<=15 ? 0.14 : 0;
    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.38 - bias + Math.random()*0.22, 0.24, 0.9);
    }

    // expiry
    const gone=[];
    for (const it of state.items){
      if (now - it.born > it.meta.life){
        if (it.meta.good){ Bus?.miss?.({ meta:{...it.meta, reason:'expire'} }); state.stats.miss++; }
        try{ it.el.remove(); }catch{} gone.push(it);
      }
    }
    if (gone.length){ state.items = state.items.filter(x=>!gone.includes(x)); }

    // FEVER tick
    tick(state, { score: engine?.score }, hud);
  }

  function spawnOne(rect, Bus){
    const meta = pickMeta({ life: 1800 }, state);
    const pad=30;
    const x = Math.round(pad + Math.random()*(Math.max(1, rect.width)  - pad*2));
    const y = Math.round(pad + Math.random()*(Math.max(1, rect.height) - pad*2));

    const b = document.createElement('button');
    b.className='spawn-emoji';
    b.type='button';
    b.style.left = x+'px';
    b.style.top  = y+'px';
    b.textContent = meta.char;
    b.setAttribute('aria-label', meta.aria);
    if (meta.golden) b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.85))';

    try { (window?.HHA_FX?.add3DTilt||(()=>{}))(b); } catch {}

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };
      const res = onHit(meta, { score: engine?.score, sfx: engine?.sfx }, state, hud);

      if (res==='good' || res==='perfect'){
        // คะแนนคูณถ้า FEVER
        const base = res==='perfect' ? 18 : 10;
        const mult = state.fever.active ? 2 : 1;
        const pts  = base * mult;

        engine?.fx?.popText?.(`+${pts}${state.fever.active?' 🔥':''}${res==='perfect'?' ✨':''}`, { x: ui.x, y: ui.y, ms: 700 });
        try { (window?.HHA_FX?.shatter3D||(()=>{}))(ui.x, ui.y); } catch {}

        state.stats[res]++; Bus?.hit?.({ kind: res, points: pts, ui, meta:{...meta, isGood:true, fever:state.fever.active} });
        coach?.onGood?.();
      }else{
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        state.stats.bad++; Bus?.miss?.({ meta });
        coach?.onBad?.();
      }

      try{ b.remove(); }catch{}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, born: performance.now(), meta });
  }

  function cleanup(){ stop(); }

  return { start, stop, update, onClick(){}, cleanup };
}
