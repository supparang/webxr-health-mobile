// === /HeroHealth/vr/ui-water.js ===
// Water Gauge (DOM) + small screen FX

export function ensureWaterGauge() {
  destroyWaterGauge();
  const wrap = document.createElement('div');
  wrap.id = 'waterWrap';
  wrap.setAttribute('data-hha-ui','');
  Object.assign(wrap.style, {
    position:'fixed', left:'50%', bottom:'56px', transform:'translateX(-50%)',
    width:'min(540px,86vw)', zIndex:'900', color:'#e8eefc',
    background:'#0f172a99', border:'1px solid #334155', borderRadius:'12px',
    padding:'10px 12px', backdropFilter:'blur(6px)', fontWeight:'800'
  });
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>Water</span><span id="waterLbl">Balanced</span>
    </div>
    <div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
      <div id="waterFill" style="height:100%;width:55%;background:linear-gradient(90deg,#06d6a0,#37d67a)"></div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

export function destroyWaterGauge(){
  const el = document.getElementById('waterWrap');
  if (el) try{ el.remove(); }catch{}
}

export function setWaterGauge(val){
  const f=document.getElementById('waterFill'), l=document.getElementById('waterLbl');
  if(!f||!l) return;
  const pct=Math.max(0,Math.min(100,Math.round(val)));
  f.style.width=pct+'%';
  let zone='Low'; if(pct>=40&&pct<=70) zone='Balanced'; else if(pct>70) zone='High';
  l.textContent=zone;
  f.style.background=(zone==='Balanced')
    ? 'linear-gradient(90deg,#06d6a0,#37d67a)'
    : (zone==='High' ? 'linear-gradient(90deg,#22c55e,#93c5fd)'
                     : 'linear-gradient(90deg,#f59e0b,#ef4444)');
}

export function zoneFrom(val){
  return (val>=40&&val<=70)?'GREEN':(val>70?'HIGH':'LOW');
}

export function floatScoreScreen(x,y,text,color){
  const el=document.createElement('div');
  el.textContent=String(text||'+10');
  Object.assign(el.style,{
    position:'fixed', left:(x||0)+'px', top:(y||0)+'px', transform:'translate(-50%, -50%)',
    font:'800 16px system-ui', color:color||'#fff', zIndex:1000,
    textShadow:'0 2px 8px rgba(0,0,0,.55)', pointerEvents:'none', transition:'all .55s ease'
  });
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.top=(y-28)+'px'; el.style.opacity='0'; }, 20);
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
    setTimeout(()=>{ p.style.left=tx+'px'; p.style.top=ty+'px'; p.style.opacity='0'; },20);
    setTimeout(()=>{ try{p.remove();}catch{} },600);
  }
}

// default สำหรับ import แบบ default ก็ใช้ได้
export default {
  ensureWaterGauge,
  destroyWaterGauge,
  setWaterGauge,
  floatScoreScreen,
  burstAtScreen,
  zoneFrom
};
