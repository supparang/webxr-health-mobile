// === /HeroHealth/vr/ui-water.js (LATEST, smooth + zone events) ===
// Water Gauge (DOM) + small screen FX + zone-change event

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
  `;
  document.head.appendChild(st);
}

export function ensureWaterGauge() {
  injectCSS();
  // ถ้ามีอยู่แล้ว ไม่ต้องสร้างใหม่
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

/**
 * setWaterGauge(val:number) -> { pct:number, zone:string, label:string }
 * - อัปเดตเกจและส่งอีเวนต์ 'hha:water-zone' เมื่อข้ามโซน
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
    try { window.dispatchEvent(new CustomEvent('hha:water-zone', { detail:{ zone, pct, prev } })); } catch {}
  }

  return { pct, zone, label };
}

// === Small FX helpers ===
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
  zoneFrom
};
