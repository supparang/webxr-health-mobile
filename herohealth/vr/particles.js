// === /herohealth/vr/particles.js ===
// HHA Particles — FULL FX (PRODUCTION)
// ✅ Works across all games (GoodJunk / Hydration / Plate / Groups)
// ✅ Provides:
//    - popText(x,y,text,cls?)
//    - scorePop(x,y,text)
//    - burst(x,y,{r?})
//    - burstAt(x,y,kind?)   (compat with older game calls)
//    - shockwave(x,y,{r?})
//    - celebrate()
// ✅ Safe: creates its own fixed layer, pointer-events:none
// ✅ No external CSS required (injects minimal keyframes)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // -------------------- layer --------------------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:9995',
      'overflow:hidden'
    ].join(';');
    doc.body.appendChild(layer);
    return layer;
  }

  // -------------------- css --------------------
  (function injectStyle(){
    const id = 'hha-particles-style';
    if(doc.getElementById(id)) return;

    const st = doc.createElement('style');
    st.id = id;
    st.textContent = `
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.96; filter: blur(0px); }
        65%{ transform:translate(-50%,-78%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-96%) scale(1.06); opacity:0; filter: blur(.2px); }
      }
      @keyframes hhaSpark{
        0%{ transform:translate(-50%,-50%) scale(.8) rotate(0deg); opacity:1; }
        100%{ transform:translate(-50%,-50%) scale(1.25) rotate(25deg); opacity:0; }
      }
      @keyframes hhaDot{
        0%{ transform:translate3d(var(--sx),var(--sy),0) scale(1); opacity:1; }
        100%{ transform:translate3d(var(--ex),var(--ey),0) scale(.65); opacity:0; }
      }
      @keyframes hhaRing{
        0%{ transform:translate(-50%,-50%) scale(.25); opacity:.75; }
        100%{ transform:translate(-50%,-50%) scale(1.05); opacity:0; }
      }
      @keyframes hhaConfetti{
        0%{ transform:translate3d(var(--sx),var(--sy),0) rotate(0deg); opacity:1; }
        100%{ transform:translate3d(var(--ex),var(--ey),0) rotate(var(--rot)); opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  })();

  // -------------------- helpers --------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const rnd = (a,b)=> a + Math.random()*(b-a);

  function el(tag, cssText){
    const n = doc.createElement(tag);
    if(cssText) n.style.cssText = cssText;
    return n;
  }

  // -------------------- pop text --------------------
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const n = el('div', `
      position:absolute; left:${x}px; top:${y}px;
      transform: translate(-50%,-50%);
      font: 1000 18px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      color:#fff;
      text-shadow: 0 10px 26px rgba(0,0,0,.58);
      opacity:.98;
      padding:6px 10px;
      border-radius:999px;
      background: rgba(2,6,23,.20);
      border:1px solid rgba(148,163,184,.18);
      backdrop-filter: blur(8px);
      animation: hhaPop 560ms ease-out forwards;
      will-change: transform, opacity;
    `);

    // class hint (optional)
    const c = String(cls||'').toLowerCase();
    if(c.includes('perfect')){
      n.style.fontSize = '20px';
      n.style.border = '1px solid rgba(34,197,94,.35)';
      n.style.background = 'rgba(34,197,94,.16)';
    } else if(c.includes('block')){
      n.style.border = '1px solid rgba(34,211,238,.32)';
      n.style.background = 'rgba(34,211,238,.12)';
    } else if(c.includes('big')){
      n.style.fontSize = '22px';
      n.style.border = '1px solid rgba(234,179,8,.35)';
      n.style.background = 'rgba(234,179,8,.14)';
    }

    n.textContent = text;
    layer.appendChild(n);
    setTimeout(()=>{ try{ n.remove(); }catch(_){ } }, 700);
  }

  // "scorePop" legacy-friendly alias
  function scorePop(x,y,text){
    popText(x,y,text,'score');
  }

  // -------------------- burst --------------------
  function burst(x,y,opts={}){
    const layer = ensureLayer();
    const r = clamp(Number(opts.r)||56, 26, 120);

    // center spark
    const spark = el('div', `
      position:absolute; left:${x}px; top:${y}px;
      width:${Math.round(r*0.45)}px; height:${Math.round(r*0.45)}px;
      transform: translate(-50%,-50%);
      border-radius: 999px;
      background: radial-gradient(circle at 35% 35%, rgba(255,255,255,.95), rgba(255,255,255,.0) 65%);
      filter: drop-shadow(0 10px 24px rgba(0,0,0,.35));
      opacity:.85;
      animation: hhaSpark 240ms ease-out forwards;
    `);
    layer.appendChild(spark);
    setTimeout(()=>{ try{ spark.remove(); }catch(_){ } }, 320);

    // dots
    const nDots = Math.round(clamp(r/7, 6, 14));
    for(let i=0;i<nDots;i++){
      const ang = (Math.PI*2) * (i/nDots) + rnd(-0.18,0.18);
      const dist = rnd(r*0.55, r*1.05);
      const ex = Math.cos(ang)*dist;
      const ey = Math.sin(ang)*dist;

      const dot = el('div', `
        position:absolute; left:${x}px; top:${y}px;
        width:${rnd(4,7)}px; height:${rnd(4,7)}px;
        border-radius:999px;
        background: rgba(255,255,255,.92);
        box-shadow: 0 10px 22px rgba(0,0,0,.35);
        --sx: -50%; --sy: -50%;
        --ex: calc(-50% + ${Math.round(ex)}px);
        --ey: calc(-50% + ${Math.round(ey)}px);
        animation: hhaDot ${Math.round(rnd(240,420))}ms ease-out forwards;
      `);
      layer.appendChild(dot);
      setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, 520);
    }
  }

  // older engines sometimes call burstAt(x,y,kind)
  function burstAt(x,y,kind='good'){
    const k = String(kind||'').toLowerCase();
    const r = k.includes('bad') || k.includes('junk') ? 66 :
              k.includes('block') || k.includes('shield') ? 52 :
              k.includes('diamond') ? 78 :
              k.includes('star') ? 62 : 56;
    burst(x,y,{r});
  }

  // -------------------- shockwave --------------------
  function shockwave(x,y,opts={}){
    const layer = ensureLayer();
    const r = clamp(Number(opts.r)||66, 36, 140);

    const ring = el('div', `
      position:absolute; left:${x}px; top:${y}px;
      width:${Math.round(r*1.2)}px; height:${Math.round(r*1.2)}px;
      transform: translate(-50%,-50%) scale(.25);
      border-radius:999px;
      border: 2px solid rgba(255,255,255,.34);
      box-shadow: 0 18px 40px rgba(0,0,0,.28);
      opacity:.75;
      animation: hhaRing 360ms ease-out forwards;
      will-change: transform, opacity;
    `);
    layer.appendChild(ring);
    setTimeout(()=>{ try{ ring.remove(); }catch(_){ } }, 520);

    // add small burst too (feel stronger)
    burst(x,y,{r: Math.round(r*0.8)});
  }

  // -------------------- celebrate --------------------
  function celebrate(){
    const layer = ensureLayer();
    const W = doc.documentElement.clientWidth || innerWidth;
    const H = doc.documentElement.clientHeight || innerHeight;

    const n = 26; // confetti count
    for(let i=0;i<n;i++){
      const x = rnd(W*0.18, W*0.82);
      const y = rnd(H*0.18, H*0.38);

      const ex = rnd(-220, 220);
      const ey = rnd(180, 520);
      const rot = `${Math.round(rnd(-420, 420))}deg`;

      const w = rnd(6, 10), h = rnd(10, 16);
      const c = Math.random() < 0.5 ? 'rgba(255,255,255,.92)' : 'rgba(34,197,94,.78)';

      const piece = el('div', `
        position:absolute; left:${x}px; top:${y}px;
        width:${w}px; height:${h}px;
        border-radius: 6px;
        background:${c};
        box-shadow: 0 16px 38px rgba(0,0,0,.35);
        --sx: -50%; --sy: -50%;
        --ex: calc(-50% + ${Math.round(ex)}px);
        --ey: calc(-50% + ${Math.round(ey)}px);
        --rot: ${rot};
        animation: hhaConfetti ${Math.round(rnd(520,880))}ms ease-out forwards;
        opacity:.95;
      `);
      layer.appendChild(piece);
      setTimeout(()=>{ try{ piece.remove(); }catch(_){ } }, 980);
    }
  }

  // -------------------- export --------------------
  root.Particles = root.Particles || {};
  root.Particles.popText   = popText;
  root.Particles.scorePop  = scorePop;
  root.Particles.burst     = burst;
  root.Particles.burstAt   = burstAt;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // also mirror to GAME_MODULES (compat)
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);