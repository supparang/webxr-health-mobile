// === /HeroHealth/vr/particles.js ===
// เอฟเฟกต์แตกกระจาย + เด้งคะแนนตรงจุดคลิก

export function burstAt(x, y, opts = {}) {
  const count = Math.max(6, Math.min(32, opts.count || 18));
  const baseColor = opts.color || '#22c55e';

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    Object.assign(dot.style, {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      width: '7px',
      height: '7px',
      borderRadius: '999px',
      background: baseColor,
      opacity: '0.98',
      transform: 'translate(-50%,-50%)',
      pointerEvents: 'none',
      zIndex: 900,
      transition: 'all .55s ease'
    });
    document.body.appendChild(dot);

    const ang = Math.random() * Math.PI * 2;
    const r   = 18 + Math.random() * 26;
    const tx  = x + Math.cos(ang) * r;
    const ty  = y + Math.sin(ang) * r - 8;

    requestAnimationFrame(()=>{
      dot.style.left   = tx + 'px';
      dot.style.top    = ty + 'px';
      dot.style.opacity= '0';
    });
    setTimeout(()=>{ try{dot.remove();}catch(_){}; }, 650);
  }
}

export function scorePop(x, y, text, opts = {}) {
  const el = document.createElement('div');
  el.textContent = text || '+10';
  Object.assign(el.style, {
    position:'fixed',
    left:x+'px',
    top:y+'px',
    transform:'translate(-50%,-50%)',
    font:'900 18px system-ui',
    color: opts.good === false ? '#fecaca' : '#bbf7d0',
    textShadow:'0 3px 10px rgba(0,0,0,.6)',
    pointerEvents:'none',
    zIndex: 950,
    opacity:'0',
    transition:'all .6s ease'
  });
  document.body.appendChild(el);
  requestAnimationFrame(()=>{
    el.style.top    = (y-30)+'px';
    el.style.opacity= '1';
  });
  setTimeout(()=>{
    el.style.top    = (y-52)+'px';
    el.style.opacity= '0';
  }, 220);
  setTimeout(()=>{ try{el.remove();}catch(_){}; }, 700);
}

export default { burstAt, scorePop };
