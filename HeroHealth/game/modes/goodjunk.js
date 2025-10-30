// === Hero Health Academy — game/modes/goodjunk.js (2025-10-30)
// - 3D tilt + shatter FX (guarded)
// - Spawn ภายใน #spawnHost/#gameLayer จริง (clamp rect)
// - golden item, life expiry (ไม่ค้าง), คะแนน/คอมโบผ่าน Bus
// - Mini Quests: count_good, count_perfect, reach_combo, count_golden พร้อม

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
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑','🫘'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🍮','🍨','🌮','🌯','🧂','🥓','🥠','🧈','🍬'];

const GOLDEN_CHANCE = 0.08;
const LIFE_DEFAULT  = 1900; // ms
const PAD = 30;

// ---------- Helpers ----------
const clamp = (n,a,b)=>Math.max(a, Math.min(b,n));
const pick  = (arr)=>arr[(Math.random()*arr.length)|0];

function pickMeta({life=LIFE_DEFAULT}={}, state={}){
  // 70% good, 30% junk
  const isGood = Math.random() < 0.7;
  const char   = isGood ? pick(GOOD) : pick(JUNK);
  const golden = isGood && (Math.random() < GOLDEN_CHANCE);

  return {
    id: `gj_${Date.now().toString(36)}_${(Math.random()*999)|0}`,
    char,
    aria: isGood ? 'good' : 'junk',
    label: isGood ? 'good' : 'junk',
    isGood,
    good: isGood,         // compatibility for quests
    golden,
    life: clamp(life, 700, 4500)
  };
}

// ---------- Legacy APIs (for compatibility) ----------
export function init(/*state, hud*/){}
export function cleanup(){}
export function tick(){}

// ---------- FX hooks ----------
export const fx = {
  onSpawn(el){ try{ (window?.HHA_FX?.add3DTilt||(()=>{}))(el); }catch{} },
  onHit(x,y){ try{ (window?.HHA_FX?.shatter3D||(()=>{}))(x,y); }catch{} }
};

// ---------- Factory adapter ----------
export function create({ engine, hud, coach }){
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false,
    items:[],                 // {el, born, life, meta}
    stats:{good:0,perfect:0,bad:0,miss:0},
    spawnCd:0.2
  };

  function start(){
    stop();
    state.running = true;
    state.items.length = 0;
    state.stats = {good:0,perfect:0,bad:0,miss:0};
    coach?.onStart?.();
  }

  function stop(){
    state.running = false;
    try{ for(const it of state.items) it.el.remove(); }catch{}
    state.items.length = 0;
  }

  function update(dt, Bus){
    if (!state.running || !layer) return;

    // cadence (เร็วขึ้นช่วงท้าย)
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft<=15 ? 0.14 : 0;

    state.spawnCd -= dt;
    if (state.spawnCd <= 0){
      spawnOne(Bus);
      state.spawnCd = clamp(0.40 - bias + Math.random()*0.22, 0.26, 0.95);
    }

    // expiry
    const now = performance.now();
    const gone = [];
    for (const it of state.items){
      if (now - it.born > it.life){
        if (it.meta.isGood){ Bus?.miss?.({ meta:{reason:'expire'} }); state.stats.miss++; }
        try{ it.el.remove(); }catch{}
        gone.push(it);
      }
    }
    if (gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(Bus){
    const meta = pickMeta({ life: LIFE_DEFAULT });

    // ใช้ขนาด host ถ้ามี ไม่งั้น fallback เป็น layer
    const ref = host || layer;
    const rect = ref?.getBoundingClientRect?.() || { width: (host?.clientWidth||layer?.clientWidth||640), height:(host?.clientHeight||layer?.clientHeight||360) };

    const w = Math.max(2*PAD + 1, (ref?.clientWidth  || rect.width  || 0));
    const h = Math.max(2*PAD + 1, (ref?.clientHeight || rect.height || 0));
    const x = Math.round(PAD + Math.random()*(w - 2*PAD));
    const y = Math.round(PAD + Math.random()*(h - 2*PAD));

    const b = document.createElement('button');
    b.className = 'spawn-emoji';
    b.type = 'button';
    b.style.position = 'absolute';
    b.style.left = x + 'px';
    b.style.top  = y + 'px';
    b.style.transform = 'translate(-50%, -50%)'; // center at point
    b.textContent = meta.char;
    b.setAttribute('aria-label', meta.aria);

    // 3D look & golden glow
    try{ (window?.HHA_FX?.add3DTilt||(()=>{}))(b); }catch{}
    if (meta.golden){
      b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.9))';
      b.style.fontSize = '2.1rem';
    }

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, born: performance.now(), life: meta.life, meta });

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();

      const ui = { x: ev.clientX, y: ev.clientY };
      let result='bad', pts=0;

      if (meta.isGood){
        result = meta.golden ? 'perfect' : 'good';
        pts    = meta.golden ? 20 : 10;
      } else {
        result = 'bad';
        pts    = 0;
      }

      if (result==='good' || result==='perfect'){
        engine?.score?.add?.(pts);
        engine?.fx?.popText?.(`+${pts}${result==='perfect'?' ✨':''}`, { x: ui.x, y: ui.y, ms: 720 });
        try{ (window?.HHA_FX?.shatter3D||(()=>{}))(ui.x, ui.y); }catch{}
        state.stats[result]++; Bus?.hit?.({ kind: result, points: pts, ui, meta: { ...meta, isGood:true } });
        coach?.onGood?.();
      } else {
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),160);
        state.stats.bad++; Bus?.miss?.({ meta: { ...meta, isGood:false } });
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
