// === /HeroHealth/vr/ui-water.js (LATEST + Water Flame FX) ===
// Water Gauge (DOM) + zone-change event + BLUE FLAME burst when zone → HIGH

const ID_WRAP  = 'waterWrap';
const ID_FILL  = 'waterFill';
const ID_LABEL = 'waterLbl';
const ID_CSS   = 'waterGaugeCSS';

function injectCSS(){
  if(document.getElementById(ID_CSS)) return;
  const st = document.createElement('style'); st.id = ID_CSS;
  st.textContent = `
  #${ID_WRAP}{ position:fixed; left:50%; bottom:56px; transform:translateX(-50%);
    width:min(540px,86vw); z-index:900; color:#e8eefc; background:#0f172a99;
    border:1px solid #334155; border-radius:12px; padding:10px 12px;
    backdrop-filter:blur(6px); font-weight:800; box-shadow:0 10px 28px rgba(0,0,0,.35) }
  #${ID_WRAP} .row{ display:flex; justify-content:space-between; align-items:center; gap:8px }
  #${ID_WRAP} .bar{ height:12px; margin-top:6px; background:#0b1222; border:1px solid #334155;
    border-radius:999px; overflow:hidden }
  #${ID_FILL}{ height:100%; width:55%; transition:width .28s ease, filter .28s ease, background .28s ease }
  #${ID_WRAP}[data-zone="GREEN"] #${ID_FILL}{ background:linear-gradient(90deg,#06d6a0,#37d67a) }
  #${ID_WRAP}[data-zone="HIGH"]  #${ID_FILL}{ background:linear-gradient(90deg,#22c55e,#93c5fd) }
  #${ID_WRAP}[data-zone="LOW"]   #${ID_FILL}{ background:linear-gradient(90deg,#f59e0b,#ef4444) }

  /* === Water Flame FX === */
  .hha-water-flame{
    position:fixed; width:10px; height:16px; border-radius:10px;
    background: radial-gradient(closest-side, #7dd3fc, #3b82f6 70%, #1e3a8a);
    filter: drop-shadow(0 4px 10px rgba(56,189,248,.6));
    opacity:.9; transform:translate(-50%, -50%) scale(.7);
    pointer-events:none; z-index:950;
    animation: wfRise .7s ease-out forwards;
  }
  .hha-water-flame.sm{ width:8px; height:12px; animation-duration:.6s }
  .hha-water-flame.lg{ width:12px; height:18px; animation-duration:.8s }
  @keyframes wfRise{
    0%   { transform:translate(-50%,-50%) translateY(0) scale(.7); opacity:.0 }
    15%  { opacity:1 }
    60%  { transform:translate(-50%,-50%) translateY(-70px) scale(1.05) }
    100% { transform:translate(-50%,-50%) translateY(-110px) scale(1.15); opacity:0 }
  }
  `;
  document.head.appendChild(st);
}

export function ensureWaterGauge() {
  injectCSS();
  let wrap = document.getElementById(ID_WRAP);
  if (wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = ID_WRAP;
  wrap.setAttribute('data-hha-ui','');
  wrap.setAttribute('data-zone','GREEN'); // default
  wrap.innerHTML = `
    <div class="row"><span>Water</span><span id="${ID_LABEL}">Balanced</span></div>
    <div class="bar"><div id="${ID_FILL}" style="width:55%"></div></div>
  `;
  document.body.appendChild(wrap);
  return wrap;
}

export function destroyWaterGauge(){
  const el = document.getElementById(ID_WRAP);
  if (el) try{ el.remove(); }catch{}
}

export function zoneFrom(val){
  const v = Math.round(val|0);
  if (v >= 40 && v <= 70) return 'GREEN';
  if (v > 70) return 'HIGH';
  return 'LOW';
}

/** Blue flame particles at (x,y) screen coords */
export function waterFlameBurst(x, y, opts={}){
  const n = Math.max(10, Math.min(26, opts.count||18));
  for(let i=0;i<n;i++){
    const p = document.createElement('div');
    p.className = 'hha-water-flame' + (Math.random()<.33?' sm': (Math.random()>.66?' lg':'')); 
    p.style.left = (x|0) + 'px';
    p.style.top  = (y|0) + 'px';
    // random slight spread
    const dx = (Math.random()*26-13)|0;
    const dy = (Math.random()*10-5)|0;
    p.style.transform = `translate(${dx-50}%, ${dy-50}%) scale(${0.65 + Math.random()*0.5})`;
    document.body.appendChild(p);
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 900);
  }
}

