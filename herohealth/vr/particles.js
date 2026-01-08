// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (burst/shockwave/celebrate/popText/scorePop)
// Safe DOM-only FX layer, no canvas. Works across all games.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function injectCss(){
    const id = 'hha-particles-style';
    if (doc.getElementById(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-layer{contain:layout style paint;}
      .hha-pop{
        position:absolute; transform:translate(-50%,-50%);
        font: 1000 18px/1 system-ui; color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        will-change: transform, opacity, filter;
        opacity:.98;
        animation: hhaPop 560ms ease-out forwards;
        letter-spacing:.2px;
      }
      .hha-pop.big{ font-size:22px; filter: drop-shadow(0 10px 18px rgba(0,0,0,.45)); }
      .hha-pop.perfect{ font-size:24px; }
      .hha-pop.bad{ filter: saturate(1.2) brightness(1.05); }
      .hha-pop.block{ filter: saturate(.9) brightness(1.1); }
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.95; }
        55%{ transform:translate(-50%,-82%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-108%) scale(1.05); opacity:0; }
      }

      .hha-burst{
        position:absolute; transform:translate(-50%,-50%);
        width:12px;height:12px;border-radius:999px;
        opacity:.98; mix-blend-mode:screen;
        will-change: transform, opacity, filter;
        animation: hhaBurst 520ms ease-out forwards;
      }
      @keyframes hhaBurst{
        0%{ transform:translate(-50%,-50%) scale(.7); opacity:.95; }
        70%{ transform:translate(-50%,-50%) scale(1.55); opacity:.85; }
        100%{ transform:translate(-50%,-50%) scale(2.0); opacity:0; }
      }

      .hha-shock{
        position:absolute; transform:translate(-50%,-50%);
        width:18px;height:18px;border-radius:999px;
        border:2px solid rgba(255,255,255,.75);
        box-shadow: 0 0 0 2px rgba(255,255,255,.08) inset;
        opacity:.9;
        will-change: transform, opacity, filter;
        animation: hhaShock 540ms ease-out forwards;
      }
      @keyframes hhaShock{
        0%{ transform:translate(-50%,-50%) scale(.35); opacity:.92; }
        70%{ transform:translate(-50%,-50%) scale(2.2); opacity:.55; }
        100%{ transform:translate(-50%,-50%) scale(3.0); opacity:0; }
      }

      .hha-confetti{
        position:absolute; width:10px; height:10px; border-radius:3px;
        opacity:.95; will-change: transform, opacity;
        animation: hhaConfetti 980ms ease-out forwards;
        filter: drop-shadow(0 10px 16px rgba(0,0,0,.35));
      }
      @keyframes hhaConfetti{
        0%{ transform: translate3d(0,0,0) rotate(0deg); opacity:.98; }
        80%{ opacity:.9; }
        100%{ transform: translate3d(var(--dx, 0px), var(--dy, 520px), 0) rotate(260deg); opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  }

  function popText(x,y,text,cls){
    injectCss();
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop' + (cls ? ' ' + cls : '');
    el.textContent = String(text ?? '');
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function scorePop(x,y,text){
    const t = String(text ?? '');
    const cls = (t.includes('+') && t.length>=3) ? 'big' : 'score';
    popText(x,y,t,cls);
  }

  function burst(x,y,opts={}){
    injectCss();
    const layer = ensureLayer();
    const r = Math.max(10, Math.min(120, Number(opts.r ?? 52)));
    const el = doc.createElement('div');
    el.className = 'hha-burst';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;

    // “kind” tint via filter (no explicit colors needed)
    const kind = String(opts.kind || '').toLowerCase();
    if(kind.includes('bad') || kind.includes('junk')) el.style.filter = 'hue-rotate(325deg) saturate(1.25)';
    else if(kind.includes('star')) el.style.filter = 'hue-rotate(55deg) saturate(1.1)';
    else if(kind.includes('shield') || kind.includes('block')) el.style.filter = 'hue-rotate(190deg) saturate(1.05)';
    else if(kind.includes('diamond')) el.style.filter = 'hue-rotate(285deg) saturate(1.25)';
    else el.style.filter = 'hue-rotate(0deg) saturate(1.05)';

    el.style.width = `${Math.round(r*0.22)}px`;
    el.style.height= `${Math.round(r*0.22)}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 600);
  }

  function shockwave(x,y,opts={}){
    injectCss();
    const layer = ensureLayer();
    const r = Math.max(20, Math.min(160, Number(opts.r ?? 70)));
    const el = doc.createElement('div');
    el.className = 'hha-shock';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width  = `${Math.round(r*0.28)}px`;
    el.style.height = `${Math.round(r*0.28)}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function celebrate(){
    injectCss();
    const layer = ensureLayer();
    const W = innerWidth, H = innerHeight;
    const n = 26;

    for(let i=0;i<n;i++){
      const el = doc.createElement('div');
      el.className = 'hha-confetti';

      const x = (W*0.18) + Math.random()*(W*0.64);
      const y = H*0.06 + Math.random()*(H*0.14);

      el.style.left = `${Math.round(x)}px`;
      el.style.top  = `${Math.round(y)}px`;

      const dx = (Math.random()*2-1) * 260;
      const dy = 420 + Math.random()*420;
      el.style.setProperty('--dx', `${Math.round(dx)}px`);
      el.style.setProperty('--dy', `${Math.round(dy)}px`);

      // tint variety without hardcoding palette
      el.style.filter = `hue-rotate(${Math.floor(Math.random()*360)}deg) saturate(1.25)`;

      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 1100);
    }
  }

  // Convenience: burstAt(kind)
  function burstAt(x,y,kind='good'){
    burst(x,y,{ r: 58, kind });
    shockwave(x,y,{ r: 74 });
  }

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;
  root.Particles.burstAt = burstAt;
})(window);