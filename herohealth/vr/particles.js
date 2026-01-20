// === /herohealth/vr/particles.js ===
// HHA Particles — PACK-FAIR (PRODUCTION)
// ✅ Provides: window.Particles + window.GAME_MODULES.Particles
// ✅ Functions used across games:
//    - popText(x,y,text,cls?,opts?)
//    - burstAt(x,y,kind?,opts?)
//    - ringPulse(x,y,kind?,opts?)
//    - celebrate(kind?,opts?)
// ✅ Safe to include multiple times (singleton guard)
// ✅ No external deps; DOM layer only

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  if(root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------------- layer ----------------
  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if(layer) return layer;

    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:120',
      'overflow:hidden'
    ].join(';');

    DOC.body.appendChild(layer);
    return layer;
  }

  function clamp(v,min,max){
    v = Number(v)||0;
    if(v < min) return min;
    if(v > max) return max;
    return v;
  }

  function px(n){ return Math.round(Number(n)||0) + 'px'; }

  function safeXY(x,y){
    const W = DOC.documentElement.clientWidth || innerWidth || 1;
    const H = DOC.documentElement.clientHeight || innerHeight || 1;
    const sx = clamp(x, 10, W-10);
    const sy = clamp(y, 10, H-10);
    return {x:sx,y:sy};
  }

  function makeEl(tag, cssText){
    const el = DOC.createElement(tag);
    if(cssText) el.style.cssText = cssText;
    return el;
  }

  // ---------------- theme mapping ----------------
  // kind: good | bad | star | shield | violet | cyan | diamond | warn
  function colorHint(kind){
    switch(String(kind||'').toLowerCase()){
      case 'bad': return 'rgba(248,113,113,.95)';     // red-ish
      case 'warn': return 'rgba(245,158,11,.95)';     // amber
      case 'star': return 'rgba(250,204,21,.95)';     // yellow
      case 'shield': return 'rgba(34,211,238,.95)';   // cyan
      case 'cyan': return 'rgba(34,211,238,.95)';
      case 'violet': return 'rgba(167,139,250,.95)';  // violet
      case 'diamond': return 'rgba(167,139,250,.95)';
      case 'good':
      default: return 'rgba(34,197,94,.95)';          // green
    }
  }

  // ---------------- primitives ----------------
  function popText(x,y,text,cls=null,opts=null){
    const layer = ensureLayer();
    const p = safeXY(x,y);

    const o = opts || {};
    const size = clamp(o.size ?? 18, 10, 44);
    const life = clamp(o.lifeMs ?? 820, 260, 2200);
    const rise = clamp(o.risePx ?? 26, 10, 80);
    const blur = clamp(o.blurPx ?? 0, 0, 12);

    const el = makeEl('div');
    el.className = 'hha-fx-pop ' + (cls ? String(cls) : '');
    el.textContent = String(text ?? '');

    const col = (o.color || null);
    const color = col ? String(col) : (
      (cls==='bad'||cls==='danger') ? colorHint('bad') :
      (cls==='warn') ? colorHint('warn') :
      (cls==='cyan') ? colorHint('cyan') :
      (cls==='violet') ? colorHint('violet') :
      colorHint('good')
    );

    el.style.cssText = [
      'position:absolute',
      `left:${px(p.x)}`,
      `top:${px(p.y)}`,
      'transform:translate(-50%,-50%)',
      `font: 1000 ${px(size)}/1 system-ui, -apple-system, "Segoe UI", sans-serif`,
      `color:${color}`,
      'letter-spacing:.2px',
      'text-shadow: 0 2px 0 rgba(0,0,0,.25), 0 10px 28px rgba(0,0,0,.35)',
      `filter:${blur?`blur(${px(blur)})`: 'none'}`,
      'opacity:0',
      'will-change: transform, opacity'
    ].join(';');

    layer.appendChild(el);

    // animate
    const t0 = performance.now();
    requestAnimationFrame(()=>{
      el.style.transition = 'opacity 140ms ease, transform 520ms cubic-bezier(.2,.9,.2,1)';
      el.style.opacity = '1';
      el.style.transform = `translate(-50%,-50%) translateY(-${px(rise)})`;
    });

    // fade out later
    setTimeout(()=>{
      try{
        el.style.transition = 'opacity 260ms ease';
        el.style.opacity = '0';
      }catch(_){}
    }, Math.max(180, life-260));

    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, life+40);

    // legacy alias support
    return { t0, life };
  }

  function burstAt(x,y,kind='good',opts=null){
    const layer = ensureLayer();
    const p = safeXY(x,y);

    const o = opts || {};
    const count = clamp(o.count ?? 12, 6, 28);
    const life = clamp(o.lifeMs ?? 520, 220, 1200);
    const spread = clamp(o.spreadPx ?? 92, 44, 180);
    const size = clamp(o.sizePx ?? 6, 3, 14);

    const color = String(o.color || colorHint(kind));

    const frag = DOC.createDocumentFragment();

    for(let i=0;i<count;i++){
      const dot = makeEl('div');
      dot.className = 'hha-fx-dot';

      const a = (Math.PI*2) * (i/count);
      const r = spread * (0.35 + Math.random()*0.65);
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r;

      dot.style.cssText = [
        'position:absolute',
        `left:${px(p.x)}`,
        `top:${px(p.y)}`,
        'width:0px;height:0px',
        'transform:translate(-50%,-50%)',
        'opacity:1',
        'will-change: transform, opacity'
      ].join(';');

      const core = makeEl('div');
      core.style.cssText = [
        `width:${px(size + Math.random()*size)}`,
        `height:${px(size + Math.random()*size)}`,
        'border-radius:999px',
        `background:${color}`,
        'box-shadow: 0 10px 30px rgba(0,0,0,.28)',
      ].join(';');

      dot.appendChild(core);
      frag.appendChild(dot);

      // animate each dot
      requestAnimationFrame(()=>{
        dot.style.transition = `transform ${life}ms cubic-bezier(.2,.9,.2,1), opacity ${life}ms ease`;
        dot.style.transform = `translate(-50%,-50%) translate(${px(dx)},${px(dy)})`;
        dot.style.opacity = '0';
      });

      setTimeout(()=>{ try{ dot.remove(); }catch(_){} }, life+80);
    }

    layer.appendChild(frag);
  }

  function ringPulse(x,y,kind='good',opts=null){
    const layer = ensureLayer();
    const p = safeXY(x,y);

    const o = opts || {};
    const size = clamp(o.size ?? 140, 80, 420);
    const life = clamp(o.lifeMs ?? 520, 220, 1300);
    const width = clamp(o.strokePx ?? 4, 2, 10);
    const color = String(o.color || colorHint(kind));

    const ring = makeEl('div');
    ring.className = 'hha-fx-ring';

    ring.style.cssText = [
      'position:absolute',
      `left:${px(p.x)}`,
      `top:${px(p.y)}`,
      `width:${px(size)}`,
      `height:${px(size)}`,
      'border-radius:999px',
      `border:${px(width)} solid ${color}`,
      'transform:translate(-50%,-50%) scale(.65)',
      'opacity:.0',
      'box-shadow: 0 14px 40px rgba(0,0,0,.25)',
      'will-change: transform, opacity'
    ].join(';');

    layer.appendChild(ring);

    requestAnimationFrame(()=>{
      ring.style.transition = `transform ${life}ms cubic-bezier(.2,.9,.2,1), opacity ${life}ms ease`;
      ring.style.opacity = '0.95';
      ring.style.transform = 'translate(-50%,-50%) scale(1.05)';
    });

    setTimeout(()=>{ try{ ring.style.opacity = '0'; }catch(_){} }, Math.max(160, life-260));
    setTimeout(()=>{ try{ ring.remove(); }catch(_){} }, life+80);
  }

  function celebrate(kind='win', opts=null){
    const layer = ensureLayer();
    const o = opts || {};
    const count = clamp(o.count ?? 18, 8, 60);
    const life = clamp(o.lifeMs ?? 1100, 520, 2600);

    const W = DOC.documentElement.clientWidth || innerWidth || 1;
    const H = DOC.documentElement.clientHeight || innerHeight || 1;

    // confetti-ish dots
    const colors = [
      colorHint('good'),
      colorHint('star'),
      colorHint('cyan'),
      colorHint('violet'),
      'rgba(255,255,255,.92)'
    ];

    for(let i=0;i<count;i++){
      const x = Math.random() * W;
      const y = Math.random() * (H * 0.35);

      const c = colors[(Math.random()*colors.length)|0];

      const piece = makeEl('div');
      piece.style.cssText = [
        'position:absolute',
        `left:${px(x)}`,
        `top:${px(y)}`,
        'transform:translate(-50%,-50%)',
        'opacity:0',
        'will-change: transform, opacity'
      ].join(';');

      const w = clamp(6 + Math.random()*10, 6, 18);
      const h = clamp(8 + Math.random()*14, 8, 26);

      const core = makeEl('div');
      core.style.cssText = [
        `width:${px(w)}`,
        `height:${px(h)}`,
        'border-radius:10px',
        `background:${c}`,
        'box-shadow: 0 16px 40px rgba(0,0,0,.25)'
      ].join(';');

      piece.appendChild(core);
      layer.appendChild(piece);

      const fall = (H * 0.55) + Math.random() * (H * 0.35);
      const drift = (-W*0.12) + Math.random() * (W*0.24);
      const rot = (-80) + Math.random()*160;

      requestAnimationFrame(()=>{
        piece.style.transition = `transform ${life}ms cubic-bezier(.2,.9,.2,1), opacity 220ms ease`;
        piece.style.opacity = '1';
        piece.style.transform = `translate(-50%,-50%) translate(${px(drift)},${px(fall)}) rotate(${rot}deg)`;
      });

      setTimeout(()=>{ try{ piece.style.opacity = '0'; }catch(_){} }, Math.max(240, life-260));
      setTimeout(()=>{ try{ piece.remove(); }catch(_){} }, life+120);
    }

    // optional banner pop
    if(String(kind||'') === 'boss'){
      popText(W/2, H*0.22, 'BOSS DOWN!', 'good', { size: 26, lifeMs: 1200 });
      ringPulse(W/2, H*0.25, 'violet', { size: 320, lifeMs: 780, strokePx: 6 });
    }
  }

  // legacy helper name used in some older patches (safe)
  function scorePop(x,y,text){
    popText(x,y,text,'good',{ size: 18, lifeMs: 720 });
  }

  const API = {
    popText,
    scorePop,
    burstAt,
    ringPulse,
    celebrate
  };

  root.Particles = API;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = API;

})(window);