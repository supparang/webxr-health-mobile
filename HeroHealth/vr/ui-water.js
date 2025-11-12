// === /HeroHealth/vr/ui-water.js (HIGH zone: Blue Flame + Water Splash) ===

const ID_WRAP='waterWrap', ID_FILL='waterFill', ID_LABEL='waterLbl', ID_CSS='waterGaugeCSS';

function injectCSS(){
  if(document.getElementById(ID_CSS)) return;
  const st=document.createElement('style'); st.id=ID_CSS;
  st.textContent=`
  #${ID_WRAP}{position:fixed;left:50%;bottom:56px;transform:translateX(-50%);
    width:min(540px,86vw);z-index:900;color:#e8eefc;background:#0f172a99;border:1px solid #334155;
    border-radius:12px;padding:10px 12px;backdrop-filter:blur(6px);font-weight:800;box-shadow:0 10px 28px rgba(0,0,0,.35)}
  #${ID_WRAP} .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
  #${ID_WRAP} .bar{height:12px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden}
  #${ID_FILL}{height:100%;width:55%;transition:width .28s ease, filter .28s ease, background .28s ease}
  #${ID_WRAP}[data-zone="GREEN"] #${ID_FILL}{background:linear-gradient(90deg,#06d6a0,#37d67a)}
  #${ID_WRAP}[data-zone="HIGH"]  #${ID_FILL}{background:linear-gradient(90deg,#22c55e,#93c5fd)}
  #${ID_WRAP}[data-zone="LOW"]   #${ID_FILL}{background:linear-gradient(90deg,#f59e0b,#ef4444)}

  /* === Blue Flame === */
  .hha-water-flame{
    position:fixed;width:10px;height:16px;border-radius:10px;
    background:radial-gradient(closest-side,#7dd3fc,#3b82f6 70%,#1e3a8a);
    filter:drop-shadow(0 4px 10px rgba(56,189,248,.6));
    opacity:.9;transform:translate(-50%,-50%) scale(.7);pointer-events:none;z-index:950;
    animation:wfRise .7s ease-out forwards;
  }
  .hha-water-flame.sm{width:8px;height:12px;animation-duration:.6s}
  .hha-water-flame.lg{width:12px;height:18px;animation-duration:.8s}
  @keyframes wfRise{
    0%{transform:translate(-50%,-50%) translateY(0) scale(.7);opacity:0}
    15%{opacity:1}
    60%{transform:translate(-50%,-50%) translateY(-70px) scale(1.05)}
    100%{transform:translate(-50%,-50%) translateY(-110px) scale(1.15);opacity:0}
  }

  /* === Water Splash (droplets) === */
  .hha-water-splash{
    position:fixed;width:14px;height:9px;border-radius:50% 50% 60% 60%;
    background:radial-gradient(closest-side,#e0f2fe,#93c5fd 70%,#60a5fa);
    opacity:.95;pointer-events:none;z-index:951;transform:translate(-50%,-50%) rotate(0deg);
    box-shadow:0 2px 8px rgba(59,130,246,.45);
    animation:wsArc .55s ease-out forwards;
  }
  .hha-water-splash.sm{width:10px;height:7px;animation-duration:.48s}
  .hha-water-splash.lg{width:18px;height:12px;animation-duration:.62s}
  @keyframes wsArc{
    0%{transform:translate(-50%,-50%) translate(0,0) rotate(0deg);opacity:0}
    8%{opacity:1}
    70%{opacity:.98}
    100%{transform:translate(-50%,-50%) translate(var(--tx),var(--ty)) rotate(var(--rot));opacity:0}
  }
  `;
  document.head.appendChild(st);
}

export function ensureWaterGauge(){
  injectCSS();
  let wrap=document.getElementById(ID_WRAP);
  if(wrap) return wrap;
  wrap=document.createElement('div');
  wrap.id=ID_WRAP; wrap.setAttribute('data-hha-ui',''); wrap.setAttribute('data-zone','GREEN');
  wrap.innerHTML=`<div class="row"><span>Water</span><span id="${ID_LABEL}">Balanced</span></div>
                  <div class="bar"><div id="${ID_FILL}" style="width:55%"></div></div>`;
  document.body.appendChild(wrap);
  return wrap;
}

export function destroyWaterGauge(){ const el=document.getElementById(ID_WRAP); if(el) try{el.remove();}catch{} }

export function zoneFrom(val){
  const v=Math.round(val|0);
  if(v>=40&&v<=70) return 'GREEN';
  if(v>70) return 'HIGH';
  return 'LOW';
}

