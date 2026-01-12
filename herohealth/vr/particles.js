// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (shared FX for all games)
// ✅ Safe: creates its own layer only (.hha-fx-layer) and styles scoped to it
// ✅ Works with any game (GoodJunk/Plate/Groups/Hydration)
// ✅ API:
//   Particles.popText(x,y,text,cls?)
//   Particles.scorePop(x,y,text,cls?)
//   Particles.burstAt(x,y,kind? or opts)
//   Particles.shockwave(x,y,opts?)
//   Particles.missX(x,y,opts?)
//   Particles.celebrate(opts?)
//
// Notes:
// - No dependencies.
// - Avoids overriding your game CSS.
// - Uses lightweight DOM nodes + CSS keyframes.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES_ULTRA__) return;
  root.__HHA_PARTICLES_ULTRA__ = true;

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const now = ()=> (root.performance ? performance.now() : Date.now());

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.setAttribute('aria-hidden','true');
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:90',
      'overflow:hidden'
    ].join(';') + ';';
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureVignette(){
    let v = doc.querySelector('.hha-fx-vignette');
    if(v) return v;
    v = doc.createElement('div');
    v.className = 'hha-fx-vignette';
    v.setAttribute('aria-hidden','true');
    v.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:89',
      'opacity:0',
      'transition:opacity 140ms ease',
      'background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,.35) 85%)'
    ].join(';') + ';';
    doc.body.appendChild(v);
    return v;
  }

  function addStyle(){
    if(doc.getElementById('hhaParticlesStyle')) return;

    const st = doc.createElement('style');
    st.id = 'hhaParticlesStyle';
    st.textContent = `
      .hha-fx-layer .hha-fx-pop{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        color:#fff;
        text-shadow: 0 10px 28px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 560ms ease-out forwards;
      }
      .hha-fx-layer .hha-fx-score{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 1100 20px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        color:#fff;
        letter-spacing:.2px;
        text-shadow: 0 10px 28px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaScore 720ms cubic-bezier(.16,.9,.2,1) forwards;
      }
      .hha-fx-layer .hha-fx-burst{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 1200 22px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaBurst 520ms ease-out forwards;
        filter: drop-shadow(0 12px 22px rgba(0,0,0,.55));
      }
      .hha-fx-layer .hha-fx-spark{
        position:absolute;
        width:10px; height:10px;
        border-radius:999px;
        transform:translate(-50%,-50%);
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaSpark 520ms ease-out forwards;
      }
      .hha-fx-layer .hha-fx-wave{
        position:absolute;
        transform:translate(-50%,-50%);
        border-radius:999px;
        border:4px solid rgba(255,255,255,.35);
        box-shadow: 0 0 0 10px rgba(255,255,255,.06);
        opacity:.9;
        will-change: transform, opacity;
        animation: hhaWave 520ms ease-out forwards;
      }
      .hha-fx-layer .hha-fx-missx{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 1300 34px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        color:#fff;
        opacity:.98;
        text-shadow: 0 10px 28px rgba(0,0,0,.55);
        will-change: transform, opacity;
        animation: hhaMissX 520ms ease-out forwards;
      }

      /* variants */
      .hha-fx-good{ filter: drop-shadow(0 0 18px rgba(34,197,94,.28)); }
      .hha-fx-bad { filter: drop-shadow(0 0 18px rgba(239,68,68,.32)); }
      .hha-fx-warn{ filter: drop-shadow(0 0 18px rgba(245,158,11,.26)); }
      .hha-fx-cyan{ filter: drop-shadow(0 0 18px rgba(34,211,238,.24)); }
      .hha-fx-violet{ filter: drop-shadow(0 0 18px rgba(167,139,250,.26)); }

      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.95; }
        70%{ transform:translate(-50%,-88%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-110%) scale(1.04); opacity:0; }
      }
      @keyframes hhaScore{
        0%{ transform:translate(-50%,-50%) scale(.9); opacity:.0; }
        15%{ transform:translate(-50%,-55%) scale(1.10); opacity:1; }
        70%{ transform:translate(-50%,-92%) scale(1.05); opacity:1; }
        100%{ transform:translate(-50%,-112%) scale(1.0); opacity:0; }
      }
      @keyframes hhaBurst{
        0%{ transform:translate(-50%,-50%) scale(.7) rotate(-8deg); opacity:0; }
        18%{ transform:translate(-50%,-50%) scale(1.18) rotate(6deg); opacity:1; }
        70%{ transform:translate(-50%,-62%) scale(1.06) rotate(0deg); opacity:1; }
        100%{ transform:translate(-50%,-76%) scale(.96) rotate(0deg); opacity:0; }
      }
      @keyframes hhaSpark{
        0%{ transform:translate(-50%,-50%) scale(.6); opacity:.95; }
        100%{ transform:translate(var(--tx), var(--ty)) scale(.2); opacity:0; }
      }
      @keyframes hhaWave{
        0%{ transform:translate(-50%,-50%) scale(.2); opacity:.88; }
        100%{ transform:translate(-50%,-50%) scale(1.18); opacity:0; }
      }
      @keyframes hhaMissX{
        0%{ transform:translate(-50%,-50%) scale(.7); opacity:0; }
        18%{ transform:translate(-50%,-52%) scale(1.1); opacity:1; }
        100%{ transform:translate(-50%,-80%) scale(.92); opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  }

  function tagToCls(kind){
    const k = String(kind||'').toLowerCase();
    if(k.includes('bad') || k.includes('junk') || k.includes('miss')) return 'hha-fx-bad';
    if(k.includes('warn') || k.includes('star')) return 'hha-fx-warn';
    if(k.includes('shield') || k.includes('cyan')) return 'hha-fx-cyan';
    if(k.includes('diamond') || k.includes('violet')) return 'hha-fx-violet';
    return 'hha-fx-good';
  }

  function safeXY(x,y){
    const W = doc.documentElement.clientWidth || 1;
    const H = doc.documentElement.clientHeight || 1;
    return {
      x: clamp(Number(x)||0, 0, W),
      y: clamp(Number(y)||0, 0, H)
    };
  }

  function popText(x,y,text,cls){
    addStyle();
    const layer = ensureLayer();
    const p = safeXY(x,y);

    const el = doc.createElement('div');
    el.className = 'hha-fx-pop ' + (cls ? String(cls) : '');
    el.textContent = String(text ?? '');
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  function scorePop(x,y,text,kind){
    addStyle();
    const layer = ensureLayer();
    const p = safeXY(x,y);

    const el = doc.createElement('div');
    el.className = 'hha-fx-score ' + tagToCls(kind);
    el.textContent = String(text ?? '');
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 900);
  }

  function shockwave(x,y,opts){
    addStyle();
    const layer = ensureLayer();
    const p = safeXY(x,y);
    const o = opts || {};
    const size = clamp(Number(o.size)||160, 80, 420);
    const dur  = clamp(Number(o.durMs)||520, 260, 980);
    const kind = o.kind || 'good';

    const el = doc.createElement('div');
    el.className = 'hha-fx-wave ' + tagToCls(kind);
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.animationDuration = dur + 'ms';

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, dur + 80);
  }

  function burstAt(x,y,kindOrOpts){
    addStyle();
    const layer = ensureLayer();
    const p = safeXY(x,y);

    let opts = null;
    if(typeof kindOrOpts === 'object' && kindOrOpts){
      opts = kindOrOpts;
    }else{
      opts = { kind: kindOrOpts };
    }

    const kind = opts.kind || 'good';
    const emoji = opts.emoji || (kind==='bad' || kind==='junk' ? '💥' :
                                kind==='star' ? '⭐' :
                                kind==='shield' ? '🛡️' :
                                kind==='diamond' ? '💎' : '✨');
    const count = clamp(Number(opts.count)||10, 4, 28);
    const size  = clamp(Number(opts.size)||22, 14, 44);
    const dur   = clamp(Number(opts.durMs)||520, 280, 980);

    // center emoji burst
    const e = doc.createElement('div');
    e.className = 'hha-fx-burst ' + tagToCls(kind);
    e.textContent = emoji;
    e.style.left = p.x + 'px';
    e.style.top  = p.y + 'px';
    e.style.fontSize = size + 'px';
    e.style.animationDuration = dur + 'ms';
    layer.appendChild(e);

    // sparks
    for(let i=0;i<count;i++){
      const s = doc.createElement('div');
      s.className = 'hha-fx-spark ' + tagToCls(kind);

      const ang = (Math.PI * 2) * (i / count);
      const r = 26 + (Math.random()*28);
      const tx = Math.cos(ang) * (r + Math.random()*22);
      const ty = Math.sin(ang) * (r + Math.random()*22);

      s.style.left = p.x + 'px';
      s.style.top  = p.y + 'px';
      s.style.width = (6 + Math.random()*10) + 'px';
      s.style.height= s.style.width;
      s.style.opacity = String(0.75 + Math.random()*0.20);

      // random pastel-ish via hsla (no fixed palette)
      const hue = (kind==='bad'||kind==='junk') ? (0 + Math.random()*20) :
                  (kind==='star') ? (40 + Math.random()*30) :
                  (kind==='shield') ? (170 + Math.random()*30) :
                  (kind==='diamond') ? (250 + Math.random()*30) :
                  (110 + Math.random()*40);
      s.style.background = `hsla(${hue}, 92%, 68%, .92)`;

      s.style.setProperty('--tx', `calc(-50% + ${tx}px)`);
      s.style.setProperty('--ty', `calc(-50% + ${ty}px)`);
      s.style.animationDuration = dur + 'ms';

      layer.appendChild(s);
      setTimeout(()=>{ try{ s.remove(); }catch(_){ } }, dur + 60);
    }

    // optional wave
    if(opts.wave !== false){
      shockwave(p.x, p.y, { size: (opts.waveSize||180), durMs: Math.round(dur*0.92), kind });
    }

    setTimeout(()=>{ try{ e.remove(); }catch(_){ } }, dur + 80);
  }

  function missX(x,y,opts){
    addStyle();
    const layer = ensureLayer();
    const p = safeXY(x,y);
    const o = opts || {};
    const emoji = o.emoji || '✖';
    const kind = o.kind || 'bad';
    const dur  = clamp(Number(o.durMs)||520, 280, 980);

    const el = doc.createElement('div');
    el.className = 'hha-fx-missx ' + tagToCls(kind);
    el.textContent = emoji;
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.style.animationDuration = dur + 'ms';

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, dur + 80);
  }

  function celebrate(opts){
    addStyle();
    const layer = ensureLayer();
    const o = opts || {};
    const W = doc.documentElement.clientWidth || 1;
    const H = doc.documentElement.clientHeight || 1;

    const kind = o.kind || 'good';
    const n = clamp(Number(o.count)||18, 8, 42);
    const dur = clamp(Number(o.durMs)||780, 420, 1600);

    for(let i=0;i<n;i++){
      const x = Math.random() * W;
      const y = (Math.random() * H) * 0.65;

      burstAt(x, y, {
        kind,
        emoji: o.emoji || (kind==='end' ? '🎉' : '✨'),
        count: 8 + Math.floor(Math.random()*10),
        size: 18 + Math.floor(Math.random()*16),
        durMs: dur - Math.floor(Math.random()*160),
        wave: false
      });
    }

    // optional vignette flash
    try{
      const v = ensureVignette();
      v.style.opacity = String(o.vignetteOpacity ?? 0.35);
      setTimeout(()=>{ try{ v.style.opacity = '0'; }catch(_){ } }, 220);
    }catch(_){}
  }

  // expose
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt = burstAt;
  root.Particles.shockwave = shockwave;
  root.Particles.missX = missX;
  root.Particles.celebrate = celebrate;

  // compatibility for your engine calls (GAME_MODULES)
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);