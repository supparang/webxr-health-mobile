// === /herohealth/vr/particles.js ===
// HHA Particles / FX — PRODUCTION V2 (SAFE)
// ✅ One global layer: .hha-fx-layer (pointer-events:none)
// ✅ Methods: popText, scorePop, burstAt, ringAt, shock, confetti
// ✅ Auto inject keyframes once
// ✅ Never throws (best-effort)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES_V2__) return;
  root.__HHA_PARTICLES_V2__ = true;

  function ensureLayer(){
    try{
      let layer = doc.querySelector('.hha-fx-layer');
      if (layer) return layer;
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      // NOTE: z-index is finalized by CSS (goodjunk-vr.css sets 200)
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
      doc.body.appendChild(layer);
      return layer;
    }catch(_){
      return null;
    }
  }

  function clamp(n,a,b){ n = Number(n)||0; return n<a?a:(n>b?b:n); }
  function rand(a,b){ return a + Math.random()*(b-a); }
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function injectCSSOnce(){
    if (doc.getElementById('hhaParticlesStyles')) return;
    const st = doc.createElement('style');
    st.id = 'hhaParticlesStyles';
    st.textContent = `
      @keyframes hhaPop {
        0%   { transform:translate(-50%,-50%) scale(.92); opacity:.95; filter: blur(0); }
        70%  { transform:translate(-50%,-78%) scale(1.20); opacity:1; }
        100% { transform:translate(-50%,-96%) scale(1.06); opacity:0; filter: blur(.2px); }
      }
      @keyframes hhaScorePop {
        0%   { transform:translate(-50%,-50%) scale(.92); opacity:.98; }
        65%  { transform:translate(-50%,-84%) scale(1.22); opacity:1; }
        100% { transform:translate(-50%,-110%) scale(1.06); opacity:0; }
      }
      @keyframes hhaBurst {
        0%   { transform:translate(-50%,-50%) scale(.80); opacity:0; }
        25%  { transform:translate(-50%,-50%) scale(1.05); opacity:.95; }
        100% { transform:translate(-50%,-50%) scale(1.30); opacity:0; }
      }
      @keyframes hhaRing {
        0%   { transform:translate(-50%,-50%) scale(.70); opacity:.90; }
        100% { transform:translate(-50%,-50%) scale(1.55); opacity:0; }
      }
      @keyframes hhaShard {
        0%   { transform:translate3d(0,0,0) rotate(0deg); opacity:1; }
        100% { transform:translate3d(var(--dx),var(--dy),0) rotate(var(--rot)); opacity:0; }
      }
      @keyframes hhaShock {
        0%   { opacity:0; transform:scale(.98); }
        18%  { opacity:.92; transform:scale(1); }
        100% { opacity:0; transform:scale(1.02); }
      }
    `;
    doc.head.appendChild(st);
  }

  // ----- FX primitives -----
  function popText(x,y,text){
    try{
      const layer = ensureLayer(); if(!layer) return;
      injectCSSOnce();
      const el = doc.createElement('div');
      el.textContent = String(text ?? '');
      el.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI";
        color:#fff;
        text-shadow: 0 10px 24px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaPop 540ms ease-out forwards;
      `;
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
    }catch(_){}
  }

  function scorePop(x,y,text){
    try{
      const layer = ensureLayer(); if(!layer) return;
      injectCSSOnce();
      const el = doc.createElement('div');
      el.textContent = String(text ?? '');
      el.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        transform: translate(-50%,-50%);
        font: 1200 20px/1 system-ui, -apple-system, "Segoe UI";
        color:#eafff3;
        text-shadow: 0 12px 26px rgba(0,0,0,.60);
        opacity:.99;
        letter-spacing:.3px;
        will-change: transform, opacity;
        animation: hhaScorePop 560ms cubic-bezier(.2,.9,.2,1) forwards;
      `;
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 720);
    }catch(_){}
  }

  function ringAt(x,y,kind){
    try{
      const layer = ensureLayer(); if(!layer) return;
      injectCSSOnce();
      const el = doc.createElement('div');
      const color =
        kind==='bad' ? 'rgba(239,68,68,.75)' :
        kind==='star'? 'rgba(245,158,11,.75)' :
        kind==='shield'? 'rgba(34,211,238,.75)' :
        kind==='diamond'? 'rgba(167,139,250,.75)' :
        'rgba(34,197,94,.75)';

      el.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        width: 42px; height: 42px;
        border-radius: 999px;
        border: 3px solid ${color};
        box-shadow: 0 0 0 10px rgba(255,255,255,.04), 0 18px 40px rgba(0,0,0,.28);
        transform: translate(-50%,-50%);
        opacity: .9;
        will-change: transform, opacity;
        animation: hhaRing 420ms ease-out forwards;
      `;
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
    }catch(_){}
  }

  function burstAt(x,y,kind){
    try{
      const layer = ensureLayer(); if(!layer) return;
      injectCSSOnce();

      // core flash
      const flash = doc.createElement('div');
      const glow =
        kind==='bad' ? 'rgba(239,68,68,.30)' :
        kind==='block'? 'rgba(34,211,238,.25)' :
        kind==='star'? 'rgba(245,158,11,.28)' :
        kind==='diamond'? 'rgba(167,139,250,.28)' :
        'rgba(34,197,94,.22)';

      flash.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        width: 58px; height: 58px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(255,255,255,.75), ${glow} 55%, rgba(0,0,0,0) 72%);
        transform: translate(-50%,-50%);
        opacity: .92;
        will-change: transform, opacity;
        animation: hhaBurst 320ms ease-out forwards;
      `;
      layer.appendChild(flash);
      setTimeout(()=>{ try{ flash.remove(); }catch(_){ } }, 420);

      // ring + shards
      ringAt(x,y, kind==='block' ? 'shield' : kind);

      const shardCount = (kind==='diamond') ? 14 : (kind==='bad') ? 12 : 10;
      for(let i=0;i<shardCount;i++){
        const shard = doc.createElement('div');
        const s = rand(6, 12);
        const dx = rand(-120, 120);
        const dy = rand(-140, 70);
        const rot = rand(-220, 220) + 'deg';
        const col =
          kind==='bad' ? 'rgba(239,68,68,.92)' :
          kind==='block'? 'rgba(34,211,238,.92)' :
          kind==='star'? 'rgba(245,158,11,.92)' :
          kind==='diamond'? 'rgba(167,139,250,.92)' :
          'rgba(34,197,94,.92)';

        shard.style.cssText = `
          position:absolute; left:${x}px; top:${y}px;
          width:${s}px; height:${s}px;
          border-radius:${rand(3, 999)}px;
          background:${col};
          box-shadow: 0 10px 20px rgba(0,0,0,.22);
          transform: translate3d(0,0,0);
          opacity: 1;
          will-change: transform, opacity;
          --dx:${dx}px;
          --dy:${dy}px;
          --rot:${rot};
          animation: hhaShard ${rand(360, 520)}ms cubic-bezier(.2,.8,.2,1) forwards;
        `;
        layer.appendChild(shard);
        setTimeout(()=>{ try{ shard.remove(); }catch(_){ } }, 650);
      }
    }catch(_){}
  }

  function shock(kind){
    try{
      const layer = ensureLayer(); if(!layer) return;
      injectCSSOnce();
      const el = doc.createElement('div');

      const tint =
        kind==='bad' ? 'rgba(239,68,68,.14)' :
        kind==='block'? 'rgba(34,211,238,.10)' :
        kind==='star'? 'rgba(245,158,11,.12)' :
        kind==='diamond'? 'rgba(167,139,250,.12)' :
        'rgba(34,197,94,.10)';

      el.style.cssText = `
        position:absolute; inset:0;
        background: radial-gradient(900px 520px at 50% 45%, ${tint}, rgba(0,0,0,0) 62%),
                    linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,0) 55%);
        opacity: 0;
        animation: hhaShock 260ms ease-out forwards;
      `;
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 340);
    }catch(_){}
  }

  function confetti(x,y,amount){
    try{
      const layer = ensureLayer(); if(!layer) return;
      injectCSSOnce();
      const n = clamp(amount ?? 18, 6, 36);
      for(let i=0;i<n;i++){
        const piece = doc.createElement('div');
        const w = rand(6, 12), h = rand(8, 14);
        const dx = rand(-180, 180);
        const dy = rand(-240, -60);
        const rot = rand(-420, 420) + 'deg';
        const colors = [
          'rgba(34,197,94,.95)','rgba(34,211,238,.95)',
          'rgba(245,158,11,.95)','rgba(167,139,250,.95)',
          'rgba(239,68,68,.95)','rgba(255,255,255,.95)'
        ];
        const col = colors[(Math.random()*colors.length)|0];

        piece.style.cssText = `
          position:absolute; left:${x}px; top:${y}px;
          width:${w}px; height:${h}px;
          border-radius: ${rand(2, 7)}px;
          background:${col};
          transform: translate3d(0,0,0);
          opacity: 1;
          will-change: transform, opacity;
          --dx:${dx}px;
          --dy:${dy}px;
          --rot:${rot};
          animation: hhaShard ${rand(520, 760)}ms cubic-bezier(.1,.8,.2,1) forwards;
        `;
        layer.appendChild(piece);
        setTimeout(()=>{ try{ piece.remove(); }catch(_){ } }, 900);
      }
    }catch(_){}
  }

  // expose
  root.Particles = root.Particles || {};
  root.Particles.popText  = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt  = burstAt;
  root.Particles.ringAt   = ringAt;
  root.Particles.shock    = shock;
  root.Particles.confetti = confetti;

})(window);