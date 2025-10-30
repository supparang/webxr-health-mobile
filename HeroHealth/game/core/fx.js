// === Hero Health Academy — core/fx.js (dual export: named + default)
// Safe, dependency-free 3D-ish tilt + shatter pop effect for DOM emoji buttons.

function add3DTilt(el){
  if (!el || el.__hhaTilt) return;
  el.__hhaTilt = true;
  el.style.transformStyle = 'preserve-3d';
  el.style.willChange = 'transform, filter';
  const onMove = (e)=>{
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const x = (e.clientX - cx) / (r.width/2);
    const y = (e.clientY - cy) / (r.height/2);
    const rx = Math.max(-10, Math.min(10, -y*10));
    const ry = Math.max(-10, Math.min(10,  x*10));
    el.style.transform = `translate(-50%,-50%) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const onLeave = ()=>{
    el.style.transform = `translate(-50%,-50%)`;
  };
  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseleave', onLeave);
  el.__hhaTiltCleanup = ()=>{ el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
}

function shatter3D(x, y){
  // Simple “pop text” particle burst
  const n = 10;
  for (let i=0;i<n;i++){
    const p = document.createElement('div');
    p.textContent = '✧';
    p.style.position = 'fixed';
    p.style.left = (x|0)+'px';
    p.style.top  = (y|0)+'px';
    p.style.font = '900 14px/1 ui-rounded';
    p.style.color = '#eaf6ff';
    p.style.pointerEvents = 'none';
    p.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,.5))';
    document.body.appendChild(p);
    const ang = Math.random()*Math.PI*2;
    const spd = 40 + Math.random()*90;
    const vx = Math.cos(ang)*spd, vy = Math.sin(ang)*spd;
    const life = 450 + Math.random()*350;
    const t0 = performance.now();
    (function tick(){
      const t = performance.now()-t0;
      const k = Math.min(1, t/life);
      p.style.transform = `translate(${vx*k}px, ${vy*k - 80*k*k}px) scale(${1-k*0.5})`;
      p.style.opacity = String(1-k);
      if (k<1) requestAnimationFrame(tick); else p.remove();
    })();
  }
}

// Expose to global once (avoid re-declare crashes)
if (!window.HHA_FX) window.HHA_FX = {};
if (!window.HHA_FX.__wired){
  Object.assign(window.HHA_FX, { add3DTilt, shatter3D });
  Object.defineProperty(window.HHA_FX, '__wired', { value:true, enumerable:false });
}

// Named exports
export { add3DTilt, shatter3D };

// Default export for backward-compat (so `import FX from ...` works too)
export default { add3DTilt, shatter3D };
