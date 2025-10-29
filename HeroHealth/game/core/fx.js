// === Hero Health Academy — game/core/fx.js ===
// 3D tilt on spawn items + shatter burst on click (auto-attached)
// Safe to import multiple times; guards built-in.

(function(){
  if (window.HHA_FX && window.HHA_FX.__ok) { exportStub(); return; }

  // ---------- Helpers ----------
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

  // ---------- 3D Tilt ----------
  function add3DTilt(el){
    if (!el || el.__fxTilt) return;
    el.__fxTilt = true;
    el.style.transformStyle = 'preserve-3d';
    el.style.backfaceVisibility = 'hidden';

    // Hover/bounce cue
    el.addEventListener('pointerenter', ()=>{
      el.style.transition = 'transform .12s ease, filter .12s ease, box-shadow .12s ease';
      el.style.transform  = 'perspective(700px) translateZ(12px) scale(1.06)';
    });
    el.addEventListener('pointerleave', ()=>{
      el.style.transform = 'perspective(700px) translateZ(0) scale(1)';
    });

    // Subtle tilt towards cursor
    el.addEventListener('pointermove', (ev)=>{
      const r = el.getBoundingClientRect();
      const dx = (ev.clientX - (r.left + r.width/2)) / (r.width/2);
      const dy = (ev.clientY - (r.top  + r.height/2)) / (r.height/2);
      const rx = clamp(-dy*8, -10, 10);
      const ry = clamp(dx*10 , -12, 12);
      el.style.transform = `perspective(700px) translateZ(12px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.06)`;
    });

    // On press, small depress
    el.addEventListener('pointerdown', ()=>{
      el.style.transform = 'perspective(700px) translateZ(2px) scale(0.98)';
    });
    el.addEventListener('pointerup', ()=>{
      el.style.transform = 'perspective(700px) translateZ(12px) scale(1.06)';
    }, {passive:true});
  }

  // ---------- Shatter (click burst) ----------
  function shatter3D(x, y, opts={}){
    const N     = opts.count || 16;
    const life  = opts.ms || 720;
    const root  = document.createElement('div');
    root.className = 'fx-shards';
    root.style.position = 'fixed';
    root.style.left = x+'px';
    root.style.top  = y+'px';
    root.style.pointerEvents = 'none';
    root.style.zIndex = 9998;
    document.body.appendChild(root);

    for (let i=0;i<N;i++){
      const s = document.createElement('i');
      s.className = 'fx-shard';
      const ang = Math.random()*Math.PI*2;
      const vel = 120 + Math.random()*220;
      const dx  = Math.cos(ang)*vel;
      const dy  = Math.sin(ang)*vel;
      const rz  = (Math.random()*720-360)|0;
      s.style.setProperty('--tx', dx+'px');
      s.style.setProperty('--ty', dy+'px');
      s.style.setProperty('--rz', rz+'deg');
      s.style.animationDuration = (life/1000)+'s';
      root.appendChild(s);
    }

    setTimeout(()=>{ try{ root.remove(); }catch{} }, life+40);
  }

  // ---------- Auto hook to all spawned items ----------
  function hookNewItems(node){
    const nodes = node ? [node] : [];
    const list = node ? (node.querySelectorAll?.('.spawn-emoji, .item') || []) : document.querySelectorAll('.spawn-emoji, .item');
    list.forEach(el=>{
      add3DTilt(el);
      if (!el.__fxClickBind){
        el.__fxClickBind = true;
        el.addEventListener('click', (ev)=>{
          shatter3D(ev.clientX, ev.clientY);
        }, {passive:true});
      }
    });
  }

  // Initial and observe later
  function installObserver(){
    hookNewItems();
    const host = document.getElementById('spawnHost') || document.body;
    const mo = new MutationObserver(muts=>{
      muts.forEach(m=>{
        m.addedNodes && m.addedNodes.forEach(n=>{
          if (!(n instanceof HTMLElement)) return;
          if (n.matches?.('.spawn-emoji, .item')) hookNewItems(n);
          else if (n.querySelectorAll) hookNewItems(n);
        });
      });
    });
    mo.observe(host, { childList:true, subtree:true });
  }

  // Export + init
  window.HHA_FX = { add3DTilt, shatter3D, __ok:true };
  // Install once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installObserver, {once:true});
  } else {
    installObserver();
  }

  function exportStub(){ /* already present; do nothing */ }
})();
