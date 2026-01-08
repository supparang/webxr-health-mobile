// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (Unified FX for all games)
// Provides: window.Particles.{popText,burst,shockwave,celebrate,scorePop,burstAt}

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------- layer ----------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- css ----------
  const st = doc.createElement('style');
  st.textContent = `
    .hha-fx-pop{
      position:absolute; transform:translate(-50%,-50%);
      font: 1000 18px/1 system-ui; color:#fff;
      text-shadow: 0 10px 30px rgba(0,0,0,.55);
      opacity:.98; will-change: transform, opacity;
      animation: hhaPop 560ms ease-out forwards;
      padding:6px 10px; border-radius:999px;
      background: rgba(15,23,42,.22);
      border: 1px solid rgba(148,163,184,.18);
      backdrop-filter: blur(8px);
      letter-spacing: .2px;
    }
    .hha-fx-pop.big{ font-size:22px; }
    .hha-fx-pop.perfect{ font-size:22px; background: rgba(34,197,94,.18); border-color: rgba(34,197,94,.28); }
    .hha-fx-pop.bad{ background: rgba(239,68,68,.16); border-color: rgba(239,68,68,.26); }
    .hha-fx-pop.score{ background: rgba(59,130,246,.14); border-color: rgba(59,130,246,.24); }
    .hha-fx-pop.block{ background: rgba(34,211,238,.12); border-color: rgba(34,211,238,.22); }

    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.9); opacity:.95; }
      60%{ transform:translate(-50%,-78%) scale(1.15); opacity:1; }
      100%{ transform:translate(-50%,-104%) scale(1.02); opacity:0; }
    }

    .hha-fx-dot{
      position:absolute; width:8px; height:8px; border-radius:999px;
      transform:translate(-50%,-50%);
      opacity:.95;
      filter: drop-shadow(0 10px 20px rgba(0,0,0,.55));
      will-change: transform, opacity;
      animation: hhaDot 520ms ease-out forwards;
    }
    @keyframes hhaDot{
      0%{ transform:translate(-50%,-50%) scale(1); opacity:.95; }
      100%{ transform:translate(var(--dx), var(--dy)) scale(.85); opacity:0; }
    }

    .hha-fx-ring{
      position:absolute; left:0; top:0;
      width:120px; height:120px; border-radius:999px;
      transform:translate(-50%,-50%) scale(.35);
      border: 3px solid rgba(255,255,255,.72);
      box-shadow: 0 0 0 2px rgba(0,0,0,.08) inset;
      opacity:.75; will-change: transform, opacity;
      animation: hhaRing 520ms ease-out forwards;
      mix-blend-mode: screen;
    }
    @keyframes hhaRing{
      0%{ transform:translate(-50%,-50%) scale(.25); opacity:.75; }
      100%{ transform:translate(-50%,-50%) scale(1.25); opacity:0; }
    }
  `;
  doc.head.appendChild(st);

  // ---------- helpers ----------
  function rand(a,b){ return a + Math.random()*(b-a); }
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-fx-pop' + (cls ? ` ${cls}` : '');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  function burst(x,y, opts={}){
    const layer = ensureLayer();
    const r = Number(opts.r)||46;
    const n = Math.max(8, Math.min(22, Math.round(r/3)));
    for(let i=0;i<n;i++){
      const el = doc.createElement('div');
      el.className = 'hha-fx-dot';
      const ang = (Math.PI*2) * (i/n) + rand(-0.12,0.12);
      const dist = rand(r*0.55, r*1.15);
      const dx = Math.cos(ang)*dist;
      const dy = Math.sin(ang)*dist;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.style.setProperty('--dx', (dx)+'px');
      el.style.setProperty('--dy', (dy)+'px');
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
    }
  }

  function shockwave(x,y, opts={}){
    const layer = ensureLayer();
    const r = Number(opts.r)||60;
    const ring = doc.createElement('div');
    ring.className = 'hha-fx-ring';
    ring.style.left = x + 'px';
    ring.style.top  = y + 'px';
    ring.style.width = (r*2) + 'px';
    ring.style.height= (r*2) + 'px';
    layer.appendChild(ring);
    setTimeout(()=>{ try{ ring.remove(); }catch(_){ } }, 700);
    burst(x,y,{r: Math.max(28, r*0.7)});
  }

  function celebrate(){
    const cx = innerWidth/2, cy = innerHeight*0.35;
    for(let i=0;i<10;i++){
      setTimeout(()=> burst(cx + rand(-180,180), cy + rand(-90,90), {r: rand(30,70)}), i*45);
    }
    popText(cx, cy-10, '🎉', 'big');
  }

  function scorePop(x,y,text){
    popText(x,y,text, (String(text).includes('-')?'bad':'score'));
  }

  function burstAt(x,y,kind='good'){
    if(kind==='bad' || kind==='junk') shockwave(x,y,{r:66});
    else if(kind==='shield' || kind==='block') burst(x,y,{r:44});
    else if(kind==='diamond') shockwave(x,y,{r:78});
    else if(kind==='star') burst(x,y,{r:58});
    else shockwave(x,y,{r:56});
  }

  root.Particles = root.Particles || {};
  Object.assign(root.Particles, { popText, burst, shockwave, celebrate, scorePop, burstAt });
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);