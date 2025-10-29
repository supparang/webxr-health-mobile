// === Hydration (smart-sip, debounce, FEVER flames, DOM-spawn) ===
import FX from '../core/fx.js';
import { Quests } from '../core/quests.js';

export const name = 'hydration';

const Z = { LOW:'LOW', OK:'OK', HIGH:'HIGH' };
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const zoneOf=(v,min,max)=> v<min?Z.LOW:(v>max?Z.HIGH:Z.OK);

function ensureHUD(){
  let wrap=document.getElementById('hydroWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='hydroWrap';
    wrap.style.cssText='position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:96;pointer-events:none';
    document.body.appendChild(wrap);
  }
  if(!wrap.querySelector('.hydroBar')){
    wrap.innerHTML = `
      <div class="hydroBar" style="position:relative;width:min(560px,90vw);height:22px;border-radius:999px;background:linear-gradient(90deg,#6ec6ff33,#b2fab433,#ffab9133);overflow:hidden">
        <div class="needle" style="position:absolute;top:-4px;width:12px;height:30px;border-radius:12px;background:#fff;box-shadow:0 0 8px #0006"></div>
        <div class="flame" hidden style="position:absolute;right:6px;top:-18px;display:flex;gap:4px;filter:drop-shadow(0 2px 6px #f00)">
          <i>🔥</i><i>🔥</i><i>🔥</i>
        </div>
      </div>`;
  }
}
function renderHUD(pct, z, fever){
  const wrap=document.getElementById('hydroWrap'); if(!wrap) return;
  const needle=wrap.querySelector('.needle'); const flame=wrap.querySelector('.flame');
  if (needle) needle.style.left = `calc(${pct}% - 6px)`;
  if (flame)  flame.hidden = !(fever && z===Z.HIGH);
}

export function create({ engine, hud, coach }){
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false, items:[],
    hyd:50, hydMin:35, hydMax:65, hydDecay:0.25, highCount:0,
    stats:{ good:0, perfect:0, bad:0, miss:0 }
  };

  function start(){
    stop(); ensureHUD();
    state.running=true; state.items.length=0;
    coach?.onStart?.(); renderHUD(state.hyd, Z.OK, false);
  }
  function stop(){
    state.running=false;
    try{ for(const it of state.items) it.el.remove(); }catch{}
    state.items.length=0;
  }

  function update(dt, Bus){
    if(!state.running || !layer) return;
    const now = performance.now();
    const rect= layer.getBoundingClientRect();

    // decay & zone
    state.hyd = clamp(state.hyd - state.hydDecay, 0, 100);
    const z = zoneOf(state.hyd, state.hydMin, state.hydMax);
    if (z===Z.HIGH) state.highCount = (state.highCount|0)+1;
    renderHUD(state.hyd|0, z, false);

    if(!state._spawnCd) state._spawnCd=0.16;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft<=15 ? 0.12 : 0;
    state._spawnCd -= dt;

    if (state._spawnCd<=0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.36 - bias + Math.random()*0.22, 0.22, 0.9);
    }

    // expiry
    const gone=[];
    for(const it of state.items){
      if(now - it.born > it.meta.life){
        try{ it.el.remove(); }catch{}
        gone.push(it);
      }
    }
    if(gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function pickMeta(){
    const life= 1900;
    const r = Math.random();
    if (r<0.60) return { id:'water', char:'💧', good:true, life };
    if (r<0.88) return { id:'sweet', char:'🧃', good:false, life };
    if (r<0.96) return { id:'ice',   char:'🧊', good:true, life, booster:true };
    return              { id:'gold',  char:'⭐', good:true, life, golden:true };
  }

  function onHit(meta){
    const before=state.hyd, zBefore=zoneOf(before, state.hydMin, state.hydMax);
    if (meta.id==='water'){
      const delta = zBefore===Z.HIGH ? +2 : +6; state.hyd = clamp(state.hyd+delta,0,100);
    } else if (meta.id==='sweet'){
      const delta = zBefore===Z.HIGH ? -8 : zBefore===Z.OK ? -3 : +4; state.hyd = clamp(state.hyd+delta,0,100);
    } else if (meta.id==='ice'){
      state.hydDecay = 0.1; setTimeout(()=>{ state.hydDecay=0.25; }, 5200);
    } else if (meta.id==='gold'){
      if (state.hyd < state.hydMin) state.hyd = clamp(state.hyd+10,0,100);
      else if (state.hyd > state.hydMax) state.hyd = clamp(state.hyd-10,0,100);
      else state.hyd = clamp(state.hyd+6,0,100);
    }
    const zAfter=zoneOf(state.hyd, state.hydMin, state.hydMax);
    renderHUD(state.hyd|0, zAfter, false);
    Quests.event('hydro_click', { zoneBefore:zBefore, kind: meta.id==='sweet'?'sweet':'water' });
    return (zAfter===Z.OK) ? (meta.golden?'perfect':'good') : (zBefore!==zAfter && zAfter!==Z.OK ? 'bad' : 'ok');
  }

  function spawnOne(rect, Bus){
    const pad=30;
    const w = Math.max(2*pad+1, (host?.clientWidth||rect.width||0));
    const h = Math.max(2*pad+1, (host?.clientHeight||rect.height||0));
    const x = Math.round(pad + Math.random()*(w-2*pad));
    const y = Math.round(pad + Math.random()*(h-2*pad));

    const meta = pickMeta();
    const b = document.createElement('button');
    b.className='spawn-emoji';
    b.type='button';
    b.style.left = x+'px';
    b.style.top  = y+'px';
    b.textContent = meta.char;
    if (meta.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';
    (host||layer).appendChild(b);
    FX.add3DTilt(b);
    state.items.push({ el:b, born: performance.now(), meta });

    b.addEventListener('click', (ev)=>{
      if(!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };
      const res = onHit(meta);

      if (res==='good' || res==='perfect'){
        const pts = res==='perfect'? 18 : 10;
        engine?.fx?.popText?.(`+${pts}${res==='perfect'?' ✨':''}`, { x: ui.x, y: ui.y, ms: 700 });
        FX.shatter3D(ui.x, ui.y);
        state.stats[res]++; Bus?.hit?.({ kind: res, points: pts, ui, meta });
        coach?.onGood?.();
      } else if (res==='bad'){
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        state.stats.bad++; Bus?.miss?.({ meta });
        coach?.onBad?.();
      }

      try{ b.remove(); }catch{}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });
  }

  function cleanup(){ stop(); }
  return { start, stop, update, cleanup };
}
