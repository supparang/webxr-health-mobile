// === /HeroHealth/vr/particles.js — FULL FX PACK (burstAt + scorePop + shards) ===

// ป้องกันซ้ำ
if (!window.__HHA_PARTICLE_FX__) window.__HHA_PARTICLE_FX__ = true;

// ---------- Utilities ----------
function getXY(ev){
  if (!ev) return {x:0,y:0};
  if (ev.changedTouches && ev.changedTouches[0])
    return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
  if (ev.touches && ev.touches[0])
    return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  return { x: ev.clientX||0, y: ev.clientY||0 };
}

// ---------- 1) Burst FX (วงแหวนแตกกระจาย) ----------
export function burstAt(x, y, opts={}){
  const count = opts.count || 18;
  const col   = opts.color || "#22c55e";

  for (let i=0;i<count;i++){
    const p = document.createElement('div');
    Object.assign(p.style,{
      position:'fixed', left:`${x}px`, top:`${y}px`,
      width:'8px', height:'8px', borderRadius:'999px',
      background:col, opacity:'0.95', zIndex:999,
      transform:'translate(-50%,-50%)',
      pointerEvents:'none',
      transition:'all .55s ease'
    });
    document.body.appendChild(p);

    const ang = Math.random()*Math.PI*2;
    const r   = 24 + Math.random()*32;
    const dx  = x + Math.cos(ang)*r;
    const dy  = y + Math.sin(ang)*r - 8;

    setTimeout(()=>{ p.style.left = dx+'px'; p.style.top = dy+'px'; p.style.opacity='0'; }, 22);
    setTimeout(()=>{ try{p.remove();}catch(_){ } }, 620);
  }
}

// ---------- 2) Floating Score FX ----------
export function scorePop(x, y, text, opts={}){
  const el = document.createElement('div');
  el.textContent = text || "+100";

  Object.assign(el.style,{
    position:'fixed',
    left:`${x}px`,
    top:`${y}px`,
    transform:'translate(-50%,-50%)',
    zIndex:1000,
    pointerEvents:'none',
    font:`900 ${opts.size||20}px system-ui`,
    color: opts.good ? "#4ade80" : "#f87171",
    textShadow:'0 4px 16px rgba(0,0,0,.45)',
    opacity:'1',
    transition:'all .65s ease'
  });
  document.body.appendChild(el);

  setTimeout(()=>{ el.style.top = (y-32)+'px'; el.style.opacity='0'; }, 33);
  setTimeout(()=>{ try{el.remove();}catch(_){ } }, 700);
}

// ---------- 3) 3D-shards FX (Fallback จาก DOM) ----------
export function burstShards(host, pos, opts={}){
  if (!host) return;
  const n = opts.count || 12;
  const col = opts.color || '#60a5fa';

  for (let i=0;i<n;i++){
    const s = document.createElement('a-sphere');
    s.setAttribute('radius', 0.015 + Math.random()*0.01);
    s.setAttribute('color', col);
    s.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    s.setAttribute('opacity', '0.95');

    host.appendChild(s);

    const ang = Math.random()*Math.PI*2;
    const v   = 0.4+Math.random()*0.7;
    const dx  = Math.cos(ang)*v;
    const dy  = (Math.random()*0.6)+0.3;
    const dz  = Math.sin(ang)*v;

    const anim = document.createElement('a-animation');
    anim.setAttribute('attribute','position');
    anim.setAttribute('to',`${pos.x+dx} ${pos.y+dy} ${pos.z+dz}`);
    anim.setAttribute('dur','550');
    anim.setAttribute('easing','ease-out');
    s.appendChild(anim);

    const fade = document.createElement('a-animation');
    fade.setAttribute('attribute','opacity');
    fade.setAttribute('to','0');
    fade.setAttribute('dur','550');
    fade.setAttribute('easing','ease-out');
    s.appendChild(fade);

    setTimeout(()=>{ try{s.remove();}catch(_){ } }, 600);
  }
}

// ---------- Default export ----------
export default {
  burstAt,
  burstShards,
  scorePop
};