/**
 * setWaterGauge(val:number) -> { pct, zone, label }
 * - อัปเดตเกจและยิง event 'hha:water-zone' เมื่อข้ามโซน
 * - เมื่อ zone → HIGH จะยิงเอฟเฟกต์ waterFlameBurst() อัตโนมัติ
 */
export function setWaterGauge(val){
  ensureWaterGauge();
  const wrap = document.getElementById(ID_WRAP);
  const fill = document.getElementById(ID_FILL);
  const lbl  = document.getElementById(ID_LABEL);
  if(!wrap||!fill||!lbl) return { pct:0, zone:'LOW', label:'Low' };

  const pct  = Math.max(0, Math.min(100, Math.round(val)));
  const prev = wrap.getAttribute('data-zone') || 'GREEN';
  const zone = zoneFrom(pct);

  fill.style.width = pct + '%';
  wrap.setAttribute('data-zone', zone);

  const label = (zone==='GREEN') ? 'Balanced' : (zone==='HIGH' ? 'High' : 'Low');
  lbl.textContent = label;

  if (prev !== zone){
    // Dispatch change event
    try { window.dispatchEvent(new CustomEvent('hha:water-zone', { detail:{ zone, pct, prev } })); } catch {}
    // Auto FX when entering HIGH
    if (zone === 'HIGH'){
      // burst from gauge center
      try{
        const r = wrap.getBoundingClientRect();
        const cx = Math.round(r.left + r.width/2);
        const cy = Math.round(r.top  + r.height/2);
        waterFlameBurst(cx, cy, { count: 20 });
      }catch{}
    }
  }

  return { pct, zone, label };
}

// === Small FX helpers (used elsewhere too) ===
export function floatScoreScreen(x,y,text,color){
  const el=document.createElement('div');
  el.textContent=String(text||'+10');
  Object.assign(el.style,{
    position:'fixed', left:(x||0)+'px', top:(y||0)+'px', transform:'translate(-50%, -50%)',
    font:'800 16px system-ui', color:color||'#fff', zIndex:1000,
    textShadow:'0 2px 8px rgba(0,0,0,.55)', pointerEvents:'none', transition:'all .55s ease'
  });
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.top=(y-28)+'px'; el.style.opacity='0'; });
  setTimeout(()=>{ try{el.remove();}catch{} }, 600);
}

export function burstAtScreen(x,y,opts={}){
  const count = Math.max(4, Math.min(28, opts.count||16));
  const col   = opts.color || '#22c55e';
  for(let i=0;i<count;i++){
    const p=document.createElement('div');
    Object.assign(p.style,{
      position:'fixed', left:x+'px', top:y+'px', width:'6px', height:'6px',
      borderRadius:'999px', background:col, opacity:'0.95', zIndex:999,
      transform:'translate(-50%,-50%)', transition:'all .55s ease'
    });
    document.body.appendChild(p);
    const ang=Math.random()*Math.PI*2, r=18+Math.random()*22;
    const tx = x + Math.cos(ang)*r, ty = y + Math.sin(ang)*r - 6;
    requestAnimationFrame(()=>{ p.style.left=tx+'px'; p.style.top=ty+'px'; p.style.opacity='0'; });
    setTimeout(()=>{ try{p.remove();}catch{} },600);
  }
}

export default {
  ensureWaterGauge,
  destroyWaterGauge,
  setWaterGauge,
  floatScoreScreen,
  burstAtScreen,
  zoneFrom,
  waterFlameBurst
};
