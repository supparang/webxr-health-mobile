// === Hero Health Academy — core/fx.js (hardened + perf + cleanup) ===
let FXROOT = null;
let REDUCE_MOTION = false;

function ensureFXRoot(){
  if (FXROOT && document.body.contains(FXROOT)) return FXROOT;

  // prefers-reduced-motion
  try { REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}

  // ถ้ายังไม่มี <body> ให้รอจนพร้อม
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', ensureFXRoot, { once:true });
    return null;
  }

  const root = document.createElement('div');
  root.className = 'fx3d-root';
  Object.assign(root.style, {
    position:'fixed', inset:'0', pointerEvents:'none', zIndex:'150', contain:'layout style paint'
  });
  document.body.appendChild(root);

  // inject CSS (once)
  if (!document.getElementById('hha_fx_css')){
    const st = document.createElement('style'); st.id='hha_fx_css';
    st.textContent = `
    .burstRing{position:fixed;width:8px;height:8px;border-radius:999px;border:3px solid rgba(255,255,255,.9);transform:translate(-50%,-50%);opacity:.9;will-change:transform,opacity}
    @keyframes ringOut{from{transform:translate(-50%,-50%) scale(.4);opacity:.9}to{transform:translate(-50%,-50%) scale(2.2);opacity:0}}

    .shard{position:fixed;width:12px;height:12px;background:linear-gradient(135deg,var(--c1,#ffd54a),var(--c2,#ff6d00));border-radius:3px;box-shadow:0 2px 8px rgba(0,0,0,.35);transform:translate(var(--x0),var(--y0)) translateZ(0) rotate(0);will-change:transform,opacity}
    @keyframes shardFly{0%{transform:translate(var(--x0),var(--y0)) translateZ(0) rotate(0);opacity:1}100%{transform:translate(var(--x1),var(--y1)) translateZ(var(--z1)) rotate(var(--rot));opacity:0}}

    .spark{position:fixed;width:6px;height:6px;border-radius:999px;background:radial-gradient(closest-side,#fff,var(--spark,#ffd54a));box-shadow:0 0 8px rgba(255,213,74,.9);transform:translate(var(--sx0),var(--sy0));will-change:transform,opacity}
    @keyframes sparkUp{0%{transform:translate(var(--sx0),var(--sy0));opacity:1}100%{transform:translate(var(--sx1),var(--sy1));opacity:0}}

    /* add3DTilt helpers (ใช้ CSS var เพื่อไม่ทับ transform อื่น) */
    .tilt3d {
      transform-style: preserve-3d;
      will-change: transform;
      transition: transform .12s ease;
    }
    `;
    document.head.appendChild(st);
  }
  FXROOT = root;
  return FXROOT;
}

/* ======================= 3D Tilt ======================= */
// เก็บ handler บน element เพื่อถอดได้ภายหลัง
const _tiltMap = new WeakMap();

