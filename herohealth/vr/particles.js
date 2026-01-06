// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (universal)
// ✅ Provides: popText, scorePop, burstAt, shockwave, celebrate
// ✅ Safe: auto inject layer + minimal CSS
// ✅ Works for all games

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES_PRO__) return;
  root.__HHA_PARTICLES_PRO__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9996;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  function injectCss(){
    if (doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      .hha-fx-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 1000 18px/1 system-ui;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.65);
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaPop 560ms ease-out forwards;
      }
      .hha-fx-pop.big{ font-size: 24px; }
      .hha-fx-pop.perfect{ font-size: 22px; letter-spacing:.5px; }
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.90); opacity:.92; }
        55%{ transform:translate(-50%,-78%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-98%) scale(1.05); opacity:0; }
      }

      .hha-fx-dot{
        position:absolute;
        width:8px; height:8px;
        border-radius:999px;
        background: rgba(255,255,255,.92);
        box-shadow: 0 10px 26px rgba(0,0,0,.55);
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
      }

      .hha-fx-ring{
        position:absolute;
        border-radius:999px;
        border:2px solid rgba(255,255,255,.75);
        transform: translate(-50%,-50%);
        opacity:.95;
        will-change: transform, opacity;
        box-shadow: 0 10px 26px rgba(0,0,0,.45);
      }
    `;
    doc.head.appendChild(st);
  }

  injectCss();

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-fx-pop' + (cls ? (' ' + cls) : '');
    el.textContent = String(text ?? '');
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  function scorePop(x,y,text){
    const s = String(text ?? '');
    const n = Number(s.replace('+','').replace('-',''));
    const big = Number.isFinite(n) && n >= 50;
    popText(x,y,s, big ? 'big' : 'score');
  }

  function burstAt(x,y,kind){
    const layer = ensureLayer();
    const k = String(kind||'good');
    const n = (k==='bad')? 14 : (k==='diamond'? 18 : 12);
    const r0 = (k==='bad')? 34 : (k==='diamond'? 46 : 38);

    for(let i=0;i<n;i++){
      const dot = doc.createElement('div');
      dot.className = 'hha-fx-dot';

      const a = (Math.PI*2) * (i/n) + (Math.random()*0.6-0.3);
      const r = r0 + Math.random()*26;
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r;

      dot.style.left = (Number(x)||0) + 'px';
      dot.style.top  = (Number(y)||0) + 'px';
      dot.style.background =
        (k==='bad') ? 'rgba(255,90,90,.90)' :
        (k==='star') ? 'rgba(255,235,130,.92)' :
        (k==='shield') ? 'rgba(130,220,255,.92)' :
        (k==='diamond') ? 'rgba(200,160,255,.92)' :
        'rgba(160,255,190,.92)';

      const dur = 480 + Math.random()*200;

      dot.animate([
        { transform:`translate(-50%,-50%) translate(0px,0px) scale(1)`, opacity:1 },
        { transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.32)`, opacity:0 }
      ], { duration: dur, easing:'cubic-bezier(.2,.9,.2,1)', fill:'forwards' });

      layer.appendChild(dot);
      setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, dur + 80);
    }
  }

  function shockwave(x,y,opt){
    const layer = ensureLayer();
    const r = clamp(opt?.r ?? 64, 26, 180);
    const ring = doc.createElement('div');
    ring.className = 'hha-fx-ring';
    ring.style.left = (Number(x)||0) + 'px';
    ring.style.top  = (Number(y)||0) + 'px';
    ring.style.width  = (r*2) + 'px';
    ring.style.height = (r*2) + 'px';

    const dur = 520 + Math.random()*80;
    ring.animate([
      { transform:'translate(-50%,-50%) scale(.25)', opacity:.95 },
      { transform:'translate(-50%,-50%) scale(1.02)', opacity:.55, offset:0.7 },
      { transform:'translate(-50%,-50%) scale(1.28)', opacity:0 }
    ], { duration: dur, easing:'ease-out', fill:'forwards' });

    layer.appendChild(ring);
    setTimeout(()=>{ try{ ring.remove(); }catch(_){ } }, dur + 60);
  }

  function celebrate(){
    const cx = innerWidth/2, cy = innerHeight*0.32;
    for(let i=0;i<10;i++){
      setTimeout(()=>{
        burstAt(cx + (Math.random()*2-1)*180, cy + (Math.random()*2-1)*90, 'good');
        shockwave(cx + (Math.random()*2-1)*90, cy + (Math.random()*2-1)*60, { r: 72 + Math.random()*46 });
      }, i*55);
    }
  }

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt = burstAt;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;
})(window);