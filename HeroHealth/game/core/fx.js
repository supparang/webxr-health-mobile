// === Hero Health Academy — game/core/fx.js (bridge to Engine.fx) ===

// 3D tilt แบบเบา ๆ บน DOM node (ปลอดภัยต่อมือถือ)
export function add3DTilt(el){
  if (!el || el.__hhaTiltOn) return;
  el.__hhaTiltOn = true;
  el.style.transformStyle = 'preserve-3d';
  el.style.willChange = (el.style.willChange||'') + ', transform';

  const max = 10; // องศาสูงสุด
  const onMove = (e)=>{
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const x = (e.clientX - cx) / (r.width/2);
    const y = (e.clientY - cy) / (r.height/2);
    const rx =  Math.max(-1, Math.min(1, y)) * max;
    const ry = -Math.max(-1, Math.min(1, x)) * max;
    el.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const onLeave = ()=>{ el.style.transform = 'perspective(600px) rotateX(0) rotateY(0)'; };

  el.addEventListener('pointermove', onMove, {passive:true});
  el.addEventListener('pointerleave', onLeave, {passive:true});

  // cleanup handle
  el.__hhaTiltOff = ()=>{ 
    el.removeEventListener('pointermove', onMove, {passive:true});
    el.removeEventListener('pointerleave', onLeave, {passive:true});
    delete el.__hhaTiltOn; delete el.__hhaTiltOff;
  };
}

export function shatter3D(x, y, opts = {}){
  try { window.HHA?.engine?.fx?.shatter3D(x, y, opts); } catch {}
}
export function popText(text, opts = {}){
  try { window.HHA?.engine?.fx?.popText?.(text, opts); } catch {}
}

// เผื่ออนาคต: expose utility อื่น ๆ ถ้าต้องการ
export const burstEmoji = (x,y,emojis,opts)=>{ try { window.HHA?.engine?.fx?.burstEmoji?.(x,y,emojis,opts); } catch {} };
export const glowAt     = (x,y,color,ms)=>{ try { window.HHA?.engine?.fx?.glowAt?.(x,y,color,ms); } catch {} };

// === core/fx.js — 3D tilt + shatter + explodeButton ===
(function ensureStyle(){
  if (document.getElementById('fx-style')) return;
  const st=document.createElement('style'); st.id='fx-style';
  st.textContent=`.fx-shard{position:fixed;left:0;top:0;pointer-events:none;font-size:22px;line-height:1;will-change:transform,opacity;filter:drop-shadow(0 6px 12px rgba(0,0,0,.35));transform-style:preserve-3d;}`;
  document.head.appendChild(st);
})();
function add3DTilt(el){
  if(!el) return; el.style.transformStyle='preserve-3d';
  el.addEventListener('mousemove',(e)=>{ const r=el.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const dx=(e.clientX-cx)/(r.width/2), dy=(e.clientY-cy)/(r.height/2); const rx=Math.max(-1,Math.min(1,dy))*-8, ry=Math.max(-1,Math.min(1,dx))*8;
    el.style.transform=`translate(-50%,-50%) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(10px)`; },{passive:true});
  el.addEventListener('mouseleave',()=>{ el.style.transform=`translate(-50%,-50%)`; },{passive:true});
}
function shatter3D(x,y,{emoji='✦',count=14,life=800,zBoost=36}={}){
  for(let i=0;i<count;i++){ const s=document.createElement('div'); s.className='fx-shard'; s.textContent=emoji; s.style.transform=`translate3d(${x}px,${y}px,0)`; s.style.opacity='1'; document.body.appendChild(s);
    const ang=Math.random()*Math.PI*2, spd=140+Math.random()*220, vz=(Math.random()*zBoost)+8, vx=Math.cos(ang)*spd, vy=Math.sin(ang)*spd-(60+Math.random()*80);
    const t0=performance.now(); (function tick(){ const t=performance.now()-t0, k=Math.min(1,t/life), ease=(1-Math.pow(1-k,3));
      const X=x+vx*k*0.012, Y=y+(vy*k*0.012)+(420*k*k*0.012), Z=vz*ease;
      s.style.transform=`translate3d(${X}px,${Y}px,${Z}px) rotateY(${720*k}deg) rotateX(${540*k}deg)`; s.style.opacity=String(1-k); if(k<1) requestAnimationFrame(tick); else s.remove(); })();
  }
}
function explodeButton(el, x, y){ try{ const em=(el?.textContent||'✦').trim(); shatter3D(x,y,{emoji:em}); }catch{} try{ el.remove(); }catch{} }
export { add3DTilt, shatter3D, explodeButton };
try{ window.HHA_FX=Object.assign(window.HHA_FX||{}, { add3DTilt, shatter3D, explodeButton }); }catch{}