/* ----- FX: Blue flame pillars ----- */
export function waterFlameBurst(x,y,opts={}){
  const n=Math.max(10,Math.min(26,opts.count||18));
  for(let i=0;i<n;i++){
    const p=document.createElement('div');
    p.className='hha-water-flame'+(Math.random()<.33?' sm':(Math.random()>.66?' lg':''));
    p.style.left=(x|0)+'px'; p.style.top=(y|0)+'px';
    const dx=(Math.random()*26-13)|0, dy=(Math.random()*10-5)|0;
    p.style.transform=`translate(${dx-50}%, ${dy-50}%) scale(${0.65+Math.random()*0.5})`;
    document.body.appendChild(p);
    setTimeout(()=>{ try{p.remove();}catch{} },900);
  }
}

/* ----- NEW FX: Water splash droplets (angled arcs) ----- */
export function waterSplashBurst(x,y,opts={}){
  const n=Math.max(8,Math.min(24,opts.count||16));
  for(let i=0;i<n;i++){
    const d=document.createElement('div');
    d.className='hha-water-splash'+(Math.random()<.3?' sm':(Math.random()>.7?' lg':''));
    d.style.left=(x|0)+'px'; d.style.top=(y|0)+'px';
    // โค้งเฉียงแบบกระเซ็น: ระยะและมุมสุ่มเล็กน้อย
    const ang=(Math.random()*Math.PI/2) - Math.PI/4; // -45°..+45°
    const pow=40 + Math.random()*60;                  // ระยะพุ่ง
    const tx=Math.round(Math.cos(ang)*pow);
    const ty=Math.round(-Math.sin(ang)*pow - (20+Math.random()*20)); // พุ่งขึ้นเล็กน้อย
    const rot=(ang*180/Math.PI)*(0.6+Math.random()*0.8);
    d.style.setProperty('--tx', tx+'px');
    d.style.setProperty('--ty', ty+'px');
    d.style.setProperty('--rot', rot+'deg');
    document.body.appendChild(d);
    setTimeout(()=>{ try{d.remove();}catch{} },650);
  }
}

/**
 * setWaterGauge(val:number) -> { pct, zone, label }
 * - อัปเดตเกจและยิง 'hha:water-zone' เมื่อเปลี่ยนโซน
 * - เมื่อ zone → HIGH จะยิงทั้ง waterFlameBurst() และ waterSplashBurst()
 */
export function setWaterGauge(val){
  ensureWaterGauge();
  const wrap=document.getElementById(ID_WRAP);
  const fill=document.getElementById(ID_FILL);
  const lbl =document.getElementById(ID_LABEL);
  if(!wrap||!fill||!lbl) return { pct:0, zone:'LOW', label:'Low' };

  const pct=Math.max(0,Math.min(100,Math.round(val)));
  const prev=wrap.getAttribute('data-zone')||'GREEN';
  const zone=zoneFrom(pct);

  fill.style.width=pct+'%';
  wrap.setAttribute('data-zone',zone);
  const label=(zone==='GREEN')?'Balanced':(zone==='HIGH'?'High':'Low');
  lbl.textContent=label;

  if(prev!==zone){
    try{ window.dispatchEvent(new CustomEvent('hha:water-zone',{detail:{zone,pct,prev}})); }catch{}
    if(zone==='HIGH'){
      try{
        const r=wrap.getBoundingClientRect();
        const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
        waterFlameBurst(cx,cy,{count:20});
        waterSplashBurst(cx,cy,{count:16}); // 👈 ชั้นละอองน้ำกระเซ็น
      }catch{}
    }
  }
  return { pct, zone, label };
}

// Small screen FX helpers
export function floatScoreScreen(x,y,text,color){
  const el=document.createElement('div');
  el.textContent=String(text||'+10');
  Object.assign(el.style,{
    position:'fixed', left:(x||0)+'px', top:(y||0)+'px', transform:'translate(-50%,-50%)',
    font:'800 16px system-ui', color:color||'#fff', zIndex:1000,
    textShadow:'0 2px 8px rgba(0,0,0,.55)', pointerEvents:'none', transition:'all .55s ease'
  });
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.top=(y-28)+'px'; el.style.opacity='0'; });
  setTimeout(()=>{ try{el.remove();}catch{} },600);
}

export function burstAtScreen(x,y,opts={}){
  const count=Math.max(4,Math.min(28,opts.count||16));
  const col=opts.color||'#22c55e';
  for(let i=0;i<count;i++){
    const p=document.createElement('div');
    Object.assign(p.style,{
      position:'fixed', left:x+'px', top:y+'px', width:'6px', height:'6px',
      borderRadius:'999px', background:col, opacity:'0.95', zIndex:999,
      transform:'translate(-50%,-50%)', transition:'all .55s ease'
    });
    document.body.appendChild(p);
    const ang=Math.random()*Math.PI*2, r=18+Math.random()*22;
    const tx=x+Math.cos(ang)*r, ty=y+Math.sin(ang)*r-6;
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
  waterFlameBurst,
  waterSplashBurst
};
