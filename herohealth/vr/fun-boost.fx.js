/* === /herohealth/vr/fun-boost.fx.js ===
   Minimal HUD FX listener for hha:fx / hha:director
   - Adds: screen flash + floating text + micro shake
*/
(function(){
  'use strict';
  const DOC = document;

  function ensureLayer(){
    let el = DOC.getElementById('hha-fx-layer');
    if(el) return el;
    el = DOC.createElement('div');
    el.id = 'hha-fx-layer';
    el.innerHTML = `
      <div id="hha-fx-flash"></div>
      <div id="hha-fx-text"></div>
    `;
    const style = DOC.createElement('style');
    style.textContent = `
      #hha-fx-layer{ position:fixed; inset:0; pointer-events:none; z-index:9997; }
      #hha-fx-flash{ position:absolute; inset:0; opacity:0; background: rgba(255,255,255,.10); transition: opacity .12s ease; }
      #hha-fx-text{
        position:absolute; left:50%; top:18%;
        transform: translate(-50%,-50%);
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Thai", Arial;
        font-weight: 950;
        letter-spacing:.2px;
        font-size: clamp(18px, 3vw, 30px);
        opacity:0;
        text-shadow: 0 10px 40px rgba(0,0,0,.55);
        transition: opacity .14s ease, transform .14s ease;
        white-space:nowrap;
      }
      .hha-shake{ animation: hhaShake .18s ease; }
      @keyframes hhaShake{
        0%{ transform: translate3d(0,0,0); }
        25%{ transform: translate3d(1px,0,0); }
        50%{ transform: translate3d(-1px,1px,0); }
        75%{ transform: translate3d(1px,-1px,0); }
        100%{ transform: translate3d(0,0,0); }
      }
    `;
    DOC.head.appendChild(style);
    DOC.body.appendChild(el);
    return el;
  }

  function colorOf(hint){
    if(hint==='good') return 'rgba(34,197,94,.95)';
    if(hint==='cyan') return 'rgba(34,211,238,.95)';
    if(hint==='violet') return 'rgba(167,139,250,.95)';
    if(hint==='amber') return 'rgba(245,158,11,.95)';
    if(hint==='pink') return 'rgba(255,79,216,.95)';
    return 'rgba(229,231,235,.95)';
  }

  let flashTimer = null;
  let textTimer = null;

  window.addEventListener('hha:fx', (ev)=>{
    ensureLayer();
    const d = (ev && ev.detail) || {};
    const amp = Math.max(0, Math.min(1, +d.amp || 0.35));
    const ms = Math.max(60, +d.ms || 120);

    const flash = DOC.getElementById('hha-fx-flash');
    const text = DOC.getElementById('hha-fx-text');

    // flash
    clearTimeout(flashTimer);
    flash.style.background = `rgba(255,255,255,${0.06 + amp*0.10})`;
    flash.style.opacity = String(0.9);
    flashTimer = setTimeout(()=>{ flash.style.opacity = '0'; }, ms);

    // text
    clearTimeout(textTimer);
    const t = (d.text || '').trim();
    if(t){
      text.textContent = t;
      text.style.color = colorOf(d.colorHint);
      text.style.opacity = '1';
      text.style.transform = 'translate(-50%,-55%)';
      textTimer = setTimeout(()=>{
        text.style.opacity = '0';
        text.style.transform = 'translate(-50%,-45%)';
      }, Math.min(900, ms + 520));
    }

    // micro shake on body
    DOC.body.classList.remove('hha-shake');
    // force reflow
    void DOC.body.offsetWidth;
    DOC.body.classList.add('hha-shake');
    setTimeout(()=> DOC.body.classList.remove('hha-shake'), 220);
  });

})();