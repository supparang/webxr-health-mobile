// === Hero Health Academy — game/modes/hydration.js (sync w/ latest HUD & main)
// - Relative import (../core/quests.js)
// - HUD.showHydration(zone, pct) compatible
// - Debounced zone-cross, smart-sip hints, FEVER flames on HIGH
// - Emits Quests events + optional window.HHA hooks
// - DOM-spawn factory (create) for main.js

import { Quests } from '../core/quests.js';

export const name = 'hydration';

const ZONES = { LOW:'LOW', OK:'OK', HIGH:'HIGH' };
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const zoneOf=(v,min,max)=> v<min?ZONES.LOW:(v>max?ZONES.HIGH:ZONES.OK);

let _zone = 'OK', _zoneAt = 0;
let _lastDim = 0;

/* ---------- HUD scaffold (id-stable / non-dup) ---------- */
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
      <div class="hydroBar" aria-label="hydration-bar" style="position:relative;width:min(560px,90vw);height:22px;border-radius:999px;background:linear-gradient(90deg,#6ec6ff33,#b2fab433,#ffab9133);box-shadow:0 2px 8px #0003;overflow:hidden">
        <div class="seg low"  style="position:absolute;left:0;right:66%;top:0;bottom:0;background:#6ec6ff33"></div>
        <div class="seg ok"   style="position:absolute;left:34%;right:34%;top:0;bottom:0;background:#b2fab433"></div>
        <div class="seg high" style="position:absolute;left:66%;right:0;top:0;bottom:0;background:#ffab9133"></div>
        <div class="needle" role="presentation" style="position:absolute;top:-4px;width:12px;height:30px;border-radius:12px;background:#fff;box-shadow:0 0 8px #0006"></div>
        <div class="flame" role="presentation" hidden style="position:absolute;right:6px;top:-18px;display:flex;gap:4px;filter:drop-shadow(0 2px 6px #f00)">
          <i>🔥</i><i>🔥</i><i>🔥</i>
        </div>
      </div>`;
  }
}

/* ---------- Legacy API ---------- */
export function init(state={}, hud, diff={}){
  state.hydTotalTime = (diff.time|0)||45;
  state.hyd=50; state.hydMin=35; state.hydMax=65;
  state.hydDecay=0.25; state._hydPrevZone=zoneOf(state.hyd, state.hydMin, state.hydMax);
  state.highCount=0; state.fever = state.fever||{ active:false };
  ensureHUD();
  render(state, hud);
  _zone = zoneOf(state.hyd, state.hydMin, state.hydMax); _zoneAt=performance.now(); _lastDim=0;
}
export function cleanup(state={}, hud){ try{ hud?.hideHydration?.(); }catch{} }

export function pickMeta(diff={}, state={}){
  const life = Math.max(700, Math.min(4500, Number(diff.life)||2200));
  const r=Math.random();
  if (r<0.55) return { id:'water', char:'💧', aria:'Water', good:true,      life };
  if (r<0.85) return { id:'sweet', char:'🧃', aria:'Sweet', good:false,     life };
  if (r<0.95) return { id:'ice',   char:'🧊', aria:'Ice',   good:true, booster:true, life };
  return              { id:'gold',  char:'⭐', aria:'Golden',good:true,golden:true,   life };
}

function smartHint(msg){
  let el=document.getElementById('hydroHint'); if(!el){ el=document.createElement('div'); el.id='hydroHint';
    el.style.cssText='position:fixed;left:50%;top:22%;transform:translateX(-50%);font:800 12px ui-rounded;background:rgba(0,0,0,.55);padding:6px 10px;border-radius:10px;z-index:9999;color:#fff';
    document.body.appendChild(el);
  }
  el.textContent=msg; el.style.opacity='1'; setTimeout(()=>{ el.style.opacity='0'; }, 1500);
}

export function onHit(meta={}, sys={}, state={}, hud){
  const before=state.hyd, zBefore=zoneOf(before, state.hydMin, state.hydMax);
  if (meta.id==='water'){
    const delta = zBefore===ZONES.HIGH ? +2 : +6; state.hyd = clamp(state.hyd+delta,0,100);
  }else if (meta.id==='sweet'){
    const delta = zBefore===ZONES.HIGH ? -8 : zBefore===ZONES.OK ? -3 : +4; state.hyd = clamp(state.hyd+delta,0,100);
  }else if (meta.id==='ice'){
    state.hydDecayBoostUntil = performance.now()+5000; state.hydDecay=0.1;
  }else if (meta.id==='gold'){
    if (state.hyd < state.hydMin) state.hyd = clamp(state.hyd+10,0,100);
    else if (state.hyd > state.hydMax) state.hyd = clamp(state.hyd-10,0,100);
    else state.hyd = clamp(state.hyd+6,0,100);
  }

  // Quests + optional global bus
  Quests.event('hydro_click', { zoneBefore:zBefore, kind: meta.id==='sweet'?'sweet':'water' });

  const zAfter=zoneOf(state.hyd, state.hydMin, state.hydMax);

  // small reward toward score when steering to OK
  if (zAfter===ZONES.OK){ sys.score?.addKind?.('good', { mode:'hydration' }) || sys.score?.add?.(8); }

  // smart hints (TH)
  if (zBefore===ZONES.LOW  && meta.id==='water') smartHint('✓ ดื่มน้ำถูกต้อง');
  if (zBefore===ZONES.HIGH && meta.id==='sweet') smartHint('✓ ลดความเข้มด้วยหวานเล็กน้อย');

  render(state, hud);
  if (zAfter===ZONES.OK) return (meta.golden?'perfect':'good');
  if (zBefore!==zAfter && zAfter!==ZONES.OK) return 'bad';
  return 'ok';
}

export function tick(state={}, sys={}, hud){
  const now=performance.now();
  if (state.hydDecayBoostUntil && now>state.hydDecayBoostUntil){ state.hydDecayBoostUntil=0; state.hydDecay=0.25; }
  state.hyd = clamp(state.hyd - state.hydDecay, 0, 100);
  const z = zoneOf(state.hyd, state.hydMin, state.hydMax);

  // debounce zone crossing
  if (z!==_zone && (now - _zoneAt) > 350){
    Quests.event('hydro_cross',{from:_zone,to:z});
    try { window.HHA?.hydrationCross?.(_zone, z); } catch {}
    _zone=z; _zoneAt=now;
  }
  // track HIGH time
  if (z===ZONES.HIGH){ state.highCount = (state.highCount|0)+1; }

  Quests.event('hydro_tick',{ level: state.hyd, zone: (z===ZONES.OK?'OK':z) });
  try { window.HHA?.hydrationTick?.(z); } catch {}

  // gentle penalty flash (debounced)
  if (z!==ZONES.OK && hud?.dimPenalty && (now - _lastDim) > 420){
    hud.dimPenalty(); _lastDim = now;
  }

  render(state, hud);
}

/* ---------- Visual/HUD sync ---------- */
function render(state={}, hud){
  const pct = clamp(state.hyd|0,0,100);
  const z   = zoneOf(state.hyd, state.hydMin, state.hydMax);
  try{ hud?.showHydration?.(z, pct); }catch{}

  const wrap=document.getElementById('hydroWrap'); if(!wrap) return;
  const bar=wrap.querySelector('.hydroBar'); const needle=wrap.querySelector('.needle'); const flame=wrap.querySelector('.flame');
  if (needle) needle.style.left = `calc(${pct}% - 6px)`;
  if (bar)    bar.dataset.zone = z;

  // FEVER flames only when FEVER active and zone HIGH
  const feverActive = !!state?.fever?.active;
  if (flame) flame.hidden = !(feverActive && z===ZONES.HIGH);
}

/* ========================================================================
 * Factory Adapter for DOM-spawn
 * ===================================================================== */
export function create({ engine, hud, coach }){
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false, items:[], freezeUntil:0,
    hyd:50, hydMin:35, hydMax:65, hydDecay:0.25, highCount:0,
    fever: engine?.fever || { active:false },
    stats:{ good:0, perfect:0, bad:0, miss:0 },
  };

  function start(){
    stop();
    ensureHUD(); init(state, hud, { time: (window.__HHA_TIME||45)|0, life: 2000 });
    state.running = true; coach?.onStart?.();
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

    if (!state._spawnCd) state._spawnCd = 0.16;
    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
      const bias = timeLeft<=15 ? 0.14 : 0;
      state._spawnCd = clamp(0.38 - bias + Math.random()*0.22, 0.24, 0.9);
    }

    // expire
    const gone=[];
    for (const it of state.items){
      if (now - it.born > it.meta.life){
        try{ it.el.remove(); }catch{}
        gone.push(it);
      }
    }
    if (gone.length){ state.items = state.items.filter(x=>!gone.includes(x)); }

    // (main.js จะเรียก tick(1s) อยู่แล้ว)
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

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };
      const res = onHit(meta, { score: engine?.score }, state, hud);

      if (res==='good' || res==='perfect'){
        const pts = res==='perfect'? 18 : 10;
        engine?.fx?.popText?.(`+${pts}${res==='perfect'?' ✨':''}`, { x: ui.x, y: ui.y, ms: 700 });
        state.stats[res]++; Bus?.hit?.({ kind: res, points: pts, ui, meta });
        coach?.onGood?.();
      }else if(res==='bad'){
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

  function cleanup(){ stop(); cleanup(state, hud); }

  return { start, stop, update, onClick(){}, cleanup };
}
