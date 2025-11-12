// === /HeroHealth/vr/particles.js (2025-11-12 LATEST) ===
// Lightweight DOM FX used across modes.
// APIs:
//   Particles.scorePop({ x, y, delta, good, duration? })
//   Particles.burstShards(host?, pos?, { screen:{x,y}?, theme? , count? , spread? , duration? })
//
// - Works on top of DOM (.game-wrap) with its own FX layer
// - Safe on mobile (no passive scroll; visualViewport offset guarded)

export const Particles = (function(){
  // ---------- Layer & CSS ----------
  function mountLayer(){
    let mount = document.querySelector('.game-wrap') || document.body;
    let fx = document.getElementById('hha-fx-layer');
    if(!fx){
      fx = document.createElement('div');
      fx.id = 'hha-fx-layer';
      fx.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:700;';
      mount.appendChild(fx);
    }
    return fx;
  }

  (function injectCSS(){
    if(document.getElementById('hha-fx-style')) return;
    const st = document.createElement('style'); st.id='hha-fx-style';
    st.textContent = `
      /* scorePop */
      .fx-pop{
        position:absolute; transform:translate(-50%,-60%);
        font:900 18px system-ui, -apple-system, Segoe UI, Roboto, "Noto Color Emoji", "Apple Color Emoji", sans-serif;
        padding:2px 6px; border-radius:10px;
        filter: drop-shadow(0 8px 14px rgba(0,0,0,.45));
        will-change: transform, opacity;
        pointer-events:none;
        opacity:0.98;
      }
      .fx-pop.good{ color:#bbf7d0; background:#16a34a22; border:1px solid #16a34a55; text-shadow:0 0 10px #16a34a99; }
      .fx-pop.bad { color:#fecaca; background:#ef444422; border:1px solid #ef444455; text-shadow:0 0 10px #ef444499; }
      .fx-pop.zero{ color:#e5e7eb; background:#33415555; border:1px solid #64748b88; }

      /* shards */
      .fx-shard{
        position:absolute; width:8px; height:8px; border-radius:2px;
        opacity:0.95; will-change: transform, opacity;
        pointer-events:none; transform:translate(-50%,-50%);
        box-shadow:0 0 6px rgba(255,255,255,.25);
      }
    `;
    document.head.appendChild(st);
  })();

  // ---------- Helpers ----------
  function vvOffsetY(){
    try{ return (window.visualViewport && window.visualViewport.offsetTop) ? window.visualViewport.offsetTop : 0; }
    catch(_){ return 0; }
  }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function themeColors(theme){
    switch(theme){
      case 'goodjunk': return ['#34d399','#10b981','#059669','#22c55e','#a7f3d0'];
      case 'groups':   return ['#fde047','#facc15','#eab308','#f59e0b','#fef08a'];
      case 'hydration':return ['#93c5fd','#60a5fa','#3b82f6','#2563eb','#bfdbfe'];
      case 'plate':    return ['#86efac','#22c55e','#4ade80','#a7f3d0','#16a34a'];
      default:         return ['#c084fc','#a78bfa','#60a5fa','#34d399','#f59e0b'];
    }
  }

  // ---------- scorePop ----------
  function scorePop(opts){
    const fx = mountLayer();
    const x = (opts?.x|0), yRaw = (opts?.y|0);
    const y = yRaw - vvOffsetY(); // guard mobile viewport offset

    const delta = Number(opts?.delta||0);
    const good  = !!opts?.good;
    const dur   = clamp(Number(opts?.duration||900), 300, 2000);

    const el = document.createElement('div');
    el.className = `fx-pop ${delta>0? 'good' : (delta<0? 'bad' : 'zero')}`;
    const sign = delta>0? '+' : '';
    el.textContent = `${sign}${delta|0}`;
    el.style.left = x+'px';
    el.style.top  = y+'px';
    fx.appendChild(el);

    // Animate up + fade
    const startY = -60, endY = -100;
    const start = performance.now();
    const tick = (t)=>{
      const k = clamp((t-start)/dur, 0, 1);
      const ease = 1 - Math.pow(1-k, 3); // ease-out
      el.style.transform = `translate(-50%, ${startY + (endY-startY)*ease}px)`;
      el.style.opacity   = String(0.98 * (1 - k*0.95));
      if(k < 1) requestAnimationFrame(tick);
      else { try{ fx.removeChild(el); }catch(_){ el.remove(); } }
    };
    requestAnimationFrame(tick);
  }

  // ---------- burstShards ----------
  function burstShards(host, pos, opts){
    const fx = mountLayer();
    const screen = opts?.screen || { x:(pos?.x||0), y:(pos?.y||0) };
    const x = (screen.x|0), yRaw=(screen.y|0), y=yRaw - vvOffsetY();

    const colors = themeColors(opts?.theme);
    const count  = clamp(Number(opts?.count||16), 6, 48);
    const spread = clamp(Number(opts?.spread||60), 20, 120);
    const dur    = clamp(Number(opts?.duration||600), 300, 1500);

    for(let i=0;i<count;i++){
      const el = document.createElement('div');
      el.className = 'fx-shard';
      el.style.background = colors[i % colors.length];
      el.style.left = x+'px'; el.style.top = y+'px';
      fx.appendChild(el);

      const ang = (Math.random()*Math.PI*2);
      const dist = spread*(0.5+Math.random());
      const dx = Math.cos(ang)*dist, dy = Math.sin(ang)*dist;
      const rot = (Math.random()*360|0);

      const start = performance.now();
      const life = dur * (0.85 + Math.random()*0.3);
      const tick = (t)=>{
        const k = clamp((t-start)/life, 0, 1);
        const ease = 1 - Math.pow(1-k, 2); // ease-out
        el.style.transform = `translate(${(-50 + dx*ease)}px, ${(-50 + dy*ease)}px) rotate(${rot*ease}deg)`;
        el.style.opacity   = String(0.95 * (1 - k));
        if(k < 1) requestAnimationFrame(tick);
        else { try{ fx.removeChild(el); }catch(_){ el.remove(); } }
      };
      requestAnimationFrame(tick);
    }
  }

  return { scorePop, burstShards };
})();

export default { Particles };