/** เพิ่มเอฟเฟกต์เอียง 3D ตามตำแหน่งเคอร์เซอร์ (ปลอดภัย/ประหยัด) */
export function add3DTilt(el, opts = {}){
  if (!el) return;
  const maxTilt = Number.isFinite(opts.maxTilt) ? opts.maxTilt : 12;
  const followPointer = opts.followPointer ?? true;

  el.classList.add('tilt3d');

  // ใช้ rAF กัน pointermove รัว ๆ
  let rect = null, lastX = 0, lastY = 0, af = 0;

  const measure = ()=>{ try { rect = el.getBoundingClientRect(); } catch { rect = null; } };
  const schedule = ()=>{
    if (af) return;
    af = requestAnimationFrame(()=>{
      af = 0;
      if (!rect) measure();
      if (!rect) return;
      const cx = rect.left + rect.width/2;
      const cy = rect.top  + rect.height/2;
      const dx = (lastX - cx) / Math.max(1, rect.width/2);
      const dy = (lastY - cy) / Math.max(1, rect.height/2);
      const rx = Math.max(-1, Math.min(1, dy)) * maxTilt;
      const ry = Math.max(-1, Math.min(1,-dx)) * maxTilt;
      el.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
  };

  const onMove = (x,y)=>{ lastX=x; lastY=y; schedule(); };
  const onPointerMove = (e)=>{ if (!followPointer) return; onMove(e.clientX, e.clientY); };
  const onPointerDown = (e)=>{ if (!followPointer) return; onMove(e.clientX, e.clientY); };
  const clear = ()=>{ el.style.transform='perspective(600px) rotateX(0) rotateY(0)'; rect=null; };

  el.addEventListener('pointermove', onPointerMove, {passive:true});
  el.addEventListener('pointerdown', onPointerDown, {passive:true});
  el.addEventListener('pointerleave', clear, {passive:true});
  el.addEventListener('pointerup', clear, {passive:true});

  // เก็บเพื่อ remove ภายหลัง
  _tiltMap.set(el, { onPointerMove, onPointerDown, clear, cancel:()=>af&&cancelAnimationFrame(af) });

  // เริ่มต้นตั้ง rect หนึ่งครั้ง
  measure();
}

/** ถอดเอฟเฟกต์เอียง 3D ออกจาก element */
export function remove3DTilt(el){
  const h = _tiltMap.get(el);
  if (!h) return;
  try {
    el.removeEventListener('pointermove', h.onPointerMove, {passive:true});
    el.removeEventListener('pointerdown', h.onPointerDown, {passive:true});
    el.removeEventListener('pointerleave', h.clear, {passive:true});
    el.removeEventListener('pointerup', h.clear, {passive:true});
  } catch {}
  try { h.cancel?.(); } catch {}
  try { el.classList.remove('tilt3d'); } catch {}
  try { el.style.transform = ''; } catch {}
  _tiltMap.delete(el);
}

/* ======================= Shatter (3D-like DOM burst) ======================= */
/**
 * เอฟเฟกต์แตกกระจาย: รองรับ opts แบบออปชันใหม่ แต่ยังเรียกแบบเดิมได้ (x,y)
 * opts = {
 *   color1:'#ffd54a', color2:'#ff6d00', spark:'#ffd54a',
 *   shards: 12..64, sparks: 6..24, ring:true
 * }
 */
export function shatter3D(x, y, opts = {}){
  if (REDUCE_MOTION) return;
  const root = ensureFXRoot();
  if (!root) return;

  const color1 = opts.color1 || '#ffd54a';
  const color2 = opts.color2 || '#ff6d00';
  const sparkC = opts.spark  || '#ffd54a';
  const N = clampInt(opts.shards ?? (12 + (Math.random()*6|0)), 6, 64);
  const SP = clampInt(opts.sparks ?? (8 + (Math.random()*6|0)), 4, 36);
  const showRing = opts.ring !== false;

  if (showRing){
    const ring = document.createElement('div');
    ring.className='burstRing'; ring.style.left=x+'px'; ring.style.top=y+'px';
    root.appendChild(ring);
    ring.style.animation='ringOut .45s ease-out forwards';
    setTimeout(()=>{ try{ ring.remove(); }catch{} }, 520);
  }

  for (let i=0;i<N;i++){
    const s=document.createElement('div'); s.className='shard';
    s.style.left=x+'px'; s.style.top=y+'px';
    s.style.setProperty('--c1', color1);
    s.style.setProperty('--c2', color2);

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
    setTimeout(()=>{ try{ s.remove(); }catch{} }, 580);
  }

  for (let i=0;i<SP;i++){
    const p=document.createElement('div'); p.className='spark';
    p.style.left=x+'px'; p.style.top=y+'px';
    p.style.setProperty('--spark', sparkC);
    const ang=Math.random()*Math.PI*2, d= 20 + Math.random()*60;
    const tx=Math.cos(ang)*d, ty=Math.sin(ang)*d;
    p.style.setProperty('--sx0','-50%'); p.style.setProperty('--sy0','-50%');
    p.style.setProperty('--sx1',tx+'px'); p.style.setProperty('--sy1',ty+'px');
    root.appendChild(p);
    p.style.animation='sparkUp .35s ease-out forwards';
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 440);
  }
}

/* ======================= Utils & Cleanup ======================= */
function clampInt(n, a, b){ n|=0; return Math.max(a, Math.min(b, n)); }

/** ล้างเอฟเฟกต์/DOM ที่ฟังก์ชันนี้สร้างไว้ (เผื่อเปลี่ยนฉาก/ออกจากเกม) */
export function disposeFX(){
  try {
    // ถอน tilt ทั้งหมดที่เคยใส่ (ถ้ามี element ยังอยู่)
    _tiltMap.forEach((_, el)=> remove3DTilt(el));
  } catch {}
  if (FXROOT){
    try { FXROOT.remove(); } catch {}
    FXROOT = null;
  }
}
