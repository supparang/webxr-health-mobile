// === Hero Health Academy — core/fx.js (shared 3D icon effects) ===
let FXROOT = null;

function ensureFXRoot(){
  if (FXROOT && document.body.contains(FXROOT)) return FXROOT;
  const root = document.createElement('div');
  root.className = 'fx3d-root';
  Object.assign(root.style, {
    position:'fixed', inset:'0', pointerEvents:'none', zIndex:'150'
  });
  document.body.appendChild(root);

  // inject CSS (once)
  if (!document.getElementById('hha_fx_css')){
    const st = document.createElement('style'); st.id='hha_fx_css';
    st.textContent = `
    .burstRing{position:fixed;width:8px;height:8px;border-radius:999px;border:3px solid rgba(255,255,255,.9);transform:translate(-50%,-50%);opacity:.9}
    @keyframes ringOut{from{transform:translate(-50%,-50%) scale(.4);opacity:.9}to{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
    .shard{position:fixed;width:12px;height:12px;background:linear-gradient(135deg,#ffd54a,#ff6d00);border-radius:3px;box-shadow:0 2px 8px rgba(0,0,0,.35);transform:translate(var(--x0),var(--y0)) translateZ(0) rotate(0)}
    @keyframes shardFly{
      0%{transform:translate(var(--x0),var(--y0)) translateZ(0) rotate(0);opacity:1}
      100%{transform:translate(var(--x1),var(--y1)) translateZ(var(--z1)) rotate(var(--rot));opacity:0}
    }
    .spark{position:fixed;width:6px;height:6px;border-radius:999px;background:radial-gradient(closest-side,#fff,#ffd54a);box-shadow:0 0 8px rgba(255,213,74,.9);transform:translate(var(--sx0),var(--sy0))}
    @keyframes sparkUp{
      0%{transform:translate(var(--sx0),var(--sy0));opacity:1}
      100%{transform:translate(var(--sx1),var(--sy1));opacity:0}
    }`;
    document.head.appendChild(st);
  }
  FXROOT = root;
  return FXROOT;
}

export function add3DTilt(el){
  let rect;
  const maxTilt = 12;
  const upd = (x,y)=>{
    rect = rect || el.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top  + rect.height/2;
    const dx = (x - cx) / (rect.width/2);
    const dy = (y - cy) / (rect.height/2);
    const rx = Math.max(-1, Math.min(1, dy)) * maxTilt;
    const ry = Math.max(-1, Math.min(1,-dx)) * maxTilt;
    el.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const clear = ()=>{ el.style.transform='perspective(600px) rotateX(0) rotateY(0)'; rect=null; };
  el.addEventListener('pointermove', e=>upd(e.clientX,e.clientY), {passive:true});
  el.addEventListener('pointerdown', e=>upd(e.clientX,e.clientY), {passive:true});
  el.addEventListener('pointerleave', clear, {passive:true});
  el.addEventListener('pointerup', clear, {passive:true});
}

export function shatter3D(x,y){
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const root = ensureFXRoot();

  const ring = document.createElement('div');
  ring.className='burstRing'; ring.style.left=x+'px'; ring.style.top=y+'px';
  root.appendChild(ring);
  ring.style.animation='ringOut .45s ease-out forwards';
  setTimeout(()=>{ try{ ring.remove(); }catch{} }, 500);

  const N = 12 + (Math.random()*6|0);
  for (let i=0;i<N;i++){
    const s=document.createElement('div'); s.className='shard';
    s.style.left=x+'px'; s.style.top=y+'px';
    const ang = Math.random()*Math.PI*2;
    const dist = 60 + Math.random()*110;
    const tx = Math.cos(ang)*dist;
    const ty = Math.sin(ang)*dist;
    const tz = (Math.random()*2-1)*160;
    const rot= (Math.random()*720-360)+'deg';
    s.style.setProperty('--x0','-50%');
    s.style.setProperty('--y0','-50%');
    s.style.setProperty('--x1', tx+'px');
    s.style.setProperty('--y1', ty+'px');
    s.style.setProperty('--z1', tz+'px');
    s.style.setProperty('--rot', rot);
    root.appendChild(s);
    s.style.animation=`shardFly .48s ease-out forwards`;
    setTimeout(()=>{ try{ s.remove(); }catch{} }, 560);
  }

  const SP = 8 + (Math.random()*6|0);
  for (let i=0;i<SP;i++){
    const p=document.createElement('div'); p.className='spark';
    p.style.left=x+'px'; p.style.top=y+'px';
    const ang=Math.random()*Math.PI*2, d= 20 + Math.random()*60;
    const tx=Math.cos(ang)*d, ty=Math.sin(ang)*d;
    p.style.setProperty('--sx0','-50%'); p.style.setProperty('--sy0','-50%');
    p.style.setProperty('--sx1',tx+'px'); p.style.setProperty('--sy1',ty+'px');
    root.appendChild(p);
    p.style.animation='sparkUp .35s ease-out forwards';
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 420);
  }
}
