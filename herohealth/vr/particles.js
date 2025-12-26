// === /herohealth/vr/particles.js ===
// Simple FX layer (LATEST)
// ✅ scorePop (running label) + burstAt
// ✅ celebrate(kind,label)
// ✅ stamp(text) = “ตราประทับ” กลางจอแบบเด้งสะใจ

(function(root){
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    Object.assign(layer.style, {
      position:'fixed',
      inset:'0',
      zIndex:'9999',
      pointerEvents:'none',
      overflow:'hidden'
    });
    doc.body.appendChild(layer);
    return layer;
  }

  function mk(tag, css){
    const el = doc.createElement(tag);
    Object.assign(el.style, css||{});
    return el;
  }

  function scorePop(x, y, txt, label){
    const layer = ensureLayer();
    const cx = (typeof x === 'number') ? x : (window.innerWidth*0.5);
    const cy = (typeof y === 'number') ? y : (window.innerHeight*0.52);

    const box = mk('div', {
      position:'fixed',
      left: cx+'px',
      top:  cy+'px',
      transform:'translate(-50%,-50%)',
      fontWeight:'1000',
      fontSize:'18px',
      letterSpacing:'.2px',
      color:'rgba(226,232,240,.96)',
      textShadow:'0 10px 20px rgba(0,0,0,.45)',
      filter:'drop-shadow(0 10px 26px rgba(0,0,0,.35))',
      opacity:'0'
    });

    const pill = mk('div', {
      display:'inline-flex',
      alignItems:'center',
      gap:'8px',
      padding:'8px 12px',
      borderRadius:'999px',
      border:'1px solid rgba(148,163,184,.22)',
      background:'rgba(2,6,23,.55)',
      backdropFilter:'blur(10px)',
    });

    const t = mk('span', {});
    t.textContent = String(txt||'');

    const s = mk('span', {
      fontSize:'12px',
      fontWeight:'900',
      opacity:'.78'
    });
    s.textContent = label ? String(label) : '';

    pill.appendChild(t);
    if (label) pill.appendChild(s);
    box.appendChild(pill);
    layer.appendChild(box);

    // animate
    try{
      box.animate([
        { opacity:0, transform:'translate(-50%,-50%) scale(.92) translateY(6px)' },
        { opacity:1, transform:'translate(-50%,-50%) scale(1.05) translateY(-2px)' },
        { opacity:0, transform:'translate(-50%,-50%) scale(1.00) translateY(-22px)' }
      ], { duration: 700, easing:'cubic-bezier(.2,.9,.2,1)' });
    }catch{}
    box.style.opacity = '1';
    setTimeout(()=>{ try{ box.remove(); }catch{} }, 720);
  }

  function burstAt(x, y, kind){
    const layer = ensureLayer();
    const cx = (typeof x === 'number') ? x : (window.innerWidth*0.5);
    const cy = (typeof y === 'number') ? y : (window.innerHeight*0.52);

    const c = mk('div', {
      position:'fixed',
      left: cx+'px',
      top:  cy+'px',
      width:'10px',
      height:'10px',
      borderRadius:'999px',
      transform:'translate(-50%,-50%)',
      background:'rgba(255,255,255,.85)',
      opacity:'0'
    });
    layer.appendChild(c);

    const glow =
      (kind === 'JUNK') ? 'rgba(239,68,68,.28)' :
      (kind === 'STAR') ? 'rgba(250,204,21,.25)' :
      (kind === 'DIAMOND') ? 'rgba(56,189,248,.25)' :
      (kind === 'SHIELD' || kind === 'BLOCK') ? 'rgba(167,139,250,.25)' :
      (kind === 'PERFECT') ? 'rgba(34,197,94,.25)' :
      'rgba(255,255,255,.18)';

    c.style.boxShadow = `0 0 0 0 ${glow}`;

    try{
      c.animate([
        { opacity:0, transform:'translate(-50%,-50%) scale(.6)', boxShadow:`0 0 0 0 ${glow}` },
        { opacity:1, transform:'translate(-50%,-50%) scale(1.2)', boxShadow:`0 0 0 18px ${glow}` },
        { opacity:0, transform:'translate(-50%,-50%) scale(1.9)', boxShadow:`0 0 0 34px rgba(0,0,0,0)` }
      ], { duration: 420, easing:'ease-out' });
    }catch{}

    setTimeout(()=>{ try{ c.remove(); }catch{} }, 460);
  }

  function stamp(text){
    const layer = ensureLayer();
    const box = mk('div', {
      position:'fixed',
      left:'50%',
      top:'34%',
      transform:'translate(-50%,-50%)',
      zIndex:'9999',
      pointerEvents:'none'
    });

    const card = mk('div', {
      padding:'12px 16px',
      borderRadius:'18px',
      border:'2px solid rgba(226,232,240,.22)',
      background:'rgba(15,23,42,.72)',
      color:'rgba(226,232,240,.96)',
      fontWeight:'1000',
      letterSpacing:'.4px',
      boxShadow:'0 24px 80px rgba(0,0,0,.55)',
      backdropFilter:'blur(10px)',
      textTransform:'uppercase'
    });
    card.textContent = String(text||'CLEAR!');

    box.appendChild(card);
    layer.appendChild(box);

    try{
      box.animate([
        { opacity:0, transform:'translate(-50%,-50%) scale(.65) rotate(-6deg)' },
        { opacity:1, transform:'translate(-50%,-50%) scale(1.08) rotate(2deg)' },
        { opacity:1, transform:'translate(-50%,-50%) scale(1.00) rotate(0deg)' },
        { opacity:0, transform:'translate(-50%,-50%) scale(1.02) rotate(0deg)' }
      ], { duration: 900, easing:'cubic-bezier(.2,.9,.2,1)' });
    }catch{}

    setTimeout(()=>{ try{ box.remove(); }catch{} }, 920);
  }

  function celebrate(kind, label){
    // quick: stamp + burst center
    stamp(label || kind || 'CLEAR!');
    burstAt(window.innerWidth*0.5, window.innerHeight*0.52, kind || 'HIT');
  }

  root.Particles = { scorePop, burstAt, celebrate, stamp };
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(typeof window !== 'undefined' ? window : globalThis);