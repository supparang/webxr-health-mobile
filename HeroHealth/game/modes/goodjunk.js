// === Hero Health Academy — game/modes/goodjunk.js (2025-10-30 FX integrated) ===
export const name = 'goodjunk';

// Pools
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🍬','🍨','🥓','🌮','🥞','🍿','🍜','🍝','🥤'];

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

export function init(state={}, hud){
  state.lang = (state.lang||localStorage.getItem('hha_lang')||'TH').toUpperCase();
  state.ctx = state.ctx || {};
  state.stats = { good:0, perfect:0, bad:0, miss:0 };
  // quest chip via HUD (ถ้าระบบมี)
  try{ hud?.setQuestChips?.([{ id:'good_hits', label:(state.lang==='EN'?'Good items':'ของดี'), need:10, progress:0, icon:'✅' }]); }catch{}
}
export function cleanup(){ /* noop */ }
export function tick(){ /* noop */ }

export function pickMeta(diff={}, state={}){
  const isGood = Math.random() < 0.65;
  const char = isGood ? pick(GOOD) : pick(JUNK);
  const lifeBase = Number(diff.life)>0? Number(diff.life): 2000;
  const life = clamp(lifeBase, 700, 4500);
  const golden = isGood && Math.random() < 0.08;
  return {
    char, aria: isGood ? 'good' : 'junk', label: isGood?'GOOD':'JUNK',
    good: isGood, golden, life
  };
}

export function onHit(meta={}, sys={}, state={}, hud=null){
  if (!meta) return 'ok';
  if (meta.good){
    try { sys?.sfx?.play?.('sfx-good'); } catch {}
    return meta.golden ? 'perfect' : 'good';
  } else {
    try { sys?.sfx?.play?.('sfx-bad'); } catch {}
    return 'bad';
  }
}

// ---- Optional FX hooks for a central FX system (if present) ----
export const fx = {
  onSpawn(el){ try{ (window?.HHA_FX?.add3DTilt||(()=>{}))(el); }catch{} },
  onHit(x,y){ try{ (window?.HHA_FX?.shatter3D||(()=>{}))(x,y); }catch{} }
};

/* ========================= DOM-spawn factory ========================= */
export function create({ engine, hud, coach }) {
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false, items:[], freezeUntil:0,
    difficulty:(window.__HHA_DIFF||document.body.getAttribute('data-diff')||'Normal'),
    lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    stats:{good:0,perfect:0,bad:0,miss:0}
  };

  function start(){
    stop(); state.running=true; state.items.length=0;
    init(state, hud, {});
    coach?.onStart?.();
  }
  function stop(){
    state.running=false;
    try{ for(const it of state.items) it.el.remove(); }catch{}
    state.items.length=0;
  }

  function update(dt, Bus){
    if(!state.running||!layer) return;
    const now=performance.now(); const rect=layer.getBoundingClientRect();
    if(!state._spawnCd) state._spawnCd=0.18;
    const timeLeft=Number(document.getElementById('time')?.textContent||'0')|0;
    const speedBias = timeLeft<=15?0.16:0;
    state._spawnCd -= dt;
    if(now>=state.freezeUntil && state._spawnCd<=0){
      spawnOne(rect,Bus);
      state._spawnCd=clamp(0.44 - speedBias + Math.random()*0.20, 0.28, 1.0);
    }
    const gone=[];
    for(const it of state.items){
      if(now - it.born > it.meta.life){
        if(it.meta.good){ Bus?.miss?.({ meta:{ reason:'expire' } }); state.stats.miss++; }
        try{ it.el.remove(); }catch{} gone.push(it);
      }
    }
    if(gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(rect, Bus){
    const meta = pickMeta({ life: 1850 }, state);

    // ตำแหน่ง “ภายในกรอบเกม” จริง (ไม่หลุด)
    const pad = 30;
    const x = Math.round(pad + Math.random()*Math.max(1, rect.width  - pad*2));
    const y = Math.round(pad + Math.random()*Math.max(1, rect.height - pad*2));

    // ปุ่มเป้า
    const b = document.createElement('button');
    b.className = 'spawn-emoji';
    b.type = 'button';
    b.style.left = x + 'px';
    b.style.top  = y + 'px';
    b.textContent = meta.char;
    b.setAttribute('aria-label', meta.aria);
    if (meta.golden) b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.85))';

    // FX ตอนเกิด (glow เล็กน้อย ณ จุดเกิดบนจอ)
    try { engine?.fx?.glowAt?.(rect.left + x, rect.top + y, 'rgba(127,255,212,.45)', 360); } catch {}
    try { (window?.HHA_FX?.add3DTilt||(()=>{}))(b); } catch {}

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, born: performance.now(), meta });

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();

      const ui = { x: ev.clientX, y: ev.clientY };
      const res = onHit(meta, { score: engine?.score, sfx: engine?.sfx }, state, hud);

      if (res==='good' || res==='perfect'){
        const pts = res==='perfect'? 18 : 10;
        Bus?.hit?.({ kind: res, points: pts, ui, meta });
        coach?.onGood?.();
      } else {
        Bus?.miss?.({ meta });
        coach?.onBad?.();
      }

      try{ b.remove(); }catch{}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });
  }

  return { start, stop, update, cleanup: stop };
}
