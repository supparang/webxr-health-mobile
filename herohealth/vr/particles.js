// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION
// ✅ One global FX layer (.hha-fx-layer)
// ✅ scorePop(x,y,text,cls?)
// ✅ burstAt(x,y,kind?)  kind: good|bad|star|shield|diamond|block
// ✅ celebrate(kind?)    kind: end|mini|goal|boss|storm
// ✅ shake(intensityMs?) body micro-shake
// ✅ Safe (never throws); can be reused across all HeroHealth games.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // -------------------- helpers --------------------
  const clamp = (v, a, b)=> (v<a?a:(v>b?b:v));
  const rnd = (a,b)=> a + Math.random()*(b-a);
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0;
      pointer-events:none;
      z-index: 250;
      overflow:hidden;
      contain: layout style paint;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureStyle(){
    if (doc.getElementById('hhaFxStyle')) return;
    const st = doc.createElement('style');
    st.id = 'hhaFxStyle';
    st.textContent = `
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.85); opacity:.0; }
        10%{ opacity:1; }
        70%{ transform:translate(-50%,-85%) scale(1.15); opacity:1; }
        100%{ transform:translate(-50%,-110%) scale(1.05); opacity:0; }
      }
      @keyframes hhaBurst{
        0%{ transform:translate(-50%,-50%) scale(.4) rotate(0deg); opacity:.0; }
        12%{ opacity:1; }
        60%{ transform:translate(-50%,-50%) scale(1.05) rotate(10deg); opacity:1; }
        100%{ transform:translate(-50%,-50%) scale(1.5) rotate(25deg); opacity:0; }
      }
      @keyframes hhaShard{
        0%{ transform:translate(-50%,-50%) translate(0,0) scale(.9); opacity:1; }
        100%{ transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.6); opacity:0; }
      }
      @keyframes hhaPulse{
        0%{ transform:translate(-50%,-50%) scale(.9); opacity:.0; }
        20%{ opacity:1; }
        70%{ transform:translate(-50%,-50%) scale(1.15); opacity:1; }
        100%{ transform:translate(-50%,-50%) scale(1.05); opacity:0; }
      }
      @keyframes hhaShake{
        0%{ transform:translate3d(0,0,0); }
        20%{ transform:translate3d(-2px,1px,0); }
        40%{ transform:translate3d(2px,-1px,0); }
        60%{ transform:translate3d(-2px,-1px,0); }
        80%{ transform:translate3d(2px,1px,0); }
        100%{ transform:translate3d(0,0,0); }
      }

      .hha-fx-pop{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaPop 560ms ease-out forwards;
        user-select:none;
      }
      .hha-fx-pop.small{ font-size:14px; opacity:.92; }
      .hha-fx-pop.big{ font-size:22px; }

      .hha-fx-burst{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 900 34px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        text-shadow: 0 14px 35px rgba(0,0,0,.55);
        opacity:.0;
        will-change: transform, opacity;
        animation: hhaBurst 520ms ease-out forwards;
        user-select:none;
      }

      .hha-fx-shard{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 900 14px/1 system-ui;
        opacity:1;
        will-change: transform, opacity;
        animation: hhaShard 520ms ease-out forwards;
        user-select:none;
        filter: drop-shadow(0 10px 22px rgba(0,0,0,.45));
      }

      .hha-body-shake{
        animation: hhaShake 140ms linear 1;
      }

      .hha-fx-pulse{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 1000 46px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        opacity:0;
        will-change: transform, opacity;
        animation: hhaPulse 620ms ease-out forwards;
        user-select:none;
        text-shadow: 0 18px 45px rgba(0,0,0,.55);
      }
    `;
    doc.head.appendChild(st);
  }

  function removeSoon(el, ms){
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms);
  }

  function scorePop(x,y,text,cls){
    try{
      ensureStyle();
      const layer = ensureLayer();
      const el = doc.createElement('div');
      el.className = 'hha-fx-pop' + (cls ? (' ' + cls) : '');
      el.textContent = String(text ?? '');
      el.style.left = (x|0) + 'px';
      el.style.top  = (y|0) + 'px';
      layer.appendChild(el);
      removeSoon(el, 700);
    }catch(_){}
  }

  function burstAt(x,y,kind){
    try{
      ensureStyle();
      const layer = ensureLayer();
      const k = String(kind||'good');
      const glyph =
        (k==='good') ? '✨' :
        (k==='bad') ? '💥' :
        (k==='star') ? '⭐' :
        (k==='shield') ? '🛡️' :
        (k==='diamond') ? '💎' :
        (k==='block') ? '🧱' :
        '✨';

      const el = doc.createElement('div');
      el.className = 'hha-fx-burst';
      el.textContent = glyph;
      el.style.left = (x|0) + 'px';
      el.style.top  = (y|0) + 'px';
      // slight random tilt/scale
      el.style.transform = `translate(-50%,-50%) scale(${rnd(0.9,1.2).toFixed(2)}) rotate(${rnd(-10,10).toFixed(1)}deg)`;
      layer.appendChild(el);
      removeSoon(el, 650);

      // shards
      const shardCount =
        (k==='diamond') ? 14 :
        (k==='bad') ? 10 :
        (k==='shield' || k==='star') ? 8 : 9;

      const shardGlyph =
        (k==='diamond') ? '✦' :
        (k==='bad') ? '•' :
        (k==='shield') ? '▦' :
        (k==='star') ? '✺' : '✧';

      for(let i=0;i<shardCount;i++){
        const s = doc.createElement('div');
        s.className = 'hha-fx-shard';
        s.textContent = shardGlyph;
        s.style.left = (x|0) + 'px';
        s.style.top  = (y|0) + 'px';
        s.style.setProperty('--dx', rnd(-80,80).toFixed(1)+'px');
        s.style.setProperty('--dy', rnd(-70,90).toFixed(1)+'px');
        s.style.opacity = String(rnd(0.5, 0.95));
        s.style.fontSize = rnd(12, 18).toFixed(0)+'px';
        layer.appendChild(s);
        removeSoon(s, 700);
      }
    }catch(_){}
  }

  function celebrate(kind){
    try{
      ensureStyle();
      const layer = ensureLayer();
      const k = String(kind||'end');

      const W = doc.documentElement.clientWidth || 360;
      const H = doc.documentElement.clientHeight || 640;

      const label =
        (k==='mini') ? 'MINI!' :
        (k==='goal') ? 'GOAL!' :
        (k==='boss') ? 'BOSS!' :
        (k==='storm') ? 'STORM!' :
        'NICE!';

      // center pulse
      const cx = (W/2)|0;
      const cy = Math.floor(H*0.34);
      const p = doc.createElement('div');
      p.className = 'hha-fx-pulse';
      p.textContent = label;
      p.style.left = cx + 'px';
      p.style.top  = cy + 'px';
      layer.appendChild(p);
      removeSoon(p, 760);

      // confetti shards
      const n = (k==='end') ? 40 : 26;
      for(let i=0;i<n;i++){
        const x = rnd(20, W-20);
        const y = rnd(40, H*0.55);
        burstAt(x, y, (k==='boss') ? 'bad' : 'good');
      }
    }catch(_){}
  }

  function shake(ms){
    try{
      const b = doc.body;
      if(!b) return;
      b.classList.add('hha-body-shake');
      setTimeout(()=>{ try{ b.classList.remove('hha-body-shake'); }catch(_){ } }, clamp(Number(ms)||140, 90, 220));
    }catch(_){}
  }

  // Expose
  root.Particles = root.Particles || {};
  root.Particles.scorePop  = root.Particles.scorePop  || scorePop;
  root.Particles.popText   = root.Particles.popText   || scorePop; // alias for old calls
  root.Particles.burstAt   = root.Particles.burstAt   || burstAt;
  root.Particles.celebrate = root.Particles.celebrate || celebrate;
  root.Particles.shake     = root.Particles.shake     || shake;

})(window);