// === /herohealth/vr/particles.js ===
// Simple FX Layer — score pop + burst + celebrate
// Provides window.Particles + window.GAME_MODULES.Particles

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:90;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:absolute;
      left:${x}px; top:${y}px;
      transform: translate(-50%,-50%);
      font: 900 18px/1 system-ui;
      color:#fff;
      text-shadow: 0 2px 0 rgba(0,0,0,.35), 0 16px 32px rgba(0,0,0,.28);
      opacity:0;
      will-change: transform, opacity;
    `;
    if (cls) el.classList.add(cls);
    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transition = 'transform .5s ease, opacity .5s ease';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-70%) scale(1.04)';
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-120%) scale(.98)';
      }, 160);
    });

    setTimeout(() => { try{ el.remove(); }catch(_){} }, 650);
  }

  function burstAt(x,y,kind='GOOD'){
    const layer = ensureLayer();
    const n = (kind==='BOSS') ? 14 : (kind==='JUNK' ? 10 : 12);
    for (let i=0;i<n;i++){
      const p = doc.createElement('div');
      const dx = (Math.random()*2-1) * (kind==='BOSS'?120:80);
      const dy = (Math.random()*2-1) * (kind==='BOSS'?120:80);
      p.style.cssText = `
        position:absolute;
        left:${x}px; top:${y}px;
        width:10px; height:10px;
        border-radius: 999px;
        background: rgba(255,255,255,.85);
        opacity:.0;
        transform: translate(-50%,-50%);
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.22));
      `;
      layer.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transition = 'transform .55s ease, opacity .55s ease';
        p.style.opacity = '1';
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.9)`;
        setTimeout(() => { p.style.opacity = '0'; }, 140);
      });
      setTimeout(() => { try{ p.remove(); }catch(_){} }, 620);
    }
  }

  function celebrate(type='GOAL'){
    // quick center celebration
    const x = innerWidth * 0.5;
    const y = innerHeight * 0.32;
    const t = (type==='ALL') ? '🎉 ALL COMPLETE!' :
              (type==='BOSS') ? '💥 BOSS DOWN!' :
              (type==='FEVER')? '🔥 FEVER!' :
              (type==='GOLD') ? '⭐ BONUS!' :
              (type==='POWER')? '⚡ POWER!' :
              (type==='MINI') ? '✅ MINI!' : '✅ GOAL!';
    popText(x, y, t);
  }

  const Particles = {
    scorePop: (x,y,t)=>popText(x,y,String(t||'+')),
    burstAt,
    celebrate
  };

  root.Particles = Particles;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = Particles;

  // Optional: also listen for celebrate events
  root.addEventListener('hha:celebrate', (e) => {
    const d = e && e.detail ? e.detail : {};
    celebrate(d.type || 'GOAL');
  });

})(window);