/* === /herohealth/vr-groups/groups-fx.js ===
Groups FX — Sticky Candy Sparkles (PRODUCTION)
- Sparkle burst on spawn + hit (attached to target)
- GOOD: trail glitter
- JUNK/WRONG/DECOY: cartoon smoke/goo
- Intensity based on body class: groups-style-hard/feel/mix
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const layer = ()=> DOC.getElementById('fg-layer') || DOC.querySelector('.fg-layer');
  const prefersReduce = ()=> root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function styleMode(){
    const b = DOC.body;
    if (!b) return 'mix';
    if (b.classList.contains('groups-style-hard')) return 'hard';
    if (b.classList.contains('groups-style-feel')) return 'feel';
    return 'mix';
  }
  function intensity(){
    const m = styleMode();
    if (m === 'hard') return { burst: 10, trail: 5, goo: 6 };
    if (m === 'feel') return { burst: 14, trail: 8, goo: 4 };
    return { burst: 12, trail: 7, goo: 5 };
  }

  function rnd(a,b){ return a + Math.random()*(b-a); }

  function ensureFxHost(el){
    if (!el || !el.isConnected) return null;
    if (el._fxAttached) return el.querySelector('.fg-fxhost');
    el._fxAttached = 1;

    el.style.position = 'fixed'; // ensure relative for child absolute inside (CSS also helps)
    el.style.overflow = 'hidden';

    const fx = DOC.createElement('div');
    fx.className = 'fg-fxhost';
    fx.innerHTML = `
      <div class="fg-sparkle-layer"></div>
      <div class="fg-trail-layer"></div>
      <div class="fg-goo-layer"></div>
    `;
    el.appendChild(fx);
    return fx;
  }

  function burst(el, kind){
    if (prefersReduce()) return;
    const fx = ensureFxHost(el);
    if (!fx) return;

    const { burst:count } = intensity();
    const lay = fx.querySelector('.fg-sparkle-layer');
    if (!lay) return;

    const wrap = DOC.createElement('div');
    wrap.className = 'fg-burst ' + (kind==='hit'?'is-hit':'is-spawn');

    const n = (kind==='hit') ? count+2 : count;
    for (let i=0;i<n;i++){
      const s = DOC.createElement('span');
      s.className = 'fg-star';
      s.style.left = rnd(10, 90).toFixed(1) + '%';
      s.style.top  = rnd(12, 88).toFixed(1) + '%';
      s.style.transform = `translate(-50%,-50%) rotate(${rnd(-50,50).toFixed(1)}deg) scale(${rnd(0.65,1.15).toFixed(2)})`;
      s.style.setProperty('--dx', rnd(-26, 26).toFixed(1) + 'px');
      s.style.setProperty('--dy', rnd(-30, 30).toFixed(1) + 'px');
      s.style.setProperty('--dur', rnd(380, 620).toFixed(0) + 'ms');
      s.textContent = (Math.random()<0.72) ? '✦' : (Math.random()<0.5?'✧':'★');
      wrap.appendChild(s);
    }
    lay.appendChild(wrap);
    setTimeout(()=>wrap.remove(), 680);
  }

  function trailTick(){
    if (prefersReduce()) return;
    const L = layer(); if (!L) return;
    const { trail:rate } = intensity();

    const goods = L.querySelectorAll('.fg-target.fg-good');
    goods.forEach(el=>{
      const fx = ensureFxHost(el);
      if (!fx) return;
      const tl = fx.querySelector('.fg-trail-layer');
      if (!tl) return;

      // spawn few glitter dots per tick
      const dots = (styleMode()==='feel') ? 2 : 1;
      for (let k=0;k<dots;k++){
        const p = DOC.createElement('span');
        p.className = 'fg-trail-dot';
        p.style.left = rnd(32, 68).toFixed(1) + '%';
        p.style.top  = rnd(44, 78).toFixed(1) + '%';
        p.style.setProperty('--dur', rnd(520, 820).toFixed(0)+'ms');
        p.textContent = (Math.random()<0.75) ? '✦' : '✧';
        tl.appendChild(p);
        setTimeout(()=>p.remove(), 900);
      }

      // cap
      while (tl.childElementCount > Math.max(18, rate*4)) tl.firstElementChild?.remove();
    });
  }

  function gooTick(){
    if (prefersReduce()) return;
    const L = layer(); if (!L) return;
    const { goo:rate } = intensity();

    const bads = L.querySelectorAll('.fg-target.fg-junk, .fg-target.fg-wrong, .fg-target.fg-decoy');
    bads.forEach(el=>{
      const fx = ensureFxHost(el);
      if (!fx) return;
      const gl = fx.querySelector('.fg-goo-layer');
      if (!gl) return;

      const b = DOC.createElement('span');
      b.className = 'fg-goo-bubble';
      b.style.left = rnd(14, 86).toFixed(1) + '%';
      b.style.top  = rnd(18, 86).toFixed(1) + '%';
      b.style.setProperty('--dur', rnd(520, 980).toFixed(0)+'ms');
      gl.appendChild(b);
      setTimeout(()=>b.remove(), 1050);

      while (gl.childElementCount > Math.max(14, rate*4)) gl.firstElementChild?.remove();
    });
  }

  // Observe new targets => spawn burst
  function observe(){
    const L = layer();
    if (!L) return;

    const mo = new MutationObserver((muts)=>{
      muts.forEach(m=>{
        m.addedNodes && m.addedNodes.forEach(n=>{
          if (!n || n.nodeType !== 1) return;
          const el = n;
          if (!el.classList || !el.classList.contains('fg-target')) return;
          ensureFxHost(el);
          burst(el,'spawn');
        });
      });
    });
    mo.observe(L, { childList:true });
  }

  // Hit burst (capture)
  function bindHit(){
    const L = layer();
    if (!L) return;
    L.addEventListener('pointerdown', (e)=>{
      const t = e.target && e.target.closest ? e.target.closest('.fg-target') : null;
      if (!t) return;
      burst(t,'hit');
    }, { passive:true, capture:true });
  }

  // Boot when layer exists
  let tries = 0;
  const it = setInterval(()=>{
    tries++;
    const L = layer();
    if (L){
      clearInterval(it);
      observe();
      bindHit();

      // trails + goo
      setInterval(trailTick, 140);
      setInterval(gooTick, 220);
    }
    if (tries > 80) clearInterval(it);
  }, 80);

})(typeof window !== 'undefined' ? window : globalThis);
