// === Hero Health Academy — game/modes/goodjunk.js (2025-10-30)
// - Spawn เป้าภายในกรอบ #gameLayer/#spawnHost เท่านั้น (ไม่ลอยออกนอกกรอบ)
// - เอฟเฟกต์ 3D tilt + แตกกระจายตอนคลิก (ผ่าน window.HHA_FX แบบ no-duplicate)
// - Golden items, anti-spam, lifetime + expiry → นับ miss เฉพาะของดี
// - ส่งคะแนน/คอมโบผ่าน Bus.hit/Bus.miss และยิง Quests.event แบบพื้นฐาน
// - Factory adapter รองรับ main.js: create({engine,hud,coach}) -> {start,stop,update,cleanup}

import { Quests } from '../core/quests.js';

export const name = 'goodjunk';

// ---------- Safe FX bootstrap (avoid duplicate identifiers) ----------
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
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🧂','🥓','🧈','🍭','🥧','🍨','🍮','🥠','🧁'];

const GOLDEN_CHANCE = 0.08;      // 8%
const LIFE_MIN = 700, LIFE_MAX = 4500;

// ---------- Helpers ----------
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rnd = (arr)=>arr[(Math.random()*arr.length)|0];

// meta picker
export function pickMeta(diff={}, state={}){
  const r = Math.random();
  const isGood = r < 0.66; // 66% good, 34% junk (ปรับได้)
  const lifeBase = Number(diff.life)>0 ? Number(diff.life) : 2000;
  const life = clamp(lifeBase, LIFE_MIN, LIFE_MAX);
  const char = isGood ? rnd(GOOD) : rnd(JUNK);
  const golden = isGood && Math.random() < GOLDEN_CHANCE;

  return {
    id: `${isGood?'good':'junk'}_${Date.now().toString(36)}_${(Math.random()*999)|0}`,
    char,
    aria: isGood ? 'Good food' : 'Junk food',
    good: isGood,
    golden,
    life
  };
}

// onHit → return 'perfect' | 'good' | 'bad' | 'ok'
export function onHit(meta={}, sys={}, state={}, hud){
  if (!meta) return 'ok';
  if (meta.good){
    // น้ำใจให้ perfect เมื่อเป็น golden
    const perfect = !!meta.golden;
    // เคล็ดลับ/โค้ชเล็กน้อย (optional)
    try { if (perfect) state.coach?.onGood?.(); } catch{}
    // ยิงเควสต์
    try { Quests.event('hit', { result: perfect?'perfect':'good', meta, score: state.score|0 }); } catch{}
    return perfect ? 'perfect' : 'good';
  }else{
    // ขยะ → bad
    try { state.coach?.onBad?.(); } catch{}
    try { Quests.event('hit', { result: 'bad', meta, score: state.score|0 }); } catch{}
    return 'bad';
  }
}

export function init(state={}, hud, diff){
  // ไม่มี HUD เฉพาะโหมดนี้เป็นพิเศษ
}

export function cleanup(){
  // noop
}

export function tick(){
  // ไม่มี ticking พิเศษรายวินาที
}

// ------- Shared FX hooks (tilt + shatter) -------
export const fx = {
  onSpawn(el){ try{ (window?.HHA_FX?.add3DTilt||(()=>{}))(el); }catch{} },
  onHit(x,y){ try{ (window?.HHA_FX?.shatter3D||(()=>{}))(x,y); }catch{} }
};

// ============================================================================
// Factory Adapter (สำหรับ main.js DOM-spawn flow)
// ============================================================================
export function create({ engine, hud, coach }) {
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false,
    items:[],                 // { el, born, life, meta }
    stats:{ good:0, perfect:0, bad:0, miss:0 },
    coach
  };

  function start(){
    stop();
    state.running = true;
    state.items.length = 0;
    try{ init(state, hud, {}); }catch{}
    coach?.onStart?.();
  }

  function stop(){
    state.running = false;
    try { for (const it of state.items) it.el.remove(); } catch {}
    state.items.length = 0;
  }

  function spawnOne(rect, Bus){
    const meta = pickMeta({ life: 1850 }, state);

    // ใช้ขนาดจริงของ #gameLayer เพื่อกันลอยนอกกรอบ
    const r = layer.getBoundingClientRect();
    const pad = 30;
    const w = Math.max(2*pad+1, r.width|0);
    const h = Math.max(2*pad+1, r.height|0);
    const x = Math.round(pad + Math.random()*(w - 2*pad));
    const y = Math.round(pad + Math.random()*(h - 2*pad));

    const b = document.createElement('button');
    b.className='spawn-emoji';
    b.type='button';
    // วางแบบ absolute ภายใน host (ซึ่งกินพื้นที่เท่ากับ layer)
    b.style.left = x + 'px';
    b.style.top  = y + 'px';
    b.textContent = meta.char;
    b.setAttribute('aria-label', meta.aria);
    if (meta.golden) b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.85))';

    try { fx.onSpawn(b); } catch {}

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, born: performance.now(), life: meta.life, meta });

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();

      const ui = { x: ev.clientX, y: ev.clientY };
      const res = onHit(meta, { score: engine?.score, sfx: engine?.sfx }, state, hud);

      if (res==='good' || res==='perfect'){
        const pts = res==='perfect' ? 18 : 10;
        engine?.fx?.popText?.(`+${pts}${res==='perfect'?' ✨':''}`, { x: ui.x, y: ui.y, ms: 720 });
        try { fx.onHit(ui.x, ui.y); } catch {}
        state.stats[res]++; Bus?.hit?.({ kind: res, points: pts, ui, meta:{...meta, isGood:true} });
        coach?.onGood?.();
      } else if (res==='bad'){
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        state.stats.bad++; Bus?.miss?.({ meta });
        coach?.onBad?.();
      }

      try { b.remove(); } catch {}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });
  }

  function update(dt, Bus){
    if (!state.running || !layer) return;

    // cadence: เร็วขึ้นเล็กน้อยช่วงท้ายเกม
    if (!state._spawnCd) state._spawnCd = 0.18;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft <= 15 ? 0.16 : 0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(layer.getBoundingClientRect(), Bus);
      state._spawnCd = clamp(0.42 - bias + Math.random()*0.24, 0.26, 1.0);
    }

    // expiry: ของดีหมดอายุ → นับ miss; ขยะหมดอายุ → ไม่ลงโทษ
    const now = performance.now();
    const gone=[];
    for (const it of state.items){
      if (now - it.born > it.life){
        if (it.meta.good){ Bus?.miss?.({ meta:{...it.meta, reason:'expire'} }); state.stats.miss++; }
        try { it.el.remove(); } catch {}
        gone.push(it);
      }
    }
    if (gone.length){
      state.items = state.items.filter(x=>!gone.includes(x));
    }
  }

  function cleanup(){
    stop();
    try { cleanup(state, hud); } catch {}
  }

  return { start, stop, update, onClick(){}, cleanup };
}
